/* tslint:disable:no-bitwise */

export class BoundedGridCalculator {
    constructor() {   }

    constraints: Stratton.GameOfLife.IGridContraints;
    private statebuffer: Int32Array[];
    private bufferInUse = 0;
    private generation: number;

    readonly neighbours: Stratton.GameOfLife.IPoint[] = [
        {x: -1, y: -1}, {x:  0, y: -1}, {x:  1, y: -1},
        {x: -1, y:  0},               , {x:  1, y:  0},
        {x: -1, y:  1}, {x:  0, y:  1}, {x:  1, y:  1}
    ];

    tick(): void {
        const nextBuffer = (this.bufferInUse + 1) % 2;
        const source = this.statebuffer[this.bufferInUse];
        const destination = this.statebuffer[nextBuffer];

        for (let index = 0; index < this.dataSize; index++) {
            destination[index] = this.calculateCellState(source, index);
        }
        this.bufferInUse = nextBuffer;
        this.generation++;
    }

    reset(): void {
        this.statebuffer = [new Int32Array(this.dataSize), new Int32Array(this.dataSize)];
    }

    randomize(): void {
        for (let n = 0; n < this.dataSize * .3; n++) {
            const randomIndex = Math.random() * this.dataSize;
            this.state[randomIndex | 0] = this.constraints.livingColor;
        }
    }

    private calculateCellState(buffer: Int32Array, index: number): number {
        const cellIsCurrentlyAlive = buffer[index] !== this.constraints.deathColor;
        const livingNeighbourData = this.getLiveData(buffer, index);
        const livingNeighbourCount = livingNeighbourData.count;
        const nextGenIsAlive = cellIsCurrentlyAlive
        ? livingNeighbourCount === 2 || livingNeighbourCount === 3
        : livingNeighbourCount === 3;

        return nextGenIsAlive ? livingNeighbourData.color : this.constraints.deathColor;
    }

    private getLiveData(buffer: Int32Array, index: number): {count: number, color: number} {
        const x = index % this.constraints.cols;
        const y = index / this.constraints.cols | 0;

        const sparseArray = this.neighbours.reduce((acc, point) => {
            // const dx = point.x + x;
            // const dy = point.y + y;
            let dx = point.x + x;
            let dy = point.y + y;

            if (this.constraints.isTorus) {
                dx = (dx + this.constraints.cols) % this.constraints.cols;
                dy = (dy + this.constraints.rows) % this.constraints.rows;
            }

            if (dx >= 0 && dx < this.constraints.cols &&
                dy >= 0 && dy < this.constraints.rows) {
                    const neighbourIndex = dy * this.constraints.cols + dx;
                    const id = buffer[neighbourIndex];
                    if (id !== this.constraints.deathColor) {
                        if (!(id in acc)) {
                            acc[id] = 0;
                        }
                        acc[id]++;
                    }
            }

            return acc;
        }, {});

        const sorted = Object.entries<number>(sparseArray).sort((a, b) => b[1] - a[1]);
        let color: number;
        if (sorted.length === 0) {
            color = this.constraints.deathColor;
        } else if (sorted.length === 1 || sorted[0][1] > sorted[1][1]) {
            color = Number(sorted[0][0]);
        } else {
            color = this.constraints.livingColor;
        }

        return {
            count: Object.values<number>(sparseArray).reduce((a, b) => a + b, 0),
            color: color
        };
    }

    get dataSize(): number {
        return this.constraints.cols * this.constraints.rows;
    }

    get state(): Int32Array {
        return this.statebuffer[this.bufferInUse];
    }

    set state(newState: Int32Array) {
// do something
    }
}
