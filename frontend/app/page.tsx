"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type ApiResponse = {
  affirmation?: string;
  message?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const THEME_STORAGE_KEY = "affirmly-theme";
const LANGUAGE_STORAGE_KEY = "affirmly-language";
const REQUEST_TIMEOUT_MS = 20000;
const FEELING_SUGGESTIONS: Record<string, string> = {
  anx: "anxious",
  strs: "stressed",
  dep: "depressed",
  conf: "confused"
};
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
  { code: "la", label: "Latin" },
  { code: "zh", label: "Mandarin" },
  { code: "ru", label: "Russian" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" }
] as const;
const MOOD_CHIPS = [
  "anxious",
  "overwhelmed",
  "tired",
  "stressed",
  "uncertain",
  "hopeful"
] as const;

type Theme = "light" | "dark";
type LanguageCode = (typeof LANGUAGES)[number]["code"];

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
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [languageQuery, setLanguageQuery] = useState("");
  const [suggestedFeeling, setSuggestedFeeling] = useState("");
  const [nameError, setNameError] = useState("");
  const [feelingError, setFeelingError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const modalRef = useRef<HTMLElement | null>(null);
  const closeModalButtonRef = useRef<HTMLButtonElement | null>(null);
  const generateButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

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
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && LANGUAGES.some((entry) => entry.code === savedLanguage)) {
      setLanguage(savedLanguage as LanguageCode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeoutId = window.setTimeout(() => setIsWelcoming(false), reducedMotion ? 1400 : 2400);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const canSubmit = useMemo(() => {
    return !loading && name.trim().length > 0 && feeling.trim().length > 1;
  }, [name, feeling, loading]);

  const filteredLanguages = useMemo(() => {
    const term = languageQuery.trim().toLowerCase();
    if (!term) {
      return LANGUAGES;
    }
    return LANGUAGES.filter((item) => item.label.toLowerCase().includes(term) || item.code.includes(term));
  }, [languageQuery]);

  function toggleTheme() {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }

  function validateNameInput(rawName: string): string {
    const normalized = rawName.trim();
    if (!normalized) {
      return "Please enter your name.";
    }
    if (normalized.length < 2) {
      return "Name must be at least 2 characters.";
    }
    return "";
  }

  function validateFeelingInput(rawFeeling: string): string {
    const normalized = rawFeeling.trim();
    if (!normalized) {
      return "Please describe how you are feeling.";
    }

    if (EMOJI_REGEX.test(normalized)) {
      return "Please use descriptive text instead of emoji for your feeling.";
    }

    const alphaChars = [...normalized].filter((character) => /\p{L}/u.test(character)).length;
    if (alphaChars < 3) {
      return "Please use valid words to describe your feeling.";
    }

    const wordsWithLetters = normalized
      .split(/\s+/)
      .filter((word) => [...word].some((character) => /\p{L}/u.test(character)));
    if (wordsWithLetters.length === 1 && wordsWithLetters[0].length < 5) {
      return "Please be more descriptive, for example: anxious about my presentation.";
    }

    return "";
  }

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    if (previousFocus) {
      lastFocusedElementRef.current = previousFocus;
    }
    window.setTimeout(() => closeModalButtonRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsModalOpen(false);
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }
      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusableElements.length === 0) {
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedElementRef.current?.focus();
    };
  }, [isModalOpen]);

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
    setNameError("");
    setFeelingError("");
    setResult("");
    setIsModalOpen(false);
    setCopyStatus("idle");

    if (!canSubmit) {
      setError("Please enter your name and how you're feeling.");
      return;
    }

    const nameValidationError = validateNameInput(name);
    if (nameValidationError) {
      setNameError(nameValidationError);
      return;
    }

    const shorthand = feeling.trim().toLowerCase();
    const maybeSuggestion = FEELING_SUGGESTIONS[shorthand];
    if (maybeSuggestion && suggestedFeeling !== maybeSuggestion) {
      setSuggestedFeeling(maybeSuggestion);
      setError(`Did you mean "${maybeSuggestion}"?`);
      return;
    }

    const feelingValidationError = validateFeelingInput(feeling);
    if (feelingValidationError) {
      setFeelingError(feelingValidationError);
      setError(feelingValidationError);
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
          details: details.trim() || undefined,
          language
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
      setCopyStatus("idle");
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

  async function copyAffirmation() {
    if (!result) {
      return;
    }
    try {
      await navigator.clipboard.writeText(result);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function generateAnother() {
    setIsModalOpen(false);
    setResult("");
    setError("");
    generateButtonRef.current?.focus();
  }

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <header className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Affirmly</h1>
            <p className={styles.subtitle}>
              Describe your current state and receive a grounded, personalized affirmation.
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
              onChange={(event) => {
                setName(event.target.value);
                setNameError(validateNameInput(event.target.value));
              }}
              placeholder="e.g., Alex"
              required
            />
            <span className={nameError ? styles.fieldError : styles.hint}>
              {nameError || "This helps personalize your affirmation."}
            </span>
          </label>

          <label className={styles.label} htmlFor="feeling">
            How Are You Feeling?
            <div className={styles.chips} role="list" aria-label="Common mood suggestions">
              {MOOD_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={styles.chip}
                  onClick={() => {
                    setFeeling(chip);
                    setSuggestedFeeling("");
                    setFeelingError("");
                    setError("");
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
            <input
              className={styles.input}
              id="feeling"
              name="feeling"
              maxLength={280}
              value={feeling}
              onChange={(event) => {
                const nextFeeling = event.target.value;
                setFeeling(nextFeeling);
                setFeelingError(validateFeelingInput(nextFeeling));
                const maybeSuggestion = FEELING_SUGGESTIONS[nextFeeling.trim().toLowerCase()];
                setSuggestedFeeling(maybeSuggestion ?? "");
              }}
              placeholder="e.g., anxious about an interview and unsure how to prepare"
              required
            />
            <span className={feelingError ? styles.fieldError : styles.hint}>
              {feelingError || "Use descriptive text, not abbreviations or emoji."}
            </span>
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
              placeholder="Optional context, for example: big meeting tomorrow."
            />
          </label>

          <div className={styles.label}>
            Affirmation Language
            <input
              className={styles.input}
              type="search"
              value={languageQuery}
              onChange={(event) => setLanguageQuery(event.target.value)}
              placeholder="Search language..."
              aria-label="Search language options"
            />
            <select
              className={styles.select}
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
              aria-label="Select affirmation language"
            >
              {filteredLanguages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            {!filteredLanguages.length && <span className={styles.hint}>No language matches your search.</span>}
          </div>

          <button ref={generateButtonRef} className={styles.button} type="submit" disabled={!canSubmit}>
            {loading ? (
              <span className={styles.loadingWrap}>
                <span className={styles.spinner} aria-hidden="true" />
                Generating...
              </span>
            ) : (
              "Generate Affirmation"
            )}
          </button>
          <p className={styles.privacyNote}>
            Privacy note: Your input is only used to generate your personalized affirmation.
          </p>
        </form>

        {error && <p className={styles.error}>{error}</p>}
        {suggestedFeeling && (
          <div className={styles.suggestionBox}>
            <p className={styles.suggestionText}>{`Did you mean "${suggestedFeeling}"?`}</p>
            <div className={styles.suggestionActions}>
              <button
                type="button"
                className={styles.suggestionPrimary}
                onClick={() => {
                  setFeeling(suggestedFeeling);
                  setError("");
                  setSuggestedFeeling("");
                }}
              >
                Use suggestion
              </button>
              <button
                type="button"
                className={styles.suggestionSecondary}
                onClick={() => {
                  setSuggestedFeeling("");
                  setError("Please enter a full descriptive feeling.");
                }}
              >
                I&apos;ll edit
              </button>
            </div>
          </div>
        )}

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
            ref={modalRef}
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
                ref={closeModalButtonRef}
                className={styles.closeButton}
                onClick={() => setIsModalOpen(false)}
                aria-label="Close affirmation popup"
              >
                X
              </button>
            </div>
            <p className={styles.modalContent}>{result}</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalActionPrimary} onClick={copyAffirmation}>
                Copy affirmation
              </button>
              <button type="button" className={styles.modalActionSecondary} onClick={generateAnother}>
                Generate another
              </button>
            </div>
            {copyStatus === "copied" && <p className={styles.copyState}>Copied to clipboard.</p>}
            {copyStatus === "failed" && <p className={styles.copyState}>Could not copy. Please copy manually.</p>}
          </section>
        </div>
      )}
    </main>
  );
}
