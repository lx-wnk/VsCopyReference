export enum Color { Red }
export namespace N { export const x = 1; }
export const wrap = () => { function innerFn() { return 1; } return innerFn; };
export const c = Color.Red;
export const y = N.x;
