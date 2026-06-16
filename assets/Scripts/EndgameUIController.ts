import {
    _decorator, Component, Node, Sprite, SpriteFrame,
    Color, Vec3, tween, Tween, UIOpacity, find,
    UITransform, Size, input, Input, EventTouch, EventMouse,
    Vec2
} from 'cc';
import { AudioManager } from './AudioManager';
import { GameController } from './GameController';

const { ccclass, property } = _decorator;

@ccclass('EndgameUIController')
export class EndgameUIController extends Component {

    @property(Node)
    winPanel: Node | null = null;

    @property(Node)
    timeOutPanel: Node | null = null;

    @property(Node)
    wellDoneNode: Node | null = null;

    @property(Node)
    btnReplayWin: Node | null = null;

    @property(Node)
    btnReplayTimeout: Node | null = null;

    @property(Node)
    fireworksRoot: Node | null = null;

    @property(Node)
    btnReplayTopPanel: Node | null = null;

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
    private static endgameActive: boolean = false;

    start() {
        EndgameUIController.endgameActive = false;
        if (this.wellDoneNode) {
            const op = this.wellDoneNode.getComponent(UIOpacity) || this.wellDoneNode.addComponent(UIOpacity);
            op.opacity = 0;
        }
        if (this.winPanel) this.winPanel.active = false;
        if (this.timeOutPanel) this.timeOutPanel.active = false;
        this.bindButtons();
    }

    onDestroy() {
        this.btnReplayWin?.off(Node.EventType.TOUCH_END, this.onReplay, this);
        this.btnReplayTimeout?.off(Node.EventType.TOUCH_END, this.onReplay, this);
        this.releaseInputBlock();
        this.stopFireworks();
    }


    private acquireInputBlock() {
        if (EndgameUIController.endgameActive) return;
        EndgameUIController.endgameActive = true;

        this.getGameController()?.stopTimer();
        this.getGameController()?.dragController?.setInputLocked(true);

        input.on(Input.EventType.TOUCH_START, this.eatTouch, this);
        input.on(Input.EventType.TOUCH_MOVE, this.eatTouch, this);
        input.on(Input.EventType.TOUCH_END, this.eatTouch, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.eatTouch, this);
        input.on(Input.EventType.MOUSE_DOWN, this.eatMouse, this);
        input.on(Input.EventType.MOUSE_MOVE, this.eatMouse, this);
        input.on(Input.EventType.MOUSE_UP, this.eatMouse, this);
    }

    private releaseInputBlock() {
        if (!EndgameUIController.endgameActive) return;
        EndgameUIController.endgameActive = false;

        this.getGameController()?.dragController?.setInputLocked(false);

        input.off(Input.EventType.TOUCH_START, this.eatTouch, this);
        input.off(Input.EventType.TOUCH_MOVE, this.eatTouch, this);
        input.off(Input.EventType.TOUCH_END, this.eatTouch, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.eatTouch, this);
        input.off(Input.EventType.MOUSE_DOWN, this.eatMouse, this);
        input.off(Input.EventType.MOUSE_MOVE, this.eatMouse, this);
        input.off(Input.EventType.MOUSE_UP, this.eatMouse, this);
    }

    // Kiểm tra touch có trúng node không (dùng UITransform.getBoundingBoxToWorld)
    private isTouchOnNode(screenPos: Vec2, node: Node | null): boolean {
        if (!node || !node.isValid || !node.activeInHierarchy) return false;
        const transform = node.getComponent(UITransform);
        if (!transform) return false;
        // Cocos dùng toạ độ UI (gốc dưới trái), screenPos của EventTouch cũng vậy
        return transform.getBoundingBoxToWorld().contains(screenPos);
    }

    private eatTouch(event: EventTouch) {
        event.propagationStopped = true;
    }

    private eatMouse(event: EventMouse) {
        event.propagationStopped = true;
    }


