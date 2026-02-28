import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, KeyRound, Shield, Mail, User } from "lucide-react";
import { authApi, saveTokens, getAccessToken } from "../services/api.js";
import { useSiteStatus } from "../contexts/SiteStatusContext.jsx";

const TIP_KEYS = [
  "tipPasswordLength",
  "tipPasswordVariety",
  "tipPasswordUnique",
  "tipEmailValid",
  "tipUsernameRemember",
];

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const siteStatus = useSiteStatus() ?? {
    registration_enabled: true,
    auto_registration_enabled: false,
  };

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    message: "",
    role: "student",
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authApi.login(loginUsername, loginPassword);
      saveTokens(response.access_token, response.refresh_token);
      const user = await authApi.getMe();
      setSuccess(t("auth.successLogin"));
      setTimeout(() => {
        if (user.role === "admin" || user.role === "developer") navigate("/dashboard/admin");
        else if (user.role === "teacher") navigate("/dashboard/teacher");
        else navigate("/dashboard/student");
      }, 800);
    } catch (err) {
      setError(
        err.status === 401
          ? t("auth.error401")
          : err.status === 403
          ? t("auth.error403")
          : err.status === 503
          ? t("auth.error503")
          : err.message || t("auth.errorLogin")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await authApi.register(registerData);
      if (response.auto_approved && response.access_token) {
        saveTokens(response.access_token, response.refresh_token);
        const user = await authApi.getMe();
        setSuccess(t("auth.successRegisterAuto"));
        setTimeout(() => {
          if (user.role === "admin" || user.role === "developer") navigate("/dashboard/admin");
          else if (user.role === "teacher") navigate("/dashboard/teacher");
          else navigate("/dashboard/student");
        }, 800);
      } else {
        setSuccess(t("auth.successRegister"));
        setRegisterData({
          username: "",
          email: "",
          password: "",
          first_name: "",
          last_name: "",
          message: "",
          role: "student",
        });
        setTimeout(() => {
          switchMode();
          setSuccess("");
        }, 3000);
      }
    } catch (err) {
      setError(
        err.status === 400
          ? err.message?.includes("already")
            ? t("auth.errorAlready")
            : err.message
          : err.message || t("auth.errorRegister")
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSwitching(true);
    setTimeout(() => {
      setIsLogin(!isLogin);
      setError("");
      setSuccess("");
      setIsSwitching(false);
    }, 200);
  };

  useEffect(() => {
    if (!siteStatus.registration_enabled && !isLogin) setIsLogin(true);
  }, [siteStatus.registration_enabled, isLogin]);

  useEffect(() => {
    if (getAccessToken()) {
      authApi.getMe().then((user) => {
        if (user?.role === "admin" || user?.role === "developer") navigate("/dashboard/admin", { replace: true });
        else if (user?.role === "teacher") navigate("/dashboard/teacher", { replace: true });
        else if (user?.role === "student") navigate("/dashboard/student", { replace: true });
      }).catch(() => {});
    }
  }, [navigate]);

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col bg-[var(--bg)] sm:min-h-[calc(100vh-4rem)]">
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-12 lg:max-w-[50%] lg:px-12 lg:py-16">
          <div className="mx-auto w-full max-w-sm">
            <h1
              className={`text-2xl font-semibold tracking-tight text-[var(--text)] transition-all duration-200 sm:text-3xl ${
                isSwitching ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
              }`}
            >
              {isLogin ? t("auth.login") : t("auth.register")}
            </h1>

            <div className={`mt-4 transition-all duration-200 ${isSwitching ? "opacity-0 max-h-0 overflow-hidden" : "opacity-100"}`}>
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                  {success}
                </div>
              )}
            </div>

            <div className={`relative mt-6 overflow-hidden ${isSwitching ? "opacity-0" : "opacity-100"}`}>
              <div
                className={`transition-all duration-200 ${
                  isSwitching ? "opacity-0 translate-x-4 pointer-events-none absolute inset-0" : "opacity-100 translate-x-0 pointer-events-auto relative"
                }`}
              >
                {isLogin ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label htmlFor="login-username" className="block text-sm font-medium text-[var(--text)]">
                        {t("auth.username")}
                      </label>
                      <input
                        id="login-username"
                        type="text"
                        required
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className={inputClass}
                        placeholder={t("auth.usernamePlaceholder")}
                      />
                    </div>
                    <div>
                      <label htmlFor="login-password" className="block text-sm font-medium text-[var(--text)]">
                        {t("auth.password")}
                      </label>
                      <div className="relative">
                        <input
                          id="login-password"
                          type={showLoginPassword ? "text" : "password"}
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className={`${inputClass} pr-10`}
                          placeholder={t("auth.passwordPlaceholder")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.75 p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                          aria-label={showLoginPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {loading ? t("auth.submittingLogin") : t("auth.submitLogin")}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label htmlFor="reg-username" className="block text-sm font-medium text-[var(--text)]">
                        {t("auth.username")}{t("auth.required")}
                      </label>
                      <input
                        id="reg-username"
                        type="text"
                        required
                        minLength={3}
                        maxLength={100}
                        value={registerData.username}
                        onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                        className={inputClass}
                        placeholder={t("auth.usernameMin")}
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-email" className="block text-sm font-medium text-[var(--text)]">
                        {t("auth.email")}{t("auth.required")}
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        required
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        className={inputClass}
                        placeholder={t("auth.emailPlaceholder")}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="reg-first-name" className="block text-sm font-medium text-[var(--text)]">
                          {t("auth.firstName")}
                        </label>
                        <input
                          id="reg-first-name"
                          type="text"
                          value={registerData.first_name}
                          onChange={(e) => setRegisterData({ ...registerData, first_name: e.target.value })}
                          className={inputClass}
                          placeholder={t("auth.optional")}
                        />
                      </div>
                      <div>
                        <label htmlFor="reg-last-name" className="block text-sm font-medium text-[var(--text)]">
                          {t("auth.lastName")}
                        </label>
                        <input
                          id="reg-last-name"
                          type="text"
                          value={registerData.last_name}
                          onChange={(e) => setRegisterData({ ...registerData, last_name: e.target.value })}
                          className={inputClass}
                          placeholder={t("auth.optional")}
                        />
                      </div>
                    </div>
                    {siteStatus.auto_registration_enabled && (
                      <div>
                        <label htmlFor="reg-role" className="block text-sm font-medium text-[var(--text)]">
                          {t("auth.role")}
                        </label>
                        <select
                          id="reg-role"
                          value={registerData.role || "student"}
                          onChange={(e) => setRegisterData({ ...registerData, role: e.target.value })}
                          className={inputClass}
                        >
                          <option value="student">{t("auth.roleStudent")}</option>
                          <option value="teacher">{t("auth.roleTeacher")}</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label htmlFor="reg-password" className="block text-sm font-medium text-[var(--text)]">
                        {t("auth.password")}{t("auth.required")}
                      </label>
                      <div className="relative">
                        <input
                          id="reg-password"
                          type={showRegisterPassword ? "text" : "password"}
                          required
                          minLength={6}
                          value={registerData.password}
                          onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                          className={`${inputClass} pr-10`}
                          placeholder={t("auth.passwordMin6")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.75 p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                          aria-label={showRegisterPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                        >
                          {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-message" className="block text-sm font-medium text-[var(--text)]">
                        {t("auth.messageOptional")}
                      </label>
                      <textarea
                        id="reg-message"
                        rows={2}
                        value={registerData.message}
                        onChange={(e) => setRegisterData({ ...registerData, message: e.target.value })}
                        className={inputClass}
                        placeholder={t("auth.messagePlaceholder")}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {loading ? t("auth.submittingRegister") : t("auth.submitRegister")}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {siteStatus.registration_enabled && (
              <div className={`mt-6 border-t border-[var(--border)] pt-4 text-center transition-opacity duration-200 ${isSwitching ? "opacity-0" : "opacity-100"}`}>
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:underline"
                >
                  {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 lg:block lg:w-px lg:bg-[var(--border)]" aria-hidden />
        <div className="border-t border-[var(--border)] lg:hidden" aria-hidden />
        <div className="flex flex-1 flex-col justify-center border-t border-[var(--border)] px-4 py-8 sm:px-6 sm:py-12 lg:border-t-0 lg:border-l lg:border-[var(--border)] lg:px-12 lg:py-16">
          <div className="mx-auto w-full max-w-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
              <KeyRound className="h-5 w-5 text-[var(--text-muted)]" aria-hidden />
              {t("auth.tipsTitle")}
            </h2>
            <ul className="mt-6 space-y-4">
              {TIP_KEYS.map((key) => (
                <li key={key} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--border)] text-[var(--text-muted)]">
                    {key === "tipPasswordLength" || key === "tipPasswordVariety" || key === "tipPasswordUnique" ? (
                      <Shield className="h-3.5 w-3.5" aria-hidden />
                    ) : key === "tipEmailValid" ? (
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <User className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                  <span className="text-sm leading-relaxed text-[var(--text-muted)]">{t(`auth.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
