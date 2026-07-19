/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { INITIAL_SPORTS_ENTITIES } from "./data";
import { fetchMarketsMulti, MARKET_QUERIES } from "./api";
import { SportsEntity } from "./types";
import TickrrLogo from "./components/TickrrLogo";
import CommandBar from "./components/CommandBar";
import TickerBanner from "./components/TickerBanner";
import MarketWatch from "./components/MarketWatch";
import TelemetryChart from "./components/TelemetryChart";
import VenueStrip from "./components/VenueStrip";
import IntelligencePanel from "./components/IntelligencePanel";
import DeliberationRoom from "./components/DeliberationRoom";
import DislocationBoard from "./components/DislocationBoard";
import PlayerDossier from "./components/PlayerDossier";
import Home from "./components/Home";
import GrowthConsole from "./components/GrowthConsole";
import ThemeToggle from "./components/ThemeToggle";
import UpgradeModal from "./components/UpgradeModal";
import MySpace from "./components/MySpace";
import CatalystBar from "./components/CatalystBar";
import { isPremium, setPremium, goPro } from "./lib/premium";
import { signInWithGoogle, signOutUser, subscribeAuth, AuthUser } from "./lib/auth";
import { authEnabled } from "./lib/firebase";
import { syncFavoritesFromCloud } from "./lib/watchlist";
import { Globe, Lock, Rocket, Star, LogIn } from "lucide-react";

