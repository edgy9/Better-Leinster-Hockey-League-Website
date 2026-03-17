"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Scorer } from "@/lib/topscorers";

// ── Section config ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { label: "All",          key: null          },
  { label: "Men",          key: "lha-men"     },
  { label: "Women",        key: "lha-women"   },
  { label: "Indoor Men",   key: "indoor-men"  },
  { label: "Indoor Women", key: "indoor-wo"   },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function matchSection(section: string, key: SectionKey): boolean {
  // "All" = outdoor only; indoor must be explicitly selected
  if (key === null) return section === "lha-men" || section === "lha-women";
  if (key === "indoor-wo") return section.startsWith("indoor-wo");
  return section === key;
}

function sectionLabel(section: string): string {
  if (section === "lha-men")            return "Men";
  if (section === "lha-women")          return "Women";
  if (section === "indoor-men")         return "Indoor Men";
  if (section.startsWith("indoor-wo"))  return "Indoor Women";
  return section;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AggregatedScorer {
  player: string;
  club: string;
  competitions: string[];
  sections: string[];
  score: number;
}

type DisplayRow = Scorer | AggregatedScorer;

// ── Collapsible pill list ──────────────────────────────────────────────────────
function PillList({
  label,
  items,
  selected,
  onSelect,
  onClear,
}: {
  label: string;
  items: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Put selected item first so it's visible when collapsed
  const ordered = useMemo(() => {
    if (!selected) return items;
    return [selected, ...items.filter((i) => i !== selected)];
  }, [items, selected]);

  const collapse = () => setExpanded(false);

  const handleSelect = (item: string) => {
    onSelect(selected === item ? null : item);
    collapse();
  };

  return (
    <div className="step-block">
      <div className="filter-header">
        <span className="step-q">
          {label}
          {selected && (
            <button
              className="filter-clear"
              onClick={() => { onClear(); collapse(); }}
            >
              ✕ clear
            </button>
          )}
        </span>
        <button
          className="filter-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      <div className={`pill-row${expanded ? "" : " pill-row--collapsed"}`}>
        {ordered.map((item) => (
          <button
            key={item}
            className={`pill pill--sm${selected === item ? " active" : ""}`}
            onClick={() => handleSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ScorersClient({ data }: { data: Scorer[] }) {
  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("lha-theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);
  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("lha-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Filter state — cascade: section → club → competition
  const [section, setSection] = useState<SectionKey>(null);
  const [club,    setClub]    = useState<string | null>(null);
  const [comp,    setComp]    = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Derived filter options ─────────────────────────────────────────────────
  const clubs = useMemo(() => {
    const set = new Set<string>();
    for (const s of data) {
      if (matchSection(s.section, section)) set.add(s.club);
    }
    return [...set].sort();
  }, [data, section]);

  const competitions = useMemo(() => {
    const set = new Set<string>();
    for (const s of data) {
      if (!matchSection(s.section, section)) continue;
      if (club && s.club !== club) continue;
      set.add(s.competition);
    }
    return [...set].sort();
  }, [data, section, club]);

  // ── Reset cascade when parent filter changes ──────────────────────────────
  const pickSection = useCallback((key: SectionKey) => {
    setSection(key);
    setClub(null);
    setComp(null);
  }, []);

  const pickClub = useCallback((c: string | null) => {
    setClub(c);
    setComp(null);
  }, []);

  // ── Displayed rows ─────────────────────────────────────────────────────────
  const displayed = useMemo((): DisplayRow[] => {
    const q = search.trim().toLowerCase();
    const filtered = data.filter((s) => {
      if (!matchSection(s.section, section)) return false;
      if (club && s.club !== club) return false;
      if (comp && s.competition !== comp) return false;
      if (q && !s.player.toLowerCase().includes(q)) return false;
      return true;
    });

    if (comp) return filtered.sort((a, b) => b.score - a.score);

    const map = new Map<string, AggregatedScorer>();
    for (const s of filtered) {
      const key = `${s.player}|${s.club}`;
      const ex = map.get(key);
      if (ex) {
        ex.score += s.score;
        if (!ex.competitions.includes(s.competition)) ex.competitions.push(s.competition);
        if (!ex.sections.includes(s.section)) ex.sections.push(s.section);
      } else {
        map.set(key, {
          player: s.player,
          club: s.club,
          competitions: [s.competition],
          sections: [s.section],
          score: s.score,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.score - a.score);
  }, [data, section, club, comp, search]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <header>
        <div className="wordmark">Leinster Hockey</div>
        <h1 className="headline">
          Top<br />
          <span>Scorers.</span>
        </h1>
        <div className="header-row">
          <nav className="header-nav">
            <a href="/">← Competitions</a>
          </nav>
          <button className="theme-btn" onClick={toggleTheme}>☀ / ☾</button>
        </div>
      </header>

      <main>
        {/* Section */}
        <div className="step-block">
          <div className="step-q">Section</div>
          <div className="pill-row">
            {SECTIONS.map((f) => (
              <button
                key={f.label}
                className={`pill pill--sm${section === f.key ? " active" : ""}`}
                onClick={() => pickSection(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divider" />

        <PillList
          label="Club"
          items={clubs}
          selected={club}
          onSelect={pickClub}
          onClear={() => pickClub(null)}
        />

        <div className="divider" />

        <PillList
          label="Competition"
          items={competitions}
          selected={comp}
          onSelect={setComp}
          onClear={() => setComp(null)}
        />

        <div className="divider" />

        {/* Name search + results */}
        <div className="results-block">
          <div className="results-meta">
            <span className="results-label">
              {club ?? (SECTIONS.find((f) => f.key === section)?.label ?? "All")}
            </span>
            <span className="results-count">
              {displayed.length} player{displayed.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="search-box" style={{ marginBottom: "0.75rem" }}>
            <span className="si">⌕</span>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search by name…"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="search-clear"
                style={{ right: "0.75rem" }}
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
              >
                ✕
              </button>
            )}
          </div>

          {displayed.length === 0 && (
            <div className="empty-block">
              No scorers found.<br />
              <span style={{ display: "block", marginTop: "0.6rem", fontSize: "0.75rem", lineHeight: 1.6 }}>
                Only Leinster Hockey competitions are included. If your name isn&apos;t here, you haven&apos;t been recorded as a goal scorer on any match cards.
              </span>
            </div>
          )}

          {displayed.length > 0 && (
            <div className="comp-list">
              {displayed.map((s, i) => {
                const isAgg = "competitions" in s;
                return (
                  <div key={`${s.player}-${s.club}-${i}`} className="scorer-item">
                    <div className="scorer-rank">{i + 1}</div>
                    <div className="scorer-info">
                      <div className="scorer-name">{s.player}</div>
                      {isAgg ? (
                        <>
                          <div className="scorer-meta">{s.club}</div>
                          {s.competitions.map((c) => (
                            <div key={c} className="scorer-meta scorer-comp">{c}</div>
                          ))}
                          <div className="scorer-section">
                            {s.sections.map(sectionLabel).join(" · ")}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="scorer-meta">{s.club} · {s.competition}</div>
                          <div className="scorer-section">{sectionLabel(s.section)}</div>
                        </>
                      )}
                    </div>
                    <div className="scorer-goals">{s.score}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="site-footer">
          <a href="/about">about</a>
        </div>
      </main>
    </>
  );
}
