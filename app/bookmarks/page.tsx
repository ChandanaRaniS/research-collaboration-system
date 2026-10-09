"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/app/components/useCurrentUser";

type Bookmark = {
  bookmark_id: number;
  paper_id: number;
  bookmarked_at: string;
};

export default function BookmarksPage() {
  const { user, loaded } = useCurrentUser();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBookmarks = useCallback(async () => {
    if (!user) return;
    const response = await fetch(`/api/bookmarks?userId=${user.user_id}`);
    const result = await response.json();
    if (response.ok) setBookmarks(result.bookmarks);
    else setMessage(result.message || "Unable to load bookmarks");
  }, [user]);

  useEffect(() => {
    if (!loaded || !user) return;
    fetch(`/api/bookmarks?userId=${user.user_id}`)
      .then(async (response) => {
        const result = await response.json();
        if (response.ok) setBookmarks(result.bookmarks);
        else setMessage(result.message || "Unable to load bookmarks");
      })
      .catch(() => setMessage("Unable to load bookmarks"));
  }, [loaded, user]);

  async function addBookmark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id, paper_id: formData.get("paper_id") }),
      });
      const result = await response.json();
      setMessage(result.message);
      if (response.ok) {
        form.reset();
        await loadBookmarks();
      }
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBookmark(bookmarkId: number) {
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id, bookmark_id: bookmarkId }),
      });
      const result = await response.json();
      setMessage(result.message);
      if (response.ok) await loadBookmarks();
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !user) return <SignedOut loaded={loaded} />;

  return (
    <main className="dashboard-page">
      <div className="dashboard-container feature-container">
        <PageHeading title="Bookmarks" />
        <section className="feature-panel">
          <h2>Add a paper bookmark</h2>
          <form className="feature-form inline-form" onSubmit={addBookmark}>
            <label htmlFor="paper_id">Paper ID</label>
            <input id="paper_id" name="paper_id" type="number" min="1" required />
            <button type="submit" disabled={busy}>Add bookmark</button>
          </form>
        </section>
        <p className="form-message" role="status">{message}</p>
        <section className="feature-panel">
          <h2>Your bookmarks</h2>
          {bookmarks.length === 0 ? <p className="empty-state">No bookmarks yet.</p> : (
            <div className="record-list">
              {bookmarks.map((bookmark) => (
                <article className="record-row" key={bookmark.bookmark_id}>
                  <div><strong>Paper #{bookmark.paper_id}</strong><span>Bookmarked {new Date(bookmark.bookmarked_at).toLocaleString()}</span></div>
                  <button className="button-secondary" type="button" disabled={busy} onClick={() => void deleteBookmark(bookmark.bookmark_id)}>Remove</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PageHeading({ title }: { title: string }) {
  return <header className="feature-heading"><a href="/dashboard" className="back-link">← Dashboard</a><h1>{title}</h1></header>;
}

function SignedOut({ loaded }: { loaded: boolean }) {
  return <main className="dashboard-page"><div className="dashboard-container"><h1>Bookmarks</h1><p className="dashboard-subtitle">{loaded ? "Please log in to view your bookmarks." : "Loading..."}</p>{loaded && <Link className="back-button" href="/">Go to Login</Link>}</div></main>;
}