import { _decorator, Camera, Component, Node, Prefab, find, instantiate, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

type BoardLayout = {
    cellSize: number;
    cellStep: number;
    cellVisualSize: number;
    cellScale: number;
    boardWidth: number;
    boardHeight: number;
    centerX: number;
    centerZ: number;
};

@ccclass('BoardPreview')
export class BoardPreview extends Component {
    @property(Node)
    cellsRoot: Node | null = null;

    @property(Prefab)
    cellPrefab: Prefab | null = null;

    @property(Camera)
    camera: Camera | null = null;

    @property
    cols: number = 5;

    @property
    rows: number = 7;

    /**
     * Kich thuoc 1 o tinh theo world unit.
     * Neu autoFitToPortraitDesign = true, gia tri nay se duoc tinh lai tu 720x1280.
     */
    @property
    cellSize: number = 1;

    @property
    cellY: number = 0.08;

    /**
     * Kich thuoc goc cua mesh Cell_Blockmap trong world unit khi scale = 1.
     * Model import hien tai rat nho, nen khong the dung scale 1/2/8 co dinh.
     */
    @property
    prefabCellWorldSize: number = 0.05;

    @property
    cellVisualScaleMultiplier: number = 1;

    @property
    cellThickness: number = 0.08;

    /**
     * Giu lai field cu de scene khong mat serialize, nhung khong dung cho auto fit.
     */
    @property
    cellScale: number = 2;

    @property
    autoFitToPortraitDesign: boolean = true;

    @property
    designWidth: number = 720;

    @property
    designHeight: number = 1280;

    /**
     * Vung toi da danh cho board tren man doc 720x1280.
     * 600x760 de con cho top bar, target bar va bottom item bar.
     */
    @property
    boardMaxWidth: number = 600;

    @property
    boardMaxHeight: number = 760;

    /**
     * Kich thuoc board tren mat phang 3D, tinh bang world unit.
     * Camera hien tai orthoHeight = 5 nen board rong 6 world unit se bi cat tren mobile.
     */
    @property
    boardWorldWidth: number = 3.65;

    @property
    boardWorldHeight: number = 5.25;

    @property
    cameraOrthoHeight: number = 5;

    @property
    usePerspectiveCamera: boolean = true;

    @property
    cameraFov: number = 45;

    @property
    cameraPosY: number = 11;

    @property
    cameraPosZ: number = 6;

    @property
    cameraRotX: number = -60;

    @property
    fitCameraToPortrait: boolean = true;

    /**
     * Quy doi pixel thiet ke sang world unit.
     * 100px = 1 world unit giup board 6x7 rong khoang 5.6 world unit.
     */
    @property
    pixelsPerWorldUnit: number = 100;

    @property
    gapRatio: number = 0.045;

    @property
    cellFillRatio: number = 0.82;

    @property
    centerX: number = 0;

    @property
    centerZ: number = -1;

    private lastLayoutSignature = '';

    start() {
        this.applyPreview();
    }

    update() {
        const signature = this.getLayoutSignature();
        if (signature === this.lastLayoutSignature) {
            return;
        }

        this.applyPreview();
    }

    public applyPreview() {
        this.lastLayoutSignature = this.getLayoutSignature();
        this.resolveSceneReferences();
        this.resetBoardNodes();
        this.fitCamera();
        this.buildGrid();
    }

    public buildGrid() {
        if (!this.cellsRoot || !this.cellPrefab) {
            console.error('Chua keo CellsRoot hoac Cell_Blockmap vao BoardPreview');
            return;
        }

        this.cellsRoot.removeAllChildren();

        const layout = this.getBoardLayout();
        const firstCellX = layout.centerX - layout.boardWidth * 0.5 + layout.cellSize * 0.5;
        const firstCellZ = layout.centerZ + layout.boardHeight * 0.5 - layout.cellSize * 0.5;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = instantiate(this.cellPrefab);
                cell.name = `Cell_${r}_${c}`;
                cell.setParent(this.cellsRoot);

                const x = firstCellX + c * layout.cellStep;
                const z = firstCellZ - r * layout.cellStep;

                cell.setPosition(new Vec3(x, this.getRenderY(), z));
                cell.setScale(new Vec3(layout.cellScale, layout.cellScale, layout.cellScale));
            }
        }

        console.log(`BoardPreview built ${this.rows * this.cols} cells`, layout);
    }

    public gridToWorld(row: number, col: number): Vec3 {
        const layout = this.getBoardLayout();
        const firstCellX = layout.centerX - layout.boardWidth * 0.5 + layout.cellSize * 0.5;
        const firstCellZ = layout.centerZ + layout.boardHeight * 0.5 - layout.cellSize * 0.5;

        return new Vec3(
            firstCellX + col * layout.cellStep,
            this.getRenderY(),
            firstCellZ - row * layout.cellStep,
        );
    }

    public getBoardLayout(): BoardLayout {
        const safeCols = Math.max(1, this.cols);
        const safeRows = Math.max(1, this.rows);

        if (!this.autoFitToPortraitDesign) {
            return {
                cellSize: this.cellSize,
                cellStep: this.cellSize,
                cellVisualSize: this.cellSize,
                cellScale: this.cellScale,
                boardWidth: this.cellSize * safeCols,
                boardHeight: this.cellSize * safeRows,
                centerX: this.centerX,
                centerZ: this.centerZ,
            };
        }

        const maxWidth = this.boardWorldWidth > 0 ? this.boardWorldWidth : this.boardMaxWidth / Math.max(1, this.pixelsPerWorldUnit);
        const maxHeight = this.boardWorldHeight > 0 ? this.boardWorldHeight : this.boardMaxHeight / Math.max(1, this.pixelsPerWorldUnit);
        const gap = Math.max(0, this.gapRatio);
        const slotSize = Math.min(
            maxWidth / (safeCols + gap * (safeCols - 1)),
            maxHeight / (safeRows + gap * (safeRows - 1)),
        );
        const cellSize = slotSize;
        const cellStep = slotSize * (1 + gap);
        const cellVisualSize = slotSize * Math.max(0.1, this.cellFillRatio);

        return {
            cellSize,
            cellStep,
            cellVisualSize,
            cellScale: cellVisualSize / Math.max(0.001, this.prefabCellWorldSize) * this.cellVisualScaleMultiplier,
            boardWidth: slotSize * safeCols + slotSize * gap * (safeCols - 1),
            boardHeight: slotSize * safeRows + slotSize * gap * (safeRows - 1),
            centerX: this.centerX,
            centerZ: this.centerZ,
        };
    }

    private getRenderY(): number {
        return Math.max(this.cellY, this.cellThickness);
    }

    private resolveSceneReferences() {
        if (!this.camera) {
            const cameraNode = find('Main Camera');
            this.camera = cameraNode ? cameraNode.getComponent(Camera) : null;
        }
    }

    private resetBoardNodes() {
        this.node.setPosition(0, 0, 0);
        this.node.setRotationFromEuler(0, 0, 0);
        this.node.setScale(new Vec3(1, 1, 1));

        if (this.cellsRoot) {
            this.cellsRoot.setPosition(0, 0, 0);
            this.cellsRoot.setRotationFromEuler(0, 0, 0);
            this.cellsRoot.setScale(new Vec3(1, 1, 1));
        }
    }

    private fitCamera() {
        if (!this.fitCameraToPortrait || !this.camera) {
            return;
        }

        this.camera.projection = this.usePerspectiveCamera ? Camera.ProjectionType.PERSPECTIVE : Camera.ProjectionType.ORTHO;
        this.camera.orthoHeight = this.cameraOrthoHeight;
        this.camera.fov = this.cameraFov;
        this.camera.node.setPosition(0, this.cameraPosY, this.cameraPosZ);
        this.camera.node.setRotationFromEuler(this.cameraRotX, 0, 0);
    }

    private getLayoutSignature(): string {
        return [
            this.cols,
            this.rows,
            this.cellY,
            this.prefabCellWorldSize,
            this.cellVisualScaleMultiplier,
            this.cellThickness,
            this.cellScale,
            this.autoFitToPortraitDesign,
            this.boardWorldWidth,
            this.boardWorldHeight,
            this.cameraOrthoHeight,
            this.usePerspectiveCamera,
            this.cameraFov,
            this.cameraPosY,
            this.cameraPosZ,
            this.cameraRotX,
            this.fitCameraToPortrait,
            this.gapRatio,
            this.cellFillRatio,
            this.centerX,
            this.centerZ,
        ].join('|');
    }
}
