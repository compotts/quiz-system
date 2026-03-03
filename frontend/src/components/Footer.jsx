import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, HelpCircle, Shield, Mail } from "lucide-react";

const FOOTER_LINKS = [
  { to: "/", icon: Home, labelKey: "footer.home" },
  { to: "/info#faq", icon: HelpCircle, labelKey: "footer.faq" },
  { to: "/info#privacy", icon: Shield, labelKey: "footer.policy" },
  { to: "/info#contact", icon: Mail, labelKey: "footer.contact" },
];

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto border-t border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors duration-200"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3 text-sm text-[var(--text-muted)] sm:justify-between sm:px-6 lg:px-8">
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-[var(--text)]">{t("common.appName")}</span>
          <span aria-hidden>·</span>
          <span>© {year}</span>
        </span>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end"
          aria-label="Footer navigation"
        >
          {FOOTER_LINKS.map(({ to, icon: Icon, labelKey }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-1.5 transition-colors hover:text-[var(--text)]"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{t(labelKey)}</span>
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
