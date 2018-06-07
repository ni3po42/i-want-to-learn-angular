declare namespace Stratton.GameOfLife {

    export interface IGlobalReference {
        requestAnimationFrame(callback: FrameRequestCallback): void;
        document: Document;   
        setTimeout: (handler: (...args: any[]) => void, timeout: number) => number;
    }

    export interface IPoint {
        x: number;
        y: number;
    }

    export interface IGridContraints {
        rows: number;
        cols: number;

        isTorus: boolean;

        livingColor: number;
        deathColor: number;
    }

    export interface IConstraints {       
        frameDelay: number;
        isTorus: boolean;

        livingColor: number;
        deathColor: number;
    }

    export interface IBoardService {
        renderer: IRenderer;
        reset(): Promise<any>;
        randomize(): Promise<any>;
        render(): Promise<any>;
        tick(): Promise<any>;
        loadFromFile(file: File): Promise<void>;
    }

    export interface IRenderer {
        initialize(constraints: IGridContraints);
        render(state: Int32Array, constraints: IGridContraints);
    }

    export interface IGlslShaderSource {
        shaderType: string;
        source: string;
    }

    export interface IWebGlMesh {
        vertices: number[];
        indices: number[];
        textUVs: number[];        
        normals: number[];
        
        name: string;
        faceCount: number;
    }

    export interface IWebGlObject {
        readonly name: string;
        bind(attributes: Stratton.GameOfLife.IWebGlAttributes): void;
        draw(): void;
    }

    export interface IWebGlObjectBuffers {
        position: any;
        normal: any;
        color: any;
        indices: any;
    }

    export interface IWebGlAttributes {
        vertexPosition: any;
        vertexColor: any;
        vertexNormal: any;
    }

    export interface IWebGlUniformLocations {
        projectionMatrix: WebGLUniformLocation;
        modelViewMatrix: WebGLUniformLocation;
        normalMatrix: WebGLUniformLocation;
        material: WebGLUniformLocation;
    }

    export interface DedicatedWorkerGlobalScope extends WindowBase64, WindowTimers {
        readonly name: string;
        readonly self: DedicatedWorkerGlobalScope;
        readonly location: Location;
        readonly navigator: Navigator;
        //onmessage: (event: MessageEvent) => boolean;
        //onmessageerror: (event: MessageEvent) => boolean;
        //close: () => void;
        postMessage: (message: any, transferList?: any[]) => void;
        addEventListener: (type: string, listener: (e:MessageEvent) => void, options?: any) => void;
        //importScripts: (...args: string[]) => void;
    }
}

