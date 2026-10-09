"use client";

import { useCurrentUser } from "@/app/components/useCurrentUser";
import Link from "next/link";

export default function Profile() {
  const { user, loaded } = useCurrentUser();

  if (!loaded || !user) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-container">
          <h1>Profile</h1>
          <p className="dashboard-subtitle">
            {loaded ? "Please log in to view your profile." : "Loading profile..."}
          </p>
          {loaded && <Link className="back-button" href="/">Go to Login</Link>}
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <h1>👤 My Profile</h1>

        <div className="profile-card">
          <h2>{user.full_name}</h2>

          <div className="profile-detail">
            <strong>User ID:</strong>
            <span>{user.user_id}</span>
          </div>

          <div className="profile-detail">
            <strong>Email:</strong>
            <span>{user.email}</span>
          </div>

          <div className="profile-detail">
            <strong>Role:</strong>
            <span>{user.role}</span>
          </div>

          <a href="/dashboard" className="back-button">
            Back to Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}