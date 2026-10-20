import { NextResponse } from "next/server";
import { getPapersByIds } from "@/lib/papers";
import { chromaErrorMessage, semanticSearch } from "@/lib/chroma";

// GET /api/papers/semantic?q=how do machines learn language&limit=10
// Ranks papers by meaning (ChromaDB vector search), then loads full records from MySQL.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ message: "A search query (q) is required" }, { status: 400 });
  if (query.length > 500) return NextResponse.json({ message: "Query must be 500 characters or fewer" }, { status: 400 });
  const limit = Math.min(30, Math.max(1, Number.parseInt(params.get("limit") ?? "10", 10) || 10));

  try {
    const hits = await semanticSearch(query, limit);
    const papers = await getPapersByIds(hits.map((h) => h.paper_id));
    const byId = new Map(papers.map((p) => [p.paper_id, p]));
    // Keep Chroma's ranking; skip anything that no longer exists in MySQL.
    const results = hits.flatMap((hit) => {
      const paper = byId.get(hit.paper_id);
      return paper ? [{ ...paper, score: hit.score }] : [];
    });
    return NextResponse.json({ papers: results, total: results.length });
  } catch (error) {
    console.error("Semantic search error:", error);
    return NextResponse.json({ message: chromaErrorMessage(error) }, { status: 503 });
  }
}
