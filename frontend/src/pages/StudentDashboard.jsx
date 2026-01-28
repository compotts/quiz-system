import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Users,
  ClipboardList,
  History,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  ChevronRight,
} from "lucide-react";
import {
  authApi,
  groupsApi,
  quizzesApi,
  attemptsApi,
} from "../services/api.js";

const TABS = [
  { id: "groups", icon: Users },
  { id: "quizzes", icon: ClipboardList },
  { id: "attempts", icon: History },
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

export default function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("groups");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Groups
  const [groups, setGroups] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Quizzes
  const [quizzes, setQuizzes] = useState([]);
  const [groupsForQuizzes, setGroupsForQuizzes] = useState([]);
  const [quizGroupFilter, setQuizGroupFilter] = useState("");
  const [currentAttemptByQuiz, setCurrentAttemptByQuiz] = useState({});

  // Quiz run
  const [runState, setRunState] = useState(null); // null | 'running' | 'results'
  const [runQuiz, setRunQuiz] = useState(null);
  const [runAttemptId, setRunAttemptId] = useState(null);
  const [runQuestions, setRunQuestions] = useState([]);
  const [runAnswered, setRunAnswered] = useState([]);
  const [runCurrentIndex, setRunCurrentIndex] = useState(0);
  const [runSelected, setRunSelected] = useState([]);
  const [runSubmitLoading, setRunSubmitLoading] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [runCompleteLoading, setRunCompleteLoading] = useState(false);

  // Attempts
  const [attempts, setAttempts] = useState([]);
  const [quizTitleMap, setQuizTitleMap] = useState({});
  const [attemptDetailId, setAttemptDetailId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);

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

  const loadQuizzes = async () => {
    try {
      const groupId = quizGroupFilter ? parseInt(quizGroupFilter, 10) : null;
      const data = await quizzesApi.getQuizzes(groupId);
      setQuizzes(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || t("student.quizzes.errorLoad"));
    }
  };

  const loadAttempts = async () => {
    try {
      const data = await attemptsApi.getMyAttempts(null);
      const list = Array.isArray(data) ? data : [];
      setAttempts(list.filter((a) => a.is_completed));
      const ids = [...new Set(list.map((a) => a.quiz_id))];
      if (ids.length) {
        const all = await quizzesApi.getQuizzes(null);
        const map = {};
        (Array.isArray(all) ? all : []).forEach((q) => { map[q.id] = q.title; });
        setQuizTitleMap(map);
      }
      setError("");
    } catch (err) {
      setError(err.message || t("student.attempts.errorLoad"));
    }
  };

  const loadCurrentAttemptsMap = async () => {
    try {
      const data = await attemptsApi.getMyAttempts(null);
      const list = Array.isArray(data) ? data : [];
      const map = {};
      list.filter((a) => !a.is_completed).forEach((a) => { map[a.quiz_id] = a; });
      setCurrentAttemptByQuiz(map);
    } catch (err) {}
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") return;
    if (activeTab === "groups") {
      setLoading(true);
      loadGroups().finally(() => setLoading(false));
    } else if (activeTab === "quizzes") {
      setLoading(true);
      groupsApi.getGroups().then((g) => {
        const gr = Array.isArray(g) ? g : [];
        setGroupsForQuizzes(gr);
        if (!quizGroupFilter && gr.length) setQuizGroupFilter(String(gr[0].id));
      }).catch(() => {});
      loadCurrentAttemptsMap();
      loadQuizzes().finally(() => setLoading(false));
    } else if (activeTab === "attempts") {
      setLoading(true);
      loadAttempts().finally(() => setLoading(false));
    }
  }, [currentUser, activeTab, quizGroupFilter]);

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

  const handleLeave = async () => {
    if (!confirmLeave) return;
    setLeaveLoading(true);
    try {
      await groupsApi.leaveGroup(confirmLeave.id);
      setConfirmLeave(null);
      loadGroups();
    } catch (err) {
      setError(err.message || t("student.groups.errorLeave"));
    } finally {
      setLeaveLoading(false);
    }
  };

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
        if (!answered.includes(order[i])) { idx = i; break; }
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
    const selected = single
      ? (runSelected.length ? [runSelected[0]] : [])
      : runSelected.filter((id) => optIds.includes(id));
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

  const exitQuizRun = () => {
    setRunState(null);
    setRunQuiz(null);
    setRunAttemptId(null);
    setRunQuestions([]);
    setRunAnswered([]);
    setRunResults(null);
    setError("");
    loadQuizzes();
  };

  if (!currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  const showQuizRun = runState === "running" || runState === "results";
  const currentQ = runQuestions[runCurrentIndex];
  const singleChoice = currentQ && (currentQ.question_type || "").startsWith("single");

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      {!showQuizRun && (
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
                    {t(`student.tabs.${tab.id}`)}
                  </button>
                ))}
              </div>
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
                        <p className={`mt-1 text-sm ${a.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
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
                    {t("teacher.quizzes.points")}: {currentQ.points} · {singleChoice ? t("teacher.quizzes.quizTypeSingle") : t("teacher.quizzes.quizTypeMultiple")}
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
              {activeTab === "groups" && (
                <div>
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
                    <button onClick={loadGroups} disabled={loading} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50">
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
                    <div className="space-y-3">
                      {groups.map((g) => (
                        <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          <div>
                            <span className="font-medium text-[var(--text)]">{g.name}</span>
                            <span className="ml-2 text-sm text-[var(--text-muted)]">
                              {t("student.groups.members")}: {g.member_count ?? 0}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setConfirmLeave(g)}
                            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                          >
                            {t("student.groups.leave")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {confirmLeave && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                        <p className="text-[var(--text)]">{t("student.groups.confirmLeave", { name: confirmLeave.name })}</p>
                        <div className="mt-4 flex gap-2">
                          <button onClick={handleLeave} disabled={leaveLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                            {leaveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t("common.yes")}
                          </button>
                          <button onClick={() => setConfirmLeave(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">
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
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {groupsForQuizzes.length > 0 && (
                      <>
                        <span className="text-sm text-[var(--text-muted)]">{t("student.quizzes.filterGroup")}:</span>
                        <select
                          value={quizGroupFilter}
                          onChange={(e) => setQuizGroupFilter(e.target.value)}
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                        >
                          {groupsForQuizzes.map((gr) => (
                            <option key={gr.id} value={gr.id}>{gr.name}</option>
                          ))}
                        </select>
                      </>
                    )}
                    <button onClick={() => { loadCurrentAttemptsMap(); loadQuizzes(); }} disabled={loading} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50">
                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                    </div>
                  ) : quizzes.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {t("student.quizzes.noQuizzes")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {quizzes.map((q) => {
                        const hasCurrent = !!currentAttemptByQuiz[q.id];
                        return (
                          <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                            <div>
                              <span className="font-medium text-[var(--text)]">{q.title}</span>
                              <span className="ml-2 text-sm text-[var(--text-muted)]">
                                {t("student.quizzes.questions")}: {q.question_count ?? 0}
                              </span>
                            </div>
                            <button
                              onClick={() => startOrContinueQuiz(q)}
                              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-elevated)] hover:opacity-90"
                            >
                              {hasCurrent ? t("student.quizzes.continue") : t("student.quizzes.start")}
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "attempts" && (
                <div>
                  <div className="mb-4 flex gap-2">
                    <button onClick={loadAttempts} disabled={loading} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50">
                      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                    </div>
                  ) : attempts.length === 0 ? (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
                      {t("student.attempts.noAttempts")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attempts.map((a) => {
                        const pct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
                        return (
                          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                            <div>
                              <span className="font-medium text-[var(--text)]">{quizTitleMap[a.quiz_id] ?? `Quiz #${a.quiz_id}`}</span>
                              <span className="ml-2 text-sm text-[var(--text-muted)]">
                                {a.score} / {a.max_score} ({pct}%) · {formatDate(a.completed_at)}
                              </span>
                            </div>
                            <button
                              onClick={() => loadAttemptDetail(a.id)}
                              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                            >
                              {t("student.attempts.viewDetails")}
                            </button>
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
                          <button onClick={() => { setAttemptDetailId(null); setAttemptDetail(null); }} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)]">
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        {!attemptDetail ? (
                          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                        ) : (
                          <div className="space-y-4">
                            <p className="text-sm text-[var(--text-muted)]">
                              {t("student.attempts.score")}: {attemptDetail.attempt?.score} / {attemptDetail.attempt?.max_score} ({Math.round(attemptDetail.percentage ?? 0)}%)
                            </p>
                            {(attemptDetail.answers || []).map((ans, i) => (
                              <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                                <p className="font-medium text-[var(--text)]">{ans.question_text}</p>
                                <p className={`mt-1 text-sm ${ans.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                  {ans.is_correct ? "✓" : "✗"} {ans.points_earned} / {ans.max_points}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
