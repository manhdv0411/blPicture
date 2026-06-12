import { _decorator, Button, Canvas, Color, Component, find, Label, Mat4, Node, tween, Tween, UITransform, UIOpacity, Vec3, Graphics, view } from 'cc';
import { BlockSpawn } from './BlockSpawn';
import { DragControl } from './DragControl';
import { BoardPreview } from './BoardPreview';
// import { GameData } from './GameData';
import { AudioManager } from './AudioManager';

const { ccclass, property } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    @property(BlockSpawn)
    levelSpawner: BlockSpawn | null = null;

    @property(DragControl)
    dragController: DragControl | null = null;

    @property(Button)
    restartButton: Button | null = null;

    @property(Label)
    timerLabel: Label | null = null;

    @property(Node)
    timerRootNode: Node | null = null;

    @property(Node)
    timerProgressNode: Node | null = null;

    @property(Node)
    targetItemsRootNode: Node | null = null;

    @property
    levelTimeSeconds: number = 120;

    @property
    autoStartTimer: boolean = false;

    @property
    timerPulseScale: number = 1.12;

    @property
    timerPulseDuration: number = 0.12;

    @property
    timerWarningSeconds: number = 10;

    @property(Color)
    timerNormalColor: Color = new Color(255, 255, 255, 255);

    @property(Color)
    timerWarningColor: Color = new Color(255, 76, 76, 255);

    @property
    replaySpinDuration: number = 0.35;

    @property
    resetBlockDuration: number = 0.22;

    @property
    targetIntroDuration: number = 0.42;

    @property
    targetIntroStagger: number = 0.035;

    @property
    targetCollectLiftDistance: number = 28;

    @property
    targetCollectLiftDuration: number = 0.16;

    @property
    targetCollectDropDuration: number = 0.18;

    @property
    targetCollectSpinDuration: number = 0.42;

    @property
    targetCollectSpinTurns: number = 3;

    @property
    targetCollectShrinkDuration: number = 0.24;

    private remainingSeconds = 0;
    private isTimerRunning = false;
    private lastDisplayedSecond = -1;
    private timerBaseScale: Vec3 = new Vec3(1, 1, 1);
    private restartBaseScale: Vec3 = new Vec3(1, 1, 1);
    private restartBaseAngle = 0;
    private isRestarting = false;
    private hasCapturedBaseScales = false;
    private targetBasePositions: WeakMap<Node, Vec3> = new WeakMap();
    private targetBaseScales: WeakMap<Node, Vec3> = new WeakMap();
    private targetIntroGeneration = 0;
    private targetCollectGeneration = 0;
    private restartGeneration = 0;
    private targetCollectStops: Set<() => void> = new Set();
    private starGraphics: Graphics | null = null;
    private stars: Array<{ x: number, y: number, radius: number, alpha: number, speedX: number, speedY: number, blinkSpeed: number, blinkPhase: number }> = [];
    private boardPreview: BoardPreview | null = null;
    private starBackgroundTransform: UITransform | null = null;
    private uiCanvas: Canvas | null = null;
    private readonly boardStarPadding = 18;

    onLoad() {
        this.resolveSceneReferences();
        this.bindRestartButton();
        this.ensureTimerLabel();
        this.captureBaseScales();
    }

    start() {
        this.resetTimer();
        this.resetTargetItems();
        this.playTargetIntroEffect(() => { });
        // this.initStarBackground();
        AudioManager.instance.playBgm();
    }

    onDestroy() {
        this.restartButton?.node.off(Button.EventType.CLICK, this.onRestartButtonClicked, this);
        this.restartButton?.node.off(Button.EventType.CLICK, this.restartLevel, this);
        this.stopTargetCollectSchedules();
        this.stopHudTweens();
    }

    update(deltaTime: number) {
        // this.updateStarBackground(deltaTime);

        if (!this.isTimerRunning) {
            return;
        }

        this.remainingSeconds = Math.max(0, this.remainingSeconds - deltaTime);
        this.updateTimerView();

        if (this.remainingSeconds <= 0) {
            this.isTimerRunning = false;
            this.onTimeOver();
        }
    }

    public restartLevel(animated: boolean = true, force: boolean = false) {
        if (this.isRestarting && !force) {
            return;
        }

        const restartGeneration = ++this.restartGeneration;
        this.resolveSceneReferences();
        this.captureBaseScales();

        if (!animated) {
            this.isRestarting = true;
            this.performRestartNow();
            this.playTargetIntroEffect(() => {
                this.finishRestart(restartGeneration);
            });
            this.scheduleRestartFallback(restartGeneration);
            return;
        }

        this.isRestarting = true;
        this.isTimerRunning = false;
        if (this.restartButton) {
            this.restartButton.interactable = false;
        }

        this.playReplayButtonEffect();
        this.performRestartNow();
        this.playTargetIntroEffect(() => {
            this.finishRestart(restartGeneration);
        });
        this.scheduleRestartFallback(restartGeneration);
    }

    private performRestartNow() {
        this.resolveSceneReferences();
        this.cleanUpTargetEffects();
        this.dragController?.resetPuzzleState();
        this.levelSpawner?.spawnLevel();
        this.dragController?.resetPuzzleState();
        this.dragController?.rebuildOccupied();
        this.resetTargetItems();
        this.resetTimer();

        if (this.autoStartTimer) {
            this.startTimer();
        }
    }

    private scheduleRestartFallback(restartGeneration: number) {
        this.scheduleOnce(() => {
            if (restartGeneration !== this.restartGeneration) {
                return;
            }

            if ((this.levelSpawner?.blocksRoot?.children.length || 0) === 0) {
                this.levelSpawner?.spawnLevel();
                this.dragController?.resetPuzzleState();
                this.dragController?.rebuildOccupied();
            }

            this.finishRestart(restartGeneration);
        }, Math.max(0.8, this.targetIntroDuration + this.targetIntroStagger * 8 + 0.2));
    }

    private finishRestart(restartGeneration: number) {
        if (restartGeneration !== this.restartGeneration) {
            return;
        }

        this.isRestarting = false;
        this.dragController?.setInputLocked(false);
        if (this.restartButton?.isValid) {
            this.restartButton.interactable = true;
        }
    }

    public resetTimer() {
        this.remainingSeconds = Math.max(0, this.levelTimeSeconds);
        this.isTimerRunning = false;
        this.lastDisplayedSecond = -1;
        this.updateTimerView();
    }

    public startTimer() {
        if (this.remainingSeconds <= 0) {
            this.resetTimer();
        }

        this.isTimerRunning = true;
    }

    public stopTimer() {
        this.isTimerRunning = false;
    }

    private resolveSceneReferences() {
        if (!this.levelSpawner?.isValid) {
            this.levelSpawner = this.findFirstNode(['BoardRoot', 'GameRoot/BoardRoot', 'block/BoardRoot'])?.getComponent(BlockSpawn) || null;
        }

        if (!this.dragController?.isValid) {
            this.dragController = this.findFirstNode(['BoardRoot', 'GameRoot/BoardRoot', 'block/BoardRoot'])?.getComponent(DragControl) || null;
        }

        if (!this.restartButton?.isValid) {
            this.restartButton = this.findFirstNode([
                'Canvas/TopPanel/ButtonReplay',
                'block/Canvas/TopPanel/ButtonReplay',
            ])?.getComponent(Button) || null;
        }

        if (!this.timerRootNode?.isValid) {
            this.timerRootNode = this.findFirstNode([
                'Canvas/TopPanel/TimeFrame',
                'block/Canvas/TopPanel/TimeFrame',
            ]);
        }

        if (!this.timerLabel?.isValid) {
            this.timerLabel = this.findFirstNode([
                'Canvas/TopPanel/TimeFrame/TimeNumber',
                'block/Canvas/TopPanel/TimeFrame/TimeNumber',
            ])?.getComponent(Label) || null;
        }

        if (!this.targetItemsRootNode?.isValid) {
            this.targetItemsRootNode = this.findFirstNode([
                'Canvas/TopUI/Top_bar',        // ← thêm path này
                'Canvas/TopUI/TargetBar',
                'block/Canvas/TopUI/TargetBar',
            ]);
        }
    }

    private findFirstNode(paths: string[]): Node | null {
        for (const path of paths) {
            const node = find(path);
            if (node) {
                return node;
            }
        }

        return null;
    }

    private bindRestartButton() {
        if (!this.restartButton) {
            return;
        }

        this.restartButton.transition = Button.Transition.NONE;
        this.restartButton.node.off(Button.EventType.CLICK, this.restartLevel, this);
        this.restartButton.node.off(Button.EventType.CLICK, this.onRestartButtonClicked, this);
        this.restartButton.node.on(Button.EventType.CLICK, this.onRestartButtonClicked, this);
    }

    private ensureTimerLabel() {
        if (this.timerLabel || !this.timerRootNode) {
            return;
        }

        const labelNode = new Node('CountdownLabel');
        labelNode.setParent(this.timerRootNode);
        labelNode.setPosition(30, 0, 0);

        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(120, 60);

        const label = labelNode.addComponent(Label);
        label.fontSize = 34;
        label.lineHeight = 40;
        label.color = this.timerNormalColor;
        label.horizontalAlign = 1;
        label.verticalAlign = 1;

        this.timerLabel = label;
    }

    private updateTimerView() {
        const displayedSecond = Math.ceil(Math.max(0, this.remainingSeconds));

        if (this.timerLabel) {
            this.timerLabel.string = this.formatTime(this.remainingSeconds);
            this.timerLabel.color = displayedSecond <= this.timerWarningSeconds
                ? this.timerWarningColor
                : this.timerNormalColor;
        }

        if (
            this.isTimerRunning &&
            displayedSecond !== this.lastDisplayedSecond &&
            displayedSecond <= this.timerWarningSeconds
        ) {
            this.lastDisplayedSecond = displayedSecond;
            this.playTimerPulse(true);
            if (AudioManager.instance) AudioManager.instance.playTick();
        } else if (displayedSecond !== this.lastDisplayedSecond) {
            this.lastDisplayedSecond = displayedSecond;
        }

        if (this.timerProgressNode) {
            const ratio = this.levelTimeSeconds <= 0 ? 0 : this.remainingSeconds / this.levelTimeSeconds;
            this.timerProgressNode.setScale(Math.max(0, Math.min(1, ratio)), 1, 1);
        }
    }

    private formatTime(seconds: number): string {
        const total = Math.ceil(Math.max(0, seconds));
        const minutes = Math.floor(total / 60);
        const secs = total % 60;

        return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
    }

    private onTimeOver() {
        if (AudioManager.instance) AudioManager.instance.playTimeout();
        console.log('TIME OVER!');

        // Find and trigger EndgameUIController's showLosePanel
        const canvas = find('Canvas') || find('block/Canvas');
        if (canvas) {
            let endgameUI = canvas.getComponent('EndgameUIController') as any;
            if (!endgameUI) endgameUI = canvas.getComponentInChildren('EndgameUIController') as any;

            if (endgameUI && typeof endgameUI.showLosePanel === 'function') {
                endgameUI.showLosePanel();
            }
        }
    }

    private onRestartButtonClicked() {
        if (AudioManager.instance) AudioManager.instance.playBlockDown();

        this.restartLevel(true, true);
    }

    private captureBaseScales() {
        if (this.hasCapturedBaseScales) {
            return;
        }

        if (this.timerRootNode) {
            this.timerBaseScale = this.timerRootNode.scale.clone();
        }

        if (this.restartButton?.node) {
            const scale = this.restartButton.node.scale.clone();
            this.restartBaseScale = this.sanitizeBaseScale(scale);
            this.restartBaseAngle = this.restartButton.node.angle;
        }

        this.hasCapturedBaseScales = true;
    }

    private sanitizeBaseScale(scale: Vec3): Vec3 {
        const maxAxis = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
        if (!Number.isFinite(maxAxis) || maxAxis <= 0 || maxAxis > 3) {
            return new Vec3(1, 1, 1);
        }

        return scale;
    }

    private playTimerPulse(isWarning: boolean) {
        const target = this.timerRootNode || this.timerLabel?.node;
        if (!target) {
            return;
        }

        const base = this.timerBaseScale.clone();
        const pulseScale = base.clone().multiplyScalar(isWarning ? this.timerPulseScale + 0.08 : this.timerPulseScale);

        Tween.stopAllByTarget(target);
        target.setScale(base);
        tween(target)
            .to(this.timerPulseDuration, { scale: pulseScale }, { easing: 'quadOut' })
            .to(this.timerPulseDuration, { scale: base }, { easing: 'quadIn' })
            .start();
    }

    private playReplayButtonEffect() {
        if (!this.restartButton?.node) {
            return;
        }

        const node = this.restartButton.node;
        const baseScale = this.restartBaseScale.clone();
        const popScale = baseScale.clone().multiplyScalar(1.12);

        Tween.stopAllByTarget(node);
        node.setScale(baseScale);
        node.angle = this.restartBaseAngle;
        tween(node)
            .parallel(
                tween().to(this.replaySpinDuration, { angle: this.restartBaseAngle - 360 }, { easing: 'quadOut' }),
                tween()
                    .to(this.replaySpinDuration * 0.5, { scale: popScale }, { easing: 'quadOut' })
                    .to(this.replaySpinDuration * 0.5, { scale: baseScale }, { easing: 'quadIn' }),
            )
            .call(() => {
                node.angle = this.restartBaseAngle;
                node.setScale(baseScale);
            })
            .start();
    }

    private playTargetIntroEffect(onComplete: () => void = () => { }) {
        const root = this.targetItemsRootNode;
        if (!root) {
            this.dragController?.setInputLocked(false);
            onComplete();
            return;
        }

        this.dragController?.setInputLocked(true);
        const generation = ++this.targetIntroGeneration;
        const targets = root.children
            .filter((child) => child.isValid && child.active && child.name.startsWith('TargetItem_'))
            .sort((a, b) => this.getTargetItemIndex(a) - this.getTargetItemIndex(b));
        if (targets.length === 0) {
            this.dragController?.setInputLocked(false);
            onComplete();
            return;
        }

        const center = this.getTargetIntroCenter(targets);
        const duration = Math.max(0.01, this.targetIntroDuration);
        let completed = 0;
        const completeOne = () => {
            completed++;
            if (completed < targets.length || generation !== this.targetIntroGeneration) {
                return;
            }

            this.dragController?.setInputLocked(false);
            onComplete();
        };

        // Calculate distance from center to find symmetrical pairs
        const targetDistances = targets.map((target) => {
            const endPos = this.getTargetBasePosition(target);
            return Math.round(Math.abs(endPos.x - center.x) * 100) / 100;
        });

        // Sort unique distances descending (outermost first)
        const uniqueDistances = Array.from(new Set(targetDistances)).sort((a, b) => b - a);

        targets.forEach((target, index) => {
            const endPosition = this.getTargetBasePosition(target);
            const endScale = this.getTargetBaseScale(target);
            const introScale = endScale.clone().multiplyScalar(0.94);
            const opacity = target.getComponent(UIOpacity) || target.addComponent(UIOpacity);

            Tween.stopAllByTarget(target);
            Tween.stopAllByTarget(opacity);
            // Start at center X but keep final Y — full scale, stacked like a deck
            target.setPosition(center.x, endPosition.y + 4, endPosition.z);
            target.setScale(introScale);
            opacity.opacity = 0;

            // Symmetrical pairs move simultaneously. Outer pairs go first to avoid crossing.
            const distance = targetDistances[index];
            const dealStep = uniqueDistances.indexOf(distance);
            const delay = dealStep * Math.max(0, this.targetIntroStagger);

            tween(target)
                .delay(delay)
                .call(() => {
                    target.setSiblingIndex(root.children.length - 1);
                })
                .parallel(
                    tween().to(duration, { position: endPosition, scale: endScale }, { easing: 'sineOut' }),
                    tween(opacity).to(Math.min(0.16, duration), { opacity: 255 }, { easing: 'sineOut' }),
                )
                .call(completeOne)
                .start();
        });
    }

    private getTargetBasePosition(target: Node): Vec3 {
        const cached = this.targetBasePositions.get(target);
        if (cached) {
            return cached.clone();
        }

        const position = target.position.clone();
        this.targetBasePositions.set(target, position.clone());
        return position;
    }

    private getTargetBaseScale(target: Node): Vec3 {
        const cached = this.targetBaseScales.get(target);
        if (cached) {
            return cached.clone();
        }

        const scale = this.sanitizeBaseScale(target.scale.clone());
        this.targetBaseScales.set(target, scale.clone());
        return scale;
    }
    private colorGroupToTargetName: { [key: string]: string } = {
        'green': 'Img_panel',
        'blue': 'Img_panel-1',
        'red': 'Img_panel-2',
        'purple': 'Img_panel-3'
    };

    public getTargetNodeForColorGroup(colorGroup: string): Node | null {
        this.resolveSceneReferences();

        const targetName = this.colorGroupToTargetName[colorGroup];
        if (!targetName || !this.targetItemsRootNode) return null;
        return this.targetItemsRootNode.getChildByName(targetName) || null;
    }

    public playTargetCollectedEffect(colorGroup: string) {
        const targetNode = this.getTargetNodeForColorGroup(colorGroup);
        if (!targetNode) return;
        const parent = targetNode.parent;
        if (!parent) return;
        const generation = this.targetCollectGeneration;

        Tween.stopAllByTarget(targetNode);

        const baseScale = this.getTargetBaseScale(targetNode);
        const settleScale = baseScale.clone().multiplyScalar(1.08);
        const vanishScale = new Vec3(0.001, 0.001, 0.001);
        const basePosition = targetNode.position.clone();
        const visualOffset = this.getTargetVisualOffset(targetNode);
        const pivotBasePosition = new Vec3(
            basePosition.x + visualOffset.x,
            basePosition.y + visualOffset.y,
            basePosition.z + visualOffset.z,
        );
        const liftedPosition = new Vec3(
            pivotBasePosition.x,
            pivotBasePosition.y + Math.max(0, this.targetCollectLiftDistance),
            pivotBasePosition.z,
        );
        const pivot = new Node('__TargetCollectPivot');
        pivot.layer = targetNode.layer;
        pivot.setParent(parent);
        pivot.setPosition(pivotBasePosition);
        pivot.setSiblingIndex(parent.children.length - 1);
        const glow = this.createTargetCollectGlow(parent, pivotBasePosition, targetNode.layer, targetNode);
        const check = this.createTargetCollectCheck(targetNode);
        let stopSparkles: (() => void) | null = this.startTargetCollectSparkles(parent, pivotBasePosition, targetNode.layer, targetNode);

        targetNode.setParent(pivot);
        targetNode.setPosition(-visualOffset.x, -visualOffset.y, -visualOffset.z);

        const baseEuler = pivot.eulerAngles.clone();
        const spinEuler = baseEuler.clone();
        spinEuler.y += 360 * Math.max(1, this.targetCollectSpinTurns);

        targetNode.setScale(baseScale);
        tween(pivot)
            .parallel(
                tween().to(Math.max(0.01, this.targetCollectLiftDuration), { position: liftedPosition }, { easing: 'quadOut' }),
                tween(targetNode).to(Math.max(0.01, this.targetCollectLiftDuration), { scale: settleScale }, { easing: 'quadOut' }),
            )
            .parallel(
                tween().to(Math.max(0.01, this.targetCollectDropDuration), { position: pivotBasePosition }, { easing: 'quadInOut' }),
                tween(targetNode).to(Math.max(0.01, this.targetCollectDropDuration), { scale: baseScale }, { easing: 'quadInOut' }),
            )
            .to(Math.max(0.01, this.targetCollectSpinDuration), { eulerAngles: spinEuler }, { easing: 'cubicInOut' })
            .parallel(
                tween(targetNode).to(Math.max(0.01, this.targetCollectShrinkDuration), { scale: vanishScale }, { easing: 'backIn' }),
                tween().to(Math.max(0.01, this.targetCollectShrinkDuration), { scale: vanishScale }, { easing: 'backIn' }),
            )
            .call(() => {
                if (generation !== this.targetCollectGeneration) {
                    if (pivot.isValid) {
                        pivot.destroy();
                    }
                    if (stopSparkles) {
                        stopSparkles();
                        stopSparkles = null;
                    }
                    return;
                }

                if (AudioManager.instance) AudioManager.instance.playBlockMatch();

                targetNode.setParent(parent);
                targetNode.active = false;
                targetNode.setPosition(basePosition);
                targetNode.setRotationFromEuler(baseEuler.x, baseEuler.y, baseEuler.z);
                targetNode.setScale(baseScale);
                if (pivot.isValid) {
                    pivot.destroy();
                }
                if (stopSparkles) {
                    stopSparkles();
                    stopSparkles = null;
                }
                if (glow?.isValid) {
                    glow.destroy();
                }
                if (check?.isValid) {
                    check.destroy();
                }
                this.layoutRemainingTargets(true);
            })
            .start();
    }

    private createTargetCollectGlow(parent: Node, center: Vec3, layer: number, targetNode: Node): Node {
        const size = this.getTargetEffectSize(targetNode) * 0.5;
        const glow = new Node('__TargetCollectGlow');
        glow.layer = layer;
        glow.setParent(parent);
        glow.setPosition(center);
        glow.setSiblingIndex(Math.max(0, parent.children.length - 2));

        const transform = glow.addComponent(UITransform);
        transform.setContentSize(size, size);

        const graphics = glow.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = new Color(255, 226, 118, 24);
        graphics.roundRect(-size * 0.5, -size * 0.5, size, size, size * 0.22);
        graphics.fill();
        graphics.strokeColor = new Color(255, 238, 162, 54);
        graphics.lineWidth = Math.max(1, size * 0.016);
        graphics.roundRect(-size * 0.5, -size * 0.5, size, size, size * 0.22);
        graphics.stroke();

        const opacity = glow.addComponent(UIOpacity);
        opacity.opacity = 0;
        glow.setScale(new Vec3(0.82, 0.82, 0.82));

        tween(glow)
            .parallel(
                tween().to(0.16, { scale: new Vec3(1.04, 1.04, 1.04) }, { easing: 'quadOut' }),
                tween(opacity).to(0.1, { opacity: 120 }, { easing: 'quadOut' }),
            )
            .to(0.22, { scale: new Vec3(1.12, 1.12, 1.12) }, { easing: 'quadOut' })
            .parallel(
                tween().to(0.16, { scale: new Vec3(1.18, 1.18, 1.18) }, { easing: 'quadIn' }),
                tween(opacity).to(0.16, { opacity: 0 }, { easing: 'quadIn' }),
            )
            .call(() => {
                if (glow.isValid) glow.destroy();
            })
            .start();

        return glow;
    }

    private createTargetCollectCheck(targetNode: Node): Node {
        const size = this.getTargetEffectSize(targetNode);
        const check = new Node('__TargetCollectCheck');
        check.layer = targetNode.layer;
        check.setParent(targetNode);
        const halfSize = size * 0.5;
        check.setPosition(halfSize * 0.26, -halfSize * 0.26, 0);
        check.setSiblingIndex(targetNode.children.length - 1);

        const transform = check.addComponent(UITransform);
        transform.setContentSize(size * 0.22, size * 0.22);

        const graphics = check.addComponent(Graphics);
        graphics.clear();
        graphics.strokeColor = new Color(42, 214, 70, 255);
        graphics.lineWidth = Math.max(2, size * 0.035);
        graphics.moveTo(-size * 0.07, 0);
        graphics.lineTo(-size * 0.016, -size * 0.052);
        graphics.lineTo(size * 0.085, size * 0.065);
        graphics.stroke();

        const opacity = check.addComponent(UIOpacity);
        opacity.opacity = 0;
        check.setScale(new Vec3(0.2, 0.2, 0.2));

        tween(check)
            .delay(0.1)
            .parallel(
                tween().to(0.16, { scale: new Vec3(1.08, 1.08, 1.08) }, { easing: 'backOut' }),
                tween(opacity).to(0.08, { opacity: 255 }, { easing: 'quadOut' }),
            )
            .delay(0.45)
            .to(0.12, { scale: new Vec3(0.001, 0.001, 0.001) }, { easing: 'backIn' })
            .call(() => {
                if (check.isValid) check.destroy();
            })
            .start();

        return check;
    }

    private startTargetCollectSparkles(parent: Node, center: Vec3, layer: number, targetNode: Node): () => void {
        let active = true;
        const emit = () => {
            if (!active || !parent.isValid || !targetNode.isValid || !targetNode.active) {
                return;
            }

            this.spawnTargetCollectSparkles(parent, center, layer, targetNode, 5);
        };

        emit();
        this.schedule(emit, 0.08);

        const stop = () => {
            active = false;
            this.unschedule(emit);
            this.targetCollectStops.delete(stop);
        };
        this.targetCollectStops.add(stop);
        return stop;
    }

    private spawnTargetCollectSparkles(parent: Node, center: Vec3, layer: number, targetNode: Node, count: number) {
        const size = this.getTargetEffectSize(targetNode);
        for (let i = 0; i < count; i++) {
            const sparkle = new Node('__TargetCollectSparkle');
            sparkle.layer = layer;
            sparkle.setParent(parent);
            sparkle.setSiblingIndex(parent.children.length - 1);

            const sparkleSize = 4 + Math.random() * 5;
            const transform = sparkle.addComponent(UITransform);
            transform.setContentSize(sparkleSize, sparkleSize);

            const graphics = sparkle.addComponent(Graphics);
            this.drawTargetCollectSparkle(graphics, sparkleSize);

            const opacity = sparkle.addComponent(UIOpacity);
            opacity.opacity = 0;

            const spawnInside = Math.random() < 0.55;
            const angle = Math.random() * Math.PI * 2;
            const radius = spawnInside
                ? size * Math.sqrt(Math.random()) * 0.34
                : size * (0.38 + Math.random() * 0.42);
            const start = new Vec3(
                center.x + Math.cos(angle) * radius * (spawnInside ? 0.35 : 0.72),
                center.y + Math.sin(angle) * radius * (spawnInside ? 0.35 : 0.72),
                center.z,
            );
            const end = new Vec3(
                center.x + Math.cos(angle) * radius,
                center.y + Math.sin(angle) * radius,
                center.z,
            );
            sparkle.setPosition(start);
            sparkle.setScale(new Vec3(0.45, 0.45, 0.45));

            tween(sparkle)
                .delay(Math.random() * 0.16)
                .parallel(
                    tween().to(0.32 + Math.random() * 0.18, { position: end, scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }),
                    tween(opacity)
                        .to(0.08, { opacity: 230 }, { easing: 'quadOut' })
                        .delay(0.18 + Math.random() * 0.12)
                        .to(0.12, { opacity: 0 }, { easing: 'quadIn' }),
                )
                .call(() => {
                    if (sparkle.isValid) sparkle.destroy();
                })
                .start();
        }
    }

    private drawTargetCollectSparkle(graphics: Graphics, size: number) {
        graphics.clear();
        graphics.fillColor = new Color(255, 242, 176, 220);
        graphics.circle(0, 0, size * 0.5);
        graphics.fill();
        graphics.fillColor = new Color(255, 221, 118, 210);
        graphics.circle(0, 0, size * 0.22);
        graphics.fill();
    }

    private getTargetEffectSize(targetNode: Node): number {
        const transform = targetNode.getComponent(UITransform);
        if (transform) {
            return Math.max(48, transform.contentSize.width, transform.contentSize.height);
        }

        return 86;
    }

    public cleanUpTargetEffects() {
        if (!this.targetItemsRootNode) return;

        this.targetIntroGeneration++;
        this.targetCollectGeneration++;
        this.stopTargetCollectSchedules();

        for (const targetNode of this.findTargetItemsDeep(this.targetItemsRootNode)) {
            Tween.stopAllByTarget(targetNode);
            const opacity = targetNode.getComponent(UIOpacity);
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 255;
            }
            if (targetNode.parent !== this.targetItemsRootNode) {
                targetNode.setParent(this.targetItemsRootNode);
            }
        }

        this.destroyTargetEffectChildren(this.targetItemsRootNode);
    }

    private resetTargetItems() {
        this.cleanUpTargetEffects();
        const targets = this.getTargetItems();

        for (const target of targets) {
            Tween.stopAllByTarget(target);
            const opacity = target.getComponent(UIOpacity);
            if (opacity) {
                Tween.stopAllByTarget(opacity);
                opacity.opacity = 255;
            }
            target.active = true;
            target.setPosition(this.getTargetBasePosition(target));
            target.setScale(this.getTargetBaseScale(target));
            target.setRotationFromEuler(0, 0, 0);
        }
    }

    private stopTargetCollectSchedules() {
        const stops = Array.from(this.targetCollectStops);
        this.targetCollectStops.clear();

        for (let i = 0; i < stops.length; i++) {
            const stop = stops[i];
            if (typeof stop === 'function') {
                stop();
            }
        }
    }

    private findTargetItemsDeep(root: Node): Node[] {
        const result: Node[] = [];
        const visit = (node: Node) => {
            for (const child of node.children) {
                if (!child.isValid) {
                    continue;
                }

                if (child.name.startsWith('TargetItem_')) {
                    result.push(child);
                    continue;
                }

                visit(child);
            }
        };

        visit(root);
        return result.sort((a, b) => this.getTargetItemIndex(a) - this.getTargetItemIndex(b));
    }

    private destroyTargetEffectChildren(node: Node) {
        for (const child of [...node.children]) {
            if (!child.isValid) {
                continue;
            }

            if (child.name.startsWith('__TargetCollect')) {
                Tween.stopAllByTarget(child);
                const opacity = child.getComponent(UIOpacity);
                if (opacity) {
                    Tween.stopAllByTarget(opacity);
                }
                child.destroy();
                continue;
            }

            this.destroyTargetEffectChildren(child);
        }
    }

    private layoutRemainingTargets(animated: boolean) {
        const activeTargets = this.getTargetItems().filter((target) => target.active);
        if (activeTargets.length === 0) {
            return;
        }

        const positions = this.getBalancedTargetPositions(activeTargets.length);
        const duration = animated ? 0.22 : 0;

        activeTargets.forEach((target, index) => {
            Tween.stopAllByTarget(target);
            const targetPosition = this.getParentPositionForVisualCenter(target, positions[index]);
            const baseScale = this.getTargetBaseScale(target);

            target.setScale(baseScale);
            if (duration <= 0) {
                target.setPosition(targetPosition);
                return;
            }

            tween(target)
                .to(duration, { position: targetPosition }, { easing: 'quadOut' })
                .start();
        });
    }

    private getBalancedTargetPositions(count: number): Vec3[] {
        const allTargets = this.getTargetItems();
        if (allTargets.length === 0) {
            return [];
        }

        const basePositions = allTargets.map((target) => this.getTargetBasePosition(target));
        const visualBasePositions = allTargets.map((target, index) => this.getTargetVisualCenter(target, basePositions[index]));
        const center = this.getTargetBaseCenter(visualBasePositions);
        const spacing = this.getTargetEvenSpacing(visualBasePositions);
        const result: Vec3[] = [];

        for (let i = 0; i < count; i++) {
            const source = visualBasePositions[Math.min(i, visualBasePositions.length - 1)];
            result.push(new Vec3(
                center.x + (i - (count - 1) * 0.5) * spacing,
                source.y,
                source.z,
            ));
        }

        return result;
    }

    private getTargetVisualCenter(target: Node, parentPosition: Vec3): Vec3 {
        const offset = this.getTargetVisualOffset(target);
        return new Vec3(parentPosition.x + offset.x, parentPosition.y + offset.y, parentPosition.z + offset.z);
    }

    private getParentPositionForVisualCenter(target: Node, visualCenter: Vec3): Vec3 {
        const offset = this.getTargetVisualOffset(target);
        return new Vec3(visualCenter.x - offset.x, visualCenter.y - offset.y, visualCenter.z - offset.z);
    }

    private getTargetVisualOffset(target: Node): Vec3 {
        const visibleChildren = target.children.filter((child) => child.isValid && child.active);
        if (visibleChildren.length === 0) {
            return new Vec3();
        }

        const offset = new Vec3();
        for (const child of visibleChildren) {
            offset.x += child.position.x;
            offset.y += child.position.y;
            offset.z += child.position.z;
        }

        offset.multiplyScalar(1 / visibleChildren.length);
        return offset;
    }

    private getTargetBaseCenter(positions: Vec3[]): Vec3 {
        const center = new Vec3();

        for (const position of positions) {
            center.x += position.x;
            center.y += position.y;
            center.z += position.z;
        }

        center.multiplyScalar(1 / Math.max(1, positions.length));
        return center;
    }

    private getTargetEvenSpacing(positions: Vec3[]): number {
        const sortedX = positions
            .map((position) => position.x)
            .sort((a, b) => a - b);

        if (sortedX.length < 2) {
            return 0;
        }

        return (sortedX[sortedX.length - 1] - sortedX[0]) / (sortedX.length - 1);
    }

    private getTargetItems(): Node[] {
        this.resolveSceneReferences();

        return (this.targetItemsRootNode?.children || [])
            .filter((child) => child.isValid && child.name.startsWith('Img_panel'))
            .sort((a, b) => this.getTargetItemIndex(a) - this.getTargetItemIndex(b));
    }

    private getTargetItemIndex(target: Node): number {
        const match = target.name.match(/^Img_panel-?(\d*)$/);
        if (match) return match[1] ? Number(match[1]) : 0;
    }

    private getTargetIntroCenter(targets: Node[]): Vec3 {
        if (targets.length === 0) {
            return new Vec3();
        }

        const center = new Vec3();
        for (const target of targets) {
            const position = this.getTargetBasePosition(target);
            center.x += position.x;
            center.y += position.y;
            center.z += position.z;
        }

        center.multiplyScalar(1 / targets.length);
        return center;
    }

    private playResetBlocksEffect(onComplete: () => void) {
        const blocks = this.levelSpawner?.blocksRoot?.children.filter((child) => child.isValid) || [];
        if (blocks.length === 0) {
            onComplete();
            return;
        }

        let completed = 0;
        const duration = Math.max(0.01, this.resetBlockDuration);

        for (const block of blocks) {
            const baseScale = block.scale.clone();
            const basePosition = block.position.clone();
            const liftPosition = new Vec3(basePosition.x, basePosition.y + 0.2, basePosition.z);

            Tween.stopAllByTarget(block);
            tween(block)
                .parallel(
                    tween().to(duration, { scale: baseScale.clone().multiplyScalar(0.001) }, { easing: 'backIn' }),
                    tween().to(duration, { position: liftPosition }, { easing: 'quadOut' }),
                )
                .call(() => {
                    completed++;
                    if (completed >= blocks.length) {
                        onComplete();
                    }
                })
                .start();
        }
    }

    private stopHudTweens() {
        if (this.timerRootNode) {
            Tween.stopAllByTarget(this.timerRootNode);
        }

        if (this.timerLabel?.node) {
            Tween.stopAllByTarget(this.timerLabel.node);
        }

        if (this.restartButton?.node) {
            Tween.stopAllByTarget(this.restartButton.node);
            this.restartButton.node.setScale(this.restartBaseScale);
            this.restartButton.node.angle = this.restartBaseAngle;
        }

        if (this.targetItemsRootNode) {
            for (const child of this.targetItemsRootNode.children) {
                Tween.stopAllByTarget(child);
            }
        }
    }

    // private initStarBackground() {
    //     const canvas = find('Canvas') || find('block/Canvas') || this.node;
    //     this.uiCanvas = canvas.getComponent(Canvas);

    //     let bgNode = canvas.getChildByName('StarBackground');
    //     if (!bgNode) {
    //         bgNode = new Node('StarBackground');
    //         bgNode.layer = canvas.layer;
    //         bgNode.setParent(canvas);
    //         // Index 0 is usually the background image, so we put stars at index 1
    //         bgNode.setSiblingIndex(1);
    //     }

    //     let uiTransform = bgNode.getComponent(UITransform);
    //     if (!uiTransform) {
    //         uiTransform = bgNode.addComponent(UITransform);
    //     }
    //     const winSize = view.getVisibleSize();
    //     uiTransform.setContentSize(winSize.width, winSize.height);
    //     this.starBackgroundTransform = uiTransform;

    //     let graphics = bgNode.getComponent(Graphics);
    //     if (!graphics) {
    //         graphics = bgNode.addComponent(Graphics);
    //     }

    //     this.starGraphics = graphics;
    //     this.stars = [];

    //     // Thật nhiều sao: 150 ngôi sao
    //     const numStars = 150;
    //     for (let i = 0; i < numStars; i++) {
    //         this.stars.push({
    //             x: (Math.random() - 0.5) * winSize.width,
    //             y: (Math.random() - 0.5) * winSize.height,
    //             radius: Math.random() * 1.7 + 1.0, // Kích thước từ 1.0 đến 2.7
    //             alpha: Math.random() * 255,
    //             speedX: (Math.random() - 0.5) * 15 - 5, // Trôi nhẹ sang trái/phải
    //             speedY: (Math.random() - 0.5) * 15 + 10, // Trôi nhẹ lên trên
    //             blinkSpeed: Math.random() * 3 + 1, // Tốc độ nhấp nháy
    //             blinkPhase: Math.random() * Math.PI * 2
    //         });
    //     }
    // }

    // private updateStarBackground(deltaTime: number) {
    //     if (!this.starGraphics) return;

    //     const graphics = this.starGraphics;
    //     graphics.clear();

    //     const winSize = view.getVisibleSize();
    //     const halfW = winSize.width / 2;
    //     const halfH = winSize.height / 2;
    //     const blockedPolygon = this.getBoardStarBlockedPolygon();

    //     for (const star of this.stars) {
    //         star.x += star.speedX * deltaTime;
    //         star.y += star.speedY * deltaTime;
    //         star.blinkPhase += star.blinkSpeed * deltaTime;

    //         // Quấn vòng quanh màn hình (Wrap around)
    //         if (star.x < -halfW) star.x = halfW;
    //         else if (star.x > halfW) star.x = -halfW;

    //         if (star.y < -halfH) star.y = halfH;
    //         else if (star.y > halfH) star.y = -halfH;

    //         if (blockedPolygon && this.isPointInsidePolygon(star.x, star.y, blockedPolygon)) {
    //             continue;
    //         }

    //         // Tính toán độ mờ bằng sóng sine
    //         const alpha = 127 + Math.sin(star.blinkPhase) * 127;

    //         // Ánh sáng lấp lánh có màu hơi vàng/trắng
    //         graphics.fillColor = new Color(255, 255, 230, Math.floor(alpha));
    //         graphics.circle(star.x, star.y, star.radius);
    //         graphics.fill();
    //     }
    // }

    // private getBoardStarBlockedPolygon(): Array<{ x: number, y: number }> | null {
    //     const boardPreview = this.getBoardPreview();
    //     const mainCamera = boardPreview?.camera;
    //     const uiCamera = this.getUiCamera();
    //     const starTransform = this.starBackgroundTransform || this.starGraphics?.node.getComponent(UITransform) || null;
    //     if (!boardPreview || !mainCamera || !uiCamera || !starTransform) {
    //         return null;
    //     }

    //     const layout = boardPreview.getBoardLayout();
    //     const paddingWorld = Math.max(layout.cellStep * 0.35, 0.2);
    //     const boardY = Math.max(boardPreview.cellY, boardPreview.cellThickness);
    //     const localCorners = [
    //         new Vec3(layout.centerX - layout.boardWidth * 0.5 - paddingWorld, boardY, layout.centerZ - layout.boardHeight * 0.5 - paddingWorld),
    //         new Vec3(layout.centerX + layout.boardWidth * 0.5 + paddingWorld, boardY, layout.centerZ - layout.boardHeight * 0.5 - paddingWorld),
    //         new Vec3(layout.centerX + layout.boardWidth * 0.5 + paddingWorld, boardY, layout.centerZ + layout.boardHeight * 0.5 + paddingWorld),
    //         new Vec3(layout.centerX - layout.boardWidth * 0.5 - paddingWorld, boardY, layout.centerZ + layout.boardHeight * 0.5 + paddingWorld),
    //     ];
    //     const worldMatrix = new Mat4();
    //     boardPreview.node.getWorldMatrix(worldMatrix);

    //     const polygon: Array<{ x: number, y: number }> = [];
    //     const world = new Vec3();
    //     const screen = new Vec3();
    //     const uiWorld = new Vec3();
    //     const local = new Vec3();
    //     const starScreen = new Vec3();
    //     uiCamera.worldToScreen(starTransform.node.worldPosition, starScreen);

    //     for (const corner of localCorners) {
    //         Vec3.transformMat4(world, corner, worldMatrix);
    //         mainCamera.worldToScreen(world, screen);
    //         screen.z = starScreen.z;
    //         uiCamera.screenToWorld(screen, uiWorld);
    //         starTransform.convertToNodeSpaceAR(uiWorld, local);
    //         polygon.push({ x: local.x, y: local.y });
    //     }

    //     if (polygon.length !== 4 || polygon.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    //         return null;
    //     }

    //     return this.expandPolygonFromCenter(polygon, this.boardStarPadding);
    // }

    private getBoardPreview(): BoardPreview | null {
        if (this.boardPreview?.isValid) {
            return this.boardPreview;
        }

        this.boardPreview =
            this.levelSpawner?.node.getComponent(BoardPreview) ||
            this.dragController?.node.getComponent(BoardPreview) ||
            this.findFirstNode(['BoardRoot', 'GameRoot/BoardRoot', 'block/BoardRoot'])?.getComponent(BoardPreview) ||
            null;

        return this.boardPreview;
    }

    private getUiCamera() {
        if (this.uiCanvas?.cameraComponent) {
            return this.uiCanvas.cameraComponent;
        }

        const canvas = find('Canvas') || find('block/Canvas') || this.node;
        this.uiCanvas = canvas.getComponent(Canvas);
        return this.uiCanvas?.cameraComponent || null;
    }

    // private expandPolygonFromCenter(points: Array<{ x: number, y: number }>, padding: number): Array<{ x: number, y: number }> {
    //     const center = points.reduce(
    //         (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    //         { x: 0, y: 0 },
    //     );

    //     return points.map((point) => {
    //         const dx = point.x - center.x;
    //         const dy = point.y - center.y;
    //         const length = Math.max(0.001, Math.hypot(dx, dy));
    //         return {
    //             x: point.x + dx / length * padding,
    //             y: point.y + dy / length * padding,
    //         };
    //     });
    // }

    // private isPointInsidePolygon(x: number, y: number, points: Array<{ x: number, y: number }>): boolean {
    //     let inside = false;
    //     for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    //         const a = points[i];
    //         const b = points[j];
    //         const crossesY = a.y > y !== b.y > y;
    //         if (crossesY && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
    //             inside = !inside;
    //         }
    //     }
    //     return inside;
    // }
}
