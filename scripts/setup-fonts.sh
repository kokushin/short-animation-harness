#!/bin/sh
# 文字のフォント (SIL Open Font License) を public/fonts に取ってくる。リポジトリには入れない (.gitignore)
set -e
cd "$(dirname "$0")/.."
mkdir -p public/fonts
f=public/fonts/MPLUSRounded1c-ExtraBold.ttf
[ -s "$f" ] || curl -sfL https://github.com/google/fonts/raw/main/ofl/mplusrounded1c/MPLUSRounded1c-ExtraBold.ttf -o "$f"
echo "$f"
