import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { Subject } from 'rxjs/Subject';

export class WebWorkerHost<T extends object> {

    private worker: Worker;
    private workerProxyHandler: ProxyHandler<{}>;
    private addListenerProxyHandler: ProxyHandler<{}>;

    readonly proxy: T;
    get onMessage(): Observable<MessageEvent> {
        return this.onMessageSubject.asObservable();
    }

    private readonly onMessageSubject: Subject<MessageEvent>;
    private readonly addListenerProxy: T;

    private readonly methodDictionary: {[methodName: string]: (...args: any[]) => any};
    private readonly observerDictionary: {[methodName: string]: Subscriber<any> };

    constructor(private classDef: new (context: Stratton.GameOfLife.DedicatedWorkerGlobalScope) => T) {
        const prototypeMethods = Object
            .entries(classDef.prototype)
            .map(x => `classDef.prototype.${x[0]} = ${x[1]}`)
            .join(';');

        const blob = new Blob([
            `
            (function(context){
                var classDef = ${classDef};
                ${prototypeMethods};
                var kernel = new classDef(context);
                context.addEventListener("message", function(e){
                    if (e && e.data && e.data[0]){
                        var method = e.data[0];
                        var args = e.data.slice(1);
                        if (kernel[method]) {
                            var val = kernel[method].apply(kernel, args);
                            context.postMessage({methodName:method, value: val});
                        }
                    }
                });
            })(self);
            `
        ], {type: 'application/javascript'});
        const blobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(blobUrl);

        this.onMessageSubject = new Subject<any>();

        this.worker.onmessage = (e) => {
            if (e && e.data && e.data.methodName && e.data.methodName in this.observerDictionary) {
                this.observerDictionary[e.data.methodName].next(e.data.value);
            } else {
                this.onMessageSubject.next(e);
            }
        };

        this.worker.onerror = (e) => {
            this.onMessageSubject.error(e);
        };

        this.methodDictionary = {};
        this.observerDictionary = {};

        this.workerProxyHandler = {
            get: (unusedTarget, methodName) => {
                if (!(methodName in this.methodDictionary)) {
                    const host = this;
                    this.methodDictionary[methodName] = function() {
                        const args = Array.from(arguments);
                        host.worker.postMessage([methodName].concat(args));
                    };
                }
                return this.methodDictionary[methodName];
            }
        };

        this.addListenerProxyHandler = {
            get: (unusedTarget, methodName) => {
                return new Observable<any>(observe => {
                    this.observerDictionary[methodName] = observe;
                });
            }
        };
        this.proxy = new Proxy<T>({} as T, this.workerProxyHandler);
        this.addListenerProxy  = new Proxy<T>({} as T, this.addListenerProxyHandler);
    }

    terminate() {
        this.worker.terminate();
    }

    when<TR>(lambda: (target: T) => any): Observable<TR> {
        return lambda(this.addListenerProxy) as Observable<TR>;
    }

}
