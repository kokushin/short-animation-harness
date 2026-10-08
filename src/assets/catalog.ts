// 台本から名前で呼べる素材。中身は assets.json (npm run assets が public/ から作る) と、
// 画像の寸法・音の長さの索引 (index.generated.json)。
import manifest from "../../assets.json";
import index from "./index.generated.json";

export interface Place {
  src?: string; // 背景の絵 (無ければ color の無地)
  color?: string;
}
export interface Actor {
  w: number; // 標準の表示幅 (ワールド px。世界は高さ 900)
  looks: Record<string, string>; // 見た目の名前 → 絵 (最初のものが既定)
  faces?: "left" | "right"; // 絵が向いている方 (既定 right)。台本の facing と違うときは左右を反転して描く
}
export interface Sound {
  src: string;
}

export const PLACES = manifest.places as Record<string, Place>;
export const ACTORS = manifest.actors as unknown as Record<string, Actor>;
export const SES = manifest.se as unknown as Record<string, Sound>;
export const BGMS = manifest.bgm as unknown as Record<string, Sound>;

const IMAGES = index.images as unknown as Record<string, [number, number]>;
const AUDIO = index.audio as unknown as Record<string, number>;

export function imageSize(path: string): [number, number] {
  const s = IMAGES[path];
  if (!s) throw new Error(`寸法がわかりません: public/${path} (npm run assets を回す)`);
  return s;
}
export function audioDuration(path: string): number {
  const d = AUDIO[path];
  if (d === undefined) throw new Error(`長さがわかりません: public/${path} (npm run assets を回す)`);
  return d;
}
