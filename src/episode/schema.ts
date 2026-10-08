// 台本 (episodes/<slug>/episode.json) の形。ここを変えたら docs/episode-format.md も直す。
import { z } from "zod";
import { ACTORS, BGMS, PLACES, SES } from "../assets/catalog";

const name = (table: Record<string, unknown>, what: string) =>
  z.string().superRefine((s, ctx) => {
    if (!(s in table)) ctx.addIssue({ code: "custom", message: `${what} ${s} は assets.json にありません (${Object.keys(table).join(", ") || "空"})` });
  });

const Sec = z.number().min(0);
const Point = z.tuple([z.number(), z.number()]); // ワールド px (高さ 900。足もと中央)

export const ActZ = z.strictObject({
  who: z.string(),
  act: z.enum(["move", "show", "hide", "look", "turn"]),
  at: Sec.optional(), // 拍の頭からの遅れ (秒)
  dur: Sec.optional(), // move の長さ (省くと拍の残り)
  to: Point.optional(), // move の行き先
  ease: z.enum(["linear", "inOut", "in", "out"]).optional(),
  look: z.string().optional(), // look で替える見た目
  facing: z.enum(["left", "right"]).optional(), // turn の向き
});
export type Act = z.infer<typeof ActZ>;

export const BeatZ = z.strictObject({
  dur: Sec, // 拍の長さ (秒)
  note: z.string().optional(), // 演出メモ (check の時刻表に出る)
  do: z.array(ActZ).optional(),
  se: z.array(z.strictObject({ id: name(SES, "効果音"), at: Sec.optional(), vol: z.number().optional() })).optional(),
  text: z.array(z.strictObject({ body: z.string(), at: Sec.optional(), dur: Sec.optional(), pos: z.enum(["top", "center", "bottom"]).optional() })).optional(),
  cam: z.strictObject({ x: z.number().optional(), y: z.number().optional(), zoom: z.number().optional(), at: Sec.optional(), dur: Sec.optional() }).optional(),
});
export type Beat = z.infer<typeof BeatZ>;

export const SceneZ = z.strictObject({
  id: z.string(),
  place: name(PLACES, "背景"),
  enter: z.enum(["cut", "fade"]).optional(), // 最初の場面は fade、ほかは cut が既定
  bgm: z.union([name(BGMS, "BGM"), z.null()]).optional(), // 場面の頭で替える (null で止める)
  cam: z.strictObject({ x: z.number().optional(), y: z.number().optional(), zoom: z.number().optional() }).optional(),
  setup: z.record(
    z.string(),
    z.strictObject({ at: Point, look: z.string().optional(), facing: z.enum(["left", "right"]).optional(), hidden: z.boolean().optional() }),
  ),
  beats: z.array(BeatZ).min(1),
});
export type Scene = z.infer<typeof SceneZ>;

export const EpisodeZ = z.strictObject({
  $schema: z.string().optional(),
  format: z.enum(["short", "long"]).default("short"), // short = 縦 1080x1920 (既定) / long = 横 1920x1080
  title: z.string(),
  description: z.string().optional(),
  end: z.enum(["iris", "fade", "cut"]).optional(), // 終わり方 (既定 iris = 丸くすぼまって黒)
  endFocus: z.string().optional(), // iris の中心にする役者 (省くと画面のまんなか)
  cast: z.record(z.string(), z.strictObject({ actor: name(ACTORS, "役者"), size: z.number().optional() })),
  scenes: z.array(SceneZ).min(1),
});
export type Episode = z.infer<typeof EpisodeZ>;
