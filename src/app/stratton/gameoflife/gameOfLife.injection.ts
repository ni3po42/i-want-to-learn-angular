import { InjectionToken } from '@angular/core';

export function _<T>(name: string) {
    return new InjectionToken<T>(name);
}

export const InjectToken = {
    IBoardService: _<Stratton.GameOfLife.IBoardService>('IBoardService'),
    IGlobalReference: _<Stratton.IGlobalReference>('IGlobalReference')
};

