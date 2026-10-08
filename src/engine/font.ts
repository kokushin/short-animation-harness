// 文字のフォント (scripts/setup-fonts.sh が public/fonts に取ってくる)。描きはじめる前に読み込みを待つ。
import { continueRender, delayRender, staticFile } from "remotion";

export const FONT = "'Harness Round', sans-serif";
let loaded = false;

export function loadFonts(): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("font");
  new FontFace("Harness Round", `url(${staticFile("fonts/MPLUSRounded1c-ExtraBold.ttf")})`)
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => console.error("フォントが読めません。npm run setup を回してください"))
    .finally(() => continueRender(handle));
}
