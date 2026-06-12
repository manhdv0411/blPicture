import {
    _decorator, Camera, Color, Component, EventMouse, EventTouch,
    Graphics, input, Input, Node, UIOpacity, UITransform,
    Vec2, Vec3, tween, Tween, find
} from 'cc';

const { ccclass, property } = _decorator;

type SparkleType = 'star' | 'bubble' | 'spot' | 'flare';

@ccclass('ClickStarEffect')
export class ClickStarEffect extends Component {

    @property(Camera)
    uiCamera: Camera | null = null;

    @property
    sparkleCoundPerClick: number = 10;

    @property
    enableOnDrag: boolean = false;

    private sparklePool: Node[] = [];

    onEnable() {
        input.on(Input.EventType.TOUCH_START, this.onTouch, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouse, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onTouch, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouse, this);
    }

    private onTouch(e: EventTouch) {
        this.spawnAt(e.getLocation());
    }

    private onMouse(e: EventMouse) {
        this.spawnAt(e.getLocation());
    }

    private spawnAt(screenPos: Vec2) {
        const cam = this.uiCamera || this.resolveUiCamera();
        if (!cam) return;

        // Chuyển screen → UI local
        const worldPos = new Vec3();
        cam.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0), worldPos);

        const localPos = new Vec3();
        this.node.inverseTransformPoint(localPos, worldPos);

        // Tạo node tạm làm nguồn phát
        const source = new Node('__ClickSource');
        source.setParent(this.node);
        source.setPosition(localPos);
        source.layer = this.node.layer;

        const count = Math.max(1, this.sparkleCoundPerClick);
        for (let i = 0; i < count; i++) {
            const rand = Math.random();
            const type: SparkleType = rand < 0.25 ? 'flare'
                : rand < 0.55 ? 'star'
                : rand < 0.80 ? 'spot' : 'bubble';
            this.spawnUiSparkleAt(source, true, type);
        }

        source.destroy(); // source chỉ dùng để lấy vị trí
    }

    // ---------- Sparkle core (copy từ DragControl) ----------

    private getSparkleNode(): Node {
        let node = this.sparklePool.pop();
        if (node?.isValid) {
            node.active = true;
            return node;
        }
        node = new Node('__ClickSparkle');
        node.addComponent(UITransform);
        node.addComponent(Graphics);
        node.addComponent(UIOpacity);
        return node;
    }

    private returnSparkleNode(node: Node) {
        if (node.isValid) {
            node.active = false;
            node.setParent(null);
            node.getComponent(Graphics)?.clear();
            this.sparklePool.push(node);
        }
    }

    private spawnUiSparkleAt(
        sourceNode: Node,
        burst: boolean,
        type: SparkleType = 'star',
        tint?: Color
    ) {
        const parent = sourceNode.parent;
        if (!parent) return;

        const sparkle = this.getSparkleNode();
        sparkle.layer = sourceNode.layer;
        sparkle.setParent(parent);
        sparkle.setSiblingIndex(parent.children.length - 1);

        const transform = sparkle.getComponent(UITransform)!;
        const baseSize = type === 'flare' ? 52 + Math.random() * 28
            : type === 'bubble' ? 10 + Math.random() * 14
            : type === 'spot' ? 4 + Math.random() * 7
            : 7 + Math.random() * 8;
        transform.setContentSize(baseSize, baseSize);

        const graphics = sparkle.getComponent(Graphics)!;
        graphics.clear();
        this.drawSparkle(graphics, baseSize, burst, type, tint);

        const opacity = sparkle.getComponent(UIOpacity)!;
        opacity.opacity = type === 'flare' ? 245
            : type === 'bubble' ? 170
            : type === 'spot' ? 235 : 255;

        const srcPos = sourceNode.position.clone();
        const scatter = type === 'flare' ? 22 : 45;
        srcPos.x += (Math.random() - 0.5) * scatter;
        srcPos.y += (Math.random() - 0.5) * scatter;
        sparkle.setPosition(srcPos);
        sparkle.angle = type === 'flare' ? 0 : Math.random() * 360;

        const angle = Math.random() * Math.PI * 2;
        const distance = type === 'flare' ? 18 + Math.random() * 28
            : type === 'bubble' ? 42 + Math.random() * 55
            : 62 + Math.random() * 65;
        const floatY = type === 'bubble' ? 24 + Math.random() * 36 : 0;
        const endPos = new Vec3(
            srcPos.x + Math.cos(angle) * distance,
            srcPos.y + Math.sin(angle) * distance + floatY,
            srcPos.z
        );

        const startScale = type === 'flare' ? 0.08 : 0.35 + Math.random() * 0.35;
        const endScale = type === 'flare' ? 1.28
            : type === 'bubble' ? 1.1 + Math.random() * 0.35
            : 1.05 + Math.random() * 0.45;
        const duration = type === 'flare' ? 0.22
            : type === 'bubble' ? 0.7 + Math.random() * 0.3
            : 0.45 + Math.random() * 0.2;

        sparkle.setScale(new Vec3(startScale, startScale, startScale));

        tween(sparkle)
            .parallel(
                type === 'flare'
                    ? tween().to(duration, { position: endPos }, { easing: 'quadOut' })
                    : tween().to(duration, {
                        position: endPos,
                        angle: sparkle.angle + 160 + Math.random() * 200
                    }, { easing: 'quadOut' }),
                tween().to(duration, {
                    scale: new Vec3(endScale, endScale, endScale)
                }, { easing: type === 'flare' ? 'sineOut' : 'backOut' }),
                type === 'flare'
                    ? tween(opacity)
                        .to(duration * 0.28, { opacity: 235 }, { easing: 'sineOut' })
                        .to(duration * 0.72, { opacity: 0 }, { easing: 'sineIn' })
                    : tween(opacity).to(duration, { opacity: 0 }, { easing: 'quadIn' }),
            )
            .call(() => this.returnSparkleNode(sparkle))
            .start();
    }

    private drawSparkle(
        g: Graphics, size: number, burst: boolean,
        type: SparkleType, tint?: Color
    ) {
        g.clear();
        const base = tint || new Color(255, 220, 80, 255);
        const light = this.mixColor(base, new Color(255, 255, 255, 255), 0.6, 255);

        if (type === 'flare') {
            // Hào quang trung tâm
            g.fillColor = new Color(base.r, base.g, base.b, 55);
            g.circle(0, 0, size * 0.5); g.fill();
            // Tia sáng
            const rays = 10;
            for (let i = 0; i < rays; i++) {
                const a = (Math.PI * 2 * i) / rays;
                const r = size * (0.28 + Math.sin(i * 7.1) * 0.12 + 0.06);
                const side = size * 0.018;
                g.fillColor = new Color(255, 210, 60, burst ? 145 : 110);
                g.moveTo(Math.cos(a + Math.PI * 0.5) * side, Math.sin(a + Math.PI * 0.5) * side);
                g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                g.lineTo(Math.cos(a - Math.PI * 0.5) * side, Math.sin(a - Math.PI * 0.5) * side);
                g.close(); g.fill();
            }
            // Lõi sáng
            g.fillColor = new Color(255, 252, 200, burst ? 230 : 190);
            g.circle(0, 0, size * 0.15); g.fill();
            g.fillColor = new Color(255, 255, 255, burst ? 230 : 195);
            g.circle(0, 0, size * 0.07); g.fill();
        } else if (type === 'star') {
            const outer = size * 0.5, inner = size * 0.18;
            g.fillColor = new Color(light.r, light.g, light.b, burst ? 245 : 200);
            for (let i = 0; i <= 16; i++) {
                const r = i % 2 === 0 ? outer : inner;
                const a = -Math.PI * 0.5 + (Math.PI * i) / 8;
                i === 0 ? g.moveTo(Math.cos(a) * r, Math.sin(a) * r)
                    : g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            g.close(); g.fill();
            g.fillColor = new Color(255, 255, 255, burst ? 240 : 180);
            g.circle(0, 0, size * 0.14); g.fill();
        } else if (type === 'bubble') {
            const bc = this.getBubbleColor();
            g.fillColor = new Color(bc.r, bc.g, bc.b, 22); g.circle(0, 0, size * 0.48); g.fill();
            g.strokeColor = new Color(bc.r, bc.g, bc.b, 135);
            g.lineWidth = size * 0.09; g.circle(0, 0, size * 0.45); g.stroke();
            g.fillColor = new Color(255, 255, 255, 150);
            g.circle(size * 0.17, size * 0.18, size * 0.08); g.fill();
        } else { // spot
            g.fillColor = new Color(base.r, base.g, base.b, 90);
            g.circle(0, 0, size * 0.7); g.fill();
            g.fillColor = this.mixColor(base, new Color(255, 255, 255, 255), 0.55, 210);
            g.circle(0, 0, size * 0.36); g.fill();
            g.fillColor = new Color(255, 255, 255, 230);
            g.circle(0, 0, size * 0.14); g.fill();
        }
    }

    private mixColor(a: Color, b: Color, t: number, alpha = 255): Color {
        const c = Math.max(0, Math.min(1, t));
        return new Color(
            Math.round(a.r + (b.r - a.r) * c),
            Math.round(a.g + (b.g - a.g) * c),
            Math.round(a.b + (b.b - a.b) * c),
            alpha
        );
    }

    private getBubbleColor(): Color {
        const list = [
            new Color(112, 219, 255), new Color(255, 135, 188),
            new Color(255, 223, 112), new Color(163, 255, 135),
            new Color(188, 145, 255), new Color(120, 255, 224),
        ];
        return list[Math.floor(Math.random() * list.length)];
    }

    private resolveUiCamera(): Camera | null {
        return find('Canvas/Camera')?.getComponent(Camera)
            || find('block/Canvas/Camera')?.getComponent(Camera)
            || null;
    }
}