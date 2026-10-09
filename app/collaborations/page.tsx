"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/app/components/useCurrentUser";

type Collaboration = {
  collaboration_id: number;
  requester_id: number;
  receiver_id: number;
  requester_name: string;
  receiver_name: string;
  research_topic: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export default function CollaborationsPage() {
  const { user, loaded } = useCurrentUser();
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCollaborations = useCallback(async () => {
    if (!user) return;
    const response = await fetch(`/api/collaborations?userId=${user.user_id}`);
    const result = await response.json();
    if (response.ok) setCollaborations(result.collaborations);
    else setMessage(result.message || "Unable to load collaboration requests");
  }, [user]);

  useEffect(() => {
    if (!loaded || !user) return;
    fetch(`/api/collaborations?userId=${user.user_id}`)
      .then(async (response) => {
        const result = await response.json();
        if (response.ok) setCollaborations(result.collaborations);
        else setMessage(result.message || "Unable to load collaboration requests");
      })
      .catch(() => setMessage("Unable to load collaboration requests"));
  }, [loaded, user]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/collaborations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester_id: user.user_id,
          receiver_id: values.get("receiver_id"),
          research_topic: values.get("research_topic"),
          message: values.get("message"),
        }),
      });
      const result = await response.json();
      setMessage(result.message);
      if (response.ok) {
        form.reset();
        await loadCollaborations();
      }
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  async function respond(collaborationId: number, status: "accepted" | "rejected") {
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/collaborations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id, collaboration_id: collaborationId, status }),
      });
      const result = await response.json();
      setMessage(result.message);
      if (response.ok) await loadCollaborations();
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !user) return <main className="dashboard-page"><div className="dashboard-container"><h1>Collaborations</h1><p className="dashboard-subtitle">{loaded ? "Please log in to manage collaboration requests." : "Loading..."}</p>{loaded && <Link className="back-button" href="/">Go to Login</Link>}</div></main>;

  return (
    <main className="dashboard-page">
      <div className="dashboard-container feature-container">
        <header className="feature-heading"><a href="/dashboard" className="back-link">← Dashboard</a><h1>Collaborations</h1></header>
        <section className="feature-panel">
          <h2>Send a request</h2>
          <form className="feature-form" onSubmit={createRequest}>
            <label htmlFor="receiver_id">Researcher user ID</label>
            <input id="receiver_id" name="receiver_id" type="number" min="1" required />
            <label htmlFor="research_topic">Research topic</label>
            <input id="research_topic" name="research_topic" maxLength={255} required />
            <label htmlFor="collaboration_message">Message <span className="optional-label">(optional)</span></label>
            <textarea id="collaboration_message" name="message" rows={3} />
            <button type="submit" disabled={busy}>Send request</button>
          </form>
        </section>
        <p className="form-message" role="status">{message}</p>
        <section className="feature-panel">
          <h2>Requests sent and received</h2>
          {collaborations.length === 0 ? <p className="empty-state">No collaboration requests yet.</p> : (
            <div className="record-list">
              {collaborations.map((collaboration) => {
                const incoming = collaboration.receiver_id === user.user_id;
                return (
                  <article className="record-card" key={collaboration.collaboration_id}>
                    <div className="record-card-heading"><h3>{collaboration.research_topic}</h3><span className={`status-badge status-${collaboration.status}`}>{collaboration.status}</span></div>
                    <p className="record-meta">Requester: {collaboration.requester_name} <span>(user #{collaboration.requester_id})</span></p>
                    <p className="record-meta">Receiver: {collaboration.receiver_name} <span>(user #{collaboration.receiver_id})</span></p>
                    <p>{collaboration.message || "No message included."}</p>
                    <time className="record-time">{new Date(collaboration.created_at).toLocaleString()}</time>
                    {incoming && collaboration.status === "pending" && <div className="record-actions"><button type="button" disabled={busy} onClick={() => void respond(collaboration.collaboration_id, "accepted")}>Accept</button><button className="button-secondary" type="button" disabled={busy} onClick={() => void respond(collaboration.collaboration_id, "rejected")}>Reject</button></div>}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}