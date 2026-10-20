import { NextResponse } from "next/server";
import { isDuplicateKeyError, parsePositiveInteger } from "@/lib/validation";
import {
  canModify,
  deletePaper,
  getPaperById,
  parsePaperInput,
  readUserId,
  updatePaper,
  userExists,
} from "@/lib/papers";
import { indexPapers, removePaperFromIndex } from "@/lib/chroma";

type Context = { params: Promise<{ id: string }> };

async function readId(context: Context): Promise<number | null> {
  return parsePositiveInteger((await context.params).id);
}

// GET /api/papers/:id
export async function GET(_request: Request, context: Context) {
  const paperId = await readId(context);
  if (!paperId) return NextResponse.json({ message: "Invalid paper id" }, { status: 400 });
  try {
    const paper = await getPaperById(paperId);
    if (!paper) return NextResponse.json({ message: "Paper not found" }, { status: 404 });
    return NextResponse.json({ paper });
  } catch (error) {
    console.error("Get paper error:", error);
    return NextResponse.json({ message: "Unable to load paper" }, { status: 500 });
  }
}

// PUT /api/papers/:id  { user_id, ...same fields as POST }
export async function PUT(request: Request, context: Context) {
  const paperId = await readId(context);
  if (!paperId) return NextResponse.json({ message: "Invalid paper id" }, { status: 400 });
  try {
    const body = await request.json();
    const userId = readUserId(body.user_id);
    if (!(await userExists(userId))) {
      return NextResponse.json({ message: "Please log in to edit a paper" }, { status: 401 });
    }
    const existing = await getPaperById(paperId);
    if (!existing) return NextResponse.json({ message: "Paper not found" }, { status: 404 });
    if (!canModify(existing, userId!)) {
      return NextResponse.json({ message: "Only the user who added this paper can edit it" }, { status: 403 });
    }

    const { data, error } = parsePaperInput(body);
    if (!data) return NextResponse.json({ message: error }, { status: 400 });

    await updatePaper(paperId, data);

    let indexed = true;
    try {
      const paper = await getPaperById(paperId);
      if (paper) await indexPapers([paper]);
    } catch (indexError) {
      indexed = false;
      console.error("Chroma re-indexing failed:", indexError);
    }
    return NextResponse.json({ message: "Paper updated", indexed });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ message: "Another paper already uses this DOI" }, { status: 409 });
    }
    console.error("Update paper error:", error);
    return NextResponse.json({ message: "Unable to update paper" }, { status: 500 });
  }
}

// DELETE /api/papers/:id  { user_id }
export async function DELETE(request: Request, context: Context) {
  const paperId = await readId(context);
  if (!paperId) return NextResponse.json({ message: "Invalid paper id" }, { status: 400 });
  try {
    const body = await request.json().catch(() => ({}));
    const userId = readUserId(body.user_id);
    if (!(await userExists(userId))) {
      return NextResponse.json({ message: "Please log in to delete a paper" }, { status: 401 });
    }
    const existing = await getPaperById(paperId);
    if (!existing) return NextResponse.json({ message: "Paper not found" }, { status: 404 });
    if (!canModify(existing, userId!)) {
      return NextResponse.json({ message: "Only the user who added this paper can delete it" }, { status: 403 });
    }

    await deletePaper(paperId); // bookmarks, comments and ratings are removed by ON DELETE CASCADE

    let indexed = true;
    try {
      await removePaperFromIndex(paperId);
    } catch (indexError) {
      indexed = false;
      console.error("Chroma removal failed:", indexError);
    }
    return NextResponse.json({ message: "Paper deleted", indexed });
  } catch (error) {
    console.error("Delete paper error:", error);
    return NextResponse.json({ message: "Unable to delete paper" }, { status: 500 });
  }
}
