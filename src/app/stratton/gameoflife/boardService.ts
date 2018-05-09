/* tslint:disable:no-bitwise */
import { Injectable, Inject } from '@angular/core';
import { InjectToken} from './gameOfLife.injection';
import { WebWorkerHost } from './webWorkerHost';
import { BoundedGridCalculator } from './boundedGridCalculator';
import { async } from '@angular/core/testing';

@Injectable()
export class BoardService implements Stratton.GameOfLife.IBoardService {

    renderer: Stratton.GameOfLife.IRenderer;
    gridCalculator: WebWorkerHost<BoundedGridCalculator>;
    generation: number;
    constraints: Stratton.GameOfLife.IConstraints;

    constructor(@Inject(InjectToken.IGlobalReference) private globalReference: Stratton.IGlobalReference) {
        this.constraints = {
            frameDelay: 50,
            deathColor : 0x000000,
            livingColor : 0xFFFFFF,
            isTorus : true
        };

        this.reset();
    }

    reset(): void {
        this.gridCalculator.proxy
            .reset()
            .then(() => this.render());
    }

    randomize(): void {
        this.gridCalculator.proxy
            .randomize()
            .then(() => this.render());
    }

    render(): void {
        if (this.renderer) {
            this.gridCalculator.proxy
                .getState()
                .then((state: Int32Array) => {
                    this.renderer.render(state, this.constraints);
                });
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

                await this.gridCalculator.proxy.setConstraints({
                    cols : image.width,
                    rows : image.height,
                    deathColor: this.constraints.deathColor,
                    livingColor: this.constraints.livingColor,
                    isTorus: this.constraints.isTorus
                });

                const state = new Int32Array(image.width * image.height);

                for (let n = 0; n < imageData.data.length; n += 4) {
                    const data = imageData.data;
                    const color = (data[n] << 16) | (data[n + 1] << 8) | data[n + 2];
                    state[n / 4 | 0] = color;
                }

                await this.gridCalculator.proxy.setState(state);
                await this.gridCalculator.proxy.reset();
                resolve();
            };

            image.onerror = reject;
            image.src = url;
        });
    }
}
/* tslint:enable:no-bitwise */
