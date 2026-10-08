// Remotion の bundle と composition の選び出し (render / stills で共用)
import { bundle } from "@remotion/bundler";
import { selectComposition } from "@remotion/renderer";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib";

let served: string | null = null;

// Remotion が取ってくる Chromium の代わりに使うブラウザ (取りに行けない環境用。例: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell)
// 指定が無くても、クラウドのセッションに入っている Playwright の headless shell があればそれを使う (Chromium を取りに行かない)
export const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || playwrightHeadlessShell();

function playwrightHeadlessShell(): string | null {
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (process.platform !== "linux" || !existsSync(dir)) return null;
  const builds = readdirSync(dir)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const d of builds) {
    for (const exe of ["chrome-linux/headless_shell", "chrome-headless-shell-linux64/chrome-headless-shell"]) {
      if (existsSync(join(dir, d, exe))) return join(dir, d, exe);
    }
  }
  return null;
}

export async function serve(): Promise<string> {
  if (served) return served;
  process.stdout.write("bundle 中…");
  served = await bundle({
    entryPoint: join(ROOT, "src/Root.tsx"),
    publicDir: join(ROOT, "public"),
    onProgress: () => {},
  });
  process.stdout.write(" done\n");
  return served;
}

export async function composition(raw: unknown, id = "Episode") {
  const serveUrl = await serve();
  const inputProps = { episode: raw };
  const comp = await selectComposition({ serveUrl, id, inputProps, logLevel: "error", browserExecutable });
  return { serveUrl, comp, inputProps };
}
