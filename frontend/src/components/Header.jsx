import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../hooks/useTheme.js";
import { useLanguage } from "../hooks/useLanguage.js";
import { Moon, Sun } from "lucide-react";
import { getAccessToken } from "../services/api.js";
import UserMenu from "./UserMenu.jsx";

export default function Header() {
  const { t } = useTranslation();
  const { isDark, toggle } = useTheme();
  const { lang, setLang, langs } = useLanguage();
  const isAuth = !!getAccessToken();

  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/80 text-[var(--text)] backdrop-blur-md transition-colors duration-200"
      role="banner"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="text-lg font-semibold tracking-tight text-[var(--text)] hover:opacity-80 sm:text-xl"
        >
          {t("common.appName")}
        </Link>

        <div className="flex items-center gap-1">
          <div
            className="flex rounded-xl border border-[var(--border)] p-0.5"
            role="group"
            aria-label={t("header.lang")}
          >
            {langs.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                  lang === l.code
                    ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          {isAuth && <UserMenu />}
          <button
            type="button"
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--bg-elevated)]"
            aria-label={isDark ? t("header.themeLight") : t("header.themeDark")}
          >
            {isDark ? (
              <Sun className="h-5 w-5" aria-hidden />
            ) : (
              <Moon className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
