import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { clearTokens, authApi } from "../services/api.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    authApi.getMe().then(setUser).catch(() => {});
  }, []);
  useEffect(() => {
    const onLogout = () => setUser(null);
    const onProfileUpdate = () => authApi.getMe().then(setUser).catch(() => {});
    window.addEventListener("auth:logout", onLogout);
    window.addEventListener("auth:profile-updated", onProfileUpdate);
    return () => {
      window.removeEventListener("auth:logout", onLogout);
      window.removeEventListener("auth:profile-updated", onProfileUpdate);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const userRole = user?.role;
  const avatarUrl = user?.avatar_url ? `${API_BASE}${user.avatar_url}` : null;

  const handleDashboard = () => {
    setOpen(false);
    if (userRole === "admin" || userRole === "developer") {
      navigate("/dashboard/admin");
    } else if (userRole === "teacher") {
      navigate("/dashboard/teacher");
    } else {
      navigate("/dashboard/student");
    }
  };

  const handleLogout = () => {
    clearTokens();
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex shrink-0 items-center justify-center gap-1 rounded-xl border border-[var(--border)] py-1.5 pl-1.5 pr-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--bg-elevated)]"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("header.userMenu")}
      >
        <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-card)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <User className="h-4 w-4" aria-hidden />
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDashboard}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
            {t("userMenu.dashboard")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/profile");
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            <User className="h-4 w-4 shrink-0" aria-hidden />
            {t("userMenu.profile")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            {t("userMenu.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
