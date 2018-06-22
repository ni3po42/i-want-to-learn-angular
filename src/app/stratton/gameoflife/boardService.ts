/* tslint:disable:no-bitwise */
import { Injectable, Inject } from '@angular/core';
import { InjectToken} from './gameOfLife.injection';
import { WebWorkerHost } from './webWorkerHost';
import { BoundedGridCalculator } from './boundedGridCalculator';

@Injectable()
export class BoardService implements Stratton.GameOfLife.IBoardService {

    renderer: Stratton.GameOfLife.IRenderer;
    gridCalculatorHost: WebWorkerHost<BoundedGridCalculator>;
    gridCalculator: BoundedGridCalculator;
    generation: number;
    subGridConstraints: Stratton.GameOfLife.IGridContraints;

    constructor(@Inject(InjectToken.IGlobalReference) private globalReference: Stratton.IGlobalReference) {

        this.subGridConstraints = {
            cols: 32,
            rows: 32,
            deathColor: 0x000000,
            livingColor: 0xFFFFFF,
            isTorus: false
        };

        this.gridCalculatorHost = new WebWorkerHost(BoundedGridCalculator);
        this.gridCalculator = this.gridCalculatorHost.proxy;
        this.gridCalculator.constraints = this.subGridConstraints;

        this.reset();
    }

    async reset() {
        await this.gridCalculator.reset();
        this.render();
    }

    async randomize() {
        await this.gridCalculator.randomize();
        this.render();
    }

    async tick() {
        await this.gridCalculator.tick();
    }

    async render() {
        if (this.renderer) {
            const state = this.gridCalculator.state;
            this.renderer.render(state, this.subGridConstraints);
        }
    }

    loadFromFile(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();

            image.onload = async () => {
                URL.revokeObjectURL(url);
                const context = this.globalReference.document.createElement('canvas').getContext('2d');
                context.canvas.width = image.width;
                context.canvas.height = image.height;
                context.mozImageSmoothingEnabled = false;
                context.webkitImageSmoothingEnabled = false;
                context.imageSmoothingEnabled = false;
                context.drawImage(image, 0, 0);
                const imageData = context.getImageData(0, 0, image.width, image.height);
                this.subGridConstraints.cols = image.width;
                this.subGridConstraints.rows = image.height;

                this.gridCalculator.constraints = this.subGridConstraints;

                const state = new Int32Array(image.width * image.height);

                for (let n = 0; n < imageData.data.length; n += 4) {
                    const data = imageData.data;
                    const color = (data[n] << 16) | (data[n + 1] << 8) | data[n + 2];
                    state[n / 4 | 0] = color;
                }

                this.gridCalculator.state = state;

                resolve();
            };

            image.onerror = reject;
            image.src = url;
        });
    }
}
/* tslint:enable:no-bitwise */
