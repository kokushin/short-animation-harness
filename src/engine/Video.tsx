// タイムラインを描く。場面ごとに 背景 → 役者 (足もとの y の順) → 文字。音は Sequence で鳴らす。
//
// 世界の中の物の置き場所と大きさは transform で渡す (left / top だと、カメラで拡大する前の層で整数 px に
// 丸められ、寄りの画でゆっくり動く物がカクつく)。CSS のアニメーションや Math.random は使わない。
import type React from "react";
import { AbsoluteFill, Html5Audio, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { PLACES } from "../assets/catalog";
import { SUB, WORLD_H, worldWidth, type ResolvedScene, type Timeline } from "../episode/resolve";
import { loadFonts, FONT } from "./font";
import { camAt, clamp01, poseAt } from "./state";

loadFonts();

export const Video: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const f = useCurrentFrame() / SUB; // 書き出しのコマ (60fps) → 台本のコマ (30fps)。小数のまま
  const sc = timeline.scenes.find((s) => f >= s.from && f < s.to) ?? timeline.scenes[timeline.scenes.length - 1];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {sc && <Scene sc={sc} f={f} w={timeline.width} h={timeline.height} />}
      {sc && f >= timeline.end.start && timeline.end.frames > 0 && <End timeline={timeline} sc={sc} f={f} />}
      {timeline.sounds.map((s, i) => (
        <Sequence key={i} from={Math.round(s.start * SUB)} durationInFrames={Math.max(1, Math.round(s.frames * SUB))} layout="none">
          <Html5Audio src={staticFile(s.src)} volume={s.vol} loop={s.loop} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// 終わり方。iris は役者 (endFocus) か画面のまんなかを中心に丸くすぼまり、閉じたら黒のまま
const End: React.FC<{ timeline: Timeline; sc: ResolvedScene; f: number }> = ({ timeline, sc, f }) => {
  const { width: w, height: h, end } = timeline;
  const u = clamp01((f - end.start) / end.frames);
  if (end.kind === "fade") return <AbsoluteFill style={{ background: "#000", opacity: u }} />;
  let c: [number, number] = [w / 2, h / 2];
  const tr = end.focus ? sc.tracks.find((t) => t.id === end.focus) : undefined;
  if (tr) {
    const p = poseAt(tr, end.start);
    const cam = camAt(sc, end.start, w, h);
    c = [(p.pos[0] - cam.left) * cam.scale, (p.pos[1] - p.h / 2 - cam.top) * cam.scale];
  }
  const far = Math.hypot(Math.max(c[0], w - c[0]), Math.max(c[1], h - c[1]));
  const k = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  const r = far * (1 - k);
  return <AbsoluteFill style={{ background: r < 0.5 ? "#000" : `radial-gradient(circle at ${c[0]}px ${c[1]}px, rgba(0,0,0,0) ${r}px, #000 ${r + 1.5}px)` }} />;
};

export const Scene: React.FC<{ sc: ResolvedScene; f: number; w: number; h: number }> = ({ sc, f, w, h }) => {
  const place = PLACES[sc.place];
  const cam = camAt(sc, f, w, h);
  const poses = sc.tracks.map((t) => poseAt(t, f)).sort((a, b) => a.pos[1] - b.pos[1]);
  const u = h / 1080;
  return (
    <AbsoluteFill style={{ background: place.color ?? "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: worldWidth(sc.place), height: WORLD_H, transformOrigin: "0 0", transform: `scale(${cam.scale}) translate(${-cam.left}px, ${-cam.top}px)` }}>
        {place.src && <Img src={staticFile(place.src)} style={{ position: "absolute", width: "100%", height: "100%" }} />}
        {poses.map(
          (p) =>
            p.visible && (
              <Img
                key={p.id}
                src={staticFile(p.src)}
                style={{ position: "absolute", width: p.w, height: p.h, transformOrigin: "0 0", transform: `translate(${p.pos[0] - p.w / 2}px, ${p.pos[1] - p.h}px)${p.flip ? ` translateX(${p.w}px) scaleX(-1)` : ""}` }}
              />
            ),
        )}
      </div>
      {sc.texts
        .filter((t) => f >= t.start && f < t.end)
        .map((t, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: t.pos === "top" ? h * 0.08 : t.pos === "center" ? h * 0.45 : h * 0.84,
              textAlign: "center",
              fontFamily: FONT,
              fontSize: 64 * u,
              color: "#fff",
              WebkitTextStroke: `${12 * u}px #222`,
              paintOrder: "stroke fill",
              whiteSpace: "pre-wrap",
              opacity: Math.min(clamp01((f - t.start) / 6), clamp01((t.end - f) / 6)),
            }}
          >
            {t.body}
          </div>
        ))}
      {sc.fade > 0 && f - sc.from < sc.fade && <AbsoluteFill style={{ background: "#000", opacity: 1 - clamp01((f - sc.from) / sc.fade) }} />}
    </AbsoluteFill>
  );
};
