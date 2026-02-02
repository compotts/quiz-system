import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Loader2 } from "lucide-react";
import { contactApi, authApi } from "../services/api.js";

const ALL_SECTIONS = [
  { id: "faq", labelKey: "info.navFaq" },
  { id: "privacy", labelKey: "info.navPrivacy" },
  { id: "terms", labelKey: "info.navTerms" },
  { id: "contact", labelKey: "info.navContact" },
];

const FAQ_IDS = ["1", "2", "3", "4", "5"];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="font-medium text-[var(--text)]">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-96 pb-4" : "max-h-0"
        }`}
      >
        <p className="text-[var(--text-muted)]">{a}</p>
      </div>
    </div>
  );
}

export default function Info() {
  const { t } = useTranslation();
  const [contactEnabled, setContactEnabled] = useState(true);
  const [activeSection, setActiveSection] = useState("faq");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState("");

  useEffect(() => {
    authApi.getRegistrationSettings().then((data) => {
      setContactEnabled(data.contact_enabled !== false);
    }).catch(() => setContactEnabled(true));
  }, []);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactMessage.trim()) return;

    setContactLoading(true);
    setContactError("");

    try {
      await contactApi.sendMessage(contactMessage);
      setContactSent(true);
      setContactMessage("");
      setTimeout(() => setContactSent(false), 5000);
    } catch (err) {
      setContactError(err.message || t("info.contactError"));
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto py-3 sm:gap-2">
            {ALL_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                }`}
              >
                {t(section.labelKey)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 bg-[var(--bg)] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {activeSection === "faq" && (
            <section>
              <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">
                {t("info.faqTitle")}
              </h1>
              <p className="mt-2 text-[var(--text-muted)]">{t("info.faqIntro")}</p>
              <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6">
                {FAQ_IDS.map((id) => (
                  <FAQItem
                    key={id}
                    q={t(`info.faqItems.q${id}`)}
                    a={t(`info.faqItems.a${id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {activeSection === "privacy" && (
            <section>
              <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">
                {t("info.navPrivacy")}
              </h1>
              <p className="mt-2 text-[var(--text-muted)]">{t("info.lastUpdated")}</p>
              <div className="mt-8 space-y-6 text-[var(--text-muted)]">
                {["1", "2", "3", "4"].map((n) => (
                  <div key={n}>
                    <h2 className="font-medium text-[var(--text)]">
                      {t(`info.privacyContent.h${n}`)}
                    </h2>
                    <p className="mt-2">{t(`info.privacyContent.p${n}`)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === "terms" && (
            <section>
              <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">
                {t("info.navTerms")}
              </h1>
              <p className="mt-2 text-[var(--text-muted)]">{t("info.lastUpdated")}</p>
              <div className="mt-8 space-y-6 text-[var(--text-muted)]">
                {["1", "2", "3", "4", "5"].map((n) => (
                  <div key={n}>
                    <h2 className="font-medium text-[var(--text)]">
                      {t(`info.termsContent.h${n}`)}
                    </h2>
                    <p className="mt-2">{t(`info.termsContent.p${n}`)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === "contact" && (
            <section>
              <h1 className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">
                {t("info.contactTitle")}
              </h1>
              {contactEnabled ? (
                <>
                  <p className="mt-2 text-[var(--text-muted)]">{t("info.contactIntro")}</p>
                  <form
                    onSubmit={handleContactSubmit}
                    className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"
                  >
                    <label
                      htmlFor="contact-message"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      {t("info.message")}
                    </label>
                    <textarea
                      id="contact-message"
                      rows={5}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                      placeholder={t("info.messagePlaceholder")}
                    />
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {t("info.contactDisclaimer")}
                    </p>

                    {contactError && (
                      <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                        {contactError}
                      </div>
                    )}

                    {contactSent && (
                      <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                        {t("info.contactSent")}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!contactMessage.trim() || contactLoading}
                      className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {contactLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {contactLoading ? t("info.contactSending") : t("info.contactSubmit")}
                    </button>
                  </form>
                </>
              ) : (
                <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-[var(--text-muted)] dark:border-amber-400/30 dark:bg-amber-500/15">
                  <p className="font-medium text-[var(--text)]">{t("info.contactDisabled")}</p>
                  <p className="mt-2 text-sm">{t("info.contactDisabledDesc")}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
