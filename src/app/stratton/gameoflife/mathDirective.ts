/* tslint:disable:directive-selector */
import { Directive } from '@angular/core';

@Directive({
  selector: '[globalMath]',
  exportAs: 'Math'
})
export class MathDirective {
  constructor() { return Math; }
}
