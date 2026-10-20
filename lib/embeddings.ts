/**
 * Turns text into vectors for ChromaDB.
 *
 * EMBEDDING_PROVIDER=default (default)
 *   Real semantic embeddings (all-MiniLM-L6-v2, the same model ChromaDB uses by default)
 *   computed locally in Node with @huggingface/transformers. No API key needed. The ~90 MB
 *   model is downloaded from Hugging Face the first time it is used, then cached on disk.
 *
 * EMBEDDING_PROVIDER=hash
 *   Offline fallback that hashes words into a vector. It matches shared words only
 *   (NOT meaning), so use it purely for demos without internet access.
 */

const HASH_DIMENSIONS = 384;

type Embedder = { generate(texts: string[]): Promise<number[][]> };

/** Thrown when the embedding model cannot be loaded or run (kept separate from Chroma connection errors). */
export class EmbeddingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmbeddingError";
  }
}

let embedder: Promise<Embedder> | null = null;

function hashEmbedding(text: string): number[] {
  const vector = new Array<number>(HASH_DIMENSIONS).fill(0);
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const word of words) {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) {
      h ^= word.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vector[Math.abs(h) % HASH_DIMENSIONS] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

async function loadEmbedder(): Promise<Embedder> {
  if ((process.env.EMBEDDING_PROVIDER ?? "default") === "hash") {
    return { generate: async (texts) => texts.map(hashEmbedding) };
  }
  const { pipeline } = await import("@huggingface/transformers");
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return {
    generate: async (texts) => {
      const output = await extractor(texts, { pooling: "mean", normalize: true });
      return output.tolist() as number[][];
    },
  };
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  try {
    if (!embedder) {
      embedder = loadEmbedder().catch((error) => {
        embedder = null; // allow a retry on the next request
        throw error;
      });
    }
    return await (await embedder).generate(texts);
  } catch (error) {
    throw new EmbeddingError(
      "The embedding model could not be loaded. The first use needs internet access to download it (~90 MB); " +
        "set EMBEDDING_PROVIDER=hash in .env.local for an offline keyword-only fallback.",
      { cause: error }
    );
  }
}
