import {
    _decorator, Camera, Color, Component, Graphics, Node,
    UIOpacity, UITransform, Vec3, tween, Tween, view, find
} from 'cc';

const { ccclass, property } = _decorator;

interface Star2D {
    node: Node;
    graphics: Graphics;
    opacity: UIOpacity;
    baseOpacity: number;
    phase: number;        // offset nhịp lấp lánh
    speed: number;        // tốc độ di chuyển
    vx: number;
    vy: number;
    size: number;
    twinkleSpeed: number;
    elapsed: number;
    lifespan: number;
}

@ccclass('BackgroundStars2D')
export class BackgroundStars2D extends Component {

    @property
    starCount: number = 60;

    @property
    minSize: number = 2;

    @property
    maxSize: number = 5;

    @property
    minSpeed: number = 8;       // px/s

    @property
    maxSpeed: number = 22;

    @property
    minOpacity: number = 60;

    @property
    maxOpacity: number = 200;

    @property
    twinkleMinSpeed: number = 0.8;  // chu kỳ/s

    @property
    twinkleMaxSpeed: number = 2.2;

    @property
    minLifespan: number = 3;    // giây

    @property
    maxLifespan: number = 8;

    // Màu sao — có thể đổi theo theme game
    @property(Color)
    colorA: Color = new Color(255, 240, 160, 255);  // vàng ấm

    @property(Color)
    colorB: Color = new Color(180, 210, 255, 255);  // xanh lạnh

    @property(Color)
    colorC: Color = new Color(255, 190, 230, 255);  // hồng nhạt

    private stars: Star2D[] = [];
    private screenW = 0;
    private screenH = 0;

    start() {
        const vs = view.getVisibleSize();
        this.screenW = vs.width;
        this.screenH = vs.height;

        // Đảm bảo node phủ toàn màn hình
        const t = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        t.setContentSize(this.screenW, this.screenH);

        for (let i = 0; i < this.starCount; i++) {
            this.spawnStar(true);
        }
    }

    update(dt: number) {
        const toRemove: Star2D[] = [];

        for (const star of this.stars) {
            star.elapsed += dt;

            // Di chuyển
            const pos = star.node.position;
            star.node.setPosition(
                pos.x + star.vx * dt,
                pos.y + star.vy * dt,
                0
            );

            // Lấp lánh — sin wave
            const twinkle = Math.sin(star.elapsed * star.twinkleSpeed * Math.PI * 2 + star.phase);
            const opacityRange = star.baseOpacity * 0.55;
            star.opacity.opacity = Math.max(0, Math.min(255,
                Math.round(star.baseOpacity + twinkle * opacityRange)
            ));

            // Scale nhẹ theo nhịp lấp lánh
            const s = star.size * (0.85 + (twinkle + 1) * 0.15 * 0.5);
            star.node.setScale(s, s, s);

            // Fade in/out ở đầu và cuối lifespan
            if (star.elapsed < 0.6) {
                star.opacity.opacity = Math.round(star.opacity.opacity * (star.elapsed / 0.6));
            } else if (star.elapsed > star.lifespan - 0.8) {
                const fadeRatio = (star.lifespan - star.elapsed) / 0.8;
                star.opacity.opacity = Math.round(star.opacity.opacity * Math.max(0, fadeRatio));
            }

            // Hết tuổi thọ hoặc ra ngoài màn hình
            if (star.elapsed >= star.lifespan || this.isOutOfBounds(star)) {
                toRemove.push(star);
            }
        }

        for (const star of toRemove) {
            this.removeStar(star);
            this.spawnStar(false);
        }
    }

    private spawnStar(randomizePosition: boolean) {
        const starNode = new Node('__BgStar2D');
        starNode.setParent(this.node);
        starNode.setSiblingIndex(0);
        starNode.layer = this.node.layer;

        const transform = starNode.addComponent(UITransform);
        transform.setContentSize(1, 1);

        const graphics = starNode.addComponent(Graphics);
        const opacity = starNode.addComponent(UIOpacity);

        const size = this.minSize + Math.random() * (this.maxSize - this.minSize);
        const baseOpacity = this.minOpacity + Math.random() * (this.maxOpacity - this.minOpacity);
        const speed = this.minSpeed + Math.random() * (this.maxSpeed - this.minSpeed);
        const angle = Math.random() * Math.PI * 2;
        const twinkleSpeed = this.twinkleMinSpeed + Math.random() * (this.twinkleMaxSpeed - this.twinkleMinSpeed);
        const lifespan = this.minLifespan + Math.random() * (this.maxLifespan - this.minLifespan);
        const color = this.pickColor();

        // Vẽ ngôi sao nhỏ (4 cánh hoặc 2 cánh chéo)
        this.drawStar(graphics, size, color);

        opacity.opacity = 0;

        const hw = this.screenW * 0.5;
        const hh = this.screenH * 0.5;

        let startX: number, startY: number;
        if (randomizePosition) {
            // Rải đều ngay từ đầu
            startX = (Math.random() - 0.5) * this.screenW;
            startY = (Math.random() - 0.5) * this.screenH;
        } else {
            // Spawn từ rìa màn hình
            const edge = Math.floor(Math.random() * 4);
            switch (edge) {
                case 0: startX = (Math.random() - 0.5) * this.screenW; startY = -hh - 10; break;
                case 1: startX = (Math.random() - 0.5) * this.screenW; startY = hh + 10; break;
                case 2: startX = -hw - 10; startY = (Math.random() - 0.5) * this.screenH; break;
                default: startX = hw + 10; startY = (Math.random() - 0.5) * this.screenH;
            }
        }

        starNode.setPosition(startX, startY, 0);
        starNode.setScale(size, size, size);

        const star: Star2D = {
            node: starNode,
            graphics,
            opacity,
            baseOpacity,
            phase: Math.random() * Math.PI * 2,
            speed,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size,
            twinkleSpeed,
            elapsed: randomizePosition ? Math.random() * lifespan * 0.7 : 0,
            lifespan,
        };

        this.stars.push(star);
    }

    private drawStar(g: Graphics, size: number, color: Color) {
        g.clear();
        // Ngôi sao 4 cánh (dạng thoi chéo nhau)
        const outer = 6;
        const inner = 1.8;

        g.fillColor = new Color(color.r, color.g, color.b, 220);

        for (let rot = 0; rot < 2; rot++) {
            const offset = rot * (Math.PI / 4);
            for (let i = 0; i < 4; i++) {
                const a = offset + (Math.PI * 2 * i) / 4;
                const r = i % 2 === 0 ? outer : inner;
                const x = Math.cos(a) * r;
                const y = Math.sin(a) * r;
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.close();
            g.fill();
        }

        // Điểm sáng trung tâm
        g.fillColor = new Color(255, 255, 255, 200);
        g.circle(0, 0, 1.2);
        g.fill();
    }

    private pickColor(): Color {
        const colors = [this.colorA, this.colorB, this.colorC];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private isOutOfBounds(star: Star2D): boolean {
        const p = star.node.position;
        const pad = 20;
        const hw = this.screenW * 0.5 + pad;
        const hh = this.screenH * 0.5 + pad;
        return p.x < -hw || p.x > hw || p.y < -hh || p.y > hh;
    }

    private removeStar(star: Star2D) {
        const idx = this.stars.indexOf(star);
        if (idx !== -1) this.stars.splice(idx, 1);
        if (star.node.isValid) star.node.destroy();
    }

    onDestroy() {
        for (const star of this.stars) {
            if (star.node.isValid) star.node.destroy();
        }
        this.stars = [];
    }
}