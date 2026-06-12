import {
    _decorator, Canvas, Color, Component, find, Graphics,
    Material, MeshRenderer, Node, primitives, UITransform,
    utils, Vec3, view, Camera, Mat4
} from 'cc';

const { ccclass, property } = _decorator;

interface Star3D {
    node: Node;
    phase: number;
    twinkleSpeed: number;
    baseScaleY: number;
    vx: number;
    vz: number;
    elapsed: number;
    lifespan: number;
    material: Material;
    baseColor: Color;
}

@ccclass('BackgroundStars3D')
export class BackgroundStars3D extends Component {

    @property
    starCount: number = 40;

    @property
    spawnRadius: number = 4.5;

    @property
    minScale: number = 0.04;

    @property
    maxScale: number = 0.10;

    @property
    minSpeed: number = 0.05;

    @property
    maxSpeed: number = 0.18;

    @property
    twinkleMinSpeed: number = 0.7;

    @property
    twinkleMaxSpeed: number = 2.5;

    @property
    starY: number = 0.02;

    @property
    minLifespan: number = 4;

    @property
    maxLifespan: number = 10;

    @property(Color)
    colorA: Color = new Color(255, 240, 140, 255);

    @property(Color)
    colorB: Color = new Color(160, 200, 255, 255);

    @property(Color)
    colorC: Color = new Color(255, 180, 220, 255);

    // Dùng để skip vẽ sao đè lên board (giống logic cũ trong GameController)
    @property(Camera)
    mainCamera: Camera | null = null;

    @property(Node)
    boardPreviewNode: Node | null = null;

    private stars: Star3D[] = [];
    private starMesh: any = null;

    // Cho blocked polygon
    private uiCanvas: Canvas | null = null;
    private starGraphics: Graphics | null = null;
    private starBackgroundTransform: UITransform | null = null;
    private boardStarPadding = 18;

    start() {
        this.starMesh = utils.createMesh(primitives.box({
            width: 1, height: 0.15, length: 1,
        }));

        for (let i = 0; i < this.starCount; i++) {
            this.spawnStar(true);
        }

        this.initStarGraphics();
    }

    update(dt: number) {
        const toRemove: Star3D[] = [];

        for (const star of this.stars) {
            star.elapsed += dt;

            // Di chuyển
            const pos = star.node.position;
            star.node.setPosition(
                pos.x + star.vx * dt,
                this.starY,
                pos.z + star.vz * dt,
            );

            // Lấp lánh scale Y
            const twinkle = Math.sin(
                star.elapsed * star.twinkleSpeed * Math.PI * 2 + star.phase,
            );
            const scaleY = star.baseScaleY * (0.7 + (twinkle + 1) * 0.25);
            const curScale = star.node.scale;
            star.node.setScale(curScale.x, scaleY, curScale.z);

            // Alpha fade in/out + twinkle
            const alpha = Math.max(0, Math.min(1, 0.4 + (twinkle + 1) * 0.3));
            let fade = 1;
            if (star.elapsed < 0.8) {
                fade = star.elapsed / 0.8;
            } else if (star.elapsed > star.lifespan - 1) {
                fade = star.lifespan - star.elapsed;
            }
            const finalAlpha = Math.max(0, alpha * fade);
            const c = star.baseColor;
            try {
                star.material.setProperty('mainColor', new Color(
                    c.r, c.g, c.b, Math.round(finalAlpha * 255),
                ));
            } catch { }

            // Xoay nhẹ
            const euler = star.node.eulerAngles;
            star.node.setRotationFromEuler(
                euler.x,
                euler.y + 45 * dt * (star.twinkleSpeed * 0.3),
                euler.z,
            );

            if (star.elapsed >= star.lifespan || this.isOutOfBounds(star)) {
                toRemove.push(star);
            }
        }

        for (const star of toRemove) {
            this.removeStar(star);
            this.spawnStar(false);
        }
    }

    private initStarGraphics() {
        const canvas = find('Canvas') ?? find('block/Canvas');
        if (!canvas) return;

        this.uiCanvas = canvas.getComponent(Canvas);

        let bgNode = canvas.getChildByName('StarBackgroundOverlay');
        if (!bgNode) {
            bgNode = new Node('StarBackgroundOverlay');
            bgNode.layer = canvas.layer;
            bgNode.setParent(canvas);
            bgNode.setSiblingIndex(1);
        }

        let uiTransform = bgNode.getComponent(UITransform);
        if (!uiTransform) uiTransform = bgNode.addComponent(UITransform);
        const winSize = view.getVisibleSize();
        uiTransform.setContentSize(winSize.width, winSize.height);
        this.starBackgroundTransform = uiTransform;

        let graphics = bgNode.getComponent(Graphics);
        if (!graphics) graphics = bgNode.addComponent(Graphics);
        this.starGraphics = graphics;
    }

    private spawnStar(randomizePos: boolean) {
        const starNode = new Node('__BgStar3D');
        starNode.setParent(this.node);

        const mat = new Material();
        mat.initialize({ effectName: 'builtin-unlit' });
        const color = this.pickColor();
        try { mat.setProperty('mainColor', color); } catch { }

        const renderer = starNode.addComponent(MeshRenderer);
        renderer.mesh = this.starMesh;
        renderer.material = mat;

        const scale = this.minScale + Math.random() * (this.maxScale - this.minScale);
        const scaleY = scale * (0.3 + Math.random() * 0.4);
        starNode.setScale(scale, scaleY, scale);

        const speed = this.minSpeed + Math.random() * (this.maxSpeed - this.minSpeed);
        const angle = Math.random() * Math.PI * 2;
        const lifespan = this.minLifespan + Math.random() * (this.maxLifespan - this.minLifespan);

        let startX: number, startZ: number;
        if (randomizePos) {
            const r = Math.random() * this.spawnRadius;
            const a = Math.random() * Math.PI * 2;
            startX = Math.cos(a) * r;
            startZ = Math.sin(a) * r;
        } else {
            const a = Math.random() * Math.PI * 2;
            startX = Math.cos(a) * (this.spawnRadius + 0.5);
            startZ = Math.sin(a) * (this.spawnRadius + 0.5);
        }

        starNode.setPosition(startX, this.starY, startZ);
        starNode.setRotationFromEuler(0, Math.random() * 360, 0);

        this.stars.push({
            node: starNode,
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: this.twinkleMinSpeed + Math.random() * (this.twinkleMaxSpeed - this.twinkleMinSpeed),
            baseScaleY: scaleY,
            vx: Math.cos(angle) * speed,
            vz: Math.sin(angle) * speed,
            elapsed: randomizePos ? Math.random() * lifespan * 0.6 : 0,
            lifespan,
            material: mat,
            baseColor: color,
        });
    }

    private pickColor(): Color {
        const colors = [this.colorA, this.colorB, this.colorC];
        return colors[Math.floor(Math.random() * colors.length)].clone();
    }

    private isOutOfBounds(star: Star3D): boolean {
        const p = star.node.position;
        return Math.sqrt(p.x * p.x + p.z * p.z) > this.spawnRadius + 1;
    }

    private removeStar(star: Star3D) {
        const idx = this.stars.indexOf(star);
        if (idx !== -1) this.stars.splice(idx, 1);
        if (star.node?.isValid) star.node.destroy();
    }

    onDestroy() {
        for (const star of this.stars) {
            if (star.node?.isValid) star.node.destroy();
        }
        this.stars = [];
    }
}