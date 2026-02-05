import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  HelpCircle,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  Eye,
  EyeOff,
  RotateCcw,
  Square,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { authApi, quizzesApi } from "../services/api.js";

function formatTime(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TeacherQuizPage() {
  const { t } = useTranslation();
  
  const TABS = [
    { id: "questions", icon: HelpCircle, label: t("teacher.quizPage.tabs.questions") },
    { id: "grading", icon: BarChart3, label: t("teacher.quizPage.tabs.grading") },
    { id: "settings", icon: Settings, label: t("teacher.quizPage.tabs.settings") },
  ];

  const STATUS_LABELS = {
    not_opened: { label: t("teacher.quizPage.statusNotOpened"), color: "text-gray-500" },
    opened: { label: t("teacher.quizPage.statusOpened"), color: "text-yellow-600 dark:text-yellow-400" },
    in_progress: { label: t("teacher.quizPage.statusInProgress"), color: "text-blue-600 dark:text-blue-400" },
    completed: { label: t("teacher.quizPage.statusCompleted"), color: "text-green-600 dark:text-green-400" },
    expired: { label: t("teacher.quizPage.statusExpired"), color: "text-red-600 dark:text-red-400" },
  };
  const navigate = useNavigate();
  const { quizId } = useParams();
  const qid = Number(quizId);

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [quiz, setQuiz] = useState(null);
  const [activeTab, setActiveTab] = useState("questions");

  const [questions, setQuestions] = useState([]);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);

  const [studentStatuses, setStudentStatuses] = useState([]);
  const [settingsForm, setSettingsForm] = useState({
    allow_show_answers: true,
    manual_close: false,
    available_until: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [closingQuiz, setClosingQuiz] = useState(false);
  const [showReissueModal, setShowReissueModal] = useState(false);
  const [reissueStudents, setReissueStudents] = useState([]);
  const [reissueDate, setReissueDate] = useState("");
  const [reissuing, setReissuing] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    text: "",
    order: 0,
    points: 1,
    input_type: "select",
    has_time_limit: false,
    time_limit: null,
    options: [{ text: "", is_correct: false, order: 0 }],
    correct_text_answer: "",
  });
  const [creatingQuestion, setCreatingQuestion] = useState(false);
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState(null);

  useEffect(() => {
    let ignore = false;
    authApi.getMe().then((u) => {
      if (ignore) return;
      setCurrentUser(u);
      if (u.role !== "teacher" && u.role !== "admin") navigate("/", { replace: true });
    }).catch(() => navigate("/", { replace: true }));
    return () => { ignore = true; };
  }, [navigate]);

  const loadQuiz = async () => {
    try {
      const q = await quizzesApi.getQuiz(qid);
      setQuiz(q);
      setSettingsForm({
        allow_show_answers: q.allow_show_answers !== false,
        manual_close: q.manual_close || false,
        available_until: q.available_until ? new Date(q.available_until).toISOString().slice(0, 16) : "",
      });
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorLoad"));
    }
  };

  const loadQuestions = async () => {
    try {
      const data = await quizzesApi.getQuestions(qid);
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorQuestions"));
    }
  };

  const loadStudentStatuses = async () => {
    try {
      const data = await quizzesApi.getStudentStatuses(qid);
      setStudentStatuses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t("teacher.results.errorLoad"));
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    await Promise.all([loadQuiz(), loadQuestions(), loadStudentStatuses()]);
    setLoading(false);
  };

  useEffect(() => {
    if (!currentUser || (currentUser.role !== "teacher" && currentUser.role !== "admin")) return;
    loadAll();
  }, [currentUser, qid]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await quizzesApi.updateQuiz(qid, {
        allow_show_answers: settingsForm.allow_show_answers,
        manual_close: settingsForm.manual_close,
        available_until: settingsForm.manual_close ? null : (settingsForm.available_until ? new Date(settingsForm.available_until).toISOString() : null),
      });
      await loadQuiz();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorUpdate"));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCloseQuiz = async () => {
    setClosingQuiz(true);
    try {
      await quizzesApi.closeQuizEarly(qid);
      await loadQuiz();
    } catch (err) {
      setError(err.message || t("common.errorGeneric"));
    } finally {
      setClosingQuiz(false);
    }
  };

  const handleReissue = async () => {
    if (!reissueStudents.length) return;
    setReissuing(true);
    try {
      await quizzesApi.reissueQuiz(qid, reissueStudents, reissueDate ? new Date(reissueDate).toISOString() : null);
      setShowReissueModal(false);
      setReissueStudents([]);
      setReissueDate("");
      await loadStudentStatuses();
    } catch (err) {
      setError(err.message || t("common.errorGeneric"));
    } finally {
      setReissuing(false);
    }
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
    if (!questionForm.text.trim()) return;
    
    const data = {
      text: questionForm.text.trim(),
      order: questions.length,
      points: questionForm.points,
      input_type: questionForm.input_type,
      has_time_limit: questionForm.has_time_limit,
      time_limit: questionForm.has_time_limit ? questionForm.time_limit : null,
    };

    if (questionForm.input_type === "select") {
      const opts = questionForm.options.filter((o) => o.text.trim()).map((o, i) => ({
        text: o.text.trim(),
        is_correct: !!o.is_correct,
        order: i,
      }));
      if (!opts.length) return;
      data.options = opts;
    } else {
      data.correct_text_answer = questionForm.correct_text_answer.trim() || null;
    }

    setCreatingQuestion(true);
    try {
      await quizzesApi.createQuestion(qid, data);
      setShowQuestionForm(false);
      setQuestionForm({
        text: "",
        order: 0,
        points: 1,
        input_type: "select",
        has_time_limit: false,
        time_limit: null,
        options: [{ text: "", is_correct: false, order: 0 }],
        correct_text_answer: "",
      });
      await loadQuestions();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorQuestionCreate"));
    } finally {
      setCreatingQuestion(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!confirmDeleteQuestion) return;
    try {
      await quizzesApi.deleteQuestion(qid, confirmDeleteQuestion.id);
      setConfirmDeleteQuestion(null);
      await loadQuestions();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorQuestionDelete"));
    }
  };

  const toggleReissueStudent = (studentId) => {
    setReissueStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
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
                onClick={() => quiz?.group_id ? navigate(`/dashboard/teacher/group/${quiz.group_id}`) : navigate("/dashboard/teacher")}
                className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("teacher.quizPage.backToGroup")}
              </button>
              <h1 className="mt-2 text-xl font-semibold text-[var(--text)] sm:text-2xl">
                {quiz?.title || "Задание"}
              </h1>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                Вопросов: {quiz?.question_count ?? 0}
                {quiz?.is_expired && " · Истекло"}
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
              {activeTab === "questions" && (
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowQuestionForm(true)}
                      className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      {t("teacher.quizPage.addQuestion")}
                    </button>
                    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={showCorrectAnswers}
                        onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                      />
                      {t("teacher.quizPage.showCorrectAnswers")}
                    </label>
                  </div>

                  {questions.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {t("teacher.quizPage.noQuestions")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                                  {idx + 1}
                                </span>
                                <span className="font-medium text-[var(--text)]">{q.text}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--text-muted)]">
                                <span>{t("teacher.quizPage.points")}: {q.points}</span>
                                <span>·</span>
                                <span>{t("teacher.quizPage.inputType")}: {q.input_type === "select" ? (q.is_multiple_choice ? t("teacher.quizzes.quizTypeMultiple") : t("teacher.quizzes.quizTypeSingle")) : q.input_type === "text" ? t("teacher.quizPage.inputTypeText") : t("teacher.quizPage.inputTypeNumber")}</span>
                                {q.has_time_limit && <><span>·</span><span>{q.time_limit}s</span></>}
                              </div>
                              {q.input_type === "select" && q.options?.length > 0 && (
                                <ul className="mt-3 space-y-1">
                                  {q.options.map((o) => (
                                    <li
                                      key={o.id}
                                      className={`flex items-center gap-2 text-sm ${
                                        showCorrectAnswers && o.is_correct
                                          ? "text-green-600 dark:text-green-400 font-medium"
                                          : "text-[var(--text-muted)]"
                                      }`}
                                    >
                                      {showCorrectAnswers && o.is_correct && <CheckCircle className="h-3.5 w-3.5" />}
                                      {o.text}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {showCorrectAnswers && q.input_type !== "select" && q.correct_text_answer && (
                                <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                                  {t("teacher.quizPage.correctAnswer")}: {q.correct_text_answer}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setConfirmDeleteQuestion(q)}
                              className="rounded-lg border border-red-500/30 p-1.5 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "grading" && (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <button
                      onClick={() => setShowReissueModal(true)}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t("teacher.quizPage.reissue")}
                    </button>
                  </div>

                  {studentStatuses.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {t("teacher.quizPage.noStudents")}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                            <th className="p-3">{t("teacher.quizPage.studentName")}</th>
                            <th className="p-3">{t("teacher.quizPage.status")}</th>
                            <th className="p-3">{t("teacher.quizPage.score")}</th>
                            <th className="p-3">{t("teacher.quizPage.progress")}</th>
                            <th className="p-3">{t("teacher.quizPage.avgTime")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentStatuses.map((s) => {
                            const statusInfo = STATUS_LABELS[s.status] || STATUS_LABELS.not_opened;
                            return (
                              <tr key={s.student_id} className="border-b border-[var(--border)] last:border-b-0">
                                <td className="p-3 text-[var(--text)]">{s.student_name}</td>
                                <td className={`p-3 ${statusInfo.color}`}>{statusInfo.label}</td>
                                <td className="p-3">
                                  {s.score != null ? `${s.score} / ${s.max_score}` : "—"}
                                </td>
                                <td className="p-3">{s.answered_count} / {s.total_questions}</td>
                                <td className="p-3">{formatTime(s.avg_time_per_answer)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "settings" && (
                <div className="space-y-6">
                  <form onSubmit={handleSaveSettings} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                    <h3 className="text-lg font-medium text-[var(--text)]">{t("teacher.quizPage.tabs.settings")}</h3>
                    <div className="mt-4 space-y-4">
                      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={settingsForm.allow_show_answers}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, allow_show_answers: e.target.checked }))}
                        />
                        {t("teacher.quizPage.settingsAllowShowAnswers")}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={settingsForm.manual_close}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, manual_close: e.target.checked }))}
                        />
                        {t("teacher.quizPage.settingsManualClose")}
                      </label>
                      {!settingsForm.manual_close && (
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.settingsAvailableUntil")}</label>
                          <input
                            type="datetime-local"
                            value={settingsForm.available_until}
                            onChange={(e) => setSettingsForm((f) => ({ ...f, available_until: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
                    >
                      {savingSettings && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                      {t("teacher.quizPage.updateSettings")}
                    </button>
                  </form>

                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6">
                    <h3 className="text-lg font-medium text-yellow-600 dark:text-yellow-400">{t("teacher.quizPage.closeEarly")}</h3>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {t("teacher.quizPage.closeEarlyConfirm")}
                    </p>
                    <button
                      onClick={handleCloseQuiz}
                      disabled={closingQuiz || quiz?.is_expired}
                      className="mt-4 flex items-center gap-2 rounded-lg border border-yellow-500/30 px-4 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-500/10 disabled:opacity-50 dark:text-yellow-400"
                    >
                      {closingQuiz && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Square className="h-4 w-4" />
                      {t("teacher.quizPage.closeEarly")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showQuestionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("teacher.quizPage.addQuestion")}</h2>
              <button onClick={() => setShowQuestionForm(false)} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.questionText")}</label>
                <textarea
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm((f) => ({ ...f, text: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  required
                />
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.points")}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={questionForm.points}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, points: parseFloat(e.target.value) || 0 }))}
                    className="mt-1 w-20 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.inputType")}</label>
                  <select
                    value={questionForm.input_type}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, input_type: e.target.value }))}
                    className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  >
                    <option value="select">{t("teacher.quizPage.inputTypeSelect")}</option>
                    <option value="text">{t("teacher.quizPage.inputTypeText")}</option>
                    <option value="number">{t("teacher.quizPage.inputTypeNumber")}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={questionForm.has_time_limit}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, has_time_limit: e.target.checked }))}
                  />
                  {t("teacher.quizPage.questionTimeLimit")}
                </label>
                {questionForm.has_time_limit && (
                  <input
                    type="number"
                    min={1}
                    value={questionForm.time_limit ?? ""}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, time_limit: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="Секунды"
                    className="mt-2 w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text)]"
                  />
                )}
              </div>

              {questionForm.input_type === "select" ? (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.options")}</label>
                    <button type="button" onClick={addOption} className="text-sm text-[var(--accent)] hover:underline">
                      + {t("teacher.quizPage.addOption")}
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {questionForm.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => updateOption(idx, { text: e.target.value })}
                          placeholder={t("teacher.quizPage.optionPlaceholder")}
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                        />
                        <label className="flex items-center gap-1 whitespace-nowrap text-sm text-[var(--text-muted)]">
                          <input
                            type="checkbox"
                            checked={!!opt.is_correct}
                            onChange={(e) => updateOption(idx, { is_correct: e.target.checked })}
                          />
                          {t("teacher.quizPage.correct")}
                        </label>
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="rounded p-1 text-red-600 hover:bg-red-500/10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.correctAnswer")}</label>
                  <input
                    type={questionForm.input_type === "number" ? "number" : "text"}
                    value={questionForm.correct_text_answer}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, correct_text_answer: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creatingQuestion}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
                >
                  {creatingQuestion && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                  {t("teacher.quizPage.save")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuestionForm(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text)]">{t("teacher.quizPage.confirmDeleteQuestion")}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDeleteQuestion}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {t("common.yes")}, {t("common.delete")}
              </button>
              <button
                onClick={() => setConfirmDeleteQuestion(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReissueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("teacher.quizPage.reissueTitle")}</h2>
              <button onClick={() => setShowReissueModal(false)} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              {t("teacher.quizPage.reissueDesc")}
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {studentStatuses.map((s) => (
                <label key={s.student_id} className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={reissueStudents.includes(s.student_id)}
                    onChange={() => toggleReissueStudent(s.student_id)}
                  />
                  {s.student_name}
                  <span className={`text-xs ${STATUS_LABELS[s.status]?.color || ""}`}>
                    ({STATUS_LABELS[s.status]?.label})
                  </span>
                </label>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.newDeadline")}</label>
              <input
                type="datetime-local"
                value={reissueDate}
                onChange={(e) => setReissueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReissue}
                disabled={reissuing || !reissueStudents.length}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
              >
                {reissuing && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                {t("teacher.quizPage.reissueSubmit")}
              </button>
              <button
                onClick={() => setShowReissueModal(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
