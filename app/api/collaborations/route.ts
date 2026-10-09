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
    const [collaborations] = await pool.execute<RowDataPacket[]>(
      `SELECT c.collaboration_id, c.requester_id, c.receiver_id,
              requester.full_name AS requester_name, receiver.full_name AS receiver_name,
              c.research_topic, c.message, c.status, c.created_at
       FROM Collaborations c
       INNER JOIN Users requester ON requester.user_id = c.requester_id
       INNER JOIN Users receiver ON receiver.user_id = c.receiver_id
       WHERE c.requester_id = ? OR c.receiver_id = ?
       ORDER BY c.created_at DESC`,
      [userId, userId]
    );
    return NextResponse.json({ collaborations });
  } catch (error) {
    console.error("Get collaborations error:", error);
    return NextResponse.json({ message: "Unable to load collaborations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requesterId = parsePositiveInteger(body.requester_id);
    const receiverId = parsePositiveInteger(body.receiver_id);
    const researchTopic = typeof body.research_topic === "string" ? body.research_topic.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!requesterId || !receiverId || !researchTopic) {
      return NextResponse.json({ message: "Requester, receiver, and research topic are required" }, { status: 400 });
    }
    if (requesterId === receiverId) {
      return NextResponse.json({ message: "You cannot send a request to yourself" }, { status: 400 });
    }
    if (researchTopic.length > 255) {
      return NextResponse.json({ message: "Research topic must be 255 characters or fewer" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO Collaborations (requester_id, receiver_id, research_topic, message) VALUES (?, ?, ?, ?)",
      [requesterId, receiverId, researchTopic, message || null]
    );
    return NextResponse.json({ message: "Collaboration request sent", collaboration_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Create collaboration error:", error);
    return NextResponse.json({ message: "Unable to create collaboration request" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const userId = parsePositiveInteger(body.user_id);
    const collaborationId = parsePositiveInteger(body.collaboration_id);
    const status = body.status;
    if (!userId || !collaborationId || !["accepted", "rejected"].includes(status)) {
      return NextResponse.json({ message: "Valid user, collaboration, and response status are required" }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE Collaborations SET status = ? WHERE collaboration_id = ? AND receiver_id = ? AND status = 'pending'",
      [status, collaborationId, userId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Pending request not found for this user" }, { status: 404 });
    }
    return NextResponse.json({ message: `Request ${status}` });
  } catch (error) {
    console.error("Respond to collaboration error:", error);
    return NextResponse.json({ message: "Unable to update collaboration request" }, { status: 500 });
  }
}