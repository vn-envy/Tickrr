/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { INITIAL_SPORTS_ENTITIES } from "./data";
import { fetchMarkets } from "./api";
import { SportsEntity } from "./types";
import TickrrLogo from "./components/TickrrLogo";
import CommandBar from "./components/CommandBar";
import TickerBanner from "./components/TickerBanner";
import MarketWatch from "./components/MarketWatch";
import TelemetryChart from "./components/TelemetryChart";
import IntelligencePanel from "./components/IntelligencePanel";
import DeliberationRoom from "./components/DeliberationRoom";
import DislocationBoard from "./components/DislocationBoard";
import PlayerDossier from "./components/PlayerDossier";
import { Globe, RefreshCw, Layers, Lock } from "lucide-react";

export default function App() {
  const [entities, setEntities] = useState<SportsEntity[]>(INITIAL_SPORTS_ENTITIES);
  const [activeEntity, setActiveEntity] = useState<SportsEntity>(INITIAL_SPORTS_ENTITIES[0]);
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [delibOpen, setDelibOpen] = useState(false);

  // Load live World Cup market intelligence from the Tickrr backend (falls back to seed data).
  useEffect(() => {
    fetchMarkets("World Cup", 100)
      .then((markets) => {
        if (markets.length) {
          setEntities(markets);
          setActiveEntity(markets[0]);
        }
      })
      .catch((err) => console.warn("[Tickrr] live markets unavailable; using seed data:", err));
  }, []);

  // Dynamic athlete/team provisioner for on-the-fly terminal listing!
  const handleCustomAdd = (name: string) => {
    const words = name.trim().split(" ");
    let ticker = "";
    if (words.length >= 2) {
      ticker = `${words[0][0]}${words[1].substring(0, 5).toUpperCase()}.US`;
    } else {
      ticker = `${name.substring(0, 6).toUpperCase()}.US`;
    }

    const value = Number((Math.random() * 15 + 81).toFixed(1));
    const change = Number((Math.random() * 4 - 2).toFixed(2));
    const efficiency = Number((Math.random() * 15 + 20).toFixed(1));
    const stamina = Math.floor(Math.random() * 20) + 75;
    const speed = Math.floor(Math.random() * 20) + 75;

    // Generate historic trajectory data points
    const staminaHistory = Array.from({ length: 10 }, () => Math.floor(Math.random() * 15) + 75);
    const efficiencyHistory = Array.from({ length: 10 }, () => Number((Math.random() * 10 + 20).toFixed(1)));
    const speedHistory = Array.from({ length: 10 }, () => Math.floor(Math.random() * 15) + 75);
    const playmakingHistory = Array.from({ length: 10 }, () => Math.floor(Math.random() * 20) + 75);
    const defenseHistory = Array.from({ length: 10 }, () => Math.floor(Math.random() * 20) + 75);

    const newEntity: SportsEntity = {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      ticker,
      sport: "Basketball",
      team: "Dynamic Division",
      value,
      change,
      efficiency,
      stamina,
      speed,
      staminaHistory,
      efficiencyHistory,
      speedHistory,
      playmakingHistory,
      defenseHistory,
      category: "athlete"
    };

    setEntities((prev) => [newEntity, ...prev]);
    setActiveEntity(newEntity);
  };

  return (
    <div 
      className="min-h-screen bg-[#050608] text-[#D1D4DC] flex flex-col font-sans scanline-overlay relative overflow-x-hidden"
      id="tickrr-main-terminal"
    >
      {/* Top Brand Header Banner */}
      <header 
        className="w-full bg-[#0B0E11]/80 backdrop-blur-md border-b border-[#2D333B] px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 z-30 select-none"
        id="tickrr-header"
      >
        {/* Left branding */}
        <TickrrLogo />

        {/* Right stats indicators */}
        <div className="flex items-center gap-5 font-mono text-[10px] text-[#D1D4DC]/40">
          <button
            onClick={() => setDelibOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] text-[10px] font-bold px-2.5 py-1 rounded transition terminal-glow-green"
          >
            <Lock className="w-3 h-3" />
            DELIBERATION ROOM
            <span className="text-[8px] bg-[#00FF66] text-black px-1 rounded font-black">PRO</span>
          </button>
          <div className="hidden md:flex flex-col text-right">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">WORLD CUP · LIVE</span>
            <span className="text-[#00FF66] font-black font-mono">14,924.81 ▲ +1.14%</span>
          </div>
          <div className="hidden lg:flex flex-col text-right border-l border-[#2D333B] pl-4">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">CORE FEED METRIC RATE</span>
            <span className="text-[#00FF66] font-mono font-bold flex items-center gap-1 justify-end">
              <RefreshCw className="w-2.5 h-2.5 text-[#00FF66] animate-spin" />
              60 Hz
            </span>
          </div>
          <div className="flex flex-col text-right border-l border-[#2D333B] pl-4">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">SECURITY LEVEL</span>
            <span className="text-[#FF9900] font-mono font-bold flex items-center gap-1">
              <Layers className="w-2.5 h-2.5 text-[#FF9900]" />
              SECURE
            </span>
          </div>
        </div>
      </header>

      {/* Real-time Scrolling Ticker Banner */}
      <TickerBanner 
        entities={entities} 
        onSelectEntity={(entity) => setActiveEntity(entity)} 
      />

      {/* Terminal Command bar (Search, Filter, Clock) */}
      <CommandBar 
        activeEntity={activeEntity}
        allEntities={entities}
        onSelectEntity={(entity) => setActiveEntity(entity)}
        onFilterSport={(sport) => setSportFilter(sport)}
        activeSportFilter={sportFilter}
        onCustomAdd={handleCustomAdd}
      />

      {/* Dislocation Radar (home board) */}
      <DislocationBoard entities={entities} onSelect={(e) => setActiveEntity(e)} />

      {/* Main Terminal Workspace Layout */}
      <main className="flex-1 p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 z-20 overflow-hidden">
        {/* Left Sidebar Pane: Market Directory (Screener Grid) */}
        <div className="lg:col-span-4 h-full flex flex-col min-h-[300px]">
          <MarketWatch 
            entities={entities}
            activeEntity={activeEntity}
            onSelectEntity={(entity) => setActiveEntity(entity)}
            sportFilter={sportFilter}
          />
        </div>

        {/* Right Dashboard Pane: Active Charts & AI Analytics Panel */}
        <div className="lg:col-span-8 flex flex-col gap-4 h-full">
          {activeEntity.category === "athlete" && (
            <PlayerDossier entity={activeEntity} entities={entities} onSelect={(e) => setActiveEntity(e)} />
          )}
          {/* Active SVG Telemetry Chart */}
          <div className="flex-1 min-h-[260px]">
            <TelemetryChart entity={activeEntity} />
          </div>

          {/* AI-Powered Intel Intelligence & Custom Query Station */}
          <div className="flex-1 min-h-[350px] lg:min-h-[420px]">
            <IntelligencePanel entity={activeEntity} />
          </div>
        </div>
      </main>

      {/* Bloomberg-style Status Footer */}
      <footer 
        className="w-full bg-[#050608] border-t border-[#2D333B] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-[9px] font-mono text-[#D1D4DC]/40 z-30 select-none"
        id="tickrr-footer"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-[#D1D4DC]/30" />
            <span className="font-bold text-[#D1D4DC]/50">TICKER LABS LTD.</span>
          </div>
          <span className="text-[#D1D4DC]/20">|</span>
          <span>CONN: ESTABLISHED</span>
          <span>NODE: US-EAST-1</span>
          <span>LATENCY: 12ms</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:text-right justify-end">
          <span>SYSTEM HEALTH: 99.98%</span>
          <span className="text-[#00FF66] font-bold">DATA FEED SECURE</span>
          <span className="text-[#D1D4DC]/20 italic">v2.4.1</span>
        </div>
      </footer>

      <DeliberationRoom entity={activeEntity} open={delibOpen} onClose={() => setDelibOpen(false)} />
    </div>
  );
}
