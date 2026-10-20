// 書き出した動画 (out/<slug>/<slug>.mp4) から、タイムコードつきのコマの一覧を作る (完成前の見直し用)。
//   npm run review -- <slug>                          全体を 1 秒に 4 コマ
//   npm run review -- <slug> --fps 15 --from 38 --to 41 区間を細かく (くっつく・離れる・跳ぶ瞬間を見る)
// 出力: out/<slug>/review/sheet_NN.jpg。エージェントは全部を画像として読んで、おかしい所を探す (AGENTS.md)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT, argSlug, flag, loadEpisode } from "./lib";

const slug = argSlug();
const { timeline } = loadEpisode(slug);
const video = join(ROOT, "out", slug, `${slug}.mp4`);
if (!existsSync(video)) {
  console.error(`✗ ${video} がありません。先に npm run render -- ${slug} を回します`);
  process.exit(1);
}
const fps = Number(flag("fps") ?? 4);
const from = Number(flag("from") ?? 0);
const to = flag("to");
const dir = join(ROOT, "out", slug, "review");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

// 横長は 5x5 (1 コマ 384 px)、縦長は 8x3 (1 コマ 240 px)
const long = timeline.width >= timeline.height;
const [cols, rows, w] = long ? [5, 5, 384] : [8, 3, 240];
// ffmpeg のフィルタ文字列では `C:` のコロンがオプション区切りとして扱われるため、
// cwd (npm scripts はリポジトリ直下) からの相対パスを使う
const font = "public/fonts/MPLUSRounded1c-ExtraBold.ttf";
const label = `drawtext=fontfile=${font}:text='%{pts\\:hms}':x=6:y=6:fontsize=${long ? 20 : 18}:fontcolor=yellow:box=1:boxcolor=black@0.6:boxborderw=4`;
execFileSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-ss", String(from), ...(to ? ["-to", String(to)] : []), "-copyts", "-i", video,
  "-vf", `fps=${fps},scale=${w}:-2,${label},tile=${cols}x${rows}:padding=2:color=gray`,
  "-q:v", "3", join(dir, "sheet_%02d.jpg"),
]);
const sheets = readdirSync(dir).filter((f) => f.startsWith("sheet_")).sort();
for (const s of sheets) console.log(join(dir, s));
console.log(`${sheets.length} 枚 (1 秒に ${fps} コマ、1 枚に ${cols * rows} コマ)`);
