import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Users,
  ClipboardList,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  ChevronDown,
  Copy,
  UserMinus,
} from "lucide-react";
import { authApi, groupsApi, quizzesApi, attemptsApi, getAccessToken } from "../services/api.js";

const TABS = [
  { id: "groups", icon: Users },
  { id: "quizzes", icon: ClipboardList },
  { id: "results", icon: BarChart3 },
];

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("groups");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [groups, setGroups] = useState([]);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupFormName, setGroupFormName] = useState("");
  const [groupFormSubject, setGroupFormSubject] = useState("");
  const [groupEditId, setGroupEditId] = useState(null);
  const [groupMembers, setGroupMembers] = useState({});
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [processingGroup, setProcessingGroup] = useState(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null);

  const [quizzes, setQuizzes] = useState([]);
  const [groupsForQuizzes, setGroupsForQuizzes] = useState([]);
  const [quizGroupFilter, setQuizGroupFilter] = useState("");
  const [quizFormOpen, setQuizFormOpen] = useState(false);
  const [quizForm, setQuizForm] = useState({
    group_id: "",
    title: "",
    description: "",
    quiz_type: "single_choice",
    timer_mode: "quiz_total",
    time_limit: null,
    available_until: "",
  });
  const [quizEditId, setQuizEditId] = useState(null);
  const [questionsViewQuizId, setQuestionsViewQuizId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionFormOpen, setQuestionFormOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    text: "",
    order: 0,
    points: 1,
    question_type: "single_choice",
    options: [{ text: "", is_correct: false, order: 0 }],
  });
  const [processingQuiz, setProcessingQuiz] = useState(null);
  const [confirmDeleteQuiz, setConfirmDeleteQuiz] = useState(null);
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState(null);

  const [resultsQuizId, setResultsQuizId] = useState("");
  const [resultsQuizList, setResultsQuizList] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [attemptDetailId, setAttemptDetailId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);

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

  const loadQuizzes = async () => {
    try {
      const groupId = quizGroupFilter ? parseInt(quizGroupFilter, 10) : null;
      const data = await quizzesApi.getQuizzes(groupId);
      setQuizzes(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorLoad"));
    }
  };

  const loadQuestions = async (quizId) => {
    if (!quizId) return;
    try {
      const data = await quizzesApi.getQuestions(quizId);
      setQuestions(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorQuestions"));
    }
  };

  const loadResults = async () => {
    if (!resultsQuizId) {
      setQuizResults([]);
      return;
    }
    try {
      const data = await attemptsApi.getQuizResults(parseInt(resultsQuizId, 10));
      setQuizResults(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || t("teacher.results.errorLoad"));
    }
  };

  useEffect(() => {
    if (!currentUser || (currentUser.role !== "teacher" && currentUser.role !== "admin")) return;
    if (activeTab === "groups") {
      setLoading(true);
      loadGroups().finally(() => setLoading(false));
    } else if (activeTab === "quizzes") {
      setLoading(true);
      groupsApi.getGroups().then((g) => {
        setGroupsForQuizzes(Array.isArray(g) ? g : []);
        if (!quizGroupFilter && g?.length) setQuizGroupFilter(String(g[0].id));
      }).catch(() => {});
      loadQuizzes().finally(() => setLoading(false));
    } else if (activeTab === "results") {
      setLoading(true);
      quizzesApi.getQuizzes(null).then((q) => {
        const list = Array.isArray(q) ? q : [];
        setResultsQuizList(list);
        if (!resultsQuizId && list.length) setResultsQuizId(String(list[0].id));
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [currentUser, activeTab, quizGroupFilter]);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== "teacher" && currentUser.role !== "admin")) return;
    if (activeTab === "results" && resultsQuizId) {
      setLoading(true);
      loadResults().finally(() => setLoading(false));
    }
  }, [currentUser, activeTab, resultsQuizId]);

  useEffect(() => {
    if (questionsViewQuizId) loadQuestions(questionsViewQuizId);
  }, [questionsViewQuizId]);

  const fetchGroupMembers = async (groupId) => {
    try {
      const members = await groupsApi.getMembers(groupId);
      setGroupMembers((prev) => ({ ...prev, [groupId]: members }));
    } catch (err) {
      setError(err.message || t("teacher.groups.errorMembers"));
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupFormName.trim()) return;
    setProcessingGroup("create");
    try {
      await groupsApi.createGroup({
        name: groupFormName.trim(),
        subject: groupFormSubject.trim() || null,
      });
      setGroupFormName("");
      setGroupFormSubject("");
      setGroupFormOpen(false);
      loadGroups();
    } catch (err) {
      setError(err.message || t("teacher.groups.errorCreate"));
    } finally {
      setProcessingGroup(null);
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!groupEditId || !groupFormName.trim()) return;
    setProcessingGroup(groupEditId);
    try {
      await groupsApi.updateGroup(groupEditId, {
        name: groupFormName.trim(),
        subject: groupFormSubject.trim() || null,
      });
      setGroupEditId(null);
      setGroupFormName("");
      setGroupFormSubject("");
      loadGroups();
    } catch (err) {
      setError(err.message || t("teacher.groups.errorUpdate"));
    } finally {
      setProcessingGroup(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirmDeleteGroup) return;
    setProcessingGroup(confirmDeleteGroup.id);
    try {
      await groupsApi.deleteGroup(confirmDeleteGroup.id);
      setConfirmDeleteGroup(null);
      loadGroups();
    } catch (err) {
      setError(err.message || t("teacher.groups.errorDelete"));
    } finally {
      setProcessingGroup(null);
    }
  };

  const handleRemoveMember = async (groupId, userId) => {
    setProcessingGroup(`member-${groupId}-${userId}`);
    try {
      await groupsApi.removeMember(groupId, userId);
      fetchGroupMembers(groupId);
    } catch (err) {
      setError(err.message || t("teacher.groups.errorRemoveMember"));
    } finally {
      setProcessingGroup(null);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code);
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    const gid = quizForm.group_id ? parseInt(quizForm.group_id, 10) : null;
    if (!gid || !quizForm.title.trim()) return;
    setProcessingQuiz("create");
    try {
      await quizzesApi.createQuiz({
        group_id: gid,
        title: quizForm.title.trim(),
        description: quizForm.description?.trim() || null,
        quiz_type: quizForm.quiz_type,
        timer_mode: quizForm.timer_mode,
        time_limit: quizForm.time_limit || null,
        available_until: quizForm.available_until ? new Date(quizForm.available_until).toISOString() : null,
      });
      setQuizForm({ group_id: "", title: "", description: "", quiz_type: "single_choice", timer_mode: "quiz_total", time_limit: null, available_until: "" });
      setQuizFormOpen(false);
      loadQuizzes();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorCreate"));
    } finally {
      setProcessingQuiz(null);
    }
  };

  const handleUpdateQuiz = async (e) => {
    e.preventDefault();
    if (!quizEditId || !quizForm.title.trim()) return;
    setProcessingQuiz(quizEditId);
    try {
      await quizzesApi.updateQuiz(quizEditId, {
        title: quizForm.title.trim(),
        description: quizForm.description?.trim() || null,
        quiz_type: quizForm.quiz_type,
        timer_mode: quizForm.timer_mode,
        time_limit: quizForm.time_limit || null,
        available_until: quizForm.available_until ? new Date(quizForm.available_until).toISOString() : null,
      });
      setQuizEditId(null);
      setQuizForm({ group_id: "", title: "", description: "", quiz_type: "single_choice", timer_mode: "quiz_total", time_limit: null, available_until: "" });
      loadQuizzes();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorUpdate"));
    } finally {
      setProcessingQuiz(null);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!confirmDeleteQuiz) return;
    setProcessingQuiz(confirmDeleteQuiz.id);
    try {
      await quizzesApi.deleteQuiz(confirmDeleteQuiz.id);
      setConfirmDeleteQuiz(null);
      if (questionsViewQuizId === confirmDeleteQuiz.id) setQuestionsViewQuizId(null);
      loadQuizzes();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorDelete"));
    } finally {
      setProcessingQuiz(null);
    }
  };

  const openQuestionForm = (quizId, question = null) => {
    if (question) {
      const opts = (question.options || []).map((o, i) => ({
        text: o.text,
        is_correct: !!o.is_correct,
        order: i,
      }));
      if (!opts.length) opts.push({ text: "", is_correct: false, order: 0 });
      setQuestionForm({
        text: question.text,
        order: question.order,
        points: question.points ?? 1,
        question_type: question.question_type || "single_choice",
        options: opts,
        _editId: question.id,
      });
    } else {
      const qs = questions || [];
      setQuestionForm({
        text: "",
        order: qs.length,
        points: 1,
        question_type: "single_choice",
        options: [{ text: "", is_correct: false, order: 0 }],
        _editId: null,
      });
    }
    setQuestionFormOpen(true);
  };

  const addOption = () => {
    setQuestionForm((f) => ({
      ...f,
      options: [...f.options, { text: "", is_correct: false, order: f.options.length }],
    }));
  };

  const updateOption = (idx, patch) => {
    setQuestionForm((f) => {
      const o = [...f.options];
      o[idx] = { ...o[idx], ...patch };
      return { ...f, options: o };
    });
  };

  const removeOption = (idx) => {
    setQuestionForm((f) => ({
      ...f,
      options: f.options.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!questionsViewQuizId || !questionForm.text.trim()) return;
    const opts = questionForm.options.filter((o) => o.text.trim()).map((o, i) => ({
      text: o.text.trim(),
      is_correct: !!o.is_correct,
      order: i,
    }));
    if (!opts.length) return;
    try {
      await quizzesApi.createQuestion(questionsViewQuizId, {
        text: questionForm.text.trim(),
        order: questionForm.order,
        points: questionForm.points,
        question_type: questionForm.question_type,
        options: opts,
      });
      setQuestionFormOpen(false);
      loadQuestions(questionsViewQuizId);
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorQuestionCreate"));
    }
  };

  const handleDeleteQuestion = async () => {
    if (!confirmDeleteQuestion || !questionsViewQuizId) return;
    try {
      await quizzesApi.deleteQuestion(questionsViewQuizId, confirmDeleteQuestion.id);
      setConfirmDeleteQuestion(null);
      loadQuestions(questionsViewQuizId);
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorQuestionDelete"));
    }
  };

  const loadAttemptDetail = async (id) => {
    setAttemptDetailId(id);
    setAttemptDetail(null);
    try {
      const d = await attemptsApi.getAttemptResults(id);
      setAttemptDetail(d);
    } catch (err) {
      setError(err.message || t("teacher.results.errorLoad"));
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
                {t("teacher.dashboardTitle")}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {t("teacher.welcome", { name: currentUser.first_name || currentUser.username })}
              </p>
            </div>
            <div className="flex gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {t(`teacher.tabs.${tab.id}`)}
                </button>
              ))}
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

          {activeTab === "groups" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => { setGroupFormOpen(true); setGroupEditId(null); setGroupFormName(""); setGroupFormSubject(""); }}
                  className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  {t("teacher.groups.create")}
                </button>
                <button
                  onClick={loadGroups}
                  disabled={loading}
                  className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                  title={t("common.refresh")}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {(groupFormOpen || groupEditId) && (
                <form
                  onSubmit={groupEditId ? handleUpdateGroup : handleCreateGroup}
                  className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={groupFormName}
                      onChange={(e) => setGroupFormName(e.target.value)}
                      placeholder={t("teacher.groups.createPlaceholder")}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                      required
                    />
                    <input
                      type="text"
                      value={groupFormSubject}
                      onChange={(e) => setGroupFormSubject(e.target.value)}
                      placeholder="Предмет (например: Математика)"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={processingGroup}
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
                    >
                      {processingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {groupEditId ? t("common.save") : t("teacher.groups.create")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGroupFormOpen(false); setGroupEditId(null); setGroupFormName(""); setGroupFormSubject(""); }}
                      className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </form>
              )}

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : groups.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                  {t("teacher.groups.noGroups")}
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--text)]">{g.name}</span>
                          {g.subject ? (
                            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                              {g.subject}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                            {t("teacher.groups.code")}: {g.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyCode(g.code)}
                            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                            title={t("teacher.groups.copyCode")}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <span className="text-sm text-[var(--text-muted)]">
                            {t("teacher.groups.members")}: {g.member_count ?? 0}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setGroupEditId(g.id); setGroupFormName(g.name); setGroupFormSubject(g.subject || ""); setGroupFormOpen(false); }}
                            className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteGroup(g)}
                            className="rounded-lg border border-red-500/30 px-2 py-1 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedGroupId(expandedGroupId === g.id ? null : g.id);
                              if (expandedGroupId !== g.id) fetchGroupMembers(g.id);
                            }}
                            className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                          >
                            {t("teacher.groups.viewMembers")}
                            <ChevronDown className={`h-4 w-4 ${expandedGroupId === g.id ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </div>
                      {expandedGroupId === g.id && (
                        <div className="mt-4 border-t border-[var(--border)] pt-4">
                          {(groupMembers[g.id] || []).length === 0 ? (
                            <p className="text-sm text-[var(--text-muted)]">{t("teacher.groups.members")}: 0</p>
                          ) : (
                            <ul className="space-y-2">
                              {(groupMembers[g.id] || []).map((m) => (
                                <li key={m.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-3 py-2">
                                  <span className="text-sm text-[var(--text)]">
                                    {m.username} {m.first_name || m.last_name ? `(${[m.first_name, m.last_name].filter(Boolean).join(" ")})` : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMember(g.id, m.id)}
                                    disabled={!!processingGroup}
                                    className="rounded p-1 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                    title={t("teacher.groups.removeMember")}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {confirmDeleteGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                    <p className="text-[var(--text)]">
                      {t("teacher.groups.confirmDeleteGroup", { name: confirmDeleteGroup.name })}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={handleDeleteGroup}
                        disabled={!!processingGroup}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {processingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t("common.yes")}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteGroup(null)}
                        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]"
                      >
                        {t("common.no")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "quizzes" && (
            <div>
              {!questionsViewQuizId ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">{t("teacher.quizzes.filterGroup")}:</span>
                    <select
                      value={quizGroupFilter}
                      onChange={(e) => { setQuizGroupFilter(e.target.value); }}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                    >
                      <option value="">{t("admin.filters.all")}</option>
                      {groupsForQuizzes.map((gr) => (
                        <option key={gr.id} value={gr.id}>{gr.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { setQuizFormOpen(true); setQuizEditId(null); setQuizForm({ ...quizForm, group_id: quizGroupFilter || (groupsForQuizzes[0]?.id ?? ""), title: "", description: "", available_until: "" }); }}
                      disabled={!groupsForQuizzes.length}
                      className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {t("teacher.quizzes.create")}
                    </button>
                    <button onClick={loadQuizzes} disabled={loading} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50">
                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {quizFormOpen && (
                    <form onSubmit={handleCreateQuiz} className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.filterGroup")}</label>
                        <select
                          value={quizForm.group_id}
                          onChange={(e) => setQuizForm((f) => ({ ...f, group_id: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                          required
                        >
                          {groupsForQuizzes.map((gr) => (
                            <option key={gr.id} value={gr.id}>{gr.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.title")}</label>
                        <input
                          type="text"
                          value={quizForm.title}
                          onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.description")}</label>
                        <textarea
                          value={quizForm.description || ""}
                          onChange={(e) => setQuizForm((f) => ({ ...f, description: e.target.value }))}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                        />
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.quizType")}</label>
                          <select
                            value={quizForm.quiz_type}
                            onChange={(e) => setQuizForm((f) => ({ ...f, quiz_type: e.target.value }))}
                            className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                          >
                            <option value="single_choice">{t("teacher.quizzes.quizTypeSingle")}</option>
                            <option value="multiple_choice">{t("teacher.quizzes.quizTypeMultiple")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.timerMode")}</label>
                          <select
                            value={quizForm.timer_mode}
                            onChange={(e) => setQuizForm((f) => ({ ...f, timer_mode: e.target.value }))}
                            className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                          >
                            <option value="quiz_total">{t("teacher.quizzes.timerQuizTotal")}</option>
                            <option value="per_question">{t("teacher.quizzes.timerPerQuestion")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.timeLimit")}</label>
                          <input
                            type="number"
                            min={0}
                            value={quizForm.time_limit ?? ""}
                            onChange={(e) => setQuizForm((f) => ({ ...f, time_limit: e.target.value ? parseInt(e.target.value, 10) : null }))}
                            placeholder="—"
                            className="mt-1 w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)]">Доступно до</label>
                          <input
                            type="datetime-local"
                            value={quizForm.available_until ?? ""}
                            onChange={(e) => setQuizForm((f) => ({ ...f, available_until: e.target.value }))}
                            className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={!!processingQuiz} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50">
                          {processingQuiz ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t("teacher.quizzes.create")}
                        </button>
                        <button type="button" onClick={() => setQuizFormOpen(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">
                          {t("common.cancel")}
                        </button>
                      </div>
                    </form>
                  )}

                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                    </div>
                  ) : quizzes.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {t("teacher.quizzes.noQuizzes")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {quizzes.map((q) => (
                        <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          <div>
                            <span className="font-medium text-[var(--text)]">{q.title}</span>
                            <span className="ml-2 text-sm text-[var(--text-muted)]">
                              {t("teacher.quizzes.questions")}: {q.question_count ?? 0}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setQuestionsViewQuizId(q.id); setError(""); }}
                              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                            >
                              {t("teacher.quizzes.questionsLabel")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteQuiz(q)}
                              className="rounded-lg border border-red-500/30 px-2 py-1 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {confirmDeleteQuiz && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                        <p className="text-[var(--text)]">{t("teacher.quizzes.confirmDeleteQuiz", { title: confirmDeleteQuiz.title })}</p>
                        <div className="mt-4 flex gap-2">
                          <button onClick={handleDeleteQuiz} disabled={!!processingQuiz} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                            {t("common.yes")}
                          </button>
                          <button onClick={() => setConfirmDeleteQuiz(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">
                            {t("common.no")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestionsViewQuizId(null)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                    >
                      ← {t("teacher.tabs.quizzes")}
                    </button>
                    <button
                      onClick={() => openQuestionForm(questionsViewQuizId)}
                      className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      {t("teacher.quizzes.addQuestion")}
                    </button>
                    <button onClick={() => loadQuestions(questionsViewQuizId)} disabled={loading} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50">
                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {questionFormOpen && (
                    <form onSubmit={handleCreateQuestion} className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.questionText")}</label>
                        <textarea value={questionForm.text} onChange={(e) => setQuestionForm((f) => ({ ...f, text: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]" required />
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.points")}</label>
                          <input type="number" min={0} step={0.5} value={questionForm.points} onChange={(e) => setQuestionForm((f) => ({ ...f, points: parseFloat(e.target.value) || 0 }))} className="mt-1 w-20 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)]">Order</label>
                          <input type="number" min={0} value={questionForm.order} onChange={(e) => setQuestionForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 0 }))} className="mt-1 w-20 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizzes.options")}</label>
                          <button type="button" onClick={addOption} className="text-sm text-[var(--accent)] hover:underline">+ {t("teacher.quizzes.options")}</button>
                        </div>
                        <div className="mt-2 space-y-2">
                          {(questionForm.options || []).map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => updateOption(idx, { text: e.target.value })}
                                placeholder={`${t("teacher.quizzes.options")} ${idx + 1}`}
                                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                              />
                              <label className="flex items-center gap-1 whitespace-nowrap text-sm text-[var(--text-muted)]">
                                <input type="checkbox" checked={!!opt.is_correct} onChange={(e) => updateOption(idx, { is_correct: e.target.checked })} />
                                {t("teacher.quizzes.correct")}
                              </label>
                              <button type="button" onClick={() => removeOption(idx)} className="rounded p-1 text-red-600 hover:bg-red-500/10 dark:text-red-400">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)]">
                          {t("teacher.quizzes.addQuestion")}
                        </button>
                        <button type="button" onClick={() => setQuestionFormOpen(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">
                          {t("common.cancel")}
                        </button>
                      </div>
                    </form>
                  )}

                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {questions.map((q) => (
                        <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-[var(--text)]">{q.text}</p>
                              <p className="mt-1 text-sm text-[var(--text-muted)]">{t("teacher.quizzes.points")}: {q.points}</p>
                              {q.options?.length ? (
                                <ul className="mt-2 list-inside list-disc text-sm text-[var(--text-muted)]">
                                  {q.options.map((o) => (
                                    <li key={o.id}>{o.text} {o.is_correct ? `(${t("teacher.quizzes.correct")})` : ""}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteQuestion(q)}
                              className="rounded-lg border border-red-500/30 px-2 py-1 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {confirmDeleteQuestion && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                        <p className="text-[var(--text)]">{t("teacher.quizzes.confirmDeleteQuestion")}</p>
                        <div className="mt-4 flex gap-2">
                          <button onClick={handleDeleteQuestion} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">{t("common.yes")}</button>
                          <button onClick={() => setConfirmDeleteQuestion(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">{t("common.no")}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "results" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">{t("teacher.results.selectQuiz")}:</span>
                <select
                  value={resultsQuizId}
                  onChange={(e) => setResultsQuizId(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  {resultsQuizList.map((q) => (
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>
                <button onClick={loadResults} disabled={loading} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : quizResults.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                  {t("teacher.results.noResults")}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                        <th className="p-3">{t("teacher.results.student")}</th>
                        <th className="p-3">{t("teacher.results.score")}</th>
                        <th className="p-3">{t("teacher.results.percent")}</th>
                        <th className="p-3">{t("teacher.results.timeSpent")}</th>
                        <th className="p-3">{t("teacher.results.completedAt")}</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {quizResults.map((r) => (
                        <tr key={r.attempt_id} className="border-b border-[var(--border)] last:border-b-0">
                          <td className="p-3 text-[var(--text)]">{(r.student_name || "").trim() || `ID ${r.student_id}`}</td>
                          <td className="p-3">{r.score} / {r.max_score}</td>
                          <td className="p-3">{Math.round(r.percentage ?? 0)}%</td>
                          <td className="p-3">{formatTime(r.time_spent)}</td>
                          <td className="p-3 text-[var(--text-muted)]">{formatDate(r.completed_at)}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => loadAttemptDetail(r.attempt_id)}
                              className="text-[var(--accent)] hover:underline"
                            >
                              {t("teacher.results.viewDetails")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {attemptDetailId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
                  <div className="my-8 w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-[var(--text)]">{t("teacher.results.viewDetails")}</h2>
                      <button onClick={() => { setAttemptDetailId(null); setAttemptDetail(null); }} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    {!attemptDetail ? (
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-[var(--text-muted)]">
                          {t("teacher.results.score")}: {attemptDetail.attempt?.score} / {attemptDetail.attempt?.max_score} ({Math.round(attemptDetail.percentage ?? 0)}%)
                        </p>
                        {(attemptDetail.answers || []).map((a, i) => (
                          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                            <p className="font-medium text-[var(--text)]">{a.question_text}</p>
                            <p className={`mt-1 text-sm ${a.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {a.is_correct ? "✓" : "✗"} {t("teacher.quizzes.points")}: {a.points_earned} / {a.max_points}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
