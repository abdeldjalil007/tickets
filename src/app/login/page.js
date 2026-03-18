"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError("Username and password are required.");
      return;
    }

    setIsLoading(true);

    const result = await signIn("credentials", {
      username: normalizedUsername,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setIsLoading(false);

    if (result?.error) {
      setError("Invalid username or password.");
      return;
    }

    router.push(result?.url || "/dashboard");
  };

  return (
    <main className="page-wrap flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="panel w-full max-w-md p-7 sm:p-8"
      >
        <p className="muted text-sm">Operations Console</p>
        <h1 className="title mt-1 mb-6">Login</h1>

        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          className="field mb-4"
          placeholder="Enter your username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="field"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <p className="status-error mt-3">{error}</p> : null}

        <button className="btn btn-primary mt-6 w-full" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Login"}
        </button>
      </form>
    </main>
  );
}