"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/app/components/useCurrentUser";

type RatingRecord = { rating_id: number; paper_id: number; rating: number; review: string | null; created_at: string };

export default function RatingsPage() {
  const { user, loaded } = useCurrentUser();
  const [ratings, setRatings] = useState<RatingRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadRatings = useCallback(async () => {
    if (!user) return;
    const response = await fetch(`/api/ratings?userId=${user.user_id}`);
    const result = await response.json();
    if (response.ok) setRatings(result.ratings);
    else setMessage(result.message || "Unable to load ratings");
  }, [user]);

  useEffect(() => {
    if (!loaded || !user) return;
    fetch(`/api/ratings?userId=${user.user_id}`)
      .then(async (response) => {
        const result = await response.json();
        if (response.ok) setRatings(result.ratings);
        else setMessage(result.message || "Unable to load ratings");
      })
      .catch(() => setMessage("Unable to load ratings"));
  }, [loaded, user]);

  async function addRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id, paper_id: values.get("paper_id"), rating: values.get("rating"), review: values.get("review") }),
      });
      const result = await response.json();
      setMessage(result.message);
      if (response.ok) {
        form.reset();
        await loadRatings();
      }
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !user) return <main className="dashboard-page"><div className="dashboard-container"><h1>Ratings</h1><p className="dashboard-subtitle">{loaded ? "Please log in to view your ratings." : "Loading..."}</p>{loaded && <Link className="back-button" href="/">Go to Login</Link>}</div></main>;

  return (
    <main className="dashboard-page"><div className="dashboard-container feature-container">
      <header className="feature-heading"><a href="/dashboard" className="back-link">← Dashboard</a><h1>Ratings</h1></header>
      <section className="feature-panel"><h2>Rate a paper</h2>
        <form className="feature-form" onSubmit={addRating}>
          <label htmlFor="paper_id">Paper ID</label><input id="paper_id" name="paper_id" type="number" min="1" required />
          <label htmlFor="rating">Rating</label><select id="rating" name="rating" defaultValue="5" required><option value="1">1 star</option><option value="2">2 stars</option><option value="3">3 stars</option><option value="4">4 stars</option><option value="5">5 stars</option></select>
          <label htmlFor="review">Review <span className="optional-label">(optional)</span></label><textarea id="review" name="review" rows={4} />
          <button type="submit" disabled={busy}>Add rating</button>
        </form>
      </section>
      <p className="form-message" role="status">{message}</p>
      <section className="feature-panel"><h2>Your ratings and reviews</h2>
        {ratings.length === 0 ? <p className="empty-state">No ratings yet.</p> : <div className="record-list">{ratings.map((rating) => (
          <article className="record-card" key={rating.rating_id}>
            <div className="record-card-heading"><h3>Paper #{rating.paper_id}</h3><span className="rating-value">{rating.rating} / 5</span></div>
            <p>{rating.review || "No review included."}</p><time className="record-time">{new Date(rating.created_at).toLocaleString()}</time>
          </article>
        ))}</div>}
      </section>
    </div></main>
  );
}