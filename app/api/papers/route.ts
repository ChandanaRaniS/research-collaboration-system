import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/db";
import { isDuplicateKeyError } from "@/lib/validation";
import {
  PAPER_COLUMNS,
  attachAuthors,
  createPaper,
  getPaperById,
  likePattern,
  parsePaperInput,
  readUserId,
  userExists,
} from "@/lib/papers";
import { indexPapers } from "@/lib/chroma";

const SORTS: Record<string, string> = {
  newest: "p.created_at DESC, p.paper_id DESC",
  year: "p.publication_year DESC, p.paper_id DESC",
  title: "p.title ASC",
};

// GET /api/papers?title=&author=&domain=&sort=newest|year|title&page=1&limit=10
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim() ?? "";
  const author = params.get("author")?.trim() ?? "";
  const domain = params.get("domain")?.trim() ?? "";
  const orderBy = SORTS[params.get("sort") ?? "newest"] ?? SORTS.newest;

  const limit = Math.min(50, Math.max(1, Number.parseInt(params.get("limit") ?? "10", 10) || 10));
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: string[] = [];
  if (title) {
    conditions.push("p.title LIKE ?");
    values.push(likePattern(title));
  }
  if (domain) {
    conditions.push("p.domain = ?");
    values.push(domain);
  }
  if (author) {
    conditions.push(
      `EXISTS (SELECT 1 FROM PaperAuthors pa INNER JOIN Authors a ON a.author_id = pa.author_id
               WHERE pa.paper_id = p.paper_id AND a.full_name LIKE ?)`
    );
    values.push(likePattern(author));
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ResearchPapers p ${where}`,
      values
    );
    // limit/offset are validated integers, so they are safe to inline.
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${PAPER_COLUMNS} FROM ResearchPapers p ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
      values
    );
    const total = Number(countRows[0].total);
    return NextResponse.json({
      papers: await attachAuthors(rows),
      total,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("List papers error:", error);
    return NextResponse.json({ message: "Unable to load papers" }, { status: 500 });
  }
}

// POST /api/papers  { user_id, title, abstract, domain, publication_year, keywords, doi, pdf_url, authors: [{full_name, affiliation}] }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = readUserId(body.user_id);
    if (!(await userExists(userId))) {
      return NextResponse.json({ message: "Please log in to add a paper" }, { status: 401 });
    }

    const { data, error } = parsePaperInput(body);
    if (!data) return NextResponse.json({ message: error }, { status: 400 });

    const paperId = await createPaper(data, userId!);

    // MySQL is the source of truth; a Chroma outage must not fail the request.
    let indexed = true;
    try {
      const paper = await getPaperById(paperId);
      if (paper) await indexPapers([paper]);
    } catch (indexError) {
      indexed = false;
      console.error("Chroma indexing failed for new paper:", indexError);
    }

    return NextResponse.json({ message: "Paper added", paper_id: paperId, indexed }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ message: "A paper with this DOI already exists" }, { status: 409 });
    }
    console.error("Create paper error:", error);
    return NextResponse.json({ message: "Unable to add paper" }, { status: 500 });
  }
}
