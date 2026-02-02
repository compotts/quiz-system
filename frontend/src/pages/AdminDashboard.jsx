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
  Info,
  Settings,
  ScrollText,
} from "lucide-react";
import { authApi, adminApi, getAccessToken } from "../services/api.js";
import UserDetailsModal from "../components/UserDetailsModal.jsx";

const TABS = [
  { id: "requests", icon: ClipboardList },
  { id: "users", icon: Users },
  { id: "messages", icon: MessageSquare },
  { id: "logs", icon: ScrollText },
  { id: "settings", icon: Settings },
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
const LOGS_SEARCH_FIELD_IDS = ["username", "ip", "all"];

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
  const [userDetailsModalUserId, setUserDetailsModalUserId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messagesFilter, setMessagesFilter] = useState("all");
  const [messagesCount, setMessagesCount] = useState({ unread: 0, total: 0 });
  const [processingMessage, setProcessingMessage] = useState(null);
  const [expandedMessage, setExpandedMessage] = useState(null);

  const [autoRegistrationEnabled, setAutoRegistrationEnabled] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [contactEnabled, setContactEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsTotal, setAuditLogsTotal] = useState(0);
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [auditLogsTotalPages, setAuditLogsTotalPages] = useState(1);
  const [auditLogsActionFilter, setAuditLogsActionFilter] = useState("");
  const [auditLogsResourceFilter, setAuditLogsResourceFilter] = useState("");
  const [auditLogsSearch, setAuditLogsSearch] = useState("");
  const [auditLogsSearchField, setAuditLogsSearchField] = useState("username");
  const [logsSearchFieldOpen, setLogsSearchFieldOpen] = useState(false);

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
      } else if (activeTab === "logs") {
        loadAuditLogs();
      } else if (activeTab === "settings") {
        loadSettings();
      }
      loadMessagesCount();
    }
  }, [activeTab, requestsFilter, requestsPage, currentUser, usersPage, usersRoleFilter, usersStatusFilter, usersSearch, usersSearchField, messagesFilter, auditLogsPage, auditLogsActionFilter, auditLogsResourceFilter]);

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
      setError(err.message || "ошибка загрузки заявок");
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
      setError(err.message || "ошибка загрузки пользователей");
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

  const loadAuditLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.getAuditLogs({
        page: auditLogsPage,
        perPage: 50,
        action: auditLogsActionFilter || null,
        resourceType: auditLogsResourceFilter || null,
        search: auditLogsSearch.trim() || null,
        searchField: auditLogsSearch.trim() ? auditLogsSearchField : null,
      });
      setAuditLogs(data.logs);
      setAuditLogsTotal(data.total);
      setAuditLogsTotalPages(data.total_pages);
    } catch (err) {
      setError(err.message || "ошибка загрузки логов");
    } finally {
      setLoading(false);
    }
  };

  const handleLogsSearch = (e) => {
    e?.preventDefault();
    setAuditLogsPage(1);
    loadAuditLogs();
  };

  const resetLogsFilters = () => {
    setAuditLogsSearch("");
    setAuditLogsSearchField("username");
    setAuditLogsActionFilter("");
    setAuditLogsResourceFilter("");
    setAuditLogsPage(1);
    loadAuditLogs();
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    setError("");
    try {
      const data = await adminApi.getSettings();
      setAutoRegistrationEnabled(data.auto_registration_enabled);
      setRegistrationEnabled(data.registration_enabled !== false);
      setMaintenanceMode(!!data.maintenance_mode);
      setContactEnabled(data.contact_enabled !== false);
    } catch (err) {
      setError(err.message || "ошибка загрузки настроек");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleToggleAutoRegistration = async () => {
    setSettingsSaving(true);
    setError("");
    try {
      const data = await adminApi.updateSettings({
        auto_registration_enabled: !autoRegistrationEnabled,
      });
      setAutoRegistrationEnabled(data.auto_registration_enabled);
    } catch (err) {
      setError(err.message || "ошибка сохранения настроек");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleToggleRegistrationEnabled = async () => {
    setSettingsSaving(true);
    setError("");
    try {
      const data = await adminApi.updateSettings({
        registration_enabled: !registrationEnabled,
      });
      setRegistrationEnabled(data.registration_enabled !== false);
    } catch (err) {
      setError(err.message || "ошибка сохранения настроек");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleToggleMaintenanceMode = async () => {
    setSettingsSaving(true);
    setError("");
    try {
      const data = await adminApi.updateSettings({
        maintenance_mode: !maintenanceMode,
      });
      setMaintenanceMode(!!data.maintenance_mode);
    } catch (err) {
      setError(err.message || "ошибка сохранения настроек");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleToggleContactEnabled = async () => {
    setSettingsSaving(true);
    setError("");
    try {
      const data = await adminApi.updateSettings({
        contact_enabled: !contactEnabled,
      });
      setContactEnabled(data.contact_enabled !== false);
    } catch (err) {
      setError(err.message || "ошибка сохранения настроек");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleMarkMessageRead = async (messageId) => {
    setProcessingMessage(messageId);
    try {
      await adminApi.markContactMessageRead(messageId);
      loadMessages();
      loadMessagesCount();
    } catch (err) {
      setError(err.message || "ошибка");
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
      setError(err.message || "ошибка");
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
      setError(err.message || "ошибка изменения роли");
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

  const openUserDetails = (user) => setUserDetailsModalUserId(user.id);

  if (!currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 shrink-0">
              <h1 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">
                {t("admin.dashboardTitle")}
              </h1>
              <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
                {t("admin.welcome", { name: currentUser.first_name || currentUser.username })}
              </p>
            </div>
            <div className="w-full min-w-0 sm:w-auto sm:shrink-0">
              <div
                className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="flex gap-2 py-1">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? "bg-[var(--accent)] text-[var(--bg-elevated)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
                      }`}
                    >
                      <tab.icon className="h-4 w-4 shrink-0" />
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
        </div>
      </div>

      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl min-w-0">
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

          {activeTab === "users" && (
            <div>
              <div className="mb-4 space-y-3">
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

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => openUserDetails(user)}
                                  className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text)]"
                                  title={t("admin.details")}
                                >
                                  <Info className="h-4 w-4" />
                                  {t("admin.details")}
                                </button>
                            {!isCurrentUser && (
                              <>
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
                              </>
                            )}
                              </div>
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

          {activeTab === "messages" && (
            <div>
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

                          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Monitor className="h-3.5 w-3.5" />
                              {os} • {browser}
                            </span>
                            <span>IP: {msg.ip_address}</span>
                          </div>

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

          {activeTab === "logs" && (
            <div>
              <form onSubmit={handleLogsSearch} className="mb-4 flex flex-wrap gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLogsSearchFieldOpen(!logsSearchFieldOpen)}
                    className="flex h-10 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)]"
                  >
                    {t(`admin.logsSearchFields.${auditLogsSearchField}`)}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {logsSearchFieldOpen && (
                    <div className="absolute left-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]">
                      {LOGS_SEARCH_FIELD_IDS.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setAuditLogsSearchField(id);
                            setLogsSearchFieldOpen(false);
                          }}
                          className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--border)] ${
                            auditLogsSearchField === id
                              ? "text-[var(--text)] font-medium"
                              : "text-[var(--text-muted)]"
                          }`}
                        >
                          {t(`admin.logsSearchFields.${id}`)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={auditLogsSearch}
                    onChange={(e) => setAuditLogsSearch(e.target.value)}
                    placeholder={t("admin.logs.searchPlaceholder")}
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--text-muted)] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90"
                >
                  {t("common.find")}
                </button>
                {(auditLogsSearch || auditLogsActionFilter || auditLogsResourceFilter) && (
                  <button
                    type="button"
                    onClick={resetLogsFilters}
                    className="h-10 rounded-lg px-2.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
                  >
                    {t("common.reset")}
                  </button>
                )}
              </form>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">{t("admin.filter")}</span>
                <select
                  value={auditLogsActionFilter}
                  onChange={(e) => { setAuditLogsActionFilter(e.target.value); setAuditLogsPage(1); }}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)]"
                >
                  <option value="">{t("admin.logs.allActions")}</option>
                  <option value="login_success">{t("admin.logs.login_success")}</option>
                  <option value="login_failed">{t("admin.logs.login_failed")}</option>
                  <option value="password_changed">{t("admin.logs.password_changed")}</option>
                  <option value="register_auto">{t("admin.logs.register_auto")}</option>
                  <option value="register_request">{t("admin.logs.register_request")}</option>
                  <option value="settings_updated">{t("admin.logs.settings_updated")}</option>
                  <option value="registration_approved">{t("admin.logs.registration_approved")}</option>
                  <option value="registration_rejected">{t("admin.logs.registration_rejected")}</option>
                  <option value="registration_approve_all">{t("admin.logs.registration_approve_all")}</option>
                  <option value="user_updated">{t("admin.logs.user_updated")}</option>
                  <option value="user_role_changed">{t("admin.logs.user_role_changed")}</option>
                  <option value="user_status_toggled">{t("admin.logs.user_status_toggled")}</option>
                  <option value="user_deleted">{t("admin.logs.user_deleted")}</option>
                  <option value="quiz_created">{t("admin.logs.quiz_created")}</option>
                  <option value="quiz_updated">{t("admin.logs.quiz_updated")}</option>
                  <option value="quiz_deleted">{t("admin.logs.quiz_deleted")}</option>
                  <option value="question_created">{t("admin.logs.question_created")}</option>
                  <option value="question_updated">{t("admin.logs.question_updated")}</option>
                  <option value="question_deleted">{t("admin.logs.question_deleted")}</option>
                  <option value="group_created">{t("admin.logs.group_created")}</option>
                  <option value="group_updated">{t("admin.logs.group_updated")}</option>
                  <option value="group_deleted">{t("admin.logs.group_deleted")}</option>
                  <option value="group_joined">{t("admin.logs.group_joined")}</option>
                  <option value="group_left">{t("admin.logs.group_left")}</option>
                  <option value="member_removed">{t("admin.logs.member_removed")}</option>
                  <option value="admin_init">{t("admin.logs.admin_init")}</option>
                  <option value="attempt_started">{t("admin.logs.attempt_started")}</option>
                  <option value="attempt_completed">{t("admin.logs.attempt_completed")}</option>
                  <option value="blog_post_created">{t("admin.logs.blog_post_created")}</option>
                  <option value="blog_post_updated">{t("admin.logs.blog_post_updated")}</option>
                  <option value="blog_post_deleted">{t("admin.logs.blog_post_deleted")}</option>
                  <option value="contact_message_sent">{t("admin.logs.contact_message_sent")}</option>
                  <option value="contact_message_read">{t("admin.logs.contact_message_read")}</option>
                  <option value="contact_messages_read_all">{t("admin.logs.contact_messages_read_all")}</option>
                  <option value="contact_message_deleted">{t("admin.logs.contact_message_deleted")}</option>
                </select>
                <select
                  value={auditLogsResourceFilter}
                  onChange={(e) => { setAuditLogsResourceFilter(e.target.value); setAuditLogsPage(1); }}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text)]"
                >
                  <option value="">{t("admin.logs.allResources")}</option>
                  <option value="auth">auth</option>
                  <option value="settings">settings</option>
                  <option value="registration">registration</option>
                  <option value="user">user</option>
                  <option value="quiz">quiz</option>
                  <option value="question">question</option>
                  <option value="group">group</option>
                  <option value="attempt">attempt</option>
                  <option value="blog">blog</option>
                  <option value="contact">contact</option>
                </select>
                <button
                  onClick={loadAuditLogs}
                  disabled={loading}
                  className="ml-auto rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                  title={t("common.refresh")}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="mb-4 text-sm text-[var(--text-muted)]">
                {t("admin.total")}: {auditLogsTotal}
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                  <ScrollText className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
                  <p className="mt-4 text-[var(--text-muted)]">{t("admin.logs.noLogs")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-[var(--text-muted)] shrink-0">{formatDate(log.created_at)}</span>
                        <span className="font-medium text-[var(--text)]">{log.username ?? "—"}</span>
                        <span className="rounded bg-[var(--border)] px-1.5 py-0.5 text-[var(--text)]">{log.action}</span>
                        {(log.resource_type || log.resource_id) && (
                          <span className="text-[var(--text-muted)]">
                            {log.resource_type}{log.resource_id ? ` #${log.resource_id}` : ""}
                          </span>
                        )}
                        {log.ip_address && (
                          <span className="text-xs text-[var(--text-muted)]">IP: {log.ip_address}</span>
                        )}
                      </div>
                      {log.details && (
                        <p className="mt-1.5 truncate text-xs text-[var(--text-muted)]" title={log.details}>
                          {log.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {auditLogsTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setAuditLogsPage((p) => Math.max(1, p - 1))}
                    disabled={auditLogsPage === 1 || loading}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-[var(--text-muted)]">
                    {t("admin.page")} {auditLogsPage} {t("admin.of")} {auditLogsTotalPages}
                  </span>
                  <button
                    onClick={() => setAuditLogsPage((p) => Math.min(auditLogsTotalPages, p + 1))}
                    disabled={auditLogsPage === auditLogsTotalPages || loading}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div>
              {settingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6">
                  <h2 className="text-lg font-semibold text-[var(--text)]">
                    {t("admin.settingsTitle")}
                  </h2>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[var(--text)]">
                        {t("admin.autoRegistration")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {t("admin.autoRegistrationDesc")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleAutoRegistration}
                        disabled={settingsSaving}
                        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          autoRegistrationEnabled
                            ? "bg-green-600"
                            : "bg-[var(--border)]"
                        }`}
                        role="switch"
                        aria-checked={autoRegistrationEnabled}
                      >
                        <span
                          className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition ${
                            autoRegistrationEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      {settingsSaving && (
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[var(--text)]">
                        {t("admin.registrationEnabled")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {t("admin.registrationEnabledDesc")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleRegistrationEnabled}
                        disabled={settingsSaving}
                        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          registrationEnabled
                            ? "bg-green-600"
                            : "bg-[var(--border)]"
                        }`}
                        role="switch"
                        aria-checked={registrationEnabled}
                      >
                        <span
                          className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition ${
                            registrationEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[var(--text)]">
                        {t("admin.maintenanceMode")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {t("admin.maintenanceModeDesc")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleMaintenanceMode}
                        disabled={settingsSaving}
                        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          maintenanceMode
                            ? "bg-amber-600"
                            : "bg-[var(--border)]"
                        }`}
                        role="switch"
                        aria-checked={maintenanceMode}
                      >
                        <span
                          className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition ${
                            maintenanceMode ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[var(--text)]">
                        {t("admin.contactEnabled")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {t("admin.contactEnabledDesc")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleContactEnabled}
                        disabled={settingsSaving}
                        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                          contactEnabled
                            ? "bg-green-600"
                            : "bg-[var(--border)]"
                        }`}
                        role="switch"
                        aria-checked={contactEnabled}
                      >
                        <span
                          className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition ${
                            contactEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <UserDetailsModal
            isOpen={!!userDetailsModalUserId}
            userId={userDetailsModalUserId}
            onClose={() => setUserDetailsModalUserId(null)}
            onSaved={loadUsers}
          />
        </div>
      </div>
    </div>
  );
}
