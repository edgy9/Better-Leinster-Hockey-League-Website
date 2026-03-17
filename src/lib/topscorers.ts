export interface Scorer {
  player: string;
  club: string;
  competition: string;
  section: string;
  score: number;
}

function parseHtml(html: string): Scorer[] {
  const rows: Scorer[] = [];
  const preRe = /<pre>([\s\S]*?)<\/pre>/gi;
  let m: RegExpExecArray | null;

  while ((m = preRe.exec(html)) !== null) {
    for (const line of m[1].split("\n")) {
      const t = line.trim();
      if (!t.startsWith("|")) continue;
      const cols = t.split("|").slice(1, -1).map((c) => c.trim());
      if (cols.length < 5) continue;
      if (cols[0] === "player" || cols[0].startsWith("---")) continue;
      const score = parseInt(cols[4], 10);
      if (isNaN(score)) continue;
      rows.push({
        player: cols[0],
        club: cols[1],
        competition: cols[2],
        section: cols[3],
        score,
      });
    }
  }
  return rows;
}

export function isAdultSection(section: string): boolean {
  return (
    section === "lha-men" ||
    section === "lha-women" ||
    section === "indoor-men" ||
    section.startsWith("indoor-wo")
  );
}

export async function fetchTopScorers(): Promise<Scorer[]> {
  const res = await fetch(
    "https://cards.leinsterhockey.ie/reportx/topscorers",
    {
      next: { revalidate: 300 },
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IE,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "Upgrade-Insecure-Requests": "1",
      },
    }
  );
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  return parseHtml(await res.text());
}