    private getGameController(): GameController | null {
        const canvas = find('Canvas') ?? find('block/Canvas');
        if (!canvas) return null;
        return canvas.getComponent(GameController)
            ?? canvas.getComponentInChildren(GameController);
    }

    public showWinPanel() {
        if (!this.winPanel) return;
        if (AudioManager.instance) AudioManager.instance.playWin();
        this.hasAnimatedWellDone = false;

        this.acquireInputBlock();

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

        this.acquireInputBlock();

        this.winPanel && (this.winPanel.active = false);
        this.timeOutPanel.active = true;
        if (this.timeOutPanel.parent) {
            this.timeOutPanel.setSiblingIndex(this.timeOutPanel.parent.children.length - 1);
        }
        this.playPanelIn(this.timeOutPanel);
    }


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


    private animateWellDone() {
        if (!this.wellDoneNode || this.hasAnimatedWellDone) return;
        this.hasAnimatedWellDone = true;

        const wellDoneOpacity = this.wellDoneNode.getComponent(UIOpacity) || this.wellDoneNode.addComponent(UIOpacity);
        wellDoneOpacity.opacity = 0;

        const spine = this.wellDoneNode.getComponent('sp.Skeleton') as any;
        if (spine) {
            try {
                spine.clearTracks();
                spine.setAnimation(0, 'appear', false);
                spine.addAnimation(0, 'loop', true, 1.5);
            } catch (e) {
                console.warn('[WinScreen] Lỗi animation Spine WellDone:', e);
            }
        }

        this.scheduleOnce(() => { wellDoneOpacity.opacity = 255; }, 0.15);

        this.scheduleOnce(() => {
            if (this.btnReplayWin) {
                this.btnReplayWin.active = true;
                const op = this.btnReplayWin.getComponent(UIOpacity) || this.btnReplayWin.addComponent(UIOpacity);
                op.opacity = 0;
                tween(op).to(0.3, { opacity: 255 }).start();
            }
        }, 1.5);
    }


    private startFireworks() {
        if (!this.fireworksRoot || this.fireworkFrames.length === 0) {
            console.warn('[Firework] RETURN SỚM — thiếu root hoặc frames');
            return;
        }

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
        ut.setContentSize(40, 40);

        sp.spriteFrame = this.fireworkFrames[Math.floor(Math.random() * this.fireworkFrames.length)];
        sp.color = this.FIREWORK_COLORS[Math.floor(Math.random() * this.FIREWORK_COLORS.length)];

        const rx = (Math.random() - 0.5) * 800;
        const startY = -600;
        const endY = 100 + Math.random() * 400;
        const endX = rx + (Math.random() - 0.5) * 200;

        fw.setPosition(new Vec3(rx, startY, 0));
        fw.setScale(new Vec3(1, 1, 1));
        op.opacity = 255;
        this.fireworksRoot.addChild(fw);

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


    private bindButtons() {
        this.btnReplayWin?.on(Node.EventType.TOUCH_END, this.onReplay, this);
        this.btnReplayTimeout?.on(Node.EventType.TOUCH_END, this.onReplay, this);
    }

    private onReplay() {
        this.releaseInputBlock();
        this.stopFireworks();
        this.hasAnimatedWellDone = false;

        if (this.wellDoneNode) {
            const spine = this.wellDoneNode.getComponent('sp.Skeleton') as any;
            if (spine) { try { spine.clearTracks(); } catch { } }
            const op = this.wellDoneNode.getComponent(UIOpacity);
            if (op) op.opacity = 0;
        }

        if (this.winPanel) this.winPanel.active = false;
        if (this.timeOutPanel) this.timeOutPanel.active = false;

        const gc = this.getGameController();
        if (gc && typeof gc.restartLevel === 'function') {
            gc.restartLevel(true, true);
        } else {
            console.warn('[EndgameUIController] Không tìm thấy GameController');
        }
    }
}