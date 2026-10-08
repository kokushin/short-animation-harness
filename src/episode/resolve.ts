// 台本を、フレーム単位のタイムラインに直す。拍は頭から順に積み、拍の中の出来事は at (秒) で遅らせる。
// 描画はタイムラインだけを見る (同じ台本からは、何度描いても同じ動画になる)。
import { ACTORS, BGMS, PLACES, SES, audioDuration, imageSize } from "../assets/catalog";
import type { Episode } from "./schema";

export const FPS = 30; // 台本の時間割のコマ
export const RENDER_FPS = 60; // 書き出しのコマ。描画は f = 書き出しのコマ / SUB の小数のコマで回る
export const SUB = RENDER_FPS / FPS;
export const WORLD_H = 900; // 世界の高さ (ワールド px)。横幅は背景の絵の比で決まる

export type Vec = [number, number];
export type Ease = "linear" | "inOut" | "in" | "out";

export interface Move {
  start: number;
  end: number;
  from: Vec;
  to: Vec;
  ease: Ease;
}
export interface State {
  at: number;
  key: "look" | "facing" | "visible";
  value: string | number | boolean;
}
export interface Track {
  id: string;
  actor: string;
  w: number; // 表示幅 (ワールド px)
  init: { at: Vec; look: string; facing: 1 | -1; visible: boolean };
  moves: Move[];
  states: State[];
}
export interface Cam {
  start: number;
  end: number;
  x?: number;
  y?: number;
  zoom?: number;
}
export interface ResolvedScene {
  id: string;
  place: string;
  from: number;
  to: number;
  fade: number; // 頭で黒から明けるコマ数
  cam0: { x: number; y: number; zoom: number };
  cams: Cam[];
  tracks: Track[];
  texts: { start: number; end: number; body: string; pos: "top" | "center" | "bottom" }[];
}
export interface Sound {
  src: string;
  start: number;
  frames: number;
  vol: number;
  loop?: boolean;
}
export interface Timeline {
  width: number;
  height: number;
  frames: number;
  end: { kind: "iris" | "fade" | "cut"; start: number; frames: number; focus?: string };
  scenes: ResolvedScene[];
  sounds: Sound[];
}

export class ResolveError extends Error {}
const sec = (s: number) => Math.round(s * FPS);

