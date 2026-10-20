import { NextResponse } from "next/server";
import { listAllPapers, readUserId, userExists } from "@/lib/papers";
import { chromaErrorMessage, rebuildIndex } from "@/lib/chroma";

// POST /api/papers/reindex  { user_id }
// Re-embeds every paper in MySQL into ChromaDB. Run it after importing seed data
// or if ChromaDB was offline while papers were being added.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!(await userExists(readUserId(body.user_id)))) {
      return NextResponse.json({ message: "Please log in to rebuild the index" }, { status: 401 });
    }
    const papers = await listAllPapers();
    const result = await rebuildIndex(papers);
    return NextResponse.json({
      message: `Semantic index rebuilt: ${result.indexed} paper(s) indexed, ${result.removed} stale entr${result.removed === 1 ? "y" : "ies"} removed`,
      ...result,
    });
  } catch (error) {
    console.error("Reindex error:", error);
    return NextResponse.json({ message: chromaErrorMessage(error) }, { status: 503 });
  }
}
