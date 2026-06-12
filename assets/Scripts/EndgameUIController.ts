import {
    _decorator, Component, Node, Button, Sprite, SpriteFrame,
    Color, Vec3, tween, Tween, UIOpacity, find,
    UITransform,
    Size
} from 'cc';
import { AudioManager } from './AudioManager';

const { ccclass, property } = _decorator;

@ccclass('EndgameUIController')
export class EndgameUIController extends Component {

    @property(Node)
    winPanel: Node | null = null;

    @property(Node)
    timeOutPanel: Node | null = null;

    @property(Node)
    wellDone: Node | null = null;

    @property(Node)
    btnReplayWin: Node | null = null;

    @property(Node)
    btnReplayTimeout: Node | null = null;

    @property(Node)
    fireworksRoot: Node | null = null;

    @property([SpriteFrame])
    fireworkFrames: SpriteFrame[] = [];

    @property
    panelInDuration: number = 0.35;

    @property
    panelInScaleFrom: number = 0.72;

    private readonly FIREWORK_COLORS = [
        new Color(255, 80, 80, 255),
        new Color(255, 200, 50, 255),
        new Color(80, 200, 255, 255),
        new Color(120, 255, 120, 255),
        new Color(255, 120, 255, 255),
        new Color(255, 165, 50, 255),
    ];

    private hasAnimatedWellDone: boolean = false;

    start() {
        if (this.winPanel) this.winPanel.active = false;
        if (this.timeOutPanel) this.timeOutPanel.active = false;
        this.bindButtons();
    }

    onDestroy() {
        this.btnReplayWin?.off(Node.EventType.TOUCH_END, this.onReplay, this);
        this.btnReplayTimeout?.off(Node.EventType.TOUCH_END, this.onReplay, this);
        this.stopFireworks();
    }

    // ====================================================
    // PUBLIC
    // ====================================================
    public showWinPanel() {
        if (!this.winPanel) return;
        this.hasAnimatedWellDone = false;
        if (this.btnReplayWin) this.btnReplayWin.active = false;

        this.timeOutPanel && (this.timeOutPanel.active = false);
        this.winPanel.active = true;

        if (this.winPanel.parent) {
            this.winPanel.setSiblingIndex(this.winPanel.parent.children.length - 1);
        }

        this.playPanelIn(this.winPanel, () => {
            this.animateWellDone();
            this.startFireworks();
        });
    }

    public showLosePanel() {
        if (!this.timeOutPanel) return;
        this.stopFireworks();

        this.winPanel && (this.winPanel.active = false);
        this.timeOutPanel.active = true;
        this.playPanelIn(this.timeOutPanel);
    }

