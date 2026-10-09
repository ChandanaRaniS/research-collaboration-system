import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/db";
import { isDuplicateKeyError, parsePositiveInteger } from "@/lib/validation";

export async function GET(request: Request) {
  const userId = parsePositiveInteger(new URL(request.url).searchParams.get("userId"));
  if (!userId) {
    return NextResponse.json({ message: "A valid userId is required" }, { status: 400 });
  }

  try {
    const [ratings] = await pool.execute<RowDataPacket[]>(
      "SELECT rating_id, paper_id, rating, review, created_at FROM Ratings WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return NextResponse.json({ ratings });
  } catch (error) {
    console.error("Get ratings error:", error);
    return NextResponse.json({ message: "Unable to load ratings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = parsePositiveInteger(body.user_id);
    const paperId = parsePositiveInteger(body.paper_id);
    const rating = Number(body.rating);
    const review = typeof body.review === "string" ? body.review.trim() : "";
    if (!userId || !paperId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ message: "Valid user_id, paper_id, and a rating from 1 to 5 are required" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO Ratings (user_id, paper_id, rating, review) VALUES (?, ?, ?, ?)",
      [userId, paperId, rating, review || null]
    );
    return NextResponse.json({ message: "Rating added", rating_id: result.insertId }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ message: "You have already rated this paper" }, { status: 409 });
    }
    console.error("Add rating error:", error);
    return NextResponse.json({ message: "Unable to add rating" }, { status: 500 });
  }
}