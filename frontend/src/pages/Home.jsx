import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Wrench,
  LogIn,
  BookOpen,
  ClipboardList,
  Users,
  BarChart3,
  TrendingUp,
  Palette,
  Smartphone,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import AuthModal from "../components/AuthModal.jsx";
import { authApi } from "../services/api.js";

const FEATURES = [
  { key: "quizzes", icon: ClipboardList, color: "emerald" },
  { key: "groups", icon: Users, color: "blue" },
  { key: "attempts", icon: BarChart3, color: "violet" },
  { key: "stats", icon: TrendingUp, color: "amber" },
  { key: "themes", icon: Palette, color: "rose" },
  { key: "responsive", icon: Smartphone, color: "cyan" },
];

const COLOR_CLASSES = {
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/20",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/20",
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/20",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/20",
  cyan: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
};

export default function Home() {
  const { t } = useTranslation();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [siteStatus, setSiteStatus] = useState({ maintenance_mode: false, registration_enabled: true });
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    authApi
      .getRegistrationSettings()
      .then((data) => {
        setSiteStatus({
          maintenance_mode: !!data.maintenance_mode,
          registration_enabled: data.registration_enabled !== false,
        });
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  const maintenanceMode = siteStatus.maintenance_mode;

  if (!statusLoading && maintenanceMode) {
    return (
      <div className="flex flex-1 flex-col">
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} registrationEnabled={false} />
        <section className="relative flex flex-1 flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-lg text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 dark:border-amber-400/30 dark:bg-amber-500/15">
                <Wrench className="h-12 w-12 text-amber-600 dark:text-amber-400" aria-hidden />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">
              {t("home.maintenanceTitle")}
            </h1>
            <p className="mt-4 text-[var(--text-muted)]">{t("home.maintenanceMessage")}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{t("home.maintenanceAdminHint")}</p>
            <div className="mt-8">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--accent)] px-6 py-3 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 hover:scale-[1.02]"
              >
                <LogIn className="h-4 w-4" />
                {t("home.login")}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        registrationEnabled={siteStatus.registration_enabled}
      />

      <section className="relative overflow-hidden px-4 pt-16 pb-24 sm:px-6 sm:pt-24 sm:pb-32 lg:px-8">
        <div className="absolute inset-0 bg-[var(--bg-elevated)]" />
        <div
          className="absolute inset-0 opacity-60 dark:opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, var(--border) 1px, transparent 1px), radial-gradient(circle at 70% 80%, var(--border) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-300">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t("home.firstRequestWarning")}</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl">
            {t("common.appName")}
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-[var(--text-muted)] sm:text-xl leading-relaxed">
            {t("home.tagline")}
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-[var(--bg-elevated)] shadow-[var(--shadow-md)] transition-all hover:opacity-90 hover:scale-[1.02] hover:shadow-lg"
            >
              <LogIn className="h-4 w-4" />
              {t("home.login")}
            </button>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3.5 text-sm font-medium text-[var(--text)] transition-all hover:bg-[var(--bg-card)] hover:border-[var(--text-muted)]/30"
            >
              <BookOpen className="h-4 w-4" />
              {t("home.devBlog")}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {t("home.aboutTitle")}
          </h2>
          <div className="mt-6 space-y-4 text-center leading-relaxed text-[var(--text-muted)]">
            <p>{t("home.about1")}</p>
            <p>{t("home.about2")}</p>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {t("home.featuresTitle")}
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon, color }) => (
              <li
                key={key}
                className="group flex gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:border-[var(--border)] hover:shadow-[var(--shadow-md)]"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${COLOR_CLASSES[color]}`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[var(--text)]">
                    {t(`home.features.${key}.title`)}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                    {t(`home.features.${key}.desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {t("home.howToStartTitle")}
          </h2>
          <p className="mt-5 leading-relaxed text-[var(--text-muted)]">
            {t("home.howToStart")}
          </p>
          <div className="mt-10">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-[var(--bg-elevated)] transition-all hover:opacity-90 hover:scale-[1.02]"
            >
              {t("home.login")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
