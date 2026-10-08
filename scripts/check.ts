// 台本を検査して、拍ごとの時刻表を出す: npm run check -- <slug> [--quiet]
// ✗ (誤り) は終了コード 1。⚠ (警告) は直すかどうかを判断する。検査は必要に応じて足していく (AGENTS.md)
import { ACTORS } from "../src/assets/catalog";
import { WORLD_H, worldWidth } from "../src/episode/resolve";
import { poseAt } from "../src/engine/state";
import { argSlug, loadEpisode, tc } from "./lib";

const slug = argSlug();
let loaded;
try {
  loaded = loadEpisode(slug);
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
}
const { episode, timeline } = loaded;
const warns: string[] = [];

// 時刻表
if (!process.argv.includes("--quiet")) {
  episode.scenes.forEach((sc, si) => {
    const rs = timeline.scenes[si];
    console.log(`\n■ ${sc.id} [${sc.place}] ${tc(rs.from)}〜${tc(rs.to)}`);
    let t = rs.from;
    for (const [bi, b] of sc.beats.entries()) {
      const acts = (b.do ?? []).map((a) => `${a.who}.${a.act}`).join(" ");
      const se = (b.se ?? []).map((s) => `♪${s.id}`).join(" ");
      console.log(`  ${tc(t)} ${String(bi).padStart(2)} ${b.dur}s ${acts} ${se}${b.note ? `  // ${b.note}` : ""}`);
      t += Math.round(b.dur * 30);
    }
  });
}

// 役者が背景の外 (左右・上下) にはみ出していないか (拍の終わりで見る)
for (const rs of timeline.scenes) {
  const ww = worldWidth(rs.place);
  for (const tr of rs.tracks) {
    for (const f of [rs.from, ...tr.moves.map((m) => m.end)]) {
      const p = poseAt(tr, Math.min(f, rs.to - 1));
      if (!p.visible) continue;
      if (p.pos[0] < 0 || p.pos[0] > ww || p.pos[1] < p.h * 0.5 || p.pos[1] > WORLD_H + 1)
        warns.push(`${rs.id} ${tc(f)} ${tr.id} が背景の外にいます (足もと [${p.pos.map(Math.round).join(", ")}]、世界は ${ww}x${WORLD_H})`);
    }
  }
}
// 向いている方と反対へ動いていないか (後ろ向きに歩いて見える)。絵の向きは assets.json の faces
for (const rs of timeline.scenes) {
  for (const tr of rs.tracks) {
    for (const m of tr.moves) {
      const dx = m.to[0] - m.from[0];
      if (Math.abs(dx) < 40) continue;
      const p = poseAt(tr, (m.start + m.end) / 2);
      if (p.visible && Math.sign(dx) !== p.facing)
        warns.push(`${rs.id} ${tc(m.start)} ${tr.id} が向いている方と反対へ動いています (turn で向きを替えるか、絵の向きが違うなら assets.json の faces を直す)`);
    }
  }
}
// 使っていない役者
const used = new Set(episode.scenes.flatMap((s) => Object.keys(s.setup)));
for (const id of Object.keys(episode.cast)) if (!used.has(id)) warns.push(`cast の ${id} がどの場面にも出ていません`);
void ACTORS;

for (const w of warns) console.log(`⚠ ${w}`);
console.log(`\n✓ ${slug}: ${episode.format} ${timeline.width}x${timeline.height} ${tc(timeline.frames)} / 場面 ${timeline.scenes.length} / 警告 ${warns.length}`);
