import { NextResponse } from "next/server";
import { fetchTopScorers } from "@/lib/topscorers";

export type { Scorer } from "@/lib/topscorers";

export async function GET() {
  try {
    const rows = await fetchTopScorers();
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
