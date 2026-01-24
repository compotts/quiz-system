import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Редирект на соответствующую панель
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'teacher') return <Navigate to="/teacher" replace />;
    if (user?.role === 'student') return <Navigate to="/student" replace />;
  }

  return children;
}

function App() {
  const { loadUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Загружаем данные пользователя при запуске
    if (localStorage.getItem('access_token')) {
      loadUser();
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        
        <Route 
          path="/login" 
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/register" 
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        {/* Protected Routes */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


export default App;