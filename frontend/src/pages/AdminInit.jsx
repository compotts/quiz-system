import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Shield } from "lucide-react";
import { adminApi, authApi, saveTokens } from "../services/api.js";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]";
const labelClass = "block text-sm font-medium text-[var(--text)]";

export default function AdminInit() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [canInit, setCanInit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });

  useEffect(() => {
    let ignore = false;
    async function check() {
      try {
        const ok = await adminApi.canInitialize();
        if (!ignore) setCanInit(ok);
      } catch (err) {
        if (!ignore) setError(err.message || t("adminInit.errorCheck"));
      } finally {
        if (!ignore) setChecking(false);
      }
    }
    check();
    return () => { ignore = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminApi.initializeAdmin(form);
      const { access_token, refresh_token } = await authApi.login(form.username, form.password);
      saveTokens(access_token, refresh_token);
      setSuccess(true);
      setTimeout(() => navigate("/dashboard/admin"), 1200);
    } catch (err) {
      if (err.status === 403) {
        setError(t("adminInit.errorDisabled"));
      } else if (err.status === 400 && (err.message || "").toLowerCase().includes("already")) {
        setError(t("adminInit.errorExists"));
      } else {
        setError(err.message || t("adminInit.errorCreate"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!canInit) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-md)]">
          <Shield className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
          <h1 className="mt-4 text-xl font-semibold text-[var(--text)]">
            {t("adminInit.unavailableTitle")}
          </h1>
          <p className="mt-2 text-[var(--text-muted)]">
            {t("adminInit.unavailableText")}
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-colors hover:opacity-90"
          >
            {t("common.backToHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)] sm:p-8">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-[var(--text-muted)]" />
          <h1 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
            {t("adminInit.title")}
          </h1>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {t("adminInit.intro")}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              {t("adminInit.success")}
            </div>
          )}

          <div>
            <label htmlFor="init-username" className={labelClass}>
              {t("auth.username")}{t("auth.required")}
            </label>
            <input
              id="init-username"
              type="text"
              required
              minLength={3}
              maxLength={100}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputClass}
              placeholder={t("auth.usernameMin")}
            />
          </div>

          <div>
            <label htmlFor="init-email" className={labelClass}>
              {t("auth.email")}{t("auth.required")}
            </label>
            <input
              id="init-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
              placeholder={t("auth.emailPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="init-first-name" className={labelClass}>
                {t("auth.firstName")}{t("auth.required")}
              </label>
              <input
                id="init-first-name"
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className={inputClass}
                placeholder={t("auth.firstName")}
              />
            </div>
            <div>
              <label htmlFor="init-last-name" className={labelClass}>
                {t("auth.lastName")}{t("auth.required")}
              </label>
              <input
                id="init-last-name"
                type="text"
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className={inputClass}
                placeholder={t("auth.lastName")}
              />
            </div>
          </div>

          <div>
            <label htmlFor="init-password" className={labelClass}>
              {t("auth.password")}{t("auth.required")}
            </label>
            <input
              id="init-password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass}
              placeholder={t("auth.passwordMin8")}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t("adminInit.creating") : success ? t("adminInit.done") : t("adminInit.submit")}
          </button>
        </form>

        <p className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            {t("adminInit.backToHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}
