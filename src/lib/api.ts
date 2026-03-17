import { PROXY_BASE, SECTION_CONFIG } from "./config";
import type { GroupMatcher, WhoOption } from "./config";
import type { RawGroup, CompItem, ProxyResponse } from "@/app/api/proxy/route";

export type { CompItem };

const API_HEADERS = { "Content-Type": "application/x-www-form-urlencoded" };

// ── In-memory caches ────────────────────────────────────────────────────────
const groupsCache: Record<string, RawGroup[]> = {};
const compsCache: Record<string, CompItem[]> = {};

// In-flight deduplication: if the same request is already in-flight, share
// the promise instead of firing a second HTTP request.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inFlight: Record<string, Promise<any>> = {};

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!inFlight[key]) {
    inFlight[key] = fn().finally(() => delete inFlight[key]);
  }
  return inFlight[key] as Promise<T>;
}

// ── Matching ────────────────────────────────────────────────────────────────

function findGroupIds(groups: RawGroup[], matchers: GroupMatcher[]): string[] {
  const ids: string[] = [];
  for (const g of groups) {
    for (const m of matchers) {
      const idMatch = m.groupids.some(
        (id) => g.groupid.toLowerCase() === id.toLowerCase()
      );
      const nameMatch = m.nameTerms?.some((term) =>
        g.group_name.toLowerCase().includes(term.toLowerCase())
      );
      if (idMatch || nameMatch) {
        ids.push(String(g.group_id));
        break;
      }
    }
  }
  return ids;
}

// ── Core fetch helpers ──────────────────────────────────────────────────────

async function fetchAll(yearId: string): Promise<ProxyResponse> {
  // Already cached
  if (groupsCache[yearId]) {
    return { groups: groupsCache[yearId], competitions: [] };
  }

  const body = `action=competition_listing&userid=7971&group_id=&year=${yearId}`;
  return dedupe(`all:${yearId}`, async () => {
    console.group(`[API] fetchAll(year=${yearId})`);
    console.log("POST", PROXY_BASE, "→", body);
    const res = await fetch(PROXY_BASE, { method: "POST", headers: API_HEADERS, body });
    if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
    const data: ProxyResponse = await res.json();
    console.log(`status: ${res.status} | groups: ${data.groups.length} | competitions: ${data.competitions.length}`);
    console.groupEnd();
    groupsCache[yearId] = data.groups;
    return data;
  });
}

async function fetchCompsByGroupId(yearId: string, groupId: string): Promise<CompItem[]> {
  const key = `${yearId}:${groupId}`;
  if (compsCache[key]) {
    console.log(`[API] group=${groupId} → cache hit (${compsCache[key].length} comps)`);
    return compsCache[key];
  }

  const body = `action=competition_listing&userid=7971&group_id=${groupId}&year=${yearId}`;
  return dedupe(key, async () => {
    console.group(`[API] fetchCompsByGroupId(year=${yearId}, group=${groupId})`);
    console.log("POST", PROXY_BASE, "→", body);
    const res = await fetch(PROXY_BASE, { method: "POST", headers: API_HEADERS, body });
    if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
    const data: ProxyResponse = await res.json();
    console.log(`status: ${res.status} | competitions: ${data.competitions.length}`, data.competitions.map((c) => c.name));
    console.groupEnd();
    compsCache[key] = data.competitions;
    return data.competitions;
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Ensure groups are loaded (cached after first call). */
export async function fetchGroups(yearId: string): Promise<RawGroup[]> {
  if (groupsCache[yearId]) {
    console.log(`[API] fetchGroups(year=${yearId}) → cache hit (${groupsCache[yearId].length} groups)`);
    return groupsCache[yearId];
  }
  const data = await fetchAll(yearId);
  return data.groups;
}

/** Fetch all competitions for the season — used by global search. */
export async function fetchAllComps(
  yearId: string
): Promise<{ comps: CompItem[]; error: string | null }> {
  try {
    const body = `action=competition_listing&userid=7971&group_id=&year=${yearId}`;
    return dedupe(`allComps:${yearId}`, async () => {
      console.group(`[API] fetchAllComps(year=${yearId})`);
      console.log("POST", PROXY_BASE, "→", body);
      const res = await fetch(PROXY_BASE, { method: "POST", headers: API_HEADERS, body });
      if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
      const data: ProxyResponse = await res.json();
      console.log(`status: ${res.status} | groups: ${data.groups.length} | competitions: ${data.competitions.length}`);
      console.groupEnd();
      groupsCache[yearId] = data.groups;
      return { comps: data.competitions, error: null };
    });
  } catch (e) {
    return { comps: [], error: (e as Error).message };
  }
}

/**
 * Resolve competitions for a given UI selection.
 * Groups and per-group competitions are both cached, so subsequent calls
 * for the same params are instant.
 */
export async function resolveComps(
  section: string,
  who: WhoOption | null,
  yearId: string
): Promise<{ error: string | null; comps: CompItem[] }> {
  const cfg = SECTION_CONFIG[section];
  if (!cfg) return { error: `Unknown section: ${section}`, comps: [] };

  const matchers: GroupMatcher[] = who ? who.matchers : (cfg.matchers ?? []);
  if (matchers.length === 0) return { error: "No matchers configured", comps: [] };

  let groups: RawGroup[];
  try {
    groups = await fetchGroups(yearId);
  } catch (e) {
    return { error: (e as Error).message, comps: [] };
  }

  const groupIds = findGroupIds(groups, matchers);
  console.log(
    `[resolve] section=${section} who=${who?.label ?? "—"} → matched group_ids: [${groupIds.join(", ")}]`
  );

  if (groupIds.length === 0) {
    console.warn(
      "[resolve] No groups matched. Available:",
      groups.map((g) => `"${g.groupid}" / "${g.group_name}"`)
    );
    return { error: "No matching groups found for this selection", comps: [] };
  }

  let results: CompItem[][];
  try {
    results = await Promise.all(groupIds.map((gid) => fetchCompsByGroupId(yearId, gid)));
  } catch (e) {
    return { error: (e as Error).message, comps: [] };
  }

  const seen = new Set<string>();
  const comps = results.flat().filter((c) => (seen.has(c.id) ? false : seen.add(c.id)));
  return { error: null, comps };
}

// ── Preloaders (fire-and-forget) ────────────────────────────────────────────

/**
 * Fetch every individual group's competitions for a season.
 * Called on mount so data is cache-hot before the user picks anything.
 * Runs after groups are known — waits for fetchGroups if needed.
 */
export function preloadAllGroups(yearId: string): void {
  fetchGroups(yearId)
    .then((groups) => {
      console.log(`[preload] Kicking off ${groups.length} group fetches for year=${yearId}`);
      for (const g of groups) {
        fetchCompsByGroupId(yearId, String(g.group_id)).catch(() => {});
      }
    })
    .catch(() => {});
}

/**
 * Preload all who-options for a given section.
 * Called when the user picks a section so data is ready before they pick who.
 */
export function preloadSection(section: string, yearId: string): void {
  const cfg = SECTION_CONFIG[section];
  if (!cfg) return;
  if (cfg.who === null) {
    resolveComps(section, null, yearId).catch(() => {});
  } else {
    for (const w of cfg.who) {
      resolveComps(section, w, yearId).catch(() => {});
    }
  }
}
