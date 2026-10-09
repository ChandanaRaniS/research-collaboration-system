import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import pool from "@/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { full_name, email, password, role } = body;

    if (!full_name || !email || !password || !role) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Password must contain at least 6 characters" },
        { status: 400 }
      );
    }

    const [existingUsers] = await pool.execute(
      "SELECT user_id FROM Users WHERE email = ?",
      [email]
    );

    if ((existingUsers as RowDataPacket[]).length > 0) {
      return NextResponse.json(
        { message: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.execute(
      `INSERT INTO Users 
       (full_name, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [full_name, email, passwordHash, role]
    );

    return NextResponse.json(
      { message: "Registration successful" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}