/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useState } from "react";
import { Globe, LoaderCircle, Lock, LogIn, LogOut, Star } from "lucide-react";
import { fetchMarketsMulti, MARKET_QUERIES } from "./api";
import { INITIAL_SPORTS_ENTITIES } from "./data";
import { SportsEntity } from "./types";
import CatalystBar from "./components/CatalystBar";
import DeliberationRoom from "./components/DeliberationRoom";
import DislocationBoard from "./components/DislocationBoard";
import Home from "./components/Home";
import IntelligencePanel from "./components/IntelligencePanel";
import MarketPulse from "./components/MarketPulse";
import MySpace from "./components/MySpace";
import PlayerDossier from "./components/PlayerDossier";
import TelemetryChart from "./components/TelemetryChart";
import TerminalSidebar, {
  DEFAULT_TERMINAL_FILTERS,
  filterMarkets,
  TerminalFilters,
} from "./components/TerminalSidebar";
import ThemeToggle from "./components/ThemeToggle";
import TickerBanner from "./components/TickerBanner";
import TickrrLogo from "./components/TickrrLogo";
import VenueStrip from "./components/VenueStrip";
import WaitlistModal from "./components/WaitlistModal";
import { authEnabled } from "./lib/firebase";
import { AuthUser, signInWithGoogle, signOutUser, subscribeAuth } from "./lib/auth";
import { isPremium, setPremium } from "./lib/premium";
import { LIMITS, setQuotaUser } from "./lib/quota";
import { getFavorites, onFavoritesChange, syncFavoritesFromCloud } from "./lib/watchlist";

