import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/db";

// GET /api/papers/domains -> distinct domains with paper counts (for the filter dropdown)
export async function GET() {
  try {
    const [domains] = await pool.execute<RowDataPacket[]>(
      "SELECT domain, COUNT(*) AS paper_count FROM ResearchPapers GROUP BY domain ORDER BY domain"
    );
    return NextResponse.json({ domains });
  } catch (error) {
    console.error("List domains error:", error);
    return NextResponse.json({ message: "Unable to load domains" }, { status: 500 });
  }
}
