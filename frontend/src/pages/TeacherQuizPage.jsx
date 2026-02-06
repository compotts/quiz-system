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
  Download,
  Upload,
  ChevronRight,
  User,
  TrendingUp,
  Target,
  Timer,
  Edit3,
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
    show_results: true,
    manual_close: false,
    available_until: "",
    timer_mode: "none",
    time_limit: "",
    question_time_limit: "",
    question_display_mode: "all_on_page",
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
    options: [{ text: "", is_correct: false, order: 0 }],
    correct_text_answer: "",
  });
  const [creatingQuestion, setCreatingQuestion] = useState(false);
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [confirmDeleteAllQuestions, setConfirmDeleteAllQuestions] = useState(false);
  const [deletingAllQuestions, setDeletingAllQuestions] = useState(false);
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editQuestionForm, setEditQuestionForm] = useState(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionFormError, setQuestionFormError] = useState("");
  const [editQuestionError, setEditQuestionError] = useState("");

  const [showStudentDetail, setShowStudentDetail] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);
  const [showOverallStats, setShowOverallStats] = useState(true);

  const handleExportQuestions = () => {
    if (!questions.length) return;
    
    const exportData = {
      quiz_title: quiz?.title || "Untitled",
      exported_at: new Date().toISOString(),
      questions: questions.map((q) => ({
        text: q.text,
        points: q.points,
        input_type: q.input_type,
        correct_text_answer: q.correct_text_answer,
        options: q.options?.map((o) => ({
          text: o.text,
          is_correct: o.is_correct,
        })) || [],
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `questions_${quiz?.title?.replace(/[^a-zA-Z0-9]/g, "_") || "export"}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportQuestions = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingQuestions(true);
    setError("");

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const importedQuestions = data.questions || data;
      if (!Array.isArray(importedQuestions) || importedQuestions.length === 0) {
        throw new Error(t("teacher.quizPage.importInvalidFormat"));
      }

      // Prepare all questions for batch import
      const questionsToImport = [];
      for (let i = 0; i < importedQuestions.length; i++) {
        const q = importedQuestions[i];
        const questionData = {
          text: q.text?.trim() || `Question ${i + 1}`,
          order: questions.length + i,
          points: q.points ?? 1,
          input_type: q.input_type || "select",
        };

        if (questionData.input_type === "select") {
          const opts = (q.options || []).filter((o) => o.text?.trim()).map((o, idx) => ({
            text: o.text.trim(),
            is_correct: !!o.is_correct,
            order: idx,
          }));
          if (opts.length === 0) continue;
          questionData.options = opts;
        } else {
          questionData.correct_text_answer = q.correct_text_answer?.trim() || null;
          questionData.options = [];
        }

        questionsToImport.push(questionData);
      }

      if (questionsToImport.length === 0) {
        throw new Error(t("teacher.quizPage.importInvalidFormat"));
      }

      // Import all questions in a single batch request
      await quizzesApi.createQuestionsBatch(qid, questionsToImport);

      await loadQuestions();
      setError("");
    } catch (err) {
      setError(err.message || t("teacher.quizPage.importError"));
    } finally {
      setImportingQuestions(false);
      event.target.value = "";
    }
  };

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
        show_results: q.show_results !== false,
        manual_close: q.manual_close || false,
        available_until: q.available_until ? new Date(q.available_until).toISOString().slice(0, 16) : "",
        timer_mode: q.timer_mode || "none",
        time_limit: q.time_limit || "",
        question_time_limit: q.question_time_limit || "",
        question_display_mode: q.question_display_mode || "all_on_page",
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
        show_results: settingsForm.show_results,
        manual_close: settingsForm.manual_close,
        available_until: settingsForm.manual_close ? null : (settingsForm.available_until ? new Date(settingsForm.available_until).toISOString() : null),
        timer_mode: settingsForm.timer_mode,
        time_limit: settingsForm.timer_mode === "quiz_total" ? (parseInt(settingsForm.time_limit) || null) : null,
        question_time_limit: settingsForm.timer_mode === "per_question" ? (parseInt(settingsForm.question_time_limit) || null) : null,
        question_display_mode: settingsForm.question_display_mode,
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

  const loadStudentDetail = async (studentId) => {
    setShowStudentDetail(studentId);
    setStudentDetail(null);
    setLoadingStudentDetail(true);
    try {
      const data = await quizzesApi.getStudentDetail(qid, studentId);
      setStudentDetail(data);
    } catch (err) {
      setError(err.message || t("common.errorGeneric"));
    } finally {
      setLoadingStudentDetail(false);
    }
  };

  const closeStudentDetail = () => {
    setShowStudentDetail(null);
    setStudentDetail(null);
  };

  const overallStats = (() => {
    const completed = studentStatuses.filter((s) => s.status === "completed");
    if (completed.length === 0) return null;

    const scores = completed.map((s) => s.score || 0);
    const maxScores = completed.map((s) => s.max_score || 0);
    const percentages = completed.map((s) => (s.max_score > 0 ? (s.score / s.max_score) * 100 : 0));
    const avgTimes = completed.filter((s) => s.avg_time_per_answer != null).map((s) => s.avg_time_per_answer);

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgMaxScore = maxScores.reduce((a, b) => a + b, 0) / maxScores.length;
    const avgPercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const avgTime = avgTimes.length > 0 ? avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length : null;

    const minPct = Math.min(...percentages);
    const maxPct = Math.max(...percentages);

    const distribution = [0, 0, 0, 0, 0];
    percentages.forEach((p) => {
      if (p < 20) distribution[0]++;
      else if (p < 40) distribution[1]++;
      else if (p < 60) distribution[2]++;
      else if (p < 80) distribution[3]++;
      else distribution[4]++;
    });

    return {
      totalStudents: studentStatuses.length,
      completedCount: completed.length,
      avgScore,
      avgMaxScore,
      avgPercentage,
      avgTime,
      minPct,
      maxPct,
      distribution,
    };
  })();

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

    let opts = null;
    if (questionForm.input_type === "select") {
      opts = questionForm.options.filter((o) => o.text.trim()).map((o, i) => ({
        text: o.text.trim(),
        is_correct: !!o.is_correct,
        order: i,
      }));
      if (!opts.length) {
        setQuestionFormError(t("teacher.quizPage.errorAtLeastOneOption"));
        return;
      }
      if (!opts.some((o) => o.is_correct)) {
        setQuestionFormError(t("teacher.quizPage.errorAtLeastOneCorrect"));
        return;
      }
    }
    setQuestionFormError("");

    const data = {
      text: questionForm.text.trim(),
      order: questions.length,
      points: questionForm.points,
      input_type: questionForm.input_type,
    };
    if (questionForm.input_type === "select") {
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
        options: [{ text: "", is_correct: false, order: 0 }],
        correct_text_answer: "",
      });
      await loadQuestions();
    } catch (err) {
      setQuestionFormError(err.message || t("teacher.quizzes.errorQuestionCreate"));
    } finally {
      setCreatingQuestion(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!confirmDeleteQuestion) return;
    setDeletingQuestion(true);
    try {
      await quizzesApi.deleteQuestion(qid, confirmDeleteQuestion.id);
      setConfirmDeleteQuestion(null);
      await loadQuestions();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorQuestionDelete"));
    } finally {
      setDeletingQuestion(false);
    }
  };

  const handleDeleteAllQuestions = async () => {
    setDeletingAllQuestions(true);
    try {
      await quizzesApi.deleteAllQuestions(qid);
      setConfirmDeleteAllQuestions(false);
      await loadQuestions();
    } catch (err) {
      setError(err.message || t("teacher.quizzes.errorQuestionDelete"));
    } finally {
      setDeletingAllQuestions(false);
    }
  };

  const openEditQuestion = (question) => {
    setError("");
    setEditQuestionError("");
    setEditingQuestion(question);
    const options = (question.options || []).map((o, i) => ({
      text: o.text || "",
      is_correct: !!o.is_correct,
      order: o.order ?? i,
    }));
    if (question.input_type === "select" && !options.length) {
      options.push({ text: "", is_correct: false, order: 0 });
    }
    setEditQuestionForm({
      text: question.text,
      points: question.points,
      input_type: question.input_type || "select",
      correct_text_answer: question.correct_text_answer || "",
      options,
    });
  };

  const editAddOption = () => {
    setEditQuestionForm((f) => ({
      ...f,
      options: [...(f.options || []), { text: "", is_correct: false, order: (f.options?.length ?? 0) }],
    }));
  };

  const editUpdateOption = (idx, patch) => {
    setEditQuestionForm((f) => {
      const o = [...(f.options || [])];
      o[idx] = { ...o[idx], ...patch };
      return { ...f, options: o };
    });
  };

  const editRemoveOption = (idx) => {
    setEditQuestionForm((f) => ({
      ...f,
      options: (f.options || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!editingQuestion || !editQuestionForm.text.trim()) return;

    if (editQuestionForm.input_type === "select") {
      const opts = (editQuestionForm.options || []).filter((o) => o.text?.trim()).map((o, i) => ({
        text: o.text.trim(),
        is_correct: !!o.is_correct,
        order: i,
      }));
      if (!opts.length) {
        setEditQuestionError(t("teacher.quizPage.errorAtLeastOneOption"));
        return;
      }
      if (!opts.some((o) => o.is_correct)) {
        setEditQuestionError(t("teacher.quizPage.errorAtLeastOneCorrect"));
        return;
      }
    }
    setEditQuestionError("");

    setSavingQuestion(true);
    try {
      const data = {
        text: editQuestionForm.text.trim(),
        points: editQuestionForm.points,
        input_type: editQuestionForm.input_type,
      };

      if (editQuestionForm.input_type === "select") {
        data.options = (editQuestionForm.options || []).filter((o) => o.text?.trim()).map((o, i) => ({
          text: o.text.trim(),
          is_correct: !!o.is_correct,
          order: i,
        }));
      } else {
        data.correct_text_answer = editQuestionForm.correct_text_answer?.trim() || null;
      }

      await quizzesApi.updateQuestion(qid, editingQuestion.id, data);
      setEditingQuestion(null);
      setEditQuestionForm(null);
      await loadQuestions();
    } catch (err) {
      setEditQuestionError(err.message || t("teacher.quizzes.errorQuestionUpdate"));
    } finally {
      setSavingQuestion(false);
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
                      onClick={() => { setError(""); setQuestionFormError(""); setShowQuestionForm(true); }}
                      className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      {t("teacher.quizPage.addQuestion")}
                    </button>
                    
                    <button
                      onClick={handleExportQuestions}
                      disabled={questions.length === 0}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                      title={t("teacher.quizPage.exportQuestions")}
                    >
                      <Download className="h-4 w-4" />
                      {t("teacher.quizPage.export")}
                    </button>
                    
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]">
                      {importingQuestions ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {t("teacher.quizPage.import")}
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportQuestions}
                        disabled={importingQuestions}
                        className="hidden"
                      />
                    </label>
                    
                    <button
                      onClick={() => setConfirmDeleteAllQuestions(true)}
                      disabled={questions.length === 0}
                      className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("teacher.quizPage.deleteAll")}
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
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditQuestion(q)}
                                className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                                title={t("common.edit")}
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteQuestion(q)}
                                className="rounded-lg border border-red-500/30 p-1.5 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                                title={t("common.delete")}
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

              {activeTab === "grading" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowReissueModal(true)}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t("teacher.quizPage.reissue")}
                    </button>
                    <button
                      onClick={() => setShowOverallStats(!showOverallStats)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        showOverallStats
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                      }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      {t("teacher.quizPage.overallStats")}
                    </button>
                  </div>

                  {showOverallStats && overallStats && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                      <h3 className="mb-4 text-lg font-medium text-[var(--text)]">{t("teacher.quizPage.overallStats")}</h3>
                      
                      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="rounded-lg bg-[var(--bg-card)] p-4">
                          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <User className="h-4 w-4" />
                            {t("teacher.quizPage.statsCompleted")}
                          </div>
                          <div className="mt-1 text-2xl font-bold text-[var(--text)]">
                            {overallStats.completedCount} / {overallStats.totalStudents}
                          </div>
                        </div>
                        <div className="rounded-lg bg-[var(--bg-card)] p-4">
                          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <Target className="h-4 w-4" />
                            {t("teacher.quizPage.statsAvgScore")}
                          </div>
                          <div className="mt-1 text-2xl font-bold text-[var(--accent)]">
                            {overallStats.avgPercentage.toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-lg bg-[var(--bg-card)] p-4">
                          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <TrendingUp className="h-4 w-4" />
                            {t("teacher.quizPage.statsRange")}
                          </div>
                          <div className="mt-1 text-2xl font-bold text-[var(--text)]">
                            {overallStats.minPct.toFixed(0)}% - {overallStats.maxPct.toFixed(0)}%
                          </div>
                        </div>
                        <div className="rounded-lg bg-[var(--bg-card)] p-4">
                          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <Timer className="h-4 w-4" />
                            {t("teacher.quizPage.statsAvgTime")}
                          </div>
                          <div className="mt-1 text-2xl font-bold text-[var(--text)]">
                            {formatTime(overallStats.avgTime)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3 text-sm font-medium text-[var(--text-muted)]">{t("teacher.quizPage.statsDistribution")}</h4>
                        <div className="flex items-end gap-2 h-32">
                          {["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"].map((label, i) => {
                            const count = overallStats.distribution[i];
                            const maxCount = Math.max(...overallStats.distribution, 1);
                            const height = (count / maxCount) * 100;
                            const colors = [
                              "bg-red-500",
                              "bg-orange-500",
                              "bg-yellow-500",
                              "bg-blue-500",
                              "bg-green-500",
                            ];
                            return (
                              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                                <div className="w-full flex flex-col items-center justify-end" style={{ height: "100px" }}>
                                  <span className="text-xs font-medium text-[var(--text)]">{count}</span>
                                  <div
                                    className={`w-full rounded-t ${colors[i]} transition-all`}
                                    style={{ height: `${Math.max(height, 4)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-[var(--text-muted)]">{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

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
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentStatuses.map((s) => {
                            const statusInfo = STATUS_LABELS[s.status] || STATUS_LABELS.not_opened;
                            const pct = s.max_score > 0 ? (s.score / s.max_score) * 100 : 0;
                            return (
                              <tr key={s.student_id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card)]">
                                <td className="p-3 text-[var(--text)]">{s.student_name}</td>
                                <td className={`p-3 ${statusInfo.color}`}>{statusInfo.label}</td>
                                <td className="p-3">
                                  {s.score != null ? (
                                    <div className="flex items-center gap-2">
                                      <span>{s.score} / {s.max_score}</span>
                                      <div className="h-1.5 w-16 rounded-full bg-[var(--border)]">
                                        <div
                                          className={`h-full rounded-full ${
                                            pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"
                                          }`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="p-3">{s.answered_count} / {s.total_questions}</td>
                                <td className="p-3">{formatTime(s.avg_time_per_answer)}</td>
                                <td className="p-3">
                                  <button
                                    onClick={() => loadStudentDetail(s.student_id)}
                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/10"
                                  >
                                    {t("teacher.quizPage.details")}
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </td>
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
                          checked={settingsForm.show_results}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, show_results: e.target.checked }))}
                        />
                        {t("teacher.quizPage.settingsShowResults")}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={settingsForm.allow_show_answers}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, allow_show_answers: e.target.checked }))}
                          disabled={!settingsForm.show_results}
                        />
                        {t("teacher.quizPage.settingsAllowShowAnswers")}
                      </label>
                      
                      <div className="border-t border-[var(--border)] pt-4">
                        <label className="block text-sm font-medium text-[var(--text)] mb-2">{t("teacher.quizPage.settingsQuestionDisplay")}</label>
                        <select
                          value={settingsForm.question_display_mode}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, question_display_mode: e.target.value }))}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                        >
                          <option value="all_on_page">{t("teacher.quizPage.displayAllOnPage")}</option>
                          <option value="one_per_page">{t("teacher.quizPage.displayOnePerPage")}</option>
                        </select>
                      </div>
                      
                      <div className="border-t border-[var(--border)] pt-4">
                        <label className="block text-sm font-medium text-[var(--text)] mb-2">{t("teacher.quizPage.settingsTimerMode")}</label>
                        <select
                          value={settingsForm.timer_mode}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, timer_mode: e.target.value }))}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                        >
                          <option value="none">{t("teacher.quizPage.timerNone")}</option>
                          <option value="quiz_total">{t("teacher.quizPage.timerQuizTotal")}</option>
                          <option value="per_question">{t("teacher.quizPage.timerPerQuestion")}</option>
                        </select>
                        
                        {settingsForm.timer_mode === "quiz_total" && (
                          <div className="mt-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">{t("teacher.quizPage.timerQuizTotalMinutes")}</label>
                            <input
                              type="number"
                              min="1"
                              value={settingsForm.time_limit ? Math.floor(settingsForm.time_limit / 60) : ""}
                              onChange={(e) => setSettingsForm((f) => ({ ...f, time_limit: e.target.value ? parseInt(e.target.value) * 60 : "" }))}
                              placeholder="10"
                              className="w-32 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                            />
                          </div>
                        )}
                        
                        {settingsForm.timer_mode === "per_question" && (
                          <div className="mt-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">{t("teacher.quizPage.timerPerQuestionSeconds")}</label>
                            <input
                              type="number"
                              min="5"
                              value={settingsForm.question_time_limit || ""}
                              onChange={(e) => setSettingsForm((f) => ({ ...f, question_time_limit: e.target.value ? parseInt(e.target.value) : "" }))}
                              placeholder="30"
                              className="w-32 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="border-t border-[var(--border)] pt-4">
                        <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                          <input
                            type="checkbox"
                            checked={settingsForm.manual_close}
                            onChange={(e) => setSettingsForm((f) => ({ ...f, manual_close: e.target.checked }))}
                          />
                          {t("teacher.quizPage.settingsManualClose")}
                        </label>
                        {!settingsForm.manual_close && (
                          <div className="mt-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">{t("teacher.quizPage.settingsAvailableUntil")}</label>
                            <input
                              type="datetime-local"
                              value={settingsForm.available_until}
                              onChange={(e) => setSettingsForm((f) => ({ ...f, available_until: e.target.value }))}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
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
              <button onClick={() => { setShowQuestionForm(false); setQuestionFormError(""); }} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {questionFormError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {questionFormError}
                <button type="button" onClick={() => setQuestionFormError("")} className="ml-auto">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
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
                  onClick={() => { setShowQuestionForm(false); setQuestionFormError(""); }}
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
                disabled={deletingQuestion}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingQuestion && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("common.yes")}, {t("common.delete")}
              </button>
              <button
                onClick={() => setConfirmDeleteQuestion(null)}
                disabled={deletingQuestion}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAllQuestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text)]">{t("teacher.quizPage.confirmDeleteAllQuestions")}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {t("teacher.quizPage.deleteAllWarning", { count: questions.length })}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDeleteAllQuestions}
                disabled={deletingAllQuestions}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingAllQuestions && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("common.yes")}, {t("teacher.quizPage.deleteAll")}
              </button>
              <button
                onClick={() => setConfirmDeleteAllQuestions(false)}
                disabled={deletingAllQuestions}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingQuestion && editQuestionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("teacher.quizPage.editQuestion")}</h2>
              <button onClick={() => { setEditingQuestion(null); setEditQuestionForm(null); setEditQuestionError(""); }} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {editQuestionError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {editQuestionError}
                <button type="button" onClick={() => setEditQuestionError("")} className="ml-auto">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">{t("teacher.quizPage.questionText")}</label>
                <textarea
                  value={editQuestionForm.text}
                  onChange={(e) => setEditQuestionForm({ ...editQuestionForm, text: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">{t("teacher.quizPage.points")}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editQuestionForm.points}
                    onChange={(e) => setEditQuestionForm({ ...editQuestionForm, points: parseFloat(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">{t("teacher.quizPage.inputType")}</label>
                  <select
                    value={editQuestionForm.input_type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      const next = { ...editQuestionForm, input_type: newType };
                      if (newType === "select" && (!next.options || !next.options.length)) {
                        next.options = [{ text: "", is_correct: false, order: 0 }];
                      }
                      setEditQuestionForm(next);
                    }}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  >
                    <option value="select">{t("teacher.quizPage.inputTypeSelect")}</option>
                    <option value="text">{t("teacher.quizPage.inputTypeText")}</option>
                    <option value="number">{t("teacher.quizPage.inputTypeNumber")}</option>
                  </select>
                </div>
              </div>
              {editQuestionForm.input_type === "select" ? (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-[var(--text)] mb-1">{t("teacher.quizPage.options")}</label>
                    <button type="button" onClick={editAddOption} className="text-sm text-[var(--accent)] hover:underline">
                      + {t("teacher.quizPage.addOption")}
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {(editQuestionForm.options || []).map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => editUpdateOption(idx, { text: e.target.value })}
                          placeholder={t("teacher.quizPage.optionPlaceholder")}
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                        />
                        <label className="flex items-center gap-1 whitespace-nowrap text-sm text-[var(--text-muted)]">
                          <input
                            type="checkbox"
                            checked={!!opt.is_correct}
                            onChange={(e) => editUpdateOption(idx, { is_correct: e.target.checked })}
                          />
                          {t("teacher.quizPage.correct")}
                        </label>
                        <button
                          type="button"
                          onClick={() => editRemoveOption(idx)}
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
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">{t("teacher.quizPage.correctAnswer")}</label>
                  <input
                    type={editQuestionForm.input_type === "number" ? "number" : "text"}
                    value={editQuestionForm.correct_text_answer}
                    onChange={(e) => setEditQuestionForm({ ...editQuestionForm, correct_text_answer: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingQuestion}
                  className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90 disabled:opacity-50"
                >
                  {savingQuestion && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingQuestion(null); setEditQuestionForm(null); setEditQuestionError(""); }}
                  disabled={savingQuestion}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
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

      {showStudentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] p-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {studentDetail?.student_name || t("teacher.quizPage.studentDetails")}
                </h2>
                {studentDetail && (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {studentDetail.is_completed ? t("teacher.quizPage.statusCompleted") : t("teacher.quizPage.statusInProgress")}
                    {studentDetail.completed_at && ` · ${new Date(studentDetail.completed_at).toLocaleString()}`}
                  </p>
                )}
              </div>
              <button
                onClick={closeStudentDetail}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingStudentDetail ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : studentDetail ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-lg bg-[var(--bg-card)] p-4">
                      <div className="text-sm text-[var(--text-muted)]">{t("teacher.quizPage.score")}</div>
                      <div className="mt-1 text-2xl font-bold text-[var(--accent)]">
                        {studentDetail.score} / {studentDetail.max_score}
                      </div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        ({studentDetail.max_score > 0 ? ((studentDetail.score / studentDetail.max_score) * 100).toFixed(1) : 0}%)
                      </div>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-card)] p-4">
                      <div className="text-sm text-[var(--text-muted)]">{t("teacher.quizPage.detailCorrect")}</div>
                      <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                        {studentDetail.correct_count} / {studentDetail.total_questions}
                      </div>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-card)] p-4">
                      <div className="text-sm text-[var(--text-muted)]">{t("teacher.quizPage.progress")}</div>
                      <div className="mt-1 text-2xl font-bold text-[var(--text)]">
                        {studentDetail.answered_count} / {studentDetail.total_questions}
                      </div>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-card)] p-4">
                      <div className="text-sm text-[var(--text-muted)]">{t("teacher.quizPage.detailTotalTime")}</div>
                      <div className="mt-1 text-2xl font-bold text-[var(--text)]">
                        {formatTime(studentDetail.total_time)}
                      </div>
                    </div>
                  </div>

                  {studentDetail.questions.some((q) => q.time_spent != null) && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
                      <h4 className="mb-3 text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.detailTimeChart")}</h4>
                      <div className="flex items-end gap-1 h-24 overflow-x-auto pb-2">
                        {studentDetail.questions.map((q, i) => {
                          const time = q.time_spent || 0;
                          const maxTime = Math.max(...studentDetail.questions.map((x) => x.time_spent || 0), 1);
                          const height = (time / maxTime) * 100;
                          return (
                            <div key={q.question_id} className="flex flex-col items-center min-w-[24px]" title={`${q.question_text}: ${formatTime(time)}`}>
                              <div
                                className={`w-5 rounded-t transition-all ${
                                  q.is_correct ? "bg-green-500" : q.answered ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"
                                }`}
                                style={{ height: `${Math.max(height, 4)}px` }}
                              />
                              <span className="mt-1 text-xs text-[var(--text-muted)]">{i + 1}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-green-500" /> {t("teacher.quizPage.detailCorrectLegend")}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-red-500" /> {t("teacher.quizPage.detailIncorrectLegend")}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" /> {t("teacher.quizPage.detailUnansweredLegend")}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="mb-3 text-sm font-medium text-[var(--text)]">{t("teacher.quizPage.detailQuestions")}</h4>
                    <div className="space-y-3">
                      {studentDetail.questions.map((q, idx) => (
                        <div
                          key={q.question_id}
                          className={`rounded-lg border p-4 ${
                            q.is_correct
                              ? "border-green-500/30 bg-green-500/5"
                              : q.answered
                              ? "border-red-500/30 bg-red-500/5"
                              : "border-[var(--border)] bg-[var(--bg-card)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xs font-medium text-[var(--accent)]">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-medium text-[var(--text)]">{q.question_text}</p>
                                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                                  <span>{q.points_earned} / {q.points} {t("student.groupPage.points")}</span>
                                  {q.time_spent != null && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatTime(q.time_spent)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {q.answered && (
                              q.is_correct ? (
                                <CheckCircle className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                              )
                            )}
                          </div>

                          {q.input_type === "select" && q.options?.length > 0 && (
                            <div className="mt-3 space-y-1 pl-8">
                              {q.options.map((opt) => (
                                <div
                                  key={opt.id}
                                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                                    opt.is_correct && opt.was_selected
                                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                      : opt.was_selected && !opt.is_correct
                                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                      : opt.is_correct
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-[var(--text-muted)]"
                                  }`}
                                >
                                  {opt.was_selected && (
                                    opt.is_correct ? (
                                      <CheckCircle className="h-3.5 w-3.5" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5" />
                                    )
                                  )}
                                  {!opt.was_selected && opt.is_correct && (
                                    <CheckCircle className="h-3.5 w-3.5 opacity-50" />
                                  )}
                                  {opt.text}
                                </div>
                              ))}
                            </div>
                          )}

                          {q.input_type !== "select" && q.answered && (
                            <div className="mt-3 pl-8 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--text-muted)]">{t("teacher.quizPage.detailStudentAnswer")}:</span>
                                <span className={q.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                  {q.text_answer || "—"}
                                </span>
                              </div>
                              {!q.is_correct && q.correct_text_answer && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[var(--text-muted)]">{t("teacher.quizPage.correctAnswer")}:</span>
                                  <span className="text-green-600 dark:text-green-400">{q.correct_text_answer}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-[var(--text-muted)]">{t("common.errorGeneric")}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
