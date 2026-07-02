import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily: SANS } = loadSans("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });
const { fontFamily: MONO } = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] });

/* ----------------------------------------------------------------- theme */
const C = {
  bg: "#08090B",
  panel: "#0D1117",
  border: "#1C2128",
  borderLit: "#2D333B",
  green: "#00FF66",
  amber: "#FF9900",
  red: "#FF3B30",
  text: "#E6E8EB",
  dim: "#8B949E",
  faint: "#5A626B",
};

export const FPS = 30;
// Scene durations in frames (30fps). Sum drives TOTAL_FRAMES.
// Scaled to match the 102.3s voice-over (Declan Sage read) so each scene lands on its narration.
const DUR = [249, 282, 282, 282, 282, 282, 282, 282, 564, 282];
export const TOTAL_FRAMES = DUR.reduce((a, b) => a + b, 0); // 3069 = 102.3s (= VO length)

/* ------------------------------------------------------------- utilities */
const fade = (frame: number, dur: number, hold = 18) =>
  interpolate(frame, [0, hold, dur - hold, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const rise = (frame: number, delay: number, fps: number) => {
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)` };
};

/* --------------------------------------------------------- animated back */
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame * 0.35) % 64;
  const glow = interpolate(Math.sin(frame / 40), [-1, 1], [0.06, 0.14]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {/* moving dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          backgroundPosition: `${drift}px ${drift}px`,
        }}
      />
      {/* green horizon glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 700px at 78% 30%, rgba(0,255,102,${glow}), transparent 60%)`,
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------- browser frame */
const Screenshot: React.FC<{ src: string; dur: number; url: string; from?: "left" | "right" }> = ({
  src,
  dur,
  url,
  from = "right",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const slide = interpolate(s, [0, 1], [from === "right" ? 60 : -60, 0]);
  const scale = interpolate(frame, [0, dur], [1.06, 1.14], { extrapolateRight: "clamp" });
  const pan = interpolate(frame, [0, dur], [0, -3], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        transform: `translateX(${slide}px)`,
        opacity: s,
        borderRadius: 14,
        overflow: "hidden",
        border: `1px solid ${C.borderLit}`,
        boxShadow: "0 40px 120px rgba(0,255,102,0.10), 0 20px 60px rgba(0,0,0,0.6)",
        background: C.panel,
        width: "100%",
      }}
    >
      <div
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 16px",
          borderBottom: `1px solid ${C.border}`,
          fontFamily: MONO,
          fontSize: 14,
          color: C.faint,
        }}
      >
        <span style={{ width: 11, height: 11, borderRadius: 99, background: "#FF5F56" }} />
        <span style={{ width: 11, height: 11, borderRadius: 99, background: "#FFBD2E" }} />
        <span style={{ width: 11, height: 11, borderRadius: 99, background: "#27C93F" }} />
        <span style={{ marginLeft: 16, letterSpacing: 1 }}>{url}</span>
      </div>
      <div style={{ overflow: "hidden", aspectRatio: "16 / 10" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            display: "block",
            transform: `scale(${scale}) translateY(${pan}%)`,
            transformOrigin: "center top",
          }}
        />
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------- intro */
const Intro: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur), justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${interpolate(mark, [0, 1], [0.9, 1])})`, opacity: mark, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 34 }}>
          <div
            style={{
              width: 78,
              height: 78,
              borderRadius: 18,
              background: C.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 60px ${C.green}66`,
            }}
          >
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l3 8 4-16 3 8h4" />
            </svg>
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, letterSpacing: -2, color: C.text }}>
            TICKRR<span style={{ color: C.green }}>.</span>
          </div>
        </div>
      </div>
      <div style={{ ...rise(frame, 14, fps), fontFamily: SANS, fontSize: 44, fontWeight: 600, color: C.text, textAlign: "center", maxWidth: 1200 }}>
        The <span style={{ color: C.green }}>Bloomberg Terminal</span> for prediction markets
      </div>
      <div style={{ ...rise(frame, 26, fps), fontFamily: MONO, fontSize: 22, color: C.dim, marginTop: 24, letterSpacing: 4 }}>
        SPORTS · POLITICS · MACRO · CRYPTO — ONE BOARD
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------- feature scene */
const Feature: React.FC<{
  dur: number;
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  line: string;
  tag: string;
  img: string;
  url: string;
  side?: "left" | "right";
}> = ({ dur, index, eyebrow, title, line, tag, img, url, side = "right" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const textSide = side === "right" ? "left" : "right";
  const Text = (
    <div style={{ flex: 1, padding: "0 70px", textAlign: textSide as "left" | "right" }}>
      <div style={{ ...rise(frame, 6, fps), fontFamily: MONO, fontSize: 20, letterSpacing: 4, color: C.amber, marginBottom: 22 }}>
        {index} · {eyebrow}
      </div>
      <div style={{ ...rise(frame, 12, fps), fontFamily: SANS, fontWeight: 800, fontSize: 62, lineHeight: 1.05, color: C.text, letterSpacing: -1.5 }}>
        {title}
      </div>
      <div style={{ ...rise(frame, 20, fps), fontFamily: SANS, fontSize: 27, lineHeight: 1.5, color: C.dim, marginTop: 26, maxWidth: 560, marginLeft: textSide === "right" ? "auto" : 0 }}>
        {line}
      </div>
      <div
        style={{
          ...rise(frame, 30, fps),
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          marginTop: 30,
          padding: "10px 18px",
          borderRadius: 999,
          border: `1px solid ${C.green}55`,
          background: `${C.green}11`,
          fontFamily: MONO,
          fontSize: 18,
          color: C.green,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 99, background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
        {tag}
      </div>
    </div>
  );
  const Shot = (
    <div style={{ flex: 1.15, padding: "0 20px" }}>
      <Screenshot src={img} dur={dur} url={url} from={side} />
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur), flexDirection: "row", alignItems: "center" }}>
      {side === "right" ? (
        <>
          {Text}
          {Shot}
        </>
      ) : (
        <>
          {Shot}
          {Text}
        </>
      )}
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------- comparison */
type Cell = "yes" | "part" | "no";
const COLS = ["Tickrr", "Raw venues", "News aggregators", "Generic dashboards"];
const ROWS: { label: string; cells: Cell[] }[] = [
  { label: "Cross-venue divergence (Polymarket ↔ Kalshi)", cells: ["yes", "no", "no", "part"] },
  { label: "Fair-value + dislocation engine", cells: ["yes", "no", "no", "part"] },
  { label: "Grounded AI — “why did it move?” w/ sources", cells: ["yes", "no", "part", "no"] },
  { label: "Sports · politics · macro · crypto, unified", cells: ["yes", "part", "yes", "part"] },
  { label: "Catalyst calendar (what moves it next)", cells: ["yes", "no", "part", "no"] },
  { label: "Watchlist + alerts", cells: ["yes", "yes", "part", "no"] },
  { label: "API / MCP for AI agents", cells: ["yes", "part", "no", "part"] },
  { label: "Intel-only — no execution conflict", cells: ["yes", "no", "yes", "yes"] },
];

const Mark: React.FC<{ v: Cell; lit: boolean }> = ({ v, lit }) => {
  const map = {
    yes: { ch: "✓", col: C.green },
    part: { ch: "~", col: C.amber },
    no: { ch: "—", col: C.faint },
  }[v];
  return (
    <span style={{ color: map.col, fontFamily: MONO, fontSize: 30, fontWeight: 700, opacity: lit ? 1 : 0, transform: `scale(${lit ? 1 : 0.5})`, transition: "none", display: "inline-block" }}>
      {map.ch}
    </span>
  );
};

const Comparison: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur), justifyContent: "center", alignItems: "center", padding: "0 90px" }}>
      <div style={{ ...rise(frame, 4, fps), fontFamily: MONO, fontSize: 20, letterSpacing: 5, color: C.amber, marginBottom: 12 }}>
        08 · THE INTELLIGENCE LAYER
      </div>
      <div style={{ ...rise(frame, 10, fps), fontFamily: SANS, fontWeight: 800, fontSize: 56, color: C.text, marginBottom: 34, letterSpacing: -1 }}>
        One terminal vs. the rest of the stack
      </div>
      <div style={{ width: "100%", maxWidth: 1560, border: `1px solid ${C.borderLit}`, borderRadius: 16, overflow: "hidden", background: `${C.panel}cc`, opacity: rise(frame, 16, fps).opacity }}>
        {/* header */}
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr 1fr 1fr", borderBottom: `1px solid ${C.borderLit}`, background: "#0A0D11" }}>
          <div style={{ padding: "18px 24px", fontFamily: MONO, fontSize: 16, color: C.faint, letterSpacing: 2 }}>CAPABILITY</div>
          {COLS.map((c, i) => (
            <div
              key={c}
              style={{
                padding: "18px 12px",
                textAlign: "center",
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 20,
                color: i === 0 ? C.green : C.dim,
                background: i === 0 ? `${C.green}0D` : "transparent",
                borderLeft: i === 0 ? `1px solid ${C.green}44` : "none",
                borderRight: i === 0 ? `1px solid ${C.green}44` : "none",
              }}
            >
              {c}
            </div>
          ))}
        </div>
        {/* rows */}
        {ROWS.map((r, ri) => {
          const rowLit = frame > 20 + ri * 18;
          return (
            <div
              key={r.label}
              style={{
                display: "grid",
                gridTemplateColumns: "1.7fr 1fr 1fr 1fr 1fr",
                borderBottom: ri < ROWS.length - 1 ? `1px solid ${C.border}` : "none",
                opacity: rowLit ? 1 : 0.15,
                background: ri % 2 ? "rgba(255,255,255,0.015)" : "transparent",
              }}
            >
              <div style={{ padding: "16px 24px", fontFamily: SANS, fontSize: 20, color: C.text }}>{r.label}</div>
              {r.cells.map((v, ci) => (
                <div
                  key={ci}
                  style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    background: ci === 0 ? `${C.green}0D` : "transparent",
                    borderLeft: ci === 0 ? `1px solid ${C.green}44` : "none",
                    borderRight: ci === 0 ? `1px solid ${C.green}44` : "none",
                  }}
                >
                  <Mark v={v} lit={rowLit} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ ...rise(frame, 40, fps), display: "flex", gap: 28, marginTop: 22, fontFamily: MONO, fontSize: 16, color: C.faint }}>
        <span><span style={{ color: C.green }}>✓</span> full</span>
        <span><span style={{ color: C.amber }}>~</span> partial</span>
        <span><span style={{ color: C.faint }}>—</span> none</span>
        <span style={{ marginLeft: 12 }}>Feature coverage as of 2026, to our knowledge.</span>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- CTA */
const CTA: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur), justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div style={{ transform: `scale(${interpolate(mark, [0, 1], [0.94, 1])})`, opacity: mark, display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 50px ${C.green}66` }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3 8 4-16 3 8h4" />
          </svg>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.text, letterSpacing: -1 }}>
          TICKRR<span style={{ color: C.green }}>.</span>
        </div>
      </div>
      <div style={{ ...rise(frame, 14, fps), fontFamily: SANS, fontSize: 46, fontWeight: 700, color: C.text, maxWidth: 1100, lineHeight: 1.15 }}>
        Trade prediction markets on <span style={{ color: C.green }}>information</span>, not vibes.
      </div>
      <div style={{ ...rise(frame, 26, fps), fontFamily: SANS, fontSize: 26, color: C.dim, marginTop: 22 }}>
        Start free · Upgrade when the edge pays for itself
      </div>
      <div style={{ ...rise(frame, 36, fps), fontFamily: MONO, fontSize: 20, color: C.amber, marginTop: 30, letterSpacing: 3 }}>
        INTEL ONLY · NEVER PICKS · BY TICKER LABS
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------- global footer */
const Footer: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame / 12), [-1, 1], [0.35, 1]);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 46,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
        borderTop: `1px solid ${C.border}`,
        background: "rgba(8,9,11,0.6)",
        fontFamily: MONO,
        fontSize: 15,
        color: C.faint,
        letterSpacing: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: C.green, opacity: pulse, boxShadow: `0 0 8px ${C.green}` }} />
        TICKRR · LIVE
      </div>
      <div>POLYMARKET + KALSHI · GROUNDED BY GEMINI · INTEL ONLY</div>
    </div>
  );
};

/* ------------------------------------------------------------------ main */
export const Tickrr: React.FC = () => {
  const scenes: React.ReactNode[] = [
    <Intro dur={DUR[0]} />,
    <Feature
      dur={DUR[1]}
      index="01"
      eyebrow="REAL-TIME RADAR"
      title={<>Dislocations, the moment they open</>}
      line="A fair-value engine flags price-vs-news gaps, thin-liquidity traps and overreactions — the second they appear."
      tag="Not a feed. A signal."
      img="terminal.png"
      url="tickrr.app/terminal"
      side="right"
    />,
    <Feature
      dur={DUR[2]}
      index="02"
      eyebrow="CROSS-VENUE"
      title={<>Polymarket vs Kalshi, side by side</>}
      line="The same question priced on two venues — we surface the gap in percentage points, only when it’s truly like-for-like."
      tag="True gaps only."
      img="nba.png"
      url="tickrr.app/divergence"
      side="left"
    />,
    <Feature
      dur={DUR[3]}
      index="03"
      eyebrow="COVERAGE"
      title={<>Every market. One board.</>}
      line="The World Cup, the Fed, the midterms, Bitcoin — unified, with category scoping and a live catalyst calendar."
      tag="Sports · Politics · Macro · Crypto"
      img="hero.png"
      url="tickrr.app"
      side="right"
    />,
    <Feature
      dur={DUR[4]}
      index="04"
      eyebrow="GROUNDED AI"
      title={<>Why did it move?</>}
      line="Gemini + Google Search explains every move with citations, freshness and confidence — never an unsourced guess."
      tag="Sourced. Dated. Auditable."
      img="terminal.png"
      url="tickrr.app/why"
      side="left"
    />,
    <Feature
      dur={DUR[5]}
      index="05"
      eyebrow="DELIBERATION ROOM"
      title={<>An AI room that argues both sides</>}
      line="Bull, bear and referee models debate a market and show their reasoning — so you decide with the full picture."
      tag="Intel only. Never picks."
      img="room.png"
      url="tickrr.app/room"
      side="right"
    />,
    <Feature
      dur={DUR[6]}
      index="06"
      eyebrow="RUNS ITSELF"
      title={<>The company that operates itself</>}
      line="Agents research, publish and grow across channels — every decision logged, supervised and compliance-checked."
      tag="AI-native operations."
      img="growth.png"
      url="tickrr.app/ops"
      side="left"
    />,
    <Feature
      dur={DUR[7]}
      index="07"
      eyebrow="YOUR EDGE"
      title={<>Your watchlist. Your catalysts.</>}
      line="Save the markets you track, build your slate, and see the calendar of events that move them next."
      tag="Catalyst calendar built in."
      img="myspace.png"
      url="tickrr.app/my-space"
      side="right"
    />,
    <Comparison dur={DUR[8]} />,
    <CTA dur={DUR[9]} />,
  ];

  let offset = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: SANS }}>
      <Backdrop />
      {scenes.map((el, i) => {
        const from = offset;
        offset += DUR[i];
        return (
          <Sequence key={i} from={from} durationInFrames={DUR[i]}>
            {el}
          </Sequence>
        );
      })}
      <Footer />
    </AbsoluteFill>
  );
};
