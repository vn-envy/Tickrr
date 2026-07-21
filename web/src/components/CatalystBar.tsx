/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Catalyst bar — the "what to watch" behind the markets: upcoming market-moving events with
 * countdowns, scoped to the active category (Macro, Politics, a league, …). Bloomberg-style context.
 */
import { useEffect, useState } from "react";
import { fetchCalendar, CalendarEvent } from "../api";
import { CalendarClock } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (d: string) => { const [, m, day] = d.split("-").map(Number); return `${MONTHS[m - 1]} ${day}`; };
const daysTo = (d: string) => Math.max(0, Math.round((new Date(d + "T00:00:00Z").getTime() - Date.now()) / 864e5));

export default function CatalystBar({ scope = "all" }: { scope?: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  useEffect(() => {
    let on = true;
    fetchCalendar(scope).then((e) => { if (on) setEvents(e); });
    return () => { on = false; };
  }, [scope]);

  return (
    <div className="w-full bg-[#0B0E11]/60 border border-[#2D333B] rounded px-4 py-2 flex items-center gap-4 overflow-x-auto text-[10px] font-mono select-none z-20">
      <div className="flex items-center gap-1.5 text-[#FF9900] font-bold tracking-widest shrink-0">
        <CalendarClock className="w-3 h-3" /> CATALYSTS
      </div>
      <div className="flex items-center gap-5">
        {!events.length && <span className="text-[#D1D4DC]/35">NO SCHEDULED CATALYSTS · LIVE MARKET SIGNALS REMAIN ACTIVE</span>}
        {events.slice(0, 8).map((e, i) => {
          const d = daysTo(e.date);
          return (
            <div key={i} className="flex items-center gap-2 shrink-0" title={`${e.title} · ${e.category}`}>
              <span className="text-[#D1D4DC]/80">{e.title}</span>
              <span className="text-[#D1D4DC]/40">{fmt(e.date)}</span>
              <span className={`font-bold ${d <= 7 ? "text-[#FF3B30]" : d <= 30 ? "text-[#FF9900]" : "text-[#00FF66]"}`}>{d}d</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
