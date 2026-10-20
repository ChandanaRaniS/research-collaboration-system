export type PaperAuthor = { author_id: number; full_name: string; affiliation: string | null };

export type PaperRecord = {
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
  score?: number; // only present on semantic search results
};
