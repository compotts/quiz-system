import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ChevronRight, Loader2, RefreshCw, X } from "lucide-react";
import { authApi, attemptsApi, groupsApi, quizzesApi } from "../services/api.js";

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

export default function StudentGroupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams();
  const gid = Number(groupId);

  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [group, setGroup] = useState(null);
  const [tab, setTab] = useState("assignments");

  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);

  const [runState, setRunState] = useState(null);
  const [runQuiz, setRunQuiz] = useState(null);
  const [runAttemptId, setRunAttemptId] = useState(null);
  const [runQuestions, setRunQuestions] = useState([]);
  const [runAnswered, setRunAnswered] = useState([]);
  const [runCurrentIndex, setRunCurrentIndex] = useState(0);
  const [runSelected, setRunSelected] = useState([]);
  const [runSubmitLoading, setRunSubmitLoading] = useState(false);
  const [runCompleteLoading, setRunCompleteLoading] = useState(false);
  const [runResults, setRunResults] = useState(null);

  const [attemptDetailId, setAttemptDetailId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);

  const showQuizRun = runState === "running" || runState === "results";
  const currentQ = runQuestions[runCurrentIndex];
  const singleChoice = currentQ && (currentQ.question_type || "").startsWith("single");

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
      setError(err.message || "ошибка загрузки данных");
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

  const assignments = useMemo(() => {
    const now = Date.now();
    return (quizzes || [])
      .filter((q) => !completedQuizIds.has(q.id))
      .map((q) => {
        const untilMs = q.available_until ? new Date(q.available_until).getTime() : null;
        const expired = untilMs != null && !Number.isNaN(untilMs) && untilMs < now;
        return { ...q, _expired: expired };
      });
  }, [quizzes, completedQuizIds]);

  const startOrContinueQuiz = async (quiz) => {
    setError("");
    try {
      const cur = await attemptsApi.getCurrentAttempt(quiz.id);
      let attemptId;
      if (cur.has_attempt) {
        attemptId = cur.attempt_id;
      } else {
        const started = await attemptsApi.startAttempt(quiz.id);
        attemptId = started.id;
      }
      const qs = await quizzesApi.getQuestions(quiz.id);
      const questions = Array.isArray(qs) ? qs : [];
      const answered = cur.has_attempt ? cur.answered_questions || [] : [];
      let idx = 0;
      const order = questions.map((q) => q.id);
      for (let i = 0; i < order.length; i++) {
        if (!answered.includes(order[i])) {
          idx = i;
          break;
        }
        idx = i + 1;
      }
      setRunQuiz(quiz);
      setRunAttemptId(attemptId);
      setRunQuestions(questions);
      setRunAnswered(answered);
      setRunCurrentIndex(Math.min(idx, questions.length));
      setRunSelected([]);
      setRunResults(null);
      setRunState("running");
    } catch (err) {
      setError(err.message || t("student.quizzes.errorStart"));
    }
  };

  const submitCurrentAnswer = async () => {
    const q = runQuestions[runCurrentIndex];
    if (!q || runSubmitLoading) return;
    const single = (q.question_type || "").startsWith("single");
    const optIds = (q.options || []).map((o) => o.id);
    const selected = single ? (runSelected.length ? [runSelected[0]] : []) : runSelected.filter((id) => optIds.includes(id));
    if (!selected.length) return;

    setRunSubmitLoading(true);
    setError("");
    try {
      await attemptsApi.submitAnswer(q.id, selected);
      const nextAnswered = [...runAnswered, q.id];
      setRunAnswered(nextAnswered);
      setRunSelected([]);
      let nextIdx = runCurrentIndex + 1;
      while (nextIdx < runQuestions.length && nextAnswered.includes(runQuestions[nextIdx].id)) nextIdx++;
      setRunCurrentIndex(nextIdx);
      if (nextIdx >= runQuestions.length) {
        setRunCompleteLoading(true);
        await attemptsApi.completeAttempt(runAttemptId);
        const res = await attemptsApi.getAttemptResults(runAttemptId);
        setRunResults(res);
        setRunState("results");
      }
    } catch (err) {
      setError(err.message || t("student.quizzes.errorSubmit"));
    } finally {
      setRunSubmitLoading(false);
      setRunCompleteLoading(false);
    }
  };

  const exitQuizRun = () => {
    setRunState(null);
    setRunQuiz(null);
    setRunAttemptId(null);
    setRunQuestions([]);
    setRunAnswered([]);
    setRunResults(null);
    setError("");
    loadAll();
  };

  const loadAttemptDetail = async (id) => {
    setAttemptDetailId(id);
    setAttemptDetail(null);
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
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  ← Назад к группам
                </button>
                <h1 className="mt-2 text-xl font-semibold text-[var(--text)] sm:text-2xl">
                  {group?.name || "Группа"}
                </h1>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Преподаватель: {group?.teacher_name || (group?.teacher_id ? `#${group.teacher_id}` : "—")}
                  {" · "}
                  Предмет: {group?.subject || "—"}
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
          </div>
        </div>
      )}

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

          {showQuizRun ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={exitQuizRun}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                >
                  {t("student.quizzes.backToQuizzes")}
                </button>
                {runState === "running" && runQuiz && (
                  <span className="text-sm text-[var(--text-muted)]">
                    {runQuiz.title} — {runCurrentIndex + 1} / {runQuestions.length}
                  </span>
                )}
              </div>

              {runState === "results" && runResults && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <h2 className="text-lg font-semibold text-[var(--text)]">{t("student.quizzes.results")}</h2>
                  <p className="mt-2 text-[var(--text-muted)]">
                    {runResults.attempt?.score} / {runResults.attempt?.max_score} ({Math.round(runResults.percentage ?? 0)}%)
                  </p>
                  <div className="mt-4 space-y-3">
                    {(runResults.answers || []).map((a, i) => (
                      <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                        <p className="font-medium text-[var(--text)]">{a.question_text}</p>
                        <p
                          className={`mt-1 text-sm ${
                            a.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {a.is_correct ? "✓" : "✗"} {a.points_earned} / {a.max_points}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={exitQuizRun}
                    className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                  >
                    {t("student.quizzes.backToQuizzes")}
                  </button>
                </div>
              )}

              {runState === "running" && currentQ && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <p className="font-medium text-[var(--text)]">{currentQ.text}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {t("teacher.quizzes.points")}: {currentQ.points} ·{" "}
                    {singleChoice ? t("teacher.quizzes.quizTypeSingle") : t("teacher.quizzes.quizTypeMultiple")}
                  </p>
                  <div className="mt-4 space-y-2">
                    {(currentQ.options || []).map((opt) => {
                      const sel = runSelected.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                            sel ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:bg-[var(--bg-card)]"
                          }`}
                        >
                          <input
                            type={singleChoice ? "radio" : "checkbox"}
                            name="opt"
                            checked={sel}
                            onChange={() => {
                              if (singleChoice) setRunSelected([opt.id]);
                              else setRunSelected((s) => (s.includes(opt.id) ? s.filter((x) => x !== opt.id) : [...s, opt.id]));
                            }}
                            className="h-4 w-4"
                          />
                          <span className="text-[var(--text)]">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    onClick={submitCurrentAnswer}
                    disabled={runSubmitLoading || runCompleteLoading || !runSelected.length}
                    className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90 disabled:opacity-50"
                  >
                    {runSubmitLoading || runCompleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{" "}
                    {runCurrentIndex < runQuestions.length - 1 ? t("student.quizzes.submitAnswer") : t("student.quizzes.complete")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab("assignments")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    tab === "assignments"
                      ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  }`}
                >
                  Задания
                </button>
                <button
                  type="button"
                  onClick={() => setTab("history")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    tab === "history"
                      ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  }`}
                >
                  История
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : tab === "assignments" ? (
                assignments.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                    Активных заданий нет
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((q) => (
                      <div
                        key={q.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                      >
                        <div>
                          <div className="font-medium text-[var(--text)]">{q.title}</div>
                          <div className="mt-1 text-sm text-[var(--text-muted)]">
                            Доступно до: {q.available_until ? formatDate(q.available_until) : "—"}
                            {q._expired ? " (истекло)" : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={q._expired}
                          onClick={() => startOrContinueQuiz(q)}
                          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90 disabled:opacity-50"
                        >
                          {t("student.quizzes.start")}
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : attemptsInGroup.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                  История пустая
                </div>
              ) : (
                <div className="space-y-3">
                  {attemptsInGroup.map((a) => {
                    const status = a.is_completed ? "выполнил" : "не выполнил";
                    const pct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
                    return (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                      >
                        <div>
                          <div className="font-medium text-[var(--text)]">{quizTitleMap[a.quiz_id] ?? `Quiz #${a.quiz_id}`}</div>
                          <div className="mt-1 text-sm text-[var(--text-muted)]">
                            Статус: {status}
                            {a.is_completed ? ` · ${a.score} / ${a.max_score} (${pct}%)` : ""}
                            {" · "}
                            {a.is_completed ? formatDate(a.completed_at) : formatDate(a.started_at)}
                          </div>
                        </div>
                        {a.is_completed ? (
                          <button
                            type="button"
                            onClick={() => loadAttemptDetail(a.id)}
                            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                          >
                            {t("student.attempts.viewDetails")}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {attemptDetailId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
                  <div className="my-8 w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-[var(--text)]">{t("student.attempts.viewDetails")}</h2>
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
                    {!attemptDetail ? (
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-[var(--text-muted)]">
                          {t("student.attempts.score")}: {attemptDetail.attempt?.score} / {attemptDetail.attempt?.max_score} (
                          {Math.round(attemptDetail.percentage ?? 0)}%)
                        </p>
                        {(attemptDetail.answers || []).map((ans, i) => (
                          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                            <p className="font-medium text-[var(--text)]">{ans.question_text}</p>
                            <p
                              className={`mt-1 text-sm ${
                                ans.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {ans.is_correct ? "✓" : "✗"} {ans.points_earned} / {ans.max_points}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

