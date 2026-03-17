import { NextRequest, NextResponse } from "next/server";

const LHA_ENDPOINT =
  "https://www.leinsterhockey.ie/wp-admin/admin-ajax.php?action=competition_listing";

export interface RawGroup {
  group_id: string;
  groupid: string;
  group_name: string;
  user_name: string;
  user_id: string;
  seasonid: string;
}

export interface CompItem {
  id: string;
  name: string;
}

export interface ProxyResponse {
  groups: RawGroup[];
  competitions: CompItem[];
}

/**
 * Parse the competitions HTML string into structured [{id, name}] objects.
 * The LHA API returns unquoted href attributes, e.g.:
 *   <a href=https://www.leinsterhockey.ie/league/211321>Indoor Men</a>
 * We use regex server-side (no DOM needed).
 */
function parseCompsHtml(html: string): CompItem[] {
  if (!html) return [];
  const items: CompItem[] = [];
  const re = /href=https?:\/\/www\.leinsterhockey\.ie\/league\/(\d+)[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = m[2].trim();
    if (name) items.push({ id: m[1], name });
  }
  return items;
}

export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (
    !body.includes("action=competition_listing") ||
    !body.includes("userid=7971")
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  console.log(`[proxy] → POST ${LHA_ENDPOINT}`);
  console.log(`[proxy]   body: ${body}`);

  try {
    const lhaRes = await fetch(LHA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://www.leinsterhockey.ie",
        Referer: "https://www.leinsterhockey.ie/competition/",
        "User-Agent": "Mozilla/5.0 (compatible; LHA-Proxy/1.0)",
      },
      body,
    });

    console.log(`[proxy] ← ${lhaRes.status} ${lhaRes.statusText}`);

    if (!lhaRes.ok) {
      console.error(`[proxy] LHA error: ${lhaRes.status}`);
      return NextResponse.json(
        { error: `LHA returned ${lhaRes.status}` },
        { status: 502 }
      );
    }

    const raw = await lhaRes.json();
    const groups: RawGroup[] = Array.isArray(raw.groups) ? raw.groups : [];
    const competitions = parseCompsHtml(raw.competitions || "");

    console.log(
      `[proxy]   groups: ${groups.length} →`,
      groups.map((g) => `${g.group_name} (groupid="${g.groupid}", id=${g.group_id})`)
    );
    console.log(`[proxy]   competitions: ${competitions.length}`);

    const response: ProxyResponse = { groups, competitions };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    console.error(`[proxy] fetch failed:`, (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
