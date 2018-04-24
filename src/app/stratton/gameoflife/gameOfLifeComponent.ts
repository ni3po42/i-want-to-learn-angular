import {
    Component, OnInit, ElementRef, ViewChild,
    OnDestroy, NgZone, InjectionToken, Inject, AfterViewInit, QueryList } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { RendererSelectorComponent, GameOfLifeRendererEnum } from './renderers/RenderSelectorComponent';

import { InjectToken} from './gameOfLife.injection';

import { WebWorkerHost } from './webWorkerHost';
import { ExampleActivity } from './exampleActivity';

//
import { BoardService } from './boardService';
//

@Component({
    selector: 'app-game-of-life',
    templateUrl: './gameOfLifeTemplate.html',
    styles: [':host { background-color: #000000']
})
export class GameOfLifeComponent implements OnDestroy {

    isRunning = false;
    lastRenderTimestamp: number = null;
    renderer: RendererSelectorComponent;

    constructor(
        // @Inject(InjectToken.IBoardService) private boardService: Stratton.GameOfLife.IBoardService,
        private boardService: BoardService,
        @Inject(InjectToken.IGlobalReference) private globalReference: Stratton.IGlobalReference,
        private ngZone: NgZone
    ) {
       }

    @ViewChild(RendererSelectorComponent)
    set rendererSelector(component: RendererSelectorComponent) {
        this.renderer = component;
        component.subscribe((renderer) => {
            const initState = !this.boardService.renderer;
            this.boardService.renderer = renderer;
            renderer.initialize(this.boardService.constraints);
            if (initState) {
               this.renderFrame(0);
           }
        });
    }

    ngOnDestroy(): void {
        this.stopGame();
    }

    get constraintModel(): Stratton.GameOfLife.IConstraints {
        return this.boardService.constraints;
    }

    get selectedRendererType(): string {
        if (!this.renderer) {
            return null;
        }
        return GameOfLifeRendererEnum[this.renderer.rendererType];
    }

    set selectedRendererType(type: string) {
        if (this.renderer) {
            this.renderer.rendererType = GameOfLifeRendererEnum[type];
        }
    }

    public startGame(): void {
        this.isRunning = true;
    }

    public stopGame(): void {
        this.isRunning = false;
    }

    public resetGame(): void {
        this.stopGame();
        this.boardService.reset();
    }

    public randomize(): void {
        this.isRunning = false;
        this.boardService.reset();
        this.boardService.randomize();
    }

    public loadFile(file: File) {
        console.log(file);
        this.boardService
            .loadFromFile(file)
            .then(() => {
                this.boardService.renderer.initialize(this.boardService.constraints);
                this.boardService.render();
            });
    }

    private renderFrame(timeStamp): void {
        if (this.isRunning) {
            this.boardService.tick();
        }

        if (this.lastRenderTimestamp === null) {
            this.lastRenderTimestamp = timeStamp;
        } else if (timeStamp - this.lastRenderTimestamp > this.constraintModel.frameDelay) {
            this.lastRenderTimestamp = timeStamp;
            this.ngZone.run(() => this.boardService.render());
        }
        this.globalReference.requestAnimationFrame((t) => this.renderFrame(t));
    }
}


