"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/app/components/useCurrentUser";
import type { PaperRecord } from "../types";

export default function PaperDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loaded } = useCurrentUser();
  const [paper, setPaper] = useState<PaperRecord | null>(null);
  const [bookmarkId, setBookmarkId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded || !user) return;
    fetch(`/api/papers/${id}`)
      .then(async (response) => {
        const result = await response.json();
        if (response.ok) setPaper(result.paper);
        else setError(result.message || "Paper not found");
      })
      .catch(() => setError("Unable to load the paper"));
  }, [id, loaded, user]);

  const loadBookmark = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/bookmarks?userId=${user.user_id}`);
      const result = await response.json();
      if (response.ok) {
        const match = (result.bookmarks as { bookmark_id: number; paper_id: number }[]).find((b) => b.paper_id === Number(id));
        setBookmarkId(match ? match.bookmark_id : null);
      }
    } catch {
      /* bookmark state is optional on this page */
    }
  }, [id, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBookmark();
  }, [loadBookmark]);

  async function toggleBookmark() {
    if (!user || !paper) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/bookmarks", {
        method: bookmarkId ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bookmarkId
            ? { user_id: user.user_id, bookmark_id: bookmarkId }
            : { user_id: user.user_id, paper_id: paper.paper_id }
        ),
      });
      const result = await response.json();
      setMessage(result.message);
      await loadBookmark();
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  async function removePaper() {
    if (!user || !paper) return;
    if (!window.confirm(`Delete "${paper.title}"? This also removes its bookmarks, comments and ratings.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/papers/${paper.paper_id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id }),
      });
      const result = await response.json();
      if (response.ok) router.push("/papers");
      else {
        setMessage(result.message);
        setBusy(false);
      }
    } catch {
      setMessage("Unable to connect to the server.");
      setBusy(false);
    }
  }

  if (!loaded || !user || (!paper && !error)) {
    return (
      <main className="dashboard-page"><div className="dashboard-container">
        <p className="dashboard-subtitle">{loaded && !user ? "Please log in." : "Loading..."}</p>
      </div></main>
    );
  }
  if (error || !paper) {
    return (
      <main className="dashboard-page"><div className="dashboard-container">
        <h1>Paper</h1><p className="dashboard-subtitle">{error}</p>
        <Link className="back-button" href="/papers">Back to papers</Link>
      </div></main>
    );
  }

  const canModify = paper.uploaded_by === null || paper.uploaded_by === user.user_id;
  const keywordList = paper.keywords ? paper.keywords.split(",").map((k) => k.trim()).filter(Boolean) : [];

  return (
    <main className="dashboard-page">
      <div className="dashboard-container feature-container">
        <header className="feature-heading">
          <Link href="/papers" className="back-link">← Papers</Link>
          <h1>Paper #{paper.paper_id}</h1>
        </header>

        <section className="feature-panel paper-detail">
          <h2 className="paper-title">{paper.title}</h2>
          <p className="record-meta">
            {paper.authors.map((a) => a.full_name).join(", ")}
            {paper.publication_year ? ` · ${paper.publication_year}` : ""}
          </p>
          <p><span className="domain-badge">{paper.domain}</span></p>

          <h3>Abstract</h3>
          <p className="comment-copy">{paper.abstract || "No abstract provided."}</p>

          {keywordList.length > 0 && (
            <div className="keyword-list">{keywordList.map((k) => <span key={k} className="keyword-chip">{k}</span>)}</div>
          )}

          <h3>Authors</h3>
          <ul className="author-list">
            {paper.authors.map((a) => (
              <li key={a.author_id}>
                <Link href={`/papers?author=${encodeURIComponent(a.full_name)}`}>{a.full_name}</Link>
                {a.affiliation && <span className="record-meta"> — {a.affiliation}</span>}
              </li>
            ))}
          </ul>

          <p className="record-meta">
            {paper.doi && <>DOI: <a className="text-link" href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">{paper.doi}</a> · </>}
            {paper.pdf_url && <><a className="text-link" href={paper.pdf_url} target="_blank" rel="noreferrer">Open PDF</a> · </>}
            Added {new Date(paper.created_at).toLocaleDateString()}
          </p>

          <div className="record-actions">
            <button type="button" disabled={busy} onClick={() => void toggleBookmark()}>
              {bookmarkId ? "Remove bookmark" : "🔖 Bookmark"}
            </button>
            {canModify && <Link className="button-secondary link-button" href={`/papers/${paper.paper_id}/edit`}>Edit</Link>}
            {canModify && <button className="button-secondary" type="button" disabled={busy} onClick={() => void removePaper()}>Delete</button>}
          </div>
          <p className="form-message" role="status">{message}</p>
          <p className="record-meta">Use paper ID <strong>{paper.paper_id}</strong> on the Comments and Ratings pages to review this paper.</p>
        </section>
      </div>
    </main>
  );
}
