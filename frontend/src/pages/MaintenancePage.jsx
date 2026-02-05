import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Wrench, LogIn } from "lucide-react";
import AuthModal from "../components/AuthModal.jsx";

const BANNER_STYLE_CLASSES = {
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
};

export default function MaintenancePage({ siteStatus, backendUnavailable, onLoginSuccess }) {
  const { t } = useTranslation();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const bannerStyle =
    BANNER_STYLE_CLASSES[siteStatus?.home_banner_style] || BANNER_STYLE_CLASSES.warning;
  const showBanner = !backendUnavailable && siteStatus?.home_banner_text?.trim();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        registrationEnabled={false}
        onLoginSuccess={onLoginSuccess}
      />
      {showBanner && (
        <div
          className={`border-b px-4 py-3 text-center text-sm font-medium sm:px-6 ${bannerStyle}`}
          role="alert"
        >
          {siteStatus.home_banner_text}
        </div>
      )}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 dark:border-amber-400/30 dark:bg-amber-500/15">
              <Wrench className="h-12 w-12 text-amber-600 dark:text-amber-400" aria-hidden />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">
            {backendUnavailable ? t("home.unavailableTitle") : t("home.maintenanceTitle")}
          </h1>
          <p className="mt-4 text-[var(--text-muted)]">
            {backendUnavailable ? t("home.unavailableMessage") : t("home.maintenanceMessage")}
          </p>
          {!backendUnavailable && (
            <p className="mt-2 text-sm text-[var(--text-muted)]">{t("home.maintenanceAdminHint")}</p>
          )}
          {!backendUnavailable && (
            <div className="mt-8">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--accent)] px-6 py-3 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 hover:scale-[1.02]"
              >
                <LogIn className="h-4 w-4" />
                {t("home.login")}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
