export class ExampleActivity {
    constructor(context: Stratton.GameOfLife.DedicatedWorkerGlobalScope) {
        context.setInterval(() => {
            this.asyncCounter++;
        }, 1000);
    }

    counter = 1000;
    asyncCounter = 1000;

    doSomething(a: number): number {
        this.counter++;
        return a * this.counter;
    }
}
