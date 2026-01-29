import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, Eye, EyeOff } from "lucide-react";
import { authApi, saveTokens } from "../services/api.js";

export default function AuthModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

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
        handleClose();
        setTimeout(() => {
          if (user.role === "admin") {
            navigate("/dashboard/admin");
          } else if (user.role === "teacher") {
            navigate("/dashboard/teacher");
          } else {
            navigate("/dashboard/student");
          }
        }, 300);
      }, 1000);
    } catch (err) {
      setError(
        err.status === 401
          ? t("auth.error401")
          : err.status === 403
          ? t("auth.error403")
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
      await authApi.register(registerData);
      setSuccess(t("auth.successRegister"));
      setRegisterData({
        username: "",
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        message: "",
      });
      setTimeout(() => {
        switchMode();
        setSuccess("");
      }, 3000);
    } catch (err) {
      setError(
        err.status === 400
          ? err.message.includes("already")
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

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setIsAnimating(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      document.body.style.overflow = "";
      setIsAnimating(false);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen && !isClosing) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        className={`relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] transition-all duration-300 ease-out ${
          isClosing
            ? "scale-95 opacity-0"
            : isAnimating
            ? "scale-100 opacity-100"
            : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-[var(--text-muted)] transition-all hover:bg-[var(--border)] hover:text-[var(--text)] hover:rotate-90"
          aria-label={t("common.close")}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          <h2
            className={`text-2xl font-semibold text-[var(--text)] transition-all duration-200 ${
              isSwitching ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            {isLogin ? t("auth.login") : t("auth.register")}
          </h2>

          <div
            className={`transition-all duration-200 ${
              isSwitching ? "opacity-0 max-h-0 overflow-hidden" : "opacity-100"
            }`}
          >
            {error && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                {success}
              </div>
            )}
          </div>

          <div className="relative mt-6 overflow-hidden">
            <div
              className={`transition-all duration-200 ${
                isSwitching
                  ? "opacity-0 translate-x-4 pointer-events-none absolute inset-0"
                  : "opacity-100 translate-x-0 pointer-events-auto relative"
              }`}
            >
              {isLogin ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-username"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      {t("auth.username")}
                    </label>
                    <input
                      id="login-username"
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                      placeholder={t("auth.usernamePlaceholder")}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      {t("auth.password")}
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 pr-10 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                        placeholder={t("auth.passwordPlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.75 p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                        aria-label={showLoginPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50"
                  >
                    {loading ? t("auth.submittingLogin") : t("auth.submitLogin")}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reg-username"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      {t("auth.username")}{t("auth.required")}
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      required
                      minLength={3}
                      maxLength={100}
                      value={registerData.username}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, username: e.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                      placeholder={t("auth.usernameMin")}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      {t("auth.email")}{t("auth.required")}
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={registerData.email}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, email: e.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                      placeholder={t("auth.emailPlaceholder")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="reg-first-name"
                        className="block text-sm font-medium text-[var(--text)]"
                      >
                        {t("auth.firstName")}
                      </label>
                      <input
                        id="reg-first-name"
                        type="text"
                        value={registerData.first_name}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            first_name: e.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                        placeholder={t("auth.optional")}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-last-name"
                        className="block text-sm font-medium text-[var(--text)]"
                      >
                        {t("auth.lastName")}
                      </label>
                      <input
                        id="reg-last-name"
                        type="text"
                        value={registerData.last_name}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            last_name: e.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                        placeholder={t("auth.optional")}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      {t("auth.password")}{t("auth.required")}
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      minLength={6}
                      value={registerData.password}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, password: e.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                      placeholder={t("auth.passwordMin6")}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-message"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      {t("auth.messageOptional")}
                    </label>
                    <textarea
                      id="reg-message"
                      rows={3}
                      value={registerData.message}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, message: e.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all focus:border-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
                      placeholder={t("auth.messagePlaceholder")}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elevated)] transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50"
                  >
                    {loading ? t("auth.submittingRegister") : t("auth.submitRegister")}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div
            className={`mt-6 border-t border-[var(--border)] pt-4 text-center transition-opacity duration-200 ${
              isSwitching ? "opacity-0" : "opacity-100"
            }`}
          >
            <button
              type="button"
              onClick={switchMode}
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)] hover:underline"
            >
              {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
