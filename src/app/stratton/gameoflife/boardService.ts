/* tslint:disable:no-bitwise */
import { Injectable, Inject } from '@angular/core';
import { InjectToken} from './gameOfLife.injection';

@Injectable()
export class BoardService implements Stratton.GameOfLife.IBoardService {

    readonly constraints: Stratton.GameOfLife.IConstraints;
    renderer: Stratton.GameOfLife.IRenderer;
    statebuffer: Int32Array[];
    bufferInUse = 0;

    readonly neighbours: Stratton.GameOfLife.IPoint[] = [
        {x: -1, y: -1}, {x:  0, y: -1}, {x:  1, y: -1},
        {x: -1, y:  0},               , {x:  1, y:  0},
        {x: -1, y:  1}, {x:  0, y:  1}, {x:  1, y:  1}
    ];

    constructor(@Inject(InjectToken.IGlobalReference) private globalReference: Stratton.IGlobalReference) {
        this.constraints = {
            rows: 64,
            cols: 64,
            cellSizeInPixels: 10,
            isTorus: true,
            livingColor: 0xFFFFFF,
            deathColor: 0x000000,
            frameDelay: 50
        };

        this.reset();
    }

    reset(): void {
        this.statebuffer = [new Int32Array(this.dataSize), new Int32Array(this.dataSize)];
    }

    tick(): void {
        const nextBuffer = (this.bufferInUse + 1) % 2;
        const source = this.statebuffer[this.bufferInUse];
        const destination = this.statebuffer[nextBuffer];

        for (let index = 0; index < this.dataSize; index++) {
            destination[index] = this.calculateCellState(source, index);
        }

        this.bufferInUse = nextBuffer;
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

    render(): void {
        if (this.renderer) {
            this.renderer.render(this.state, this.constraints);
        }
    }

    loadFromFile(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(url);
                const context = this.globalReference.document.createElement('canvas').getContext('2d');
                context.canvas.width = image.width;
                context.canvas.height = image.height;
                context.mozImageSmoothingEnabled = false;
                context.webkitImageSmoothingEnabled = false;
                context.imageSmoothingEnabled = false;
                context.drawImage(image, 0, 0);
                const imageData = context.getImageData(0, 0, image.width, image.height);

                this.constraints.rows = image.height;
                this.constraints.cols = image.width;
                this.reset();

                for (let n = 0; n < imageData.data.length; n += 4) {
                    const data = imageData.data;
                    const color = (data[n] << 16) | (data[n + 1] << 8) | data[n + 2];
                    this.state[n / 4 | 0] = color;
                }
                resolve();
            };
            image.onerror = (evt) => {
                reject(evt);
            };
            image.src = url;
        });
    }
}
/* tslint:enable:no-bitwise */
