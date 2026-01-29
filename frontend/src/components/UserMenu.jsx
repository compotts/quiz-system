import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { clearTokens, authApi } from "../services/api.js";

export default function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    authApi.getMe().then((user) => setUserRole(user.role)).catch(() => {});
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

  const handleDashboard = () => {
    setOpen(false);
    if (userRole === "admin") {
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
        className="flex h-10 w-10 items-center justify-center gap-0.5 rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-offset-2 focus:ring-offset-[var(--bg-elevated)] sm:gap-1 sm:px-2 sm:pr-2.5"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("header.userMenu")}
      >
        <User className="h-5 w-5" aria-hidden />
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
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
