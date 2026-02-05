import { useEffect, useMemo, useState } from "react";
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

  const [attemptDetailId, setAttemptDetailId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);

  const showQuizRun = runState === "running" || runState === "results";

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

  const startOrContinueQuiz = async (quiz) => {
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

      setRunQuiz(quiz);
      setRunAttemptId(attemptId);
      setRunQuestions(orderedQuestions);
      setRunQuestionsOrder(questionsOrder || orderedQuestions.map((q) => q.id));
      setRunAnswered(answered);
      setRunAnswers({});
      setRunResults(null);
      setRunState("running");
    } catch (err) {
      setError(err.message || t("student.quizzes.errorStart"));
    }
  };

  const handleAnswerChange = (questionId, value, isText = false) => {
    setRunAnswers((prev) => ({
      ...prev,
      [questionId]: isText
        ? { ...prev[questionId], text: value }
        : { ...prev[questionId], selected: value },
    }));
  };

  const completeQuiz = async () => {
    setRunCompleting(true);
    setError("");
    try {
      for (const question of runQuestions) {
        if (runAnswered.includes(question.id)) continue;
        
        const answer = runAnswers[question.id];
        if (!answer) continue;

        const inputType = question.input_type || "select";
        let selectedOptions = [];
        let textAnswer = null;

        if (inputType === "select") {
          selectedOptions = answer.selected || [];
          if (!selectedOptions.length) continue;
        } else {
          textAnswer = answer.text;
          if (!textAnswer?.trim()) continue;
        }

        try {
          await attemptsApi.submitAnswer(question.id, selectedOptions, textAnswer);
        } catch (err) {
          console.error(`Failed to submit answer for question ${question.id}:`, err);
        }
      }

      await attemptsApi.completeAttempt(runAttemptId);
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
    setRunState(null);
    setRunQuiz(null);
    setRunAttemptId(null);
    setRunQuestions([]);
    setRunQuestionsOrder([]);
    setRunAnswered([]);
    setRunAnswers({});
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
                    {group?.name || t("teacher.groups.create")}
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
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text)]">{runQuiz?.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {t("student.groupPage.answered")}: {runAnswered.length} / {runQuestions.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exitQuizRun}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                >
                  {runState === "results" ? t("student.groupPage.close") : t("student.groupPage.exit")}
                </button>
              </div>

              {runState === "results" && runResults && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <h3 className="text-lg font-semibold text-[var(--text)]">{t("student.groupPage.results")}</h3>
                  <p className="mt-2 text-2xl font-bold text-[var(--accent)]">
                    {runResults.attempt?.score} / {runResults.attempt?.max_score}
                    <span className="ml-2 text-lg font-normal text-[var(--text-muted)]">
                      ({Math.round(runResults.percentage ?? 0)}%)
                    </span>
                  </p>
                  <div className="mt-6 space-y-3">
                    {(runResults.answers || []).map((a, i) => (
                      <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
                        <p className="font-medium text-[var(--text)]">{a.question_text}</p>
                        <p
                          className={`mt-2 flex items-center gap-2 text-sm ${
                            a.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {a.is_correct ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          {a.points_earned} / {a.max_points} {t("student.groupPage.points")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {runState === "running" && (
                <div className="space-y-4">
                  {runQuestions.map((q, idx) => {
                    const isAnswered = runAnswered.includes(q.id);
                    const answer = runAnswers[q.id] || {};
                    const inputType = q.input_type || "select";
                    const isMultiple = q.is_multiple_choice;

                    return (
                      <div
                        key={q.id}
                        className={`rounded-xl border bg-[var(--surface)] p-6 transition-opacity ${
                          isAnswered
                            ? "border-green-500/30 bg-green-500/5 opacity-75"
                            : "border-[var(--border)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xs font-medium text-[var(--accent)]">
                                {idx + 1}
                              </span>
                              <span className="font-medium text-[var(--text)]">{q.text}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                              <span>{q.points} {t("student.groupPage.points")}</span>
                              {inputType === "select" && isMultiple && (
                                <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5">
                                  {t("student.groupPage.multipleChoice")}
                                </span>
                              )}
                              {q.has_time_limit && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {q.time_limit}s
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
                                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
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
                                        className="h-4 w-4"
                                      />
                                      <span className="text-[var(--text)]">{opt.text}</span>
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
                </div>
              )}
            </div>
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
                              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                            >
                              {t("student.groupPage.start")}
                              <ChevronRight className="h-4 w-4" />
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
                            <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
                              <p className="font-medium text-[var(--text)]">{ans.question_text}</p>
                              <p
                                className={`mt-2 flex items-center gap-2 text-sm ${
                                  ans.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {ans.is_correct ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                {ans.points_earned} / {ans.max_points} {t("student.groupPage.points")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
