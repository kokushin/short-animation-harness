// public/ に置いた素材を目録 (assets.json) に登録し、画像の寸法と音の長さの索引を作る (npm run assets)。
//
//   public/places/<名前>.png|jpg|webp       背景
//   public/actors/<名前>/<見た目>.png|webp   役者 (フォルダの中の 1 枚ずつが見た目の差分。default があれば既定)
//   public/actors/<名前>.png|webp            見た目が 1 つの役者
//   public/se/<名前>.mp3|wav|m4a|ogg         効果音・声
//   public/bgm/<名前>.mp3|wav|m4a|ogg        BGM
//
// assets.json に書き足した値 (役者の幅 w など) は残し、新しいファイルだけを足す。消えたファイルは目録からも外す。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { ROOT } from "./lib";

const IMG = [".png", ".jpg", ".jpeg", ".webp"];
const SND = [".mp3", ".wav", ".m4a", ".ogg"];
const PUB = join(ROOT, "public");
type Rec = Record<string, Record<string, unknown>>;

const path = join(ROOT, "assets.json");
const m = JSON.parse(readFileSync(path, "utf8")) as { places: Rec; actors: Rec; se: Rec; bgm: Rec };
const files = (dir: string, exts: string[]) =>
  existsSync(join(PUB, dir)) ? readdirSync(join(PUB, dir)).filter((f) => exts.includes(extname(f).toLowerCase())).sort() : [];
const id = (f: string) => basename(f, extname(f));
const log: string[] = [];

for (const f of files("places", IMG)) {
  if (!m.places[id(f)]) log.push(`+ place ${id(f)}`);
  m.places[id(f)] = { ...m.places[id(f)], src: `places/${f}` };
}
for (const name of existsSync(join(PUB, "actors")) ? readdirSync(join(PUB, "actors")).sort() : []) {
  const dir = statSync(join(PUB, "actors", name)).isDirectory();
  const looks = dir
    ? Object.fromEntries(
        files(`actors/${name}`, IMG)
          .sort((a, b) => Number(id(b) === "default") - Number(id(a) === "default"))
          .map((f) => [id(f), `actors/${name}/${f}`]),
      )
    : IMG.includes(extname(name).toLowerCase())
      ? { default: `actors/${name}` }
      : {};
  if (!Object.keys(looks).length) continue;
  const key = dir ? name : id(name);
  if (!m.actors[key]) log.push(`+ actor ${key} (${Object.keys(looks).join(", ")})`);
  m.actors[key] = { w: 200, ...m.actors[key], looks };
}
for (const kind of ["se", "bgm"] as const) {
  for (const f of files(kind, SND)) {
    if (!m[kind][id(f)]) log.push(`+ ${kind} ${id(f)}`);
    m[kind][id(f)] = { ...m[kind][id(f)], src: `${kind}/${f}` };
  }
}
// ファイルが無くなった素材を外す
const gone = (p: unknown) => typeof p === "string" && !existsSync(join(PUB, p));
for (const kind of ["places", "se", "bgm"] as const)
  for (const [k, v] of Object.entries(m[kind])) if (gone(v.src)) (delete m[kind][k], log.push(`- ${kind} ${k}`));
for (const [k, v] of Object.entries(m.actors)) if (Object.values(v.looks as object).some(gone)) (delete m.actors[k], log.push(`- actor ${k}`));
writeFileSync(path, JSON.stringify(m, null, 2) + "\n");

// 索引 (画像の寸法・音の長さ)
const probe = (p: string, q: string) => execFileSync("ffprobe", ["-v", "error", "-show_entries", q, "-of", "csv=p=0:s=x", join(PUB, p)], { encoding: "utf8" }).trim();
const images = [...Object.values(m.places).map((p) => p.src), ...Object.values(m.actors).flatMap((a) => Object.values(a.looks as object))].filter(Boolean) as string[];
const audio = [...Object.values(m.se), ...Object.values(m.bgm)].map((s) => s.src as string);
const index = {
  images: Object.fromEntries(images.map((p) => [p, probe(p, "stream=width,height").split("\n")[0].split("x").map(Number)])),
  audio: Object.fromEntries(audio.map((p) => [p, Number(probe(p, "format=duration"))])),
};
writeFileSync(join(ROOT, "src/assets/index.generated.json"), JSON.stringify(index, null, 1) + "\n");
for (const l of log) console.log(l);
console.log(`places ${Object.keys(m.places).length} / actors ${Object.keys(m.actors).length} / se ${Object.keys(m.se).length} / bgm ${Object.keys(m.bgm).length}`);
