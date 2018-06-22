import { NgModule } from '@angular/core';
import { RouterModule, Route } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { StrattonComponent } from './stratton.component';

import { BoardService } from './gameoflife/boardService';
import { GameOfLifeComponent } from './gameoflife/gameOfLifeComponent';

import { RendererSelectorComponent } from './gameoflife/renderers/RenderSelectorComponent';

import { CanvasRendererComponent } from './gameoflife/renderers/CanvasRendererComponent';
import { TextRendererComponent } from './gameoflife/renderers/TextRendererComponent';
import { WebGlRendererComponent } from './gameoflife/renderers/WebGlRendererComponent';
import { GlslShaderDirective } from './gameoflife/renderers/GlslShaderDirective';
import { WebGlCanvasDirective } from './gameoflife/renderers/WebGlCanvasDirective';
import { WebGlObjectDirective } from './gameoflife/renderers/WebGlObjectDirective';
import { WebGlCameraDirective } from './gameoflife/renderers/WebGlCameraDirective';
import { MathDirective } from './gameoflife/mathDirective';
import { DropFileDirective } from './gameoflife/dropFileDirective';


import { HttpClientModule } from '@angular/common/http';

@NgModule({
    imports : [RouterModule, FormsModule, CommonModule, HttpClientModule],
    declarations: [
       StrattonComponent, GameOfLifeComponent , CanvasRendererComponent,
       TextRendererComponent, WebGlRendererComponent, MathDirective,
       WebGlCanvasDirective, WebGlObjectDirective, GlslShaderDirective,
       WebGlCameraDirective, DropFileDirective, RendererSelectorComponent
     ]
})
export class StrattonModule {

    // static method to allow module to define all routes availble
    public static GetRoute(rootPath: string): Route {

        return {
            path : rootPath,
            component : StrattonComponent
        };
    }
}


