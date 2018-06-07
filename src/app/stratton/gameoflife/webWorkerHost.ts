import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { Subject } from 'rxjs/Subject';

export class WebWorkerHost<T extends object> {

    private worker: Worker;
    private workerProxyHandler: ProxyHandler<any>;
    readonly proxy: T;
    private readonly workerProxyMethodDictionary: {[methodName: string]: (...args: any[]) => any};
    private promiseTracker: {[methodName: string]: {[id: number]: {resolve: (arg: any) => void, reject: (arg: any) => void}} };
    private messageId: number;

    constructor(private classDef: new (context?: Stratton.GameOfLife.DedicatedWorkerGlobalScope) => T) {

        this.promiseTracker = {};
        this.messageId = 1;

        function webworkerMainMethod(
            context: Stratton.GameOfLife.DedicatedWorkerGlobalScope,
            classDefParam,
            classDefMethodsParam: {[name: string]: Function}) {

            const kernel = new Proxy({}, {
                set : (obj, prop, value) => {
                    obj[prop] = value;
                    // gets around ownership issues, just force a full cloning
                    const payload = JSON.parse(JSON.stringify({member: prop, value: value}));
                    context.postMessage(payload);
                    return true;
                }
            });

            for (const member in classDefMethodsParam) {
                if (classDefMethodsParam[member]) {
                    kernel[member] = classDefMethodsParam[member].bind(kernel);
                }
            }

            context.addEventListener('message', e => {
                if (e.data && e.data[0] && e.data[1] && kernel[e.data[0]]) {
                    const name = e.data[0];
                    const mId = e.data[1];
                    const args = e.data.slice(2);
                    try {
                        const val = kernel[name].apply(kernel, args);
                        Promise.resolve(val)
                            .then(v => context.postMessage({member: name, value: v, mId: mId}))
                            .catch((err) => context.postMessage({member: name, mId: mId, errorMsg: err}));
                    } catch (ex) {
                        context.postMessage({member: name, mId: mId, errorMsg: ex});
                    }
                }
            });
            classDefParam.call(kernel, context);
        }

        const classDefMethods = Object.entries(classDef.prototype)
            .filter(x => x[1] instanceof Function)
            .map(x => `"${x[0]}":${x[1]}`)
            .join(',');

        const blob = new Blob(
            [`"use strict";(${webworkerMainMethod})(self, ${classDef}, {${classDefMethods}});`],
            {type: 'application/javascript'});

        const blobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(blobUrl);

        this.worker.onmessage = (e) => {
            if (e && e.data && e.data.member && e.data.mId) {
                if (this.promiseTracker[e.data.member] && this.promiseTracker[e.data.member][e.data.mId]) {
                    const member = this.promiseTracker[e.data.member];
                    const track = member[e.data.mId];
                    const func = e.data.errorMsg ? track.reject : track.resolve;
                    delete member[e.data.mId];
                    func(e.data.errorMsg || e.data.value);
                }
            }
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
                        return new Promise((resolve, reject) => {
                            if (!host.promiseTracker[member]) {
                                host.promiseTracker[member] = {};
                            }
                            host.promiseTracker[member][mId] = {
                                resolve : resolve,
                                reject : reject
                            };
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
