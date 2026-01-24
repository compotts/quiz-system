import { create } from 'zustand';
import { authAPI } from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  // Вход
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(credentials);
      const { access_token, refresh_token } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);

      // Получаем данные пользователя
      const userResponse = await authAPI.getMe();
      const user = userResponse.data;
      
      localStorage.setItem('user', JSON.stringify(user));

      set({
        token: access_token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      return user;
    } catch (error) {
      set({
        error: error.response?.data?.detail || 'Ошибка входа',
        isLoading: false,
      });
      throw error;
    }
  },

  // Регистрация
  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register(data);
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.detail || 'Ошибка регистрации',
        isLoading: false,
      });
      throw error;
    }
  },

  // Выход
  logout: () => {
    localStorage.clear();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  // Загрузка данных пользователя
  loadUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await authAPI.getMe();
      const user = response.data;
      localStorage.setItem('user', JSON.stringify(user));
      
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      localStorage.clear();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Очистка ошибки
  clearError: () => set({ error: null }),
}));