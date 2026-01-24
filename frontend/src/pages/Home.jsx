import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, user, login, register, isLoading, error, clearError } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    first_name: '',
    last_name: '',
  });
  const [formError, setFormError] = useState('');

  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (user?.role === 'admin') {
        navigate('/admin');
      } else if (user?.role === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/student');
      }
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setFormError('');
    clearError();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearError();
    setFormError('');

    try {
      const user = await login({
        username: formData.username,
        password: formData.password,
      });
      
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

  const handleRegister = async (e) => {
    e.preventDefault();
    clearError();
    setFormError('');

    if (formData.password !== formData.confirmPassword) {
      setFormError('Пароли не совпадают');
      return;
    }
    if (formData.password.length < 6) {
      setFormError('Пароль должен быть минимум 6 символов');
      return;
    }

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
      });
      setIsLogin(true);
      setFormError('');
      setFormData({
        ...formData,
        password: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">🎯 Quizz System</h1>
          <p className="text-gray-400 mb-8 text-lg">Добро пожаловать, {user?.first_name || user?.username}!</p>
          <button
            onClick={handleGetStarted}
            className="px-10 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 font-semibold text-lg shadow-2xl hover:shadow-blue-500/50"
          >
            Перейти в панель
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col relative overflow-hidden">
      {/* Enhanced Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-slate-600 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 relative z-10">
        <div className="container mx-auto max-w-7xl w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Side - Enhanced Description */}
            <div className="text-center lg:text-left space-y-6">
              <div className="inline-block px-4 py-2 bg-blue-500/10 backdrop-blur-sm rounded-full border border-blue-500/20 mb-4">
                <span className="text-blue-400 text-sm font-medium">✨ Современная платформа</span>
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight">
                Quizz
                <span className="block text-blue-400">System</span>
              </h1>
              <p className="text-2xl sm:text-3xl text-gray-300 font-light">
                Система тестирования нового поколения
              </p>
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <p className="text-gray-400 text-lg leading-relaxed">
                    Создавайте и управляйте тестами с интуитивным интерфейсом
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <p className="text-gray-400 text-lg leading-relaxed">
                    Организуйте студентов в группы и отслеживайте результаты
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <p className="text-gray-400 text-lg leading-relaxed">
                    Получайте детальную аналитику по каждому студенту
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side - Enhanced Auth Form */}
            <div className="w-full max-w-2xl mx-auto lg:mx-0">
              <div className="bg-gray-800/60 backdrop-blur-xl rounded-3xl shadow-2xl p-10 sm:p-12 lg:p-14 border border-gray-700/50 relative overflow-hidden">
                {/* Decorative gradient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                
                <div className="relative z-10">
                  {/* Enhanced Tabs */}
                  <div className="flex gap-3 mb-10 p-1.5 bg-gray-900/50 rounded-xl">
                    <button
                      onClick={() => {
                        setIsLogin(true);
                        clearError();
                        setFormError('');
                      }}
                      className={`flex-1 py-3.5 rounded-lg font-semibold transition-all duration-300 text-base ${
                        isLogin
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Вход
                    </button>
                    <button
                      onClick={() => {
                        setIsLogin(false);
                        clearError();
                        setFormError('');
                      }}
                      className={`flex-1 py-3.5 rounded-lg font-semibold transition-all duration-300 text-base ${
                        !isLogin
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Регистрация
                    </button>
                  </div>

                  {/* Error Messages */}
                  {(error || formError) && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-5 py-4 rounded-xl mb-8 backdrop-blur-sm text-sm flex items-center gap-3">
                      <span>⚠️</span>
                      <span>{error || formError}</span>
                    </div>
                  )}

                  {/* Login Form */}
                  {isLogin && (
                    <form onSubmit={handleLogin} className="space-y-6">
                      <div className="space-y-2">
                        <label className="block text-gray-300 font-semibold text-base">
                          Имя пользователя
                        </label>
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleChange}
                          className="w-full px-5 py-4 bg-gray-900/70 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                          placeholder="Введите имя пользователя"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-gray-300 font-semibold text-base">
                          Пароль
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full px-5 py-4 bg-gray-900/70 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                          placeholder="Введите пароль"
                          required
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:scale-[1.02] text-base"
                        >
                          {isLoading ? 'Вход...' : 'Войти'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Register Form */}
                  {!isLogin && (
                    <form onSubmit={handleRegister} className="space-y-6">
                      <div>
                        <label className="block text-gray-300 font-semibold text-base mb-3">
                          Имя пользователя *
                        </label>
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleChange}
                          className="w-full px-5 py-4 bg-gray-900/70 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                          placeholder="Введите имя пользователя"
                          required
                          minLength={3}
                        />
                      </div>

                      <div>
                        <label className="block text-gray-300 font-semibold text-base mb-3">
                          Email *
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full px-5 py-4 bg-gray-900/70 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                          placeholder="example@email.com"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-300 font-semibold text-base mb-3">
                          Пароль *
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full px-5 py-4 bg-gray-900/70 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                          placeholder="Минимум 6 символов"
                          required
                          minLength={6}
                        />
                      </div>

                      <div>
                        <label className="block text-gray-300 font-semibold text-base mb-3">
                          Повторите пароль *
                        </label>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="w-full px-5 py-4 bg-gray-900/70 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                          placeholder="Повторите пароль"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="block text-gray-300 font-semibold text-base mb-3">
                            Имя
                          </label>
                          <input
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            className="w-full px-5 py-4 bg-gray-900/70 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                            placeholder="Имя"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 font-semibold text-base mb-3">
                            Фамилия
                          </label>
                          <input
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            className="w-full px-5 py-4 bg-gray-900/70 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                            placeholder="Фамилия"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:scale-[1.02] text-base"
                        >
                          {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Footer */}
      <footer className="relative border-t border-gray-700/30 py-8 backdrop-blur-sm bg-gray-900/20">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 text-sm">
            <div className="text-gray-500">
              <p>&copy; 2024 Quizz System. Все права защищены.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-gray-500">
              <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                Политика конфиденциальности
              </a>
              <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                Условия использования
              </a>
              <a href="#" className="hover:text-blue-400 transition-colors duration-200">
                Контакты
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
