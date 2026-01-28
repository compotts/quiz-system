import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto border-t border-[var(--border)] bg-[var(--surface)] py-4 text-[var(--text)] transition-colors duration-200"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-sm text-[var(--text-muted)] sm:justify-between sm:px-6 lg:px-8">
        <span>
          <span className="font-medium text-[var(--text)]">{t("common.appName")}</span>
          <span className="mx-2" aria-hidden>·</span>
          <span>© {year}</span>
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to="/" className="transition-colors hover:text-[var(--text)]">
            {t("footer.home")}
          </Link>
          <Link to="/info" className="transition-colors hover:text-[var(--text)]">
            {t("footer.faq")}
          </Link>
          <Link to="/info" className="transition-colors hover:text-[var(--text)]">
            {t("footer.policy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
