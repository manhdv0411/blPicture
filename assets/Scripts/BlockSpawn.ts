import {
    _decorator,
    BoxCollider,
    Color,
    Component,
    Material,
    MeshRenderer,
    Node,
    Prefab,
    Texture2D,
    Vec2,
    Vec3,
    instantiate,
    Mesh,
    primitives,
    utils,
    Vec4
} from 'cc';
import { BoardPreview } from './BoardPreview';
import { DraggableBlock } from './DraggableBlock';

const { ccclass, property } = _decorator;

type BlockDef = {
    id: string;
    colorGroup: string;
    prefab: Prefab | null;
    col: number;
    row: number;
    targetCol: number;
    targetRow: number;
    shape: Vec2[];
    rotationY: number;
    worldWidthAtScale1: number;
    worldHeightAtScale1: number;
    scaleMultiplier: number;
    visualOffsetX: number;
    visualOffsetZ: number;
};

type ColorGroupBounds = {
    minCol: number;
    minRow: number;
    maxCol: number;
    maxRow: number;
};

type OutlinePoint = {
    x: number;
    y: number;
};

@ccclass('BlockSpawn')
export class BlockSpawn extends Component {
    @property(Node)
    blocksRoot: Node | null = null;

    @property(Prefab)
    square1Prefab: Prefab | null = null;

    @property(Prefab)
    square2Prefab: Prefab | null = null;

    @property(Prefab)
    rec21Prefab: Prefab | null = null;

    @property(Prefab)
    l1Prefab: Prefab | null = null;

    @property(Prefab)
    l21FlipPrefab: Prefab | null = null;

    @property(Texture2D)
    greenTexture: Texture2D | null = null;

    @property(Texture2D)
    purpleTexture: Texture2D | null = null;

    @property(Texture2D)
    blueTexture: Texture2D | null = null;

    @property(Texture2D)
    redTexture: Texture2D | null = null;

    @property(Color)
    greenColor: Color = new Color(88, 219, 74, 255);

    @property(Color)
    purpleColor: Color = new Color(140, 52, 231, 255);

    @property(Color)
    blueColor: Color = new Color(33, 132, 232, 255);

    @property(Color)
    redColor: Color = new Color(232, 48, 52, 255);

    @property(Material)
    baseMaterial: Material | null = null;

    @property
    spawnOnlySquare1: boolean = true;

    @property
    blockY: number = 0.18;

    @property
    blockScaleY: number = 1;

    @property
    blockFitRatio: number = 0.95;

    @property
    scaleBlocksToGrid: boolean = true;

    @property
    preserveAspectRatio: boolean = true;

    @property
    preserveImageAspectRatio: boolean = true;

    @property
    imageScaleMultiplier: number = 1.18;

    @property
    blueImageScaleMultiplier: number = 0.9;

    @property
    blueL1ImageScaleMultiplier: number = 1;

    @property
    blueSquare1ImageOffsetX: number = 0;

    @property
    blueSquare1ImageOffsetZ: number = 0.28;

    @property
    blueL1ImageOffsetX: number = 0;

    @property
    blueL1ImageOffsetZ: number = 0;

    @property
    redRec21ImageOffsetX: number = 0;

    @property
    redRec21ImageOffsetZ: number = 0;

    @property
    redSquare2ImageOffsetX: number = 0;

    @property
    redSquare2ImageOffsetZ: number = 0;

    @property
    redImageCornerRadiusRatio: number = 0.18;

    @property
    imageCornerRadiusRatio: number = 0.18;

    @property
    purpleImageCornerRadiusRatio: number = 0.22;

    @property
    purpleImageScaleMultiplier: number = 1;

    @property
    purplePreserveImageAspectRatio: boolean = false;

    @property
    purpleL21ImageOffsetX: number = 0;

    @property
    purpleL21ImageOffsetZ: number = 0;

    @property
    purpleRec21ImageOffsetX: number = 0;

    @property
    purpleRec21ImageOffsetZ: number = 0;

    @property
    greenImageCornerRadiusRatio: number = 0.18;

    @property
    greenImageScaleMultiplier: number = 1;

    @property
    greenSquareTopLeftImageOffsetX: number = 0;

    @property
    greenSquareTopLeftImageOffsetZ: number = 0;

    @property
    greenSquareBottomLeftImageOffsetX: number = 0;

    @property
    greenSquareBottomLeftImageOffsetZ: number = 0;

    @property
    greenRec21ImageOffsetX: number = 0;

    @property
    greenRec21ImageOffsetZ: number = 0;

    @property
    imageCornerSegments: number = 6;

    @property
    imageLayerY: number = 0.54;

    @property
    imageLayerOffsetZ: number = 0.1;

    @property
    enableImageBorder: boolean = false;

    @property
    imageBorderThickness: number = 0.03;

    @property
    imageBorderYOffset: number = 0.01;

    @property(Color)
    greenBorderColor: Color = new Color(255, 255, 255, 255);

    @property(Color)
    purpleBorderColor: Color = new Color(255, 255, 255, 255);

    @property(Color)
    blueBorderColor: Color = new Color(255, 255, 255, 255);

    @property(Color)
    redBorderColor: Color = new Color(255, 255, 255, 255);

    @property
    imageSliceEdgeOffsetZ: number = 0.5;

    @property
    squareImageSliceEdgeOffsetMultiplier: number = 1;

    @property
    rectImageSliceEdgeOffsetMultiplier: number = 0.2;

    @property(Material)
    customBorderMaterial: Material | null = null;

    @property
    centerVisualToFootprint: boolean = true;

    @property
    alignVisualToFootprintMin: boolean = true;

    @property
    colliderY: number = 0.16;

    @property
    colliderHeight: number = 0.35;

    @property
    colliderFillRatio: number = 0.92;

    @property
    pickColliderPadding: number = 1.2;

    @property
    square1WorldWidthAtScale1: number = 1.7;

    @property
    square1WorldHeightAtScale1: number = 1.7;

    @property
    square1ScaleMultiplier: number = 1;

    @property
    square1VisualOffsetX: number = 0;

    @property
    square1VisualOffsetZ: number = 0;

    @property
    square2WorldWidthAtScale1: number = 1.7;

    @property
    square2WorldHeightAtScale1: number = 1.7;

    @property
    square2ScaleMultiplier: number = 1;

    @property
    square2VisualOffsetX: number = 0;

    @property
    square2VisualOffsetZ: number = 0;

    @property
    redSquare2VisualOffsetX: number = 0;

    @property
    redSquare2VisualOffsetZ: number = 0;

    @property
    rec21WorldWidthAtScale1: number = 1.7;

    @property
    rec21WorldHeightAtScale1: number = 1.7;

    @property
    rec21ScaleMultiplier: number = 0.84;

    @property
    rec21VisualOffsetX: number = 0;

    @property
    rec21VisualOffsetZ: number = 0.16;

    @property
    redRec21VisualOffsetX: number = 0;

    @property
    redRec21VisualOffsetZ: number = 0;

    @property
    l1WorldWidthAtScale1: number = 1.7;

    @property
    l1WorldHeightAtScale1: number = 1.7;

    @property
    l1ScaleMultiplier: number = 1;

    @property
    l1VisualOffsetX: number = 0;

    @property
    l1VisualOffsetZ: number = 0;

    @property
    l21FlipWorldWidthAtScale1: number = 1.7;

    @property
    l21FlipWorldHeightAtScale1: number = 1.7;

    @property
    l21FlipScaleMultiplier: number = 1;

    @property
    l21FlipVisualOffsetX: number = 0;

    @property
    l21FlipVisualOffsetZ: number = 0;

    private boardPreview: BoardPreview | null = null;
    private colorGroupBounds: Map<string, ColorGroupBounds> = new Map();

    start() {
        this.boardPreview = this.node.getComponent(BoardPreview);
        this.spawnLevel();
    }

