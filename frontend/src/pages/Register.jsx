import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    first_name: '',
    last_name: '',
    message: '',
  });
  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setFormError('');
  };

  const nextStep = () => {
    if (step === 1) {
      if (formData.password !== formData.confirmPassword) {
        setFormError('Пароли не совпадают');
        return;
      }
      if (formData.password.length < 6) {
        setFormError('Пароль должен быть минимум 6 символов');
        return;
      }
    }
    setStep(step + 1);
    setFormError('');
  };

  const prevStep = () => {
    setStep(step - 1);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        message: formData.message || null,
      });
      setSuccess(true);
      setStep(3);
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 sm:py-12 px-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative bg-gray-800/40 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 max-w-2xl mx-auto border border-gray-700/50">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            🎯 Регистрация
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">Заполните форму для подачи заявки</p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-between mb-6 sm:mb-8 gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 py-2 sm:py-3 rounded-lg text-center font-semibold transition-all duration-300 text-xs sm:text-sm ${
                step >= s
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-900/50 text-gray-500 border border-gray-700'
              }`}
            >
              Шаг {s}
            </div>
          ))}
        </div>

        {(error || formError) && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4 backdrop-blur-sm text-sm">
            {error || formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Credentials */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-white mb-4">Учетные данные</h3>
              
              <div>
                <label className="block text-gray-300 font-medium mb-2">
                  Имя пользователя *
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                  placeholder="Введите имя пользователя"
                  required
                  minLength={3}
                />
                <small className="text-gray-400">Минимум 3 символа</small>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">
                  Пароль *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                  placeholder="Введите пароль"
                  required
                  minLength={6}
                />
                <small className="text-gray-400">Минимум 6 символов</small>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">
                  Повторите пароль *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                  placeholder="Повторите пароль"
                  required
                />
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-lg text-sm sm:text-base"
              >
                Далее
              </button>
            </div>
          )}

          {/* Step 2: Personal Info */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-white mb-4">Личная информация</h3>
              
              <div>
                <label className="block text-gray-300 font-medium mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                  placeholder="example@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">
                  Имя
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                  placeholder="Ваше имя"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">
                  Фамилия
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                  placeholder="Ваша фамилия"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">
                  Сообщение (необязательно)
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm sm:text-base"
                  placeholder="Расскажите о себе..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-gray-700 text-gray-300 font-semibold py-3 rounded-lg hover:bg-gray-600 transition duration-300 border border-gray-600"
                >
                  Назад
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 disabled:opacity-50 shadow-lg text-sm sm:text-base"
                >
                  {isLoading ? 'Отправка...' : 'Отправить заявку'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && success && (
            <div className="text-center py-8">
              <div className="text-6xl text-green-400 mb-4">✓</div>
              <h3 className="text-2xl font-bold text-white mb-4">Заявка отправлена!</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Ваша заявка на регистрацию отправлена администрации для одобрения. 
                Вы получите уведомление, когда аккаунт будет активирован.
              </p>
              <Link
                to="/login"
                className="inline-block bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-lg text-sm sm:text-base"
              >
                Вернуться на страницу входа
              </Link>
            </div>
          )}
        </form>

        {step < 3 && (
          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors">
                Войти
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}