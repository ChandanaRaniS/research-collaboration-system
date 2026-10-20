import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/db";
import { likePattern } from "@/lib/papers";

// GET /api/authors?q=ash -> authors matching a name, with paper counts (used for autocomplete)
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const limit = Math.min(50, Math.max(1, Number.parseInt(params.get("limit") ?? "20", 10) || 20));
  try {
    const [authors] = await pool.execute<RowDataPacket[]>(
      `SELECT a.author_id, a.full_name, a.affiliation, COUNT(pa.paper_id) AS paper_count
       FROM Authors a
       LEFT JOIN PaperAuthors pa ON pa.author_id = a.author_id
       WHERE a.full_name LIKE ?
       GROUP BY a.author_id, a.full_name, a.affiliation
       ORDER BY a.full_name
       LIMIT ${limit}`,
      [likePattern(query)]
    );
    return NextResponse.json({ authors });
  } catch (error) {
    console.error("List authors error:", error);
    return NextResponse.json({ message: "Unable to load authors" }, { status: 500 });
  }
}
