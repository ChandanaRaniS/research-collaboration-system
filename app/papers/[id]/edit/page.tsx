"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PaperForm from "../../PaperForm";
import type { PaperRecord } from "../../types";

export default function EditPaperPage() {
  const { id } = useParams<{ id: string }>();
  const [paper, setPaper] = useState<PaperRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/papers/${id}`)
      .then(async (response) => {
        const result = await response.json();
        if (response.ok) setPaper(result.paper);
        else setError(result.message || "Paper not found");
      })
      .catch(() => setError("Unable to load the paper"));
  }, [id]);

  if (error) {
    return (
      <main className="dashboard-page"><div className="dashboard-container">
        <h1>Edit paper</h1><p className="dashboard-subtitle">{error}</p>
        <Link className="back-button" href="/papers">Back to papers</Link>
      </div></main>
    );
  }
  if (!paper) {
    return <main className="dashboard-page"><div className="dashboard-container"><p className="dashboard-subtitle">Loading...</p></div></main>;
  }
  return <PaperForm paper={paper} />;
}
