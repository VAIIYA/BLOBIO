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
    type: 'player' | 'bot' | 'food' | 'virus' | 'obstacle' | 'bouncepad' | 'zone';
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
    type: 'player' | 'bot' | 'food' | 'virus' | 'obstacle' | 'bouncepad' | 'zone';
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
        const time = Date.now() / 1000;
        const pulse = 1 + Math.sin(time * 4) * 0.2; // Faster, stronger pulse

        ctx.save();
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius * pulse, 0, Math.PI * 2);

        // Strong neon glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.fillStyle = this.color;

        // Add a slight white center for vibrancy
        const grad = ctx.createRadialGradient(
            this.position.x, this.position.y, 0,
            this.position.x, this.position.y, this.radius * pulse
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, this.color);
        grad.addColorStop(1, this.color);

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }
}

export interface PerimeterPoint {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export class Blob extends Entity {
    target: Vector = { x: 0, y: 0 };
    speed: number = 200;
    splitTimestamp: number = 0;

    // Jelly Physics
    perimeterPoints: PerimeterPoint[] = [];
    numPoints: number = 16;
    elasticity: number = 0.3; // Spring strength
    dampening: number = 0.9;  // Friction for points
    wobbleIntensity: number = 1.0;

    constructor(state: EntityState) {
        super(state);
        this.calculateRadius();
        this.splitTimestamp = Date.now();
        this.initPerimeter();
    }

    private initPerimeter() {
        this.perimeterPoints = [];
        for (let i = 0; i < this.numPoints; i++) {
            const angle = (i / this.numPoints) * Math.PI * 2;
            this.perimeterPoints.push({
                x: Math.cos(angle) * this.radius,
                y: Math.sin(angle) * this.radius,
                vx: 0,
                vy: 0
            });
        }
    }

    private updatePerimeter(dt: number) {
        // Points update scaled by dt (assuming default ~60fps for base values)
        const timeScale = dt * 60;
        for (let i = 0; i < this.numPoints; i++) {
            const pt = this.perimeterPoints[i];
            const angle = (i / this.numPoints) * Math.PI * 2;
            const idealX = Math.cos(angle) * this.radius;
            const idealY = Math.sin(angle) * this.radius;
            const ax = (idealX - pt.x) * this.elasticity * timeScale;
            const ay = (idealY - pt.y) * this.elasticity * timeScale;
            const lagX = -this.velocity.x * 0.05 * timeScale;
            const lagY = -this.velocity.y * 0.05 * timeScale;
            pt.vx = (pt.vx + ax + lagX) * this.dampening;
            pt.vy = (pt.vy + ay + lagY) * this.dampening;
            pt.x += pt.vx;
            pt.y += pt.vy;
        }
    }

    update(dt: number) {
        const dx = this.target.x - this.position.x;
        const dy = this.target.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            const angle = Math.atan2(dy, dx);
            const currentSpeed = this.speed / Math.pow(this.mass, 0.1);
            const targetVelX = Math.cos(angle) * currentSpeed;
            const targetVelY = Math.sin(angle) * currentSpeed;
            this.velocity.x += (targetVelX - this.velocity.x) * 0.1;
            this.velocity.y += (targetVelY - this.velocity.y) * 0.1;
        }

