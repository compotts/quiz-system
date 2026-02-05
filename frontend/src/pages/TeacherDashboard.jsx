import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  Copy,
  Users,
} from "lucide-react";
import { authApi, groupsApi } from "../services/api.js";

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [groups, setGroups] = useState([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formColor, setFormColor] = useState("#6366f1");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let ignore = false;
    authApi.getMe().then((u) => {
      if (ignore) return;
      setCurrentUser(u);
      if (u.role !== "teacher" && u.role !== "admin") navigate("/", { replace: true });
    }).catch(() => navigate("/", { replace: true }));
    return () => { ignore = true; };
  }, [navigate]);

  const loadGroups = async () => {
    try {
      const data = await groupsApi.getGroups();
      setGroups(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || t("teacher.groups.errorLoad"));
    }
  };

  useEffect(() => {
    if (!currentUser || (currentUser.role !== "teacher" && currentUser.role !== "admin")) return;
    setLoading(true);
    loadGroups().finally(() => setLoading(false));
  }, [currentUser]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    try {
      await groupsApi.createGroup({
        name: formName.trim(),
        subject: formSubject.trim() || null,
        color: formColor,
      });
      setFormName("");
      setFormSubject("");
      setFormColor("#6366f1");
      setShowCreateModal(false);
      await loadGroups();
    } catch (err) {
      setError(err.message || t("teacher.groups.errorCreate"));
    } finally {
      setCreating(false);
    }
  };

  const copyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
  };

  if (!currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
                {t("teacher.dashboardTitle")}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {t("teacher.welcome", { name: currentUser.first_name || currentUser.username })}
              </p>
            </div>
            <button
              onClick={loadGroups}
              disabled={loading}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
              title={t("common.refresh")}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button onClick={() => setError("")} className="ml-auto">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => navigate(`/dashboard/teacher/group/${g.id}`)}
                  className="group relative text-left rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:shadow-md hover:border-[var(--accent)]/30"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
                    style={{ backgroundColor: g.color || "#6366f1" }}
                  />
                  
                  <div className="pt-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
                        {g.name}
                      </h3>
                      <button
                        onClick={(e) => copyCode(g.code, e)}
                        className="rounded p-1 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--border)] transition-opacity"
                        title={t("teacher.groups.copyCode")}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {g.subject && (
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{g.subject}</p>
                    )}
                    
                    <div className="mt-3 flex items-center gap-3 text-sm text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {g.member_count ?? 0}
                      </span>
                      <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-xs font-mono">
                        {g.code}
                      </span>
                    </div>
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-8 text-[var(--text-muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5"
              >
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">{t("teacher.groups.createGroup")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("teacher.groups.createGroup")}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groups.createPlaceholder")}</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("teacher.groups.createPlaceholder")}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  required
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groups.subject")}</label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder={t("teacher.groups.subjectPlaceholder")}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groups.color")}</label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                  />
                  <div className="flex gap-2">
                    {["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#6b7280"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormColor(color)}
                        className={`h-6 w-6 rounded-full border-2 transition-all ${
                          formColor === color ? "border-[var(--text)] scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
                >
                  {creating ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("teacher.groups.create")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