    public spawnLevel() {
        if (!this.blocksRoot) {
            console.error('Chua keo BlocksRoot vao LevelBlockSpawner');
            return;
        }

        this.boardPreview = this.boardPreview || this.node.getComponent(BoardPreview);
        if (!this.boardPreview) {
            console.error('LevelBlockSpawner can BoardPreview tren cung node BoardRoot');
            return;
        }

        for (const child of [...this.blocksRoot.children]) {
            this.cleanupDynamicRenderResources(child);
            child.destroy();
        }
        this.blocksRoot.removeAllChildren();

        const layout = this.getLevel17LikeLayout();
        this.colorGroupBounds = this.buildColorGroupBounds(layout);

        for (const def of layout) {
            this.spawnBlock(def);
        }
    }

    private cleanupDynamicRenderResources(root: Node) {
        for (const renderer of root.getComponentsInChildren(MeshRenderer)) {
            const nodeName = renderer.node.name;
            if (nodeName !== 'ImageLayer' && nodeName !== 'ImageBorder') {
                continue;
            }

            const mesh = renderer.mesh;
            const material = renderer.material;
            renderer.mesh = null;
            renderer.material = null;
            mesh?.destroy();
            material?.destroy();
        }
    }

    private getLevel17LikeLayout(): BlockDef[] {
        const levelLayout: BlockDef[] = [
            // GREEN GROUP (Forms a 2x2 square)
            {
                id: 'square_top_left',
                colorGroup: 'green',
                prefab: this.square1Prefab,
                col: 0,
                row: 6,
                targetCol: 0, // Target assembled pos
                targetRow: 0,
                shape: this.rectShape(1, 1),
                rotationY: 0,
                worldWidthAtScale1: this.square1WorldWidthAtScale1,
                worldHeightAtScale1: this.square1WorldHeightAtScale1,
                scaleMultiplier: this.square1ScaleMultiplier,
                visualOffsetX: this.square1VisualOffsetX,
                visualOffsetZ: this.square1VisualOffsetZ,
            },
            {
                id: 'square_bottom_left',
                colorGroup: 'green',
                prefab: this.square1Prefab,
                col: 0,
                row: 0,
                targetCol: 1, // Target assembled pos
                targetRow: 0,
                shape: this.rectShape(1, 1),
                rotationY: 0,
                worldWidthAtScale1: this.square1WorldWidthAtScale1,
                worldHeightAtScale1: this.square1WorldHeightAtScale1,
                scaleMultiplier: this.square1ScaleMultiplier,
                visualOffsetX: this.square1VisualOffsetX,
                visualOffsetZ: this.square1VisualOffsetZ,
            },
            {
                id: 'rec21_top_next_to_square',
                colorGroup: 'green',
                prefab: this.rec21Prefab,
                col: 1,
                row: 6,
                targetCol: 0, // Target assembled pos
                targetRow: 1,
                shape: this.rectShape(2, 1),
                rotationY: -90,
                worldWidthAtScale1: this.rec21WorldWidthAtScale1,
                worldHeightAtScale1: this.rec21WorldHeightAtScale1,
                scaleMultiplier: this.rec21ScaleMultiplier,
                visualOffsetX: this.rec21VisualOffsetX,
                visualOffsetZ: this.rec21VisualOffsetZ,
            },

            // RED GROUP (Forms a 2x3 rectangle)
            {
                id: 'rec21_bottom',
                colorGroup: 'red',
                prefab: this.rec21Prefab,
                col: 2,
                row: 2,
                targetCol: 0, // Target assembled pos
                targetRow: 2,
                shape: this.rectShape(2, 1),
                rotationY: -90,
                worldWidthAtScale1: this.rec21WorldWidthAtScale1,
                worldHeightAtScale1: this.rec21WorldHeightAtScale1,
                scaleMultiplier: this.rec21ScaleMultiplier,
                visualOffsetX: this.redRec21VisualOffsetX,
                visualOffsetZ: this.redRec21VisualOffsetZ,
            },
            {
                id: 'square2_bottom_right',
                colorGroup: 'red',
                prefab: this.square2Prefab,
                col: 0,
                row: 4,
                targetCol: 0, // Target assembled pos
                targetRow: 0,
                shape: this.rectShape(2, 2),
                rotationY: 0,
                worldWidthAtScale1: this.square2WorldWidthAtScale1,
                worldHeightAtScale1: this.square2WorldHeightAtScale1,
                scaleMultiplier: this.square2ScaleMultiplier,
                visualOffsetX: this.redSquare2VisualOffsetX,
                visualOffsetZ: this.redSquare2VisualOffsetZ,
            },

            // PURPLE GROUP (Forms a 2x3 rectangle)
            {
                id: 'l21_flip_left',
                colorGroup: 'purple',
                prefab: this.l21FlipPrefab,
                col: 1,
                row: 0,
                targetCol: 0, // Target assembled pos
                targetRow: 0,
                shape: [new Vec2(0, 0), new Vec2(1, 0), new Vec2(0, 1), new Vec2(0, 2)],
                rotationY: 180,
                worldWidthAtScale1: this.l21FlipWorldWidthAtScale1,
                worldHeightAtScale1: this.l21FlipWorldHeightAtScale1,
                scaleMultiplier: this.l21FlipScaleMultiplier,
                visualOffsetX: this.l21FlipVisualOffsetX,
                visualOffsetZ: this.l21FlipVisualOffsetZ,
            },
            {
                id: 'rec21_top',
                colorGroup: 'purple',
                prefab: this.rec21Prefab,
                col: 4,
                row: 0,
                targetCol: 1, // Target assembled pos
                targetRow: 1,
                shape: this.rectShape(1, 2),
                rotationY: 0,
                worldWidthAtScale1: this.rec21WorldWidthAtScale1,
                worldHeightAtScale1: this.rec21WorldHeightAtScale1,
                scaleMultiplier: this.rec21ScaleMultiplier,
                visualOffsetX: this.rec21VisualOffsetX,
                visualOffsetZ: this.rec21VisualOffsetZ,
            },

            // BLUE GROUP (Forms a 2x2 square)
            {
                id: 'square_left',
                colorGroup: 'blue',
                prefab: this.square1Prefab,
                col: 0,
                row: 3,
                targetCol: 0, // Target assembled pos
                targetRow: 0,
                shape: this.rectShape(1, 1),
                rotationY: 0,
                worldWidthAtScale1: this.square1WorldWidthAtScale1,
                worldHeightAtScale1: this.square1WorldHeightAtScale1,
                scaleMultiplier: this.square1ScaleMultiplier,
                visualOffsetX: this.square1VisualOffsetX,
                visualOffsetZ: this.square1VisualOffsetZ,
            },
            {
                id: 'l1_top',
                colorGroup: 'blue',
                prefab: this.l1Prefab,
                col: 3,
                row: 5,
                targetCol: 0, // Target assembled pos
                targetRow: 0,
                shape: [new Vec2(0, 1), new Vec2(1, 1), new Vec2(1, 0)],
                rotationY: 90,
                worldWidthAtScale1: this.l1WorldWidthAtScale1,
                worldHeightAtScale1: this.l1WorldHeightAtScale1,
                scaleMultiplier: this.l1ScaleMultiplier,
                visualOffsetX: this.l1VisualOffsetX,
                visualOffsetZ: this.l1VisualOffsetZ,
            },
        ];

        return levelLayout;
    }

