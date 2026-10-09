"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function Register() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    const data = {
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    };

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage("Registration successful! You can now login.");
        event.currentTarget.reset();
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-box">
        <h1>Create Account</h1>

        <p className="subtitle">
          Join the Research Collaboration System
        </p>

        <form onSubmit={handleSubmit}>
          <label>Full Name</label>
          <input
            type="text"
            name="full_name"
            placeholder="Enter your full name"
            required
          />

          <label>Email</label>
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            required
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Create a password"
            minLength={6}
            required
          />

          <label>Role</label>
          <select name="role" required>
            <option value="student">Student</option>
            <option value="researcher">Researcher</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {message && (
          <p className="register-text">
            {message}
          </p>
        )}

        <p className="register-text">
          Already have an account?{" "}
          <Link href="/">Login</Link>
        </p>
      </div>
    </main>
  );
}