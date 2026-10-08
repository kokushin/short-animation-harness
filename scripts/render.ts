// 書き出す: npm run render -- <slug> [--draft]
// 出力: out/<slug>/<slug>.mp4 と thumbnail.png (動画のまんなかのコマ)
import { renderMedia, renderStill } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT, argSlug, loadEpisode, tc } from "./lib";
import { browserExecutable, composition } from "./remotion";

const slug = argSlug();
const draft = process.argv.includes("--draft");
const { raw, timeline } = loadEpisode(slug);
const outDir = join(ROOT, "out", slug);
mkdirSync(outDir, { recursive: true });
const { serveUrl, comp, inputProps } = await composition(raw);
const tmp = join(outDir, `.${slug}.raw.mp4`);
const final = join(outDir, draft ? `${slug}.draft.mp4` : `${slug}.mp4`);

let last = -1;
await renderMedia({
  serveUrl,
  composition: comp,
  inputProps,
  codec: "h264",
  crf: draft ? 26 : 18,
  audioCodec: "aac",
  audioBitrate: "320k",
  scale: draft ? 0.5 : 1,
  outputLocation: tmp,
  browserExecutable,
  logLevel: "error",
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 20);
    if (p !== last) process.stdout.write(`\rrender ${"#".repeat((last = p))}${".".repeat(20 - p)} ${Math.round(progress * 100)}%`);
  },
});
process.stdout.write("\n");

// 音の大きさを -14 LUFS (動画サイトの基準) にそろえる。全体に同じだけ足し、はみ出るピークだけリミッターで抑える。
// そのまえに、短い区間だけ極端に大きい所 (3 秒の平均が -11 LUFS を超える所) を見つけて、そこだけなめらかに下げる
const stats = loudness(tmp);
if (stats !== null) {
  const spots = loudSpots(tmp, -14 - stats);
  for (const s of spots.list) console.log(`大きすぎる所を下げる: ${tc(s.from * 30)}〜${tc(s.to * 30)} (最大 -${s.db.toFixed(1)} dB)`);
  const gain = -14 - (spots.filter ? (loudness(tmp, spots.filter) ?? stats) : stats);
  execFileSync("ffmpeg", [
    "-hide_banner", "-y", "-loglevel", "error", "-i", tmp, "-c:v", "copy",
    "-af", `${spots.filter}volume=${gain.toFixed(2)}dB,alimiter=limit=${Math.pow(10, -2 / 20).toFixed(4)}:attack=5:release=60:level=false`,
    "-ar", "48000", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", final,
  ]);
  rmSync(tmp);
} else renameSync(tmp, final);

await renderStill({ serveUrl, composition: comp, inputProps, frame: Math.floor((timeline.frames / 2) * 2), output: join(outDir, "thumbnail.png"), browserExecutable, logLevel: "error" });
console.log(`書き出し: ${final.replace(ROOT, "")} (${tc(timeline.frames)})`);

/** 全体の大きさ (LUFS)。音が無ければ null */
function loudness(file: string, pre = ""): number | null {
  try {
    const out = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${file}" -vn -af "${pre}loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1`], { encoding: "utf8" });
    const v = Number(JSON.parse(out.slice(out.lastIndexOf("{"), out.lastIndexOf("}") + 1)).input_i);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** 3 秒の平均 (short-term loudness) が limit を超える所を、超えたぶんだけ下げる volume フィルタ */
function loudSpots(file: string, gain: number, limit = -11) {
  const out = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${file}" -vn -af "ebur128=metadata=1,ametadata=print:key=lavfi.r128.S:file=-" -f null - 2>/dev/null`], { encoding: "utf8", maxBuffer: 64 << 20 });
  const pts: [number, number][] = [];
  let t = 0;
  for (const line of out.split("\n")) {
    const a = line.match(/pts_time:([0-9.]+)/);
    if (a) t = Number(a[1]);
    const b = line.match(/lavfi\.r128\.S=(-?[0-9.]+)/);
    if (b) pts.push([t, Number(b[1]) + gain]);
  }
  // S は 3 秒の窓の終わりに付く。窓のまんなかへ 1.5 秒戻し、下げ幅を前後 1.5 秒に広げる
  const step = 0.1;
  const n = Math.ceil((pts.at(-1)?.[0] ?? 0) / step) + 1;
  const over = new Array(n).fill(0);
  for (const [tt, s] of pts) {
    if (s <= limit) continue;
    const c = Math.round((tt - 1.5) / step);
    for (let k = c - 15; k <= c + 15; k++) if (k >= 0 && k < n) over[k] = Math.max(over[k], s - limit);
  }
  const list: { from: number; to: number; db: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (over[i] <= 0) continue;
    let j = i;
    let db = 0;
    while (j < n && over[j] > 0) db = Math.max(db, over[j++]);
    list.push({ from: i * step, to: j * step, db });
    i = j;
  }
  const r = 0.4;
  const expr = list.map((s) => `${s.db.toFixed(2)}*min(1,max(0,min((t-${(s.from - r).toFixed(2)})/${r},(${(s.to + r).toFixed(2)}-t)/${r})))`).reduce((a, x) => (a ? `max(${a},${x})` : x), "");
  return { list, filter: expr ? `volume='pow(10,-(${expr})/20)':eval=frame,` : "" };
}
