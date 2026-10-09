"use client";

import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/app/components/useCurrentUser";

export default function Dashboard() {
  const router = useRouter();
  const { user, loaded } = useCurrentUser();

  function logout() {
    localStorage.removeItem("user");
    router.replace("/");
  }

  if (!loaded || !user) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-container">
          <p className="dashboard-subtitle">Checking your session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <h1>Research Collaboration Dashboard</h1>

        <p className="dashboard-subtitle">
          Welcome to your research workspace
        </p>

        <div className="dashboard-grid">
          <a className="dashboard-card" href="/profile">
            <h2>👤 Profile</h2>
            <p>View and manage your account details.</p>
          </a>

          <a className="dashboard-card" href="/bookmarks">
            <h2>🔖 Bookmarks</h2>
            <p>View your bookmarked research papers.</p>
          </a>

          <a className="dashboard-card" href="/collaborations">
            <h2>🤝 Collaborations</h2>
            <p>Manage your collaboration requests.</p>
          </a>

          <a className="dashboard-card" href="/comments">
            <h2>💬 Comments</h2>
            <p>View and manage your paper comments.</p>
          </a>

          <a className="dashboard-card" href="/ratings">
            <h2>⭐ Ratings</h2>
            <p>View your paper ratings and reviews.</p>
          </a>
        </div>

        <button className="logout-button" onClick={logout}>
          Logout
        </button>
      </div>
    </main>
  );
}