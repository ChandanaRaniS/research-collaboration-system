"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/app/components/useCurrentUser";
import type { PaperRecord } from "./types";

type Mode = "keyword" | "semantic";
type Query = { mode: Mode; title: string; author: string; domain: string; sort: string; q: string; page: number };
type DomainCount = { domain: string; paper_count: number };

export default function PapersPage() {
  return (
    <Suspense fallback={<main className="dashboard-page"><div className="dashboard-container"><p className="dashboard-subtitle">Loading...</p></div></main>}>
      <Papers />
    </Suspense>
  );
}

function Papers() {
  const { user, loaded } = useCurrentUser();
  const searchParams = useSearchParams();

  // `form` is what is typed; `query` is what was submitted (and drives the fetch).
  const initial: Query = {
    mode: "keyword",
    title: searchParams.get("title") ?? "",
    author: searchParams.get("author") ?? "",
    domain: searchParams.get("domain") ?? "",
    sort: "newest",
    q: "",
    page: 1,
  };
  const [form, setForm] = useState<Query>(initial);
  const [query, setQuery] = useState<Query>(initial);
  const [papers, setPapers] = useState<PaperRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [domains, setDomains] = useState<DomainCount[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    if (!loaded || !user) return;
    fetch("/api/papers/domains")
      .then((r) => r.json())
      .then((d) => setDomains(d.domains ?? []))
      .catch(() => {});
  }, [loaded, user]);

  useEffect(() => {
    if (!loaded || !user) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    let url: string;
    if (query.mode === "semantic") {
      params.set("q", query.q);
      url = `/api/papers/semantic?${params}`;
    } else {
      if (query.title) params.set("title", query.title);
      if (query.author) params.set("author", query.author);
      if (query.domain) params.set("domain", query.domain);
      params.set("sort", query.sort);
      params.set("page", String(query.page));
      url = `/api/papers?${params}`;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          setError(result.message || "Unable to load papers");
          setPapers([]);
          setStatus("error");
          return;
        }
        setPapers(result.papers);
        setTotal(result.total);
        setTotalPages(result.total_pages ?? 1);
        setStatus("ready");
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError("Unable to connect to the server.");
        setStatus("error");
      });
    return () => controller.abort();
  }, [loaded, user, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setQuery({ ...form, page: 1 });
  }

  function reset() {
    const cleared: Query = { mode: form.mode, title: "", author: "", domain: "", sort: "newest", q: "", page: 1 };
    setForm(cleared);
    setQuery(cleared);
  }

  async function rebuildIndex() {
    if (!user) return;
    setReindexing(true);
    setNotice("");
    try {
      const response = await fetch("/api/papers/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id }),
      });
      const result = await response.json();
      setNotice(result.message);
    } catch {
      setNotice("Unable to connect to the server.");
    } finally {
      setReindexing(false);
    }
  }

  if (!loaded || !user) {
    return (
      <main className="dashboard-page"><div className="dashboard-container">
        <h1>Research Papers</h1>
        <p className="dashboard-subtitle">{loaded ? "Please log in to browse papers." : "Loading..."}</p>
        {loaded && <Link className="back-button" href="/">Go to Login</Link>}
      </div></main>
    );
  }

  const semantic = form.mode === "semantic";

  return (
    <main className="dashboard-page">
      <div className="dashboard-container feature-container">
        <header className="feature-heading">
          <Link href="/dashboard" className="back-link">← Dashboard</Link>
          <h1>Research Papers</h1>
        </header>

        <section className="feature-panel">
          <div className="mode-tabs" role="tablist" aria-label="Search type">
            <button type="button" role="tab" aria-selected={!semantic}
              className={!semantic ? "tab active" : "tab"} onClick={() => setForm({ ...form, mode: "keyword" })}>
              Search by title, author, domain
            </button>
            <button type="button" role="tab" aria-selected={semantic}
              className={semantic ? "tab active" : "tab"} onClick={() => setForm({ ...form, mode: "semantic" })}>
              ✨ Semantic search
            </button>
          </div>

          <form className="feature-form search-form" onSubmit={submit}>
            {semantic ? (
              <>
                <label htmlFor="q">Describe what you are looking for</label>
                <input id="q" value={form.q} maxLength={500} required
                  placeholder="e.g. neural networks that understand human language"
                  onChange={(e) => setForm({ ...form, q: e.target.value })} />
                <p className="record-meta">Finds papers by meaning, even when the exact words do not appear in the title.</p>
              </>
            ) : (
              <div className="search-grid">
                <div>
                  <label htmlFor="title">Title</label>
                  <input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="author">Author</label>
                  <input id="author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="domain">Domain</label>
                  <select id="domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                    <option value="">All domains</option>
                    {domains.map((d) => <option key={d.domain} value={d.domain}>{d.domain} ({d.paper_count})</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="sort">Sort by</label>
                  <select id="sort" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })}>
                    <option value="newest">Recently added</option>
                    <option value="year">Publication year</option>
                    <option value="title">Title (A–Z)</option>
                  </select>
                </div>
              </div>
            )}
            <div className="record-actions">
              <button type="submit">Search</button>
              <button type="button" className="button-secondary" onClick={reset}>Clear</button>
              <Link className="button-secondary link-button push-right" href="/papers/new">+ Add paper</Link>
            </div>
          </form>
        </section>

        <p className="form-message" role="status">{notice}</p>

        <section className="feature-panel">
          <div className="results-heading">
            <h2>
              {query.mode === "semantic" && query.q ? `Closest matches for “${query.q}”` : "Papers"}
              {status === "ready" && <span className="optional-label"> · {total} found</span>}
            </h2>
            <button type="button" className="button-secondary" disabled={reindexing} onClick={() => void rebuildIndex()}
              title="Re-embed all papers into ChromaDB">
              {reindexing ? "Rebuilding..." : "Rebuild semantic index"}
            </button>
          </div>

          {status === "loading" && <p className="empty-state">Loading...</p>}
          {status === "error" && <p className="empty-state">{error}</p>}
          {status === "ready" && papers.length === 0 && (
            <p className="empty-state">
              {query.mode === "semantic"
                ? "No matches. If you just imported papers, click “Rebuild semantic index”."
                : "No papers match your search."}
            </p>
          )}
          {status === "ready" && papers.length > 0 && (
            <div className="record-list">
              {papers.map((paper) => (
                <article className="record-card paper-card" key={paper.paper_id}>
                  <div className="record-card-heading">
                    <h3><Link href={`/papers/${paper.paper_id}`}>{paper.title}</Link></h3>
                    {paper.score !== undefined && <span className="status-badge status-accepted">{Math.round(paper.score * 100)}% match</span>}
                  </div>
                  <p className="record-meta">
                    {paper.authors.map((a) => a.full_name).join(", ") || "Unknown authors"}
                    {paper.publication_year ? ` · ${paper.publication_year}` : ""}
                  </p>
                  <p><span className="domain-badge">{paper.domain}</span></p>
                  {paper.abstract && <p className="abstract-preview">{paper.abstract}</p>}
                </article>
              ))}
            </div>
          )}

          {query.mode === "keyword" && status === "ready" && totalPages > 1 && (
            <div className="pagination">
              <button type="button" className="button-secondary" disabled={query.page <= 1}
                onClick={() => setQuery({ ...query, page: query.page - 1 })}>← Previous</button>
              <span>Page {query.page} of {totalPages}</span>
              <button type="button" className="button-secondary" disabled={query.page >= totalPages}
                onClick={() => setQuery({ ...query, page: query.page + 1 })}>Next →</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
