import {
    _decorator,
    BoxCollider,
    Camera,
    Color,
    Component,
    EventMouse,
    EventTouch,
    geometry,
    gfx,
    find,
    Graphics,
    input,
    Input,
    instantiate,
    Material,
    MeshRenderer,
    Node,
    PhysicsSystem,
    primitives,
    Sprite,
    SpriteFrame,
    Texture2D,
    tween,
    Tween,
    UITransform,
    UIOpacity,
    utils,
    Vec2,
    Vec3,
    view,
} from 'cc';
import { BoardPreview } from './BoardPreview';
import { BlockSpawn } from './BlockSpawn';
import { DraggableBlock } from './DraggableBlock';
import { GameController } from './GameController';
// import { DraggableBlock } from './DraggableBlock';
// import { AudioManager } from './AudioManager';

const { ccclass, property } = _decorator;

type SparkleType = 'star' | 'bubble' | 'spot' | 'flare';

@ccclass('DragControl')
export class DragControl extends Component {
    @property(Camera)
    mainCamera: Camera | null = null;

    @property(Node)
    blocksRoot: Node | null = null;

    @property
    cols: number = 5;

    @property
    rows: number = 7;

    @property
    cellStepX: number = 0.75;

    @property
    cellStepZ: number = 0.75;

    @property
    centerX: number = 0;

    @property
    centerZ: number = 1.8;

    @property
    blockY: number = 0.18;

    @property
    dragLiftY: number = 0.12;

    @property
    snapDuration: number = 0.12;

    @property
    pickupDuration: number = 0.12;

    @property
    dragFollowSharpness: number = 16;

    @property
    holdScaleMultiplier: number = 1.05;

    @property(Color)
    holdHighlightColor: Color = new Color(255, 255, 255, 255);

    @property
    outlineScaleMultiplier: number = 1.08;

    @property
    outlineYOffset: number = -0.012;

    @property
    outlineDepthBias: number = 0.0001;

    @property
    dragCollisionFillRatio: number = 0.85;

    @property({ range: [0, 1] })
    dragCollisionCornerRadiusRatio: number = 0.6;

    @property
    pickHitPaddingCells: number = 0.8;

    @property
    shatterPopScaleMultiplier: number = 1.15;

    @property
    shatterPopDuration: number = 0.08;

    @property
    shatterRiseHeight: number = 0.18;

    @property
    shatterRiseDuration: number = 0.12;

    @property
    shatterShrinkDuration: number = 0;

    @property
    shatterFragmentCount: number = 18;

    @property
    shatterFragmentSize: number = 0.16;

    @property
    shatterFragmentSpread: number = 1.35;

    @property
    shatterFragmentRise: number = 0.75;

    @property
    shatterFragmentFall: number = 6;

    @property
    shatterFragmentOffscreenPadding: number = 1.2;

    @property
    shatterFragmentVerticalDrop: number = 0.45;

    @property
    shatterFragmentBurstDuration: number = 0.1;

    @property
    shatterFragmentFallDuration: number = 0.58;

    // Object pools to prevent instantiation lag
    private fragmentPool: Node[] = [];
    private sparklePool: Node[] = [];

    private getFragmentNode(mat: Material, mesh: any): Node {
        let node = this.fragmentPool.pop();
        if (node && node.isValid) {
            node.active = true;
            const renderer = node.getComponent(MeshRenderer);
            if (renderer) {
                renderer.mesh = mesh;
                renderer.material = mat;
            }
            node.active = true;
            return node;
        }
        node = new Node('__ShatterFragment');
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = mesh;
        renderer.material = mat;
        return node;
    }

    private returnFragmentNode(node: Node) {
        if (node.isValid) {
            node.active = false;
            node.setParent(null);
            this.fragmentPool.push(node);
        }
    }

    private getSparkleNode(isBurst: boolean): Node {
        let node = this.sparklePool.pop();
        if (node && node.isValid) {
            node.active = true;
            node.name = isBurst ? '__CompletionBurst' : '__FlyingStarTrail';
            return node;
        }
        node = new Node(isBurst ? '__CompletionBurst' : '__FlyingStarTrail');
        node.addComponent(UITransform);
        node.addComponent(Graphics);
        node.addComponent(UIOpacity);
        return node;
    }

    private returnSparkleNode(node: Node) {
        if (node.isValid) {
            node.active = false;
            node.setParent(null);
            const graphics = node.getComponent(Graphics);
            if (graphics) graphics.clear();
            this.sparklePool.push(node);
        }
    }

    @property
    imageLiftHeight: number = 0.42;

    @property
    imageLiftDuration: number = 0.1;

    @property
    imageFlyDuration: number = 0.82;

    @property
    imageTargetHoldDuration: number = 0;

    @property
    imagePopStartScale: number = 0.22;

    @property
    imageStarTrailInterval: number = 0.045;

    @property
    imageStarTrailDuration: number = 0.42;

    @property
    imageGlowScaleMultiplier: number = 1.45;

    @property
    imageUiScaleMultiplier: number = 90;

    @property
    flyingImageSize: number = 112;

    @property
    startTimerOnFirstDrag: boolean = true;

    private draggingBlock: DraggableBlock | null = null;
    private draggingNode: Node | null = null;
    private draggingStartCol = 0;
    private draggingStartRow = 0;
    private draggingCurrentCol = 0;
    private draggingCurrentRow = 0;
    private draggingBaseScale: Vec3 | null = null;
    private dragPointerOffset: Vec3 = new Vec3();
    private desiredDragPosition: Vec3 | null = null;
    private lastValidDragPosition: Vec3 | null = null;
    private outlineNode: Node | null = null;
    private occupied: Map<string, DraggableBlock> = new Map();
    private baseScales: WeakMap<Node, Vec3> = new WeakMap();
    private completedColorGroups: Set<string> = new Set();
    private hasStartedTimerForCurrentLevel = false;
    private inputLocked = false;
    private effectGeneration = 0;

    onEnable() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    start() {
        this.syncFromBoardPreview();
        this.rebuildOccupied();
    }

    update(deltaTime: number) {
        if (!this.draggingNode || !this.desiredDragPosition) {
            return;
        }

        const t = 1 - Math.exp(-Math.max(1, this.dragFollowSharpness) * deltaTime);
        const current = this.draggingNode.position;

        const nextX = current.x + (this.desiredDragPosition.x - current.x) * t;
        const nextY = current.y + (this.desiredDragPosition.y - current.y) * t;
        const nextZ = current.z + (this.desiredDragPosition.z - current.z) * t;

        this.draggingNode.setPosition(nextX, nextY, nextZ);

        // Hiệu ứng nghiêng (tilt) mượt mà khi lách và di chuyển
        const velX = (nextX - current.x) / Math.max(deltaTime, 0.001);
        const velZ = (nextZ - current.z) / Math.max(deltaTime, 0.001);

        const tiltMultiplier = 1.2;
        const maxTilt = 12;

        const targetPitch = Math.max(-maxTilt, Math.min(maxTilt, velZ * tiltMultiplier));
        const targetRoll = Math.max(-maxTilt, Math.min(maxTilt, -velX * tiltMultiplier));

        const currentEuler = this.draggingNode.eulerAngles;
        const rotT = 1 - Math.exp(-25 * deltaTime);

        this.draggingNode.setRotationFromEuler(
            currentEuler.x + (targetPitch - currentEuler.x) * rotT,
            currentEuler.y,
            currentEuler.z + (targetRoll - currentEuler.z) * rotT
        );
    }

    public syncFromBoardPreview() {
        const boardPreview = this.node.getComponent(BoardPreview);
        if (!boardPreview) {
            return;
        }

        const layout = boardPreview.getBoardLayout();
        this.mainCamera = this.mainCamera || boardPreview.camera;
        this.cols = boardPreview.cols;
        this.rows = boardPreview.rows;
        this.cellStepX = layout.cellStep;
        this.cellStepZ = layout.cellStep;
        this.centerX = layout.centerX;
        this.centerZ = layout.centerZ;
    }

    public rebuildOccupied() {
        this.occupied.clear();

        if (!this.blocksRoot) {
            return;
        }

        for (const child of this.blocksRoot.children) {
            const block = child.getComponent(DraggableBlock);
            if (block && this.isBlockBlocking(block)) {
                this.addBlockToOccupied(block);
            }
        }
    }

    public resetPuzzleState() {
        this.effectGeneration++;
        this.unscheduleAllCallbacks();
        this.cleanUpEffects();

        if (this.draggingNode) {
            Tween.stopAllByTarget(this.draggingNode);
            this.setBlockHighlight(this.draggingNode, false);
        }

        this.draggingBlock = null;
        this.draggingNode = null;
        this.draggingStartCol = 0;
        this.draggingStartRow = 0;
        this.draggingCurrentCol = 0;
        this.draggingCurrentRow = 0;
        this.draggingBaseScale = null;
        this.dragPointerOffset.set(0, 0, 0);
        this.desiredDragPosition = null;
        this.lastValidDragPosition = null;
        this.completedColorGroups.clear();
        this.baseScales = new WeakMap();
        this.hasStartedTimerForCurrentLevel = false;
        this.rebuildOccupied();
    }

    public setInputLocked(locked: boolean) {
        this.inputLocked = locked;

        if (locked && this.draggingNode) {
            this.endDrag();
        }
    }

    private cleanUpEffects() {
        if (this.blocksRoot?.isValid) {
            this.stopTweensRecursive(this.blocksRoot);
        }

        if (this.blocksRoot) {
            this.destroyEffectChildren(this.blocksRoot, ['__ShatterFragment']);
        }

        const hudController = this.resolveHudController();
        if (hudController) {
            this.destroyEffectChildren(hudController.node, [
                '__CompletionBurst',
                '__FlyingStarTrail',
                '__TempCellFlareSource',
                '__TempShatterStarSource',
                'FlyingImage_',
            ]);

            if (hudController.targetItemsRootNode) {
                this.destroyEffectChildren(hudController.targetItemsRootNode, ['FlyingImage_']);
            }
        }
    }

    private stopTweensRecursive(node: Node) {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
        }

