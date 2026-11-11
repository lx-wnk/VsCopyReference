export function round(value) {
  return Math.round(value);
}

export class Calc {
  add() {}
}

export const cfg = { a: { b: 1 } };

export function withLocal() {
  const inner = 1;
  return inner;
}

export const handler = () => {
  const local = 1;
  return local;
};
