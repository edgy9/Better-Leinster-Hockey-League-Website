import { fetchTopScorers, isAdultSection } from "@/lib/topscorers";
import ScorersClient from "./ScorersClient";

export default async function TopScorersPage() {
  const all = await fetchTopScorers();
  const data = all.filter((s) => isAdultSection(s.section));
  return <ScorersClient data={data} />;
}
