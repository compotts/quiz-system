import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Info from "./pages/Info.jsx";
import Blog from "./pages/Blog.jsx";
import BlogPostPage from "./pages/BlogPostPage.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminInit from "./pages/AdminInit.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import StudentGroupPage from "./pages/StudentGroupPage.jsx";
import Profile from "./pages/Profile.jsx";
import MaintenancePage from "./pages/MaintenancePage.jsx";
import { authApi } from "./services/api.js";

function App() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");
  const hideFooter = isDashboard || location.pathname === "/admin/init";

  const [gateLoading, setGateLoading] = useState(true);
  const [siteStatus, setSiteStatus] = useState(null);
  const [maintenanceAdmin, setMaintenanceAdmin] = useState(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.getRegistrationSettings();
        if (cancelled) return;
        setBackendUnavailable(false);
        const status = {
          maintenance_mode: !!data.maintenance_mode,
          registration_enabled: data.registration_enabled !== false,
          home_banner_text: data.home_banner_text || "",
          home_banner_style: data.home_banner_style || "warning",
        };
        setSiteStatus(status);
        if (status.maintenance_mode && localStorage.getItem("access_token")) {
          try {
            const user = await authApi.getMe();
            if (cancelled) return;
            if (user?.role === "admin") setMaintenanceAdmin(user);
          } catch {
            // не админ или 503 — остаёмся на странице обслуживания
          }
        }
      } catch {
        if (!cancelled) {
          setBackendUnavailable(true);
          setSiteStatus({ maintenance_mode: true, home_banner_text: "", home_banner_style: "warning" });
        }
      } finally {
        if (!cancelled) setGateLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const maintenanceMode = siteStatus?.maintenance_mode === true;
  const showMaintenanceOnly = (maintenanceMode || backendUnavailable) && maintenanceAdmin?.role !== "admin";

  if (gateLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  if (showMaintenanceOnly) {
    return (
      <MaintenancePage
        siteStatus={siteStatus}
        backendUnavailable={backendUnavailable}
        onLoginSuccess={(user) => {
          if (user?.role === "admin") setMaintenanceAdmin(user);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] transition-colors duration-200">
      <Header />
      <main className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/info" element={<Info />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:postId" element={<BlogPostPage />} />
          <Route path="/admin/init" element={<AdminInit />} />
          <Route path="/dashboard/admin" element={<AdminDashboard />} />
          <Route path="/dashboard/teacher" element={<TeacherDashboard />} />
          <Route path="/dashboard/student" element={<StudentDashboard />} />
          <Route path="/dashboard/student/groups/:groupId" element={<StudentGroupPage />} />
        </Routes>
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default App;
