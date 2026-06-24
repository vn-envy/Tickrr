/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { SportsEntity } from "../types";
import { Terminal, Search, Clock, Cpu } from "lucide-react";

interface CommandBarProps {
  activeEntity: SportsEntity;
  allEntities: SportsEntity[];
  onSelectEntity: (entity: SportsEntity) => void;
  onFilterSport: (sport: string | null) => void;
  activeSportFilter: string | null;
  onCustomAdd: (name: string) => void;
}

export default function CommandBar({
  activeEntity,
  allEntities,
  onSelectEntity,
  onFilterSport,
  activeSportFilter,
  onCustomAdd
}: CommandBarProps) {
  const [commandInput, setCommandInput] = useState("");
  const [utcTime, setUtcTime] = useState("");
  const [commandSuccessMsg, setCommandSuccessMsg] = useState<string | null>(null);

  // Keep a running UTC time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace("GMT", "UTC"));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCommandSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanCommand = commandInput.trim().toUpperCase();
    if (!cleanCommand) return;

    // Check if command is a shortcut filter
    if (cleanCommand === "HELP") {
      setCommandSuccessMsg("HELP: Type any player/team name to search/add, or select from the directory.");
      setTimeout(() => setCommandSuccessMsg(null), 5000);
      setCommandInput("");
      return;
    }

    if (cleanCommand === "ALL.EQ") {
      onFilterSport(null);
      setCommandSuccessMsg("FILTER APPLIED: ALL EQUITIES");
      setTimeout(() => setCommandSuccessMsg(null), 3000);
      setCommandInput("");
      return;
    }

    // Check sports filters
    const sportsShortcuts: Record<string, string> = {
      "BASKETBALL.EQ": "Basketball",
      "FOOTBALL.EQ": "Football",
      "SOCCER.EQ": "Soccer",
      "F1.EQ": "F1",
      "TENNIS.EQ": "Tennis"
    };

    if (sportsShortcuts[cleanCommand]) {
      onFilterSport(sportsShortcuts[cleanCommand]);
      setCommandSuccessMsg(`FILTER APPLIED: ${sportsShortcuts[cleanCommand].toUpperCase()}`);
      setTimeout(() => setCommandSuccessMsg(null), 3000);
      setCommandInput("");
      return;
    }

    // Check if matching ticker symbol directly in existing entities
    const found = allEntities.find(
      (ent) => ent.ticker.toUpperCase() === cleanCommand || ent.ticker.toUpperCase().replace(".US", "") === cleanCommand
    );

    if (found) {
      onSelectEntity(found);
      setCommandSuccessMsg(`MOUNTED EQUITY: ${found.ticker}`);
      setTimeout(() => setCommandSuccessMsg(null), 3000);
    } else {
      // Create a brand new simulated entity on the fly!
      onCustomAdd(commandInput.trim());
      setCommandSuccessMsg(`PROVISIONED NEW EQUITY: ${commandInput.trim().toUpperCase()}`);
      setTimeout(() => setCommandSuccessMsg(null), 3000);
    }

    setCommandInput("");
  };

  return (
    <div 
      className="w-full bg-[#0B0E11]/80 backdrop-blur-md border-b border-[#2D333B] p-2 flex flex-col md:flex-row md:items-center justify-between gap-3 text-[#D1D4DC] z-30"
      id="terminal-command-bar"
    >
      {/* Search Input & Command Box */}
      <form onSubmit={handleCommandSubmit} className="flex-1 flex items-center gap-2 max-w-2xl">
        <div className="bg-[#1C2128] px-2.5 py-1.5 border border-[#2D333B] rounded font-mono text-xs text-[#FF9900] font-bold flex items-center gap-1.5 select-none terminal-glow-orange">
          <Terminal className="w-3.5 h-3.5 text-[#FF9900]" />
          <span>[ {activeEntity.ticker} ]</span>
        </div>

        <div className="relative flex-1">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type player, team, or filter command (e.g. Stephen Curry, HELP)..."
            className="w-full bg-[#1C2128] border border-[#2D333B] rounded px-3 py-1.5 pl-9 font-mono text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF9900] transition duration-150"
            id="terminal-command-input"
          />
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-2.5" />
        </div>

        <button
          type="submit"
          className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black font-mono text-xs font-black px-4 py-1.5 rounded cursor-pointer transition duration-150 shadow-md active:translate-y-[1px]"
        >
          EXECUTE
        </button>
      </form>

      {/* Center status message (if any) */}
      {commandSuccessMsg && (
        <div className="hidden lg:block bg-[#1C2128] border border-[#2D333B] text-[#00FF66] font-mono text-[11px] px-3 py-1 rounded max-w-sm truncate led-blink">
          {commandSuccessMsg}
        </div>
      )}

      {/* Right Column: Time and Quick Commands Info */}
      <div className="flex items-center gap-4 text-slate-500 self-end md:self-auto select-none">
        {/* Terminal quick-key links */}
        <div className="hidden xl:flex items-center gap-1.5 font-mono text-[10px]">
          <span className="text-[#D1D4DC]/40 font-bold">QUICK KEYS:</span>
          <button 
            type="button"
            onClick={() => { onFilterSport(null); setCommandInput(""); }}
            className={`cursor-pointer border px-1.5 py-0.5 rounded transition ${
              activeSportFilter === null 
                ? "border-[#FF9900]/50 bg-[#FF9900]/10 text-[#FF9900] font-bold" 
                : "border-[#2D333B] hover:bg-[#1C2128] text-[#D1D4DC]/60"
            }`}
          >
            ALL.EQ
          </button>
          <button 
            type="button"
            onClick={() => onFilterSport("Basketball")}
            className={`cursor-pointer border px-1.5 py-0.5 rounded transition ${
              activeSportFilter === "Basketball" 
                ? "border-[#FF9900]/50 bg-[#FF9900]/10 text-[#FF9900] font-bold" 
                : "border-[#2D333B] hover:bg-[#1C2128] text-[#D1D4DC]/60"
            }`}
          >
            BASKETBALL.EQ
          </button>
          <button 
            type="button"
            onClick={() => onFilterSport("Football")}
            className={`cursor-pointer border px-1.5 py-0.5 rounded transition ${
              activeSportFilter === "Football" 
                ? "border-[#FF9900]/50 bg-[#FF9900]/10 text-[#FF9900] font-bold" 
                : "border-[#2D333B] hover:bg-[#1C2128] text-[#D1D4DC]/60"
            }`}
          >
            FOOTBALL.EQ
          </button>
          <button 
            type="button"
            onClick={() => onFilterSport("Soccer")}
            className={`cursor-pointer border px-1.5 py-0.5 rounded transition ${
              activeSportFilter === "Soccer" 
                ? "border-[#FF9900]/50 bg-[#FF9900]/10 text-[#FF9900] font-bold" 
                : "border-[#2D333B] hover:bg-[#1C2128] text-[#D1D4DC]/60"
            }`}
          >
            SOCCER.EQ
          </button>
        </div>

        {/* Real-time UTC clock */}
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#D1D4DC] bg-[#1C2128]/80 border border-[#2D333B] px-2.5 py-1 rounded">
          <Clock className="w-3.5 h-3.5 text-[#D1D4DC]/50" />
          <span className="tracking-widest">{utcTime}</span>
        </div>
      </div>
    </div>
  );
}
