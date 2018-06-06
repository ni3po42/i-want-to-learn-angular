/* tslint:disable:no-bitwise */

export class BoundedGridCalculator {
    constructor() {   }

    private constraints: Stratton.GameOfLife.IGridContraints;
    private statebuffer: Int32Array[];
    private bufferInUse = 0;
    private generation: number;

    readonly neighbours: Stratton.GameOfLife.IPoint[] = [
        {x: -1, y: -1}, {x:  0, y: -1}, {x:  1, y: -1},
        {x: -1, y:  0},                 {x:  1, y:  0},
        {x: -1, y:  1}, {x:  0, y:  1}, {x:  1, y:  1}
    ];

    tick(): Promise<void> {
        const nextBuffer = (this.bufferInUse + 1) % 2;
        const source = this.statebuffer[this.bufferInUse];
        const destination = this.statebuffer[nextBuffer];

        for (let index = 0; index < this.getDataSize(); index++) {
            destination[index] = this.calculateCellState(source, index);
        }
        this.bufferInUse = nextBuffer;
        this.generation++;
        return Promise.resolve();
    }

    reset(): Promise<void> {
        this.statebuffer = [new Int32Array(this.getDataSize()), new Int32Array(this.getDataSize())];
        return Promise.resolve();
    }

    randomize(): Promise<void> {
        for (let n = 0; n < this.getDataSize() * .3; n++) {
            const randomIndex = Math.random() * this.getDataSize();
            this.statebuffer[this.bufferInUse][randomIndex | 0] = this.constraints.livingColor;
        }
        return Promise.resolve();
    }

    getState(): Promise<Int32Array> {
        return Promise.resolve(this.statebuffer[this.bufferInUse]);
    }

    setState(newState: Int32Array): Promise<Int32Array> {
        return this.reset().then(() => this.statebuffer[this.bufferInUse] = newState);
    }

    getConstraints(): Promise<Stratton.GameOfLife.IGridContraints> {
        return Promise.resolve(this.constraints);
    }

    setConstraints(newConstraints: Stratton.GameOfLife.IGridContraints): Promise<Stratton.GameOfLife.IGridContraints> {
        return Promise.resolve(this.constraints = newConstraints);
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

    private getDataSize(): number {
        return this.constraints.cols * this.constraints.rows;
    }
}
