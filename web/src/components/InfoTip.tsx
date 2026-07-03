/**
 * InfoTip — a tiny ⓘ that reveals a floating explanation on hover/focus.
 *
 * Rendered into a portal with fixed positioning so it never gets clipped by a scroll container
 * (tables, panels). Give it either a glossary key or an explicit title/tip. Every metric in the
 * terminal gets one so the user can immediately understand what it means and why it matters.
 */
import { useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { GLOSSARY } from "../lib/glossary";

interface Props {
  metric?: keyof typeof GLOSSARY;
  title?: string;
  tip?: string;
  children?: ReactNode; // optional label rendered before the icon
  className?: string;
}

export default function InfoTip({ metric, title, tip, children, className = "" }: Props) {
  const entry = metric ? GLOSSARY[metric] : undefined;
  const t = title ?? entry?.title;
  const body = tip ?? entry?.tip ?? "";
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
    setPos({ x, y: r.bottom + 6 });
  };
  const hide = () => setPos(null);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {children}
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => e.stopPropagation()}
        aria-label={t ? `What is ${t}?` : "More info"}
        className="cursor-help text-[#D1D4DC]/30 hover:text-[#FF9900] transition align-middle"
      >
        <Info className="w-3 h-3" />
      </button>
      {pos &&
        createPortal(
          <div
            style={{ position: "fixed", left: pos.x, top: pos.y, transform: "translateX(-50%)" }}
            className="z-[100] w-60 bg-[#0B0E11] border border-[#FF9900]/40 rounded-md p-2.5 shadow-2xl pointer-events-none animate-fade-in"
          >
            {t && <div className="text-[#FF9900] font-bold mb-1 font-mono text-[10px] tracking-wide">{t}</div>}
            <div className="text-[10px] font-sans text-[#D1D4DC]/80 leading-relaxed">{body}</div>
          </div>,
          document.body,
        )}
    </span>
  );
}
