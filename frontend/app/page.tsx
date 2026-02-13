"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type ApiResponse = {
  affirmation?: string;
  message?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function HomePage() {
  const [name, setName] = useState("");
  const [feeling, setFeeling] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const canSubmit = useMemo(() => {
    return !loading && name.trim().length > 0 && feeling.trim().length > 1;
  }, [name, feeling, loading]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult("");

    if (!canSubmit) {
      setError("Please enter your name and how you're feeling.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/affirmation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          feeling: feeling.trim(),
          details: details.trim() || undefined
        })
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(data.message || "Something went wrong. Please try again.");
      }

      if (!data.affirmation) {
        throw new Error("No affirmation was returned.");
      }

      setResult(data.affirmation);
    } catch (unknownError) {
      const fallback = "Unable to generate your affirmation right now.";
      const message =
        unknownError instanceof Error && unknownError.message ? unknownError.message : fallback;
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <h1 className={styles.title}>Affirmly</h1>
        <p className={styles.subtitle}>
          Enter your name and current mood to generate a personalized therapeutic affirmation.
        </p>

        <form onSubmit={onSubmit} className={styles.form} noValidate>
          <label className={styles.label} htmlFor="name">
            Your Name
            <input
              className={styles.input}
              id="name"
              name="name"
              maxLength={60}
              autoComplete="given-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g., Alex"
              required
            />
          </label>

          <label className={styles.label} htmlFor="feeling">
            How Are You Feeling?
            <input
              className={styles.input}
              id="feeling"
              name="feeling"
              maxLength={280}
              value={feeling}
              onChange={(event) => setFeeling(event.target.value)}
              placeholder="e.g., anxious about an interview"
              required
            />
          </label>

          <label className={styles.label} htmlFor="details">
            Extra Details (Optional)
            <textarea
              className={styles.textarea}
              id="details"
              name="details"
              maxLength={500}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Anything else you'd like the affirmation to reflect..."
            />
          </label>

          <button className={styles.button} type="submit" disabled={!canSubmit}>
            {loading ? "Generating..." : "Generate Affirmation"}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
        {result && <p className={styles.result}>{result}</p>}
      </section>
    </main>
  );
}