    // ====================================================
    // PANEL IN ANIMATION
    // ====================================================
    private playPanelIn(panel: Node, onComplete?: () => void) {
        const dur = Math.max(0.01, this.panelInDuration);
        const from = this.panelInScaleFrom;

        Tween.stopAllByTarget(panel);
        let opacity = panel.getComponent(UIOpacity) ?? panel.addComponent(UIOpacity);
        opacity.opacity = 0;
        panel.setScale(new Vec3(from, from, from));

        tween(panel)
            .parallel(
                tween().to(dur, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }),
                tween(opacity).to(dur * 0.6, { opacity: 255 }, { easing: 'quadOut' }),
            )
            .call(() => { if (onComplete) onComplete(); })
            .start();
    }

    // ====================================================
    // WELLDONE SPINE
    // ====================================================
   private animateWellDone() {
    if (!this.wellDone || this.hasAnimatedWellDone) return;
    this.hasAnimatedWellDone = true;

    const op = this.wellDone.getComponent(UIOpacity) ?? this.wellDone.addComponent(UIOpacity);
    op.opacity = 0;

    const spine = this.wellDone.getComponent('sp.Skeleton') as any;
    if (spine) {
        try {
            spine.clearTracks();
            spine.setAnimation(0, 'appear', false);
            spine.addAnimation(0, 'appear', true, 1.5);
        } catch (e) {
            console.warn('[EndgameUIController] Spine error:', e);
        }
    }

    this.scheduleOnce(() => { op.opacity = 255; }, 0.15);

    // Hiện nút replay sau khi animation appear xong
    this.scheduleOnce(() => {
        if (this.btnReplayWin) {
            this.btnReplayWin.active = true;
            const btnOp = this.btnReplayWin.getComponent(UIOpacity)
                ?? this.btnReplayWin.addComponent(UIOpacity);
            btnOp.opacity = 0;
            tween(btnOp).to(0.3, { opacity: 255 }).start();
        }
    }, 1.5);
}

    // ====================================================
    // PHÁO HOA
    // ====================================================
    private startFireworks() {
        console.log('[Firework] fireworksRoot:', this.fireworksRoot?.name);
        console.log('[Firework] fireworkFrames.length:', this.fireworkFrames.length);

        if (!this.fireworksRoot || this.fireworkFrames.length === 0) {
            console.warn('[Firework] RETURN SỚM — thiếu root hoặc frames');
            return;
        }

        console.log('[Firework] Bắt đầu bắn pháo hoa');

        for (let i = 0; i < 8; i++) {
            this.scheduleOnce(() => this.spawnFirework(), i * 0.08);
        }

        let count = 0;
        const maxBurst = 15;
        this.schedule(function (this: EndgameUIController) {
            const burst = 3 + Math.floor(Math.random() * 2);
            for (let i = 0; i < burst; i++) {
                this.scheduleOnce(() => this.spawnFirework(), i * 0.04);
            }
            count++;
            if (count >= maxBurst) this.unscheduleAllCallbacks();
        }, 0.15, maxBurst - 1);
    }

    private spawnFirework() {
        if (!this.fireworksRoot || this.fireworkFrames.length === 0) return;

        const fw = new Node('Firework');
        fw.layer = this.fireworksRoot.layer;

        const sp = fw.addComponent(Sprite);
        const op = fw.addComponent(UIOpacity);
        const ut = fw.addComponent(UITransform);
        ut.setContentSize(40, 40);  // ← kích thước thực tế, chỉnh số này

        sp.spriteFrame = this.fireworkFrames[Math.floor(Math.random() * this.fireworkFrames.length)];
        sp.color = this.FIREWORK_COLORS[Math.floor(Math.random() * this.FIREWORK_COLORS.length)];

        const rx = (Math.random() - 0.5) * 800;
        const startY = -600;
        const endY = 100 + Math.random() * 400;
        const endX = rx + (Math.random() - 0.5) * 200;

        fw.setPosition(new Vec3(rx, startY, 0));
        fw.setScale(new Vec3(1, 1, 1));  // scale giữ = 1, không dùng scale to nhỏ nữa
        op.opacity = 255;
        this.fireworksRoot.addChild(fw);

        // Hiệu ứng bay lên + nổ tung bằng UITransform size
        tween(ut)
            .to(0.6, { contentSize: new Size(60, 60) }, { easing: 'sineOut' })
            .to(0.15, { contentSize: new Size(90, 90) }, { easing: 'sineOut' })
            .to(0.10, { contentSize: new Size(50, 50) })
            .start();

        tween(fw)
            .to(0.6, { position: new Vec3(endX, endY, 0) }, { easing: 'sineOut' })
            .start();

        tween(op)
            .delay(0.6)
            .to(0.4, { opacity: 0 })
            .call(() => { if (fw.isValid) fw.destroy(); })
            .start();
    }

    private stopFireworks() {
        this.unscheduleAllCallbacks();
        if (this.fireworksRoot) {
            for (const child of [...this.fireworksRoot.children]) {
                Tween.stopAllByTarget(child);
                if (child.isValid) child.destroy();
            }
        }
    }

    // ====================================================
    // REPLAY
    // ====================================================
    private bindButtons() {
        this.btnReplayWin?.on(Node.EventType.TOUCH_END, this.onReplay, this);
        this.btnReplayTimeout?.on(Node.EventType.TOUCH_END, this.onReplay, this);
    }

    private onReplay() {
        this.stopFireworks();
        this.hasAnimatedWellDone = false;

        if (this.wellDone) {
            const spine = this.wellDone.getComponent('sp.Skeleton') as any;
            if (spine) { try { spine.clearTracks(); } catch { } }
            const op = this.wellDone.getComponent(UIOpacity);
            if (op) op.opacity = 0;
        }

        if (this.winPanel) this.winPanel.active = false;
        if (this.timeOutPanel) this.timeOutPanel.active = false;

        const canvas = find('Canvas') ?? find('block/Canvas');
        const gc = canvas?.getComponent('GameController') as any;
        if (gc && typeof gc.restartLevel === 'function') {
            gc.restartLevel(true, true);
        } else {
            console.warn('[EndgameUIController] Không tìm thấy GameController');
        }
    }
}