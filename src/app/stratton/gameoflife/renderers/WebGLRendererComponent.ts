/* tslint:disable:no-bitwise */

import { Component, ElementRef, ViewChild, ViewChildren, Inject, QueryList } from '@angular/core';

import { mat4, vec3 } from 'gl-matrix';

import { InjectToken } from '../gameOfLife.injection';

import { GlslShaderComponent } from './GlslShaderComponent';
import { WebGlCameraComponent } from './WebGlCameraComponent';

import { Observable } from 'rxjs/Observable';
import { zip } from 'rxjs/observable/zip';

@Component({
    selector: 'app-gameoflife-webglrenderer',
    templateUrl: './WebGlRendererTemplate.html'
})
export class WebGlRendererComponent implements Stratton.GameOfLife.IRenderer {
    vertexShaderSource: string;
    fragmentShaderSource: string;

    gl:  WebGLRenderingContext;
    message: string;

    isInitialized = false;
    program: WebGLProgram;
    vertexPosition: any;
    vertexColor: any;
    vertexNormal: any;
    projectionMatrix: WebGLUniformLocation;
    modelViewMatrix: WebGLUniformLocation;
    normalMatrix: WebGLUniformLocation;
    buffers: any;

    @ViewChild('canvas')
    set canvasElement(element: ElementRef) {
        this.gl = element.nativeElement.getContext('webgl');
    }

    @ViewChildren(GlslShaderComponent) shaders: QueryList<GlslShaderComponent>;
    @ViewChild(WebGlCameraComponent) camera: WebGlCameraComponent;

    constructor(@Inject(InjectToken.IGlobalReference) private globalReference: Stratton.IGlobalReference) {   }

/* the following code was lovingly lifted from, scraped
and repurposed into angular from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/ */

    initialize(constraints: Stratton.GameOfLife.IConstraints) {
        if (!this.gl) {
            this.message = 'WebGl is not supported in your browser';
            return;
        }

        zip(...this.shaders.toArray())
        .subscribe((shaderSources) => {
            this.vertexShaderSource = shaderSources
            .find(x => x.shaderType === 'vertex')
            .source;

            this.fragmentShaderSource = shaderSources
            .find(x => x.shaderType === 'fragment')
            .source;

            this.initShaderProgram();
            this.initBuffers();
            this.initAttributes();
            this.loadCube();
            this.isInitialized = true;
        });
    }

    render(state: Int8Array, constraints: Stratton.GameOfLife.IConstraints) {
        if (!this.isInitialized) {
            return;
        }

        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
        this.gl.clearDepth(1.0);                 // Clear everything
        this.gl.enable(this.gl.DEPTH_TEST);           // Enable depth testing
        this.gl.depthFunc(this.gl.LEQUAL);            // Near things obscure far things

        // Clear the canvas before we start drawing on it.

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        const normalMatrix = mat4.create();
        mat4.invert(normalMatrix, this.camera.modelViewMatrix);
        mat4.transpose(normalMatrix, normalMatrix);

        // Tell WebGL to use our program when drawing
        this.gl.useProgram(this.program);

        // Set the shader uniforms
        this.gl.uniformMatrix4fv(
            this.projectionMatrix,
            false,
            this.camera.projectionMatrix);
        this.gl.uniformMatrix4fv(
            this.modelViewMatrix,
            false,
            this.camera.modelViewMatrix);

        this.gl.uniformMatrix4fv(
            this.normalMatrix,
            false,
            normalMatrix);

        {
            const currentModelView = mat4.create();
            for (let i = 0; i < state.length; i++) {
                if (state[i]) {
                    const x = (i % constraints.cols) - constraints.cols / 2;
                    const y = (i / constraints.cols | 0) - constraints.rows / 2;

                    mat4.translate(currentModelView, this.camera.modelViewMatrix, [x, y, 0.0]);
                    mat4.scale(currentModelView, currentModelView, [0.5, 0.5, 0.5]);
                    this.gl.uniformMatrix4fv(
                        this.modelViewMatrix,
                        false,
                        currentModelView);

                    this.gl.drawElements(this.gl.TRIANGLES, 36, this.gl.UNSIGNED_SHORT, 0);
                }
            }
        }
    }