        this.updatePerimeter(dt);
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
                // Large blobs avoid viruses, small blobs hide in them
                if (this.mass > entity.mass * 1.1) {
                    if (dist < threatRadius && dist < minDistThreat) {
                        minDistThreat = dist;
                        nearestThreat = entity;
                    }
                } else if (dist < 200) {
                    // Small blobs might "hide" near viruses if being chased
                    if (nearestThreat) {
                        this.target = { ...entity.position };
                    }
                }
            }
        }

        // Boundary awareness
        const halfSize = 7500; // worldSize / 2
        const margin = 500;
        if (this.position.x > halfSize - margin) this.target.x = -halfSize;
        if (this.position.x < -halfSize + margin) this.target.x = halfSize;
        if (this.position.y > halfSize - margin) this.target.y = -halfSize;
        if (this.position.y < -halfSize + margin) this.target.y = halfSize;

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

    // Integrated Draw Method with Skins & Jelly Physics
    draw(ctx: CanvasRenderingContext2D, camera: { x: number, y: number, scale: number }) {
        if (this.perimeterPoints.length === 0) return;

        ctx.save();
        ctx.beginPath();

        const first = this.perimeterPoints[0];
        const last = this.perimeterPoints[this.numPoints - 1];

        ctx.moveTo(
            this.position.x + (first.x + last.x) / 2,
            this.position.y + (first.y + last.y) / 2
        );

        for (let i = 0; i < this.numPoints; i++) {
            const p1 = this.perimeterPoints[i];
            const p2 = this.perimeterPoints[(i + 1) % this.numPoints];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            ctx.quadraticCurveTo(
                this.position.x + p1.x,
                this.position.y + p1.y,
                this.position.x + midX,
                this.position.y + midY
            );
        }

        ctx.closePath();

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
                ctx.save();
                ctx.clip();
                ctx.drawImage(
                    img,
                    this.position.x - this.radius,
                    this.position.y - this.radius,
                    this.radius * 2,
                    this.radius * 2
                );
                ctx.restore();
            } else {
                this.applyStyle(ctx);
            }
        } else {
            this.applyStyle(ctx);
        }

        // Standard outline
        ctx.strokeStyle = this.team ? (this.team === 'red' ? '#ef4444' : '#3b82f6') : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = this.team ? 6 / camera.scale : 2 / camera.scale;
        ctx.stroke();

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

        // Shield effect
        if ((this as any).hasShield) {
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius * 1.2, 0, Math.PI * 2);
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 4 / camera.scale;
            ctx.setLineDash([10, 5]);
            ctx.lineDashOffset = (Date.now() / 50) % 15;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    private applyStyle(ctx: CanvasRenderingContext2D) {
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
        } else if (this.skin === 'ghost') {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 0.5;
        } else {
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        }
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
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
        const rotation = (Date.now() / 2000) % (Math.PI * 2);

        for (let i = 0; i < spikes * 2; i++) {
            const angle = rotation + (i * Math.PI) / spikes;
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const x = this.position.x + Math.cos(angle) * r;
            const y = this.position.y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.closePath();

        // Semi-transparent fill with glow
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();

        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 3 / _camera.scale;
        ctx.stroke();

        // Inner detail circle
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, innerRadius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();

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

export class BouncePad extends Entity {
    constructor(id: string, x: number, y: number, radius: number = 60) {
        super({
            id,
            position: { x, y },
            velocity: { x: 0, y: 0 },
            mass: 500,
            radius,
            color: '#14f195',
            type: 'bouncepad'
        });
    }

    draw(ctx: CanvasRenderingContext2D, _camera: any) {
        ctx.save();
        const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;

        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Icon
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↑', this.position.x, this.position.y);

        ctx.restore();
    }
}

export class EffectZone extends Entity {
    effectType: 'slow' | 'fast';
    width: number;
    height: number;

    constructor(id: string, x: number, y: number, width: number, height: number, effectType: 'slow' | 'fast') {
        super({
            id,
            position: { x, y },
            velocity: { x: 0, y: 0 },
            mass: 0,
            radius: Math.max(width, height) / 2,
            color: effectType === 'slow' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            type: 'zone'
        });
        this.effectType = effectType;
        this.width = width;
        this.height = height;
    }

    draw(ctx: CanvasRenderingContext2D, _camera: any) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x - this.width / 2, this.position.y - this.height / 2, this.width, this.height);

        ctx.strokeStyle = this.effectType === 'slow' ? '#ef4444' : '#10b981';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(this.position.x - this.width / 2, this.position.y - this.height / 2, this.width, this.height);
        ctx.setLineDash([]);
        ctx.restore();
    }
}
