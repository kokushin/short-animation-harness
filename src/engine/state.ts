// フレームごとの役者の姿とカメラを、タイムラインだけから計算する。
// f は台本のコマ (30fps) で、書き出しのあいだは小数になる (丸めない)。
import { ACTORS, imageSize } from "../assets/catalog";
import { WORLD_H, worldWidth, type Ease, type ResolvedScene, type Track, type Vec } from "../episode/resolve";

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export function ease(kind: Ease, u: number): number {
  const x = clamp01(u);
  if (kind === "linear") return x;
  if (kind === "in") return x * x * x;
  if (kind === "out") return 1 - (1 - x) ** 3;
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export interface Pose {
  id: string;
  pos: Vec; // 足もと中央 (ワールド px)
  w: number;
  h: number;
  src: string;
  facing: 1 | -1;
  flip: boolean; // 絵を左右に反転して描くか (台本の向きと、絵の向きが違うとき)
  visible: boolean;
}

export function poseAt(tr: Track, f: number): Pose {
  let { look, facing, visible } = tr.init;
  for (const s of tr.states) {
    if (s.at > f) break;
    if (s.key === "look") look = s.value as string;
    if (s.key === "facing") facing = s.value as 1 | -1;
    if (s.key === "visible") visible = s.value as boolean;
  }
  let pos: Vec = tr.init.at;
  for (const m of tr.moves) {
    if (m.start > f) break;
    const k = ease(m.ease, (f - m.start) / (m.end - m.start));
    pos = [lerp(m.from[0], m.to[0], k), lerp(m.from[1], m.to[1], k)];
  }
  const src = ACTORS[tr.actor].looks[look];
  const [iw, ih] = imageSize(src);
  const native = ACTORS[tr.actor].faces === "left" ? -1 : 1;
  return { id: tr.id, pos, w: tr.w, h: (tr.w * ih) / iw, src, facing, flip: facing !== native, visible };
}

export interface CamView {
  x: number;
  y: number;
  zoom: number;
  scale: number; // ワールド px → 画面 px
  left: number; // 窓の左上 (ワールド px)
  top: number;
}

/** カメラ。zoom 1 で縦 900 がちょうど映る。世界の外は映さない */
export function camAt(sc: ResolvedScene, f: number, width: number, height: number): CamView {
  let c = { ...sc.cam0 };
  for (const e of sc.cams) {
    if (e.start > f) break;
    const k = e.end <= e.start ? 1 : ease("inOut", (f - e.start) / (e.end - e.start));
    c = { x: lerp(c.x, e.x ?? c.x, k), y: lerp(c.y, e.y ?? c.y, k), zoom: lerp(c.zoom, e.zoom ?? c.zoom, k) };
  }
  const ww = worldWidth(sc.place);
  const vw = (width / height) * (WORLD_H / c.zoom);
  const vh = WORLD_H / c.zoom;
  const x = vw >= ww ? ww / 2 : Math.min(ww - vw / 2, Math.max(vw / 2, c.x));
  const y = vh >= WORLD_H ? WORLD_H / 2 : Math.min(WORLD_H - vh / 2, Math.max(vh / 2, c.y));
  return { x, y, zoom: c.zoom, scale: (height / WORLD_H) * c.zoom, left: x - vw / 2, top: y - vh / 2 };
}
