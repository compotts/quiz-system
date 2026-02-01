import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import AuthModal from "../components/AuthModal.jsx";

const FEATURE_KEYS = [
  "quizzes",
  "groups",
  "attempts",
  "stats",
  "themes",
  "responsive",
];

export default function Home() {
  const { t } = useTranslation();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="absolute inset-0 bg-[var(--bg-elevated)]" />
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-25"
          style={{
            backgroundImage: `radial-gradient(circle at center, var(--border) 1.5px, transparent 1.5px)`,
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,var(--bg)_100%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-8 flex items-center justify-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t("home.firstRequestWarning")}</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl lg:tracking-tighter">
            {t("common.appName")}
          </h1>
          <p className="mt-5 text-lg text-[var(--text-muted)] sm:text-xl">
            {t("home.tagline")}
          </p>
          <div className="mt-10 flex flex-col items-center gap-3">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--accent)] px-6 py-3 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 hover:scale-105 hover:shadow-[var(--shadow-md)]"
            >
              {t("home.login")}
            </button>
            <Link
              to="/blog"
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] hover:underline"
            >
              {t("home.devBlog")}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-lg font-semibold tracking-tight text-[var(--text)] sm:text-xl">
            {t("home.aboutTitle")}
          </h2>
          <p className="mt-5 text-center leading-relaxed text-[var(--text-muted)]">
            {t("home.about1")}
          </p>
          <p className="mt-4 text-center leading-relaxed text-[var(--text-muted)]">
            {t("home.about2")}
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-lg font-semibold tracking-tight text-[var(--text)] sm:text-xl">
            {t("home.featuresTitle")}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_KEYS.map((key) => (
              <li
                key={key}
                className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] transition-all duration-200 hover:border-[var(--border)] hover:shadow-[var(--shadow-md)]"
              >
                <span className="font-medium text-[var(--text)]">
                  {t(`home.features.${key}.title`)}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-[var(--text-muted)]">
                  {t(`home.features.${key}.desc`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text)] sm:text-xl">
            {t("home.howToStartTitle")}
          </h2>
          <p className="mt-5 leading-relaxed text-[var(--text-muted)]">
            {t("home.howToStart")}
          </p>
        </div>
      </section>
    </div>
  );
}
