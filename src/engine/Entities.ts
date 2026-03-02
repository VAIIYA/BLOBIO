export interface Vector {
    x: number;
    y: number;
}

export interface EntityState {
    id: string;
    position: Vector;
    velocity: Vector;
    mass: number;
    radius: number;
    color: string;
    type: 'player' | 'bot' | 'food' | 'virus' | 'obstacle';
    name?: string;
    skin?: string;
    team?: 'red' | 'blue';
}

export abstract class Entity {
    id: string;
    position: Vector;
    velocity: Vector;
    mass: number;
    radius: number;
    color: string;
    type: 'player' | 'bot' | 'food' | 'virus' | 'obstacle';
    name?: string;
    skin?: string;
    team?: 'red' | 'blue';

    friction: number = 0.98;

    constructor(state: EntityState) {
        this.id = state.id;
        this.position = { ...state.position };
        this.velocity = { ...state.velocity };
        this.mass = state.mass;
        this.radius = state.radius;
        this.color = state.color;
        this.type = state.type;
        this.name = state.name;
        this.skin = state.skin;
        this.team = state.team;
    }

    update(dt: number) {
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        // Apply friction to velocity
        this.velocity.x *= Math.pow(this.friction, dt * 60);
        this.velocity.y *= Math.pow(this.friction, dt * 60);
    }

    abstract draw(ctx: CanvasRenderingContext2D, camera: { x: number, y: number, scale: number }): void;

    calculateRadius() {
        this.radius = Math.sqrt(this.mass / Math.PI) * 10;
    }

    addMass(amount: number) {
        this.mass += amount;
        this.calculateRadius();
    }
}

export class Food extends Entity {
    constructor(id: string, x: number, y: number, color: string) {
        super({
            id,
            position: { x, y },
            velocity: { x: 0, y: 0 },
            mass: 1,
            radius: 4,
            color,
            type: 'food'
        });
        this.calculateRadius();
    }

    draw(ctx: CanvasRenderingContext2D, _camera: { x: number, y: number, scale: number }) {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

export class Blob extends Entity {
    target: Vector = { x: 0, y: 0 };
    speed: number = 200;

    splitTimestamp: number = 0;

    constructor(state: EntityState) {
        super(state);
        this.calculateRadius();
        this.splitTimestamp = Date.now();
    }

    update(dt: number) {
        // Basic movement towards target
        const dx = this.target.x - this.position.x;
        const dy = this.target.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            const angle = Math.atan2(dy, dx);
            // Speed decreases as mass increases
            const currentSpeed = this.speed / Math.pow(this.mass, 0.1);

            // Blend target velocity with current velocity to allow impulses (split/eject) to persist
            const targetVelX = Math.cos(angle) * currentSpeed;
            const targetVelY = Math.sin(angle) * currentSpeed;

            // Smoothly move towards target velocity
            this.velocity.x += (targetVelX - this.velocity.x) * 0.1;
            this.velocity.y += (targetVelY - this.velocity.y) * 0.1;
        }

        super.update(dt);
    }

    public decay(dt: number) {
        // Only decay if mass is significant (e.g., > 100)
        if (this.mass > 100) {
            const decayAmount = this.mass * 0.001 * dt; // 0.1% per second
            this.mass -= decayAmount;
            this.calculateRadius();
        }
    }

    public updateAI(entities: Entity[], dt: number) {
        if (this.type !== 'bot') return;
        // Optimization: Only update AI logic ~10 times per second
        if (dt > 0 && Math.random() > 10 * dt) return;

        let nearestThreat: Entity | null = null;
        let nearestPrey: Entity | null = null;
        let minDistThreat = Infinity;
        let minDistPrey = Infinity;

        const threatRadius = 800;
        const huntRadius = 1200;

        for (const entity of entities) {
            if (entity === this || entity instanceof Food || entity instanceof PowerUp || entity instanceof Obstacle) continue;

            const dx = entity.position.x - this.position.x;
            const dy = entity.position.y - this.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (entity instanceof Blob) {
                const sameTeam = this.team && entity.team && this.team === entity.team;
                if (sameTeam) continue;

                if (entity.mass > this.mass * 1.1) {
                    // Threat
                    if (dist < threatRadius && dist < minDistThreat) {
                        minDistThreat = dist;
                        nearestThreat = entity;
                    }
                } else if (this.mass > entity.mass * 1.1) {
                    // Prey
                    if (dist < huntRadius && dist < minDistPrey) {
                        minDistPrey = dist;
                        nearestPrey = entity;
                    }
                }
            } else if (entity instanceof Virus) {
                if (this.mass > entity.mass * 1.1 && dist < threatRadius) {
                    // Virus is a threat to large blobs
                    if (dist < minDistThreat) {
                        minDistThreat = dist;
                        nearestThreat = entity;
                    }
                }
            }
        }

        if (nearestThreat) {
            // Flee
            const dx = this.position.x - nearestThreat.position.x;
            const dy = this.position.y - nearestThreat.position.y;
            const angle = Math.atan2(dy, dx);
            this.target = {
                x: this.position.x + Math.cos(angle) * 500,
                y: this.position.y + Math.sin(angle) * 500
            };
        } else if (nearestPrey) {
            // Chase
            this.target = { ...nearestPrey.position };
        } else {
            // Random wander
            if (Math.random() < 0.01) {
                this.target = {
                    x: this.position.x + (Math.random() - 0.5) * 1000,
                    y: this.position.y + (Math.random() - 0.5) * 1000
                };
            }
        }
    }

    private static skinCache: Map<string, HTMLImageElement> = new Map();

    draw(ctx: CanvasRenderingContext2D, _camera: { x: number, y: number, scale: number }) {
        ctx.save();

        // Check for image skin
        const imageSkins = ['doge', 'bunny', 'alien_face'];
        if (this.skin && imageSkins.includes(this.skin)) {
            let img = Blob.skinCache.get(this.skin);
            if (!img) {
                img = new Image();
                img.src = `/skins/${this.skin}.png`;
                Blob.skinCache.set(this.skin, img);
            }

            if (img.complete && img.naturalWidth !== 0) {
                ctx.beginPath();
                ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(
                    img,
                    this.position.x - this.radius,
                    this.position.y - this.radius,
                    this.radius * 2,
                    this.radius * 2
                );
                ctx.closePath();

                // Draw border for image skins
                ctx.beginPath();
                ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
                ctx.strokeStyle = this.team ? (this.team === 'red' ? '#ef4444' : '#3b82f6') : 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = this.team ? 6 : 2;
                ctx.stroke();
                ctx.closePath();
            } else {
                // Fallback while loading
                this.drawDefault(ctx);
            }
        } else {
            this.drawDefault(ctx);
        }

        // Draw name
        if (this.name) {
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(12, this.radius / 2)}px Inter, system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 5;
            ctx.shadowColor = 'black';
            ctx.fillText(this.name, this.position.x, this.position.y);
        }

        ctx.restore();
    }

