/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
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
import ThemeToggle from "./components/ThemeToggle";
import WaitlistModal from "./components/WaitlistModal";
import MySpace from "./components/MySpace";
import CatalystBar from "./components/CatalystBar";
import FilterRail from "./components/FilterRail";
import MarketPulse from "./components/MarketPulse";
import { isPremium, setPremium } from "./lib/premium";
import { setQuotaUser, LIMITS } from "./lib/quota";
import { signInWithGoogle, signOutUser, subscribeAuth, completeRedirectSignIn, AuthUser } from "./lib/auth";
import { authEnabled } from "./lib/firebase";
import { syncFavoritesFromCloud, getFavorites, onFavoritesChange } from "./lib/watchlist";
import { TerminalFilters, DEFAULT_FILTERS, applyFilters, activeFilterCount } from "./lib/filters";
import { Globe, Lock, Star, LogIn, LogOut, SlidersHorizontal } from "lucide-react";

export default function App() {
  const [entities, setEntities] = useState<SportsEntity[]>(INITIAL_SPORTS_ENTITIES);
  const [activeEntity, setActiveEntity] = useState<SportsEntity>(INITIAL_SPORTS_ENTITIES[0]);
  const [delibOpen, setDelibOpen] = useState(false);
  // Waitlist phase: every upgrade intent routes here (no live billing yet).
  const [waitlist, setWaitlist] = useState<{ open: boolean; reason?: string; intent?: string }>({ open: false });
  const [mySpaceOpen, setMySpaceOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [pro, setPro] = useState(isPremium());
  const [user, setUser] = useState<AuthUser | null>(null);
  // Bloomberg-style command rail: one filter state drives every insight surface.
  const [filters, setFilters] = useState<TerminalFilters>({ ...DEFAULT_FILTERS });
  const [railOpen, setRailOpen] = useState(false); // mobile drawer
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavorites());

  // Track sign-in; on sign-in, merge the cloud watchlist with local + scope quotas to the uid.
  useEffect(() => {
    void completeRedirectSignIn(); // resolve a pending redirect sign-in (popup-blocked envs)
    return subscribeAuth((u) => {
      setUser(u);
      setQuotaUser(u?.uid ?? null);
      if (u) void syncFavoritesFromCloud();
    });
  }, []);

  // Watchlist feeds the rail's WATCHLIST lens.
  useEffect(() => onFavoritesChange(() => setFavorites(getFavorites())), []);

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

  // Load live market intelligence from the Tickrr backend (falls back to seed data).
  useEffect(() => {
    fetchMarketsMulti(MARKET_QUERIES, 60)
      .then((markets) => {
        if (markets.length) {
          setEntities(markets);
          // Default-in: mount the most-traded market so the stage is never blank or trivial.
          setActiveEntity([...markets].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0]);
        }
      })
      .catch((err) => console.warn("[Tickrr] live markets unavailable; using seed data:", err));
  }, []);

  // One filtered universe for the whole terminal — ticker, radar, screener, pulse, charts.
  const filtered = useMemo(
    () => applyFilters(entities, filters, favorites),
    [entities, filters, favorites],
  );

  // Default-in guarantee: the terminal never shows a blank stage. Whenever the rail
  // re-scopes the board and the active market falls out of view, mount the top result.
  useEffect(() => {
    if (filtered.length && !filtered.some((e) => e.id === activeEntity.id)) {
      setActiveEntity(filtered[0]);
    }
  }, [filtered, activeEntity.id]);

  const enterTerminal = () => {
    try { sessionStorage.setItem("tickrr_entered", "1"); } catch { /* ignore */ }
    setEntered(true);
  };

  // Waitlist phase — every upgrade intent captures interest instead of charging.
  const openWaitlist = (intent?: string, reason?: string) => setWaitlist({ open: true, intent, reason });
  const handleGoPro = (plan: string) => openWaitlist(plan);
  const quotaReason = `You've used your ${LIMITS.gemini} free Gemini queries. Pro removes the limits — join the waitlist for first access at launch pricing.`;

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
      league: filters.scope !== "all" ? filters.scope : undefined,
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
    return (
      <>
        <Home onEnter={enterTerminal} onGoPro={handleGoPro} premium={pro} />
        <WaitlistModal open={waitlist.open} onClose={() => setWaitlist({ open: false })} user={user} reason={waitlist.reason} intent={waitlist.intent} />
      </>
    );
  }

  // Real, meaningful header stats.
  const gapCount = filtered.filter((e) => e.divergence && Math.abs(e.divergence.gapPP) >= 1).length;
  const activeFilters = activeFilterCount(filters);
  const scopeLabel = filters.scope === "all" ? "All markets" : filters.scope;

  return (
    <div
      className="min-h-screen bg-[#050608] text-[#D1D4DC] flex flex-col font-sans scanline-overlay relative overflow-x-hidden"
      id="tickrr-main-terminal"
    >
      {/* Top Brand Header Banner */}
      <header 
        className="w-full bg-[#0B0E11]/80 backdrop-blur-md border-b border-[#2D333B] px-3 md:px-4 py-2.5 flex flex-wrap justify-between items-center gap-x-3 gap-y-2 z-30 select-none"
        id="tickrr-header"
      >
        {/* Left branding (click to return home) */}
        <button onClick={() => setEntered(false)} className="cursor-pointer shrink-0" title="Back to home">
          <TickrrLogo />
        </button>

        {/* Right stats indicators */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 font-mono text-[10px] text-[#D1D4DC]/40">
          <ThemeToggle />
          {authEnabled && (
            user ? (
              <button
                onClick={() => void signOutUser()}
                title={`Signed in as ${user.name || user.email} · click to sign out`}
                className="cursor-pointer flex items-center gap-1.5 border border-[#2D333B] hover:border-[#FF3B30]/50 text-[#D1D4DC]/80 hover:text-[#FF3B30] text-[10px] font-bold px-2 py-1 rounded transition"
              >
                {user.photo
                  ? <img src={user.photo} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                  : <Star className="w-3 h-3 text-[#00FF66]" />}
                <span className="hidden sm:inline">{(user.name || "ACCOUNT").split(" ")[0].toUpperCase()}</span>
                <LogOut className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={() => void signInWithGoogle()}
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
            <span className="hidden sm:inline">MY SPACE</span>
          </button>
          <button
            onClick={() => setDelibOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] text-[10px] font-bold px-2.5 py-1 rounded transition terminal-glow-green"
          >
            <Lock className="w-3 h-3" />
            <span className="hidden sm:inline">DELIBERATION ROOM</span>
            <span className="sm:hidden">DELIBERATE</span>
            <span className="text-[8px] bg-[#00FF66] text-black px-1 rounded font-black">PRO</span>
          </button>
          <div className="hidden md:flex flex-col text-right border-l border-[#2D333B] pl-4">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">In scope</span>
            <span className="text-[#00FF66] font-black font-mono flex items-center gap-1 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] led-blink" /> {filtered.length}
            </span>
          </div>
          <div className="hidden lg:flex flex-col text-right border-l border-[#2D333B] pl-4">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">Cross-venue gaps</span>
            <span className="text-[#FF9900] font-black font-mono">{gapCount}</span>
          </div>
        </div>
      </header>

      {/* Real-time Scrolling Ticker Banner (reflects the rail's scope) */}
      <TickerBanner
        entities={filtered.length ? filtered : entities}
        onSelectEntity={(entity) => setActiveEntity(entity)}
      />

      {/* Terminal Command bar (ticker mount, custom listing, clock) */}
      <CommandBar 
        activeEntity={activeEntity}
        allEntities={entities}
        onSelectEntity={(entity) => setActiveEntity(entity)}
        onCustomAdd={handleCustomAdd}
      />

      {/* Upcoming catalysts — the "what to watch" behind the markets, scoped to the rail */}
      <CatalystBar scope={filters.scope} />

      {/* Workspace: command rail (left) + insight surfaces (right) */}
      <div className="flex-1 flex min-h-0 z-20 relative">
        {/* Desktop command rail — sticks while the insight surfaces scroll */}
        <aside className="hidden lg:block w-60 xl:w-64 shrink-0 border-r border-[#2D333B] sticky top-0 self-start h-screen">
          <FilterRail
            entities={entities}
            filteredCount={filtered.length}
            filters={filters}
            onChange={setFilters}
            favoritesCount={favorites.size}
          />
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          {/* Mobile filter launcher — the rail's entry point on small screens */}
          <div className="lg:hidden px-3 pt-3 flex items-center gap-2">
            <button
              onClick={() => setRailOpen(true)}
              className="cursor-pointer flex items-center gap-1.5 bg-[#FF9900]/10 border border-[#FF9900]/40 text-[#FF9900] font-mono text-[10px] font-bold px-3 py-1.5 rounded transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              COMMAND RAIL
              {activeFilters > 0 && <span className="bg-[#FF9900] text-black rounded px-1 font-black">{activeFilters}</span>}
            </button>
            <span className="font-mono text-[9px] text-[#D1D4DC]/40">
              {scopeLabel.toUpperCase()} · <span className="text-[#00FF66] font-bold">{filtered.length}</span> MARKETS
            </span>
          </div>

          {/* Dislocation Radar (scoped to the rail) */}
          <DislocationBoard entities={filtered} onSelect={(e) => setActiveEntity(e)} />

          {/* Main Terminal Workspace Layout */}
          <div className="flex-1 p-3 md:p-4 grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Screener + board-level pulse */}
            <div className="xl:col-span-5 2xl:col-span-4 flex flex-col gap-4 min-w-0">
              <div className="h-[52vh] min-h-[320px] xl:h-[56vh]">
                <MarketWatch
                  entities={filtered}
                  activeEntity={activeEntity}
                  onSelectEntity={(entity) => setActiveEntity(entity)}
                  scopeLabel={scopeLabel}
                />
              </div>
              <MarketPulse entities={filtered} scopeLabel={scopeLabel} onSelect={(e) => setActiveEntity(e)} />
            </div>

            {/* Active market: charts, cross-venue value, AI intelligence */}
            <div className="xl:col-span-7 2xl:col-span-8 flex flex-col gap-4 min-w-0">
              {activeEntity.category === "athlete" && (
                <PlayerDossier entity={activeEntity} entities={entities} onSelect={(e) => setActiveEntity(e)} />
              )}
              {/* Active SVG Telemetry Chart — enough height that the stats board never clips */}
              <div className="h-[320px] md:h-[360px] shrink-0">
                <TelemetryChart entity={activeEntity} />
              </div>

              {/* Cross-venue value strip: Polymarket vs Kalshi vs sportsbook consensus */}
              <VenueStrip entity={activeEntity} />

              {/* AI-Powered Intel Intelligence & Custom Query Station (scrolls internally) */}
              <div className="h-[420px] shrink-0">
                <IntelligencePanel entity={activeEntity} premium={pro} user={user} onUpgrade={() => openWaitlist("pro", quotaReason)} />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Bloomberg-style Status Footer */}
      <footer 
        className="w-full bg-[#050608] border-t border-[#2D333B] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-[9px] font-mono text-[#D1D4DC]/40 z-30 select-none"
        id="tickrr-footer"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 justify-center sm:justify-start">
          <div className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-[#D1D4DC]/30" />
            <span className="font-bold text-[#D1D4DC]/50">KRITXLABS LTD.</span>
          </div>
          <span className="text-[#D1D4DC]/20 hidden sm:inline">|</span>
          <span>Data: Polymarket + Kalshi + sportsbook consensus via The Odds API (derived)</span>
          <span>Grounded by Gemini</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 justify-center sm:justify-end sm:text-right">
          <a href="/faq" className="hover:text-[#00FF66] transition">FAQ</a>
          <a href="/compliance" className="hover:text-[#00FF66] transition">Compliance</a>
          <a href="mailto:support4u@tickrr.tech" className="hover:text-[#00FF66] transition">Support</a>
          <span className="text-[#FF9900] font-bold">INTEL ONLY · NEVER PICKS</span>
        </div>
      </footer>

      {/* Mobile rail drawer — lives at the root so it stacks above the header/command bar */}
      {railOpen && (
        <div className="lg:hidden fixed inset-0 z-[95] flex">
          <div className="w-[82vw] max-w-xs h-full bg-[#050608] border-r border-[#2D333B] shadow-2xl animate-fade-in">
            <FilterRail
              entities={entities}
              filteredCount={filtered.length}
              filters={filters}
              onChange={setFilters}
              favoritesCount={favorites.size}
              onClose={() => setRailOpen(false)}
            />
          </div>
          <button
            className="flex-1 bg-black/70 backdrop-blur-sm cursor-pointer"
            onClick={() => setRailOpen(false)}
            aria-label="Close filters"
          />
        </div>
      )}

      <DeliberationRoom
        entity={activeEntity}
        open={delibOpen}
        onClose={() => setDelibOpen(false)}
        premium={pro}
        user={user}
        onWaitlist={() => openWaitlist("pro", "Your free deliberation round is complete. Pro opens unlimited rounds — join the waitlist for first access.")}
      />
      <WaitlistModal open={waitlist.open} onClose={() => setWaitlist({ open: false })} user={user} reason={waitlist.reason} intent={waitlist.intent} />
      <MySpace open={mySpaceOpen} onClose={() => setMySpaceOpen(false)} entities={entities} onSelect={(e) => setActiveEntity(e)} user={user} />
    </div>
  );
}
