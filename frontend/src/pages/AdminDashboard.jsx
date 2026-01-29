import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Users,
  ClipboardList,
  Check,
  X,
  Trash2,
  Shield,
  GraduationCap,
  UserCog,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserX,
  UserCheck,
  Search,
  MessageSquare,
  Mail,
  MailOpen,
  CheckCheck,
  Monitor,
} from "lucide-react";
import { authApi, adminApi, getAccessToken } from "../services/api.js";

const TABS = [
  { id: "requests", icon: ClipboardList },
  { id: "users", icon: Users },
  { id: "messages", icon: MessageSquare },
];

const STATUS_COLORS = {
  pending: "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  approved: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20",
  rejected: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20",
};

const ROLE_ICONS = {
  admin: { icon: Shield, color: "text-purple-600 dark:text-purple-400" },
  teacher: { icon: UserCog, color: "text-blue-600 dark:text-blue-400" },
  student: { icon: GraduationCap, color: "text-green-600 dark:text-green-400" },
};

const SEARCH_FIELD_IDS = ["all", "username", "email", "first_name", "last_name"];

function formatDate(dateString) {
  return new Date(dateString).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("requests");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [requests, setRequests] = useState([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsTotalPages, setRequestsTotalPages] = useState(1);
  const [requestsFilter, setRequestsFilter] = useState("pending");
  const [processingRequest, setProcessingRequest] = useState(null);
  const [approveAllLoading, setApproveAllLoading] = useState(false);
  const [roleSelectOpen, setRoleSelectOpen] = useState(null);
  const [selectedRole, setSelectedRole] = useState("student");

  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersSearchField, setUsersSearchField] = useState("all");
  const [usersRoleFilter, setUsersRoleFilter] = useState("");
  const [usersStatusFilter, setUsersStatusFilter] = useState("");
  const [searchFieldOpen, setSearchFieldOpen] = useState(false);
  const [processingUser, setProcessingUser] = useState(null);
  const [userRoleSelectOpen, setUserRoleSelectOpen] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);


  const [messages, setMessages] = useState([]);
  const [messagesFilter, setMessagesFilter] = useState("all");
  const [messagesCount, setMessagesCount] = useState({ unread: 0, total: 0 });
  const [processingMessage, setProcessingMessage] = useState(null);
  const [expandedMessage, setExpandedMessage] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (activeTab === "requests") {
        loadRequests();
      } else if (activeTab === "users") {
        loadUsers();
      } else if (activeTab === "messages") {
        loadMessages();
      }
      loadMessagesCount();
    }
  }, [activeTab, requestsFilter, requestsPage, currentUser, usersPage, usersRoleFilter, usersStatusFilter, messagesFilter]);

  const checkAuth = async () => {
    if (!getAccessToken()) {
      navigate("/");
      return;
    }
    try {
      const user = await authApi.getMe();
      if (user.role !== "admin") {
        navigate("/");
        return;
      }
      setCurrentUser(user);
    } catch (err) {
      navigate("/");
    }
  };

  const loadRequests = async (pageOverride = null) => {
    const page = pageOverride ?? requestsPage;
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.getRegistrationRequests({
        statusFilter: requestsFilter,
        page,
        perPage: 10,
      });
      setRequests(data.requests);
      setRequestsTotal(data.total);
      setRequestsTotalPages(data.total_pages);
      if (pageOverride !== null) setRequestsPage(page);
    } catch (err) {
      setError(err.message || "Ошибка загрузки заявок");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async () => {
    setApproveAllLoading(true);
    setError("");
    try {
      await adminApi.approveAllRegistrationRequests(selectedRole);
      setRoleSelectOpen(null);
      loadRequests(1);
    } catch (err) {
      setError(err.message || t("admin.errorApproveAll"));
    } finally {
      setApproveAllLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.getUsers({
        page: usersPage,
        perPage: 10,
        search: usersSearch,
        searchField: usersSearchField,
        roleFilter: usersRoleFilter,
        statusFilter: usersStatusFilter,
      });
      setUsers(data.users);
      setUsersTotal(data.total);
      setUsersTotalPages(data.total_pages);
    } catch (err) {
      setError(err.message || "Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  const handleUsersSearch = (e) => {
    e.preventDefault();
    setUsersPage(1);
    loadUsers();
  };

  const resetUsersFilters = () => {
    setUsersSearch("");
    setUsersSearchField("all");
    setUsersRoleFilter("");
    setUsersStatusFilter("");
    setUsersPage(1);
  };

  const loadMessages = async () => {
    setLoading(true);
    setError("");
    try {
      const isRead = messagesFilter === "unread" ? false : messagesFilter === "read" ? true : null;
      const data = await adminApi.getContactMessages({ isRead });
      setMessages(data);
    } catch (err) {
      setError(err.message || t("admin.errorLoadMessages"));
    } finally {
      setLoading(false);
    }
  };

  const loadMessagesCount = async () => {
    try {
      const data = await adminApi.getContactMessagesCount();
      setMessagesCount(data);
    } catch (err) {
    }
  };

  const handleMarkMessageRead = async (messageId) => {
    setProcessingMessage(messageId);
    try {
      await adminApi.markContactMessageRead(messageId);
      loadMessages();
      loadMessagesCount();
    } catch (err) {
      setError(err.message || "Ошибка");
    } finally {
      setProcessingMessage(null);
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await adminApi.markAllContactMessagesRead();
      loadMessages();
      loadMessagesCount();
    } catch (err) {
      setError(err.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    setProcessingMessage(messageId);
    try {
      await adminApi.deleteContactMessage(messageId);
      loadMessages();
      loadMessagesCount();
    } catch (err) {
      setError(err.message || t("admin.errorDeleteMessage"));
    } finally {
      setProcessingMessage(null);
    }
  };

  const parseUserAgent = (ua) => {
    if (!ua) return { browser: t("common.unknown"), os: t("common.unknown") };

    let browser = t("common.unknown");
    let os = t("common.unknown");
    
    if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/")) browser = "Chrome";
    else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Opera") || ua.includes("OPR/")) browser = "Opera";
    
    if (ua.includes("Windows NT 10")) os = "Windows 10/11";
    else if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac OS X")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    
    return { browser, os };
  };

  const handleReviewRequest = async (requestId, approve) => {
    setProcessingRequest(requestId);
    try {
      await adminApi.reviewRegistrationRequest(requestId, approve, approve ? selectedRole : null);
      setRoleSelectOpen(null);
      loadRequests();
    } catch (err) {
      setError(err.message || t("admin.errorReview"));
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleChangeUserRole = async (userId, newRole) => {
    setProcessingUser(userId);
    try {
      await adminApi.changeUserRole(userId, newRole);
      setUserRoleSelectOpen(null);
      loadUsers();
    } catch (err) {
      setError(err.message || "Ошибка изменения роли");
    } finally {
      setProcessingUser(null);
    }
  };

  const handleToggleUserStatus = async (userId) => {
    setProcessingUser(userId);
    try {
      await adminApi.toggleUserStatus(userId);
      loadUsers();
    } catch (err) {
      setError(err.message || t("admin.errorStatus"));
    } finally {
      setProcessingUser(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    setProcessingUser(userId);
    try {
      await adminApi.deleteUser(userId);
      setConfirmDelete(null);
      loadUsers();
    } catch (err) {
      setError(err.message || t("admin.errorDeleteUser"));
    } finally {
      setProcessingUser(null);
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
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
                {t("admin.dashboardTitle")}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {t("admin.welcome", { name: currentUser.first_name || currentUser.username })}
              </p>
            </div>
            <div className="flex gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {t(`admin.tabs.${tab.id}`)}
                  {tab.id === "messages" && messagesCount.unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
                      {messagesCount.unread > 99 ? "99+" : messagesCount.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button
                onClick={() => setError("")}
                className="ml-auto text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === "requests" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">{t("admin.filter")}</span>
                {["pending", "approved", "rejected"].map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setRequestsFilter(key);
                      setRequestsPage(1);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      requestsFilter === key
                        ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t(`admin.status.${key}`)}
                  </button>
                ))}
                {requestsFilter === "pending" && requestsTotal > 0 && (
                  <button
                    onClick={handleApproveAll}
                    disabled={approveAllLoading || loading}
                    className="ml-2 flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:opacity-50"
                  >
                    {approveAllLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {t("admin.approveAll")}
                  </button>
                )}
                <button
                  onClick={() => loadRequests()}
                  disabled={loading}
                  className="ml-auto rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                  title={t("common.refresh")}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="mb-4 text-sm text-[var(--text-muted)]">
                {t("admin.found")}: {requestsTotal} • {t("admin.page")} {requestsPage} {t("admin.of")} {requestsTotalPages || 1}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : requests.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                  <ClipboardList className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
                  <p className="mt-4 text-[var(--text-muted)]">{t("admin.noRequests")}</p>
                </div>
              ) : (
                <>
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--text-muted)]/30"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[var(--text)]">
                              {req.username}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                STATUS_COLORS[req.status] || ""
                              }`}
                            >
                              {t(`admin.status.${req.status}`) || req.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">{req.email}</p>
                          {(req.first_name || req.last_name) && (
                            <p className="mt-1 text-sm text-[var(--text-muted)]">
                              {req.first_name} {req.last_name}
                            </p>
                          )}
                          {req.message && (
                            <p className="mt-2 rounded-lg bg-[var(--bg-card)] p-2 text-sm text-[var(--text-muted)]">
                              {req.message}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-[var(--text-muted)]">
                            {t("admin.created")}: {formatDate(req.created_at)}
                          </p>
                        </div>

                        {req.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setRoleSelectOpen(roleSelectOpen === req.id ? null : req.id)
                                }
                                className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]"
                              >
                                {t(`admin.roles.${selectedRole}`) || selectedRole}
                                <ChevronDown className="h-4 w-4" />
                              </button>
                              {roleSelectOpen === req.id && (
                                <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]">
                                  {["admin", "teacher", "student"].map((key) => {
                                    const { icon: Icon } = ROLE_ICONS[key] || {};
                                    return (
                                      <button
                                        key={key}
                                        onClick={() => {
                                          setSelectedRole(key);
                                          setRoleSelectOpen(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
                                      >
                                        {Icon && <Icon className="h-4 w-4" />}
                                        {t(`admin.roles.${key}`)}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleReviewRequest(req.id, true)}
                              disabled={processingRequest === req.id}
                              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:opacity-50"
                            >
                              {processingRequest === req.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                              {t("admin.approve")}
                            </button>
                            <button
                              onClick={() => handleReviewRequest(req.id, false)}
                              disabled={processingRequest === req.id}
                              className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                              {t("admin.reject")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {requestsTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setRequestsPage((p) => Math.max(1, p - 1))}
                      disabled={requestsPage === 1 || loading}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(5, requestsTotalPages) }, (_, i) => {
                      let page;
                      if (requestsTotalPages <= 5) page = i + 1;
                      else if (requestsPage <= 3) page = i + 1;
                      else if (requestsPage >= requestsTotalPages - 2) page = requestsTotalPages - 4 + i;
                      else page = requestsPage - 2 + i;
                      return (
                        <button
                          key={page}
                          onClick={() => setRequestsPage(page)}
                          disabled={loading}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                            requestsPage === page
                              ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                              : "border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setRequestsPage((p) => Math.min(requestsTotalPages, p + 1))}
                      disabled={requestsPage === requestsTotalPages || loading}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
                </>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div>
              {/* Search & Filters */}
              <div className="mb-4 space-y-3">
                {/* Search */}
                <form onSubmit={handleUsersSearch} className="flex flex-wrap gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSearchFieldOpen(!searchFieldOpen)}
                      className="flex h-10 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]"
                    >
                      {t(`admin.searchFields.${usersSearchField}`)}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {searchFieldOpen && (
                      <div className="absolute left-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]">
                        {SEARCH_FIELD_IDS.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setUsersSearchField(id);
                              setSearchFieldOpen(false);
                            }}
                            className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--border)] ${
                              usersSearchField === id
                                ? "text-[var(--text)] font-medium"
                                : "text-[var(--text-muted)]"
                            }`}
                          >
                            {t(`admin.searchFields.${id}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      placeholder={t("common.searchPlaceholder")}
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90"
                  >
                    {t("common.find")}
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--text-muted)]">{t("admin.roleLabel")}</span>
                  {["", "admin", "teacher", "student"].map((id) => (
                    <button
                      key={id || "all"}
                      onClick={() => {
                        setUsersRoleFilter(id);
                        setUsersPage(1);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-sm font-medium transition-colors ${
                        usersRoleFilter === id
                          ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                      }`}
                    >
                      {id ? t(`admin.roles.${id === "teacher" ? "teacherShort" : id}`) : t("admin.filters.all")}
                    </button>
                  ))}

                  <span className="ml-2 text-sm text-[var(--text-muted)]">{t("admin.statusLabel")}</span>
                  {["", "active", "inactive"].map((id) => (
                    <button
                      key={id || "all"}
                      onClick={() => {
                        setUsersStatusFilter(id);
                        setUsersPage(1);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-sm font-medium transition-colors ${
                        usersStatusFilter === id
                          ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                      }`}
                    >
                      {id ? t(`admin.filters.${id}`) : t("admin.filters.all")}
                    </button>
                  ))}

                  {(usersSearch || usersRoleFilter || usersStatusFilter) && (
                    <button
                      onClick={resetUsersFilters}
                      className="ml-2 rounded-lg px-2.5 py-1 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
                    >
                      {t("common.reset")}
                    </button>
                  )}

                  <button
                    onClick={() => loadUsers()}
                    disabled={loading}
                    className="ml-auto rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                    title={t("common.refresh")}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
                  <span>
                    {t("admin.found")}: {usersTotal} • {t("admin.page")} {usersPage} {t("admin.of")} {usersTotalPages || 1}
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : users.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                  <Users className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
                  <p className="mt-4 text-[var(--text-muted)]">{t("admin.noUsers")}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {users.map((user) => {
                      const RoleIcon = ROLE_ICONS[user.role]?.icon || Users;
                      const isCurrentUser = user.id === currentUser.id;

                      return (
                        <div
                          key={user.id}
                          className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--text-muted)]/30 ${
                            !user.is_active ? "opacity-60" : ""
                          }`}
                        >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] ${
                                ROLE_ICONS[user.role]?.color || ""
                              }`}
                            >
                              <RoleIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[var(--text)]">
                                  {user.username}
                                </span>
                                {isCurrentUser && (
                                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs text-[var(--bg-elevated)]">
                                    {t("admin.you")}
                                  </span>
                                )}
                                {!user.is_active && (
                                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                                    {t("admin.deactivated")}
                                  </span>
                                )}
                                </div>
                                <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
                                {(user.first_name || user.last_name) && (
                                  <p className="text-sm text-[var(--text-muted)]">
                                    {user.first_name} {user.last_name}
                                  </p>
                                )}
                              </div>
                            </div>

                            {!isCurrentUser && (
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Role selector */}
                                <div className="relative">
                                  <button
                                    onClick={() =>
                                      setUserRoleSelectOpen(
                                        userRoleSelectOpen === user.id ? null : user.id
                                      )
                                    }
                                    className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]"
                                  >
                                    <RoleIcon className="h-4 w-4" />
                                    {t(`admin.roles.${user.role}`) || user.role}
                                    <ChevronDown className="h-4 w-4" />
                                  </button>
                                  {userRoleSelectOpen === user.id && (
                                    <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]">
                                      {["admin", "teacher", "student"].map((key) => {
                                        const { icon: Icon } = ROLE_ICONS[key] || {};
                                        return (
                                          <button
                                            key={key}
                                            onClick={() => handleChangeUserRole(user.id, key)}
                                            disabled={processingUser === user.id}
                                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--border)] ${
                                              user.role === key
                                                ? "text-[var(--text)] font-medium"
                                                : "text-[var(--text-muted)]"
                                            }`}
                                          >
                                            {Icon && <Icon className="h-4 w-4" />}
                                            {t(`admin.roles.${key}`)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Toggle status */}
                                <button
                                  onClick={() => handleToggleUserStatus(user.id)}
                                  disabled={processingUser === user.id}
                                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-50 ${
                                    user.is_active
                                      ? "bg-yellow-600 text-white hover:bg-yellow-700"
                                      : "bg-green-600 text-white hover:bg-green-700"
                                  }`}
                                  title={user.is_active ? t("admin.deactivate") : t("admin.activate")}
                                >
                                  {processingUser === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : user.is_active ? (
                                    <UserX className="h-4 w-4" />
                                  ) : (
                                    <UserCheck className="h-4 w-4" />
                                  )}
                                </button>

                                {/* Delete */}
                                {confirmDelete === user.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      disabled={processingUser === user.id}
                                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                                    >
                                      {processingUser === user.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        t("common.yes")
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setConfirmDelete(null)}
                                      className="rounded-lg bg-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition-all hover:bg-[var(--text-muted)]/20"
                                    >
                                      {t("common.no")}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDelete(user.id)}
                                    className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-700"
                                    title={t("common.delete")}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-[var(--text-muted)]">
                            {t("admin.created")}: {formatDate(user.created_at)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {usersTotalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        disabled={usersPage === 1 || loading}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      
                      {Array.from({ length: Math.min(5, usersTotalPages) }, (_, i) => {
                        let page;
                        if (usersTotalPages <= 5) {
                          page = i + 1;
                        } else if (usersPage <= 3) {
                          page = i + 1;
                        } else if (usersPage >= usersTotalPages - 2) {
                          page = usersTotalPages - 4 + i;
                        } else {
                          page = usersPage - 2 + i;
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setUsersPage(page)}
                            disabled={loading}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                              usersPage === page
                                ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                                : "border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                        disabled={usersPage === usersTotalPages || loading}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === "messages" && (
            <div>
              {/* Filters */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">{t("admin.filter")}</span>
                {["all", "unread", "read"].map((id) => (
                  <button
                    key={id}
                    onClick={() => setMessagesFilter(id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      messagesFilter === id
                        ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t(`admin.filters.${id}`)}
                    {id === "unread" && messagesCount.unread > 0 && (
                      <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                        {messagesCount.unread}
                      </span>
                    )}
                  </button>
                ))}

                {messagesCount.unread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={loading}
                    className="ml-2 flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
                  >
                    <CheckCheck className="h-4 w-4" />
                    {t("admin.readAll")}
                  </button>
                )}

                <button
                  onClick={loadMessages}
                  disabled={loading}
                  className="ml-auto rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                  title={t("common.refresh")}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="mb-4 text-sm text-[var(--text-muted)]">
                {t("admin.total")}: {messagesCount.total} • {t("admin.unreadCount")}: {messagesCount.unread}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
                  <p className="mt-4 text-[var(--text-muted)]">{t("admin.noMessages")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const { browser, os } = parseUserAgent(msg.user_agent);
                    const isExpanded = expandedMessage === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--text-muted)]/30 ${
                          !msg.is_read ? "border-l-4 border-l-blue-500" : ""
                        }`}
                      >
                        <div className="flex flex-col gap-3">
                          {/* Header */}
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {msg.is_read ? (
                                <MailOpen className="h-5 w-5 text-[var(--text-muted)]" />
                              ) : (
                                <Mail className="h-5 w-5 text-blue-500" />
                              )}
                              <div>
                                {msg.username ? (
                                  <span className="font-medium text-[var(--text)]">
                                    {msg.username}
                                    <span className="ml-2 text-sm text-[var(--text-muted)]">
                                      ({msg.email})
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-muted)]">
                                    {t("admin.anonymous")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-[var(--text-muted)]">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>

                          {/* Message */}
                          <div
                            className={`text-[var(--text)] ${
                              !isExpanded && msg.message.length > 200
                                ? "line-clamp-3"
                                : ""
                            }`}
                          >
                            {msg.message}
                          </div>

                          {msg.message.length > 200 && (
                            <button
                              onClick={() =>
                                setExpandedMessage(isExpanded ? null : msg.id)
                              }
                              className="self-start text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                            >
                              {isExpanded ? t("admin.showLess") : t("admin.showMore")}
                            </button>
                          )}

                          {/* Device info */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Monitor className="h-3.5 w-3.5" />
                              {os} • {browser}
                            </span>
                            <span>IP: {msg.ip_address}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
                            {!msg.is_read && (
                              <button
                                onClick={() => handleMarkMessageRead(msg.id)}
                                disabled={processingMessage === msg.id}
                                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                              >
                                {processingMessage === msg.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                                {t("admin.markRead")}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              disabled={processingMessage === msg.id}
                              className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                            >
                              {processingMessage === msg.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              {t("common.delete")}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
