/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Growth Console — the human approval queue for the autonomous growth loop.
 * Agent drafts posts from live market signals → you Approve/Reject → approved posts publish
 * to the free channels (Discord + Bluesky). Founder/ops tool.
 */
import { useState, useEffect } from "react";
import { fetchGrowth, generateDrafts, decideDraft, fetchBufferChannels, GrowthDraft, BufferChannel } from "../lib/growth";
import { Rocket, X, Check, Ban, Loader2, RefreshCw, Copy, Hash } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GrowthConsole({ open, onClose }: Props) {
  const [discord, setDiscord] = useState(false);
  const [bluesky, setBluesky] = useState(false);
  const [buffer, setBuffer] = useState(false);
  const [drafts, setDrafts] = useState<GrowthDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [chanBusy, setChanBusy] = useState(false);
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [chanErr, setChanErr] = useState("");
  const [copied, setCopied] = useState("");

  const refresh = async () => {
    const s = await fetchGrowth();
    setDiscord(s.discord);
    setBluesky(s.bluesky);
    setBuffer(s.buffer);
    setDrafts(s.drafts);
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  if (!open) return null;

  const onGenerate = async () => {
    setGenBusy(true);
    await generateDrafts(3);
    await refresh();
    setGenBusy(false);
  };

  const onDecide = async (id: string, action: "approve" | "reject") => {
    setBusy(true);
    await decideDraft(id, action);
    await refresh();
    setBusy(false);
  };

  const onToggleChannels = async () => {
    const next = !showChannels;
    setShowChannels(next);
    if (next && !channels.length) {
      setChanBusy(true);
      setChanErr("");
      const r = await fetchBufferChannels();
      if (r.channels) setChannels(r.channels);
      else setChanErr(r.error || "Could not load channels.");
      setChanBusy(false);
    }
  };

  const copyId = async (id: string) => {
    try { await navigator.clipboard.writeText(id); setCopied(id); setTimeout(() => setCopied(""), 1200); } catch { /* ignore */ }
  };

  const pending = drafts.filter((d) => d.status === "pending");
  const history = drafts.filter((d) => d.status !== "pending").slice(0, 15);

  const chan = (on: boolean, name: string) => (
    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${on ? "border-[#00FF66]/50 text-[#00FF66]" : "border-[#2D333B] text-[#D1D4DC]/40"}`}>
      {name} · {on ? "LIVE" : "DRY-RUN"}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 font-mono">
      <div className="relative w-full max-w-2xl h-[82vh] bg-[#050608] border border-[#00FF66]/40 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(0,255,102,0.15)] scanline-overlay flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#00FF66]/30 bg-[#050608]/80">
          <div className="flex items-center gap-2 text-[#00FF66] terminal-glow-green">
            <Rocket className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest">GROWTH ENGINE · APPROVAL QUEUE</span>
          </div>
          <button onClick={onClose} className="cursor-pointer text-[#00FF66]/60 hover:text-[#00FF66]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls + channel status */}
        <div className="px-4 py-2 border-b border-[#2D333B] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">{chan(discord, "DISCORD")}{chan(bluesky, "BLUESKY")}{chan(buffer, "BUFFER")}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleChannels}
              className="cursor-pointer flex items-center gap-1.5 border border-[#2D333B] text-[#D1D4DC]/70 hover:text-[#00FF66] hover:border-[#00FF66]/50 text-[10px] font-bold px-2.5 py-1.5 rounded transition"
            >
              <Hash className="w-3 h-3" /> BUFFER IDS
            </button>
            <button
              onClick={onGenerate}
              disabled={genBusy}
              className="cursor-pointer flex items-center gap-1.5 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black text-[10px] font-black px-3 py-1.5 rounded transition disabled:opacity-50"
            >
              {genBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              GENERATE DRAFTS
            </button>
          </div>
        </div>

        {/* Buffer channel-ID helper: grab the IDs to paste into BUFFER_CHANNEL_IDS (X/LinkedIn/IG). */}
        {showChannels && (
          <div className="px-4 py-2 border-b border-[#2D333B] bg-[#0B0E11]/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-[#FF9900]/70 font-bold tracking-widest">BUFFER CHANNELS → BUFFER_CHANNEL_IDS</span>
              {chanBusy && <Loader2 className="w-3 h-3 animate-spin text-[#00FF66]" />}
            </div>
            {chanErr && <div className="text-[10px] text-[#FF3B30] font-sans py-1">{chanErr}</div>}
            {!chanBusy && !chanErr && channels.length === 0 && (
              <div className="text-[10px] text-[#D1D4DC]/50 font-sans py-1">No channels found for this Buffer account.</div>
            )}
            {channels.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1 border-b border-[#2D333B]/40 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[9px] uppercase text-[#00FF66]/80 border border-[#00FF66]/30 rounded px-1 shrink-0">{c.service}</span>
                  <span className="text-[11px] text-[#D1D4DC]/80 truncate">{c.name}</span>
                </div>
                <button
                  onClick={() => copyId(c.id)}
                  title="Copy channel ID"
                  className="cursor-pointer flex items-center gap-1 text-[9px] text-[#D1D4DC]/50 hover:text-[#00FF66] shrink-0"
                >
                  <span className="font-mono">{c.id.slice(0, 10)}…</span>
                  {copied === c.id ? <Check className="w-3 h-3 text-[#00FF66]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Feed */}
        <div className="flex-1 overflow-auto p-3 space-y-3">
          <div className="text-[9px] text-[#FF9900]/70 font-bold tracking-widest">PENDING — YOUR APPROVAL ({pending.length})</div>
          {pending.length === 0 && (
            <div className="text-[#D1D4DC]/40 text-[11px] font-sans">
              Nothing pending. Hit <span className="text-[#00FF66]">GENERATE DRAFTS</span> — the agent writes posts from today's live dislocation signals for you to approve.
            </div>
          )}
          {pending.map((d) => (
            <div key={d.id} className="bg-[#0B0E11]/60 border border-[#2D333B] rounded p-3">
              <div className="text-[9px] text-[#D1D4DC]/40 mb-1">{d.source}</div>
              <p className="text-[12px] text-[#D1D4DC] whitespace-pre-line font-sans mb-2">{d.text}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {d.channels.map((c) => (
                    <span key={c} className="text-[8px] text-[#00FF66]/70 border border-[#00FF66]/30 rounded px-1 uppercase">{c}</span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => onDecide(d.id, "reject")}
                    className="cursor-pointer flex items-center gap-1 border border-[#FF3B30]/40 text-[#FF3B30] text-[10px] font-bold px-2 py-1 rounded hover:bg-[#FF3B30]/10 transition disabled:opacity-50"
                  >
                    <Ban className="w-3 h-3" /> REJECT
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onDecide(d.id, "approve")}
                    className="cursor-pointer flex items-center gap-1 bg-[#00FF66] text-black text-[10px] font-black px-2.5 py-1 rounded hover:bg-[#00FF66]/90 transition disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" /> APPROVE &amp; POST
                  </button>
                </div>
              </div>
            </div>
          ))}

          {history.length > 0 && <div className="text-[9px] text-[#D1D4DC]/40 font-bold tracking-widest pt-2">HISTORY</div>}
          {history.map((d) => (
            <div key={d.id} className="border border-[#2D333B]/50 rounded p-2 opacity-70">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#D1D4DC]/40">{d.source}</span>
                <span className={`text-[9px] font-bold ${d.status === "published" ? "text-[#00FF66]" : "text-[#FF3B30]"}`}>{d.status.toUpperCase()}</span>
              </div>
              <p className="text-[10px] text-[#D1D4DC]/50 whitespace-pre-line mt-1">{d.text}</p>
              {d.results && (
                <div className="text-[8px] text-[#D1D4DC]/40 mt-1">
                  {Object.entries(d.results).map(([k, v]) => `${k}: ${v}`).join("  ·  ")}
                </div>
              )}
              {d.mediaUrl && (d.mediaType === "video" ? (
                <a href={d.mediaUrl} target="_blank" rel="noreferrer" className="text-[8px] text-[#00FF66]/70 underline mt-1 inline-block">attached recording ↗</a>
              ) : (
                <img src={d.mediaUrl} alt="attached capture" className="mt-1 rounded border border-[#2D333B] max-h-24" />
              ))}
            </div>
          ))}
        </div>

        <div className="text-center text-[#00FF66]/25 text-[8px] pb-1.5 pt-1 tracking-wider border-t border-[#2D333B]">
          AGENT DRAFTS · YOU APPROVE · AUTO-POSTS TO DISCORD + BLUESKY + BUFFER (X/IG/LINKEDIN…) · FREE · INTEL ONLY
        </div>
      </div>
    </div>
  );
}
