// Board layout generated from the code scheme.
//
// A code is  <region><line><step>, e.g. "ACB". Regions A..F sit around the board at 60° steps and
// each has the same shape, so one region (A, the top one) is described by rules and the other five
// are rotations of it. The six "xAA" tiles (AAA, BAA, ...) are the board corners (team starts);
// MRX is the centre.
//
// Coordinates are axial [q, r] for a flat-top hex grid.

// line letter -> [q, r of first tile, tile count]; tiles run down in r.
const REGION_A = {
  A: [0, -7, 7],
  B: [-1, -6, 6],
  C: [1, -7, 5],
  D: [-2, -5, 4],
  E: [2, -7, 3],
  F: [-3, -4, 2],
  G: [3, -7, 1],
};

const rotate60 = ([q, r]) => [q + r, -q]; // one region step (A -> B -> C ...)
const REGIONS = "ABCDEF";
const LETTERS = "ABCDEFG";

// Codes that break the pattern. Region F's centre line skips G: it runs FAB..FAF, then FAH
// (the API and your screenshot both say FAH where the rule would give FAG).
const RENAMED = { FAG: "FAH" };

export const LAYOUT = (() => {
  const map = { MRX: [0, 0] };
  REGIONS.split("").forEach((region, i) => {
    for (const [line, [q, r0, n]] of Object.entries(REGION_A)) {
      for (let k = 0; k < n; k++) {
        let pos = [q, r0 + k];
        for (let s = 0; s < i; s++) pos = rotate60(pos);
        map[region + line + LETTERS[k]] = pos;
      }
    }
  });
  for (const [from, to] of Object.entries(RENAMED)) {
    map[to] = map[from];
    delete map[from];
  }
  return map; // 169 tiles
})();

export function placeTiles(tiles) {
  const placed = [], missing = [];
  for (const t of tiles) {
    if (LAYOUT[t.id]) placed.push({ ...t, pos: LAYOUT[t.id] });
    else missing.push(t.id);
  }
  // Positions on our board that the API didn't send a tile for.
  const seen = new Set(placed.map((t) => t.id));
  const empty = Object.keys(LAYOUT).filter((code) => !seen.has(code));
  return { placed, missing, empty };
}

// Flat-top axial -> pixel. The centre tile (MRX) is at 0,0 so rotating about the origin spins the board.
export const SIZE = 22;
export const toPixel = ([q, r]) => ({
  x: SIZE * 1.5 * q,
  y: SIZE * Math.sqrt(3) * (r + q / 2),
});
export const hexPoints = (cx, cy, s = SIZE - 1.5) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * 60 * i;
    return `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`;
  }).join(" ");