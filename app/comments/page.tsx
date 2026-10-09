"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/app/components/useCurrentUser";

type CommentRecord = { comment_id: number; paper_id: number; comment_text: string; created_at: string };

export default function CommentsPage() {
  const { user, loaded } = useCurrentUser();
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadComments = useCallback(async () => {
    if (!user) return;
    const response = await fetch(`/api/comments?userId=${user.user_id}`);
    const result = await response.json();
    if (response.ok) setComments(result.comments);
    else setMessage(result.message || "Unable to load comments");
  }, [user]);

  useEffect(() => {
    if (!loaded || !user) return;
    fetch(`/api/comments?userId=${user.user_id}`)
      .then(async (response) => {
        const result = await response.json();
        if (response.ok) setComments(result.comments);
        else setMessage(result.message || "Unable to load comments");
      })
      .catch(() => setMessage("Unable to load comments"));
  }, [loaded, user]);

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id, paper_id: values.get("paper_id"), comment_text: values.get("comment_text") }),
      });
      const result = await response.json();
      setMessage(result.message);
      if (response.ok) {
        form.reset();
        await loadComments();
      }
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(commentId: number) {
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id, comment_id: commentId }),
      });
      const result = await response.json();
      setMessage(result.message);
      if (response.ok) await loadComments();
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !user) return <main className="dashboard-page"><div className="dashboard-container"><h1>Comments</h1><p className="dashboard-subtitle">{loaded ? "Please log in to view your comments." : "Loading..."}</p>{loaded && <Link className="back-button" href="/">Go to Login</Link>}</div></main>;

  return (
    <main className="dashboard-page"><div className="dashboard-container feature-container">
      <header className="feature-heading"><a href="/dashboard" className="back-link">← Dashboard</a><h1>Comments</h1></header>
      <section className="feature-panel"><h2>Add a comment</h2>
        <form className="feature-form" onSubmit={addComment}>
          <label htmlFor="paper_id">Paper ID</label><input id="paper_id" name="paper_id" type="number" min="1" required />
          <label htmlFor="comment_text">Comment</label><textarea id="comment_text" name="comment_text" rows={4} required />
          <button type="submit" disabled={busy}>Add comment</button>
        </form>
      </section>
      <p className="form-message" role="status">{message}</p>
      <section className="feature-panel"><h2>Your comments</h2>
        {comments.length === 0 ? <p className="empty-state">No comments yet.</p> : <div className="record-list">{comments.map((comment) => (
          <article className="record-card" key={comment.comment_id}>
            <div className="record-card-heading"><h3>Paper #{comment.paper_id}</h3><button className="button-secondary" type="button" disabled={busy} onClick={() => void deleteComment(comment.comment_id)}>Delete</button></div>
            <p className="comment-copy">{comment.comment_text}</p><time className="record-time">{new Date(comment.created_at).toLocaleString()}</time>
          </article>
        ))}</div>}
      </section>
    </div></main>
  );
}