import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  Copy,
  UserMinus,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  RotateCcw,
  Square,
} from "lucide-react";
import { authApi, groupsApi, quizzesApi, attemptsApi } from "../services/api.js";

function formatDate(dateString, locale = "ru-RU") {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeacherGroupPage() {
  const { t, i18n } = useTranslation();
  
  const TABS = [
    { id: "assignments", icon: ClipboardList, label: t("teacher.groupPage.tabs.assignments") },
    { id: "grading", icon: BarChart3, label: t("teacher.groupPage.tabs.grading") },
    { id: "members", icon: Users, label: t("teacher.groupPage.tabs.members") },
    { id: "settings", icon: Settings, label: t("teacher.groupPage.tabs.settings") },
  ];
  
  const locale = i18n.language === "lt" ? "lt-LT" : i18n.language === "en" ? "en-US" : "ru-RU";
  const navigate = useNavigate();
  const { groupId } = useParams();
  const gid = Number(groupId);

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [group, setGroup] = useState(null);
  const [activeTab, setActiveTab] = useState("assignments");

  const [quizzes, setQuizzes] = useState([]);
  const [assignmentFilter, setAssignmentFilter] = useState("active");

  const [members, setMembers] = useState([]);
  const [processingMember, setProcessingMember] = useState(null);

  const [settingsForm, setSettingsForm] = useState({ name: "", subject: "", color: "#6366f1" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [confirmDeleteQuiz, setConfirmDeleteQuiz] = useState(null);
  const [deletingQuiz, setDeletingQuiz] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: "",
    description: "",
    has_quiz_time_limit: false,
    time_limit: null,
    available_until: "",
    manual_close: false,
    allow_show_answers: true,
    anti_cheating_mode: false,
  });
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  useEffect(() => {
    let ignore = false;
    authApi.getMe().then((u) => {
      if (ignore) return;
      setCurrentUser(u);
      if (u.role !== "teacher" && u.role !== "admin") navigate("/", { replace: true });
    }).catch(() => navigate("/", { replace: true }));
    return () => { ignore = true; };
  }, [navigate]);

  const loadGroup = async () => {
    try {
      const g = await groupsApi.getGroup(gid);
      setGroup(g);
      setSettingsForm({ name: g.name, subject: g.subject || "", color: g.color || "#6366f1" });
    } catch (err) {
      setError(err.message || t("common.errorGeneric"));
    }
  };

  const loadQuizzes = async () => {
    try {
      const data = await quizzesApi.getQuizzes(gid);
      setQuizzes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorLoad"));
    }
  };

  const loadMembers = async () => {
    try {
      const data = await groupsApi.getMembers(gid);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t("teacher.groups.errorMembers"));
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    await Promise.all([loadGroup(), loadQuizzes(), loadMembers()]);
    setLoading(false);
  };

  useEffect(() => {
    if (!currentUser || (currentUser.role !== "teacher" && currentUser.role !== "admin")) return;
    loadAll();
  }, [currentUser, gid]);

  const filteredQuizzes = useMemo(() => {
    const now = Date.now();
    return quizzes.filter((q) => {
      const expired = !q.manual_close && q.available_until && new Date(q.available_until).getTime() < now;
      if (assignmentFilter === "active") return !expired;
      return expired;
    });
  }, [quizzes, assignmentFilter]);

  const handleRemoveMember = async (userId) => {
    setProcessingMember(userId);
    try {
      await groupsApi.removeMember(gid, userId);
      await loadMembers();
    } catch (err) {
      setError(err.message || t("teacher.groups.errorRemoveMember"));
    } finally {
      setProcessingMember(null);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await groupsApi.updateGroup(gid, {
        name: settingsForm.name.trim(),
        subject: settingsForm.subject.trim() || null,
        color: settingsForm.color,
      });
      await loadGroup();
      setError("");
    } catch (err) {
      setError(err.message || t("teacher.groups.errorUpdate"));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteGroup = async () => {
    setDeleting(true);
    try {
      await groupsApi.deleteGroup(gid);
      navigate("/dashboard/teacher");
    } catch (err) {
      setError(err.message || t("teacher.groups.errorDelete"));
      setDeleting(false);
    }
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!quizForm.title.trim()) return;
    setCreatingQuiz(true);
    try {
      await quizzesApi.createQuiz({
        group_id: gid,
        title: quizForm.title.trim(),
        description: quizForm.description?.trim() || null,
        has_quiz_time_limit: quizForm.has_quiz_time_limit,
        time_limit: quizForm.has_quiz_time_limit ? quizForm.time_limit : null,
        available_until: quizForm.manual_close ? null : (quizForm.available_until ? new Date(quizForm.available_until).toISOString() : null),
        manual_close: quizForm.manual_close,
        allow_show_answers: quizForm.allow_show_answers,
        anti_cheating_mode: quizForm.anti_cheating_mode,
      });
      setShowQuizModal(false);
      setQuizForm({
        title: "",
        description: "",
        has_quiz_time_limit: false,
        time_limit: null,
        available_until: "",
        manual_close: false,
        allow_show_answers: true,
        anti_cheating_mode: false,
      });
      await loadQuizzes();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorCreate"));
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!confirmDeleteQuiz) return;
    setDeletingQuiz(true);
    setError("");
    try {
      await quizzesApi.deleteQuiz(confirmDeleteQuiz.id);
      setConfirmDeleteQuiz(null);
      await loadQuizzes();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorDelete"));
    } finally {
      setDeletingQuiz(false);
    }
  };

  const copyCode = () => {
    if (group?.code) navigator.clipboard?.writeText(group.code);
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
              <button
                type="button"
                onClick={() => navigate("/dashboard/teacher")}
                className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("teacher.groupPage.backToGroups")}
              </button>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: group?.color || "#6366f1" }}
                />
                <h1 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
                  {group?.name || "Группа"}
                </h1>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <span>{t("teacher.groupPage.groupSubject")}: {group?.subject || "—"}</span>
                <span>·</span>
                <span>{t("teacher.groups.code")}: {group?.code}</span>
                <button onClick={copyCode} className="rounded p-1 hover:bg-[var(--border)]" title={t("teacher.groups.copyCode")}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <span>·</span>
                <span>{t("teacher.groups.members")}: {group?.member_count ?? 0}</span>
              </div>
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
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
            <>
              {activeTab === "assignments" && (
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <select
                      value={assignmentFilter}
                      onChange={(e) => setAssignmentFilter(e.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                    >
                      <option value="active">{t("teacher.groupPage.filter.active")}</option>
                      <option value="expired">{t("teacher.groupPage.filter.overdue")}</option>
                    </select>
                    <button
                      onClick={() => setShowQuizModal(true)}
                      className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      {t("teacher.groupPage.createQuiz")}
                    </button>
                  </div>

                  {filteredQuizzes.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {t("teacher.groupPage.noAssignments")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredQuizzes.map((q) => (
                        <div
                          key={q.id}
                          onClick={() => navigate(`/dashboard/teacher/quiz/${q.id}`)}
                          className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--bg-card)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-medium text-[var(--text)]">{q.title}</div>
                              <div className="mt-1 text-sm text-[var(--text-muted)]">
                                {t("teacher.quizzes.questions")}: {q.question_count ?? 0}
                                {" · "}
                                {q.manual_close ? t("teacher.groupPage.manualClose") : `${t("teacher.groupPage.availableUntil")}: ${formatDate(q.available_until, locale)}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {q.is_expired && (
                                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                                  {t("teacher.groupPage.expired")}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteQuiz(q); }}
                                className="rounded p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600"
                                title={t("teacher.groupPage.deleteAssignment")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "members" && (
                <div>
                  {members.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {t("teacher.groupPage.noMembers")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                        >
                          <div>
                            <span className="font-medium text-[var(--text)]">
                              {m.first_name || m.last_name
                                ? `${m.first_name || ""} ${m.last_name || ""}`.trim()
                                : m.username}
                            </span>
                            <span className="ml-2 text-sm text-[var(--text-muted)]">@{m.username}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveMember(m.id)}
                            disabled={processingMember === m.id}
                            className="rounded p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                            title={t("teacher.groupPage.removeMember")}
                          >
                            {processingMember === m.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserMinus className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "grading" && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                  {t("teacher.results.selectQuiz")}
                  <div className="mt-4 space-y-2">
                    {quizzes.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => navigate(`/dashboard/teacher/quiz/${q.id}`)}
                        className="block w-full rounded-lg border border-[var(--border)] px-4 py-2 text-left text-[var(--text)] hover:bg-[var(--bg-card)]"
                      >
                        {q.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div className="space-y-6">
                  <form onSubmit={handleSaveSettings} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                    <h3 className="text-lg font-medium text-[var(--text)]">{t("teacher.groupPage.tabs.settings")}</h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groupPage.groupName")}</label>
                        <input
                          type="text"
                          value={settingsForm.name}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groupPage.groupSubject")}</label>
                        <input
                          type="text"
                          value={settingsForm.subject}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, subject: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groupPage.groupColor")}</label>
                        <div className="mt-1 flex items-center gap-3">
                          <input
                            type="color"
                            value={settingsForm.color}
                            onChange={(e) => setSettingsForm((f) => ({ ...f, color: e.target.value }))}
                            className="h-10 w-14 cursor-pointer rounded border border-[var(--border)]"
                          />
                          <input
                            type="text"
                            value={settingsForm.color}
                            onChange={(e) => setSettingsForm((f) => ({ ...f, color: e.target.value }))}
                            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)]"
                            pattern="^#[0-9A-Fa-f]{6}$"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
                    >
                      {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {t("teacher.groupPage.saveChanges")}
                    </button>
                  </form>

                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
                    <h3 className="text-lg font-medium text-red-600 dark:text-red-400">{t("teacher.groupPage.deleteGroup")}</h3>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {t("teacher.groupPage.confirmDeleteGroup")}
                    </p>
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="mt-4 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
                      >
                        {t("teacher.groupPage.deleteGroup")}
                      </button>
                    ) : (
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={handleDeleteGroup}
                          disabled={deleting}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {t("common.yes")}, {t("common.delete")}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {confirmDeleteQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text)]">{t("teacher.groupPage.confirmDeleteAssignment", { title: confirmDeleteQuiz.title })}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{t("teacher.groupPage.confirmDeleteAssignmentHint")}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDeleteQuiz}
                disabled={deletingQuiz}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingQuiz && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("common.yes")}, {t("common.delete")}
              </button>
              <button
                onClick={() => setConfirmDeleteQuiz(null)}
                disabled={deletingQuiz}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("teacher.groupPage.createQuiz")}</h2>
              <button onClick={() => setShowQuizModal(false)} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groupPage.quizTitle")}</label>
                <input
                  type="text"
                  value={quizForm.title}
                  onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groupPage.quizDescription")}</label>
                <textarea
                  value={quizForm.description}
                  onChange={(e) => setQuizForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={quizForm.manual_close}
                    onChange={(e) => setQuizForm((f) => ({ ...f, manual_close: e.target.checked }))}
                  />
                  {t("teacher.groupPage.manualClose")}
                </label>
              </div>
              {!quizForm.manual_close && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.groupPage.availableUntil")}</label>
                  <input
                    type="datetime-local"
                    value={quizForm.available_until}
                    onChange={(e) => setQuizForm((f) => ({ ...f, available_until: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  />
                </div>
              )}
              <div>
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={quizForm.has_quiz_time_limit}
                    onChange={(e) => setQuizForm((f) => ({ ...f, has_quiz_time_limit: e.target.checked }))}
                  />
                  {t("teacher.groupPage.quizTimeLimit")}
                </label>
                {quizForm.has_quiz_time_limit && (
                  <input
                    type="number"
                    min={1}
                    value={quizForm.time_limit ?? ""}
                    onChange={(e) => setQuizForm((f) => ({ ...f, time_limit: e.target.value ? parseInt(e.target.value) : null }))}
                    className="mt-2 w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)]"
                  />
                )}
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={quizForm.anti_cheating_mode}
                    onChange={(e) => setQuizForm((f) => ({ ...f, anti_cheating_mode: e.target.checked }))}
                  />
                  {t("teacher.groupPage.antiCheatingMode")}
                </label>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {t("teacher.groupPage.antiCheatingExperimental")}
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={quizForm.allow_show_answers}
                    onChange={(e) => setQuizForm((f) => ({ ...f, allow_show_answers: e.target.checked }))}
                  />
                  {t("teacher.groupPage.allowShowAnswers")}
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creatingQuiz}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
                >
                  {creatingQuiz ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("teacher.groupPage.create")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuizModal(false)}
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
