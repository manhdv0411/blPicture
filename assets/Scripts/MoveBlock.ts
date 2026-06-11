import { _decorator, Component, Enum, tween, Tween } from 'cc';

const { ccclass, property } = _decorator;
export enum MoveDir {
    Up = 0,
    Down = 1,
    Left = 2,
    Right = 3,
}

Enum(MoveDir);
@ccclass('MoveBlock')
export class MoveBlock extends Component {
    @property({ type: Enum(MoveDir) })
    moveDir: MoveDir = MoveDir.Right;

    @property
    cellStepX: number = 0.75;

    @property
    cellStepZ: number = 0.75;

    @property
    moveCells: number = 6;

    @property
    moveDuration: number = 0.35;

    @property
    destroyAfterMove: boolean = false;

    private isMoving = false;

    onDisable() {
        Tween.stopAllByTarget(this.node);
    }

    public slideOut() {
        this.slide(this.moveDir, this.moveCells, this.destroyAfterMove);
    }

    public slide(moveDir: MoveDir = this.moveDir, moveCells: number = this.moveCells, destroyAfterMove = false) {
        if (this.isMoving || !this.node.isValid) {
            return;
        }

        this.isMoving = true;

        const target = this.node.position.clone();
        const safeMoveCells = Math.max(1, moveCells);

        switch (moveDir) {
            case MoveDir.Up:
                target.z += this.cellStepZ * safeMoveCells;
                break;
            case MoveDir.Down:
                target.z -= this.cellStepZ * safeMoveCells;
                break;
            case MoveDir.Left:
                target.x -= this.cellStepX * safeMoveCells;
                break;
            case MoveDir.Right:
                target.x += this.cellStepX * safeMoveCells;
                break;
        }

        tween(this.node)
            .to(this.moveDuration, { position: target })
            .call(() => {
                this.isMoving = false;

                if (destroyAfterMove && this.node.isValid) {
                    this.node.destroy();
                }
            })
            .start();
    }
}

