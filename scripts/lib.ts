// scripts/ の共通部品: 台本の読み込みと検証
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ZodError } from "zod";
import { EpisodeZ, type Episode } from "../src/episode/schema";
import { resolveEpisode, type Timeline } from "../src/episode/resolve";

export const ROOT = new URL("..", import.meta.url).pathname;

export function episodeDir(slug: string) {
  return join(ROOT, "episodes", slug);
}

export function readEpisodeJson(slug: string): unknown {
  const p = join(episodeDir(slug), "episode.json");
  if (!existsSync(p)) throw new Error(`台本がありません: episodes/${slug}/episode.json (npm run new -- ${slug} で作る)`);
  return JSON.parse(readFileSync(p, "utf8"));
}

export interface Loaded {
  raw: unknown;
  episode: Episode;
  timeline: Timeline;
}

/** 台本を読んで、形の検証と解決まで。失敗したら読みやすい一覧を投げる */
export function loadEpisode(slug: string): Loaded {
  const raw = readEpisodeJson(slug);
  let episode: Episode;
  try {
    episode = EpisodeZ.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      const lines = e.issues.map((i) => `  - ${pathOf(raw, i.path)}: ${i.message}`);
      throw new Error(`台本の形が正しくありません (${e.issues.length} 件)\n${lines.join("\n")}`);
    }
    throw e;
  }
  try {
    return { raw, episode, timeline: resolveEpisode(episode) };
  } catch (e) {
    if (e instanceof Error) throw new Error(`台本の中身に誤りがあります\n  - ${e.message}`);
    throw e;
  }
}

// zod のパスを、場面 id を添えた読みやすい形に
function pathOf(raw: unknown, path: PropertyKey[]): string {
  let out = "";
  let cur: unknown = raw;
  for (const k of path) {
    if (typeof k === "number") {
      const id = cur && typeof cur === "object" && Array.isArray(cur) ? (cur[k] as { id?: string })?.id : undefined;
      out += `[${k}]${id ? `(${id})` : ""}`;
    } else out += out ? `.${String(k)}` : String(k);
    cur = cur && typeof cur === "object" ? (cur as Record<PropertyKey, unknown>)[k] : undefined;
  }
  return out || "(全体)";
}

export const tc = (frames: number, fps = 30) => {
  const s = frames / fps;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

export function argSlug(): string {
  const slug = process.argv.slice(2).find((a) => !a.startsWith("-"));
  if (!slug) {
    console.error("使い方: npm run <cmd> -- <slug>   (episodes/<slug>/episode.json)");
    process.exit(1);
  }
  return slug;
}

export const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : undefined;
};
