/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Command bar — mount a ticker by symbol, provision a custom listing on the fly, live UTC
 * clock. Scoping/filtering lives on the Command Rail (left), Bloomberg-style.
 */
import { useState, useEffect, FormEvent } from "react";
import { SportsEntity } from "../types";
import { Terminal, Search, Clock } from "lucide-react";

interface CommandBarProps {
  activeEntity: SportsEntity;
  allEntities: SportsEntity[];
  onSelectEntity: (entity: SportsEntity) => void;
  onCustomAdd: (name: string) => void;
}

export default function CommandBar({
  activeEntity,
  allEntities,
  onSelectEntity,
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

  const flash = (msg: string, ms = 3000) => {
    setCommandSuccessMsg(msg);
    setTimeout(() => setCommandSuccessMsg(null), ms);
  };

  const handleCommandSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanCommand = commandInput.trim().toUpperCase();
    if (!cleanCommand) return;

    if (cleanCommand === "HELP") {
      flash("HELP: Type a ticker to mount it, any name to list it. Scope & filters live on the Command Rail (left).", 5000);
      setCommandInput("");
      return;
    }

    // Check if matching ticker symbol directly in existing entities
    const found = allEntities.find(
      (ent) => ent.ticker.toUpperCase() === cleanCommand || ent.ticker.toUpperCase().replace(".US", "") === cleanCommand
    );

    if (found) {
      onSelectEntity(found);
      flash(`MOUNTED EQUITY: ${found.ticker}`);
    } else {
      // Create a brand new simulated entity on the fly!
      onCustomAdd(commandInput.trim());
      flash(`PROVISIONED NEW EQUITY: ${commandInput.trim().toUpperCase()}`);
    }

    setCommandInput("");
  };

  return (
    <div 
      className="w-full bg-[#0B0E11]/80 backdrop-blur-md border-b border-[#2D333B] p-2 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3 text-[#D1D4DC] z-30"
      id="terminal-command-bar"
    >
      {/* Search Input & Command Box */}
      <form onSubmit={handleCommandSubmit} className="flex-1 flex items-center gap-2 max-w-2xl min-w-0">
        <div className="bg-[#1C2128] px-2.5 py-1.5 border border-[#2D333B] rounded font-mono text-xs text-[#FF9900] font-bold flex items-center gap-1.5 select-none terminal-glow-orange shrink-0">
          <Terminal className="w-3.5 h-3.5 text-[#FF9900]" />
          <span>[ {activeEntity.ticker} ]</span>
        </div>

        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Mount a ticker or list a player/team (e.g. MESSI, HELP)…"
            className="w-full bg-[#1C2128] border border-[#2D333B] rounded px-3 py-1.5 pl-9 font-mono text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF9900] transition duration-150"
            id="terminal-command-input"
          />
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-2.5" />
        </div>

        <button
          type="submit"
          className="bg-[#FF9900] hover:bg-[#FF9900]/90 text-black font-mono text-xs font-black px-4 py-1.5 rounded cursor-pointer transition duration-150 shadow-md active:translate-y-[1px] shrink-0"
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

      {/* Real-time UTC clock */}
      <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-[#D1D4DC] bg-[#1C2128]/80 border border-[#2D333B] px-2.5 py-1 rounded select-none shrink-0">
        <Clock className="w-3.5 h-3.5 text-[#D1D4DC]/50" />
        <span className="tracking-widest">{utcTime}</span>
      </div>
    </div>
  );
}