    private initShaderProgram() {
        if (this.program) {
            const shaders = this.gl.getAttachedShaders(this.program);
            for (let i = 0; shaders && i < shaders.length; i++) {
                this.gl.deleteShader(shaders[i]);
            }
            this.gl.deleteProgram(this.program);
        }

        const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, this.vertexShaderSource);
        const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, this.fragmentShaderSource);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            this.message = 'Parameter issue';
            if (this.program) {
                this.gl.deleteProgram(this.program);
                this.program = null;
            }
        }
    }

    private loadCube() {
        // Tell WebGL how to pull out the positions from the position
        // buffer into the vertexPosition attribute.
        {
            const numComponents = 3;  // pull out 2 values per iteration
            const type = this.gl.FLOAT;    // the data in the buffer is 32bit floats
            const normalize = false;  // don't normalize
            const stride = 0;         // how many bytes to get from one set of values to the next
                                    // 0 = use type and numComponents above
            const offset = 0;         // how many bytes inside the buffer to start from
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
            this.gl.vertexAttribPointer(
                this.vertexPosition,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            this.gl.enableVertexAttribArray(this.vertexPosition);
        }


        // Tell WebGL how to pull out the colors from the color buffer
        // into the vertexColor attribute.
        {
            const numComponents = 4;
            const type = this.gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
            this.gl.vertexAttribPointer(
                this.vertexColor,
                numComponents,
                type,
                normalize,
                stride,
                offset);
                this.gl.enableVertexAttribArray(this.vertexColor);
        }


        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);

        // Tell WebGL how to pull out the normals from
        // the normal buffer into the vertexNormal attribute.
        {
            const numComponents = 3;
            const type = this.gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normal);
            this.gl.vertexAttribPointer(
                this.vertexNormal,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            this.gl.enableVertexAttribArray(this.vertexNormal);
        }
    }

    private loadShader(type, source): WebGLShader {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            this.gl.deleteShader(shader);
            this.message = 'shader issue';
            return null;
        }
        return shader;
    }

    private initBuffers() {
        if (this.buffers) {
            this.gl.deleteBuffer(this.buffers.position);
        }

        // points on cube
        const points = [
            // Front face
            -1.0, -1.0,  1.0,
            1.0, -1.0,  1.0,
            1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,
            // Back face
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
            1.0,  1.0, -1.0,
            1.0, -1.0, -1.0,
            // Top face
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0, -1.0,
            // Bottom face
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,
            // Right face
            1.0, -1.0, -1.0,
            1.0,  1.0, -1.0,
            1.0,  1.0,  1.0,
            1.0, -1.0,  1.0,
            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0
        ];

        const posBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, posBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(points), this.gl.STATIC_DRAW);

        const normals = [
            // Front
            0.0,  0.0,  1.0,
            0.0,  0.0,  1.0,
            0.0,  0.0,  1.0,
            0.0,  0.0,  1.0,
        // Back
            0.0,  0.0, -1.0,
            0.0,  0.0, -1.0,
            0.0,  0.0, -1.0,
            0.0,  0.0, -1.0,
        // Top
            0.0,  1.0,  0.0,
            0.0,  1.0,  0.0,
            0.0,  1.0,  0.0,
            0.0,  1.0,  0.0,
        // Bottom
            0.0, -1.0,  0.0,
            0.0, -1.0,  0.0,
            0.0, -1.0,  0.0,
            0.0, -1.0,  0.0,
        // Right
            1.0,  0.0,  0.0,
            1.0,  0.0,  0.0,
            1.0,  0.0,  0.0,
            1.0,  0.0,  0.0,
        // Left
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0
        ];

        const normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);

        const indices = [
            0,  1,  2,      0,  2,  3,    // front
            4,  5,  6,      4,  6,  7,    // back
            8,  9,  10,     8,  10, 11,   // top
            12, 13, 14,     12, 14, 15,   // bottom
            16, 17, 18,     16, 18, 19,   // right
            20, 21, 22,     20, 22, 23,   // left
        ];
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);

        const colors = new Array(4 * 4 * 6).fill(1.0);

        const colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);

        this.buffers = {
            position: posBuffer,
            normal: normalBuffer,
            color: colorBuffer,
            indices: indexBuffer
        };
    }

    private initAttributes() {
        this.vertexPosition = this.gl.getAttribLocation(this.program, 'aVertexPosition');
        this.vertexColor = this.gl.getAttribLocation(this.program, 'aVertexColor');
        this.vertexNormal = this.gl.getAttribLocation(this.program, 'aVertexNormal');

        this.projectionMatrix = this.gl.getUniformLocation(this.program, 'uProjectionMatrix');
        this.modelViewMatrix = this.gl.getUniformLocation(this.program, 'uModelViewMatrix');
        this.normalMatrix = this.gl.getUniformLocation(this.program, 'uNormalMatrix');
    }
}
/* tslint:enable:no-bitwise */

