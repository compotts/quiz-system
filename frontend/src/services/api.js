import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
};

export const adminAPI = {
  initAdmin: (data) => api.post('/admin/init', data),
  getRegistrationRequests: (status = null) => 
    api.get('/admin/registration-requests', { params: { status_filter: status } }),
  reviewRequest: (requestId, data) => 
    api.post(`/admin/registration-requests/${requestId}/review`, data),
  getUsers: (skip = 0, limit = 100) => 
    api.get('/admin/users', { params: { skip, limit } }),
  getUserDetails: (userId) => api.get(`/admin/users/${userId}`),
  changeUserRole: (userId, role) => 
    api.patch(`/admin/users/${userId}/role`, null, { params: { new_role: role } }),
  toggleUserStatus: (userId) => api.patch(`/admin/users/${userId}/status`),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`),
};

export const groupsAPI = {
  createGroup: (data) => api.post('/groups', data),
  getGroups: () => api.get('/groups'),
  getGroup: (groupId) => api.get(`/groups/${groupId}`),
  updateGroup: (groupId, data) => api.patch(`/groups/${groupId}`, data),
  deleteGroup: (groupId) => api.delete(`/groups/${groupId}`),
  joinGroup: (code) => api.post('/groups/join', { code }),
  getMembers: (groupId) => api.get(`/groups/${groupId}/members`),
  removeMember: (groupId, userId) => 
    api.delete(`/groups/${groupId}/members/${userId}`),
  leaveGroup: (groupId) => api.post(`/groups/${groupId}/leave`),
};

export const quizzesAPI = {
  createQuiz: (data) => api.post('/quizzes', data),
  getQuizzes: (groupId = null) => 
    api.get('/quizzes', { params: groupId ? { group_id: groupId } : {} }),
  getQuiz: (quizId) => api.get(`/quizzes/${quizId}`),
  updateQuiz: (quizId, data) => api.patch(`/quizzes/${quizId}`, data),
  deleteQuiz: (quizId) => api.delete(`/quizzes/${quizId}`),
  
  createQuestion: (quizId, data) => api.post(`/quizzes/${quizId}/questions`, data),
  getQuestions: (quizId) => api.get(`/quizzes/${quizId}/questions`),
  updateQuestion: (quizId, questionId, data) => 
    api.patch(`/quizzes/${quizId}/questions/${questionId}`, data),
  deleteQuestion: (quizId, questionId) => 
    api.delete(`/quizzes/${quizId}/questions/${questionId}`),
};

export const attemptsAPI = {
  startAttempt: (quizId) => api.post('/attempts/start', { quiz_id: quizId }),
  submitAnswer: (data) => api.post('/attempts/answer', data),
  completeAttempt: (attemptId) => api.post('/attempts/complete', { attempt_id: attemptId }),
  getMyAttempts: (quizId = null) => 
    api.get('/attempts/my-attempts', { params: quizId ? { quiz_id: quizId } : {} }),
  getResults: (attemptId) => api.get(`/attempts/results/${attemptId}`),
  getQuizResults: (quizId) => api.get(`/attempts/quiz/${quizId}/results`),
  getCurrentAttempt: (quizId) => 
    api.get('/attempts/current', { params: { quiz_id: quizId } }),
};

export default api;