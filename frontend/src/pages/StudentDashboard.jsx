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
} from "lucide-react";
import { authApi, groupsApi } from "../services/api.js";

export default function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [groups, setGroups] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

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
    setJoinLoading(true);
    setError("");
    try {
      await groupsApi.joinGroup(code);
      setJoinCode("");
      loadGroups();
    } catch (err) {
      setError(err.message || t("student.groups.errorJoin"));
    } finally {
      setJoinLoading(false);
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

          <form onSubmit={handleJoin} className="mb-6 flex flex-wrap gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("student.groups.joinPlaceholder")}
              className="w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
              maxLength={6}
            />
            <button
              type="submit"
              disabled={joinLoading || String(joinCode).replace(/\D/g, "").length !== 6}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
            >
              {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("student.groups.joinSubmit")}
            </button>
          </form>

          <div className="mb-4 flex gap-2">
            <button
              onClick={loadGroups}
              disabled={loading}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
              title={t("common.refresh")}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
              {t("student.groups.noGroups")}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => navigate(`/dashboard/student/groups/${g.id}`)}
                  className="group text-left rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--bg-card)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--text)]">{g.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        Преподаватель: {g.teacher_name || `#${g.teacher_id}`}
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        Предмет: {g.subject || "—"}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text)]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
