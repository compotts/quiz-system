import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    try {
      const user = await login(formData);
      
      // Редирект в зависимости от роли
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/student');
      }
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative bg-gray-800/40 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md border border-gray-700/50">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            🎯 Quizz System
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">Войдите в свой аккаунт</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4 backdrop-blur-sm text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-gray-300 font-medium mb-2 text-sm sm:text-base">
              Имя пользователя
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
              placeholder="Введите имя пользователя"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-2 text-sm sm:text-base">
              Пароль
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
              placeholder="Введите пароль"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 disabled:opacity-50 shadow-lg text-sm sm:text-base"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm sm:text-base">
            или{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}