import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, BarChart3, CheckCircle, ChevronRight, ClipboardList, Clock, Loader2, RefreshCw, X } from "lucide-react";
import { authApi, attemptsApi, groupsApi, quizzesApi } from "../services/api.js";

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

export default function StudentGroupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams();
  const gid = Number(groupId);

  const TABS = [
    { id: "assignments", icon: ClipboardList, label: t("student.groupPage.tabs.assignments") },
    { id: "grades", icon: BarChart3, label: t("student.groupPage.tabs.grades") },
  ];

  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [group, setGroup] = useState(null);
  const [tab, setTab] = useState("assignments");
  const [assignmentFilter, setAssignmentFilter] = useState("incomplete");

  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);

  const [runState, setRunState] = useState(null);
  const [runQuiz, setRunQuiz] = useState(null);
  const [runAttemptId, setRunAttemptId] = useState(null);
  const [runQuestions, setRunQuestions] = useState([]);
  const [runQuestionsOrder, setRunQuestionsOrder] = useState([]);
  const [runAnswered, setRunAnswered] = useState([]);
  const [runAnswers, setRunAnswers] = useState({});
  const [runCompleting, setRunCompleting] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [startingQuizId, setStartingQuizId] = useState(null);
  const runStartedAtRef = useRef(null);
  const runQuestionStartedAtRef = useRef({});
  const runQuestionAnsweredAtRef = useRef({});
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const paginationNumbersRef = useRef(null);
  const paginationButtonRefs = useRef([]);
  
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [showCorrectAnswersInDetail, setShowCorrectAnswersInDetail] = useState(false);

  const [attemptDetailId, setAttemptDetailId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const [fullscreenPromptDismissed, setFullscreenPromptDismissed] = useState(false);
  const [visibilitySwitchCount, setVisibilitySwitchCount] = useState(0);
  const [antiCheatingTabWarningShown, setAntiCheatingTabWarningShown] = useState(false);
  const [antiCheatingAutoSubmitted, setAntiCheatingAutoSubmitted] = useState(false);
  const antiCheatingSubmittedRef = useRef(false);
  const visibilityHiddenAlreadyProcessedRef = useRef(false);
  const lastLoggedSwitchCountRef = useRef(0);

  const showQuizRun = runState === "running" || runState === "results";

  const runStateRef = useRef({ runState, runAttemptId, runQuiz, runQuestions, runAnswered, runAnswers });
  const completeQuizRef = useRef(null);
  useEffect(() => {
    runStateRef.current = { runState, runAttemptId, runQuiz, runQuestions, runAnswered, runAnswers };
  }, [runState, runAttemptId, runQuiz, runQuestions, runAnswered, runAnswers]);
  useEffect(() => {
    completeQuizRef.current = completeQuiz;
  });

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const r = runStateRef.current;
      if (r.runState !== "running" || !r.runAttemptId || !r.runQuestions?.length) return;
      const answersToSubmit = [];
      const startedAt = runStartedAtRef.current;
      const startedAtMap = runQuestionStartedAtRef.current;
      const answeredAtMap = runQuestionAnsweredAtRef.current;
      for (const question of r.runQuestions) {
        if (r.runAnswered?.includes(question.id)) continue;
        const answer = r.runAnswers?.[question.id];
        if (!answer) continue;
        const qStarted = startedAtMap[question.id] ?? startedAt;
        const qAnswered = answeredAtMap[question.id] ?? Date.now();
        const timeSpent = startedAt != null && qStarted != null ? Math.max(0, Math.round((qAnswered - qStarted) / 1000)) : undefined;
        const base = { question_id: question.id, ...(timeSpent != null && { time_spent: timeSpent }) };
        const inputType = question.input_type || "select";
        if (inputType === "select") {
          const sel = answer.selected || [];
          if (sel.length > 0) answersToSubmit.push({ ...base, selected_options: sel, text_answer: null });
        } else {
          const text = answer.text;
          if (text?.trim()) answersToSubmit.push({ ...base, selected_options: [], text_answer: text });
        }
      }
      e.preventDefault();
      e.returnValue = "";
      attemptsApi.submitAnswersBatchOnUnload(r.runAttemptId, answersToSubmit);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (runQuiz?.question_display_mode !== "one_per_page" || !paginationNumbersRef.current || !paginationButtonRefs.current[currentQuestionIndex]) return;
    const el = paginationButtonRefs.current[currentQuestionIndex];
    if (el) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [currentQuestionIndex, runQuiz?.question_display_mode]);

  useEffect(() => {
    let ignore = false;
    authApi
      .getMe()
      .then((u) => {
        if (ignore) return;
        setCurrentUser(u);
        if (u.role !== "student") navigate("/", { replace: true });
      })
      .catch(() => navigate("/", { replace: true }));
    return () => {
      ignore = true;
    };
  }, [navigate]);

  useEffect(() => {
    setTab("assignments");
  }, [gid]);

  const loadAll = async () => {
    if (!gid || Number.isNaN(gid)) return;
    setLoading(true);
    setError("");
    try {
      const [g, q, a] = await Promise.all([
        groupsApi.getGroup(gid),
        quizzesApi.getQuizzes(gid),
        attemptsApi.getMyAttempts(null),
      ]);
      setGroup(g);
      setQuizzes(Array.isArray(q) ? q : []);
      setAttempts(Array.isArray(a) ? a : []);
    } catch (err) {
      setError(err.message || t("common.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") return;
    loadAll();
  }, [currentUser, gid]);

  const quizTitleMap = useMemo(() => {
    const map = {};
    (quizzes || []).forEach((q) => {
      map[q.id] = q.title;
    });
    return map;
  }, [quizzes]);

  const groupQuizIds = useMemo(() => new Set((quizzes || []).map((q) => q.id)), [quizzes]);

  const attemptsInGroup = useMemo(() => {
    const list = (attempts || []).filter((a) => groupQuizIds.has(a.quiz_id));
    return list.sort((x, y) => new Date(y.started_at).getTime() - new Date(x.started_at).getTime());
  }, [attempts, groupQuizIds]);

  const completedQuizIds = useMemo(() => {
    const s = new Set();
    attemptsInGroup.filter((a) => a.is_completed).forEach((a) => s.add(a.quiz_id));
    return s;
  }, [attemptsInGroup]);

  const quizShowResults = useMemo(() => {
    const m = {};
    (quizzes || []).forEach((q) => {
      m[q.id] = q.show_results !== false;
    });
    return m;
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    const now = Date.now();
    return (quizzes || [])
      .map((q) => {
        const untilMs = q.available_until ? new Date(q.available_until).getTime() : null;
        const expired = !q.manual_close && untilMs != null && !Number.isNaN(untilMs) && untilMs < now;
        const completed = completedQuizIds.has(q.id);
        return { ...q, _expired: expired, _completed: completed };
      })
      .filter((q) => {
        if (assignmentFilter === "incomplete") return !q._completed && !q._expired;
        return q._completed;
      });
  }, [quizzes, completedQuizIds, assignmentFilter]);

  useEffect(() => {
    if (!timerActive || timeLeft === null || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (runQuiz?.timer_mode === "per_question") {
            if (currentQuestionIndex < runQuestions.length - 1) {
              setCurrentQuestionIndex((i) => i + 1);
              setTimeLeft(runQuiz?.question_time_limit || 30);
            } else {
              setTimerActive(false);
              completeQuiz();
            }
          } else if (runQuiz?.timer_mode === "quiz_total") {
            setTimerActive(false);
            completeQuiz();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timerActive, timeLeft, currentQuestionIndex, runQuestions.length, runQuiz]);

  const startOrContinueQuiz = async (quiz) => {
    if (startingQuizId) return;
    setStartingQuizId(quiz.id);
    setError("");
    try {
      const cur = await attemptsApi.getCurrentAttempt(quiz.id);
      let attemptId;
      let questionsOrder = null;

      if (cur.has_attempt) {
        attemptId = cur.attempt_id;
        questionsOrder = cur.questions_order;
      } else {
        const started = await attemptsApi.startAttempt(quiz.id);
        attemptId = started.id;
        questionsOrder = started.questions_order;
      }

      const qs = await quizzesApi.getQuestions(quiz.id);
      const questions = Array.isArray(qs) ? qs : [];
      const answered = cur.has_attempt ? cur.answered_questions || [] : [];

      let orderedQuestions = questions;
      if (questionsOrder && Array.isArray(questionsOrder)) {
        const qMap = {};
        questions.forEach((q) => { qMap[q.id] = q; });
        orderedQuestions = questionsOrder.map((id) => qMap[id]).filter(Boolean);
      }

      const quizForRun = quiz.timer_mode === "per_question"
        ? { ...quiz, question_display_mode: "one_per_page" }
        : quiz;
      setRunQuiz(quizForRun);
      setRunAttemptId(attemptId);
      setRunQuestions(orderedQuestions);
      setRunQuestionsOrder(questionsOrder || orderedQuestions.map((q) => q.id));
      setRunAnswered(answered);
      setRunAnswers({});
      setRunResults(null);
      setCurrentQuestionIndex(0);
      
      if (quiz.timer_mode === "quiz_total" && quiz.time_limit) {
        setTimeLeft(quiz.time_limit);
        setTimerActive(true);
      } else if (quiz.timer_mode === "per_question" && quiz.question_time_limit) {
        setTimeLeft(quiz.question_time_limit);
        setTimerActive(true);
      } else {
        setTimeLeft(null);
        setTimerActive(false);
      }
      
      runStartedAtRef.current = Date.now();
      runQuestionStartedAtRef.current = {};
      runQuestionAnsweredAtRef.current = {};
      const startedAt = runStartedAtRef.current;
      if (quizForRun.question_display_mode === "one_per_page") {
        const firstId = orderedQuestions[0]?.id;
        if (firstId != null) runQuestionStartedAtRef.current[firstId] = startedAt;
      } else {
        orderedQuestions.forEach((q) => { if (q?.id != null) runQuestionStartedAtRef.current[q.id] = startedAt; });
      }
      setFullscreenPromptDismissed(!quiz.anti_cheating_mode);
      setVisibilitySwitchCount(0);
      setAntiCheatingTabWarningShown(false);
      setAntiCheatingAutoSubmitted(false);
      antiCheatingSubmittedRef.current = false;
      setRunState("running");
    } catch (err) {
      setError(err.message || t("student.quizzes.errorStart"));
    } finally {
      setStartingQuizId(null);
    }
  };

  useEffect(() => {
    if (runState !== "running" || !runQuestions.length) return;
    const q = runQuestions[currentQuestionIndex];
    if (q?.id != null && runQuestionStartedAtRef.current[q.id] == null) {
      runQuestionStartedAtRef.current[q.id] = Date.now();
    }
  }, [runState, currentQuestionIndex, runQuestions]);

  useEffect(() => {
    if (runState !== "running" || !runQuiz?.anti_cheating_mode || !fullscreenPromptDismissed) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        visibilityHiddenAlreadyProcessedRef.current = false;
        return;
      }
      if (visibilityHiddenAlreadyProcessedRef.current) return;
      visibilityHiddenAlreadyProcessedRef.current = true;
      setVisibilitySwitchCount((prev) => {
        const next = prev + 1;
        if (runAttemptId && lastLoggedSwitchCountRef.current !== next) {
          lastLoggedSwitchCountRef.current = next;
          attemptsApi.logAntiCheatingEvent(runAttemptId, {
            event_type: "tab_switch",
            details: { switch_count: next },
          }).catch(() => {});
        }
        if (next >= 2 && !antiCheatingSubmittedRef.current) {
          antiCheatingSubmittedRef.current = true;
          setAntiCheatingAutoSubmitted(true);
          setTimeout(() => completeQuizRef.current?.(), 0);
        }
        return next;
      });
      setAntiCheatingTabWarningShown(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [runState, runQuiz?.anti_cheating_mode, fullscreenPromptDismissed, runAttemptId]);

  const handleAnswerChange = (questionId, value, isText = false) => {
    if (runQuestionAnsweredAtRef.current[questionId] == null) {
      runQuestionAnsweredAtRef.current[questionId] = Date.now();
    }
    setRunAnswers((prev) => ({
      ...prev,
      [questionId]: isText
        ? { ...prev[questionId], text: value }
        : { ...prev[questionId], selected: value },
    }));
  };

  const getTimeSpentForQuestion = (questionId) => {
    const started = runQuestionStartedAtRef.current[questionId] ?? runStartedAtRef.current;
    const answered = runQuestionAnsweredAtRef.current[questionId] ?? Date.now();
    if (started == null) return undefined;
    const sec = Math.round((answered - started) / 1000);
    return Math.max(0, sec);
  };

  const completeQuiz = async () => {
    setRunCompleting(true);
    setError("");
    try {
      const answersToSubmit = [];

      for (const question of runQuestions) {
        if (runAnswered.includes(question.id)) continue;

        const answer = runAnswers[question.id];
        if (!answer) continue;

        const inputType = question.input_type || "select";
        const timeSpent = getTimeSpentForQuestion(question.id);

        if (inputType === "select") {
          const selectedOptions = answer.selected || [];
          if (selectedOptions.length > 0) {
            answersToSubmit.push({
              question_id: question.id,
              selected_options: selectedOptions,
              text_answer: null,
              ...(timeSpent != null && { time_spent: timeSpent }),
            });
          }
        } else {
          const textAnswer = answer.text;
          if (textAnswer?.trim()) {
            answersToSubmit.push({
              question_id: question.id,
              selected_options: [],
              text_answer: textAnswer,
              ...(timeSpent != null && { time_spent: timeSpent }),
            });
          }
        }
      }

      await attemptsApi.submitAnswersBatch(runAttemptId, answersToSubmit, true);
      
      if (runQuiz?.show_results === false) {
        exitQuizRun();
        return;
      }
      
      const res = await attemptsApi.getAttemptResults(runAttemptId);
      setRunResults(res);
      setRunState("results");
    } catch (err) {
      setError(err.message || t("student.quizzes.errorComplete"));
    } finally {
      setRunCompleting(false);
    }
  };

  const exitQuizRun = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()?.catch(() => {});
    }
    setRunState(null);
    setRunQuiz(null);
    setRunAttemptId(null);
    setRunQuestions([]);
    setRunQuestionsOrder([]);
    setRunAnswered([]);
    setRunAnswers({});
    setRunResults(null);
    setCurrentQuestionIndex(0);
    setTimeLeft(null);
    setTimerActive(false);
    setShowCorrectAnswers(false);
    setFullscreenPromptDismissed(false);
    setVisibilitySwitchCount(0);
    setAntiCheatingTabWarningShown(false);
    setAntiCheatingAutoSubmitted(false);
    setError("");
    antiCheatingSubmittedRef.current = false;
    visibilityHiddenAlreadyProcessedRef.current = false;
    lastLoggedSwitchCountRef.current = 0;
    runStartedAtRef.current = null;
    runQuestionStartedAtRef.current = {};
    runQuestionAnsweredAtRef.current = {};
    loadAll();
  };

  const loadAttemptDetail = async (id) => {
    setAttemptDetailId(id);
    setAttemptDetail(null);
    setShowCorrectAnswersInDetail(false);
    try {
      const d = await attemptsApi.getAttemptResults(id);
      setAttemptDetail(d);
    } catch (err) {
      setError(err.message || t("student.attempts.errorLoad"));
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  const locale = i18n.language === "lt" ? "lt-LT" : i18n.language === "en" ? "en-US" : "ru-RU";

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      {!showQuizRun && (
        <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/student")}
                  className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("student.groups.backToGroups")}
                </button>
                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: group?.color || "#6366f1" }}
                  />
                  <h1 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
                    {group?.name || t("teacher.groups.loading")}
                  </h1>
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {t("student.groups.teacher")}: {group?.teacher_name || (group?.teacher_id ? `#${group.teacher_id}` : "—")}
                  {" · "}
                  {t("student.groups.subject")}: {group?.subject || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={loadAll}
                disabled={loading}
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                title={t("common.refresh")}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {TABS.map((tabItem) => (
                <button
                  key={tabItem.id}
                  onClick={() => setTab(tabItem.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    tab === tabItem.id
                      ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  }`}
                >
                  <tabItem.icon className="h-4 w-4" />
                  {tabItem.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 px-4 py-6 sm:px-6 lg:px-8 overflow-x-hidden ${showQuizRun ? "flex min-h-0 flex-col" : ""}`}>
        <div className={`mx-auto w-full min-w-0 ${showQuizRun ? "flex min-h-0 flex-1 flex-col max-w-6xl" : "max-w-6xl"}`}>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button onClick={() => setError("")} className="ml-auto">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {showQuizRun ? (
            runState === "running" && runQuiz?.anti_cheating_mode && !fullscreenPromptDismissed ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                <h3 className="text-lg font-semibold text-[var(--text)]">{t("student.groupPage.antiCheatingFullscreenTitle")}</h3>
                <p className="mt-3 text-sm text-[var(--text-muted)] max-w-md">
                  {t("student.groupPage.antiCheatingFullscreenPrompt")}
                </p>
                <p className="mt-3 text-sm text-[var(--text-muted)] max-w-md">
                  {t("student.groupPage.antiCheatingFullscreenPrompt2")}
                </p>
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await document.documentElement.requestFullscreen?.();
                      } catch (_) {}
                      setFullscreenPromptDismissed(true);
                    }}
                    className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                  >
                    {t("student.groupPage.antiCheatingEnterFullscreen")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFullscreenPromptDismissed(true)}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  >
                    {t("student.groupPage.antiCheatingContinueAnyway")}
                  </button>
                </div>
              </div>
            ) : (
            <div className={runState === "running" && runQuiz?.question_display_mode === "one_per_page" ? "flex flex-col min-h-0 flex-1" : ""}>
              <div className="mb-6 flex shrink-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-[var(--text)] truncate">{runQuiz?.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {t("student.groupPage.answered")}: {runAnswered.length} / {runQuestions.length}
                  </p>
                </div>
                {runState === "results" ? (
                  <button
                    type="button"
                    onClick={exitQuizRun}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  >
                    {t("student.groupPage.close")}
                  </button>
                ) : runQuiz?.timer_mode !== "per_question" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (runQuiz?.timer_mode === "quiz_total") setExitConfirmOpen(true);
                      else exitQuizRun();
                    }}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  >
                    {t("student.groupPage.exit")}
                  </button>
                ) : null}
              </div>

              {runState === "running" && runQuiz?.anti_cheating_mode && fullscreenPromptDismissed && antiCheatingTabWarningShown && visibilitySwitchCount >= 1 && (
                <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  {t("student.groupPage.antiCheatingTabWarning")}
                </div>
              )}

              {runState === "results" && antiCheatingAutoSubmitted && (
                <p className="mb-4 text-sm text-[var(--text-muted)]">
                  {t("student.groupPage.antiCheatingSubmitted")}
                </p>
              )}

              {exitConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
                    <p className="text-[var(--text)]">{t("student.groupPage.exitConfirmMessage")}</p>
                    <div className="mt-6 flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => setExitConfirmOpen(false)}
                        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]"
                      >
                        {t("student.groupPage.exitConfirmNo")}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setExitConfirmOpen(false);
                          await completeQuiz();
                        }}
                        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                      >
                        {t("student.groupPage.exitConfirmYes")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {runState === "results" && runResults && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--text)]">{t("student.groupPage.results")}</h3>
                    {runResults.allow_show_answers && (
                      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={showCorrectAnswers}
                          onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                        />
                        {t("student.groupPage.showCorrectAnswers")}
                      </label>
                    )}
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[var(--accent)]">
                    {runResults.attempt?.score} / {runResults.attempt?.max_score}
                    <span className="ml-2 text-lg font-normal text-[var(--text-muted)]">
                      ({Math.round(runResults.percentage ?? 0)}%)
                    </span>
                  </p>
                  <div className="mt-6 space-y-3">
                    {(runResults.answers || []).map((a, i) => (
                      <div key={i} className={`rounded-lg border p-4 ${
                        a.is_correct ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                      }`}>
                        <p className="font-medium text-[var(--text)]">{a.question_text}</p>
                        <p
                          className={`mt-2 flex items-center gap-2 text-sm ${
                            a.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {a.is_correct ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          {a.points_earned} / {a.max_points} {t("student.groupPage.points")}
                        </p>
                        {showCorrectAnswers && !a.is_correct && (
                          <div className="mt-3 rounded-lg bg-[var(--bg)] p-3">
                            <p className="text-sm text-[var(--text-muted)]">
                              <span className="font-medium">{t("student.groupPage.yourAnswer")}:</span>{" "}
                              {a.input_type === "select" 
                                ? (a.selected_texts?.join(", ") || t("student.groupPage.noAnswer"))
                                : (a.text_answer || t("student.groupPage.noAnswer"))
                              }
                            </p>
                            <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                              <span className="font-medium">{t("student.groupPage.correctAnswerWas")}:</span>{" "}
                              {a.input_type === "select"
                                ? (a.correct_option_texts?.join(", ") || "-")
                                : (a.correct_text_answer || "-")
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {runState === "running" && (
                <div
                  className={runQuiz?.question_display_mode === "one_per_page" ? "flex flex-col min-h-0 flex-1" : "space-y-4"}
                  {...(runQuiz?.anti_cheating_mode && {
                    style: { userSelect: "none" },
                    onCopy: (e) => e.preventDefault(),
                    onCut: (e) => e.preventDefault(),
                    onKeyDown: (e) => {
                      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C" || e.key === "x" || e.key === "X")) e.preventDefault();
                    },
                  })}
                >
                  <div className={runQuiz?.question_display_mode === "one_per_page" ? "flex-1 min-h-0 space-y-4 overflow-y-auto overflow-x-hidden pb-24" : ""}>
                    {timerActive && timeLeft !== null && (
                      <div className={`rounded-xl border p-4 flex items-center justify-between ${
                        timeLeft <= 10 ? "border-red-500/50 bg-red-500/10" : "border-[var(--border)] bg-[var(--surface)]"
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Clock className={`h-5 w-5 shrink-0 ${timeLeft <= 10 ? "text-red-500" : "text-[var(--accent)]"}`} />
                          <span className={`font-medium truncate ${timeLeft <= 10 ? "text-red-500" : "text-[var(--text)]"}`}>
                            {runQuiz?.timer_mode === "quiz_total" 
                              ? t("student.groupPage.quizTimeLeft") 
                              : t("student.groupPage.questionTimeLeft")}
                          </span>
                        </div>
                        <span className={`text-xl font-bold shrink-0 ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-[var(--text)]"}`}>
                          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    )}
                  
                    {(runQuiz?.question_display_mode === "one_per_page" ? [runQuestions[currentQuestionIndex]].filter(Boolean) : runQuestions).map((q, idx) => {
                    const actualIdx = runQuiz?.question_display_mode === "one_per_page" ? currentQuestionIndex : idx;
                    const isAnswered = runAnswered.includes(q.id);
                    const answer = runAnswers[q.id] || {};
                    const inputType = q.input_type || "select";
                    const isMultiple = q.is_multiple_choice;

                    return (
                      <div
                        key={q.id}
                        className={`rounded-xl border bg-[var(--surface)] p-4 sm:p-6 transition-opacity min-w-0 ${
                          isAnswered
                            ? "border-green-500/30 bg-green-500/5 opacity-75"
                            : "border-[var(--border)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xs font-medium text-[var(--accent)]">
                                {actualIdx + 1}
                              </span>
                              <span className="font-medium text-[var(--text)] break-words">{q.text}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                              <span>{q.points} {t("student.groupPage.points")}</span>
                              {inputType === "select" && isMultiple && (
                                <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5">
                                  {t("student.groupPage.multipleChoice")}
                                </span>
                              )}
                            </div>
                          </div>
                          {isAnswered && (
                            <CheckCircle className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                          )}
                        </div>

                        {!isAnswered && (
                          <div className="mt-4">
                            {inputType === "select" ? (
                              <div className="space-y-2">
                                {(q.options || []).map((opt) => {
                                  const selected = (answer.selected || []).includes(opt.id);
                                  return (
                                    <label
                                      key={opt.id}
                                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors min-w-0 ${
                                        selected
                                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                                          : "border-[var(--border)] hover:bg-[var(--bg-card)]"
                                      }`}
                                    >
                                      <input
                                        type={isMultiple ? "checkbox" : "radio"}
                                        name={`q-${q.id}`}
                                        checked={selected}
                                        onChange={() => {
                                          if (isMultiple) {
                                            const prev = answer.selected || [];
                                            const next = selected
                                              ? prev.filter((id) => id !== opt.id)
                                              : [...prev, opt.id];
                                            handleAnswerChange(q.id, next);
                                          } else {
                                            handleAnswerChange(q.id, [opt.id]);
                                          }
                                        }}
                                        className="h-4 w-4 shrink-0"
                                      />
                                      <span className="min-w-0 break-words text-[var(--text)]">{opt.text}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <input
                                type={inputType === "number" ? "number" : "text"}
                                value={answer.text || ""}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value, true)}
                                placeholder={inputType === "number" ? t("student.groupPage.enterNumber") : t("student.groupPage.enterAnswer")}
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[var(--text)]"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>

                  {runQuiz?.question_display_mode === "one_per_page" && (
                    <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                      <div className="mx-auto flex max-w-6xl items-center gap-3">
                        <button
                          onClick={() => {
                            setCurrentQuestionIndex((i) => Math.max(0, i - 1));
                            if (runQuiz?.timer_mode === "per_question" && runQuiz?.question_time_limit) {
                              setTimeLeft(runQuiz.question_time_limit);
                            }
                          }}
                          disabled={currentQuestionIndex === 0 || runQuiz?.timer_mode === "per_question"}
                          className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-50"
                        >
                          {t("student.groupPage.prevQuestion")}
                        </button>
                        <div
                          ref={paginationNumbersRef}
                          className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth py-1"
                          style={{ WebkitOverflowScrolling: "touch" }}
                        >
                          <div className="flex min-w-full w-max justify-center gap-1">
                            {runQuestions.map((_, i) => {
                              const isPerQuestion = runQuiz?.timer_mode === "per_question";
                              const canClickNumber = !isPerQuestion || i === currentQuestionIndex;
                              return (
                                <button
                                  key={i}
                                  ref={(el) => { paginationButtonRefs.current[i] = el; }}
                                  onClick={canClickNumber ? () => {
                                    setCurrentQuestionIndex(i);
                                    if (runQuiz?.timer_mode === "per_question" && runQuiz?.question_time_limit) {
                                      setTimeLeft(runQuiz.question_time_limit);
                                    }
                                  } : undefined}
                                  disabled={!canClickNumber}
                                  className={`h-8 min-w-[2rem] shrink-0 rounded-full px-2 text-sm font-medium transition-colors ${
                                    i === currentQuestionIndex
                                      ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                                      : runAnswered.includes(runQuestions[i]?.id)
                                        ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                        : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg-card)]"
                                  } disabled:opacity-70 disabled:cursor-default`}
                                >
                                  {i + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {currentQuestionIndex < runQuestions.length - 1 ? (
                          <button
                            onClick={() => {
                              setCurrentQuestionIndex((i) => Math.min(runQuestions.length - 1, i + 1));
                              if (runQuiz?.timer_mode === "per_question" && runQuiz?.question_time_limit) {
                                setTimeLeft(runQuiz.question_time_limit);
                              }
                            }}
                            disabled={runQuiz?.timer_mode === "per_question" && (() => {
                              const q = runQuestions[currentQuestionIndex];
                              if (!q) return true;
                              if (runAnswered.includes(q.id)) return false;
                              const a = runAnswers[q.id];
                              if (!a) return true;
                              return (q.input_type || "select") === "select" ? !(a.selected?.length > 0) : !(a.text?.trim());
                            })()}
                            className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-50"
                          >
                            {t("student.groupPage.nextQuestion")}
                          </button>
                        ) : (
                          <button
                            onClick={completeQuiz}
                            disabled={runCompleting}
                            className="flex shrink-0 items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {runCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            {t("student.groupPage.completeAssignment")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {runQuiz?.question_display_mode !== "one_per_page" && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={completeQuiz}
                        disabled={runCompleting}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {runCompleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        {t("student.groupPage.completeAssignment")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          ) : (
            <>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : tab === "assignments" ? (
                <div>
                  <div className="mb-4">
                    <select
                      value={assignmentFilter}
                      onChange={(e) => setAssignmentFilter(e.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                    >
                      <option value="incomplete">{t("student.groupPage.filter.incomplete")}</option>
                      <option value="completed">{t("student.groupPage.filter.completed")}</option>
                    </select>
                  </div>

                  {filteredQuizzes.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {assignmentFilter === "incomplete" ? t("student.groupPage.noActiveAssignments") : t("student.groupPage.noCompletedAssignments")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredQuizzes.map((q) => (
                        <div
                          key={q.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                        >
                          <div>
                            <div className="font-medium text-[var(--text)]">{q.title}</div>
                            <div className="mt-1 text-sm text-[var(--text-muted)]">
                              {q.manual_close ? (
                                t("student.groupPage.untilTeacherCloses")
                              ) : (
                                <>{t("student.groupPage.availableUntil")}: {formatDate(q.available_until, locale)}</>
                              )}
                            </div>
                          </div>
                          {q._completed ? (
                            <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-600 dark:text-green-400">
                              {t("student.groupPage.completed")}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startOrContinueQuiz(q)}
                              disabled={startingQuizId !== null}
                              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {startingQuizId === q.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {t("common.loading")}
                                </>
                              ) : (
                                <>
                                  {t("student.groupPage.start")}
                                  <ChevronRight className="h-4 w-4" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {attemptsInGroup.filter((a) => a.is_completed).length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {t("student.groupPage.noCompletedAttempts")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attemptsInGroup.filter((a) => a.is_completed).map((a) => {
                        const canShowResults = quizShowResults[a.quiz_id];
                        const pct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
                        return (
                          <div
                            key={a.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                          >
                            <div>
                              <div className="font-medium text-[var(--text)]">
                                {quizTitleMap[a.quiz_id] ?? `#${a.quiz_id}`}
                              </div>
                              <div className="mt-1 text-sm text-[var(--text-muted)]">
                                {formatDate(a.completed_at, locale)}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {canShowResults ? (
                                <>
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-[var(--accent)]">
                                      {a.score} / {a.max_score}
                                    </div>
                                    <div className="text-sm text-[var(--text-muted)]">{pct}%</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => loadAttemptDetail(a.id)}
                                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                                  >
                                    {t("student.groupPage.details")}
                                  </button>
                                </>
                              ) : (
                                <span className="rounded-full bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-muted)]">
                                  {t("student.groupPage.completed")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {attemptDetailId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] p-4">
                      <h2 className="text-lg font-semibold text-[var(--text)]">{t("student.groupPage.results")}</h2>
                      <div className="flex items-center gap-2">
                        {attemptDetail?.allow_show_answers && (
                          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                            <input
                              type="checkbox"
                              checked={showCorrectAnswersInDetail}
                              onChange={(e) => setShowCorrectAnswersInDetail(e.target.checked)}
                            />
                            {t("student.groupPage.showCorrectAnswers")}
                          </label>
                        )}
                        <button
                          onClick={() => {
                            setAttemptDetailId(null);
                            setAttemptDetail(null);
                          }}
                          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      {!attemptDetail ? (
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--text-muted)]" />
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-[var(--text-muted)]">
                            {t("student.groupPage.score")}: {attemptDetail.attempt?.score} / {attemptDetail.attempt?.max_score} (
                            {Math.round(attemptDetail.percentage ?? 0)}%)
                          </p>
                          {(attemptDetail.answers || []).map((ans, i) => (
                            <div
                              key={i}
                              className={`rounded-lg border p-4 ${
                                ans.is_correct ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                              }`}
                            >
                              <p className="font-medium text-[var(--text)]">{ans.question_text}</p>
                              <p
                                className={`mt-2 flex items-center gap-2 text-sm ${
                                  ans.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {ans.is_correct ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                {ans.points_earned} / {ans.max_points} {t("student.groupPage.points")}
                              </p>
                              {showCorrectAnswersInDetail && !ans.is_correct && (
                                <div className="mt-3 rounded-lg bg-[var(--bg)] p-3">
                                  <p className="text-sm text-[var(--text-muted)]">
                                    <span className="font-medium">{t("student.groupPage.yourAnswer")}:</span>{" "}
                                    {ans.input_type === "select"
                                      ? (ans.selected_texts?.join(", ") || t("student.groupPage.noAnswer"))
                                      : (ans.text_answer || t("student.groupPage.noAnswer"))}
                                  </p>
                                  <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                                    <span className="font-medium">{t("student.groupPage.correctAnswerWas")}:</span>{" "}
                                    {ans.input_type === "select"
                                      ? (ans.correct_option_texts?.join(", ") || "-")
                                      : (ans.correct_text_answer || "-")}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) }
        </div>
      </div>
    </div>
  );
}
