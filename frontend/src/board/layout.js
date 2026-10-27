// 40 mező egy négyzet kerületén: 4 sarok + oldalanként 9 mező.
// START a jobb alsó sarokban, onnan az óramutató járásával megegyezően haladunk.
export const TILE_W = 1; // normál mező szélessége (haladási irányban)
export const TILE_D = 1.6; // mező mélysége = sarokmező oldala
export const TILE_H = 0.15;
export const GAP = 0.04;
export const BOARD_SIZE = 2 * TILE_D + 9 * TILE_W;

export function tilePlacement(index) {
  const side = Math.floor(index / 10);
  const k = index % 10;
  const half = BOARD_SIZE / 2;

  // Az alsó oldal koordinátái, a többi oldalt ebből forgatjuk el.
  const z = half - TILE_D / 2;
  const x = k === 0 ? half - TILE_D / 2 : half - TILE_D - (k - 0.5) * TILE_W;
  const w = k === 0 ? TILE_D : TILE_W;

  const angle = (-side * Math.PI) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    position: [x * cos + z * sin, TILE_H / 2, -x * sin + z * cos],
    rotationY: angle,
    size: [w, TILE_D],
  };
}
