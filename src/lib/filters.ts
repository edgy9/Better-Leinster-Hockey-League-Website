/**
 * Sub-filters for each section/who combination.
 *
 * Each SubFilter matches competitions whose name contains ANY of its `terms`
 * (case-insensitive substring match).
 *
 * Set `catchAll: true` on a filter to make it show everything not matched by
 * the other named filters in the group (used for "Other", "League", etc.).
 *
 * Key format:
 *   - "sectionKey:whoLabel"  →  e.g. "school:Boys"
 *   - "sectionKey"           →  for sections with no who step, e.g. "primary"
 *
 * To update filters: edit the relevant entry below. Each filter object needs:
 *   label   - button text shown in the UI
 *   terms   - array of search substrings (any match = included)
 *   catchAll - (optional) catches everything the named filters above don't
 */

export interface SubFilter {
  label: string;
  terms?: string[];
  catchAll?: boolean;
}

export const FILTERS: Record<string, SubFilter[]> = {
  // ── Schoolboys ────────────────────────────────────────────────────────────
  "school:Boys": [
    { label: "U13s",    terms: ["u13"] },
    { label: "Minors",  terms: ["min"] },
    { label: "Juniors", terms: ["jun"] },
    { label: "Seniors", terms: ["sen"] },
    { label: "Other",   catchAll: true },
  ],

  // ── Schoolgirls ───────────────────────────────────────────────────────────
  "school:Girls": [
    { label: "1st Years", terms: ["1st year", "1st yr"] },
    { label: "Minors",    terms: ["min"] },
    { label: "Juniors",   terms: ["jun"] },
    { label: "Inter",     terms: ["inter"] },
    { label: "Seniors",   terms: ["sen"] },
    { label: "Other",     catchAll: true },
  ],

  // ── Club Boys ─────────────────────────────────────────────────────────────
  "junior_club:Boys": [
    { label: "U16", terms: ["u16"] },
    { label: "U14", terms: ["u14"] },
    { label: "U12", terms: ["u12"] },
  ],

  // ── Club Girls ────────────────────────────────────────────────────────────
  "junior_club:Girls": [
    { label: "U18",       terms: ["u18"] },
    { label: "Inter",     terms: ["inter", "jacqui"] },
    { label: "Minors",    terms: ["minor"] },
    { label: "1st Year",  terms: ["1st yr", "1st year"] },
    { label: "6th Class", terms: ["6th class"] },
  ],

  // ── Primary School ────────────────────────────────────────────────────────
  "primary": [
    { label: "Boys",  terms: ["ljpsb"] },
    { label: "Girls", terms: ["ljpsg"] },
  ],

  // ── Senior Men ────────────────────────────────────────────────────────────
  "senior_club:Men": [
    { label: "Cup",    terms: ["cup"] },
    { label: "League", terms: ["division", "ey"] },
  ],

  // ── Senior Women ─────────────────────────────────────────────────────────
  "senior_club:Women": [
    { label: "Cup",    terms: ["cup", "shield"] },
    { label: "League", catchAll: true },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getFilters(section: string, whoLabel?: string): SubFilter[] {
  const key = whoLabel ? `${section}:${whoLabel}` : section;
  return FILTERS[key] ?? [];
}

export function applyFilter(
  comps: { id: string; name: string }[],
  filters: SubFilter[],
  activeLabel: string | null
): { id: string; name: string }[] {
  if (!activeLabel || filters.length === 0) return comps;

  const active = filters.find((f) => f.label === activeLabel);
  if (!active) return comps;

  if (active.catchAll) {
    // Everything not matched by any of the named (non-catchAll) filters
    const named = filters.filter((f) => !f.catchAll && f.terms);
    return comps.filter(
      (c) =>
        !named.some((f) =>
          f.terms!.some((t) => c.name.toLowerCase().includes(t.toLowerCase()))
        )
    );
  }

  return comps.filter((c) =>
    (active.terms ?? []).some((t) =>
      c.name.toLowerCase().includes(t.toLowerCase())
    )
  );
}
