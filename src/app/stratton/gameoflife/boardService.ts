/* tslint:disable:no-bitwise */
import { Injectable, Inject } from '@angular/core';
import { InjectToken} from './gameOfLife.injection';
import { WebWorkerHost } from './webWorkerHost';
import { BoundedGridCalculator } from './boundedGridCalculator';

@Injectable()
export class BoardService implements Stratton.GameOfLife.IBoardService {

    renderer: Stratton.GameOfLife.IRenderer;
    gridCalculator: WebWorkerHost<BoundedGridCalculator>;
    generation: number;
    constraints: Stratton.GameOfLife.IConstraints;

    constructor(@Inject(InjectToken.IGlobalReference) private globalReference: Stratton.IGlobalReference) {
        this.constraints = {
            frameDelay: 50
        };

        this.reset();
    }

    reset(): void {
        this.gridCalculator
            .call(x => x.reset)
            .then(() => this.render());
    }

    randomize(): void {
        this.gridCalculator
            .call(x => x.randomize)
            .then(() => this.render());
    }

    render(): void {
        if (this.renderer) {
            this.gridCalculator
                .call(x => x.state)
                .then((state: Int32Array) => {
                    this.renderer.render(state, this.constraints);
                });
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

                this.gridCalculator
                    .call(c => c.constraints)
                    .then((constraints: Stratton.GameOfLife.IGridContraints) => {
                        constraints.rows = image.height;
                        constraints.cols = image.width;
                        return this.gridCalculator.call(c => c.state);
                    })
                    .then((state: Int32Array) => {
                        for (let n = 0; n < imageData.data.length; n += 4) {
                            const data = imageData.data;
                            const color = (data[n] << 16) | (data[n + 1] << 8) | data[n + 2];
                            state[n / 4 | 0] = color;
                        }
                        return this.gridCalculator.set(c => c.state, state);
                    })
                    .then(() => this.gridCalculator.call(x => x.reset()))
                    .then(() => resolve());
            };
            image.onerror = (evt) => {
                reject(evt);
            };
            image.src = url;
        });
    }
}
/* tslint:enable:no-bitwise */
