import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

export class WebWorkerHost<T extends object> {

    private worker: Worker;
    private workerProxyHandler: ProxyHandler<any>;
    readonly proxy: T;
    readonly lambdaProxy: T;
    private readonly workerProxyMethodDictionary: {[methodName: string]: (...args: any[]) => any};
    private promiseTracker: {[methodName: string]: {[id: number]: {resolve: (arg: any) => void, reject: (arg: any) => void}} };
    private subjectTracker: {[propName: string]: Subject<any>};
    private messageId: number;

    private lambdaProxyHandler: ProxyHandler<any>;
    private readonly lambdaProxyDictionary: {[propName: string]: any};

    constructor(private classDef: new (context?: Stratton.GameOfLife.DedicatedWorkerGlobalScope) => T) {

        this.promiseTracker = {};
        this.subjectTracker = {};
        this.messageId = 1;

        const webworkerMainMethod = function (
            context: Stratton.GameOfLife.DedicatedWorkerGlobalScope,
            classDefParam,
            classDefMethodsParam: {[name: string]: any}) {

            const kernel = new Proxy({}, {
                set : (obj, prop, value) => {
                    obj[prop] = value;
                    // gets around ownership issues, just force a full cloning
                    const payload = JSON.parse(JSON.stringify({member: prop, value: value}));
                    context.postMessage(payload);
                    return true;
                }
            });

            Object.defineProperties(kernel, classDefMethodsParam);

            context.addEventListener('message', e => {
                if (e.data && e.data[0] && e.data[1] && classDefMethodsParam[e.data[0]]) {
                    const name = e.data[0];
                    const mId = e.data[1];
                    const args = e.data.slice(2);
                    const descriptor = classDefMethodsParam[e.data[0]] as PropertyDescriptor;
                    try {
                        let returnVal = null as any;
                        if (descriptor.set) {
                            // listener should be set to capture this!
                            kernel[name] = args[0];
                        } else if (descriptor.value instanceof Function) {
                            // method calls implicitly can be listened to
                            returnVal = kernel[name].apply(kernel, args);
                            Promise.resolve(returnVal)
                                .then(v => context.postMessage({member: name, value: v, mId: mId}))
                                .catch((err) => context.postMessage({member: name, mId: mId, errorMsg: err}));
                        } else {
                            throw new Error(`cannot call '${name}'`);
                        }
                    } catch (ex) {
                        context.postMessage({member: name, mId: mId, errorMsg: ex});
                    }
                }
            });
            classDefParam.call(kernel, context);
        };

        const stringified = Object.keys(classDef.prototype)
        .map(x => [x, Object.getOwnPropertyDescriptor(classDef.prototype, x)])
        .filter(x => x[0] !== 'constructor' && x[1])
        .map(x => {
            const str = Object.entries(x[1]).map(y => `"${y[0]}":${y[1]}`).join(',');
            return `"${x[0]}":{${str}}`;
        }).join(',');

        const blob = new Blob(
            [`"use strict";(${webworkerMainMethod})(self, ${classDef}, {${stringified}});`],
            {type: 'application/javascript'});

        const blobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(blobUrl);

        this.worker.onmessage = (e) => {
            if (e && e.data && e.data.member) {
                if (e.data.mId && this.promiseTracker[e.data.member] && this.promiseTracker[e.data.member][e.data.mId]) {
                    // call these if waiting on a method
                    const member = this.promiseTracker[e.data.member];
                    const track = member[e.data.mId];
                    const func = e.data.errorMsg ? track.reject : track.resolve;
                    delete member[e.data.mId];
                    func(e.data.errorMsg || e.data.value);
                } else if (this.subjectTracker[e.data.member]) {
                    // call this if a property change is being listened for
                    const subscriber = this.subjectTracker[e.data.member];
                    if (e.data.errorMsg) {
                        subscriber.error(e.data.errorMsg);
                    } else {
                        subscriber.next(e.data.value);
                    }
                }
            }
        };

        this.workerProxyMethodDictionary = {};
        this.lambdaProxyDictionary = {};

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

        this.lambdaProxyHandler = {
            get: (unusedTarget, prop) => {
                if (!(prop in this.lambdaProxyDictionary)) {
                    this.lambdaProxyDictionary[prop] = new Subject<any>();
                }
                return this.lambdaProxyDictionary[prop];
            }
        };

        this.proxy = new Proxy<T>({} as T, this.workerProxyHandler);
        this.lambdaProxy = new Proxy<T>({} as T, this.lambdaProxyHandler);
    }

    terminate() {
        this.worker.terminate();
    }

    when<TR>(lambda: (target?: T) => TR): Observable<TR> {
        return lambda.call(this.lambdaProxy, this.lambdaProxy) as Observable<TR>;
    }
}
