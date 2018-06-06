import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { Subject } from 'rxjs/Subject';

export class WebWorkerHost<T extends object> {

    private worker: Worker;
    private workerProxyHandler: ProxyHandler<any>;
    readonly proxy: T;
    private readonly workerProxyMethodDictionary: {[methodName: string]: (...args: any[]) => any};
    private promiseTracker: {[methodName: string]: {[id: number]: (arg: any) => void} };
    private messageId: number;

    constructor(private classDef: new (context?: Stratton.GameOfLife.DedicatedWorkerGlobalScope) => T) {
        const emptyObj = {};

        this.promiseTracker = {};
        this.messageId = 1;

        const kernelMethods = Object
            .entries(classDef.prototype)
            .filter(val => val && val[1] && emptyObj.toString.call(val[1]) === '[object Function]')
            .map(x => `kernel['${x[0]}'] = (${x[1]}).bind(kernel)`)
            .join(';');

        const blob = new Blob([
            `"use strict";
            (function(context){
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
                        return true;
                    }
                });
                ${kernelMethods};
                context.addEventListener("message", function(e){
                    if (kernel && e && e.data && e.data[0] && e.data[1] && kernel[e.data[0]]){
                        var name = e.data[0];
                        var mId = e.data[1];
                        var args = e.data.slice(2);
                        var val = kernel[name].apply(kernel, args);
                        if (val && val.then && val.catch && val.finally){
                            val.then(function(v){
                                context.postMessage({member:name, value: v, mId:mId});
                            });
                        } else {
                            context.postMessage({member:name, value: val, mId:mId});
                        }
                    }
                });
                classDef.call(kernel, context);
            })(self);
            `
        ], {type: 'application/javascript'});
        const blobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(blobUrl);

        this.worker.onmessage = (e) => {
            if (e && e.data && e.data.member && e.data.mId) {
                if (this.promiseTracker[e.data.member] && this.promiseTracker[e.data.member][e.data.mId]) {
                    const resolve = this.promiseTracker[e.data.member][e.data.mId];
                    const member = this.promiseTracker[e.data.member];
                    delete member[e.data.mId];
                    resolve(e.data.value);
                }
            }
        };

        this.worker.onerror = (e) => {
            // todo: implement error handling
        };

        this.workerProxyMethodDictionary = {};

        this.workerProxyHandler = {
            get: (unusedTarget, member) => {
                if (!(member in this.workerProxyMethodDictionary)) {
                    const host: WebWorkerHost<T> = this;
                    this.workerProxyMethodDictionary[member] = function() {
                        const mId = host.messageId++;
                        const args = Array.from(arguments);
                        host.worker.postMessage([member, mId].concat(args));
                        return new Promise((resolve) => {
                            if (!host.promiseTracker[member]) {
                                host.promiseTracker[member] = {};
                            }
                            host.promiseTracker[member][mId] = resolve;
                        });
                    };
                }
                return this.workerProxyMethodDictionary[member];
            }
        };
        this.proxy = new Proxy<T>({} as T, this.workerProxyHandler);
    }

    terminate() {
        this.worker.terminate();
    }

    // when<TR>(lambda: (target?: T) => (...args: any[]) => TR): Observable<TR> {
    //    return lambda.call(this.addListenerProxy, this.addListenerProxy)() as Observable<TR>;
    // }
}
