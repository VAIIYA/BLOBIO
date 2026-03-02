import { Entity } from './Entities';

export class Rectangle {
    constructor(
        public x: number,
        public y: number,
        public w: number,
        public h: number
    ) { }

    contains(entity: Entity): boolean {
        return (
            entity.position.x >= this.x - this.w &&
            entity.position.x <= this.x + this.w &&
            entity.position.y >= this.y - this.h &&
            entity.position.y <= this.y + this.h
        );
    }

    intersects(range: Rectangle): boolean {
        return !(
            range.x - range.w > this.x + this.w ||
            range.x + range.w < this.x - this.w ||
            range.y - range.h > this.y + this.h ||
            range.y + range.h < this.y - this.h
        );
    }
}

/**
 * QuadTree spatial partitioning system.
 * Optimizes collision detection by reducing the search space from O(N^2) to O(N log N).
 */
export class QuadTree {
    private entities: Entity[] = [];
    private divided: boolean = false;
    private northwest?: QuadTree;
    private northeast?: QuadTree;
    private southwest?: QuadTree;
    private southeast?: QuadTree;

    constructor(
        public boundary: Rectangle,
        private capacity: number = 4
    ) { }

    private subdivide() {
        const { x, y, w, h } = this.boundary;
        const nw = new Rectangle(x - w / 2, y - h / 2, w / 2, h / 2);
        const ne = new Rectangle(x + w / 2, y - h / 2, w / 2, h / 2);
        const sw = new Rectangle(x - w / 2, y + h / 2, w / 2, h / 2);
        const se = new Rectangle(x + w / 2, y + h / 2, w / 2, h / 2);

        this.northwest = new QuadTree(nw, this.capacity);
        this.northeast = new QuadTree(ne, this.capacity);
        this.southwest = new QuadTree(sw, this.capacity);
        this.southeast = new QuadTree(se, this.capacity);

        this.divided = true;
    }

    insert(entity: Entity): boolean {
        if (!this.boundary.contains(entity)) {
            return false;
        }

        if (this.entities.length < this.capacity) {
            this.entities.push(entity);
            return true;
        }

        if (!this.divided) {
            this.subdivide();
        }

        return (
            this.northwest!.insert(entity) ||
            this.northeast!.insert(entity) ||
            this.southwest!.insert(entity) ||
            this.southeast!.insert(entity)
        );
    }

    query(range: Rectangle, found: Entity[] = []): Entity[] {
        if (!this.boundary.intersects(range)) {
            return found;
        }

        for (const e of this.entities) {
            if (range.contains(e)) {
                found.push(e);
            }
        }

        if (this.divided) {
            this.northwest!.query(range, found);
            this.northeast!.query(range, found);
            this.southwest!.query(range, found);
            this.southeast!.query(range, found);
        }

        return found;
    }

    clear() {
        this.entities = [];
        this.divided = false;
        this.northwest = undefined;
        this.northeast = undefined;
        this.southwest = undefined;
        this.southeast = undefined;
    }
}
