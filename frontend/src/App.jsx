import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Info from "./pages/Info.jsx";
import Blog from "./pages/Blog.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminInit from "./pages/AdminInit.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import StudentGroupPage from "./pages/StudentGroupPage.jsx";

function App() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");
  const hideFooter = isDashboard || location.pathname === "/admin/init";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] transition-colors duration-200">
      <Header />
      <main className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/info" element={<Info />} />
          <Route path="/blog" element={<Blog />} />
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
