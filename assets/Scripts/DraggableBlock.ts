import { _decorator, Component, Vec2 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('DraggableBlock')
export class DraggableBlock extends Component {
    @property
    blockId: string = '';

    @property
    col: number = 0;

    @property
    row: number = 0;

    @property
    targetCol: number = 0;

    @property
    targetRow: number = 0;

    @property
    colorGroup: string = '';

    public shape: Vec2[] = [new Vec2(0, 0)];

    public setGridPosition(col: number, row: number) {
        this.col = col;
        this.row = row;
    }

    public setRectShape(cols: number, rows: number) {
        this.shape = [];

        for (let r = 0; r < Math.max(1, rows); r++) {
            for (let c = 0; c < Math.max(1, cols); c++) {
                this.shape.push(new Vec2(c, r));
            }
        }
    }

    public isAtTarget(): boolean {
        return this.col === this.targetCol && this.row === this.targetRow;
    }
}
