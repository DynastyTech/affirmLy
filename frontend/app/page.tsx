"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type ApiResponse = {
  affirmation?: string;
  message?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const THEME_STORAGE_KEY = "affirmly-theme";
const REQUEST_TIMEOUT_MS = 20000;

type Theme = "light" | "dark";

export default function HomePage() {
  const [name, setName] = useState("");
  const [feeling, setFeeling] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [isWelcoming, setIsWelcoming] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme: Theme = saved === "dark" || saved === "light" ? saved : preferredDark ? "dark" : "light";
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeoutId = window.setTimeout(() => setIsWelcoming(false), reducedMotion ? 1400 : 2400);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const canSubmit = useMemo(() => {
    return !loading && name.trim().length > 0 && feeling.trim().length > 1;
  }, [name, feeling, loading]);

  function toggleTheme() {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }

  if (isWelcoming) {
    return (
      <main className={styles.splashScreen}>
        <section className={styles.splashCard} aria-live="polite">
          <div className={styles.logoRing} aria-hidden="true">
            <span className={styles.logoCore}>a</span>
          </div>
          <p className={styles.splashText}>
            Welcome to affirmLy, your daily personalized affirmations
          </p>
        </section>
      </main>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult("");
    setIsModalOpen(false);

    if (!canSubmit) {
      setError("Please enter your name and how you're feeling.");
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}/api/affirmation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          name: name.trim(),
          feeling: feeling.trim(),
          details: details.trim() || undefined
        })
      });

      const rawText = await response.text();
      let data: ApiResponse = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as ApiResponse;
        } catch {
          if (response.ok) {
            throw new Error("Unexpected response format from the server.");
          }
        }
      }

      if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status}).`);
      }

      if (!data.affirmation) {
        throw new Error("No affirmation was returned.");
      }

      setResult(data.affirmation);
      setIsModalOpen(true);
    } catch (unknownError) {
      if (unknownError instanceof DOMException && unknownError.name === "AbortError") {
        setError("Request timed out. Please try again.");
        return;
      }
      const fallback = "Unable to generate your affirmation right now.";
      const message =
        unknownError instanceof Error && unknownError.message ? unknownError.message : fallback;
      setError(message);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <header className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Affirmly</h1>
            <p className={styles.subtitle}>
              Enter your name and current mood to generate a personalized therapeutic affirmation.
            </p>
          </div>
          <button
            type="button"
            className={styles.themeButton}
            onClick={toggleTheme}
            aria-label="Toggle light and dark mode"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
          </button>
        </header>

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

        <footer className={styles.footer}>
          Designed and developed by{" "}
          <a
            href="https://www.dynastytech.co.za/"
            target="_blank"
            rel="noreferrer noopener"
            className={styles.footerLink}
          >
            DynastyTech
          </a>
        </footer>
      </section>

      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="affirmation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="affirmation-title" className={styles.modalTitle}>
                Your Affirmation
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsModalOpen(false)}
                aria-label="Close affirmation popup"
              >
                x
              </button>
            </div>
            <p className={styles.modalContent}>{result}</p>
          </section>
        </div>
      )}
    </main>
  );
}
