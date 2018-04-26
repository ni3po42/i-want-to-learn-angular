import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { Subject } from 'rxjs/Subject';

export class WebWorkerHost<T extends object> {

    private worker: Worker;
    private workerProxyHandler: ProxyHandler<any>;
    private addListenerProxyHandler: ProxyHandler<any>;

    private readonly proxy: T;
    private addListenerProxy: T;

    private readonly workerProxyMethodDictionary: {[methodName: string]: (...args: any[]) => any};
    private readonly observerDictionary: {[methodName: string]: Subscriber<any> };

    constructor(private classDef: new (context?: Stratton.GameOfLife.DedicatedWorkerGlobalScope) => T) {
        const kernelMethods = Object
            .entries(classDef.prototype)
            .map(x => `kernel['${x[0]}'] = (${x[1]}).bind(kernel)`)
            .join(';');

        const blob = new Blob([
            `"use strict";
            (function(context){
                var disablePropEmit = true;
                var classDef = ${classDef};
                var kernel = new Proxy({}, {
                    set : function(obj, prop, value){
                        obj[prop] = value;
                        try {
                            var payload = JSON.parse(JSON.stringify({member:prop, value: value}));
                            context.postMessage(payload);
                        }catch(e) {
                            console.log(e);
                        }
                        return value;
                    }
                });
                ${kernelMethods};
                context.addEventListener("message", function(e){
                    if (kernel && e && e.data && e.data[0]){
                        var name = e.data[0];
                        var args = e.data.slice(1);
                        if (kernel[name] && typeof kernel[name] === 'function' && !disablePropEmit) {
                            var val = kernel[name].apply(kernel, args);
                            context.postMessage({member:name, value: val});
                        } else if (!disablePropEmit) {
                            disablePropEmit = true;
                            if (args.length > 0){
                                kernel[name] = args[0];
                            }
                            context.postMessage({member:name, value: kernel[name]});
                            disablePropEmit = false;
                        }
                    }
                });
                classDef.call(kernel, context);
                disablePropEmit = false;
            })(self);
            `
        ], {type: 'application/javascript'});
        const blobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(blobUrl);

        this.worker.onmessage = (e) => {
            if (e && e.data && e.data.member && e.data.member in this.observerDictionary) {
                this.observerDictionary[e.data.member].next(e.data.value);
            }
        };

        this.worker.onerror = (e) => {
            // todo: implement error handling
        };

        this.workerProxyMethodDictionary = {};
        this.observerDictionary = {};

        this.workerProxyHandler = {
            get: (unusedTarget, member) => {
                if (!(member in this.workerProxyMethodDictionary)) {
                    const host = this;
                    this.workerProxyMethodDictionary[member] = function() {
                        const args = Array.from(arguments);
                        host.worker.postMessage([member].concat(args));
                    };
                }
                return this.workerProxyMethodDictionary[member];
            },
            set: (unusedTarget, member, value) => {
                if (!(member in this.workerProxyMethodDictionary)) {
                    const host = this;
                    this.workerProxyMethodDictionary[member] = function() {
                        const args = Array.from(arguments);
                        host.worker.postMessage([member].concat(args));
                    };
                }
                this.workerProxyMethodDictionary[member](value);
                return value;
            }
        };

        this.addListenerProxyHandler = {
            get: (unusedTarget, member) => {
                return new Observable<any>(observe => {
                    this.observerDictionary[member] = observe;
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

    call<TR>(lambda: (target: T) => any): Promise<TR> {
        return new Promise(resolve => {
            const observable = lambda(this.addListenerProxy) as Observable<TR>;
            const subscriber = observable.subscribe(next => {
                resolve(next);
                subscriber.unsubscribe();
            });
            lambda(this.proxy);
        });
    }

    set<TR>(lambda: (target: T) => any, value: TR): Promise<TR> {
        return new Promise(resolve => {
            const observable = lambda(this.addListenerProxy) as Observable<TR>;
            const subscriber = observable.subscribe(next => {
                resolve(next);
                subscriber.unsubscribe();
            });
            lambda(this.proxy)(value);
        });
    }
}
