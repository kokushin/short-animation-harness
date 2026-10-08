# 台本 (episode.json) の書き方

台本は `episodes/<slug>/episode.json` に置きます。形は `src/episode/schema.ts` です。ここに無いことをしたいときは、ハーネスに機能を足します (`AGENTS.md`)。

```jsonc
{
  "format": "short",                  // short = 縦 1080x1920 (既定) / long = 横 1920x1080
  "title": "タイトル",
  "description": "説明 (なくてもよい)",
  "end": "iris",                      // 終わり方: iris (既定。丸くすぼまって黒) / fade / cut
  "endFocus": "a",                    // iris の中心にする役者 (省くと画面のまんなか)
  "cast": {                           // 役者。actor は assets.json の actors の名前
    "a": { "actor": "ball" },
    "b": { "actor": "ball", "size": 0.6 }   // size は標準の幅 (assets.json の w) に掛ける倍率
  },
  "scenes": [
    {
      "id": "s1",
      "place": "field",               // 背景 (assets.json の places)
      "enter": "fade",                // cut / fade (最初の場面は fade、ほかは cut が既定)
      "bgm": "theme",                 // この場面の頭で BGM を替える (null で止める。省くとそのまま)
      "cam": { "x": 800, "y": 450, "zoom": 1 },
      "setup": {                      // この場面に出す役者と最初の位置。ここに無い役者は出ない
        "a": { "at": [300, 760] },
        "b": { "at": [1300, 760], "facing": "left", "look": "default", "hidden": false }
      },
      "beats": [                      // 拍。頭から順に積まれる
        {
          "dur": 1.5,                 // 拍の長さ (秒)
          "note": "a が右へ動く",      // 演出メモ (check の時刻表に出る)
          "do": [{ "who": "a", "act": "move", "to": [800, 760], "ease": "inOut" }],
          "se": [{ "id": "pop", "at": 0.2 }],
          "text": [{ "body": "文字", "pos": "bottom", "at": 0, "dur": 1 }],
          "cam": { "x": 800, "zoom": 1.5 }   // 拍の長さ (か dur) をかけて寄る
        }
      ]
    }
  ]
}
```

## 座標

- 世界は高さ 900 のワールド px です。横幅は背景の絵を高さ 900 に合わせたときの幅 (無地は 1600) です。
- 役者の `at` / `to` は**足もとの中央**です。足もとの y が大きい (手前) ほど前に描かれます。
- カメラは zoom 1 で縦 900 がちょうど映ります (縦長のショートでは横 506 ほど)。世界の外は映しません。

## 動き (do)

どれも `who` (役者) と `at` (拍の頭からの秒) を持ちます。

| act | 引数 | 中身 |
|---|---|---|
| `move` | `to`、`dur`、`ease` (linear / inOut / in / out) | 位置を移す。`dur` を省くと拍の終わりまでかける |
| `show` / `hide` | — | 出す / 消す |
| `look` | `look` | 見た目を替える (役者のフォルダの中の絵の名前) |
| `turn` | `facing` (left / right) | 向きを替える (絵を左右に反転する) |