export function resolveEpisode(ep: Episode): Timeline {
  const [width, height] = ep.format === "long" ? [1920, 1080] : [1080, 1920];
  const scenes: ResolvedScene[] = [];
  const sounds: Sound[] = [];
  let bgm: { src: string; start: number } | null = null;
  const closeBgm = (at: number) => {
    if (bgm && at > bgm.start) sounds.push({ src: bgm.src, start: bgm.start, frames: at - bgm.start, vol: 0.3, loop: true });
    bgm = null;
  };
  let t = 0;

  ep.scenes.forEach((sc, si) => {
    const where = `scenes[${si}](${sc.id})`;
    if (sc.bgm !== undefined) {
      closeBgm(t);
      if (sc.bgm) bgm = { src: BGMS[sc.bgm].src, start: t };
    }
    const tracks = new Map<string, Track>();
    for (const [id, p] of Object.entries(sc.setup)) {
      const c = ep.cast[id];
      if (!c) throw new ResolveError(`${where}.setup.${id}: ${id} は cast にいません`);
      const a = ACTORS[c.actor];
      const look = p.look ?? Object.keys(a.looks)[0];
      if (!a.looks[look]) throw new ResolveError(`${where}.setup.${id}: 見た目 ${look} がありません (${Object.keys(a.looks).join(", ")})`);
      const init = { at: p.at as Vec, look, facing: (p.facing === "left" ? -1 : 1) as 1 | -1, visible: !p.hidden };
      tracks.set(id, { id, actor: c.actor, w: a.w * (c.size ?? 1), init, moves: [], states: [] });
    }
    const pos = new Map([...tracks].map(([id, tr]) => [id, tr.init.at]));
    const cams: Cam[] = [];
    const texts: ResolvedScene["texts"] = [];
    const from = t;

    sc.beats.forEach((b, bi) => {
      const bw = `${where}.beats[${bi}]`;
      const end = t + sec(b.dur);
      // 始まる時刻の順に積む (後で始まる移動を先に書いても、行き先の見込みがずれない)
      for (const act of [...(b.do ?? [])].sort((x, y) => (x.at ?? 0) - (y.at ?? 0))) {
        const tr = tracks.get(act.who);
        if (!tr) throw new ResolveError(`${bw}: ${act.who} はこの場面の setup にいません`);
        const s = t + sec(act.at ?? 0);
        if (act.act === "move") {
          if (!act.to) throw new ResolveError(`${bw}: move には to が要ります`);
          const e = act.dur !== undefined ? s + sec(act.dur) : end;
          tr.moves.push({ start: s, end: Math.max(s + 1, e), from: pos.get(act.who)!, to: act.to as Vec, ease: act.ease ?? "inOut" });
          pos.set(act.who, act.to as Vec);
        } else if (act.act === "look") {
          if (!act.look || !ACTORS[tr.actor].looks[act.look]) throw new ResolveError(`${bw}: ${tr.actor} に見た目 ${act.look} がありません`);
          tr.states.push({ at: s, key: "look", value: act.look });
        } else if (act.act === "turn") tr.states.push({ at: s, key: "facing", value: act.facing === "left" ? -1 : 1 });
        else tr.states.push({ at: s, key: "visible", value: act.act === "show" });
      }
      for (const se of b.se ?? []) {
        const src = SES[se.id].src;
        sounds.push({ src, start: t + sec(se.at ?? 0), frames: sec(audioDuration(src)), vol: se.vol ?? 0.8 });
      }
      for (const x of b.text ?? []) texts.push({ start: t + sec(x.at ?? 0), end: x.dur !== undefined ? t + sec((x.at ?? 0) + x.dur) : end, body: x.body, pos: x.pos ?? "bottom" });
      if (b.cam) cams.push({ start: t + sec(b.cam.at ?? 0), end: b.cam.dur !== undefined ? t + sec((b.cam.at ?? 0) + b.cam.dur) : end, ...b.cam });
      t = end;
    });

    for (const tr of tracks.values()) {
      tr.moves.sort((a, b) => a.start - b.start);
      tr.states.sort((a, b) => a.at - b.at);
    }
    const enter = sc.enter ?? (si === 0 ? "fade" : "cut");
    scenes.push({
      id: sc.id,
      place: sc.place,
      from,
      to: t,
      fade: enter === "fade" ? sec(0.5) : 0,
      cam0: { x: sc.cam?.x ?? worldWidth(sc.place) / 2, y: sc.cam?.y ?? WORLD_H / 2, zoom: sc.cam?.zoom ?? 1 },
      cams,
      tracks: [...tracks.values()],
      texts,
    });
  });
  // 終わり方: 最後の画のまま、丸くすぼまる (iris) か暗くなる (fade)。そのぶん尺を足して、最後に黒を 0.3 秒置く
  const endKind = ep.end ?? "iris";
  const endFrames = endKind === "iris" ? sec(1.4) : endKind === "fade" ? sec(0.8) : 0;
  const end = { kind: endKind, start: t, frames: endFrames, focus: ep.endFocus };
  if (endFrames) {
    t += endFrames + sec(0.3);
    scenes[scenes.length - 1].to = t;
  }
  closeBgm(t);
  return { width, height, frames: t, end, scenes, sounds };
}

/** 背景の絵を高さ 900 に合わせたときの横幅 (無地は 1600) */
export function worldWidth(place: string): number {
  const src = PLACES[place].src;
  if (!src) return 1600;
  const [w, h] = imageSize(src);
  return Math.round((w * WORLD_H) / h);
}
