import { Component, ElementRef, ViewChild, Inject } from '@angular/core';

import { InjectToken} from '../gameOfLife.injection';

@Component({
    selector: 'app-gameoflife-textrenderer',
    template: `<div #div></div>`
})
export class TextRendererComponent implements Stratton.GameOfLife.IRenderer {

    @ViewChild('div') element: ElementRef;

    constructor(@Inject(InjectToken.IGlobalReference) private globalReference: Stratton.IGlobalReference) {   }

    elementArray: HTMLElement[];
    rows = 0;
    cols = 0;
    colorDict: { [key: number]: string; } = {};

    shouldRebuild(constraints: Stratton.GameOfLife.IGridContraints): boolean {
        return constraints.rows !== this.rows || constraints.cols !== this.cols;
    }

    rebuildReferences(constraints: Stratton.GameOfLife.IGridContraints) {
        this.rows = constraints.rows;
        this.cols = constraints.cols;

        const div = this.element.nativeElement as HTMLElement;
        const divStyle = div.style;
        const document = this.globalReference.document;

        while (div.firstChild) {
            div.removeChild(div.firstChild);
        }

        this.elementArray = [];

        for (let r = 0; r < constraints.rows; r++) {
            const row = document.createElement('div');
            for (let c = 0; c < constraints.cols; c++) {
                const cell = document.createElement('i');
                cell.innerHTML = '#';
                cell.style.color = this.intToColor(constraints.deathColor);
                row.appendChild(cell);
                this.elementArray.push(cell);
            }
            div.appendChild(row);
        }

        divStyle.width = (constraints.cols * 10) + 'px';
        divStyle.height = (constraints.rows * 10) + 'px';
        divStyle.fontSize = 10 + 'px';
        divStyle.lineHeight = 10 + 'px';
        divStyle.margin = '0px auto';
        divStyle.overflowX = 'hidden';
        divStyle.overflowY = 'hidden';
        divStyle.backgroundColor = this.intToColor(constraints.deathColor);
    }

    initialize(constraints: Stratton.GameOfLife.IGridContraints) {
        this.rebuildReferences(constraints);
    }

    render(state: Int32Array, constraints: Stratton.GameOfLife.IGridContraints) {
        if (this.shouldRebuild(constraints)) {
            return;
        }

        this.elementArray.forEach((elm, index) => {
            elm.style.color = this.intToColor(state[index]);
        });
    }

    private intToColor(num: number) {
        if (!(num in this.colorDict)) {
            this.colorDict[num] = '#' + (0x1000000 + num).toString(16).substr(1, 6);
        }
        return this.colorDict[num];
    }
}
