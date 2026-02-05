import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  ChevronRight,
  BookOpen,
  User,
} from "lucide-react";
import { authApi, groupsApi } from "../services/api.js";

export default function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [groups, setGroups] = useState([]);
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let ignore = false;
    authApi.getMe().then((u) => {
      if (ignore) return;
      setCurrentUser(u);
      if (u.role !== "student") navigate("/", { replace: true });
    }).catch(() => navigate("/", { replace: true }));
    return () => { ignore = true; };
  }, [navigate]);

  const loadGroups = async () => {
    try {
      const data = await groupsApi.getGroups();
      setGroups(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || t("student.groups.errorLoad"));
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") return;
    setLoading(true);
    loadGroups().finally(() => setLoading(false));
  }, [currentUser]);

  const handleJoin = async (e) => {
    e.preventDefault();
    const code = String(joinCode).trim().replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) return;
    setJoining(true);
    setError("");
    try {
      await groupsApi.joinGroup(code);
      setJoinCode("");
      setShowJoinModal(false);
      await loadGroups();
    } catch (err) {
      setError(err.message || t("student.groups.errorJoin"));
    } finally {
      setJoining(false);
    }
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
                {t("student.dashboardTitle")}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {t("student.welcome", { name: currentUser.first_name || currentUser.username })}
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
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-8 text-[var(--text-muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5"
              >
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">{t("student.groups.join")}</span>
              </button>

              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => navigate(`/dashboard/student/groups/${g.id}`)}
                  className="group relative text-left rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-all hover:shadow-md hover:border-[var(--accent)]/30"
                >
                  <div
                    className="h-1.5"
                    style={{ backgroundColor: g.color || "#6366f1" }}
                  />
                  
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
                      {g.name}
                    </h3>
                    
                    <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <User className="h-4 w-4" />
                      {g.teacher_name || `#${g.teacher_id}`}
                    </div>
                    
                    <div className="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <BookOpen className="h-4 w-4" />
                      {g.subject || "—"}
                    </div>
                    
                    <div className="my-3 border-t border-[var(--border)]" />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-muted)]">
                        {g.incomplete_assignments > 0 ? (
                          <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                            {t("student.groups.incompleteAssignments")}: {g.incomplete_assignments}
                          </span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">
                            {t("student.groups.noIncomplete")}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("student.groups.join")}</h2>
              <button
                onClick={() => setShowJoinModal(false)}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groups.code")}</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3 text-center text-2xl font-mono tracking-widest text-[var(--text)]"
                  maxLength={6}
                  autoFocus
                />
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {t("student.groups.joinPlaceholder")}
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={joining || joinCode.replace(/\D/g, "").length !== 6}
                  className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
                >
                  {joining ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("student.groups.joinSubmit")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
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
