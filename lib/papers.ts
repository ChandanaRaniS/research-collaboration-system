import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import pool from "@/db";
import { parsePositiveInteger } from "@/lib/validation";

// ---------- Types ----------

export type PaperAuthor = {
  author_id: number;
  full_name: string;
  affiliation: string | null;
};

export type Paper = {
  paper_id: number;
  title: string;
  abstract: string | null;
  domain: string;
  publication_year: number | null;
  keywords: string | null;
  doi: string | null;
  pdf_url: string | null;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string;
  authors: PaperAuthor[];
};

export type AuthorInput = { full_name: string; affiliation: string | null };

export type PaperInput = {
  title: string;
  abstract: string | null;
  domain: string;
  publication_year: number | null;
  keywords: string | null;
  doi: string | null;
  pdf_url: string | null;
  authors: AuthorInput[];
};

export const PAPER_COLUMNS =
  "p.paper_id, p.title, p.abstract, p.domain, p.publication_year, p.keywords, p.doi, p.pdf_url, p.uploaded_by, p.created_at, p.updated_at";

const MAX_AUTHORS = 20;

// ---------- Input validation ----------

function optionalString(value: unknown, max: number, label: string): { value: string | null; error?: string } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { value: null, error: `${label} must be text` };
  const trimmed = value.trim();
  if (trimmed.length > max) return { value: null, error: `${label} must be ${max} characters or fewer` };
  return { value: trimmed || null };
}

/** Validates and normalises the JSON body used to create or update a paper. */
export function parsePaperInput(body: unknown): { data?: PaperInput; error?: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid request body" };
  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "Title is required" };
  if (title.length > 500) return { error: "Title must be 500 characters or fewer" };

  const domain = typeof b.domain === "string" ? b.domain.trim() : "";
  if (!domain) return { error: "Domain is required" };
  if (domain.length > 100) return { error: "Domain must be 100 characters or fewer" };

  const abstract = optionalString(b.abstract, 20000, "Abstract");
  if (abstract.error) return { error: abstract.error };

  const keywords = optionalString(b.keywords, 500, "Keywords");
  if (keywords.error) return { error: keywords.error };

  const pdf = optionalString(b.pdf_url, 500, "PDF link");
  if (pdf.error) return { error: pdf.error };
  if (pdf.value) {
    try {
      const url = new URL(pdf.value);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch {
      return { error: "PDF link must be a valid http(s) URL" };
    }
  }

  const doiRaw = optionalString(b.doi, 255, "DOI");
  if (doiRaw.error) return { error: doiRaw.error };
  const doi = doiRaw.value ? doiRaw.value.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "") : null;

  let publicationYear: number | null = null;
  if (b.publication_year !== undefined && b.publication_year !== null && b.publication_year !== "") {
    const year = Number(b.publication_year);
    const maxYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(year) || year < 1000 || year > maxYear) {
      return { error: `Publication year must be a whole number between 1000 and ${maxYear}` };
    }
    publicationYear = year;
  }

  if (!Array.isArray(b.authors) || b.authors.length === 0) {
    return { error: "At least one author is required" };
  }
  const authors: AuthorInput[] = [];
  const seen = new Set<string>();
  for (const entry of b.authors) {
    const raw = typeof entry === "string" ? { full_name: entry } : (entry as Record<string, unknown> | null);
    const name = raw && typeof raw.full_name === "string" ? raw.full_name.trim() : "";
    if (!name) continue; // ignore blank rows from the form
    if (name.length > 150) return { error: "Author names must be 150 characters or fewer" };
    const affiliation = optionalString(raw?.affiliation, 255, "Affiliation");
    if (affiliation.error) return { error: affiliation.error };
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    authors.push({ full_name: name, affiliation: affiliation.value });
  }
  if (authors.length === 0) return { error: "At least one author is required" };
  if (authors.length > MAX_AUTHORS) return { error: `A paper can have at most ${MAX_AUTHORS} authors` };

  return {
    data: {
      title,
      abstract: abstract.value,
      domain,
      publication_year: publicationYear,
      keywords: keywords.value,
      doi,
      pdf_url: pdf.value,
      authors,
    },
  };
}

