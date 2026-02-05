import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  User,
  ArrowLeft,
  LayoutDashboard,
  Eye,
  EyeOff,
  Mail,
  AtSign,
  Shield,
  Calendar,
  KeyRound,
  Save,
  Loader2,
  PenLine,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { authApi } from "../services/api.js";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:ring-offset-2 focus:ring-offset-[var(--surface)]";

const labelClass = "block text-sm font-medium text-[var(--text)]";

const ROLE_STYLES = {
  admin: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25",
  teacher: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25",
  student: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
};

const AVATAR_STYLES = {
  admin: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
  teacher: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
  student: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDisplayName(user) {
  const first = (user.first_name || "").trim();
  const last = (user.last_name || "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return user.username;
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
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.student;
  const avatarStyle = AVATAR_STYLES[user.role] || AVATAR_STYLES.student;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Navigation */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--text-muted)]/40 hover:bg-[var(--bg-card)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("profile.backToHome")}
        </button>
        <button
          type="button"
          onClick={goDashboard}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition-all hover:opacity-90"
        >
          <LayoutDashboard className="h-4 w-4" />
          {t("profile.goToDashboard")}
        </button>
      </div>

      {/* Profile header */}
      <header className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)] sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--border)]/30 via-transparent to-transparent" aria-hidden />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 ${avatarStyle}`}
          >
            <User className="h-10 w-10" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              {getDisplayName(user)}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">@{user.username}</p>
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${roleStyle}`}
            >
              <Shield className="h-3.5 w-3.5" />
              {t(`profile.roles.${user.role}`)}
            </span>
          </div>
        </div>
      </header>

      {/* Info card */}
      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--border)]/50 text-[var(--text-muted)]">
            <User className="h-4 w-4" />
          </div>
          {t("profile.info")}
        </h2>
        <ul className="space-y-4">
          <li className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--border)]/40 text-[var(--text-muted)]">
              <AtSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {t("profile.username")}
              </p>
              <p className="font-medium text-[var(--text)]">{user.username}</p>
            </div>
          </li>
          <li className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--border)]/40 text-[var(--text-muted)]">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {t("profile.role")}
              </p>
              <p className="font-medium text-[var(--text)]">{t(`profile.roles.${user.role}`)}</p>
            </div>
          </li>
          <li className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--border)]/40 text-[var(--text-muted)]">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {t("profile.memberSince")}
              </p>
              <p className="font-medium text-[var(--text)]">{formatDate(user.created_at)}</p>
            </div>
          </li>
        </ul>
      </section>

      {/* Edit profile */}
      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--border)]/50 text-[var(--text-muted)]">
            <PenLine className="h-4 w-4" />
          </div>
          {t("profile.editProfile")}
        </h2>
        {profileError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {profileSuccess}
          </div>
        )}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label htmlFor="profile-first" className={`${labelClass} flex items-center gap-2`}>
              <User className="h-4 w-4 text-[var(--text-muted)]" />
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
            <label htmlFor="profile-last" className={`${labelClass} flex items-center gap-2`}>
              <User className="h-4 w-4 text-[var(--text-muted)]" />
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
            <label htmlFor="profile-email" className={`${labelClass} flex items-center gap-2`}>
              <Mail className="h-4 w-4 text-[var(--text-muted)]" />
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
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {profileSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {profileSaving ? t("profile.savingProfile") : t("profile.saveProfile")}
          </button>
        </form>
      </section>

      {/* Change password */}
      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--border)]/50 text-[var(--text-muted)]">
            <KeyRound className="h-4 w-4" />
          </div>
          {t("profile.changePassword")}
        </h2>
        {passwordError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {passwordSuccess}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="profile-current-pw" className={`${labelClass} flex items-center gap-2`}>
              <KeyRound className="h-4 w-4 text-[var(--text-muted)]" />
              {t("profile.currentPassword")}
            </label>
            <div className="relative">
              <input
                id="profile-current-pw"
                type={showCurrentPw ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`${inputClass} pr-11`}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)]/50 hover:text-[var(--text)]"
                aria-label={showCurrentPw ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="profile-new-pw" className={`${labelClass} flex items-center gap-2`}>
              <KeyRound className="h-4 w-4 text-[var(--text-muted)]" />
              {t("profile.newPassword")}
            </label>
            <div className="relative">
              <input
                id="profile-new-pw"
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputClass} pr-11`}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)]/50 hover:text-[var(--text)]"
                aria-label={showNewPw ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="profile-confirm-pw" className={`${labelClass} flex items-center gap-2`}>
              <KeyRound className="h-4 w-4 text-[var(--text-muted)]" />
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
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {passwordSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {passwordSaving ? t("profile.submittingPassword") : t("profile.submitPassword")}
          </button>
        </form>
      </section>
    </div>
  );
}
