import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Loader2, Trash2 } from "lucide-react";
import { adminApi } from "../services/api.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function UserDetailsModal({ isOpen, onClose, userId, onSaved }) {
  const { t } = useTranslation();
  const [userDetails, setUserDetails] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [form, setForm] = useState({ username: "", email: "", first_name: "", last_name: "" });
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    setUserDetails(null);
    setUserGroups([]);
    setLoadError("");
    setSaveError("");
    (async () => {
      try {
        const [u, groups] = await Promise.all([
          adminApi.getUserDetails(userId),
          adminApi.getUserGroups(userId),
        ]);
        setUserDetails(u);
        setUserGroups(groups || []);
        setForm({
          username: u.username || "",
          email: u.email || "",
          first_name: u.first_name || "",
          last_name: u.last_name || "",
        });
      } catch (err) {
        setLoadError(err.message || t("admin.errorLoadUserDetails"));
      }
    })();
  }, [isOpen, userId, t]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  const handleRemoveAvatar = async () => {
    if (!userId) return;
    setDeletingAvatar(true);
    try {
      const u = await adminApi.deleteUserAvatar(userId);
      setUserDetails(u);
      onSaved?.();
    } catch (err) {
      setSaveError(err.message || t("admin.errorUpdateUserDetails"));
    } finally {
      setDeletingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaveError("");
    setSaving(true);
    try {
      const u = await adminApi.updateUserDetails(userId, {
        username: form.username || null,
        email: form.email || null,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
      });
      setUserDetails(u);
      setForm({
        username: u.username || "",
        email: u.email || "",
        first_name: u.first_name || "",
        last_name: u.last_name || "",
      });
      onSaved?.();
      handleClose();
    } catch (err) {
      setSaveError(err.message || t("admin.errorUpdateUserDetails"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        className={`relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] transition-all duration-300 ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">{t("admin.userDetails")}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4 space-y-4">
          {loadError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {loadError}
            </p>
          )}
          {!userDetails && !loadError && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
            </div>
          )}
          {userDetails && (
            <>
              {userDetails.avatar_url && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                  <img
                    src={`${API_BASE}${userDetails.avatar_url}`}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover border border-[var(--border)]"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text-muted)]">{t("profile.avatar")}</p>
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={deletingAvatar}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {deletingAvatar ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {t("profile.removeAvatar")}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 text-sm">
                <p><span className="text-[var(--text-muted)]">ID:</span> {userDetails.id}</p>
                <p>
                  <span className="text-[var(--text-muted)]">{t("admin.registrationIp")}:</span>{" "}
                  {userDetails.registration_ip || "—"}
                </p>
              </div>
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{t("admin.userGroups")}</p>
                {userGroups.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">{t("admin.noUserGroups")}</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {userGroups.map((g) => (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
                      >
                        <span className="font-medium text-[var(--text)]">{g.name}</span>
                        <span className="text-[var(--text-muted)]">({t("teacher.groups.code")}: {g.code})</span>
                        {g.teacher_name && (
                          <span className="text-xs text-[var(--text-muted)]">— {g.teacher_name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--text)]">{t("admin.editUserDetails")}</p>
                {saveError && (
                  <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                    {saveError}
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">{t("auth.username")}</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--text-muted)] focus:outline-none"
                    placeholder={t("auth.usernamePlaceholder")}
                    minLength={3}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">{t("auth.email")}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--text-muted)] focus:outline-none"
                    placeholder={t("auth.emailPlaceholder")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">{t("auth.firstName")}</label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--text-muted)] focus:outline-none"
                    placeholder={t("auth.firstName")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">{t("auth.lastName")}</label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--text-muted)] focus:outline-none"
                    placeholder={t("auth.lastName")}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--border)]"
                  >
                    {t("common.close")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
