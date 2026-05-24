export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const rand = (min, max) => min + Math.random() * (max - min);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const positiveMod = (value, size) => ((value % size) + size) % size;
export const norm = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};
