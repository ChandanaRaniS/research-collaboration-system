import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/db";
import { parsePositiveInteger } from "@/lib/validation";

export async function GET(request: Request) {
  const userId = parsePositiveInteger(new URL(request.url).searchParams.get("userId"));
  if (!userId) {
    return NextResponse.json({ message: "A valid userId is required" }, { status: 400 });
  }

  try {
    const [comments] = await pool.execute<RowDataPacket[]>(
      "SELECT comment_id, paper_id, comment_text, created_at FROM Comments WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json({ message: "Unable to load comments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = parsePositiveInteger(body.user_id);
    const paperId = parsePositiveInteger(body.paper_id);
    const commentText = typeof body.comment_text === "string" ? body.comment_text.trim() : "";
    if (!userId || !paperId || !commentText) {
      return NextResponse.json({ message: "Valid user_id, paper_id, and comment_text are required" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO Comments (user_id, paper_id, comment_text) VALUES (?, ?, ?)",
      [userId, paperId, commentText]
    );
    return NextResponse.json({ message: "Comment added", comment_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Add comment error:", error);
    return NextResponse.json({ message: "Unable to add comment" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const userId = parsePositiveInteger(body.user_id);
    const commentId = parsePositiveInteger(body.comment_id);
    if (!userId || !commentId) {
      return NextResponse.json({ message: "Valid user_id and comment_id are required" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM Comments WHERE comment_id = ? AND user_id = ?",
      [commentId, userId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Comment not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json({ message: "Unable to delete comment" }, { status: 500 });
  }
}