        for (const child of node.children) {
            if (child.isValid) {
                this.stopTweensRecursive(child);
            }
        }
    }

    private destroyEffectChildren(node: Node, prefixes: string[]) {
        for (const child of [...node.children]) {
            if (!child.isValid) {
                continue;
            }

            if (prefixes.some((prefix) => child.name.startsWith(prefix))) {
                Tween.stopAllByTarget(child);
                const opacity = child.getComponent(UIOpacity);
                if (opacity) {
                    Tween.stopAllByTarget(opacity);
                }
                child.destroy();
                continue;
            }

            this.destroyEffectChildren(child, prefixes);
        }
    }

    private onTouchStart(event: EventTouch) {
        this.beginDrag(event.getLocation());
    }

    private onTouchMove(event: EventTouch) {
        this.moveDrag(event.getLocation());
    }

    private onTouchEnd() {
        this.endDrag();
    }

    private onMouseDown(event: EventMouse) {
        this.beginDrag(event.getLocation());
    }

    private onMouseMove(event: EventMouse) {
        this.moveDrag(event.getLocation());
    }

    private onMouseUp() {
        this.endDrag();
    }

    private beginDrag(screenPos: Vec2) {
        if (this.inputLocked) {
            return;
        }

        if (this.draggingBlock || this.draggingNode) {
            return;
        }

        if (!this.mainCamera) {
            console.error('Chua keo Main Camera vao PuzzleDragController');
            return;
        }

        this.syncFromBoardPreview();
        this.rebuildOccupied();

        const hitNode = this.raycastBlock(screenPos);
        if (!hitNode) {
            return;
        }

        const block = this.findDraggableBlock(hitNode);
        if (!block) {
            return;
        }

        this.startTimerForFirstDrag();

        // if (AudioManager.instance) AudioManager.instance.playBlockUp();

        this.draggingBlock = block;
        this.draggingNode = block.node;
        this.draggingStartCol = block.col;
        this.draggingStartRow = block.row;
        this.draggingCurrentCol = block.col;
        this.draggingCurrentRow = block.row;
        this.draggingBaseScale = this.getStableBaseScale(block.node);
        this.desiredDragPosition = null;
        this.removeBlockFromOccupied(block);

        const liftPos = this.gridToWorldForBlock(block, block.col, block.row);
        const grabWorld = this.screenToBoardWorld(screenPos);
        this.dragPointerOffset.set(0, 0, 0);
        if (grabWorld) {
            this.dragPointerOffset.set(grabWorld.x - liftPos.x, 0, grabWorld.z - liftPos.z);
        }

        const liftedScale = this.draggingBaseScale.clone().multiplyScalar(this.holdScaleMultiplier);
        this.desiredDragPosition = new Vec3(liftPos.x, this.blockY + this.getEffectiveDragLiftY(), liftPos.z);
        this.lastValidDragPosition = this.desiredDragPosition.clone();

        Tween.stopAllByTarget(this.draggingNode);
        this.draggingNode.setScale(this.draggingBaseScale);
        this.setBlockHighlight(this.draggingNode, true);
        tween(this.draggingNode)
            .to(this.pickupDuration, { scale: liftedScale }, { easing: 'quadOut' })
            .start();
    }

    private moveDrag(screenPos: Vec2) {
        if (!this.draggingBlock || !this.draggingNode || !this.mainCamera) {
            return;
        }

        const world = this.screenToBoardWorld(screenPos);
        if (!world) {
            return;
        }

        const blockCenterWorld = new Vec3(
            world.x - this.dragPointerOffset.x,
            this.blockY,
            world.z - this.dragPointerOffset.z,
        );
        const clampedWorld = this.clampWorldForBlock(this.draggingBlock, blockCenterWorld);
        const collisionWorld = this.clampDragWorldAgainstOccupied(this.draggingBlock, clampedWorld);
        const targetGrid = this.worldToPlacementGridForBlock(this.draggingBlock, collisionWorld);

        if (
            !this.canPlaceBlock(this.draggingBlock, targetGrid.col, targetGrid.row) ||
            !this.canReachGrid(targetGrid.col, targetGrid.row)
        ) {
            // Smoothly hold at the collision edge instead of snapping to cell center
            this.desiredDragPosition = new Vec3(collisionWorld.x, this.blockY + this.getEffectiveDragLiftY(), collisionWorld.z);
            return;
        }

        this.draggingCurrentCol = targetGrid.col;
        this.draggingCurrentRow = targetGrid.row;
        this.desiredDragPosition = new Vec3(collisionWorld.x, this.blockY + this.getEffectiveDragLiftY(), collisionWorld.z);
        this.lastValidDragPosition = this.desiredDragPosition.clone();
    }

    private endDrag() {
        if (!this.draggingBlock || !this.draggingNode) {
            return;
        }

        let finalCol = this.draggingCurrentCol;
        let finalRow = this.draggingCurrentRow;

        if (this.lastValidDragPosition) {
            const finalGrid = this.worldToPlacementGridForBlock(
                this.draggingBlock,
                new Vec3(this.lastValidDragPosition.x, this.blockY, this.lastValidDragPosition.z),
            );

            finalCol = finalGrid.col;
            finalRow = finalGrid.row;
        }

        if (!this.canPlaceBlock(this.draggingBlock, finalCol, finalRow)) {
            finalCol = this.draggingStartCol;
            finalRow = this.draggingStartRow;
        }

        const draggingBlock = this.draggingBlock;
        const draggingNode = this.draggingNode;
        const baseScale = this.draggingBaseScale || draggingNode.scale.clone();
        const targetPos = this.gridToWorldForBlock(draggingBlock, finalCol, finalRow);

        // if (AudioManager.instance) AudioManager.instance.playBlockDown();

        Tween.stopAllByTarget(draggingNode);
        this.desiredDragPosition = null;

        draggingBlock.setGridPosition(finalCol, finalRow);
        this.setBlockHighlight(draggingNode, false);
        const shatterStarted = this.wouldAssembleGroupAt(draggingBlock, finalCol, finalRow);
        if (shatterStarted) {
            this.checkAndShatterGroup(draggingBlock.colorGroup);
        } else {
            this.addBlockToOccupied(draggingBlock);
        }

        tween(draggingNode)
            .parallel(
                tween().to(this.snapDuration, { position: targetPos }, { easing: 'quadOut' }),
                tween().to(this.snapDuration, { scale: baseScale }, { easing: 'quadOut' }),
                tween().to(this.snapDuration, { eulerAngles: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
            )
            .call(() => {
                if (!shatterStarted) {
                    this.checkWin();
                }
            })
            .start();

        this.draggingBlock = null;
        this.draggingNode = null;
        this.draggingBaseScale = null;
        this.dragPointerOffset.set(0, 0, 0);
        this.desiredDragPosition = null;
        this.lastValidDragPosition = null;
    }

    private getStableBaseScale(node: Node): Vec3 {
        const cached = this.baseScales.get(node);
        if (cached) {
            return cached.clone();
        }

        const baseScale = node.scale.clone();
        this.baseScales.set(node, baseScale.clone());
        return baseScale;
    }

    private startTimerForFirstDrag() {
        if (!this.startTimerOnFirstDrag || this.hasStartedTimerForCurrentLevel) {
            return;
        }

        const hudNode = find('Canvas') || find('block/Canvas');
        const hud = hudNode?.getComponent('GameHUDController') as { startTimer?: () => void } | null;
        if (!hud?.startTimer) {
            return;
        }

        this.hasStartedTimerForCurrentLevel = true;
        hud.startTimer();
    }

    private raycastBlock(screenPos: Vec2): Node | null {
        if (!this.mainCamera) {
            return null;
        }

        const ray = new geometry.Ray();
        this.mainCamera.screenPointToRay(screenPos.x, screenPos.y, ray);

        if (!PhysicsSystem.instance.raycast(ray)) {
            return null;
        }

        let hitNode: Node | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (const result of PhysicsSystem.instance.raycastResults) {
            const block = this.findDraggableBlock(result.collider.node);
            if (!block || !this.isBlockBlocking(block) || !this.canPickBlockAtWorld(block, result.hitPoint)) {
                continue;
            }

            const distance = result.distance ?? Vec3.distance(ray.o, result.hitPoint);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                hitNode = result.collider.node;
            }
        }

        return hitNode;
    }

    private canPickBlockAtWorld(block: DraggableBlock, world: Vec3): boolean {
        const blockSize = this.getBlockSize(block);
        const blockCenter = this.gridToWorldForBlock(block, block.col, block.row);
        const localCol = (world.x - blockCenter.x) / this.cellStepX + (blockSize.cols - 1) * 0.5;
        const localRow = (world.z - blockCenter.z) / this.cellStepZ + (blockSize.rows - 1) * 0.5;
        const pickPadding = Math.max(0, this.pickHitPaddingCells);

        if (
            localCol < -0.5 - pickPadding ||
            localCol > blockSize.cols - 0.5 + pickPadding ||
            localRow < -0.5 - pickPadding ||
            localRow > blockSize.rows - 0.5 + pickPadding
        ) {
            return false;
        }

        if (this.isFullRectShape(block, blockSize)) {
            return true;
        }

        for (const cell of block.shape) {
            if (
                Math.abs(localCol - cell.x) <= 0.5 + pickPadding &&
                Math.abs(localRow - cell.y) <= 0.5 + pickPadding
            ) {
                return true;
            }
        }

        return false;
    }

    private isFullRectShape(block: DraggableBlock, blockSize: { cols: number; rows: number }): boolean {
        return block.shape.length === Math.max(1, blockSize.cols) * Math.max(1, blockSize.rows);
    }

    private hasShapeCell(block: DraggableBlock, col: number, row: number): boolean {
        for (const cell of block.shape) {
            if (cell.x === col && cell.y === row) {
                return true;
            }
        }

        return false;
    }

    private findDraggableBlock(node: Node): DraggableBlock | null {
        let current: Node | null = node;

        while (current) {
            const block = current.getComponent(DraggableBlock);
            if (block) {
                return block;
            }

            if (this.blocksRoot && current === this.blocksRoot) {
                return null;
            }

            current = current.parent;
        }

        return null;
    }

    private screenToBoardWorld(screenPos: Vec2): Vec3 | null {
        if (!this.mainCamera) {
            return null;
        }

        const ray = new geometry.Ray();
        this.mainCamera.screenPointToRay(screenPos.x, screenPos.y, ray);

        if (Math.abs(ray.d.y) < 0.0001) {
            return null;
        }

        const t = (this.blockY - ray.o.y) / ray.d.y;
        if (t < 0) {
            return null;
        }

        return new Vec3(
            ray.o.x + ray.d.x * t,
            this.blockY,
            ray.o.z + ray.d.z * t,
        );
    }

    private gridToWorld(col: number, row: number): Vec3 {
        const x = this.centerX + (col - (this.cols - 1) * 0.5) * this.cellStepX;
        const z = this.centerZ + (row - (this.rows - 1) * 0.5) * this.cellStepZ;

        return new Vec3(x, this.blockY, z);
    }

    private gridToWorldForBlock(block: DraggableBlock, col: number, row: number): Vec3 {
        const blockSize = this.getBlockSize(block);
        const centerCol = col + (blockSize.cols - 1) * 0.5;
        const centerRow = row + (blockSize.rows - 1) * 0.5;

        return this.gridToWorld(centerCol, centerRow);
    }

    private worldToGrid(x: number, z: number): { col: number; row: number } {
        const col = Math.round((x - this.centerX) / this.cellStepX + (this.cols - 1) * 0.5);
        const row = Math.round((z - this.centerZ) / this.cellStepZ + (this.rows - 1) * 0.5);

        return {
            col: Math.max(0, Math.min(this.cols - 1, col)),
            row: Math.max(0, Math.min(this.rows - 1, row)),
        };
    }

    private worldToGridForBlock(block: DraggableBlock, x: number, z: number): { col: number; row: number } {
        const blockSize = this.getBlockSize(block);
        const centerCol = (x - this.centerX) / this.cellStepX + (this.cols - 1) * 0.5;
        const centerRow = (z - this.centerZ) / this.cellStepZ + (this.rows - 1) * 0.5;

        return {
            col: Math.round(centerCol - (blockSize.cols - 1) * 0.5),
            row: Math.round(centerRow - (blockSize.rows - 1) * 0.5),
        };
    }

    private worldToPlacementGridForBlock(block: DraggableBlock, world: Vec3): { col: number; row: number } {
        return this.clampGridForBlock(block, this.worldToGridForBlock(block, world.x, world.z));
    }

    private getBlockSize(block: DraggableBlock): { cols: number; rows: number } {
        let maxCol = 0;
        let maxRow = 0;

        for (const cell of block.shape) {
            maxCol = Math.max(maxCol, cell.x);
            maxRow = Math.max(maxRow, cell.y);
        }

        return {
            cols: maxCol + 1,
            rows: maxRow + 1,
        };
    }

    private clampGridForBlock(block: DraggableBlock, grid: { col: number; row: number }): { col: number; row: number } {
        const blockSize = this.getBlockSize(block);
        const maxCol = Math.max(0, this.cols - blockSize.cols);
        const maxRow = Math.max(0, this.rows - blockSize.rows);

        return {
            col: Math.max(0, Math.min(maxCol, grid.col)),
            row: Math.max(0, Math.min(maxRow, grid.row)),
        };
    }

    private clampWorldForBlock(block: DraggableBlock, world: Vec3): Vec3 {
        const blockSize = this.getBlockSize(block);
        const topLeft = this.gridToWorldForBlock(block, 0, 0);
        const bottomRight = this.gridToWorldForBlock(
            block,
            Math.max(0, this.cols - blockSize.cols),
            Math.max(0, this.rows - blockSize.rows),
        );
        const minX = Math.min(topLeft.x, bottomRight.x);
        const maxX = Math.max(topLeft.x, bottomRight.x);
        const minZ = Math.min(topLeft.z, bottomRight.z);
        const maxZ = Math.max(topLeft.z, bottomRight.z);

        return new Vec3(
            Math.max(minX, Math.min(maxX, world.x)),
            this.blockY,
            Math.max(minZ, Math.min(maxZ, world.z)),
        );
    }

    private clampDragWorldAgainstOccupied(block: DraggableBlock, desiredWorld: Vec3): Vec3 {
        const previousWorld = this.lastValidDragPosition
            ? new Vec3(this.lastValidDragPosition.x, this.blockY, this.lastValidDragPosition.z)
            : this.gridToWorldForBlock(block, this.draggingCurrentCol, this.draggingCurrentRow);

        const directSweep = this.sweepToLastClearWorld(block, previousWorld, desiredWorld);
        if (this.sameWorldPosition(directSweep, desiredWorld)) {
            return desiredWorld.clone();
        }

        const candidates: Vec3[] = [
            directSweep,
        ];
        const xOnly = new Vec3(desiredWorld.x, this.blockY, previousWorld.z);
        const zOnly = new Vec3(previousWorld.x, this.blockY, desiredWorld.z);

        const xSweep = this.sweepToLastClearWorld(block, previousWorld, xOnly);
        if (this.sameWorldPosition(xSweep, xOnly)) {
            candidates.push(xOnly);
        } else {
            candidates.push(xSweep);
        }

        const zSweep = this.sweepToLastClearWorld(block, previousWorld, zOnly);
        if (this.sameWorldPosition(zSweep, zOnly)) {
            candidates.push(zOnly);
        } else {
            candidates.push(zSweep);
        }

        let best = previousWorld;
        let bestDistanceToDesired = Vec3.distance(previousWorld, desiredWorld);
        for (const candidate of candidates) {
            if (this.overlapsOccupiedCells(block, candidate)) {
                continue;
            }

            const distanceToDesired = Vec3.distance(candidate, desiredWorld);
            if (distanceToDesired < bestDistanceToDesired) {
                bestDistanceToDesired = distanceToDesired;
                best = candidate;
            }
        }

        return best.clone();
    }

    private sweepToLastClearWorld(block: DraggableBlock, fromWorld: Vec3, toWorld: Vec3): Vec3 {
        if (this.overlapsOccupiedCells(block, fromWorld)) {
            return fromWorld.clone();
        }

        const distance = Vec3.distance(fromWorld, toWorld);
        if (distance <= 0.0001) {
            return toWorld.clone();
        }

        const stepSize = Math.max(0.02, Math.min(this.cellStepX, this.cellStepZ) * 0.12);
        const steps = Math.max(2, Math.min(96, Math.ceil(distance / stepSize)));
        let lastClear = fromWorld.clone();
        let firstBlocked: Vec3 | null = null;

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const test = new Vec3(
                fromWorld.x + (toWorld.x - fromWorld.x) * t,
                this.blockY,
                fromWorld.z + (toWorld.z - fromWorld.z) * t,
            );

            if (this.overlapsOccupiedCells(block, test)) {
                firstBlocked = test;
                break;
            }

            lastClear = test;
        }

        if (!firstBlocked) {
            return toWorld.clone();
        }

        let low = 0;
        let high = 1;
        const result = lastClear.clone();

        for (let i = 0; i < 10; i++) {
            const mid = (low + high) * 0.5;
            const test = new Vec3(
                lastClear.x + (firstBlocked.x - lastClear.x) * mid,
                this.blockY,
                lastClear.z + (firstBlocked.z - lastClear.z) * mid,
            );

            if (this.overlapsOccupiedCells(block, test)) {
                high = mid;
            } else {
                low = mid;
                result.set(test.x, test.y, test.z);
            }
        }

        return result;
    }

    private sameWorldPosition(a: Vec3, b: Vec3): boolean {
        return Math.abs(a.x - b.x) <= 0.0001 && Math.abs(a.z - b.z) <= 0.0001;
    }

    private overlapsOccupiedCells(block: DraggableBlock, blockCenterWorld: Vec3): boolean {
        const blockSize = this.getBlockSize(block);
        const centerCol = (blockSize.cols - 1) * 0.5;
        const centerRow = (blockSize.rows - 1) * 0.5;
        const collisionFillRatio = this.getEffectiveDragCollisionFillRatio();
        const collisionWidth = this.cellStepX * collisionFillRatio;
        const collisionHeight = this.cellStepZ * collisionFillRatio;
        const cornerRadius = this.getEffectiveDragCollisionCornerRadius(collisionWidth, collisionHeight);

        for (const cell of block.shape) {
            const draggedCenterX = blockCenterWorld.x + (cell.x - centerCol) * this.cellStepX;
            const draggedCenterZ = blockCenterWorld.z + (cell.y - centerRow) * this.cellStepZ;

            for (const key of this.occupied.keys()) {
                const occupiedCell = this.parseKey(key);
                if (!occupiedCell) {
                    continue;
                }

                const occupiedWorld = this.gridToWorld(occupiedCell.col, occupiedCell.row);

                // Sử dụng va chạm dạng hình tròn (chặt góc) để dễ lách qua góc hơn
                if (this.roundedRectsOverlap(
                    draggedCenterX - occupiedWorld.x,
                    draggedCenterZ - occupiedWorld.z,
                    collisionWidth,
                    collisionHeight,
                    cornerRadius,
                )) {
                    return true;
                }
            }
        }

        return false;
    }

    private getEffectiveDragCollisionFillRatio(): number {
        return Math.max(0.92, Math.min(1.0, this.dragCollisionFillRatio));
    }

    private roundedRectsOverlap(dx: number, dz: number, width: number, height: number, cornerRadius: number): boolean {
        const summedHalfWidth = width;
        const summedHalfHeight = height;
        const summedRadius = Math.max(0, cornerRadius * 2);
        const innerHalfWidth = Math.max(0, summedHalfWidth - summedRadius);
        const innerHalfHeight = Math.max(0, summedHalfHeight - summedRadius);
        const qx = Math.abs(dx) - innerHalfWidth;
        const qz = Math.abs(dz) - innerHalfHeight;
        const outsideX = Math.max(qx, 0);
        const outsideZ = Math.max(qz, 0);
        const outsideDistance = Math.sqrt(outsideX * outsideX + outsideZ * outsideZ);
        const insideDistance = Math.min(Math.max(qx, qz), 0);

        return outsideDistance + insideDistance <= summedRadius;
    }

    private getEffectiveDragCollisionCornerRadius(width: number, height: number): number {
        const ratio = Math.max(0, Math.min(1.0, this.dragCollisionCornerRadiusRatio));
        return Math.min(width, height) * ratio * 0.5;
    }

    private parseKey(key: string): { col: number; row: number } | null {
        const parts = key.split('_');
        if (parts.length !== 2) {
            return null;
        }

        const col = Number(parts[0]);
        const row = Number(parts[1]);

        if (!Number.isFinite(col) || !Number.isFinite(row)) {
            return null;
        }

        return { col, row };
    }

    private canReachGrid(targetCol: number, targetRow: number): boolean {
        if (!this.draggingBlock) {
            return true;
        }

        if (targetCol === this.draggingCurrentCol && targetRow === this.draggingCurrentRow) {
            return true;
        }

        const queue: Array<{ col: number; row: number }> = [
            { col: this.draggingCurrentCol, row: this.draggingCurrentRow },
        ];
        const visited = new Set<string>([this.key(this.draggingCurrentCol, this.draggingCurrentRow)]);
        const dirs = [
            { col: 1, row: 0 },
            { col: -1, row: 0 },
            { col: 0, row: 1 },
            { col: 0, row: -1 },
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;

            for (const dir of dirs) {
                const next = this.clampGridForBlock(this.draggingBlock, {
                    col: current.col + dir.col,
                    row: current.row + dir.row,
                });
                const key = this.key(next.col, next.row);

                if (visited.has(key)) {
                    continue;
                }

                if (!this.canPlaceBlock(this.draggingBlock, next.col, next.row)) {
                    continue;
                }

                if (next.col === targetCol && next.row === targetRow) {
                    return true;
                }

                visited.add(key);
                queue.push(next);
            }
        }

        return false;
    }

    private holdAtCurrentReachableCell() {
        if (!this.draggingBlock || !this.draggingNode) {
            return;
        }

        this.desiredDragPosition = this.gridToLiftedWorldForBlock(
            this.draggingBlock,
            this.draggingCurrentCol,
            this.draggingCurrentRow,
        );
        this.lastValidDragPosition = this.desiredDragPosition.clone();
    }

    private gridToLiftedWorldForBlock(block: DraggableBlock, col: number, row: number): Vec3 {
        const currentPos = this.gridToWorldForBlock(block, col, row);
        return new Vec3(currentPos.x, this.blockY + this.getEffectiveDragLiftY(), currentPos.z);
    }

    private getEffectiveDragLiftY(): number {
        return Math.max(this.dragLiftY, 0.5);
    }

    private setBlockHighlight(node: Node, active: boolean) {
        if (!active) {
            if (this.outlineNode?.isValid) {
                this.outlineNode.destroy();
            }
            this.outlineNode = null;
            return;
        }

        if (this.outlineNode?.isValid) {
            this.outlineNode.destroy();
            this.outlineNode = null;
        }

        const source = this.getHighlightSourceChild(node);
        if (!source) {
            return;
        }

        const outline = instantiate(source);
        const outlineMaterial = new Material();

        outlineMaterial.reset({
            effectName: 'builtin-unlit',
            states: {
                priority: 254,
                primitive: gfx.PrimitiveMode.TRIANGLE_LIST,
                rasterizerState: {
                    cullMode: gfx.CullMode.FRONT,
                    depthBiasEnabled: true,
                    depthBias: this.outlineDepthBias,
                },
                depthStencilState: {
                    depthTest: true,
                    depthWrite: false,
                    depthFunc: gfx.ComparisonFunc.LESS,
                },
                blendState: {
                    targets: [
                        {
                            blend: true,
                            blendSrc: gfx.BlendFactor.SRC_ALPHA,
                            blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                            blendSrcAlpha: gfx.BlendFactor.SRC_ALPHA,
                            blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,
                        },
                    ],
                },
            },
        });

        try {
            outlineMaterial.setProperty('mainColor', this.holdHighlightColor);
            outlineMaterial.setProperty('albedo', this.holdHighlightColor);
        } catch {
            // Builtin materials may expose either mainColor or albedo depending on the active effect.
        }

        outline.name = '__DragOutlineMesh';
        outline.setParent(node);
        outline.setSiblingIndex(0);
        outline.setPosition(source.position.x, source.position.y + this.getEffectiveOutlineYOffset(), source.position.z);
        outline.setRotation(source.rotation);
        outline.setScale(source.scale.clone().multiplyScalar(this.outlineScaleMultiplier));

        for (const renderer of outline.getComponentsInChildren(MeshRenderer)) {
            renderer.material = outlineMaterial;
            renderer.priority = 254;
        }

        this.disableColliders(outline);

        this.outlineNode = outline;
    }

    private getEffectiveOutlineYOffset(): number {
        return Math.max(this.outlineYOffset, 0.055);
    }

    private disableColliders(node: Node) {
        for (const collider of node.getComponentsInChildren(BoxCollider)) {
            collider.enabled = false;
        }
    }

    private getHighlightSourceChild(node: Node): Node | null {
        for (const child of node.children) {
            if (
                child.name === '__DragOutline' ||
                child.name === 'ImageLayer' ||
                child.name === 'ImageBorder' ||
                child.name.startsWith('__CellCollider') ||
                child.name.startsWith('__PickCollider')
            ) {
                continue;
            }

            if (child.getComponentsInChildren(MeshRenderer).length > 0) {
                return child;
            }
        }

        return null;
    }

    private key(col: number, row: number): string {
        return `${col}_${row}`;
    }

    private addBlockToOccupied(block: DraggableBlock) {
        if (!this.isBlockBlocking(block)) {
            return;
        }

        for (const cell of block.shape) {
            this.occupied.set(this.key(block.col + cell.x, block.row + cell.y), block);
        }
    }

    private removeBlockFromOccupied(block: DraggableBlock) {
        for (const cell of block.shape) {
            this.occupied.delete(this.key(block.col + cell.x, block.row + cell.y));
        }
    }

    private isBlockBlocking(block: DraggableBlock): boolean {
        return block.enabled && (!block.colorGroup || !this.completedColorGroups.has(block.colorGroup));
    }

    private isGroupAssembled(groupBlocks: DraggableBlock[]): boolean {
        if (groupBlocks.length === 0) {
            return false;
        }

        const first = groupBlocks[0];
        const offsetX = first.col - first.targetCol;
        const offsetY = first.row - first.targetRow;

        for (let i = 1; i < groupBlocks.length; i++) {
            const block = groupBlocks[i];
            if (block.col - block.targetCol !== offsetX || block.row - block.targetRow !== offsetY) {
                return false;
            }
        }

        return true;
    }

    private wouldAssembleGroupAt(candidateBlock: DraggableBlock, candidateCol: number, candidateRow: number): boolean {
        if (!candidateBlock.colorGroup || !this.blocksRoot || this.completedColorGroups.has(candidateBlock.colorGroup)) {
            return false;
        }

        const groupBlocks = this.blocksRoot.children
            .map((child) => child.getComponent(DraggableBlock))
            .filter((block): block is DraggableBlock => !!block && block.colorGroup === candidateBlock.colorGroup);

        if (groupBlocks.length === 0) {
            return false;
        }

        const first = groupBlocks[0];
        const firstCol = first === candidateBlock ? candidateCol : first.col;
        const firstRow = first === candidateBlock ? candidateRow : first.row;
        const offsetX = firstCol - first.targetCol;
        const offsetY = firstRow - first.targetRow;

        for (let i = 1; i < groupBlocks.length; i++) {
            const block = groupBlocks[i];
            const col = block === candidateBlock ? candidateCol : block.col;
            const row = block === candidateBlock ? candidateRow : block.row;
            if (col - block.targetCol !== offsetX || row - block.targetRow !== offsetY) {
                return false;
            }
        }

        return true;
    }

    private checkAndShatterGroup(colorGroup: string): boolean {
        if (!colorGroup || this.completedColorGroups.has(colorGroup) || !this.blocksRoot) {
            return false;
        }

        const groupBlocks = this.blocksRoot.children
            .map((child) => child.getComponent(DraggableBlock))
            .filter((block): block is DraggableBlock => !!block && block.colorGroup === colorGroup);

        if (!this.isGroupAssembled(groupBlocks)) {
            return false;
        }

        this.completedColorGroups.add(colorGroup);

        const nodesToShatter: Node[] = [];

        for (const block of groupBlocks) {
            this.removeBlockFromOccupied(block);
            block.enabled = false;

            for (const collider of block.node.getComponentsInChildren(BoxCollider)) {
                collider.enabled = false;
            }

            nodesToShatter.push(block.node);
        }

        this.playGroupShatterAnimation(nodesToShatter, colorGroup);
        return true;
    }

    private playGroupShatterAnimation(nodes: Node[], colorGroup: string) {
        const validNodes = nodes.filter((node) => node.isValid);
        if (validNodes.length === 0) {
            return;
        }

        const generation = this.effectGeneration;

        // if (AudioManager.instance) AudioManager.instance.playBlockMatch();

        const spawner = this.node.getComponent(BlockSpawn);
        const fragmentColor = spawner ? spawner.getColorForGroup(colorGroup) : new Color(255, 255, 255, 255);

        const hudController = this.resolveHudController();
        const uiCamera = this.resolveUiCamera(hudController);

        const targetNode = hudController ? hudController.getTargetNodeForColorGroup(colorGroup) : null;

        const fragmentMaterial = new Material();
        fragmentMaterial.initialize({ effectName: 'builtin-standard' });
        try {
            fragmentMaterial.setProperty('albedo', fragmentColor);
            fragmentMaterial.setProperty('mainColor', fragmentColor);
            fragmentMaterial.setProperty('roughness', 0.35);
            fragmentMaterial.setProperty('metallic', 0);
        } catch { }

        const groupCenterWorld = this.getAverageWorldPosition(validNodes);
        const flyingImageSize = targetNode && this.mainCamera && uiCamera
            ? this.getGroupImageLayerUiSize(validNodes, this.mainCamera, uiCamera, targetNode.parent)
            : null;
        const groupTexture = spawner?.getTextureForGroup(colorGroup) || null;
        const fullFlyingImage = groupTexture && targetNode && this.mainCamera && uiCamera
            ? this.createFullGroupFlyingImage(
                groupTexture,
                groupCenterWorld,
                flyingImageSize,
                targetNode,
                this.mainCamera,
                uiCamera,
            )
            : null;
        const flyingImageOpacity = fullFlyingImage?.getComponent(UIOpacity) || fullFlyingImage?.addComponent(UIOpacity) || null;
        if (flyingImageOpacity) {
            flyingImageOpacity.opacity = 0;
        }

        this.playGroupCompletionFlash(validNodes, fragmentColor, fullFlyingImage, () => {
            if (generation !== this.effectGeneration) {
                if (fullFlyingImage?.isValid) {
                    fullFlyingImage.destroy();
                }
                return;
            }

            // Check win right when the image starts flying to target
            this.checkWin(validNodes);

            // if (AudioManager.instance) AudioManager.instance.playBlockBreak();

            const zeroScale = new Vec3(0.001, 0.001, 0.001);
            let destroyedCount = 0;
            let imageFlyCount = 0;
            let completedImageFlyCount = 0;
            let hasPlayedTargetEffect = false;

            const tryCompleteGroupEffect = () => {
                if (
                    generation !== this.effectGeneration ||
                    destroyedCount < validNodes.length ||
                    completedImageFlyCount < imageFlyCount ||
                    hasPlayedTargetEffect
                ) {
                    return;
                }

                hasPlayedTargetEffect = true;
                if (hudController) {
                    hudController.playTargetCollectedEffect(colorGroup);
                }
            };

            const onBlockDestroyed = () => {
                if (generation !== this.effectGeneration) {
                    return;
                }

                destroyedCount++;
                tryCompleteGroupEffect();
            };

            const onImageFlyComplete = () => {
                if (generation !== this.effectGeneration) {
                    return;
                }

                completedImageFlyCount++;
                tryCompleteGroupEffect();
            };

            if (fullFlyingImage && targetNode) {
                imageFlyCount++;
                this.flyUiImageToTarget(fullFlyingImage, targetNode, onImageFlyComplete, fragmentColor);
            }

            const starCountPerNode = Math.max(10, Math.floor(80 / validNodes.length));

            for (const node of validNodes) {
                Tween.stopAllByTarget(node);

                const originalChildren = [...node.children];
                for (const child of originalChildren) {
                    if (child.name === 'ImageLayer' || child.name === 'ImageBorder') {
                        if (child.isValid) {
                            child.destroy();
                        }
                    }
                }

                this.spawnShatterFragments(node, fragmentMaterial);
                this.spawnWorldShatterStars(node, starCountPerNode, fragmentColor, false);

                tween(node)
                    .to(Math.max(0, this.shatterShrinkDuration), { scale: zeroScale }, { easing: 'backIn' })
                    .call(() => {
                        if (node.isValid) {
                            node.destroy();
                        }
                        onBlockDestroyed();
                    })
                    .start();
            }
        });
    }

    private _shatterMeshVariants: any[] | null = null;
    private getShatterMeshVariants(): any[] {
        if (!this._shatterMeshVariants) {
            this._shatterMeshVariants = [
                utils.createMesh(primitives.box({ width: 1, height: 1, length: 1 })),
                utils.createMesh(primitives.box({ width: 1.25, height: 0.8, length: 0.9 })),
                utils.createMesh(primitives.box({ width: 0.8, height: 1.2, length: 1 })),
            ];
        }
        return this._shatterMeshVariants;
    }

    private spawnShatterFragments(blockNode: Node, mat: Material) {
        if (!mat) {
            console.error("Shatter material is null");
            return;
        }
        const baseSize = Math.max(0.03, this.shatterFragmentSize);
        const meshVariants = this.getShatterMeshVariants();
        const fragmentCount = Math.max(1, Math.floor(this.shatterFragmentCount));
        const origin = blockNode.position.clone();
        const boardDown = this.getBoardDownDirection();
        const offscreenBoardDistance = this.getFragmentOffscreenBoardDistance();

        for (let i = 0; i < fragmentCount; i++) {
            const fragment = this.getFragmentNode(mat, meshVariants[i % meshVariants.length]);
            console.log("Material:", mat);
            console.log("Mesh:", meshVariants[i % meshVariants.length]);

            fragment.setParent(blockNode.parent);

            const startPos = origin.clone();
            startPos.x += (Math.random() - 0.5) * this.cellStepX * 0.7;
            startPos.y += 0.18 + Math.random() * 0.18;
            startPos.z += (Math.random() - 0.5) * this.cellStepZ * 0.7;
            fragment.setPosition(startPos);

            const scaleAmount = baseSize * (0.65 + Math.random() * 0.9);
            fragment.setScale(new Vec3(
                scaleAmount * (0.75 + Math.random() * 0.55),
                scaleAmount * (0.75 + Math.random() * 0.55),
                scaleAmount * (0.75 + Math.random() * 0.55),
            ));

            fragment.setRotationFromEuler(Math.random() * 360, Math.random() * 360, Math.random() * 360);

            const angle = Math.random() * Math.PI * 2;
            const distance = this.shatterFragmentSpread * (0.35 + Math.random() * 0.75);
            const burstPos = new Vec3(
                startPos.x + Math.cos(angle) * distance,
                startPos.y + this.shatterFragmentRise * (0.55 + Math.random() * 0.65),
                startPos.z + Math.sin(angle) * distance,
            );
            const fallDistance = Math.max(
                this.shatterFragmentFall * (0.65 + Math.random() * 0.55),
                offscreenBoardDistance,
            );
            const fallPos = new Vec3(
                burstPos.x + boardDown.x * fallDistance,
                burstPos.y - Math.max(0, this.shatterFragmentVerticalDrop) * (0.65 + Math.random() * 0.55),
                burstPos.z + boardDown.z * fallDistance,
            );

            const endEuler = fragment.eulerAngles.clone();
            endEuler.x += (Math.random() - 0.5) * 1080;
            endEuler.y += (Math.random() - 0.5) * 1080;
            endEuler.z += (Math.random() - 0.5) * 1080;

            const burstDuration = Math.max(0.01, this.shatterFragmentBurstDuration) * (0.8 + Math.random() * 0.4);
            const fallDuration = Math.max(0.01, this.shatterFragmentFallDuration) * (0.85 + Math.random() * 0.35);
            const vanishScale = new Vec3(0.001, 0.001, 0.001);

            tween(fragment)
                .to(burstDuration, { position: burstPos }, { easing: 'quadOut' })
                .parallel(
                    tween().to(fallDuration, { position: fallPos }, { easing: 'quadIn' }),
                    tween().to(fallDuration, { eulerAngles: endEuler }, { easing: 'linear' }),
                    tween().delay(fallDuration * 0.55).to(fallDuration * 0.45, { scale: vanishScale }, { easing: 'quadIn' }),
                )
                .call(() => {
                    this.returnFragmentNode(fragment);
                })
                .start();
        }
    }

    private playGroupCompletionFlash(sourceNodes: Node[], tint: Color, ghostImage: Node | null, onComplete: () => void) {
        const validSources = sourceNodes.filter((node) => node.isValid);
        if (validSources.length === 0) {
            onComplete();
            return;
        }

        if (ghostImage?.isValid) {
            const opacity = ghostImage.getComponent(UIOpacity) || ghostImage.addComponent(UIOpacity);
            tween(opacity)
                .to(0.05, { opacity: 135 }, { easing: 'quadOut' })
                .to(0.08, { opacity: 92 }, { easing: 'quadInOut' })
                .start();
        }

        for (const node of validSources) {
            const block = node.getComponent(DraggableBlock);
            if (!block) {
                this.spawnWorldShatterStars(node, 1, tint, true);
                continue;
            }

            for (const cell of block.shape) {
                const cellWorld = this.gridToWorld(block.col + cell.x, block.row + cell.y);
                this.spawnWorldSparkleAt(cellWorld, tint, 'flare');
            }
        }

        this.scheduleOnce(onComplete, 0.06);
    }

    private spawnWorldSparkleAt(worldPosition: Vec3, tint: Color, type: SparkleType) {
        const hudController = this.resolveHudController();
        const uiCamera = this.resolveUiCamera(hudController);
        if (!this.mainCamera || !uiCamera || !hudController) {
            return;
        }

        const uiParent = hudController.node;
        const screenPos = new Vec3();
        this.mainCamera.worldToScreen(worldPosition, screenPos);

        const uiWorldPos = new Vec3();
        uiCamera.screenToWorld(screenPos, uiWorldPos);

        const uiLocalPos = new Vec3();
        uiParent.inverseTransformPoint(uiLocalPos, uiWorldPos);

        const tempNode = new Node('__TempCellFlareSource');
        tempNode.setParent(uiParent);
        tempNode.setPosition(uiLocalPos);
        tempNode.layer = uiParent.layer;

        this.spawnUiSparkleAt(tempNode, true, type, tint, true);
        tempNode.destroy();
    }

    private spawnWorldShatterStars(sourceNode: Node, count: number = 70, tint?: Color, flareOnly: boolean = false) {
        const hudController = this.resolveHudController();
        const uiCamera = this.resolveUiCamera(hudController);
        if (!this.mainCamera || !uiCamera || !hudController) {
            return;
        }

        const uiParent = hudController.node;
        if (!uiParent) return;

        const screenPos = new Vec3();
        this.mainCamera.worldToScreen(sourceNode.worldPosition, screenPos);

        const uiWorldPos = new Vec3();
        uiCamera.screenToWorld(screenPos, uiWorldPos);

        const uiLocalPos = new Vec3();
        uiParent.inverseTransformPoint(uiLocalPos, uiWorldPos);

        const tempNode = new Node('__TempShatterStarSource');
        tempNode.setParent(uiParent);
        tempNode.setPosition(uiLocalPos);
        tempNode.layer = uiParent.layer;

        for (let i = 0; i < count; i++) {
            const rand = Math.random();
            const type: SparkleType = flareOnly
                ? (rand < 0.72 ? 'flare' : 'spot')
                : (rand < 0.18 ? 'star' : (rand < 0.52 ? 'spot' : 'bubble'));
            this.spawnUiSparkleAt(tempNode, true, type, tint);
        }

        tempNode.destroy();
    }

    private getBoardDownDirection(): Vec3 {
        if (!this.mainCamera) {
            return new Vec3(0, 0, 1);
        }

        const visibleSize = view.getVisibleSize();
        const centerScreen = new Vec3(visibleSize.width * 0.5, visibleSize.height * 0.5, 0);
        const downScreen = new Vec3(
            centerScreen.x,
            centerScreen.y - Math.min(160, Math.max(32, visibleSize.height * 0.2)),
            0,
        );
        const centerWorld = this.screenToWorldOnY(this.mainCamera, centerScreen, this.blockY);
        const downWorld = this.screenToWorldOnY(this.mainCamera, downScreen, this.blockY);

        if (!centerWorld || !downWorld) {
            return new Vec3(0, 0, 1);
        }

        const direction = new Vec3(downWorld.x - centerWorld.x, 0, downWorld.z - centerWorld.z);
        const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        if (length < 0.0001) {
            return new Vec3(0, 0, 1);
        }

        direction.x /= length;
        direction.z /= length;
        return direction;
    }

    private getFragmentOffscreenBoardDistance(): number {
        return Math.max(3, this.shatterFragmentFall + this.shatterFragmentOffscreenPadding);
    }

    private resolveHudController(): GameController | null {
        const canvas = find('Canvas') || find('block/Canvas');
        return canvas?.getComponent(GameController) || null;
    }

    private resolveUiCamera(hudController: GameController | null): Camera | null {
        const hudNode = hudController?.node || find('Canvas') || find('block/Canvas');
        return (
            hudNode?.getChildByName('Camera')?.getComponent(Camera) ||
            find('Canvas/Camera')?.getComponent(Camera) ||
            find('block/Canvas/Camera')?.getComponent(Camera) ||
            null
        );
    }

    private getAverageWorldPosition(nodes: Node[]): Vec3 {
        const center = new Vec3();
        if (nodes.length === 0) {
            return center;
        }

        for (const node of nodes) {
            center.x += node.worldPosition.x;
            center.y += node.worldPosition.y;
            center.z += node.worldPosition.z;
        }

        center.multiplyScalar(1 / nodes.length);
        return center;
    }

    private createFullGroupFlyingImage(
        texture: Texture2D | null,
        sourceWorldPosition: Vec3,
        screenSize: { width: number; height: number } | null,
        targetNode: Node,
        mainCamera: Camera,
        uiCamera: Camera,
    ): Node | null {
        if (!texture || !targetNode.parent) {
            return null;
        }

        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;

        const imageNode = new Node(`FlyingImage_${targetNode.name}`);
        imageNode.setParent(targetNode.parent);
        imageNode.layer = targetNode.layer;
        imageNode.setSiblingIndex(targetNode.parent.children.length - 1);

        const transform = imageNode.addComponent(UITransform);
        const maxSize = Math.max(1, this.flyingImageSize);
        const textureWidth = Math.max(1, texture.width || maxSize);
        const textureHeight = Math.max(1, texture.height || maxSize);
        const aspect = textureWidth / textureHeight;
        const measuredWidth = screenSize?.width || 0;
        const measuredHeight = screenSize?.height || 0;
        const measuredMax = Math.max(measuredWidth, measuredHeight);
        const targetMax = measuredMax > 1 ? measuredMax : maxSize;
        const width = aspect >= 1 ? targetMax : targetMax * aspect;
        const height = aspect >= 1 ? targetMax / aspect : targetMax;
        const sprite = imageNode.addComponent(Sprite);
        sprite.spriteFrame = spriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        transform.setContentSize(width, height);

        const startScreenPosition = new Vec3();
        mainCamera.worldToScreen(sourceWorldPosition, startScreenPosition);

        const targetScreenPosition = new Vec3();
        uiCamera.worldToScreen(targetNode.worldPosition, targetScreenPosition);
        startScreenPosition.z = targetScreenPosition.z;

        const startUiWorldPosition = new Vec3();
        uiCamera.screenToWorld(startScreenPosition, startUiWorldPosition);

        const startLocalPosition = new Vec3();
        targetNode.parent.inverseTransformPoint(startLocalPosition, startUiWorldPosition);
        imageNode.setPosition(startLocalPosition);

        return imageNode;
    }

    private getGroupImageLayerUiSize(
        nodes: Node[],
        mainCamera: Camera | null,
        uiCamera: Camera,
        uiParent: Node | null,
    ): { width: number; height: number } | null {
        if (!mainCamera || !uiParent) {
            return null;
        }

        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const node of nodes) {
            const imageLayer = node.getChildByName('ImageLayer');
            if (!imageLayer || !imageLayer.isValid) {
                continue;
            }

            const worldCorners = this.getImageLayerWorldCorners(imageLayer);
            for (const worldCorner of worldCorners) {
                const screenCorner = new Vec3();
                mainCamera.worldToScreen(worldCorner, screenCorner);

                const uiWorldCorner = new Vec3();
                uiCamera.screenToWorld(screenCorner, uiWorldCorner);

                const uiLocalCorner = new Vec3();
                uiParent.inverseTransformPoint(uiLocalCorner, uiWorldCorner);

                minX = Math.min(minX, uiLocalCorner.x);
                minY = Math.min(minY, uiLocalCorner.y);
                maxX = Math.max(maxX, uiLocalCorner.x);
                maxY = Math.max(maxY, uiLocalCorner.y);
            }
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return null;
        }

        return {
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
        };
    }

    private getImageLayerWorldCorners(imageLayer: Node): Vec3[] {
        const renderer = imageLayer.getComponent(MeshRenderer);
        const bounds = renderer?.model?.worldBounds;
        if (bounds) {
            const center = bounds.center;
            const half = bounds.halfExtents;

            return [
                new Vec3(center.x - half.x, center.y - half.y, center.z - half.z),
                new Vec3(center.x + half.x, center.y - half.y, center.z - half.z),
                new Vec3(center.x + half.x, center.y + half.y, center.z + half.z),
                new Vec3(center.x - half.x, center.y + half.y, center.z + half.z),
            ];
        }

        const size = this.getImageLayerLocalSize(imageLayer);
        const halfWidth = size.width * 0.5;
        const halfHeight = size.height * 0.5;
        const localCorners = [
            new Vec3(-halfWidth, -halfHeight, 0),
            new Vec3(halfWidth, -halfHeight, 0),
            new Vec3(halfWidth, halfHeight, 0),
            new Vec3(-halfWidth, halfHeight, 0),
        ];

        return localCorners.map((localCorner) => {
            const worldCorner = new Vec3();
            const uiTrans = imageLayer.getComponent(UITransform);
            if (uiTrans) {
                uiTrans.convertToWorldSpaceAR(localCorner, worldCorner);
            } else {
                // Fallback: approximate by adding local offset to node world position
                imageLayer.getWorldPosition(worldCorner);
                worldCorner.add(localCorner);
            }
            return worldCorner;
        });
    }

    private getImageLayerLocalSize(imageLayer: Node): { width: number; height: number } {
        const transform = imageLayer.getComponent(UITransform);
        if (transform) {
            return {
                width: Math.max(1, transform.contentSize.width),
                height: Math.max(1, transform.contentSize.height),
            };
        }

        return {
            width: Math.max(1, Math.abs(imageLayer.scale.x)),
            height: Math.max(1, Math.abs(imageLayer.scale.y)),
        };
    }

    private flyImageToTarget(
        imageLayer: Node,
        targetNode: Node,
        mainCamera: Camera,
        uiCamera: Camera | null,
        onComplete: () => void,
        tint?: Color,
    ) {
        if (uiCamera && targetNode.parent && this.prepareImageLayerForUiFlight(imageLayer, targetNode, mainCamera, uiCamera)) {
            this.flyUiImageToTarget(imageLayer, targetNode, onComplete, tint);
            return;
        }

        const targetWorldPos = targetNode.worldPosition;
        const screenPos = new Vec3();
        if (uiCamera) {
            uiCamera.worldToScreen(targetWorldPos, screenPos);
        } else {
            screenPos.set(targetWorldPos.x, targetWorldPos.y, targetWorldPos.z);
        }

        const startWorldPos = imageLayer.worldPosition.clone();
        const flyPlaneY = startWorldPos.y + 0.65;
        const targetWorldOnPlane = this.screenToWorldOnY(mainCamera, screenPos, flyPlaneY);
        if (!targetWorldOnPlane) {
            this.flyImageUpFallback(imageLayer, onComplete, tint);
            return;
        }

        imageLayer.setWorldPosition(startWorldPos);
        const parent = imageLayer.parent;
        if (!parent) {
            this.flyImageUpFallback(imageLayer, onComplete, tint);
            return;
        }

        const targetLocalPosition = new Vec3();
        parent.inverseTransformPoint(targetLocalPosition, targetWorldOnPlane);

        const duration = Math.max(0.1, this.imageFlyDuration);
        const liftDuration = Math.max(0.01, this.imageLiftDuration);
        const liftedPosition = imageLayer.position.clone();
        liftedPosition.y += Math.max(0, this.imageLiftHeight);
        const targetScale = imageLayer.scale.clone().multiplyScalar(0.25);
        const glowNode = this.createFlyingImageGlow(imageLayer, tint);
        const stopTrail = this.startFlyingImageStarTrail(imageLayer, liftDuration + duration, tint);

        const flyProgress = { t: 0 };
        tween(flyProgress)
            .delay(liftDuration)
            .to(duration, { t: 1 }, {
                easing: 'quadInOut',
                onUpdate: () => {
                    if (!imageLayer.isValid) return;
                    let dynTargetLocal = targetLocalPosition.clone();
                    const dynTargetWorld = targetNode.worldPosition;
                    const dynScreenPos = new Vec3();
                    if (uiCamera) {
                        uiCamera.worldToScreen(dynTargetWorld, dynScreenPos);
                    } else {
                        dynScreenPos.set(dynTargetWorld.x, dynTargetWorld.y, dynTargetWorld.z);
                    }
                    const dynWorldOnPlane = this.screenToWorldOnY(mainCamera, dynScreenPos, flyPlaneY);
                    if (dynWorldOnPlane && parent) {
                        parent.inverseTransformPoint(dynTargetLocal, dynWorldOnPlane);
                    }
                    const curPos = new Vec3();
                    Vec3.lerp(curPos, liftedPosition, dynTargetLocal, flyProgress.t);
                    imageLayer.setPosition(curPos);
                    if (glowNode && glowNode.isValid) glowNode.setPosition(curPos);
                }
            })
            .start();

        tween(imageLayer)
            .parallel(
                tween().to(liftDuration, { position: liftedPosition }, { easing: 'quadOut' }),
                glowNode
                    ? tween(glowNode).to(liftDuration, { position: liftedPosition }, { easing: 'quadOut' })
                    : tween(),
            )
            .parallel(
                tween().to(duration, { scale: targetScale }, { easing: 'quadInOut' }),
                glowNode
                    ? tween(glowNode)
                        .to(duration, { scale: targetScale.clone().multiplyScalar(this.imageGlowScaleMultiplier) }, { easing: 'quadInOut' })
                    : tween(),
            )
            .delay(Math.max(0, this.imageTargetHoldDuration))
            .call(() => {
                stopTrail();
                if (glowNode?.isValid) glowNode.destroy();
                if (imageLayer.isValid) imageLayer.destroy();
                onComplete();
            })
            .start();
    }

    private prepareImageLayerForUiFlight(
        imageLayer: Node,
        targetNode: Node,
        mainCamera: Camera,
        uiCamera: Camera,
    ): boolean {
        if (!targetNode.parent) {
            return false;
        }

        const startScreenPos = new Vec3();
        mainCamera.worldToScreen(imageLayer.worldPosition, startScreenPos);

        const targetScreenPos = new Vec3();
        uiCamera.worldToScreen(targetNode.worldPosition, targetScreenPos);
        startScreenPos.z = targetScreenPos.z;

        const startUiWorldPos = new Vec3();
        uiCamera.screenToWorld(startScreenPos, startUiWorldPos);

        const startUiLocalPos = new Vec3();
        targetNode.parent.inverseTransformPoint(startUiLocalPos, startUiWorldPos);

        const worldRotation = imageLayer.worldRotation.clone();
        imageLayer.setParent(targetNode.parent);
        imageLayer.setPosition(startUiLocalPos);
        imageLayer.setWorldRotation(worldRotation);
        imageLayer.setScale(imageLayer.scale.clone().multiplyScalar(Math.max(1, this.imageUiScaleMultiplier)));
        imageLayer.setSiblingIndex(targetNode.parent.children.length - 1);
        this.setLayerRecursive(imageLayer, targetNode.layer);

        return true;
    }

    private flyUiImageToTarget(imageLayer: Node, targetNode: Node, onComplete: () => void, tint?: Color) {
        if (!targetNode.parent) {
            this.flyImageUpFallback(imageLayer, onComplete, tint);
            return;
        }

        const opacity = imageLayer.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 255;
        }

        const targetPosition = this.getUiTargetVisualCenterLocal(targetNode);
        const currentScale = imageLayer.scale.clone();
        const popStartScale = currentScale.clone().multiplyScalar(Math.max(0.05, this.imagePopStartScale));
        imageLayer.setScale(popStartScale);

        const liftedPosition = imageLayer.position.clone();
        liftedPosition.y += Math.max(0, this.imageLiftHeight) * 90;
        const flyDuration = Math.max(0.1, this.imageFlyDuration);
        const liftDuration = Math.min(Math.max(0.01, this.imageLiftDuration), flyDuration * 0.18);

        const targetScale = currentScale.clone().multiplyScalar(0.25);
        const glowNode = this.createFlyingImageGlow(imageLayer, tint);
        if (glowNode) {
            glowNode.setScale(popStartScale.clone().multiplyScalar(this.imageGlowScaleMultiplier));
        }
        this.playImageLaunchBurst(imageLayer, tint);
        const stopTrail = this.startFlyingImageStarTrail(
            imageLayer,
            liftDuration + flyDuration,
            tint,
        );

        const flyProgress = { t: 0 };
        tween(flyProgress)
            .delay(liftDuration)
            .to(flyDuration, { t: 1 }, {
                easing: 'sineInOut',
                onUpdate: () => {
                    if (!imageLayer.isValid) return;
                    const dynamicTargetPos = this.getUiTargetVisualCenterLocal(targetNode);
                    const curPos = new Vec3();
                    Vec3.lerp(curPos, liftedPosition, dynamicTargetPos, flyProgress.t);
                    imageLayer.setPosition(curPos);
                    if (glowNode && glowNode.isValid) glowNode.setPosition(curPos);
                }
            })
            .start();

        tween(imageLayer)
            .parallel(
                tween().to(liftDuration, { position: liftedPosition }, { easing: 'quadOut' }),
                tween().to(liftDuration, { scale: currentScale }, { easing: 'quadOut' }),
                glowNode
                    ? tween(glowNode).to(
                        liftDuration,
                        {
                            position: liftedPosition,
                            scale: currentScale.clone().multiplyScalar(this.imageGlowScaleMultiplier),
                        },
                        { easing: 'quadOut' },
                    )
                    : tween(),
            )
            .parallel(
                tween().to(flyDuration, { scale: targetScale }, { easing: 'sineInOut' }),
                glowNode
                    ? tween(glowNode)
                        .to(flyDuration, { scale: targetScale.clone().multiplyScalar(this.imageGlowScaleMultiplier) }, { easing: 'sineInOut' })
                    : tween(),
            )
            .delay(Math.max(0, this.imageTargetHoldDuration))
            .call(() => {
                stopTrail();
                if (glowNode?.isValid) glowNode.destroy();
                if (imageLayer.isValid) imageLayer.destroy();
                onComplete();
            })
            .start();
    }

    private getUiTargetVisualCenterLocal(targetNode: Node): Vec3 {
        const parent = targetNode.parent;
        if (!parent) {
            return targetNode.position.clone();
        }

        const visibleChildren = targetNode.children.filter((child) => child.isValid && child.active);
        if (visibleChildren.length === 0) {
            return targetNode.position.clone();
        }

        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        const corners = [
            new Vec3(),
            new Vec3(),
            new Vec3(),
            new Vec3(),
        ];

        for (const child of visibleChildren) {
            const transform = child.getComponent(UITransform);
            if (!transform) {
                continue;
            }

            this.getUiTransformWorldCorners(transform, corners);
            for (const corner of corners) {
                const local = new Vec3();
                parent.inverseTransformPoint(local, corner);
                minX = Math.min(minX, local.x);
                minY = Math.min(minY, local.y);
                maxX = Math.max(maxX, local.x);
                maxY = Math.max(maxY, local.y);
            }
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return targetNode.position.clone();
        }

        return new Vec3((minX + maxX) * 0.5, (minY + maxY) * 0.5, targetNode.position.z);
    }

    private getUiTransformWorldCorners(transform: UITransform, outCorners: Vec3[]) {
        const node = transform.node;
        const width = transform.contentSize.width;
        const height = transform.contentSize.height;
        const anchorX = transform.anchorX;
        const anchorY = transform.anchorY;
        const localCorners = [
            new Vec3(-anchorX * width, -anchorY * height, 0),
            new Vec3((1 - anchorX) * width, -anchorY * height, 0),
            new Vec3((1 - anchorX) * width, (1 - anchorY) * height, 0),
            new Vec3(-anchorX * width, (1 - anchorY) * height, 0),
        ];

        for (let i = 0; i < localCorners.length; i++) {
            const converter = node as unknown as {
                convertToWorldSpaceAR?: (local: Vec3) => Vec3;
            };

            if (converter.convertToWorldSpaceAR) {
                outCorners[i].set(converter.convertToWorldSpaceAR(localCorners[i]));
            } else {
                const world = node.worldPosition;
                outCorners[i].set(
                    world.x + localCorners[i].x * node.worldScale.x,
                    world.y + localCorners[i].y * node.worldScale.y,
                    world.z + localCorners[i].z * node.worldScale.z,
                );
            }
        }
    }

    private flyImageUpFallback(imageLayer: Node, onComplete: () => void, tint?: Color) {
        const opacity = imageLayer.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 255;
        }

        const liftedPosition = imageLayer.position.clone();
        liftedPosition.y += Math.max(0, this.imageLiftHeight);

        const targetPosition = imageLayer.position.clone();
        targetPosition.z += 2.4;
        targetPosition.y += Math.max(0.65, this.imageLiftHeight);
        const glowNode = this.createFlyingImageGlow(imageLayer, tint);
        const currentScale = imageLayer.scale.clone();
        const popStartScale = currentScale.clone().multiplyScalar(Math.max(0.05, this.imagePopStartScale));
        imageLayer.setScale(popStartScale);
        if (glowNode) {
            glowNode.setScale(popStartScale.clone().multiplyScalar(this.imageGlowScaleMultiplier));
        }
        this.playImageLaunchBurst(imageLayer, tint);
        const targetScale = currentScale.clone().multiplyScalar(0.25);
        const stopTrail = this.startFlyingImageStarTrail(
            imageLayer,
            Math.max(0.01, this.imageLiftDuration) + Math.max(0.1, this.imageFlyDuration),
            tint,
        );

        tween(imageLayer)
            .parallel(
                tween().to(Math.max(0.01, this.imageLiftDuration), { position: liftedPosition }, { easing: 'quadOut' }),
                tween().to(Math.max(0.01, this.imageLiftDuration), { scale: currentScale }, { easing: 'backOut' }),
                glowNode
                    ? tween(glowNode).to(
                        Math.max(0.01, this.imageLiftDuration),
                        {
                            position: liftedPosition,
                            scale: currentScale.clone().multiplyScalar(this.imageGlowScaleMultiplier),
                        },
                        { easing: 'backOut' },
                    )
                    : tween(),
            )
            .parallel(
                tween().to(Math.max(0.1, this.imageFlyDuration), { position: targetPosition }, { easing: 'quadInOut' }),
                tween().to(Math.max(0.1, this.imageFlyDuration), { scale: targetScale }, { easing: 'quadInOut' }),
                glowNode
                    ? tween(glowNode)
                        .to(Math.max(0.1, this.imageFlyDuration), { position: targetPosition, scale: targetScale.clone().multiplyScalar(this.imageGlowScaleMultiplier) }, { easing: 'quadInOut' })
                    : tween(),
            )
            .delay(Math.max(0, this.imageTargetHoldDuration))
            .call(() => {
                stopTrail();
                if (glowNode?.isValid) glowNode.destroy();
                if (imageLayer.isValid) imageLayer.destroy();
                onComplete();
            })
            .start();
    }

    private createFlyingImageGlow(imageLayer: Node, tint?: Color): Node | null {
        return null;
    }

    private playImageLaunchBurst(imageLayer: Node, tint?: Color) {
        for (let i = 0; i < 28; i++) {
            const rand = Math.random();
            const type: SparkleType = rand < 0.35 ? 'star' : 'spot';
            this.spawnUiSparkleAt(imageLayer, true, type, tint);
        }
    }

    private drawSoftGlow(graphics: Graphics, size: number, tint?: Color) {
        graphics.clear();
        const color = tint || new Color(110, 225, 255, 255);

        graphics.fillColor = new Color(color.r, color.g, color.b, 42);
        graphics.circle(0, 0, size * 0.5);
        graphics.fill();

        graphics.fillColor = this.mixColor(color, new Color(255, 255, 255, 255), 0.45, 68);
        graphics.circle(0, 0, size * 0.34);
        graphics.fill();

        graphics.fillColor = this.mixColor(color, new Color(255, 255, 255, 255), 0.78, 100);
        graphics.circle(0, 0, size * 0.18);
        graphics.fill();
    }

    private startFlyingImageStarTrail(imageLayer: Node, totalDuration: number, tint?: Color): () => void {
        const interval = Math.max(0.016, this.imageStarTrailInterval);
        let elapsed = 0;

        const emitTrail = () => {
            if (!imageLayer.isValid) {
                this.unschedule(emitTrail);
                return;
            }

            elapsed += interval;
            const count = elapsed < totalDuration ? 7 : 2;
            for (let i = 0; i < count; i++) {
                const rand = Math.random();
                const type: SparkleType = rand < 0.45 ? 'star' : 'spot';
                this.spawnUiSparkleAt(imageLayer, false, type, tint);
            }
        };

        emitTrail();
        this.schedule(emitTrail, interval);

        return () => this.unschedule(emitTrail);
    }

    private spawnUiSparkleAt(sourceNode: Node, burst: boolean, type: SparkleType = 'star', tint?: Color, exactPosition: boolean = false) {
        const parent = sourceNode.parent;
        if (!parent) {
            return;
        }

        const sparkle = this.getSparkleNode(burst);
        sparkle.layer = sourceNode.layer;
        sparkle.setParent(parent);
        sparkle.setSiblingIndex(parent.children.length - 1);

        const transform = sparkle.getComponent(UITransform)!;
        const baseSize = type === 'flare'
            ? (burst ? 56 + Math.random() * 26 : 22 + Math.random() * 18)
            : type === 'bubble'
                ? (burst ? 10 + Math.random() * 14 : 7 + Math.random() * 10)
                : type === 'spot'
                    ? (burst ? 4 + Math.random() * 7 : 2.5 + Math.random() * 4.5)
                    : (burst ? 7 + Math.random() * 8 : 4 + Math.random() * 5);
        transform.setContentSize(baseSize, baseSize);

        const graphics = sparkle.getComponent(Graphics)!;
        graphics.clear();
        this.drawSparkle(graphics, baseSize, burst, type, tint);

        const opacity = sparkle.getComponent(UIOpacity)!;
        opacity.opacity = type === 'flare'
            ? (burst ? 245 : 205)
            : type === 'bubble'
                ? (burst ? 170 : 125)
                : type === 'spot'
                    ? (burst ? 235 : 185)
                    : (burst ? 255 : 210);

        const sourcePosition = sourceNode.position.clone();
        const scatter = exactPosition
            ? 0
            : type === 'flare'
                ? (burst ? 38 : 18)
                : (burst ? 58 : 34);
        sourcePosition.x += (Math.random() - 0.5) * scatter;
        sourcePosition.y += (Math.random() - 0.5) * scatter;
        sparkle.setPosition(sourcePosition);
        sparkle.angle = type === 'flare' ? 0 : Math.random() * 360;

        const angle = Math.random() * Math.PI * 2;
        const distance = exactPosition
            ? 0
            : type === 'flare'
                ? (burst ? 18 + Math.random() * 26 : 8 + Math.random() * 18)
                : type === 'bubble'
                    ? (burst ? 42 + Math.random() * 52 : 20 + Math.random() * 32)
                    : (burst ? 74 + Math.random() * 62 : 28 + Math.random() * 38);
        const floatY = exactPosition ? 0 : (type === 'bubble' ? 24 + Math.random() * 34 : 0);
        const endPosition = new Vec3(
            sourcePosition.x + Math.cos(angle) * distance,
            sourcePosition.y + Math.sin(angle) * distance + floatY,
            sourcePosition.z,
        );
        const startScale = type === 'flare'
            ? 0.08
            : type === 'bubble'
                ? 0.35 + Math.random() * 0.35
                : (burst ? 0.35 + Math.random() * 0.35 : 0.45 + Math.random() * 0.25);
        const endScale = type === 'flare'
            ? (burst ? 1.28 : 0.65)
            : type === 'bubble'
                ? (burst ? 1.1 + Math.random() * 0.35 : 0.65 + Math.random() * 0.25)
                : (burst ? 1.05 + Math.random() * 0.45 : 0.12);
        const duration = type === 'flare'
            ? (burst ? 0.24 : 0.14)
            : type === 'bubble'
                ? (burst ? 0.7 + Math.random() * 0.28 : Math.max(0.18, this.imageStarTrailDuration) * (1.05 + Math.random() * 0.65))
                : (burst ? 0.48 + Math.random() * 0.18 : Math.max(0.12, this.imageStarTrailDuration) * (0.72 + Math.random() * 0.42));

        sparkle.setScale(new Vec3(startScale, startScale, startScale));

        tween(sparkle)
            .parallel(
                type === 'flare'
                    ? tween().to(duration, { position: endPosition }, { easing: 'quadOut' })
                    : tween().to(duration, { position: endPosition, angle: sparkle.angle + 160 + Math.random() * 180 }, { easing: 'quadOut' }),
                tween().to(duration, { scale: new Vec3(endScale, endScale, endScale) }, { easing: type === 'flare' ? 'sineOut' : (burst ? 'backOut' : 'quadOut') }),
                type === 'flare'
                    ? tween(opacity)
                        .to(duration * 0.28, { opacity: 235 }, { easing: 'sineOut' })
                        .to(duration * 0.72, { opacity: 0 }, { easing: 'sineIn' })
                    : tween(opacity).to(duration, { opacity: 0 }, { easing: 'quadIn' }),
            )
            .call(() => {
                this.returnSparkleNode(sparkle);
            })
            .start();
    }

    private drawSparkle(graphics: Graphics, size: number, burst: boolean, type: SparkleType, tint?: Color) {
        graphics.clear();
        const baseTint = tint || new Color(255, 230, 140, 255);
        const lightTint = this.mixColor(baseTint, new Color(255, 255, 255, 255), 0.62, 255);

        if (type === 'flare') {
            this.drawLightFlare(graphics, size, baseTint, burst);
        } else if (type === 'star') {
            const outerRadius = size * 0.5;
            const innerRadius = size * 0.18;
            const points = 8;

            graphics.fillColor = burst
                ? new Color(lightTint.r, lightTint.g, lightTint.b, 245)
                : new Color(lightTint.r, lightTint.g, lightTint.b, 205);

            for (let i = 0; i <= points * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = -Math.PI * 0.5 + (Math.PI * i) / points;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            }
            graphics.close();
            graphics.fill();

            graphics.fillColor = this.mixColor(baseTint, new Color(255, 255, 255, 255), 0.9, burst ? 245 : 185);
            graphics.circle(0, 0, size * 0.15);
            graphics.fill();
        } else if (type === 'bubble') {
            const bubbleColor = this.getBubbleSparkleColor();
            graphics.fillColor = new Color(bubbleColor.r, bubbleColor.g, bubbleColor.b, burst ? 24 : 14);
            graphics.circle(0, 0, size * 0.48);
            graphics.fill();

            graphics.strokeColor = new Color(bubbleColor.r, bubbleColor.g, bubbleColor.b, burst ? 135 : 92);
            graphics.lineWidth = Math.max(1, size * 0.085);
            graphics.circle(0, 0, size * 0.45);
            graphics.stroke();

            graphics.strokeColor = new Color(255, 255, 255, burst ? 95 : 68);
            graphics.lineWidth = Math.max(1, size * 0.035);
            graphics.circle(0, 0, size * 0.31);
            graphics.stroke();

            graphics.fillColor = new Color(255, 255, 255, burst ? 160 : 110);
            graphics.circle(size * 0.17, size * 0.18, size * 0.085);
            graphics.fill();
        } else if (type === 'spot') {
            graphics.fillColor = new Color(baseTint.r, baseTint.g, baseTint.b, burst ? 96 : 56);
            graphics.circle(0, 0, size * 0.7);
            graphics.fill();

            graphics.fillColor = this.mixColor(baseTint, new Color(255, 255, 255, 255), 0.55, burst ? 205 : 145);
            graphics.circle(0, 0, size * 0.36);
            graphics.fill();

            graphics.fillColor = this.mixColor(baseTint, new Color(255, 255, 255, 255), 0.88, burst ? 235 : 165);
            graphics.circle(0, 0, size * 0.14);
            graphics.fill();
        }
    }

    private drawLightFlare(graphics: Graphics, size: number, tint: Color, burst: boolean) {
        const rayColor = new Color(255, 197, 48, burst ? 155 : 120);
        const softRayColor = new Color(255, 232, 122, burst ? 62 : 44);
        const haloColor = new Color(255, 231, 126, burst ? 58 : 42);
        const coreColor = new Color(255, 252, 214, burst ? 220 : 185);
        const rayCount = 11;

        graphics.fillColor = haloColor;
        graphics.circle(0, 0, size * 0.28);
        graphics.fill();

        for (let i = 0; i < rayCount; i++) {
            const angle = (Math.PI * 2 * i) / rayCount + Math.sin(i * 12.9898) * 0.32;
            const longRadius = size * (0.28 + (Math.sin(i * 7.13) + 1) * 0.24);
            const sideRadius = size * (0.014 + (Math.cos(i * 5.91) + 1) * 0.012);
            this.drawFlareRay(graphics, softRayColor, angle, longRadius * 1.12, sideRadius * 1.8);
            this.drawFlareRay(graphics, rayColor, angle, longRadius, sideRadius);
        }

        graphics.fillColor = coreColor;
        graphics.circle(0, 0, size * 0.16);
        graphics.fill();

        graphics.fillColor = new Color(255, 255, 255, burst ? 235 : 200);
        graphics.circle(0, 0, size * 0.07);
        graphics.fill();
    }

    private drawFlareRay(graphics: Graphics, color: Color, angle: number, longRadius: number, sideRadius: number) {
        const tipX = Math.cos(angle) * longRadius;
        const tipY = Math.sin(angle) * longRadius;
        const leftX = Math.cos(angle + Math.PI * 0.5) * sideRadius;
        const leftY = Math.sin(angle + Math.PI * 0.5) * sideRadius;
        const rightX = Math.cos(angle - Math.PI * 0.5) * sideRadius;
        const rightY = Math.sin(angle - Math.PI * 0.5) * sideRadius;

        graphics.fillColor = color;
        graphics.moveTo(leftX, leftY);
        graphics.lineTo(tipX, tipY);
        graphics.lineTo(rightX, rightY);
        graphics.close();
        graphics.fill();
    }

    private mixColor(a: Color, b: Color, t: number, alpha: number = 255): Color {
        const clamped = Math.max(0, Math.min(1, t));
        return new Color(
            Math.round(a.r + (b.r - a.r) * clamped),
            Math.round(a.g + (b.g - a.g) * clamped),
            Math.round(a.b + (b.b - a.b) * clamped),
            alpha,
        );
    }

    private getBubbleSparkleColor(): Color {
        const colors = [
            new Color(112, 219, 255, 255),
            new Color(255, 135, 188, 255),
            new Color(255, 223, 112, 255),
            new Color(163, 255, 135, 255),
            new Color(188, 145, 255, 255),
            new Color(255, 154, 96, 255),
            new Color(120, 255, 224, 255),
            new Color(255, 116, 138, 255),
            new Color(190, 255, 96, 255),
            new Color(132, 174, 255, 255),
        ];

        return colors[Math.floor(Math.random() * colors.length)];
    }

    private setLayerRecursive(node: Node, layer: number) {
        node.layer = layer;

        for (const child of node.children) {
            this.setLayerRecursive(child, layer);
        }
    }

    private screenToWorldOnY(camera: Camera, screenPos: Vec3, y: number): Vec3 | null {
        const ray = new geometry.Ray();
        camera.screenPointToRay(screenPos.x, screenPos.y, ray);

        if (Math.abs(ray.d.y) < 0.0001) {
            return null;
        }

        const t = (y - ray.o.y) / ray.d.y;
        if (t < 0) {
            return null;
        }

        return new Vec3(
            ray.o.x + ray.d.x * t,
            y,
            ray.o.z + ray.d.z * t,
        );
    }

    private canPlaceBlock(block: DraggableBlock, col: number, row: number): boolean {
        for (const cell of block.shape) {
            const c = col + cell.x;
            const r = row + cell.y;

            if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) {
                return false;
            }

            if (this.occupied.has(this.key(c, r))) {
                return false;
            }
        }

        return true;
    }

    private checkWin(nodesToIgnore: Node[] = []) {
        if (!this.blocksRoot) {
            return;
        }

        let hasActiveBlocks = false;
        for (const child of this.blocksRoot.children) {
            if (nodesToIgnore.indexOf(child) !== -1) continue;

            const block = child.getComponent(DraggableBlock);
            if (block && block.enabled) {
                hasActiveBlocks = true;
                break;
            }
        }

        if (!hasActiveBlocks) {
            console.log('LEVEL COMPLETE!');
            const canvas = find('Canvas') || find('block/Canvas');
            let endgameUI = canvas?.getComponent('EndgameUIController') as any;
            if (!endgameUI && canvas) {
                endgameUI = canvas.getComponentInChildren('EndgameUIController') as any;
            }
            if (endgameUI && typeof endgameUI.showWinPanel === 'function') {
                endgameUI.showWinPanel();
            }
        }
    }
}
