/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { INITIAL_SPORTS_ENTITIES } from "./data";
import { fetchMarketsMulti, MARKET_QUERIES } from "./api";
import { SportsEntity } from "./types";
import TickrrLogo from "./components/TickrrLogo";
import TickerBanner from "./components/TickerBanner";
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
import TerminalRail, {
  DEFAULT_RAIL_FILTERS,
  applyRailFilters,
  type RailFilters,
} from "./components/TerminalRail";
import InsightDeck from "./components/InsightDeck";
import { isPremium, setPremium } from "./lib/premium";
import { setQuotaUser, LIMITS } from "./lib/quota";
import {
  signInWithGoogle,
  signOutUser,
  subscribeAuthState,
  type AuthUser,
} from "./lib/auth";
import { authEnabled } from "./lib/firebase";
import { syncFavoritesFromCloud, getFavorites, onFavoritesChange } from "./lib/watchlist";
import { Globe, Lock, Star, LogIn, LogOut, SlidersHorizontal, Loader2 } from "lucide-react";

export default function App() {
  const [entities, setEntities] = useState<SportsEntity[]>(INITIAL_SPORTS_ENTITIES);
  const [activeEntity, setActiveEntity] = useState<SportsEntity>(INITIAL_SPORTS_ENTITIES[0]);
  const [filters, setFilters] = useState<RailFilters>(DEFAULT_RAIL_FILTERS);
  const [railOpen, setRailOpen] = useState(false);
  const [delibOpen, setDelibOpen] = useState(false);
  const [waitlist, setWaitlist] = useState<{ open: boolean; reason?: string; intent?: string }>({ open: false });
  const [mySpaceOpen, setMySpaceOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [pro, setPro] = useState(isPremium());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [favTick, setFavTick] = useState(0); // bump when favorites change so filters recompute

  // Auth + watchlist sync. Single subscription drives user, busy, and error.
  useEffect(() => {
    let lastUid: string | null = null;
    const unsubAuth = subscribeAuthState((s) => {
      setUser(s.user);
      setAuthBusy(s.busy);
      setAuthError(s.error);
      setQuotaUser(s.user?.uid ?? null);
      const uid = s.user?.uid ?? null;
      if (uid && uid !== lastUid) {
        lastUid = uid;
        void syncFavoritesFromCloud().then(() => setFavTick((n) => n + 1));
      } else if (!uid) {
        lastUid = null;
      }
    });
    const unsubFav = onFavoritesChange(() => setFavTick((n) => n + 1));
    return () => { unsubAuth(); unsubFav(); };
  }, []);

  // Razorpay checkout return (?pro=1) + resume an already-entered session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pro") === "1") {
      setPremium(true);
      setPro(true);
      setEntered(true);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("enter") === "1") {
      enterTerminal();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (sessionStorage.getItem("tickrr_entered") === "1") {
      setEntered(true);
    }
  }, []);

  // Load live market intelligence (falls back to seed data — never a blank screen).
  useEffect(() => {
    fetchMarketsMulti(MARKET_QUERIES, 60)
      .then((markets) => {
        if (markets.length) {
          setEntities(markets);
          setActiveEntity((prev) => {
            const still = markets.find((m) => m.id === prev.id);
            return still ?? markets[0];
          });
        }
      })
      .catch((err) => console.warn("[Tickrr] live markets unavailable; using seed data:", err));
  }, []);

  const favorites = useMemo(() => getFavorites(), [favTick, user]);
  const filtered = useMemo(
    () => applyRailFilters(entities, filters, favorites),
    [entities, filters, favorites],
  );

  // Keep an active market in the filtered set so the insight pane never blanks out.
  useEffect(() => {
    if (!filtered.length) return;
    if (!filtered.some((e) => e.id === activeEntity.id)) {
      setActiveEntity(filtered[0]);
    }
  }, [filtered, activeEntity.id]);

  const enterTerminal = () => {
    try { sessionStorage.setItem("tickrr_entered", "1"); } catch { /* ignore */ }
    setEntered(true);
  };

  const openWaitlist = (intent?: string, reason?: string) => setWaitlist({ open: true, intent, reason });
  const handleGoPro = (plan: string) => openWaitlist(plan);
  const quotaReason = `You've used your ${LIMITS.gemini} free Gemini queries. Pro removes the limits — join the waitlist for first access at launch pricing.`;

  const handleSignIn = async () => {
    setAuthError(null);
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    setAuthError(null);
    const ok = await signOutUser();
    if (ok) {
      setUser(null);
      setQuotaUser(null);
      setFavTick((n) => n + 1);
    }
  };

  if (!entered) {
    return (
      <>
        <Home onEnter={enterTerminal} onGoPro={handleGoPro} premium={pro} />
        <WaitlistModal open={waitlist.open} onClose={() => setWaitlist({ open: false })} user={user} reason={waitlist.reason} intent={waitlist.intent} />
      </>
    );
  }

  // League-scoped catalysts + dislocation board track the rail's universe filter.
  const leagueScope = filters.league;
  const tickerEntities = filtered.length ? filtered : entities;
  const gapCount = entities.filter((e) => e.divergence && Math.abs(e.divergence.gapPP) >= 1).length;
  const active = filtered.find((e) => e.id === activeEntity.id) ?? filtered[0] ?? activeEntity;

  return (
    <div
      className="h-[100dvh] bg-[#050608] text-[#D1D4DC] flex flex-col font-sans scanline-overlay relative overflow-hidden"
      id="tickrr-main-terminal"
    >
      {/* Compact terminal header */}
      <header
        className="w-full shrink-0 bg-[#0B0E11]/90 backdrop-blur-md border-b border-[#2D333B] px-3 sm:px-4 py-2 flex items-center justify-between gap-2 z-30 select-none"
        id="tickrr-header"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className="lg:hidden cursor-pointer flex items-center gap-1.5 border border-[#2D333B] hover:border-[#FF9900]/50 text-[#D1D4DC]/70 hover:text-[#FF9900] text-[10px] font-bold px-2 py-1 rounded transition"
            aria-label="Open filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            FILTERS
          </button>
          <button type="button" onClick={() => setEntered(false)} className="cursor-pointer shrink-0" title="Back to home">
            <TickrrLogo />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] text-[#D1D4DC]/40 flex-wrap justify-end">
          <ThemeToggle />
          {authEnabled && (
            user ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={authBusy}
                title={`Signed in as ${user.name || user.email} · click to sign out`}
                className="cursor-pointer flex items-center gap-1.5 border border-[#2D333B] hover:border-[#FF3B30]/50 text-[#D1D4DC]/80 text-[10px] font-bold px-1.5 py-0.5 rounded transition disabled:opacity-50"
              >
                {authBusy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : user.photo ? (
                  <img src={user.photo} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <Star className="w-3 h-3 text-[#00FF66]" />
                )}
                <span className="hidden sm:inline">{(user.name || "ACCOUNT").split(" ")[0].toUpperCase()}</span>
                <LogOut className="w-3 h-3 text-[#D1D4DC]/40" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSignIn()}
                disabled={authBusy}
                className="cursor-pointer flex items-center gap-1.5 border border-[#2D333B] hover:border-[#00FF66]/50 text-[#D1D4DC]/70 hover:text-[#00FF66] text-[10px] font-bold px-2.5 py-1 rounded transition disabled:opacity-50"
              >
                {authBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                {authBusy ? "…" : "SIGN IN"}
              </button>
            )
          )}
          {authError && (
            <span className="hidden md:inline text-[#FF3B30] text-[9px] max-w-[160px] truncate" title={authError}>
              {authError}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMySpaceOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 bg-[#FF9900]/10 hover:bg-[#FF9900]/20 border border-[#FF9900]/40 text-[#FF9900] text-[10px] font-bold px-2 py-1 rounded transition"
          >
            <Star className="w-3 h-3" />
            <span className="hidden sm:inline">MY SPACE</span>
          </button>
          <button
            type="button"
            onClick={() => setDelibOpen(true)}
            className="cursor-pointer flex items-center gap-1.5 bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] text-[10px] font-bold px-2 py-1 rounded transition terminal-glow-green"
          >
            <Lock className="w-3 h-3" />
            <span className="hidden md:inline">DELIBERATION</span>
            <span className="text-[8px] bg-[#00FF66] text-black px-1 rounded font-black">PRO</span>
          </button>
          <div className="hidden md:flex flex-col text-right border-l border-[#2D333B] pl-3">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">Live</span>
            <span className="text-[#00FF66] font-black font-mono flex items-center gap-1 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] led-blink" /> {entities.length}
            </span>
          </div>
          <div className="hidden xl:flex flex-col text-right border-l border-[#2D333B] pl-3">
            <span className="text-[#D1D4DC]/30 font-bold uppercase">Gaps</span>
            <span className="text-[#FF9900] font-black font-mono">{gapCount}</span>
          </div>
        </div>
      </header>

      <TickerBanner entities={tickerEntities} onSelectEntity={setActiveEntity} />
      <CatalystBar scope={leagueScope} />

      {/* Bloomberg workspace: left rail + reactive insights */}
      <div className="flex-1 min-h-0 flex relative z-20">
        <TerminalRail
          entities={entities}
          activeEntity={active}
          onSelectEntity={setActiveEntity}
          filters={filters}
          onFiltersChange={setFilters}
          open={railOpen}
          onClose={() => setRailOpen(false)}
          filteredCount={filtered.length}
        />

        <main className="flex-1 min-w-0 overflow-y-auto p-3 md:p-4 flex flex-col gap-3">
          {/* Scope strip */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#D1D4DC]/45 select-none">
            <span className="text-[#FF9900] font-bold tracking-wider">SCOPE</span>
            <span className="bg-[#1C2128] border border-[#2D333B] px-2 py-0.5 rounded">
              {filters.league === "all" ? "ALL UNIVERSES" : filters.league.toUpperCase()}
            </span>
            {filters.sport && (
              <span className="bg-[#1C2128] border border-[#2D333B] px-2 py-0.5 rounded">{filters.sport.toUpperCase()}</span>
            )}
            {filters.quality !== "all" && (
              <span className="bg-[#1C2128] border border-[#2D333B] px-2 py-0.5 rounded">Q:{filters.quality.toUpperCase()}</span>
            )}
            {filters.minGap > 0 && (
              <span className="bg-[#1C2128] border border-[#2D333B] px-2 py-0.5 rounded">GAP≥{filters.minGap}</span>
            )}
            {filters.signalsOnly && (
              <span className="bg-[#1C2128] border border-[#2D333B] px-2 py-0.5 rounded">SIGNALS</span>
            )}
            <span className="ml-auto text-[#D1D4DC]/30">{filtered.length} markets · mounted {active.ticker}</span>
          </div>

          <DislocationBoard entities={filtered} onSelect={setActiveEntity} />

          <InsightDeck entities={filtered} active={active} onSelect={setActiveEntity} />

          {active.category === "athlete" && (
            <PlayerDossier entity={active} entities={entities} onSelect={setActiveEntity} />
          )}

          <div className="h-[300px] sm:h-[340px] md:h-[360px] shrink-0">
            <TelemetryChart entity={active} />
          </div>

          <VenueStrip entity={active} />

          <div className="h-[380px] sm:h-[420px] shrink-0">
            <IntelligencePanel entity={active} premium={pro} user={user} onUpgrade={() => openWaitlist("pro", quotaReason)} />
          </div>
        </main>
      </div>

      <footer
        className="w-full shrink-0 bg-[#050608] border-t border-[#2D333B] px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[9px] font-mono text-[#D1D4DC]/40 z-30 select-none"
        id="tickrr-footer"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center sm:justify-start">
          <div className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-[#D1D4DC]/30" />
            <span className="font-bold text-[#D1D4DC]/50">KRITXLABS LTD.</span>
          </div>
          <span className="text-[#D1D4DC]/20 hidden sm:inline">|</span>
          <span className="hidden md:inline">Data: Polymarket + Kalshi + Odds API (derived)</span>
          <span className="hidden sm:inline">Grounded by Gemini</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:text-right justify-center sm:justify-end">
          <a href="/faq" className="hover:text-[#00FF66] transition">FAQ</a>
          <a href="/compliance" className="hover:text-[#00FF66] transition">Compliance</a>
          <a href="mailto:support4u@tickrr.tech" className="hover:text-[#00FF66] transition">Support</a>
          <span className="text-[#FF9900] font-bold">INTEL ONLY · NEVER PICKS</span>
        </div>
      </footer>

      <DeliberationRoom
        entity={active}
        open={delibOpen}
        onClose={() => setDelibOpen(false)}
        premium={pro}
        user={user}
        onWaitlist={() => openWaitlist("pro", "Your free deliberation round is complete. Pro opens unlimited rounds — join the waitlist for first access.")}
      />
      {/* Growth console removed from prod UI — drafting/publish stays on API + Cloud Scheduler. */}
      <WaitlistModal open={waitlist.open} onClose={() => setWaitlist({ open: false })} user={user} reason={waitlist.reason} intent={waitlist.intent} />
      <MySpace open={mySpaceOpen} onClose={() => setMySpaceOpen(false)} entities={entities} onSelect={setActiveEntity} user={user} />
    </div>
  );
}