export default function App() {
  const [entities, setEntities] = useState<SportsEntity[]>(INITIAL_SPORTS_ENTITIES);
  const [activeEntity, setActiveEntity] = useState<SportsEntity>(INITIAL_SPORTS_ENTITIES[0]);
  const [filters, setFilters] = useState<TerminalFilters>(DEFAULT_TERMINAL_FILTERS);
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavorites());
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState("");
  const [entered, setEntered] = useState(false);
  const [pro, setPro] = useState(isPremium());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [delibOpen, setDelibOpen] = useState(false);
  const [mySpaceOpen, setMySpaceOpen] = useState(false);
  const [waitlist, setWaitlist] = useState<{ open: boolean; reason?: string; intent?: string }>({ open: false });

  useEffect(() => subscribeAuth((nextUser) => {
    setUser(nextUser);
    setQuotaUser(nextUser?.uid ?? null);
    if (nextUser) void syncFavoritesFromCloud();
  }), []);
  useEffect(() => onFavoritesChange(() => setFavorites(getFavorites())), []);

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

  useEffect(() => {
    let live = true;
    fetchMarketsMulti(MARKET_QUERIES, 60)
      .then((markets) => {
        if (!live) return;
        if (markets.length) {
          setEntities(markets);
          setActiveEntity(markets[0]);
          setMarketsError("");
        } else {
          setMarketsError("LIVE FEED UNAVAILABLE · DISPLAYING DEFAULT MARKET BOARD");
        }
      })
      .catch(() => {
        if (live) setMarketsError("LIVE FEED UNAVAILABLE · DISPLAYING DEFAULT MARKET BOARD");
      })
      .finally(() => { if (live) setMarketsLoading(false); });
    return () => { live = false; };
  }, []);

  const filtered = useMemo(
    () => filterMarkets(entities, filters, favorites),
    [entities, filters, favorites],
  );

  useEffect(() => {
    if (filtered.length && !filtered.some((entity) => entity.id === activeEntity.id)) {
      setActiveEntity(filtered[0]);
    }
  }, [filtered, activeEntity.id]);

  function enterTerminal() {
    try { sessionStorage.setItem("tickrr_entered", "1"); } catch { /* storage can be disabled */ }
    setEntered(true);
  }

  const handleAuth = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      if (user) await signOutUser();
      else await signInWithGoogle();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const openWaitlist = (intent?: string, reason?: string) => setWaitlist({ open: true, intent, reason });
  const quotaReason = `You've used your ${LIMITS.gemini} free Gemini queries. Pro removes the limits — join the waitlist for first access at launch pricing.`;
  const gapCount = filtered.filter((entity) => {
    const gap = entity.divergence?.booksGapPP ?? entity.divergence?.gapPP;
    return gap != null && Math.abs(gap) >= 1;
  }).length;

  if (!entered) {
    return (
      <>
        <Home onEnter={enterTerminal} onGoPro={(plan) => openWaitlist(plan)} premium={pro} />
        <WaitlistModal open={waitlist.open} onClose={() => setWaitlist({ open: false })} user={user} reason={waitlist.reason} intent={waitlist.intent} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608] text-[#D1D4DC] font-sans scanline-overlay relative overflow-x-hidden" id="tickrr-main-terminal">
      <header className="sticky top-0 w-full bg-[#0B0E11]/95 backdrop-blur-md border-b border-[#2D333B] px-3 md:px-4 py-2 flex items-center justify-between gap-3 z-40 select-none">
        <button onClick={() => setEntered(false)} className="cursor-pointer shrink-0" title="Back to home"><TickrrLogo /></button>
        <div className="flex items-center justify-end gap-2 sm:gap-3 font-mono">
          <div className="hidden md:flex items-center gap-3 text-[9px] text-[#D1D4DC]/35">
            <span><i className="inline-block w-1.5 h-1.5 rounded-full bg-[#00FF66] led-blink mr-1" />{filtered.length} MARKETS</span>
            <span className="text-[#FF9900]">{gapCount} GAPS</span>
          </div>
          <ThemeToggle />
          {authEnabled && (
            <button
              onClick={handleAuth}
              disabled={authBusy}
              title={user ? `Signed in as ${user.name || user.email} · sign out` : "Sign in with Google"}
              className="cursor-pointer disabled:cursor-wait flex items-center gap-1.5 border border-[#2D333B] hover:border-[#00FF66]/50 text-[#D1D4DC]/75 hover:text-[#00FF66] text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded transition"
            >
              {authBusy ? <LoaderCircle className="w-3 h-3 animate-spin" /> : user ? <LogOut className="w-3 h-3" /> : <LogIn className="w-3 h-3" />}
              <span className="hidden sm:inline">{user ? "SIGN OUT" : "SIGN IN"}</span>
            </button>
          )}
          <button onClick={() => setMySpaceOpen(true)} className="terminal-header-action text-[#FF9900] border-[#FF9900]/35">
            <Star className="w-3 h-3" /><span className="hidden sm:inline">MY SPACE</span>
          </button>
          <button onClick={() => setDelibOpen(true)} className="terminal-header-action text-[#00FF66] border-[#00FF66]/35">
            <Lock className="w-3 h-3" /><span className="hidden md:inline">DELIBERATION</span><span className="text-[7px] bg-[#00FF66] text-black px-1 rounded">PRO</span>
          </button>
        </div>
      </header>

      {(authError || marketsError) && (
        <div className={`relative z-30 px-4 py-1.5 font-mono text-[9px] text-center border-b ${authError ? "bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]" : "bg-[#FF9900]/10 border-[#FF9900]/30 text-[#FF9900]"}`}>
          {authError || marketsError}
          {authError && <button onClick={() => setAuthError("")} className="ml-3 underline cursor-pointer">DISMISS</button>}
        </div>
      )}

      <TickerBanner entities={filtered.length ? filtered : entities.slice(0, 8)} onSelectEntity={setActiveEntity} />

      <main className="relative z-20 p-2.5 md:p-4 grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-3 md:gap-4 items-start">
        <TerminalSidebar
          entities={entities}
          filtered={filtered}
          activeEntity={activeEntity}
          filters={filters}
          onFiltersChange={setFilters}
          onSelect={setActiveEntity}
        />

        <div className="min-w-0 space-y-3 md:space-y-4">
          {marketsLoading && (
            <div className="h-1 bg-[#1C2128] overflow-hidden rounded"><div className="h-full w-1/3 bg-[#FF9900] terminal-loading-bar" /></div>
          )}
          <MarketPulse entities={filtered} />
          <CatalystBar scope={filters.league} />
          <DislocationBoard entities={filtered} onSelect={setActiveEntity} />
          {activeEntity.category === "athlete" && <PlayerDossier entity={activeEntity} entities={filtered} onSelect={setActiveEntity} />}
          <div className="h-[330px] sm:h-[370px]"><TelemetryChart entity={activeEntity} /></div>
          <VenueStrip entity={activeEntity} />
          <div className="min-h-[460px] lg:h-[520px]">
            <IntelligencePanel entity={activeEntity} premium={pro} user={user} onUpgrade={() => openWaitlist("pro", quotaReason)} />
          </div>
        </div>
      </main>

      <footer className="relative z-30 w-full bg-[#050608] border-t border-[#2D333B] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[9px] font-mono text-[#D1D4DC]/40">
        <div className="flex flex-wrap items-center justify-center gap-x-3">
          <span className="font-bold text-[#D1D4DC]/50"><Globe className="inline w-3 h-3 mr-1" />KRITXLABS LTD.</span>
          <span>Polymarket + Kalshi + sportsbook consensus</span>
          <span>Grounded by Gemini</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/faq" className="hover:text-[#00FF66]">FAQ</a>
          <a href="/compliance" className="hover:text-[#00FF66]">COMPLIANCE</a>
          <span className="text-[#FF9900] font-bold">INTEL ONLY · NEVER PICKS</span>
        </div>
      </footer>

      <DeliberationRoom entity={activeEntity} open={delibOpen} onClose={() => setDelibOpen(false)} premium={pro} user={user} onWaitlist={() => openWaitlist("pro", "Your free deliberation round is complete. Join the Pro waitlist for unlimited rounds.")} />
      <WaitlistModal open={waitlist.open} onClose={() => setWaitlist({ open: false })} user={user} reason={waitlist.reason} intent={waitlist.intent} />
      <MySpace open={mySpaceOpen} onClose={() => setMySpaceOpen(false)} entities={entities} onSelect={setActiveEntity} user={user} />
    </div>
  );
}
