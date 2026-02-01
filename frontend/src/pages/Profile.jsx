import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User, ArrowLeft, LayoutDashboard, Eye, EyeOff } from "lucide-react";
import { authApi } from "../services/api.js";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]";

const labelClass = "block text-sm font-medium text-[var(--text)]";

function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    authApi
      .getMe()
      .then((u) => {
        setUser(u);
        setEditFirst(u.first_name ?? "");
        setEditLast(u.last_name ?? "");
        setEditEmail(u.email ?? "");
      })
      .catch(() => navigate("/", { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileSaving(true);
    try {
      const updated = await authApi.updateProfile({
        first_name: editFirst || null,
        last_name: editLast || null,
        email: editEmail.trim() || undefined,
      });
      setUser(updated);
      setProfileSuccess(t("profile.profileUpdated"));
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err) {
      setProfileError(err.message || t("common.errorGeneric"));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t("auth.passwordMin6"));
      return;
    }
    setPasswordSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordSuccess(t("profile.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (err) {
      setPasswordError(err.message || t("common.errorGeneric"));
    } finally {
      setPasswordSaving(false);
    }
  };

  const goDashboard = () => {
    if (user?.role === "admin") navigate("/dashboard/admin");
    else if (user?.role === "teacher") navigate("/dashboard/teacher");
    else navigate("/dashboard/student");
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  if (!user) return null;


  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("profile.backToHome")}
        </button>
        <button
          type="button"
          onClick={goDashboard}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <LayoutDashboard className="h-4 w-4" />
          {t("profile.goToDashboard")}
        </button>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--border)] text-[var(--text-muted)]">
          <User className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{t("profile.title")}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t("profile.subtitle")}</p>
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-lg font-medium text-[var(--text)]">{t("profile.info")}</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              {t("profile.username")}
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--text)]">{user.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              {t("profile.role")}
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--text)]">{t(`profile.roles.${user.role}`)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              {t("profile.memberSince")}
            </dt>
            <dd className="mt-0.5 text-[var(--text)]">{formatDate(user.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-lg font-medium text-[var(--text)]">{t("profile.editProfile")}</h2>
        {profileError && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            {profileSuccess}
          </div>
        )}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label htmlFor="profile-first" className={labelClass}>
              {t("profile.firstName")}
            </label>
            <input
              id="profile-first"
              type="text"
              value={editFirst}
              onChange={(e) => setEditFirst(e.target.value)}
              className={inputClass}
              placeholder={t("auth.optional")}
            />
          </div>
          <div>
            <label htmlFor="profile-last" className={labelClass}>
              {t("profile.lastName")}
            </label>
            <input
              id="profile-last"
              type="text"
              value={editLast}
              onChange={(e) => setEditLast(e.target.value)}
              className={inputClass}
              placeholder={t("auth.optional")}
            />
          </div>
          <div>
            <label htmlFor="profile-email" className={labelClass}>
              {t("profile.email")}
            </label>
            <input
              id="profile-email"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className={inputClass}
              placeholder={t("auth.emailPlaceholder")}
            />
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {profileSaving ? t("profile.savingProfile") : t("profile.saveProfile")}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 text-lg font-medium text-[var(--text)]">{t("profile.changePassword")}</h2>
        {passwordError && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            {passwordSuccess}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="profile-current-pw" className={labelClass}>
              {t("profile.currentPassword")}
            </label>
            <div className="relative">
              <input
                id="profile-current-pw"
                type={showCurrentPw ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label={showCurrentPw ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="profile-new-pw" className={labelClass}>
              {t("profile.newPassword")}
            </label>
            <div className="relative">
              <input
                id="profile-new-pw"
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                aria-label={showNewPw ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="profile-confirm-pw" className={labelClass}>
              {t("profile.confirmPassword")}
            </label>
            <input
              id="profile-confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              minLength={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {passwordSaving ? t("profile.submittingPassword") : t("profile.submitPassword")}
          </button>
        </form>
      </section>
    </div>
  );
}