export default function App() {
  const [entities, setEntities] = useState<SportsEntity[]>(INITIAL_SPORTS_ENTITIES);
  const [activeEntity, setActiveEntity] = useState<SportsEntity>(INITIAL_SPORTS_ENTITIES[0]);
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [delibOpen, setDelibOpen] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [mySpaceOpen, setMySpaceOpen] = useState(false);
  const [leagueScope, setLeagueScope] = useState<string>("all"); // global event scope
  const [entered, setEntered] = useState(false);
  const [pro, setPro] = useState(isPremium());
  const [user, setUser] = useState<AuthUser | null>(null);

  // Track sign-in; on sign-in, merge the cloud watchlist with local.
  useEffect(() => subscribeAuth((u) => {
    setUser(u);
    if (u) void syncFavoritesFromCloud();
  }), []);

  // Razorpay checkout return (?pro=1) + resume an already-entered session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pro") === "1") {
      setPremium(true);
      setPro(true);
      setEntered(true);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("enter") === "1") {
      // Arriving from a content page's "Launch Terminal" CTA — drop straight into the terminal.
      enterTerminal();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (sessionStorage.getItem("tickrr_entered") === "1") {
      setEntered(true);
    }
  }, []);

  // Load live World Cup market intelligence from the Tickrr backend (falls back to seed data).
  useEffect(() => {
    fetchMarketsMulti(MARKET_QUERIES, 60)
      .then((markets) => {
        if (markets.length) {
          setEntities(markets);
          setActiveEntity(markets[0]);
        }
      })
      .catch((err) => console.warn("[Tickrr] live markets unavailable; using seed data:", err));
  }, []);

  const enterTerminal = () => {
    try { sessionStorage.setItem("tickrr_entered", "1"); } catch { /* ignore */ }
    setEntered(true);
  };

  const handleGoPro = async (plan: string) => {
    const unlocked = await goPro(plan);  // redirects to Razorpay, or unlocks in demo mode
    if (unlocked) { setPro(true); enterTerminal(); }
  };

  // In-terminal upgrade (from the paywall modal): unlock without leaving the terminal.
  const handleUpgrade = async (plan: string) => {
    const unlocked = await goPro(plan);
    if (unlocked) { setPro(true); setPaywallOpen(false); }
  };

  // Dynamic athlete/team provisioner for on-the-fly terminal listing!
  const handleCustomAdd = (name: string) => {
    const words = name.trim().split(" ");
    let ticker = "";
    if (words.length >= 2) {
      ticker = `${words[0][0]}${words[1].substring(0, 5).toUpperCase()}.US`;
    } else {
      ticker = `${name.substring(0, 6).toUpperCase()}.US`;
    }

    // A manual listing has no live market yet — list it flat (no synthetic stats).
    const newEntity: SportsEntity = {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      ticker,
      sport: "Basketball",
      team: "Dynamic Division",
      value: 50,
      change: 0,
      efficiency: 0,
      stamina: 0,
      speed: 0,
      category: "athlete"
    };

    setEntities((prev) => [newEntity, ...prev]);
    setActiveEntity(newEntity);
  };

  if (!entered) {
    return <Home onEnter={enterTerminal} onGoPro={handleGoPro} premium={pro} />;
  }

  // Global league scope drives the ticker, the Dislocation Radar, and the screener chips.
  const scoped = leagueScope === "all" ? entities : entities.filter((e) => (e.league || "") === leagueScope);
  // Real, meaningful header stats (replace the old decorative index/feed-rate/security boxes).
  const gapCount = entities.filter((e) => e.divergence && Math.abs(e.divergence.gapPP) >= 1).length;

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
        {/* Left branding (click to return home) */}
        <button onClick={() => setEntered(false)} className="cursor-pointer" title="Back to home">
          <TickrrLogo />
        </button>

        {/* Right stats indicators */}
        <div className="flex items-center gap-5 font-mono text-[10px] text-[#D1D4DC]/40">
          <ThemeToggle />
          {authEnabled && (
            user ? (
              <button
                onClick={() => signOutUser()}
                title={`Signed in as ${user.name || user.email} · click to sign out`}
                className="cursor-pointer flex items-center gap-1.5 border border-[#2D333B] hover:border-[#00FF66]/50 text-[#D1D4DC]/80 text-[10px] font-bold px-1.5 py-0.5 rounded transition"
              >
                {user.photo
                  ? <img src={user.photo} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                  : <Star className="w-3 h-3 text-[#00FF66]" />}
                {(user.name || "ACCOUNT").split(" ")[0].toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => signInWithGoogle()}
                className="cursor-pointer flex items-center gap-1.5 border border-[#2D333B] hover:border-[#00FF66]/50 text-[#D1D4DC]/70 hover:text-[#00FF66] text-[10px] font-bold px-2.5 py-1 rounded transition"
              >
                <LogIn className="w-3 h-3" /> SIGN IN
              </button>
            )
          )}
          <button
            onClick={() => setMySpaceOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 bg-[#FF9900]/10 hover:bg-[#FF9900]/20 border border-[#FF9900]/40 text-[#FF9900] text-[10px] font-bold px-2.5 py-1 rounded transition"
          >
            <Star className="w-3 h-3" />
            MY SPACE
          </button>
          <button
            onClick={() => setGrowthOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 bg-[#FF9900]/10 hover:bg-[#FF9900]/20 border border-[#FF9900]/40 text-[#FF9900] text-[10px] font-bold px-2.5 py-1 rounded transition"
          >
            <Rocket className="w-3 h-3" />
            GROWTH
          </button>
          <button
            onClick={() => setDelibOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] text-[10px] font-bold px-2.5 py-1 rounded transition terminal-glow-green"
          >
            <Lock className="w-3 h-3" />
            DELIBERATION ROOM
            <span className="text-[8px] bg-[#00FF66] text-black px-1 rounded font-black">PRO</span>
          </button>
          <div className="hidden md:flex flex-col text-right border-l border-[#2D333B] pl-4">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">Markets live</span>
            <span className="text-[#00FF66] font-black font-mono flex items-center gap-1 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] led-blink" /> {entities.length}
            </span>
          </div>
          <div className="hidden lg:flex flex-col text-right border-l border-[#2D333B] pl-4">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">Cross-venue gaps</span>
            <span className="text-[#FF9900] font-black font-mono">{gapCount}</span>
          </div>
        </div>
      </header>

      {/* Real-time Scrolling Ticker Banner (scoped to the active league) */}
      <TickerBanner
        entities={scoped}
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

      {/* Upcoming catalysts — the "what to watch" behind the markets, scoped to the category */}
      <CatalystBar scope={leagueScope} />

      {/* Dislocation Radar (home board, scoped to the active league) */}
      <DislocationBoard entities={scoped} onSelect={(e) => setActiveEntity(e)} />

      {/* Main Terminal Workspace Layout */}
      <main className="flex-1 p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 z-20 items-start overflow-y-auto">
        {/* Left Sidebar Pane: Market Directory (Screener Grid) */}
        <div className="lg:col-span-4 flex flex-col h-[70vh] lg:h-[78vh]">
          <MarketWatch
            entities={entities}
            activeEntity={activeEntity}
            onSelectEntity={(entity) => setActiveEntity(entity)}
            sportFilter={sportFilter}
            leagueScope={leagueScope}
            onLeagueScope={setLeagueScope}
          />
        </div>

        {/* Right Dashboard Pane: Active Charts & AI Analytics Panel */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {activeEntity.category === "athlete" && (
            <PlayerDossier entity={activeEntity} entities={entities} onSelect={(e) => setActiveEntity(e)} />
          )}
          {/* Active SVG Telemetry Chart */}
          <div className="h-[300px]">
            <TelemetryChart entity={activeEntity} />
          </div>

          {/* Cross-venue value strip: Polymarket vs Kalshi vs sportsbook consensus */}
          <VenueStrip entity={activeEntity} />

          {/* AI-Powered Intel Intelligence & Custom Query Station */}
          <div className="h-[420px]">
            <IntelligencePanel entity={activeEntity} premium={pro} onUpgrade={() => setPaywallOpen(true)} />
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
            <span className="font-bold text-[#D1D4DC]/50">KRITXLABS LTD.</span>
          </div>
          <span className="text-[#D1D4DC]/20">|</span>
          <span>Data: Polymarket + Kalshi + sportsbook consensus via The Odds API (derived)</span>
          <span>Grounded by Gemini</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:text-right justify-end">
          <a href="/faq" className="hover:text-[#00FF66] transition">FAQ</a>
          <a href="/compliance" className="hover:text-[#00FF66] transition">Compliance</a>
          <a href="mailto:support4u@tickrr.tech" className="hover:text-[#00FF66] transition">Support</a>
          <span className="text-[#FF9900] font-bold">INTEL ONLY · NEVER PICKS</span>
        </div>
      </footer>

      <DeliberationRoom entity={activeEntity} open={delibOpen} onClose={() => setDelibOpen(false)} premium={pro} onUnlocked={() => setPro(true)} />
      <GrowthConsole open={growthOpen} onClose={() => setGrowthOpen(false)} />
      <UpgradeModal open={paywallOpen} onClose={() => setPaywallOpen(false)} onSelect={handleUpgrade} />
      <MySpace open={mySpaceOpen} onClose={() => setMySpaceOpen(false)} entities={entities} onSelect={(e) => setActiveEntity(e)} user={user} />
    </div>
  );
}