    private drawDefault(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);

        if (this.skin === 'neon') {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
        } else if (this.skin === 'alien') {
            const grad = ctx.createRadialGradient(
                this.position.x, this.position.y, 0,
                this.position.x, this.position.y, this.radius
            );
            grad.addColorStop(0, '#4ade80');
            grad.addColorStop(1, '#166534');
            ctx.fillStyle = grad;
        } else if (this.skin === 'core') {
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (this.skin === 'ghost') {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 0.5;
        } else {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        }

        ctx.fill();
        ctx.strokeStyle = this.team ? (this.team === 'red' ? '#ef4444' : '#3b82f6') : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = this.team ? 6 : 2;
        ctx.stroke();
        ctx.closePath();
    }
}

export class Virus extends Entity {
    constructor(id: string, x: number, y: number, mass: number = 50) {
        super({
            id,
            position: { x, y },
            velocity: { x: 0, y: 0 },
            mass,
            radius: 0,
            color: '#22c55e',
            type: 'virus'
        });
        this.calculateRadius();
        this.radius *= 1.1; // Viruses look slightly bigger for their mass
    }

    draw(ctx: CanvasRenderingContext2D, _camera: { x: number, y: number, scale: number }) {
        ctx.save();
        ctx.beginPath();
        const spikes = 20;
        const innerRadius = this.radius * 0.8;
        const outerRadius = this.radius;

        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i * Math.PI) / spikes;
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const x = this.position.x + Math.cos(angle) * r;
            const y = this.position.y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
}

export type PowerUpType = 'SPEED' | 'SHIELD' | 'MASS';

export class PowerUp extends Entity {
    powerType: PowerUpType;
    duration: number = 10000; // 10 seconds default

    constructor(id: string, x: number, y: number, type: PowerUpType) {
        const colors = {
            'SPEED': '#fbbf24', // Amber/Yellow
            'SHIELD': '#22d3ee', // Cyan
            'MASS': '#f472b6'    // Pink
        };

        super({
            id,
            position: { x, y },
            velocity: { x: 0, y: 0 },
            mass: 20,
            radius: 20,
            color: colors[type],
            type: 'food' // Treat as food for basic collision, but refine in Game.ts
        });
        this.powerType = type;
        this.radius = 25;
    }

    draw(ctx: CanvasRenderingContext2D, _camera: { x: number, y: number, scale: number }) {
        ctx.save();

        // Outer glow
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.3;
        ctx.fill();

        // Inner circle
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Icon/Text placeholder
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icon = this.powerType === 'SPEED' ? '⚡' : this.powerType === 'SHIELD' ? '🛡️' : '💎';
        ctx.fillText(icon, this.position.x, this.position.y);

        ctx.restore();
    }
}

export type ObstacleShape = 'RECT' | 'CIRCLE' | 'TRIANGLE' | 'LINE';

export class Obstacle extends Entity {
    shape: ObstacleShape;
    width: number;
    height: number;
    rotation: number;

    constructor(id: string, x: number, y: number, shape: ObstacleShape, width: number, height: number, color: string = '#475569', rotation: number = 0) {
        super({
            id,
            position: { x, y },
            velocity: { x: 0, y: 0 },
            mass: 1000,
            radius: Math.max(width, height) / 2,
            color,
            type: 'obstacle'
        });
        this.shape = shape;
        this.width = width;
        this.height = height;
        this.rotation = rotation;
    }

    draw(ctx: CanvasRenderingContext2D, _camera: { x: number, y: number, scale: number }) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        if (this.shape === 'RECT') {
            ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
        } else if (this.shape === 'CIRCLE') {
            ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
        } else if (this.shape === 'TRIANGLE') {
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(-this.width / 2, this.height / 2);
            ctx.lineTo(this.width / 2, this.height / 2);
        } else if (this.shape === 'LINE') {
            ctx.moveTo(-this.width / 2, 0);
            ctx.lineTo(this.width / 2, 0);
            ctx.stroke();
            ctx.restore();
            return;
        }

        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}
