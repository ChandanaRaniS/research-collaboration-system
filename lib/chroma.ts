import { ChromaClient, type Collection } from "chromadb";
import type { Paper } from "@/lib/papers";
import { EmbeddingError, embedTexts } from "@/lib/embeddings";

const COLLECTION_NAME = process.env.CHROMA_COLLECTION ?? "research_papers";
const BATCH_SIZE = 25;

let collectionPromise: Promise<Collection> | null = null;

function getCollection(): Promise<Collection> {
  if (!collectionPromise) {
    const client = new ChromaClient({
      host: process.env.CHROMA_HOST ?? "localhost",
      port: Number(process.env.CHROMA_PORT ?? 8000),
      ssl: process.env.CHROMA_SSL === "true",
    });
    collectionPromise = client
      .getOrCreateCollection({
        name: COLLECTION_NAME,
        // We compute embeddings ourselves (lib/embeddings.ts) and pass vectors in.
        embeddingFunction: null,
        configuration: { hnsw: { space: "cosine" } },
      })
      .catch((error) => {
        collectionPromise = null; // retry on next request (e.g. Chroma was not running yet)
        throw error;
      });
  }
  return collectionPromise;
}

/** The text that represents a paper in the vector index. */
export function paperToDocument(paper: Paper): string {
  return [
    paper.title,
    paper.abstract,
    paper.keywords ? `Keywords: ${paper.keywords}` : null,
    `Domain: ${paper.domain}`,
    paper.authors.length ? `Authors: ${paper.authors.map((a) => a.full_name).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Adds or refreshes papers in the index. */
export async function indexPapers(papers: Paper[]): Promise<void> {
  if (papers.length === 0) return;
  const collection = await getCollection();
  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE);
    const documents = batch.map(paperToDocument);
    const embeddings = await embedTexts(documents);
    await collection.upsert({
      ids: batch.map((p) => String(p.paper_id)),
      embeddings,
      documents,
      metadatas: batch.map((p) => ({
        paper_id: p.paper_id,
        title: p.title,
        domain: p.domain,
        publication_year: p.publication_year ?? 0,
      })),
    });
  }
}

export async function removePaperFromIndex(paperId: number): Promise<void> {
  const collection = await getCollection();
  await collection.delete({ ids: [String(paperId)] });
}

export type SemanticHit = { paper_id: number; score: number };

/** Finds the papers whose meaning is closest to the query text (score is cosine similarity, 0–1). */
export async function semanticSearch(query: string, limit: number): Promise<SemanticHit[]> {
  const collection = await getCollection();
  const [queryEmbedding] = await embedTexts([query]);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit,
    include: ["distances"],
  });
  const ids = result.ids[0] ?? [];
  const distances = result.distances?.[0] ?? [];
  return ids.map((id, index) => ({
    paper_id: Number(id),
    score: Math.max(0, Math.min(1, 1 - (distances[index] ?? 1))),
  }));
}

/** Rebuilds the whole index from the given papers and drops entries that no longer exist in MySQL. */
export async function rebuildIndex(papers: Paper[]): Promise<{ indexed: number; removed: number }> {
  const collection = await getCollection();
  const existing = await collection.get({ include: [] });
  const keep = new Set(papers.map((p) => String(p.paper_id)));
  const stale = existing.ids.filter((id) => !keep.has(id));
  if (stale.length > 0) await collection.delete({ ids: stale });
  await indexPapers(papers);
  return { indexed: papers.length, removed: stale.length };
}

export function chromaErrorMessage(error: unknown): string {
  if (error instanceof EmbeddingError) return error.message;
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/ECONNREFUSED|fetch failed|Failed to connect|ChromaConnectionError/i.test(text)) {
    return "Semantic search is unavailable: the ChromaDB server is not running.";
  }
  return "Semantic search is temporarily unavailable.";
}
