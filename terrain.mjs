export class Heightfield {
  constructor(metadata, heights, distances) {
    this.meta = metadata;
    this.n = metadata.gridSize;
    this.side = metadata.side;
    this.half = this.side / 2;
    this.spacing = this.side / (this.n - 1);
    if (heights.length !== this.n * this.n || distances.length !== this.n * this.n) {
      throw new Error('The terrain data is incomplete. Extract the entire download before starting.');
    }
    this.heights = heights;
    this.distances = distances;
  }
  sample(array, x, z) {
    const u = Math.max(0, Math.min(this.n - 1.000001, (x + this.half) / this.spacing));
    const v = Math.max(0, Math.min(this.n - 1.000001, (z + this.half) / this.spacing));
    const i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j;
    const k = j * this.n + i;
    return (array[k] * (1 - fx) + array[k + 1] * fx) * (1 - fz)
      + (array[k + this.n] * (1 - fx) + array[k + this.n + 1] * fx) * fz;
  }
  height(x, z) { return this.sample(this.heights, x, z); }
  pisteDistance(x, z) { return this.sample(this.distances, x, z) / 10; }
  gradient(x, z) {
    const d = this.spacing;
    return [(this.height(x + d, z) - this.height(x - d, z)) / (2 * d),
      (this.height(x, z + d) - this.height(x, z - d)) / (2 * d)];
  }
}
