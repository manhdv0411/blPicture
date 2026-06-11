export interface BlockConfig {
    id: number;
    prefabIndex: number;
    textureIndex: number;
    shape: number[][];
    startRow: number;
    startCol: number;
}

export interface LevelData {
    rows: number;
    cols: number;
    timeLimit: number;
    blocks: BlockConfig[];
}

export const LEVEL_01: LevelData = {
    rows: 5,
    cols: 5,
    timeLimit: 120,
    blocks: [
        { id: 1, prefabIndex: 0, textureIndex: 0, shape: [[1,0],[1,0],[1,1]], startRow: 0, startCol: 0 },
        { id: 2, prefabIndex: 1, textureIndex: 1, shape: [[1,1]],             startRow: 0, startCol: 2 },
        { id: 3, prefabIndex: 2, textureIndex: 2, shape: [[1],[1]],           startRow: 2, startCol: 3 },
        { id: 4, prefabIndex: 3, textureIndex: 3, shape: [[1,1],[1,1]],       startRow: 3, startCol: 1 },
        { id: 5, prefabIndex: 4, textureIndex: 4, shape: [[1,1,1]],           startRow: 4, startCol: 2 },
    ],
};