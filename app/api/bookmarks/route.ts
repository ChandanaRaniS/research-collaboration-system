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
    const [bookmarks] = await pool.execute<RowDataPacket[]>(
      "SELECT bookmark_id, paper_id, bookmarked_at FROM Bookmarks WHERE user_id = ? ORDER BY bookmarked_at DESC",
      [userId]
    );
    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error("Get bookmarks error:", error);
    return NextResponse.json({ message: "Unable to load bookmarks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = parsePositiveInteger(body.user_id);
    const paperId = parsePositiveInteger(body.paper_id);
    if (!userId || !paperId) {
      return NextResponse.json({ message: "Valid user_id and paper_id are required" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO Bookmarks (user_id, paper_id) VALUES (?, ?)",
      [userId, paperId]
    );
    return NextResponse.json({ message: "Bookmark added", bookmark_id: result.insertId }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ message: "This paper is already bookmarked" }, { status: 409 });
    }
    console.error("Add bookmark error:", error);
    return NextResponse.json({ message: "Unable to add bookmark" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const userId = parsePositiveInteger(body.user_id);
    const bookmarkId = parsePositiveInteger(body.bookmark_id);
    if (!userId || !bookmarkId) {
      return NextResponse.json({ message: "Valid user_id and bookmark_id are required" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM Bookmarks WHERE bookmark_id = ? AND user_id = ?",
      [bookmarkId, userId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Bookmark not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Bookmark deleted" });
  } catch (error) {
    console.error("Delete bookmark error:", error);
    return NextResponse.json({ message: "Unable to delete bookmark" }, { status: 500 });
  }
}