    private spawnBlock(def: BlockDef) {
        if (!def.prefab || !this.boardPreview) {
            console.warn(`Chua gan prefab cho block ${def.id}`);
            return;
        }

        const block = instantiate(def.prefab);
        const blockSize = this.getShapeSize(def.shape);
        const draggable = block.getComponent(DraggableBlock) || block.addComponent(DraggableBlock);

        block.name = def.id;
        block.setParent(this.blocksRoot);
        block.setPosition(this.gridAreaToWorld(def.col, def.row, blockSize.cols, blockSize.rows));
        block.setRotationFromEuler(0, 0, 0);
        block.setScale(new Vec3(1, 1, 1));
        this.disablePrefabColliders(block);
        this.applyVisualRotation(block, def.rotationY);
        this.applyColorGroupMaterial(block, def);

        if (this.scaleBlocksToGrid) {
            const layout = this.boardPreview.getBoardLayout();
            const desiredWidth = this.getGridAreaSize(blockSize.cols, layout.cellSize, layout.cellStep);
            const desiredHeight = this.getGridAreaSize(blockSize.rows, layout.cellSize, layout.cellStep);
            const scaleX = desiredWidth / Math.max(0.001, def.worldWidthAtScale1);
            const scaleZ = desiredHeight / Math.max(0.001, def.worldHeightAtScale1);

            if (this.preserveAspectRatio) {
                const uniformScale = Math.min(scaleX, scaleZ) * def.scaleMultiplier;
                block.setScale(new Vec3(uniformScale, this.blockScaleY, uniformScale));
            } else {
                block.setScale(new Vec3(scaleX * def.scaleMultiplier, this.blockScaleY, scaleZ * def.scaleMultiplier));
            }
        } else {
            block.setScale(new Vec3(1, 1, 1));
        }

        // Web Mobile frustum/worldBounds can be stale during spawn/restart.
        // Keep blocks at their real board position and avoid deferred off-screen alignment.
        this.applyVisualOffset(block, def.visualOffsetX, def.visualOffsetZ);

        this.rebuildCellColliders(block, def.shape);
        this.rebuildPickCollider(block, def.shape, blockSize);

        draggable.blockId = def.id;
        draggable.colorGroup = def.colorGroup;
        draggable.targetCol = def.targetCol;
        draggable.targetRow = def.targetRow;
        draggable.shape = def.shape.map((cell) => cell.clone());
        draggable.setGridPosition(def.col, def.row);

        this.addImageLayer(block, def);
    }

    private addImageLayer(block: Node, def: BlockDef) {
        const group = this.getColorGroupVisual(def.colorGroup);
        const bounds = this.colorGroupBounds.get(def.colorGroup);

        if (!group || !group.texture || !bounds || !this.boardPreview) {
            return;
        }

        const layout = this.boardPreview.getBoardLayout();

        // Total grid size of the assembled image
        const totalCols = bounds.maxCol - bounds.minCol + 1;
        const totalRows = bounds.maxRow - bounds.minRow + 1;

        // Size of THIS block
        const blockSize = this.getShapeSize(def.shape);
        const blockCols = blockSize.cols;
        const blockRows = blockSize.rows;

        // Create Layer Node
        const layerNode = new Node('ImageLayer');
        layerNode.setParent(block);

        const geometry = this.createImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows);

        // Add Mesh and Material
        const mr = layerNode.addComponent(MeshRenderer);
        mr.mesh = utils.createMesh(geometry);

        const mat = new Material();
        mat.initialize({
            effectName: 'builtin-unlit',
            defines: { USE_TEXTURE: true, USE_ALPHA_TEST: true }
        });

        this.trySetMaterialProperty(mat, 'mainTexture', group.texture);
        this.trySetMaterialProperty(mat, 'alphaThreshold', 0.5);
        mr.material = mat;

        // Fit the sampled texture region into this block without stretching the source pixels.
        const desiredWidth = this.getGridAreaSize(blockCols, layout.cellSize, layout.cellStep);
        const desiredLength = this.getGridAreaSize(blockRows, layout.cellSize, layout.cellStep);
        const fittedSize = this.getImageLayerWorldSize(
            desiredWidth,
            desiredLength,
            group.texture,
            blockCols / totalCols,
            blockRows / totalRows,
            this.getImageScaleMultiplier(def),
            this.shouldPreserveImageAspectRatio(def),
        );

        // Quad is 1x1. Scale it down relative to block's local scale
        const scaleX = fittedSize.width / Math.max(0.001, block.scale.x);
        const scaleY = fittedSize.length / Math.max(0.001, block.scale.z); // Z scale of block maps to Y of layer after rotation

        layerNode.setScale(new Vec3(scaleX, scaleY, 1));

        // Rotate flat and upright. Quad initially faces +Z. Rotating X by -90 makes it face +Y (up).
        layerNode.setRotationFromEuler(-90, 0, 0);

        // Position it slightly above the block visual. Upper image slices move down,
        // lower image slices move up so each slice can sit closer to its block edge.
        const sliceOffsetZ = this.getImageSliceEdgeOffsetZ(def, bounds, blockCols, blockRows, totalRows);
        const layerOffset = this.getImageLayerPositionOffset(def, block);
        layerNode.setPosition(layerOffset.x, this.imageLayerY, sliceOffsetZ + layerOffset.y);

        // Add outline around the objects depicted in the image.
        // Creates a slightly larger copy of the textured mesh behind the original.
        // The texture's alpha test preserves the object silhouette, and the
        // expanded edge that peeks out forms a colored outline around the objects.
        if (this.enableImageBorder && this.imageBorderThickness > 0) {
            const borderNode = new Node('ImageBorder');
            borderNode.setParent(block);

            const useAlphaOutlineMaterial = !!this.customBorderMaterial;
            const outsetCells = useAlphaOutlineMaterial ? 0 : this.imageBorderThickness * blockCols / Math.max(0.001, fittedSize.width);
            const borderGeometry = this.createImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows, outsetCells);

            const borderMr = borderNode.addComponent(MeshRenderer);
            borderMr.mesh = utils.createMesh(borderGeometry);

            const borderMat = new Material();
            if (this.customBorderMaterial) {
                borderMat.copy(this.customBorderMaterial);
            } else {
                borderMat.initialize({
                    effectName: 'builtin-unlit',
                    defines: { USE_TEXTURE: true, USE_ALPHA_TEST: true }
                });
            }
            this.trySetMaterialProperty(borderMat, 'mainTexture', group.texture);
            this.trySetMaterialProperty(borderMat, 'alphaThreshold', 0.1);
            this.trySetMaterialProperty(borderMat, 'mainColor', group.borderColor);
            this.trySetMaterialProperty(borderMat, 'outlineWidth', Math.max(1, this.imageBorderThickness * 80));
            this.trySetMaterialProperty(borderMat, 'textureSize', new Vec4(group.texture.width, group.texture.height, 0, 0));
            this.trySetMaterialProperty(borderMat, 'uvRect', this.getImageLayerUvRect(def, bounds, blockCols, blockRows, totalCols, totalRows));
            borderMr.material = borderMat;

            borderNode.setScale(new Vec3(scaleX, scaleY, 1));