/** Escapes % and _ so user text is matched literally inside LIKE. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

// ---------- Reading ----------

function placeholders(count: number): string {
  return Array(count).fill("?").join(",");
}

/** Loads the authors for a set of papers in one query and attaches them. */
export async function attachAuthors(rows: RowDataPacket[]): Promise<Paper[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.paper_id as number);
  const [links] = await pool.execute<RowDataPacket[]>(
    `SELECT pa.paper_id, a.author_id, a.full_name, a.affiliation
     FROM PaperAuthors pa
     INNER JOIN Authors a ON a.author_id = pa.author_id
     WHERE pa.paper_id IN (${placeholders(ids.length)})
     ORDER BY pa.paper_id, pa.author_order`,
    ids
  );
  const byPaper = new Map<number, PaperAuthor[]>();
  for (const link of links) {
    const list = byPaper.get(link.paper_id) ?? [];
    list.push({ author_id: link.author_id, full_name: link.full_name, affiliation: link.affiliation });
    byPaper.set(link.paper_id, list);
  }
  return rows.map((row) => ({ ...(row as unknown as Omit<Paper, "authors">), authors: byPaper.get(row.paper_id) ?? [] }));
}

export async function getPapersByIds(ids: number[]): Promise<Paper[]> {
  if (ids.length === 0) return [];
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${PAPER_COLUMNS} FROM ResearchPapers p WHERE p.paper_id IN (${placeholders(ids.length)})`,
    ids
  );
  return attachAuthors(rows);
}

export async function getPaperById(id: number): Promise<Paper | null> {
  const papers = await getPapersByIds([id]);
  return papers[0] ?? null;
}

export async function listAllPapers(): Promise<Paper[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${PAPER_COLUMNS} FROM ResearchPapers p ORDER BY p.paper_id`
  );
  return attachAuthors(rows);
}

// ---------- Auth helper (matches the app's localStorage-based login) ----------

export async function userExists(userId: number | null): Promise<boolean> {
  if (!userId) return false;
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT user_id FROM Users WHERE user_id = ?", [userId]);
  return rows.length > 0;
}

export function readUserId(value: unknown): number | null {
  return parsePositiveInteger(value);
}

/** Papers with an owner can only be changed by that owner; ownerless (seed) papers by any user. */
export function canModify(paper: { uploaded_by: number | null }, userId: number): boolean {
  return paper.uploaded_by === null || paper.uploaded_by === userId;
}

// ---------- Writing (transactional) ----------

async function saveAuthors(conn: PoolConnection, paperId: number, authors: AuthorInput[]) {
  await conn.execute("DELETE FROM PaperAuthors WHERE paper_id = ?", [paperId]);
  let order = 1;
  for (const author of authors) {
    // Re-use an existing author with the same name, otherwise create one.
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO Authors (full_name, affiliation) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE affiliation = COALESCE(VALUES(affiliation), affiliation), author_id = LAST_INSERT_ID(author_id)`,
      [author.full_name, author.affiliation]
    );
    await conn.execute("INSERT INTO PaperAuthors (paper_id, author_id, author_order) VALUES (?, ?, ?)", [
      paperId,
      result.insertId,
      order++,
    ]);
  }
  // Authors who no longer appear on any paper are removed.
  await conn.execute("DELETE FROM Authors WHERE author_id NOT IN (SELECT author_id FROM PaperAuthors)");
}

async function inTransaction<T>(db: Pool, work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export function createPaper(input: PaperInput, uploadedBy: number): Promise<number> {
  return inTransaction(pool, async (conn) => {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO ResearchPapers (title, abstract, domain, publication_year, keywords, doi, pdf_url, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.title, input.abstract, input.domain, input.publication_year, input.keywords, input.doi, input.pdf_url, uploadedBy]
    );
    await saveAuthors(conn, result.insertId, input.authors);
    return result.insertId;
  });
}

export function updatePaper(paperId: number, input: PaperInput): Promise<void> {
  return inTransaction(pool, async (conn) => {
    await conn.execute(
      `UPDATE ResearchPapers
       SET title = ?, abstract = ?, domain = ?, publication_year = ?, keywords = ?, doi = ?, pdf_url = ?
       WHERE paper_id = ?`,
      [input.title, input.abstract, input.domain, input.publication_year, input.keywords, input.doi, input.pdf_url, paperId]
    );
    await saveAuthors(conn, paperId, input.authors);
  });
}

export function deletePaper(paperId: number): Promise<void> {
  return inTransaction(pool, async (conn) => {
    await conn.execute("DELETE FROM ResearchPapers WHERE paper_id = ?", [paperId]);
    await conn.execute("DELETE FROM Authors WHERE author_id NOT IN (SELECT author_id FROM PaperAuthors)");
  });
}
