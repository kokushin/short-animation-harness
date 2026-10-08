// 台本のひな形を作る: npm run new -- <slug> [--format short|long] [--title "…"]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, argSlug, flag } from "./lib";

const slug = argSlug();
const dir = join(ROOT, "episodes", slug);
if (existsSync(join(dir, "episode.json"))) {
  console.error(`✗ episodes/${slug}/episode.json はもうあります`);
  process.exit(1);
}
const episode = {
  format: flag("format") ?? "short",
  title: flag("title") ?? slug,
  cast: {},
  scenes: [{ id: "s1", place: "white", setup: {}, beats: [{ dur: 2, text: [{ body: slug, pos: "center" }] }] }],
};
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "episode.json"), JSON.stringify(episode, null, 2) + "\n");
console.log(`作りました: episodes/${slug}/episode.json`);