            borderNode.setRotationFromEuler(-90, 0, 0);
            borderNode.setPosition(layerOffset.x, this.imageLayerY - this.imageBorderYOffset, sliceOffsetZ + layerOffset.y);
        }
    }

    private getImageLayerUvRect(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
    ): Vec4 {
        const minU = (def.targetCol - bounds.minCol) / totalCols;
        const minV = (def.targetRow - bounds.minRow) / totalRows;
        const maxU = (def.targetCol - bounds.minCol + blockCols) / totalCols;
        const maxV = (def.targetRow - bounds.minRow + blockRows) / totalRows;

        return new Vec4(minU, minV, maxU, maxV);
    }

    private createImageLayerGeometry(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        outsetCells: number = 0,
    ): primitives.IGeometry {
        if (def.colorGroup === 'green') {
            return this.createGreenImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows, outsetCells);
        }

        if (def.colorGroup === 'purple') {
            return this.createPurpleImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows, outsetCells);
        }

        if (def.colorGroup === 'red') {
            return this.createRedImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows, outsetCells);
        }

        if (def.colorGroup !== 'blue') {
            return this.createPlainImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows);
        }

        return this.createBlueImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows, outsetCells);
    }

    private createBlueImageLayerGeometry(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        outsetCells: number = 0,
    ): primitives.IGeometry {
        if (def.id === 'l1_top') {
            return this.createRoundedImageLayerGeometryFromOutline(
                def,
                bounds,
                blockCols,
                blockRows,
                totalCols,
                totalRows,
                [
                    { x: 1, y: 0 },
                    { x: 2, y: 0 },
                    { x: 2, y: 2 },
                    { x: 0, y: 2 },
                    { x: 0, y: 1 },
                    { x: 1, y: 1 },
                ],
                this.imageCornerRadiusRatio,
                outsetCells,
            );
        }

        return this.createRoundedImageLayerGeometryFromCells(
            def,
            bounds,
            blockCols,
            blockRows,
            totalCols,
            totalRows,
            def.shape,
            this.imageCornerRadiusRatio,
        );
    }

    private createGreenImageLayerGeometry(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        outsetCells: number = 0,
    ): primitives.IGeometry {
        if (def.id === 'square_top_left' || def.id === 'square_bottom_left') {
            return this.createRoundedImageLayerGeometryFromCells(
                def,
                bounds,
                blockCols,
                blockRows,
                totalCols,
                totalRows,
                [new Vec2(0, 0)],
                this.greenImageCornerRadiusRatio,
                outsetCells,
            );
        }

        if (def.id === 'rec21_top_next_to_square') {
            return this.createRoundedImageLayerGeometryFromOutline(
                def,
                bounds,
                blockCols,
                blockRows,
                totalCols,
                totalRows,
                [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                    { x: 2, y: 1 },
                    { x: 0, y: 1 },
                ],
                this.greenImageCornerRadiusRatio,
                outsetCells,
            );
        }

        return this.createPlainImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows, outsetCells);
    }

    private createPurpleImageLayerGeometry(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        outsetCells: number = 0,
    ): primitives.IGeometry {
        if (def.id === 'l21_flip_left') {
            return this.createRoundedImageLayerGeometryFromOutline(
                def,
                bounds,
                blockCols,
                blockRows,
                totalCols,
                totalRows,
                [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                    { x: 2, y: 1 },
                    { x: 1, y: 1 },
                    { x: 1, y: 3 },
                    { x: 0, y: 3 },
                ],
                this.purpleImageCornerRadiusRatio,
                outsetCells,
            );
        }

        if (def.id === 'rec21_top') {
            return this.createRoundedImageLayerGeometryFromOutline(
                def,
                bounds,
                blockCols,
                blockRows,
                totalCols,
                totalRows,
                [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 },
                    { x: 1, y: 2 },
                    { x: 0, y: 2 },
                ],
                this.purpleImageCornerRadiusRatio,
                outsetCells,
            );
        }

        return this.createPlainImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows, outsetCells);
    }

    private createRedImageLayerGeometry(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        outsetCells: number = 0,
    ): primitives.IGeometry {
        if (def.id === 'square2_bottom_right') {
            return this.createRoundedImageLayerGeometryFromOutline(
                def,
                bounds,
                blockCols,
                blockRows,
                totalCols,
                totalRows,
                [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                    { x: 2, y: 2 },
                    { x: 0, y: 2 },
                ],
                this.redImageCornerRadiusRatio,
                outsetCells,
            );
        }

        if (def.id === 'rec21_bottom') {
            return this.createRoundedImageLayerGeometryFromOutline(
                def,
                bounds,
                blockCols,
                blockRows,
                totalCols,
                totalRows,
                [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                    { x: 2, y: 1 },
                    { x: 0, y: 1 },
                ],
                this.redImageCornerRadiusRatio,
                outsetCells,
            );
        }

        return this.createPlainImageLayerGeometry(def, bounds, blockCols, blockRows, totalCols, totalRows, outsetCells);
    }

    private createRoundedImageLayerGeometryFromOutline(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        outlinePoints: OutlinePoint[],
        cornerRadiusRatio: number,
        outsetCells: number = 0,
    ): primitives.IGeometry {
        return this.createRoundedImageLayerGeometryFromRoundedOutline(
            def,
            bounds,
            blockCols,
            blockRows,
            totalCols,
            totalRows,
            this.roundOutline(outlinePoints, blockCols, blockRows, cornerRadiusRatio),
            outsetCells,
        );
    }

    private createRoundedImageLayerGeometryFromCells(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        cells: Vec2[],
        cornerRadiusRatio: number,
        outsetCells: number = 0,
    ): primitives.IGeometry {
        const occupiedCells = this.buildShapeCellSet(cells);
        const outline = this.buildRoundedShapeOutline(cells, occupiedCells, blockCols, blockRows, cornerRadiusRatio);

        return this.createRoundedImageLayerGeometryFromRoundedOutline(
            def,
            bounds,
            blockCols,
            blockRows,
            totalCols,
            totalRows,
            outline,
            outsetCells,
        );
    }

    private createRoundedImageLayerGeometryFromRoundedOutline(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        outline: OutlinePoint[],
        outsetCells: number = 0,
    ): primitives.IGeometry {
        const uvOutline = outline;
        const posOutline = outsetCells > 0 ? this.outsetOutline(outline, outsetCells) : outline;

        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        for (let i = 0; i < posOutline.length; i++) {
            const posPoint = posOutline[i];
            const uvPoint = uvOutline[i];

            const localX = posPoint.x / blockCols - 0.5;
            const localY = 0.5 - posPoint.y / blockRows;
            const imageCol = def.targetCol - bounds.minCol + uvPoint.x;
            const imageRow = def.targetRow - bounds.minRow + uvPoint.y;

            positions.push(localX, localY, 0);
            normals.push(0, 0, 1);
            uvs.push(imageCol / totalCols, imageRow / totalRows);
        }

        const indices = this.triangulatePolygon(posOutline.map((point) => ({
            x: point.x / blockCols - 0.5,
            y: 0.5 - point.y / blockRows,
        })));

        return {
            positions,
            normals,
            uvs,
            indices,
            minPos: { x: -0.5, y: -0.5, z: 0 },
            maxPos: { x: 0.5, y: 0.5, z: 0 },
            boundingRadius: Math.sqrt(0.5 * 0.5 + 0.5 * 0.5),
        };
    }

    private createPlainImageLayerGeometry(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        outsetCells: number = 0,
    ): primitives.IGeometry {
        return this.createRoundedImageLayerGeometryFromCells(def, bounds, blockCols, blockRows, totalCols, totalRows, def.shape, 0, outsetCells);
    }

    private createImageLayerGeometryFromCells(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalCols: number,
        totalRows: number,
        cells: Vec2[],
    ): primitives.IGeometry {
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        for (const cell of cells) {
            const baseIndex = positions.length / 3;
            const left = cell.x / blockCols - 0.5;
            const right = (cell.x + 1) / blockCols - 0.5;
            const top = 0.5 - cell.y / blockRows;
            const bottom = 0.5 - (cell.y + 1) / blockRows;
            const imageCol = def.targetCol + cell.x - bounds.minCol;
            const imageRow = def.targetRow + cell.y - bounds.minRow;
            const u0 = imageCol / totalCols;
            const u1 = (imageCol + 1) / totalCols;
            const vTop = imageRow / totalRows;
            const vBottom = (imageRow + 1) / totalRows;

            positions.push(
                left, bottom, 0,
                right, bottom, 0,
                right, top, 0,
                left, top, 0,
            );
            normals.push(
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
            );
            uvs.push(
                u0, vBottom,
                u1, vBottom,
                u1, vTop,
                u0, vTop,
            );
            indices.push(
                baseIndex, baseIndex + 1, baseIndex + 2,
                baseIndex, baseIndex + 2, baseIndex + 3,
            );
        }

        return {
            positions,
            normals,
            uvs,
            indices,
            minPos: { x: -0.5, y: -0.5, z: 0 },
            maxPos: { x: 0.5, y: 0.5, z: 0 },
            boundingRadius: Math.sqrt(0.5 * 0.5 + 0.5 * 0.5),
        };
    }

    private getImageBorderOutline(def: BlockDef, blockCols: number, blockRows: number): OutlinePoint[] {
        if (def.colorGroup === 'green') {
            if (def.id === 'square_top_left' || def.id === 'square_bottom_left') {
                const cells = [new Vec2(0, 0)];
                return this.buildRoundedShapeOutline(cells, this.buildShapeCellSet(cells), blockCols, blockRows, this.greenImageCornerRadiusRatio);
            }
            if (def.id === 'rec21_top_next_to_square') {
                return this.roundOutline(
                    [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 1 }],
                    blockCols, blockRows, this.greenImageCornerRadiusRatio,
                );
            }
        }

        if (def.colorGroup === 'purple') {
            if (def.id === 'l21_flip_left') {
                return this.roundOutline(
                    [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 3 }],
                    blockCols, blockRows, this.purpleImageCornerRadiusRatio,
                );
            }
            if (def.id === 'rec21_top') {
                return this.roundOutline(
                    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
                    blockCols, blockRows, this.purpleImageCornerRadiusRatio,
                );
            }
        }

        if (def.colorGroup === 'blue') {
            if (def.id === 'l1_top') {
                return this.roundOutline(
                    [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
                    blockCols, blockRows, this.imageCornerRadiusRatio,
                );
            }
            return this.buildRoundedShapeOutline(
                def.shape, this.buildShapeCellSet(def.shape), blockCols, blockRows, this.imageCornerRadiusRatio,
            );
        }

        if (def.colorGroup === 'red') {
            if (def.id === 'square2_bottom_right') {
                return this.roundOutline(
                    [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }],
                    blockCols, blockRows, this.redImageCornerRadiusRatio,
                );
            }

            if (def.id === 'rec21_bottom') {
                return this.roundOutline(
                    [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 1 }],
                    blockCols, blockRows, this.redImageCornerRadiusRatio,
                );
            }
        }

        // Others: build rounded outline from shape
        return this.buildRoundedShapeOutline(
            def.shape, this.buildShapeCellSet(def.shape), blockCols, blockRows, this.imageCornerRadiusRatio,
        );
    }

    private createBorderRingGeometry(
        outline: OutlinePoint[],
        blockCols: number,
        blockRows: number,
        borderWidth: number,
    ): primitives.IGeometry {
        const n = outline.length;

        // Compute signed area to determine winding direction
        let signedArea = 0;
        for (let i = 0; i < n; i++) {
            const curr = outline[i];
            const next = outline[(i + 1) % n];
            signedArea += curr.x * next.y - next.x * curr.y;
        }
        const outwardSign = signedArea > 0 ? 1 : -1;

        // Compute inset outline by pushing each vertex INWARD (opposite of outward)
        const insetOutline: OutlinePoint[] = [];
        for (let i = 0; i < n; i++) {
            const prev = outline[(i - 1 + n) % n];
            const curr = outline[i];
            const next = outline[(i + 1) % n];

            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const len1 = Math.max(0.0001, Math.sqrt(dx1 * dx1 + dy1 * dy1));

            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const len2 = Math.max(0.0001, Math.sqrt(dx2 * dx2 + dy2 * dy2));

            // Outward-facing normals of adjacent edges
            const n1x = -dy1 / len1 * outwardSign;
            const n1y = dx1 / len1 * outwardSign;
            const n2x = -dy2 / len2 * outwardSign;
            const n2y = dx2 / len2 * outwardSign;

            // Miter direction (average of the two normals)
            const mx = n1x + n2x;
            const my = n1y + n2y;
            const mLen = Math.sqrt(mx * mx + my * my);

            if (mLen < 0.0001) {
                // Parallel edges – offset INWARD (subtract)
                insetOutline.push({
                    x: curr.x - n1x * borderWidth,
                    y: curr.y - n1y * borderWidth,
                });
            } else {
                const mnx = mx / mLen;
                const mny = my / mLen;
                const dot = mnx * n1x + mny * n1y;
                // Clamp miter length to avoid spikes at sharp angles
                const miterLen = Math.min(borderWidth * 3, borderWidth / Math.max(0.15, dot));
                insetOutline.push({
                    x: curr.x - mnx * miterLen,
                    y: curr.y - mny * miterLen,
                });
            }
        }

        // Build ring mesh: original outline = outer edge, inset = inner edge
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i < n; i++) {
            const inner = insetOutline[i];
            const outer = outline[i];

            // Inner vertex (index 2*i)
            positions.push(inner.x / blockCols - 0.5, 0.5 - inner.y / blockRows, 0);
            normals.push(0, 0, 1);
            uvs.push(0, 0);

            // Outer vertex (index 2*i + 1)
            positions.push(outer.x / blockCols - 0.5, 0.5 - outer.y / blockRows, 0);
            normals.push(0, 0, 1);
            uvs.push(0, 0);

            // Quad connecting to the next vertex pair
            const nextI = (i + 1) % n;
            indices.push(2 * i, 2 * i + 1, 2 * nextI + 1);
            indices.push(2 * i, 2 * nextI + 1, 2 * nextI);
        }

        return {
            positions,
            normals,
            uvs,
            indices,
            minPos: { x: -1, y: -1, z: 0 },
            maxPos: { x: 1, y: 1, z: 0 },
            boundingRadius: 2,
        };
    }

    private buildShapeCellSet(shape: Vec2[]): Set<string> {
        const cells = new Set<string>();

        for (const cell of shape) {
            cells.add(this.shapeCellKey(cell.x, cell.y));
        }

        return cells;
    }

    private shapeCellKey(col: number, row: number): string {
        return `${col}_${row}`;
    }

    private buildRoundedShapeOutline(
        shape: Vec2[],
        occupiedCells: Set<string>,
        blockCols: number,
        blockRows: number,
        cornerRadiusRatio: number = this.imageCornerRadiusRatio,
    ): OutlinePoint[] {
        const polygon = this.buildShapeOutline(shape, occupiedCells);
        return this.roundOutline(polygon, blockCols, blockRows, cornerRadiusRatio);
    }

    private outsetOutline(
        outline: OutlinePoint[],
        outsetWidth: number
    ): OutlinePoint[] {
        const n = outline.length;
        if (n < 3) return outline;

        let signedArea = 0;
        for (let i = 0; i < n; i++) {
            const curr = outline[i];
            const next = outline[(i + 1) % n];
            signedArea += curr.x * next.y - next.x * curr.y;
        }
        const outwardSign = signedArea > 0 ? 1 : -1;

        const outsetOutline: OutlinePoint[] = [];
        for (let i = 0; i < n; i++) {
            const prev = outline[(i - 1 + n) % n];
            const curr = outline[i];
            const next = outline[(i + 1) % n];

            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const len1 = Math.max(0.0001, Math.sqrt(dx1 * dx1 + dy1 * dy1));

            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const len2 = Math.max(0.0001, Math.sqrt(dx2 * dx2 + dy2 * dy2));

            const n1x = -dy1 / len1 * outwardSign;
            const n1y = dx1 / len1 * outwardSign;
            const n2x = -dy2 / len2 * outwardSign;
            const n2y = dx2 / len2 * outwardSign;

            const mx = n1x + n2x;
            const my = n1y + n2y;
            const mLen = Math.sqrt(mx * mx + my * my);

            if (mLen < 0.0001) {
                outsetOutline.push({
                    x: curr.x - n1x * outsetWidth,
                    y: curr.y - n1y * outsetWidth,
                });
            } else {
                const mnx = mx / mLen;
                const mny = my / mLen;
                const dot = mnx * n1x + mny * n1y;
                const miterLen = Math.min(outsetWidth * 3, outsetWidth / Math.max(0.15, dot));
                outsetOutline.push({
                    x: curr.x - mnx * miterLen,
                    y: curr.y - mny * miterLen,
                });
            }
        }
        return outsetOutline;
    }

    private roundOutline(
        polygon: OutlinePoint[],
        blockCols: number,
        blockRows: number,
        cornerRadiusRatio: number,
    ): OutlinePoint[] {
        const radius = Math.min(1 / Math.max(1, blockCols), 1 / Math.max(1, blockRows))
            * Math.max(0, Math.min(0.45, cornerRadiusRatio));
        const segments = Math.max(1, Math.round(this.imageCornerSegments));

        if (polygon.length < 3 || radius <= 0.0001) {
            return polygon;
        }

        const rounded: OutlinePoint[] = [];

        for (let i = 0; i < polygon.length; i++) {
            const prev = polygon[(i - 1 + polygon.length) % polygon.length];
            const current = polygon[i];
            const next = polygon[(i + 1) % polygon.length];
            const inDir = this.normalizePoint({ x: current.x - prev.x, y: current.y - prev.y });
            const outDir = this.normalizePoint({ x: next.x - current.x, y: next.y - current.y });
            const start = { x: current.x - inDir.x * radius, y: current.y - inDir.y * radius };
            const end = { x: current.x + outDir.x * radius, y: current.y + outDir.y * radius };
            const center = { x: start.x + outDir.x * radius, y: start.y + outDir.y * radius };
            const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
            const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
            const turn = inDir.x * outDir.y - inDir.y * outDir.x;
            const delta = this.getArcDelta(startAngle, endAngle, turn >= 0);

            for (let segment = 0; segment <= segments; segment++) {
                if (i > 0 && segment === 0) {
                    continue;
                }

                const t = segment / segments;
                const angle = startAngle + delta * t;
                rounded.push({
                    x: center.x + Math.cos(angle) * radius,
                    y: center.y + Math.sin(angle) * radius,
                });
            }
        }

        return rounded;
    }

    private buildShapeOutline(shape: Vec2[], occupiedCells: Set<string>): OutlinePoint[] {
        const edgeByStart = new Map<string, OutlinePoint>();
        const startPoints: OutlinePoint[] = [];
        const addEdge = (start: OutlinePoint, end: OutlinePoint) => {
            edgeByStart.set(this.outlinePointKey(start), end);
            startPoints.push(start);
        };

        for (const cell of shape) {
            if (!occupiedCells.has(this.shapeCellKey(cell.x, cell.y - 1))) {
                addEdge({ x: cell.x, y: cell.y }, { x: cell.x + 1, y: cell.y });
            }
            if (!occupiedCells.has(this.shapeCellKey(cell.x + 1, cell.y))) {
                addEdge({ x: cell.x + 1, y: cell.y }, { x: cell.x + 1, y: cell.y + 1 });
            }
            if (!occupiedCells.has(this.shapeCellKey(cell.x, cell.y + 1))) {
                addEdge({ x: cell.x + 1, y: cell.y + 1 }, { x: cell.x, y: cell.y + 1 });
            }
            if (!occupiedCells.has(this.shapeCellKey(cell.x - 1, cell.y))) {
                addEdge({ x: cell.x, y: cell.y + 1 }, { x: cell.x, y: cell.y });
            }
        }

        if (startPoints.length === 0) {
            return [];
        }

        let current = startPoints[0];
        for (const point of startPoints) {
            if (point.y < current.y || (point.y === current.y && point.x < current.x)) {
                current = point;
            }
        }

        const outline: OutlinePoint[] = [];
        const visited = new Set<string>();

        while (!visited.has(this.outlinePointKey(current))) {
            outline.push(current);
            visited.add(this.outlinePointKey(current));

            const next = edgeByStart.get(this.outlinePointKey(current));
            if (!next) {
                break;
            }

            current = next;
        }

        return outline;
    }

    private triangulatePolygon(points: OutlinePoint[]): number[] {
        const indices: number[] = [];
        const vertices = points.map((_, index) => index);
        const isClockwise = this.getSignedArea(points) < 0;

        if (isClockwise) {
            vertices.reverse();
        }

        let guard = 0;
        while (vertices.length > 3 && guard < points.length * points.length) {
            let clipped = false;

            for (let i = 0; i < vertices.length; i++) {
                const prevIndex = vertices[(i - 1 + vertices.length) % vertices.length];
                const currentIndex = vertices[i];
                const nextIndex = vertices[(i + 1) % vertices.length];

                if (!this.isConvexCorner(points[prevIndex], points[currentIndex], points[nextIndex])) {
                    continue;
                }

                let containsPoint = false;
                for (const vertexIndex of vertices) {
                    if (vertexIndex === prevIndex || vertexIndex === currentIndex || vertexIndex === nextIndex) {
                        continue;
                    }

                    if (this.isPointInTriangle(points[vertexIndex], points[prevIndex], points[currentIndex], points[nextIndex])) {
                        containsPoint = true;
                        break;
                    }
                }

                if (containsPoint) {
                    continue;
                }

                indices.push(prevIndex, currentIndex, nextIndex);
                vertices.splice(i, 1);
                clipped = true;
                break;
            }

            if (!clipped) {
                break;
            }

            guard++;
        }

        if (vertices.length === 3) {
            indices.push(vertices[0], vertices[1], vertices[2]);
        }

        return indices;
    }

    private normalizePoint(point: OutlinePoint): OutlinePoint {
        const length = Math.max(0.001, Math.sqrt(point.x * point.x + point.y * point.y));
        return { x: point.x / length, y: point.y / length };
    }

    private getArcDelta(startAngle: number, endAngle: number, clockwise: boolean): number {
        let delta = endAngle - startAngle;

        if (clockwise && delta < 0) {
            delta += Math.PI * 2;
        } else if (!clockwise && delta > 0) {
            delta -= Math.PI * 2;
        }

        return delta;
    }

    private getSignedArea(points: OutlinePoint[]): number {
        let area = 0;

        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            area += current.x * next.y - next.x * current.y;
        }

        return area * 0.5;
    }

    private isConvexCorner(a: OutlinePoint, b: OutlinePoint, c: OutlinePoint): boolean {
        return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 0;
    }

    private isPointInTriangle(point: OutlinePoint, a: OutlinePoint, b: OutlinePoint, c: OutlinePoint): boolean {
        const area = (p1: OutlinePoint, p2: OutlinePoint, p3: OutlinePoint) =>
            (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
        const d1 = area(point, a, b);
        const d2 = area(point, b, c);
        const d3 = area(point, c, a);
        const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
        const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;

        return !(hasNegative && hasPositive);
    }

    private outlinePointKey(point: OutlinePoint): string {
        return `${point.x}_${point.y}`;
    }

    private getImageLayerPositionOffset(def: BlockDef, block: Node): Vec2 {
        if (def.colorGroup === 'green') {
            return this.getGreenImageLayerPositionOffset(def, block);
        }

        if (def.colorGroup === 'purple') {
            return this.getPurpleImageLayerPositionOffset(def, block);
        }

        if (def.colorGroup === 'red') {
            return this.getRedImageLayerPositionOffset(def, block);
        }

        if (def.colorGroup !== 'blue') {
            return new Vec2(0, 0);
        }

        if (def.id === 'square_left') {
            return new Vec2(
                this.blueSquare1ImageOffsetX / Math.max(0.001, block.scale.x),
                this.blueSquare1ImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        if (def.id === 'l1_top') {
            return new Vec2(
                this.blueL1ImageOffsetX / Math.max(0.001, block.scale.x),
                this.blueL1ImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        return new Vec2(0, 0);
    }

    private getGreenImageLayerPositionOffset(def: BlockDef, block: Node): Vec2 {
        if (def.id === 'square_top_left') {
            return new Vec2(
                this.greenSquareTopLeftImageOffsetX / Math.max(0.001, block.scale.x),
                this.greenSquareTopLeftImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        if (def.id === 'square_bottom_left') {
            return new Vec2(
                this.greenSquareBottomLeftImageOffsetX / Math.max(0.001, block.scale.x),
                this.greenSquareBottomLeftImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        if (def.id === 'rec21_top_next_to_square') {
            return new Vec2(
                this.greenRec21ImageOffsetX / Math.max(0.001, block.scale.x),
                this.greenRec21ImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        return new Vec2(0, 0);
    }

    private getPurpleImageLayerPositionOffset(def: BlockDef, block: Node): Vec2 {
        if (def.id === 'l21_flip_left') {
            return new Vec2(
                this.purpleL21ImageOffsetX / Math.max(0.001, block.scale.x),
                this.purpleL21ImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        if (def.id === 'rec21_top') {
            return new Vec2(
                this.purpleRec21ImageOffsetX / Math.max(0.001, block.scale.x),
                this.purpleRec21ImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        return new Vec2(0, 0);
    }

    private getRedImageLayerPositionOffset(def: BlockDef, block: Node): Vec2 {
        if (def.id === 'rec21_bottom') {
            return new Vec2(
                this.redRec21ImageOffsetX / Math.max(0.001, block.scale.x),
                this.redRec21ImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        if (def.id === 'square2_bottom_right') {
            return new Vec2(
                this.redSquare2ImageOffsetX / Math.max(0.001, block.scale.x),
                this.redSquare2ImageOffsetZ / Math.max(0.001, block.scale.z),
            );
        }

        return new Vec2(0, 0);
    }

    private getImageSliceEdgeOffsetZ(
        def: BlockDef,
        bounds: ColorGroupBounds,
        blockCols: number,
        blockRows: number,
        totalRows: number,
    ): number {
        const safeTotalRows = Math.max(1, totalRows);
        const sliceCenterY = (def.targetRow - bounds.minRow + blockRows * 0.5) / safeTotalRows;

        const shapeMultiplier = this.getImageSliceEdgeOffsetMultiplier(blockCols, blockRows);
        const edgeOffset = (
            Math.max(0, this.imageLayerOffsetZ) +
            Math.max(0, this.imageSliceEdgeOffsetZ)
        ) * shapeMultiplier;
        const direction = sliceCenterY < 0.5 ? 1 : sliceCenterY > 0.5 ? -1 : 0;
        const balancedDistanceFromCenter = Math.min(
            Math.abs(0.5 - sliceCenterY),
            0.5 / safeTotalRows,
        );

        return direction * balancedDistanceFromCenter * edgeOffset;
    }

    private getImageLayerWorldSize(
        desiredWidth: number,
        desiredLength: number,
        texture: Texture2D,
        tilingX: number,
        tilingY: number,
        scaleMultiplier: number,
        preserveAspectRatio: boolean,
    ): { width: number; length: number } {
        const safeMultiplier = Math.max(0.01, scaleMultiplier);
        const maxWidth = desiredWidth * safeMultiplier;
        const maxLength = desiredLength * safeMultiplier;

        if (!preserveAspectRatio) {
            return { width: maxWidth, length: maxLength };
        }

        const textureWidth = Math.max(1, texture.width);
        const textureHeight = Math.max(1, texture.height);
        const sampledAspect = (textureWidth * Math.max(0.001, tilingX)) / (textureHeight * Math.max(0.001, tilingY));
        const slotAspect = maxWidth / Math.max(0.001, maxLength);

        if (slotAspect > sampledAspect) {
            return {
                width: maxLength * sampledAspect,
                length: maxLength,
            };
        }

        return {
            width: maxWidth,
            length: maxWidth / sampledAspect,
        };
    }

    private getImageScaleMultiplier(def: BlockDef): number {
        if (def.colorGroup === 'green') {
            return this.greenImageScaleMultiplier;
        }

        if (def.colorGroup === 'purple') {
            return this.purpleImageScaleMultiplier;
        }

        if (def.colorGroup !== 'blue') {
            return this.imageScaleMultiplier;
        }

        if (def.id === 'l1_top') {
            return this.blueL1ImageScaleMultiplier;
        }

        return this.blueImageScaleMultiplier;
    }

    private shouldPreserveImageAspectRatio(def: BlockDef): boolean {
        if (def.colorGroup === 'purple') {
            return this.purplePreserveImageAspectRatio;
        }

        return this.preserveImageAspectRatio || def.colorGroup === 'blue';
    }

    private getImageSliceEdgeOffsetMultiplier(blockCols: number, blockRows: number): number {
        if (blockCols === blockRows) {
            return Math.max(0, this.squareImageSliceEdgeOffsetMultiplier);
        }

        return Math.max(0, this.rectImageSliceEdgeOffsetMultiplier);
    }

    private buildColorGroupBounds(defs: BlockDef[]): Map<string, ColorGroupBounds> {
        const boundsByGroup: Map<string, ColorGroupBounds> = new Map();

        for (const def of defs) {
            const group = def.colorGroup;
            const existing = boundsByGroup.get(group) || {
                minCol: Number.POSITIVE_INFINITY,
                minRow: Number.POSITIVE_INFINITY,
                maxCol: Number.NEGATIVE_INFINITY,
                maxRow: Number.NEGATIVE_INFINITY,
            };

            for (const cell of def.shape) {
                const col = def.targetCol + cell.x;
                const row = def.targetRow + cell.y;

                existing.minCol = Math.min(existing.minCol, col);
                existing.minRow = Math.min(existing.minRow, row);
                existing.maxCol = Math.max(existing.maxCol, col);
                existing.maxRow = Math.max(existing.maxRow, row);
            }

            boundsByGroup.set(group, existing);
        }

        return boundsByGroup;
    }

    private applyColorGroupMaterial(block: Node, def: BlockDef) {
        const group = this.getColorGroupVisual(def.colorGroup);

        if (!group) {
            return;
        }

        for (const renderer of block.getComponentsInChildren(MeshRenderer)) {
            try {
                let material = renderer.sharedMaterial;

                if (this.baseMaterial) {
                    material.copy(this.baseMaterial);
                } else {
                    material.initialize({
                        effectName: 'builtin-standard',
                    });
                }

                // Set color and glossy properties
                this.trySetMaterialProperty(material, 'albedo', group.color);
                this.trySetMaterialProperty(material, 'mainColor', group.color);

                // Lower roughness for a shinier, more "jelly/plastic" highlight
                this.trySetMaterialProperty(material, 'roughness', 0.1);
                this.trySetMaterialProperty(material, 'metallic', 0.0);
                this.trySetMaterialProperty(material, 'specularIntensity', 1.0);

                // Reduce emissive so the bottom of the blocks can actually become dark
                const emissive = new Color(
                    Math.min(255, group.color.r * 0.15),
                    Math.min(255, group.color.g * 0.15),
                    Math.min(255, group.color.b * 0.15),
                    255
                );
                this.trySetMaterialProperty(material, 'emissive', emissive);
                console.log("Renderer:", renderer.node.name);
                console.log("Mesh:", renderer.mesh);
                console.log("Material passes:", material.passes);
                console.log("BaseMaterial:", this.baseMaterial);
                renderer.setMaterial(material, 0);
            } catch (err) {
                console.error(`Failed to apply standard material to ${def.id}:`, err);

                // Fallback to unlit so the block at least shows up
                const fallback = new Material();
                fallback.initialize({ effectName: 'builtin-unlit' });
                this.trySetMaterialProperty(fallback, 'mainColor', group.color);
                renderer.setMaterial(fallback, 0);
            }
        }
    }

    private getColorGroupVisual(colorGroup: string): { texture: Texture2D | null; color: Color; borderColor: Color } | null {
        switch (colorGroup) {
            case 'green':
                return { texture: this.greenTexture, color: this.greenColor, borderColor: this.greenBorderColor };
            case 'purple':
                return { texture: this.purpleTexture, color: this.purpleColor, borderColor: this.purpleBorderColor };
            case 'blue':
                return { texture: this.blueTexture, color: this.blueColor, borderColor: this.blueBorderColor };
            case 'red':
                return { texture: this.redTexture, color: this.redColor, borderColor: this.redBorderColor };
            default:
                return null;
        }
    }

    public getColorForGroup(colorGroup: string): Color {
        const visual = this.getColorGroupVisual(colorGroup);
        return visual ? visual.color : new Color(255, 255, 255, 255);
    }

    public getTextureForGroup(colorGroup: string): Texture2D | null {
        const visual = this.getColorGroupVisual(colorGroup);
        return visual ? visual.texture : null;
    }

    private trySetMaterialProperty(material: Material, propertyName: string, value: any) {
        try {
            material.setProperty(propertyName, value);
        } catch {
            // Different builtin/imported effects expose different property names.
        }
    }

    private gridToWorld(col: number, row: number): Vec3 {
        if (!this.boardPreview) {
            return new Vec3();
        }

        const layout = this.boardPreview.getBoardLayout();
        const x = layout.centerX + (col - (this.boardPreview.cols - 1) * 0.5) * layout.cellStep;
        const z = layout.centerZ + (row - (this.boardPreview.rows - 1) * 0.5) * layout.cellStep;

        return new Vec3(x, this.blockY, z);
    }

    private gridAreaToWorld(col: number, row: number, blockCols: number, blockRows: number): Vec3 {
        return this.gridToWorld(col + (blockCols - 1) * 0.5, row + (blockRows - 1) * 0.5);
    }

    private rectShape(cols: number, rows: number): Vec2[] {
        const shape: Vec2[] = [];

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                shape.push(new Vec2(col, row));
            }
        }

        return shape;
    }

    private getShapeSize(shape: Vec2[]): { cols: number; rows: number } {
        let maxCol = 0;
        let maxRow = 0;

        for (const cell of shape) {
            maxCol = Math.max(maxCol, cell.x);
            maxRow = Math.max(maxRow, cell.y);
        }

        return {
            cols: maxCol + 1,
            rows: maxRow + 1,
        };
    }

    private getGridAreaSize(cellCount: number, cellSize: number, cellStep: number): number {
        const size = cellSize + (Math.max(1, cellCount) - 1) * cellStep;
        return size * Math.max(0.1, this.blockFitRatio);
    }

    private alignVisualsToFootprint(block: Node, blockSize: { cols: number; rows: number }) {
        if (!block.isValid) {
            return;
        }

        const bounds = this.getRenderBoundsXZ(block);
        if (!bounds) {
            return;
        }

        const boundsRefWorld = this.alignVisualToFootprintMin
            ? new Vec3(bounds.minX, block.worldPosition.y, bounds.minZ)
            : new Vec3(
                (bounds.minX + bounds.maxX) * 0.5,
                block.worldPosition.y,
                (bounds.minZ + bounds.maxZ) * 0.5,
            );
        const footprintRefLocal = this.alignVisualToFootprintMin
            ? this.getFootprintMinLocal(block, blockSize)
            : new Vec3(0, 0, 0);
        const boundsRefLocal = new Vec3();

        block.inverseTransformPoint(boundsRefLocal, boundsRefWorld);

        const offsetX = footprintRefLocal.x - boundsRefLocal.x;
        const offsetZ = footprintRefLocal.z - boundsRefLocal.z;

        for (const child of this.getVisualChildren(block)) {
            child.setPosition(
                child.position.x + offsetX,
                child.position.y,
                child.position.z + offsetZ,
            );
        }
    }

    private getFootprintMinLocal(block: Node, blockSize: { cols: number; rows: number }): Vec3 {
        if (!this.boardPreview) {
            return new Vec3();
        }

        const layout = this.boardPreview.getBoardLayout();
        const scale = block.scale;
        const minX = -((blockSize.cols - 1) * 0.5 + 0.5) * layout.cellStep / Math.max(0.001, scale.x);
        const minZ = -((blockSize.rows - 1) * 0.5 + 0.5) * layout.cellStep / Math.max(0.001, scale.z);

        return new Vec3(minX, 0, minZ);
    }

    private applyVisualOffset(block: Node, offsetX: number, offsetZ: number) {
        if (offsetX === 0 && offsetZ === 0) {
            return;
        }

        const scale = block.scale;
        const localOffsetX = offsetX / Math.max(0.001, scale.x);
        const localOffsetZ = offsetZ / Math.max(0.001, scale.z);

        for (const child of this.getVisualChildren(block)) {
            child.setPosition(
                child.position.x + localOffsetX,
                child.position.y,
                child.position.z + localOffsetZ,
            );
        }
    }

    private getRenderBoundsXZ(block: Node): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
        if (!block.isValid) {
            return null;
        }

        const renderers = block.getComponentsInChildren(MeshRenderer);
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minZ = Number.POSITIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;

        block.updateWorldTransform();

        for (const renderer of renderers) {
            if (renderer.node.name === 'ImageLayer' || renderer.node.name === 'ImageBorder') {
                continue;
            }

            const bounds = renderer.model?.worldBounds;
            if (!bounds) {
                continue;
            }

            const half = bounds.halfExtents;
            const center = bounds.center;

            minX = Math.min(minX, center.x - half.x);
            maxX = Math.max(maxX, center.x + half.x);
            minZ = Math.min(minZ, center.z - half.z);
            maxZ = Math.max(maxZ, center.z + half.z);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
            return null;
        }

        return { minX, maxX, minZ, maxZ };
    }

    private applyVisualRotation(block: Node, rotationY: number) {
        for (const child of this.getVisualChildren(block)) {
            child.setRotationFromEuler(0, rotationY, 0);
        }
    }

    private getVisualChildren(block: Node): Node[] {
        return block.children.filter((child) => !child.name.startsWith('__CellCollider') && !child.name.startsWith('__PickCollider') && child.name !== 'ImageLayer' && child.name !== 'ImageBorder');
    }

    private disablePrefabColliders(block: Node) {
        for (const collider of block.getComponentsInChildren(BoxCollider)) {
            collider.enabled = false;
        }
    }

    private rebuildCellColliders(block: Node, shape: Vec2[]) {
        if (!this.boardPreview) {
            return;
        }

        for (const child of [...block.children]) {
            if (child.name.startsWith('__CellCollider')) {
                child.destroy();
            }
        }

        const layout = this.boardPreview.getBoardLayout();
        const blockSize = this.getShapeSize(shape);
        const scale = block.scale;
        const centerCol = (blockSize.cols - 1) * 0.5;
        const centerRow = (blockSize.rows - 1) * 0.5;
        const colliderSize = layout.cellSize * Math.max(0.1, this.colliderFillRatio);

        for (let i = 0; i < shape.length; i++) {
            const cell = shape[i];
            const colliderNode = new Node(`__CellCollider_${i}`);
            const collider = colliderNode.addComponent(BoxCollider);

            colliderNode.setParent(block);
            colliderNode.setPosition(
                (cell.x - centerCol) * layout.cellStep / Math.max(0.001, scale.x),
                this.colliderY / Math.max(0.001, scale.y),
                (cell.y - centerRow) * layout.cellStep / Math.max(0.001, scale.z),
            );

            collider.center = new Vec3(0, 0, 0);
            collider.size = new Vec3(
                colliderSize / Math.max(0.001, scale.x),
                this.colliderHeight / Math.max(0.001, scale.y),
                colliderSize / Math.max(0.001, scale.z),
            );
        }
    }

    private rebuildPickCollider(block: Node, shape: Vec2[], blockSize: { cols: number; rows: number }) {
        if (!this.boardPreview) {
            return;
        }

        for (const child of [...block.children]) {
            if (child.name.startsWith('__PickCollider')) {
                child.destroy();
            }
        }

        const layout = this.boardPreview.getBoardLayout();
        const scale = block.scale;
        const padding = Math.max(0, this.pickColliderPadding);
        const centerCol = (blockSize.cols - 1) * 0.5;
        const centerRow = (blockSize.rows - 1) * 0.5;

        if (this.isRectShape(shape, blockSize)) {
            const width = layout.cellSize + (Math.max(1, blockSize.cols) - 1) * layout.cellStep;
            const height = layout.cellSize + (Math.max(1, blockSize.rows) - 1) * layout.cellStep;

            this.addPickCollider(
                block,
                '__PickCollider',
                0,
                0,
                width + padding * 2,
                height + padding * 2,
                scale,
            );
            return;
        }

        const cellPickSize = layout.cellStep + padding * 2;
        for (let i = 0; i < shape.length; i++) {
            const cell = shape[i];
            this.addPickCollider(
                block,
                `__PickCollider_${i}`,
                (cell.x - centerCol) * layout.cellStep,
                (cell.y - centerRow) * layout.cellStep,
                cellPickSize,
                cellPickSize,
                scale,
            );
        }
    }

    private addPickCollider(
        block: Node,
        name: string,
        offsetX: number,
        offsetZ: number,
        width: number,
        height: number,
        scale: Vec3,
    ) {
        const pickNode = new Node(name);
        const collider = pickNode.addComponent(BoxCollider);

        pickNode.setParent(block);
        pickNode.setPosition(
            offsetX / Math.max(0.001, scale.x),
            this.colliderY / Math.max(0.001, scale.y),
            offsetZ / Math.max(0.001, scale.z),
        );

        collider.center = new Vec3(0, 0, 0);
        collider.size = new Vec3(
            width / Math.max(0.001, scale.x),
            this.colliderHeight / Math.max(0.001, scale.y),
            height / Math.max(0.001, scale.z),
        );
    }

    private isRectShape(shape: Vec2[], blockSize: { cols: number; rows: number }): boolean {
        return shape.length === Math.max(1, blockSize.cols) * Math.max(1, blockSize.rows);
    }
}
