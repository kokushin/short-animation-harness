# AGENTS.md

このリポジトリは、JSON の台本 (`episodes/<slug>/episode.json`) から短いアニメーション動画を書き出す**最小のハーネス**です (Remotion + ffmpeg)。
中身はわざと最小限にしてあります。**必要な機能は、ユーザーの指示に合わせてエージェントがその都度足します。**

## 最初に開いたとき

1. `node_modules` が無ければ `npm install`、`public/fonts/` が空なら `npm run setup` を回します。
2. `assets.json` の `actors` が空なら、まだ素材がありません。ユーザーに、次の場所へ画像や音を置くよう案内します。置いたら `npm run assets` で登録されます。

   | 置き場所 | 中身 |
   |---|---|
   | `public/places/<名前>.png` | 背景 (横長の絵。高さ 900 の世界に合わせて敷く) |
   | `public/actors/<名前>/<見た目>.png` | 役者 (透過 PNG。フォルダの中の 1 枚ずつが見た目の差分。`default` が既定) |
   | `public/se/<名前>.mp3` | 効果音・声 |
   | `public/bgm/<名前>.mp3` | BGM |

   役者の絵が左を向いて描かれているときは、`assets.json` のその役者に `"faces": "left"` を書きます (台本の向きと合わせて反転される)。役者の幅 `w` もここで直します。

   素材の利用規約はユーザーに確かめます。再配布できない素材は、公開するリポジトリに commit しません。

## 動画を作ってと言われたら

1. 何をどの順に見せるかを決めます (既定は縦長のショート `short` 1080x1920。横長は `long` 1920x1080)。
2. `npm run new -- <slug> --title "…"` でひな形を作り、台本を書きます (`docs/episode-format.md`)。
3. `npm run check -- <slug>` を回して、誤り (✗) と警告 (⚠) を直します。
4. `npm run stills -- <slug>` の一覧 (`out/<slug>/stills/sheet_*.jpg`) を画像として読み、構図・大きさ・はみ出し・文字を直します。
5. `npm run render -- <slug>` で書き出します (`out/<slug>/<slug>.mp4`。音は -14 LUFS にそろい、大きすぎる所は自動で下がります)。
6. **完成の前に** `npm run review -- <slug>` の一覧を全部読み、おかしい所 (はみ出し・重なり・一瞬の跳び・間延び) を見つける気で探します。気になる区間は `--fps 15 --from 12 --to 14` で細かく見ます。見つけたら直して、書き出し直します。
7. 動画のパスと尺、直したことを短く報告します。

## 機能を足すとき

台本の書き方 (`src/episode/schema.ts`) で表せないことを頼まれたら (跳ねる・回る・吹き出し・転換・画面の効果・自動の効果音 など)、**その場しのぎで台本をごまかさず、ハーネスに機能を足します。**

- 台本の形 (`schema.ts`) → タイムラインへの解決 (`src/episode/resolve.ts`) → 描画 (`src/engine/state.ts`・`Video.tsx`) → 説明 (`docs/episode-format.md`) を、まとめて直します。
- 描画は**フレーム番号だけ**で決めます。CSS のアニメーション・`Math.random`・`Date.now` は使いません (乱数が要るなら、種から決まる関数を作る)。
- 書き出しは 60fps で、描画のフレーム `f` は小数になります。`Math.floor(f)` などで丸めません。
- 世界の中の物の位置と大きさは `transform` で渡します (`left` / `top` は丸められてカクつく)。
- 台本の書き方で防げる誤りは、`scripts/check.ts` の警告にします。
- 足したら `npm run typecheck` と、その機能を使った台本の `npm run stills` で確かめます。
- 一度きりの演出のために大きな仕組みを足しません。次にも使える形で、小さく足します。

ユーザーの感想で直したことのうち、次の動画でも効くもの (いつも同じ直し方をする位置・重なり・音量など) は、その 1 本だけでなくハーネスに入れます。

## コマンド

| コマンド | 中身 |
|---|---|
| `npm run setup` | フォントを取ってきて、素材を登録する |
| `npm run assets` | `public/` の素材を `assets.json` に登録し、寸法と長さの索引を作る |
| `npm run new -- <slug> [--format short\|long] [--title "…"]` | 台本のひな形 (既定は縦長のショート) |
| `npm run check -- <slug>` | 台本の検査と拍ごとの時刻表 |
| `npm run stills -- <slug> [--at 0:12,1:05]` | 確認用の静止画の一覧 |
| `npm run render -- <slug> [--draft]` | mp4 とサムネイル |
| `npm run review -- <slug> [--fps 15 --from 12 --to 14]` | 書き出した mp4 をコマの一覧にする |
| `npm run studio` | Remotion Studio |
| `npm run typecheck` | 型の検査 |
