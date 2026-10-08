// 確認用の静止画を描いて、タイムコードつきの一覧にまとめる。
//   npm run stills -- <slug>                  拍ごとに 1 枚 (拍の 6 割の位置)
//   npm run stills -- <slug> --at 0:12,1:05.5 指定の時刻
// 出力: out/<slug>/stills/sheet_NN.jpg。エージェントは画像として読んで、構図・大きさ・はみ出しを確かめる
import { openBrowser, renderStill } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SUB } from "../src/episode/resolve";
import { ROOT, argSlug, flag, loadEpisode, tc } from "./lib";
import { browserExecutable, composition } from "./remotion";

const slug = argSlug();
const { raw, episode, timeline } = loadEpisode(slug);
const dir = join(ROOT, "out", slug, "stills");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const parseTc = (s: string) => {
  const [m, sec] = s.includes(":") ? s.split(":") : ["0", s];
  return (Number(m) * 60 + Number(sec)) * 30;
};
let frames: number[] = [];
const at = flag("at");
if (at) frames = at.split(",").map((s) => parseTc(s.trim()));
else {
  let t = 0;
  for (const sc of episode.scenes)
    for (const b of sc.beats) {
      frames.push(t + Math.round(b.dur * 30 * 0.6));
      t += Math.round(b.dur * 30);
    }
}
frames = frames.filter((f) => f >= 0 && f < timeline.frames);

const { serveUrl, comp, inputProps } = await composition(raw);
const browser = await openBrowser("chrome", { browserExecutable });
const scale = timeline.width >= 1920 ? 0.4 : 0.5;
const font = join(ROOT, "public/fonts/MPLUSRounded1c-ExtraBold.ttf");
for (const [i, f] of frames.entries()) {
  const png = join(dir, `${String(i).padStart(3, "0")}.png`);
  await renderStill({ serveUrl, composition: comp, inputProps, frame: Math.round(f * SUB), output: png, scale, puppeteerInstance: browser, logLevel: "error" });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `drawtext=fontfile=${font}:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.7:text='${tc(f).replace(":", "\\:")}':x=6:y=6`, png.replace(".png", ".jpg")]);
  rmSync(png);
  process.stdout.write(`\rstill ${i + 1}/${frames.length}`);
}
await browser.close({ silent: true });
process.stdout.write("\n");
const tile = timeline.width >= timeline.height ? "4x4" : "6x2";
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", join(dir, "%03d.jpg"), "-vf", `tile=${tile}:padding=4:color=gray`, "-q:v", "4", "-start_number", "0", join(dir, "sheet_%02d.jpg")]);
console.log(`out/${slug}/stills/sheet_*.jpg`);
