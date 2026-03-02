import { Blob, Entity, Food, Virus, PowerUp, PowerUpType, Obstacle, ObstacleShape } from './Entities';
import { SoundManager } from './SoundManager';
import { QuadTree, Rectangle } from './QuadTree';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private lastTime: number = 0;
    private entities: Entity[] = [];
    private playerBlobs: Blob[] = [];
    private camera = { x: 0, y: 0, scale: 1 };
    private worldSize = 15000;
    private mousePos = { x: 0, y: 0 };
    private onGameOver: (stats: { mass: number }) => void;
    private playerPowerUps = {
        speed: 0,
        shield: 0
    };
    private obstacles: Obstacle[] = [];
    private isEditorMode: boolean = false;
    private selectedShape: ObstacleShape = 'RECT';
    private isSpectating: boolean = false;
    private startTime: number = Date.now();
    private gameMode: 'ffa' | 'team' = 'ffa';
    private playerName: string = 'Guest';
    private playerSkin: string = 'default';
    private quadTree!: QuadTree;
    private onKill: (eater: string, eaten: string) => void;
    private particles: { x: number, y: number, radius: number, alpha: number, color: string }[] = [];

    constructor(canvas: HTMLCanvasElement, onGameOver: (stats: { mass: number }) => void, onKill: (eater: string, eaten: string) => void) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.onGameOver = onGameOver;
        this.onKill = onKill;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.quadTree = new QuadTree(new Rectangle(0, 0, this.worldSize / 2, this.worldSize / 2), 10);


        // Initial food
        this.spawnFood(800);
        // Initial bots
        this.spawnBots(15);
        // Initial viruses
        this.spawnViruses(20);
        // Initial power-ups
        this.spawnPowerUps(8);

        requestAnimationFrame(this.loop.bind(this));

        // Passive food spawning
        setInterval(() => {
            if (this.entities.filter(e => e instanceof Food).length < 3000) {
                this.spawnFood(15);
            }
        }, 333);
    }

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    private spawnFood(count: number) {
        const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * this.worldSize;
            const y = (Math.random() - 0.5) * this.worldSize;
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.entities.push(new Food(`food-${Date.now()}-${i}`, x, y, color));
        }
    }

    private spawnBots(count: number) {
        const names = ['Rex', 'Zorg', 'Alpha', 'Beta', 'Gamer', 'Bot99', 'Blobbie'];
        const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * this.worldSize;
            const y = (Math.random() - 0.5) * this.worldSize;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const team = this.gameMode === 'team' ? (Math.random() > 0.5 ? 'red' : 'blue') : undefined;
            this.entities.push(new Blob({
                id: `bot-${Date.now()}-${i}`,
                position: { x, y },
                velocity: { x: 0, y: 0 },
                mass: 15 + Math.random() * 25,
                radius: 0,
                color,
                type: 'bot',
                name: names[Math.floor(Math.random() * names.length)],
                team: team as 'red' | 'blue' | undefined
            }));
        }
    }

    private spawnViruses(count: number) {
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * (this.worldSize - 200);
            const y = (Math.random() - 0.5) * (this.worldSize - 200);
            const masses = [40, 70, 110, 180]; // Small, Medium, Large, Extra Large
            const mass = masses[Math.floor(Math.random() * masses.length)];
            this.entities.push(new Virus(`virus-${Date.now()}-${i}`, x, y, mass));
        }
    }

    private spawnPowerUps(count: number) {
        const types: PowerUpType[] = ['SPEED', 'SHIELD', 'MASS'];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * (this.worldSize - 400);
            const y = (Math.random() - 0.5) * (this.worldSize - 400);
            const type = types[Math.floor(Math.random() * types.length)];
            this.entities.push(new PowerUp(`pw-${Date.now()}-${i}`, x, y, type));
        }
    }

    public isPaused: boolean = false;

    private loop(time: number) {
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.loop.bind(this));
    }

    public pause() {
        this.isPaused = true;
    }

    public resume() {
        this.isPaused = false;
        this.lastTime = performance.now(); // Prevents huge delta time jump
    }

    private update(dt: number) {
        if (this.isEditorMode || this.isPaused) return;

        // Update power-up timers
        if (this.playerPowerUps.speed > 0) this.playerPowerUps.speed -= dt * 1000;
        if (this.playerPowerUps.shield > 0) this.playerPowerUps.shield -= dt * 1000;

        this.entities.forEach(entity => {
            if (entity instanceof Blob) {
                entity.decay(dt);
                if (entity.type === 'bot') {
                    entity.updateAI(this.entities, dt);
                } else if (entity.type === 'player') {
                    // Follow mouse
                    entity.target = this.mouseToWorld(this.mousePos.x, this.mousePos.y);
                    // Apply speed boost
                    if (this.playerPowerUps.speed > 0) {
                        entity.speed = 400; // Double speed
                    } else {
                        entity.speed = 200;
                    }
                }
            }
            entity.update(dt);

            // Enforce world boundaries
            const halfSize = this.worldSize / 2;
            entity.position.x = Math.max(-halfSize + entity.radius, Math.min(halfSize - entity.radius, entity.position.x));
            entity.position.y = Math.max(-halfSize + entity.radius, Math.min(halfSize - entity.radius, entity.position.y));
        });

        this.quadTree.clear();
        this.entities.forEach(e => this.quadTree.insert(e));

        // Update particles
        this.particles = this.particles.filter(p => p.alpha > 0.01);
        this.particles.forEach(p => {
            p.radius += 2;
            p.alpha *= 0.9;
        });

        // Handle collisions
        this.checkCollisions();

        // Camera follow group center
        if (this.playerBlobs.length > 0) {
            let avgX = 0, avgY = 0, totalMass = 0;
            this.playerBlobs.forEach(b => {
                avgX += b.position.x * b.mass;
                avgY += b.position.y * b.mass;
                totalMass += b.mass;
            });
            this.camera.x = avgX / totalMass;
            this.camera.y = avgY / totalMass;

            // Zoom out as total mass gets bigger
            const targetScale = Math.max(0.15, 1 / (1 + (Math.sqrt(totalMass) * 5 - 20) / 100));
            this.camera.scale += (targetScale - this.camera.scale) * 0.1;
        } else if (this.isSpectating) {
            // Camera follows the largest bot
            const largestBot = this.entities
                .filter(e => e instanceof Blob && e.type === 'bot')
                .sort((a, b) => b.mass - a.mass)[0] as Blob;

            if (largestBot) {
                this.camera.x += (largestBot.position.x - this.camera.x) * 0.1;
                this.camera.y += (largestBot.position.y - this.camera.y) * 0.1;
                this.camera.scale += (0.5 - this.camera.scale) * 0.05;
            }
        }
    }

    public mouseToWorld(x: number, y: number) {
        return {
            x: (x - this.canvas.width / 2) / this.camera.scale + this.camera.x,
            y: (y - this.canvas.height / 2) / this.camera.scale + this.camera.y
        };
    }

    private checkCollisions() {
        const blobs = this.entities.filter(e => e instanceof Blob) as Blob[];

        blobs.forEach(blob => {
            // Find nearby entities using QuadTree
            const range = new Rectangle(blob.position.x, blob.position.y, blob.radius * 2, blob.radius * 2);
            const targets = this.quadTree.query(range);

            targets.forEach(target => {
                if (blob === target) return;

                const dx = blob.position.x - target.position.x;
                const dy = blob.position.y - target.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // 1. Eat food/powerups
                if (target instanceof Food || target instanceof PowerUp) {
                    if (dist < blob.radius) {
                        if (target instanceof PowerUp) {
                            SoundManager.playPowerUp();
                            this.applyPowerUp(target.powerType);
                            this.entities = this.entities.filter(e => e !== target);
                            setTimeout(() => this.spawnPowerUps(1), 5000);
                        } else if (target instanceof Food) {
                            blob.addMass(target.mass);
                            SoundManager.playEatFood();
                            this.entities = this.entities.filter(e => e !== target);
                            this.spawnFood(1);
                        }
                    }
                }

                // 2. Interaction with other Blobs (Eating or Colliding)
                else if (target instanceof Blob) {
                    const sameTeam = this.gameMode === 'team' && blob.team === target.team && blob.team !== undefined;
                    const bothPlayer = blob.type === 'player' && target.type === 'player';

                    if (!sameTeam && dist < blob.radius && blob.mass > target.mass * 1.1) {
                        // Blob eats target
                        const eaterName = blob.name || (blob.type === 'player' ? this.playerName : 'Bot');
                        const eatenName = target.name || (target instanceof Blob ? (target.type === 'player' ? 'Player' : 'Bot') : 'Something');

                        if (target instanceof Blob) {
                            this.onKill(eaterName, eatenName);
                        }

                        this.emitParticles(target.position.x, target.position.y, target.color);

                        blob.addMass(target.mass);
                        SoundManager.playEatEnemy();
                        this.entities = this.entities.filter(e => e !== target);

                        if (target.type === 'player') {
                            this.playerBlobs = this.playerBlobs.filter(b => b !== target);
                        } else {
                            setTimeout(() => this.spawnBots(1), 2000);
                        }
                    } else if (bothPlayer) {
                        // Merging or Pushing logic between player's own blobs
                        const now = Date.now();
                        const canMerge = (now - blob.splitTimestamp > 15000) && (now - target.splitTimestamp > 15000);
                        const minClearance = blob.radius + target.radius;

                        if (canMerge && dist < minClearance * 0.8) {
                            if (blob.mass >= target.mass) {
                                blob.addMass(target.mass);
                                SoundManager.playMerge();
                                this.playerBlobs = this.playerBlobs.filter(b => b !== target);
                                this.entities = this.entities.filter(e => e !== target);
                            }
                        } else if (!canMerge && dist < minClearance) {
                            const angle = Math.atan2(dy, dx);
                            const pushDist = (minClearance - dist) * 0.5;
                            blob.position.x += Math.cos(angle) * pushDist;
                            blob.position.y += Math.sin(angle) * pushDist;
                            target.position.x -= Math.cos(angle) * pushDist;
                            target.position.y -= Math.sin(angle) * pushDist;
                        }
                    }
                }

                // 3. Virus Interaction
                else if (target instanceof Virus) {
                    if (dist < blob.radius && blob.mass > target.mass * 1.1) {
                        if (this.playerPowerUps.shield > 0 && blob.type === 'player') {
                            blob.addMass(target.mass / 2);
                        } else {
                            this.explodeBlob(blob);
                        }
                        this.entities = this.entities.filter(e => e !== target);
                        setTimeout(() => this.spawnViruses(1), 10000);
                    }
                }

                // 4. Obstacle Interaction
                else if (target instanceof Obstacle) {
                    const minClearance = blob.radius + target.radius;
                    if (dist < minClearance) {
                        const angle = Math.atan2(dy, dx);
                        blob.position.x = target.position.x + Math.cos(angle) * minClearance;
                        blob.position.y = target.position.y + Math.sin(angle) * minClearance;
                    }
                }
            });
        });

        // Check for Game Over
        if (this.playerBlobs.length === 0 && !this.isSpectating) {
            this.handleGameOver();
        }
    }

    private emitParticles(x: number, y: number, color: string) {
        this.particles.push({ x, y, radius: 10, alpha: 0.6, color });
    }

    private handleGameOver() {
        if (this.isSpectating) return;

        const finalMass = this.getPlayerMass();
        const timeAlive = Math.floor((Date.now() - this.startTime) / 1000);
        this.onGameOver({ mass: finalMass, timeAlive } as any);

        this.isSpectating = true;
    }

    public respawn() {
        const team = this.gameMode === 'team' ? (Math.random() > 0.5 ? 'red' : 'blue') : undefined;
        const player = new Blob({
            id: `player-${Date.now()}`,
            position: { x: (Math.random() - 0.5) * 1000, y: (Math.random() - 0.5) * 1000 },
            velocity: { x: 0, y: 0 },
            mass: 25,
            radius: 0,
            color: team === 'red' ? '#ef4444' : (team === 'blue' ? '#3b82f6' : '#3b82f6'),
            type: 'player',
            name: this.playerName,
            skin: this.playerSkin,
            team: team as 'red' | 'blue' | undefined
        });

        // Remove strictly any existing player blobs from entities to fix the ghost bug
        this.entities = this.entities.filter(e => !(e instanceof Blob && e.type === 'player'));

        this.playerBlobs = [player];
        this.entities.push(player);
        this.isSpectating = false;
        this.startTime = Date.now();
    }

    private draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();

        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.camera.scale, this.camera.scale);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        this.drawGrid();

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 10;
        this.ctx.strokeRect(-this.worldSize / 2, -this.worldSize / 2, this.worldSize, this.worldSize);

        this.entities.sort((a, b) => a.mass - b.mass).forEach(entity => {
            entity.draw(this.ctx, this.camera);
        });

        // Draw particles
        this.particles.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.closePath();
        });
        this.ctx.globalAlpha = 1.0;

        this.obstacles.forEach(obs => {
            obs.draw(this.ctx, this.camera);
        });

        this.ctx.restore();
    }

    private drawGrid() {
        const gridSize = 100;
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let x = -this.worldSize / 2; x <= this.worldSize / 2; x += gridSize) {
            this.ctx.moveTo(x, -this.worldSize / 2);
            this.ctx.lineTo(x, this.worldSize / 2);
        }
        for (let y = -this.worldSize / 2; y <= this.worldSize / 2; y += gridSize) {
            this.ctx.moveTo(-this.worldSize / 2, y);
            this.ctx.lineTo(this.worldSize / 2, y);
        }
        this.ctx.stroke();
    }

    public setPlayerTarget(x: number, y: number) {
        this.mousePos = { x, y };
    }

    public setPlayerName(name: string) {
        this.playerName = name;
        this.playerBlobs.forEach(b => b.name = name);
    }

    public setGameMode(mode: 'ffa' | 'team') {
        this.gameMode = mode;
        // Re-assign teams to all bots
        this.entities.forEach(e => {
            if (e instanceof Blob && e.type === 'bot') {
                e.team = mode === 'team' ? (Math.random() > 0.5 ? 'red' : 'blue') : undefined;
            }
        });
    }

    public setPlayerSkin(skin: string) {
        this.playerSkin = skin;
        this.playerBlobs.forEach(b => b.skin = skin);
    }

    public getPlayerMass(): number {
        return Math.floor(this.playerBlobs.reduce((sum, b) => sum + b.mass, 0));
    }

    public getLeaderboard() {
        return this.entities
            .filter(e => e instanceof Blob)
            .map(e => ({ name: (e as Blob).name, mass: Math.floor(e.mass) }))
            .sort((a, b) => b.mass - a.mass)
            .slice(0, 10);
    }

    private applyPowerUp(type: PowerUpType) {
        if (type === 'SPEED') {
            this.playerPowerUps.speed = 10000;
        } else if (type === 'SHIELD') {
            this.playerPowerUps.shield = 10000;
        } else if (type === 'MASS') {
            this.playerBlobs.forEach(b => b.addMass(50));
        }
    }

    public split() {
        if (this.playerBlobs.length >= 16) return;
        SoundManager.playSplit();
        const newBlobs: Blob[] = [];
        this.playerBlobs.forEach(blob => {
            if (blob.mass >= 35) {
                const halfMass = blob.mass / 2;
                blob.mass = halfMass;
                blob.calculateRadius();
                blob.splitTimestamp = Date.now();

                const mouseWorld = this.mouseToWorld(this.mousePos.x, this.mousePos.y);
                const angle = Math.atan2(mouseWorld.y - blob.position.y, mouseWorld.x - blob.position.x);

                const splitBlob = new Blob({
                    id: `player-${Date.now()}-${Math.random()}`,
                    position: { ...blob.position },
                    velocity: {
                        x: Math.cos(angle) * 800,
                        y: Math.sin(angle) * 800
                    },
                    mass: halfMass,
                    radius: 0,
                    color: blob.color,
                    type: 'player',
                    name: blob.name,
                    skin: blob.skin,
                    team: blob.team
                });
                newBlobs.push(splitBlob);
            }
        });
        newBlobs.forEach(b => {
            this.playerBlobs.push(b);
            this.entities.push(b);
        });
    }

    private explodeBlob(blob: Blob) {
        if (this.playerBlobs.length >= 16) return;
        const maxPieces = 8;
        const canCreate = Math.min(maxPieces, 16 - this.playerBlobs.length);
        if (canCreate <= 1) return;

        const pieceMass = blob.mass / canCreate;
        blob.mass = pieceMass;
        blob.calculateRadius();
        blob.splitTimestamp = Date.now();

        for (let i = 0; i < canCreate - 1; i++) {
            const angle = Math.random() * Math.PI * 2;
            const piece = new Blob({
                id: `player-explode-${Date.now()}-${i}`,
                position: { ...blob.position },
                velocity: {
                    x: Math.cos(angle) * 500,
                    y: Math.sin(angle) * 500
                },
                mass: pieceMass,
                radius: 0,
                color: blob.color,
                type: 'player',
                name: blob.name,
                skin: blob.skin,
                team: blob.team
            });
            this.playerBlobs.push(piece);
            this.entities.push(piece);
        }
    }

    public ejectMass() {
        let ejected = false;
        this.playerBlobs.forEach(blob => {
            if (blob.mass >= 35) {
                ejected = true;
                const ejectAmount = 15;
                blob.mass -= ejectAmount;
                blob.calculateRadius();

                const mouseWorld = this.mouseToWorld(this.mousePos.x, this.mousePos.y);
                const angle = Math.atan2(mouseWorld.y - blob.position.y, mouseWorld.x - blob.position.x);

                const food = new Food(
                    `food-eject-${Date.now()}-${Math.random()}`,
                    blob.position.x + Math.cos(angle) * (blob.radius + 20),
                    blob.position.y + Math.sin(angle) * (blob.radius + 20),
                    blob.color
                );
                food.mass = ejectAmount * 0.8;
                food.calculateRadius();
                food.velocity = {
                    x: Math.cos(angle) * 600,
                    y: Math.sin(angle) * 600
                };
                this.entities.push(food);
            }
        });
        if (ejected) SoundManager.playEject();
    }

    // Map Editor Methods
    public setEditorMode(enabled: boolean) { this.isEditorMode = enabled; }
    public setSelectedShape(shape: ObstacleShape) { this.selectedShape = shape; }
    public addObstacleAt(x: number, y: number) {
        const id = `obs-${Date.now()}`;
        this.obstacles.push(new Obstacle(id, x, y, this.selectedShape, 200, 200));
    }
    public removeObstacleAt(x: number, y: number) {
        this.obstacles = this.obstacles.filter(obs => {
            const dx = x - obs.position.x;
            const dy = y - obs.position.y;
            return Math.sqrt(dx * dx + dy * dy) > obs.radius;
        });
    }
    public clearMap() { this.obstacles = []; }
    public setWorldSize(size: number) { this.worldSize = size; }
    public getMapData() {
        return {
            worldSize: this.worldSize,
            obstacles: this.obstacles.map(o => ({
                id: o.id, x: o.position.x, y: o.position.y,
                shape: o.shape, width: o.width, height: o.height,
                rotation: o.rotation, color: o.color
            }))
        };
    }
    public loadMap(data: any) {
        if (data.worldSize) this.worldSize = data.worldSize;
        if (data.obstacles) {
            this.obstacles = data.obstacles.map((o: any) =>
                new Obstacle(o.id, o.x, o.y, o.shape, o.width, o.height, o.color, o.rotation)
            );
        }
    }
}
