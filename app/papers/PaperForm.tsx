"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/app/components/useCurrentUser";
import type { PaperRecord } from "./types";

type AuthorRow = { full_name: string; affiliation: string };

export default function PaperForm({ paper }: { paper?: PaperRecord }) {
  const router = useRouter();
  const { user, loaded } = useCurrentUser();
  const editing = Boolean(paper);

  const [authors, setAuthors] = useState<AuthorRow[]>(
    paper?.authors.length
      ? paper.authors.map((a) => ({ full_name: a.full_name, affiliation: a.affiliation ?? "" }))
      : [{ full_name: "", affiliation: "" }]
  );
  const [knownAuthors, setKnownAuthors] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Suggestions so people re-use existing author / domain spellings.
  useEffect(() => {
    if (!loaded || !user) return;
    fetch("/api/authors?limit=50")
      .then((r) => r.json())
      .then((d) => setKnownAuthors((d.authors ?? []).map((a: { full_name: string }) => a.full_name)))
      .catch(() => {});
    fetch("/api/papers/domains")
      .then((r) => r.json())
      .then((d) => setDomains((d.domains ?? []).map((x: { domain: string }) => x.domain)))
      .catch(() => {});
  }, [loaded, user]);

  function updateAuthor(index: number, field: keyof AuthorRow, value: string) {
    setAuthors((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage("");
    const values = new FormData(event.currentTarget);
    const payload = {
      user_id: user.user_id,
      title: values.get("title"),
      abstract: values.get("abstract"),
      domain: values.get("domain"),
      publication_year: values.get("publication_year"),
      keywords: values.get("keywords"),
      doi: values.get("doi"),
      pdf_url: values.get("pdf_url"),
      authors,
    };
    try {
      const response = await fetch(editing ? `/api/papers/${paper!.paper_id}` : "/api/papers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok) {
        router.push(`/papers/${editing ? paper!.paper_id : result.paper_id}`);
      } else {
        setMessage(result.message || "Unable to save the paper");
        setBusy(false);
      }
    } catch {
      setMessage("Unable to connect to the server.");
      setBusy(false);
    }
  }

  const heading = editing ? "Edit paper" : "Add a paper";

  if (!loaded || !user) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-container">
          <h1>{heading}</h1>
          <p className="dashboard-subtitle">{loaded ? "Please log in to continue." : "Loading..."}</p>
          {loaded && <Link className="back-button" href="/">Go to Login</Link>}
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container feature-container">
        <header className="feature-heading">
          <Link href={editing ? `/papers/${paper!.paper_id}` : "/papers"} className="back-link">← Back</Link>
          <h1>{heading}</h1>
        </header>

        <section className="feature-panel">
          <form className="feature-form" onSubmit={handleSubmit}>
            <label htmlFor="title">Title</label>
            <input id="title" name="title" maxLength={500} required defaultValue={paper?.title ?? ""} />

            <label htmlFor="domain">Domain</label>
            <input id="domain" name="domain" maxLength={100} list="domain-options" required
              placeholder="e.g. Machine Learning" defaultValue={paper?.domain ?? ""} />
            <datalist id="domain-options">{domains.map((d) => <option key={d} value={d} />)}</datalist>

            <label htmlFor="publication_year">Publication year <span className="optional-label">(optional)</span></label>
            <input id="publication_year" name="publication_year" type="number" min={1000} max={new Date().getFullYear() + 1}
              defaultValue={paper?.publication_year ?? ""} />

            <label htmlFor="abstract">Abstract <span className="optional-label">(optional, used for semantic search)</span></label>
            <textarea id="abstract" name="abstract" rows={6} defaultValue={paper?.abstract ?? ""} />

            <label htmlFor="keywords">Keywords <span className="optional-label">(comma separated, optional)</span></label>
            <input id="keywords" name="keywords" maxLength={500} defaultValue={paper?.keywords ?? ""} />

            <label htmlFor="doi">DOI <span className="optional-label">(optional)</span></label>
            <input id="doi" name="doi" maxLength={255} placeholder="10.1000/xyz123" defaultValue={paper?.doi ?? ""} />

            <label htmlFor="pdf_url">PDF link <span className="optional-label">(optional)</span></label>
            <input id="pdf_url" name="pdf_url" type="url" maxLength={500} placeholder="https://..." defaultValue={paper?.pdf_url ?? ""} />

            <label>Authors <span className="optional-label">(in byline order)</span></label>
            <datalist id="author-options">{knownAuthors.map((a) => <option key={a} value={a} />)}</datalist>
            <div className="author-rows">
              {authors.map((author, index) => (
                <div className="author-row" key={index}>
                  <input aria-label={`Author ${index + 1} name`} placeholder="Full name" list="author-options"
                    maxLength={150} value={author.full_name}
                    onChange={(e) => updateAuthor(index, "full_name", e.target.value)} />
                  <input aria-label={`Author ${index + 1} affiliation`} placeholder="Affiliation (optional)"
                    maxLength={255} value={author.affiliation}
                    onChange={(e) => updateAuthor(index, "affiliation", e.target.value)} />
                  <button type="button" className="button-secondary" disabled={authors.length === 1}
                    onClick={() => setAuthors((rows) => rows.filter((_, i) => i !== index))}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" className="button-secondary add-author"
              disabled={authors.length >= 20}
              onClick={() => setAuthors((rows) => [...rows, { full_name: "", affiliation: "" }])}>
              + Add author
            </button>

            <p className="form-message" role="status">{message}</p>
            <button type="submit" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Add paper"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
