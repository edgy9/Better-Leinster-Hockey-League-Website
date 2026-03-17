"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SEASONS, SECTION_CONFIG, RESULT_TITLES } from "@/lib/config";
import type { Season, WhoOption } from "@/lib/config";
import {
  fetchAllComps,
  resolveComps,
  preloadAllGroups,
  preloadSection,
} from "@/lib/api";
import type { CompItem } from "@/lib/api";
import { getFilters, applyFilter } from "@/lib/filters";

const CURRENT_SEASON: Season = SEASONS.find((s) => s.current)!;
// Prefetch LHA league pages when the visible list is at or below this size
const PREFETCH_THRESHOLD = 8;

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return escHtml(text);
  return (
    escHtml(text.slice(0, i)) +
    `<strong style="color:var(--accent)">${escHtml(text.slice(i, i + q.length))}</strong>` +
    escHtml(text.slice(i + q.length))
  );
}

function lhaUrl(id: string) {
  return `https://www.leinsterhockey.ie/league/${id}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ResultsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; comps: CompItem[] }
  | { status: "error"; message: string };

type GsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; items: CompItem[] }
  | { status: "error" };

// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("lha-theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("lha-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Selection state
  const [section, setSection] = useState<string | null>(null);
  const [who, setWho] = useState<WhoOption | null>(null);

  // Results
  const [results, setResults] = useState<ResultsState>({ status: "idle" });
  const [filterQ, setFilterQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Global search
  const [gsQuery, setGsQuery] = useState("");
  const [gsState, setGsState] = useState<GsState>({ status: "idle" });
  const gsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks which LHA hrefs have already had a <link rel="prefetch"> injected
  const prefetched = useRef(new Set<string>());

  // ── Aggressive preloading on mount ──────────────────────────────────────
  // 1. fetchAllComps: one call that caches all groups + full comp list
  // 2. preloadAllGroups: after groups land, fetch each group's filtered list
  useEffect(() => {
    fetchAllComps(CURRENT_SEASON.yearId).catch(() => {});
    preloadAllGroups(CURRENT_SEASON.yearId);
  }, []);

  // ── Preload section when user picks one ─────────────────────────────────
  useEffect(() => {
    if (section) preloadSection(section, CURRENT_SEASON.yearId);
  }, [section]);

  // ── Prefetch LHA league pages ────────────────────────────────────────────
  // Fires whenever the visible competition list changes.
  // Also fires for global search results (top 5).
  const prefetchLinks = useCallback((comps: CompItem[]) => {
    comps.forEach((c) => {
      const href = lhaUrl(c.id);
      if (!prefetched.current.has(href)) {
        prefetched.current.add(href);
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = href;
        document.head.appendChild(link);
        console.log(`[prefetch] ${href}`);
      }
    });
  }, []);

  // ── Global search ──────────────────────────────────────────────────────
  const doGlobalSearch = useCallback(async (q: string) => {
    setGsState({ status: "loading" });
    const { comps, error } = await fetchAllComps(CURRENT_SEASON.yearId);
    if (error && comps.length === 0) {
      setGsState({ status: "error" });
      return;
    }
    const matches = comps.filter((c) =>
      c.name.toLowerCase().includes(q.toLowerCase())
    );
    setGsState({ status: "done", items: matches });
    // Prefetch the first visible results immediately
    prefetchLinks(matches.slice(0, PREFETCH_THRESHOLD));
  }, [prefetchLinks]);

  useEffect(() => {
    if (gsQuery.trim().length < 2) {
      setGsState({ status: "idle" });
      return;
    }
    if (gsTimer.current) clearTimeout(gsTimer.current);
    gsTimer.current = setTimeout(() => doGlobalSearch(gsQuery.trim()), 350);
    return () => { if (gsTimer.current) clearTimeout(gsTimer.current); };
  }, [gsQuery, doGlobalSearch]);

  // ── Pick section ─────────────────────────────────────────────────────────
  const pickSection = (val: string) => {
    setSection(val);
    setWho(null);
    setResults({ status: "idle" });
    setFilterQ("");
    setActiveFilter(null);
    const cfg = SECTION_CONFIG[val];
    if (cfg.who === null) triggerResults(val, null);
  };

  // ── Pick who ─────────────────────────────────────────────────────────────
  const pickWho = (w: WhoOption) => {
    setWho(w);
    setResults({ status: "idle" });
    setFilterQ("");
    setActiveFilter(null);
    if (section) triggerResults(section, w);
  };

  // ── Trigger results ───────────────────────────────────────────────────────
  const triggerResults = async (sec: string, w: WhoOption | null) => {
    setResults({ status: "loading" });
    setFilterQ("");
    setActiveFilter(null);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);

    const { error, comps } = await resolveComps(sec, w, CURRENT_SEASON.yearId);
    if (error && comps.length === 0) {
      setResults({ status: "error", message: error });
    } else {
      setResults({ status: "done", comps });
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    setSection(null);
    setWho(null);
    setResults({ status: "idle" });
    setFilterQ("");
    setActiveFilter(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const showWhoStep = section !== null && SECTION_CONFIG[section]?.who !== null;
  const showResults = results.status !== "idle";
  const cfg = section ? SECTION_CONFIG[section] : null;

  // Compute title from current section/who (available during loading)
  const resultsTitle = (() => {
    if (!section || !cfg) return "Competitions";
    if (!who) return cfg.label;
    return RESULT_TITLES[section]?.[who.label] ?? `${who.label} ${cfg.label}`;
  })();

  // Sub-filters are config-derived — available immediately, no network needed
  const subFilters = getFilters(section ?? "", who?.label);

  // Breadcrumb parts
  const breadcrumbParts: string[] = [];
  if (who) breadcrumbParts.push(who.label);
  if (cfg) breadcrumbParts.push(cfg.label);
  breadcrumbParts.push(CURRENT_SEASON.label);

  // Apply category pill filter then text filter
  const displayComps = (() => {
    if (results.status !== "done") return [];
    const afterCategory = applyFilter(results.comps, subFilters, activeFilter);
    if (!filterQ.trim()) return afterCategory;
    return afterCategory.filter((c) =>
      c.name.toLowerCase().includes(filterQ.toLowerCase())
    );
  })();

  // Prefetch LHA pages when the visible list is small
  useEffect(() => {
    if (displayComps.length > 0 && displayComps.length <= PREFETCH_THRESHOLD) {
      prefetchLinks(displayComps);
    }
  }, [displayComps, prefetchLinks]);

  const gsVisible = gsQuery.trim().length >= 2 && gsState.status !== "idle";

  return (
    <>
      {/* Preconnect to LHA so link clicks are fast */}
      {/* eslint-disable-next-line @next/next/no-head-element */}

      {/* HEADER */}
      <header>
        <div className="wordmark">Leinster Hockey</div>
        <h1 className="headline">
          Find your<br />
          <span>competition.</span>
        </h1>
        <div className="header-row">
          <nav className="header-nav">
            <a href="https://www.leinsterhockey.ie/fixtures" target="_blank" rel="noreferrer">
              Fixtures ↗
            </a>
            <a href="https://www.leinsterhockey.ie/results" target="_blank" rel="noreferrer">
              Results ↗
            </a>
            <a href="/top-scorers">Top Scorers</a>
          </nav>
          <button className="theme-btn" onClick={toggleTheme}>☀ / ☾</button>
        </div>
      </header>

      {/* GLOBAL SEARCH */}
      <div className="search-section">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            type="search"
            placeholder="Search all competitions…"
            autoComplete="off"
            value={gsQuery}
            onChange={(e) => setGsQuery(e.target.value)}
          />
          {gsQuery && (
            <button
              className="search-clear"
              onClick={() => { setGsQuery(""); setGsState({ status: "idle" }); }}
            >
              ✕
            </button>
          )}
        </div>

        {gsVisible && (
          <div className="gs-results">
            <div className="gs-header">
              <span>
                {gsState.status === "loading"
                  ? "Searching…"
                  : gsState.status === "done"
                  ? gsState.items.length
                    ? `${gsState.items.length} result${gsState.items.length !== 1 ? "s" : ""} in ${CURRENT_SEASON.label}`
                    : `No results in ${CURRENT_SEASON.label}`
                  : "Unavailable"}
              </span>
              {gsState.status === "loading" && <div className="gs-spinner" />}
            </div>
            <div>
              {gsState.status === "done" && gsState.items.length > 0
                ? gsState.items.map((c) => (
                    <a
                      key={c.id}
                      className="gs-item"
                      href={lhaUrl(c.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span
                        className="gs-name"
                        dangerouslySetInnerHTML={{ __html: highlight(c.name, gsQuery.trim()) }}
                      />
                      <span className="gs-arrow">›</span>
                    </a>
                  ))
                : gsState.status === "done" && (
                    <div className="gs-empty">
                      No competitions matched.<br />
                      <a href="https://www.leinsterhockey.ie/competition/" target="_blank" rel="noreferrer">
                        Browse on LHA →
                      </a>
                    </div>
                  )}
              {gsState.status === "error" && (
                <div className="gs-empty">
                  <a href="https://www.leinsterhockey.ie/competition/" target="_blank" rel="noreferrer">
                    Browse on LHA →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MAIN */}
      <main>
        {/* STEP 1: Section */}
        <div className="step-block">
          <div className="step-q">What are you looking for?</div>
          <div className="pill-row">
            {Object.entries(SECTION_CONFIG).map(([val, cfg]) => (
              <button
                key={val}
                className={`pill${section === val ? " active" : ""}`}
                onClick={() => pickSection(val)}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* DIVIDER 1 */}
        {showWhoStep && <div className="divider" />}

        {/* STEP 2: Who */}
        {showWhoStep && cfg?.who && (
          <div className="step-block">
            <div className="step-q">Who?</div>
            <div className="pill-row">
              {cfg.who.map((w) => (
                <button
                  key={w.label}
                  className={`pill${who?.label === w.label ? " active" : ""}`}
                  onClick={() => pickWho(w)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DIVIDER 2 */}
        {showResults && <div className="divider" />}

        {/* RESULTS
            The skeleton (title, filter pills, text input) renders immediately
            when loading starts — the user can pre-select a filter pill while
            the network request completes in the background. */}
        {showResults && (
          <div className="results-block" ref={resultsRef}>
            {/* Breadcrumb */}
            <div className="breadcrumb">
              {breadcrumbParts.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="bc-sep">›</span>}
                  <span className={`bc-item${i === breadcrumbParts.length - 1 ? " current" : ""}`}>
                    {p}
                  </span>
                </span>
              ))}
            </div>

            {/* Title + count */}
            <div className="results-meta">
              <span className="results-label">{resultsTitle}</span>
              {results.status === "done" && (
                <span className="results-count">
                  {displayComps.length}{" "}
                  {displayComps.length === 1 ? "competition" : "competitions"}
                </span>
              )}
            </div>

            {/* Sub-filter pills — shown immediately, no network dependency */}
            {subFilters.length > 0 && (
              <div className="pill-row" style={{ marginBottom: "0.75rem" }}>
                {subFilters.map((f) => (
                  <button
                    key={f.label}
                    className={`pill pill--sm${activeFilter === f.label ? " active" : ""}`}
                    onClick={() =>
                      setActiveFilter(activeFilter === f.label ? null : f.label)
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* Text filter — shown immediately */}
            {results.status !== "error" && (
              <div className="search-box">
                <span className="si">⌕</span>
                <input
                  type="search"
                  placeholder="Filter…"
                  autoComplete="off"
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                />
              </div>
            )}

            {/* Loading spinner */}
            {results.status === "loading" && (
              <div className="loading-block">
                <div className="spinner" />
                Loading…
              </div>
            )}

            {/* Error */}
            {results.status === "error" && (
              <div className="error-block">
                Couldn&apos;t load competitions.<br />
                <small style={{ display: "block", marginTop: "0.4rem", opacity: 0.7 }}>
                  {results.message}
                </small>
                <br />
                <a href="https://www.leinsterhockey.ie/competition/" target="_blank" rel="noreferrer">
                  Browse on LHA →
                </a>
              </div>
            )}

            {/* Empty */}
            {results.status === "done" && displayComps.length === 0 && (
              <div className="empty-block">No competitions found.</div>
            )}

            {/* Competition list */}
            {results.status === "done" && displayComps.length > 0 && (
              <div className="comp-list">
                {displayComps.map((c) => (
                  <a
                    key={c.id}
                    className="comp-item"
                    href={lhaUrl(c.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="comp-name">{c.name}</span>
                    <span className="comp-arrow">›</span>
                  </a>
                ))}
              </div>
            )}

            <button className="reset-btn" onClick={reset}>
              ← Start over
            </button>
          </div>
        )}
        <div className="site-footer">
          <a href="/about">about</a>
        </div>
      </main>
    </>
  );
}
