"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getSurfaceById, normalizeSurfaceValue } from "@/lib/surfaces";

const getTicketDraftKey = (username) => `ticket:${username}`;
const TICKET_ADDED_SUCCESS_KEY = "ticket:add:success";

export default function Confirm() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="page-wrap flex items-center justify-center">
        <div className="panel p-6 muted">Loading session...</div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  const username = session?.user?.name || "User";
  return <ConfirmContent key={username} username={username} />;
}

function ConfirmContent({ username }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [surfaces, setSurfaces] = useState([]);
  const storageKey = getTicketDraftKey(username);

  const [data] = useState(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });
  useEffect(() => {
    let isMounted = true;

    const loadSurfaces = async () => {
      try {
        const response = await fetch("/api/surfaces", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok || !isMounted) {
          return;
        }

        setSurfaces(Array.isArray(result.data) ? result.data : []);
      } catch {
        if (isMounted) {
          setSurfaces([]);
        }
      }
    };

    loadSurfaces();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedSurface = getSurfaceById(normalizeSurfaceValue(data?.surface), surfaces);

  const submit = async () => {
    if (!data) {
      setSubmitError("No ticket draft found. Please create one from dashboard.");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    setIsSubmitting(false);

    if (res.ok) {
      window.localStorage.removeItem(storageKey);
      window.sessionStorage.setItem(TICKET_ADDED_SUCCESS_KEY, "1");
      router.push("/dashboard");
    } else {
      setSubmitError(result.error || "Failed to confirm ticket.");
    }
  };

  if (!data) {
    return (
      <main className="page-wrap flex items-center justify-center">
        <section className="panel w-full max-w-xl p-7">
          <h1 className="title mb-3">No Draft Ticket</h1>
          <p className="muted mb-5">Create a draft ticket first from the dashboard.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-primary"
            type="button"
          >
            Back to Dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <section className="panel p-6 sm:p-8">
        <p className="muted text-sm">Welcome, {username}</p>
        <h1 className="title mt-1 mb-6">Confirm Ticket</h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="muted text-sm">Date</p>
            <p className="font-semibold">{data.date}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="muted text-sm">Number</p>
            <p className="font-semibold">{data.number}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="muted text-sm">Surface</p>
            <p className="font-semibold">{selectedSurface ? selectedSurface.name : data.surface}</p>
          </article>
        </div>

        {submitError ? <p className="status-error mt-5">{submitError}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-ghost"
            type="button"
            disabled={isSubmitting}
          >
            Modify
          </button>

          <button
            onClick={submit}
            className="btn btn-primary"
            type="button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Confirm Ticket"}
          </button>
        </div>
      </section>
    </main>
  );
}