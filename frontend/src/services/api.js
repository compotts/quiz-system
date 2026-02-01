const API_BASE_URL = import.meta.env.VITE_API_URL;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem("access_token");

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.detail || "Произошла ошибка",
        response.status
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Ошибка сети", 0);
  }
}

export const authApi = {
  async login(username, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  async getRegistrationSettings() {
    return request("/auth/registration-settings");
  },

  async register(data) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getMe() {
    return request("/auth/me");
  },

  async refreshToken(refreshToken) {
    return request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },
};

export const adminApi = {
  async canInitialize() {
    return request("/admin/can-initialize");
  },

  async initializeAdmin(data) {
    return request("/admin/init", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getRegistrationRequests({ statusFilter = null, page = 1, perPage = 10 } = {}) {
    const params = new URLSearchParams();
    if (statusFilter) params.append("status_filter", statusFilter);
    params.append("page", page);
    params.append("per_page", perPage);
    return request(`/admin/registration-requests?${params.toString()}`);
  },

  async approveAllRegistrationRequests(role = "student") {
    return request(`/admin/registration-requests/approve-all?role=${role}`, {
      method: "POST",
    });
  },

  async reviewRegistrationRequest(requestId, approve, role = null) {
    return request(`/admin/registration-requests/${requestId}/review`, {
      method: "POST",
      body: JSON.stringify({ approve, role }),
    });
  },

  async getSettings() {
    return request("/admin/settings");
  },

  async updateSettings(data) {
    return request("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async getUsers({ page = 1, perPage = 10, search = "", searchField = "all", roleFilter = "", statusFilter = "" } = {}) {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("per_page", perPage);
    if (search) {
      params.append("search", search);
      params.append("search_field", searchField);
    }
    if (roleFilter) params.append("role_filter", roleFilter);
    if (statusFilter) params.append("status_filter", statusFilter);
    return request(`/admin/users?${params.toString()}`);
  },

  async getUserDetails(userId) {
    return request(`/admin/users/${userId}`);
  },

  async getUserGroups(userId) {
    return request(`/admin/users/${userId}/groups`);
  },

  async updateUserDetails(userId, data) {
    return request(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async changeUserRole(userId, newRole) {
    return request(`/admin/users/${userId}/role?new_role=${newRole}`, {
      method: "PATCH",
    });
  },

  async toggleUserStatus(userId) {
    return request(`/admin/users/${userId}/status`, {
      method: "PATCH",
    });
  },

  async deleteUser(userId) {
    return request(`/admin/users/${userId}`, {
      method: "DELETE",
    });
  },

  async getContactMessages({ page = 1, perPage = 20, isRead = null } = {}) {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("per_page", perPage);
    if (isRead !== null) params.append("is_read", isRead);
    return request(`/contact/messages?${params.toString()}`);
  },

  async getContactMessagesCount() {
    return request("/contact/messages/count");
  },

  async markContactMessageRead(messageId) {
    return request(`/contact/messages/${messageId}/read`, {
      method: "PATCH",
    });
  },

  async markAllContactMessagesRead() {
    return request("/contact/messages/read-all", {
      method: "PATCH",
    });
  },

  async deleteContactMessage(messageId) {
    return request(`/contact/messages/${messageId}`, {
      method: "DELETE",
    });
  },
};

export const contactApi = {
  async sendMessage(message) {
    return request("/contact/send", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },
};

export const blogApi = {
  async getPosts(page = 1, perPage = 10, includeUnpublished = false) {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("per_page", perPage);
    if (includeUnpublished) params.append("include_unpublished", "true");
    return request(`/blog/posts?${params.toString()}`);
  },

  async getPost(postId) {
    return request(`/blog/posts/${postId}`);
  },

  async createPost(data) {
    return request("/blog/posts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updatePost(postId, data) {
    return request(`/blog/posts/${postId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deletePost(postId) {
    return request(`/blog/posts/${postId}`, {
      method: "DELETE",
    });
  },
};

export const groupsApi = {
  async getGroups() {
    return request("/groups");
  },
  async createGroup(data) {
    return request("/groups", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async getGroup(id) {
    return request(`/groups/${id}`);
  },
  async updateGroup(id, data) {
    return request(`/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  async deleteGroup(id) {
    return request(`/groups/${id}`, { method: "DELETE" });
  },
  async getMembers(groupId) {
    return request(`/groups/${groupId}/members`);
  },
  async removeMember(groupId, userId) {
    return request(`/groups/${groupId}/members/${userId}`, {
      method: "DELETE",
    });
  },
  async joinGroup(code) {
    return request("/groups/join", {
      method: "POST",
      body: JSON.stringify({ code: String(code).trim().slice(0, 6) }),
    });
  },
  async leaveGroup(groupId) {
    return request(`/groups/${groupId}/leave`, { method: "POST" });
  },
};

export const quizzesApi = {
  async getQuizzes(groupId = null) {
    const q = groupId != null ? `?group_id=${groupId}` : "";
    return request(`/quizzes${q}`);
  },
  async createQuiz(data) {
    return request("/quizzes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async getQuiz(id) {
    return request(`/quizzes/${id}`);
  },
  async updateQuiz(id, data) {
    return request(`/quizzes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  async deleteQuiz(id) {
    return request(`/quizzes/${id}`, { method: "DELETE" });
  },
  async getQuestions(quizId) {
    return request(`/quizzes/${quizId}/questions`);
  },
  async createQuestion(quizId, data) {
    return request(`/quizzes/${quizId}/questions`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async updateQuestion(quizId, questionId, data) {
    return request(`/quizzes/${quizId}/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  async deleteQuestion(quizId, questionId) {
    return request(`/quizzes/${quizId}/questions/${questionId}`, {
      method: "DELETE",
    });
  },
};

export const attemptsApi = {
  async getQuizResults(quizId) {
    return request(`/attempts/quiz/${quizId}/results`);
  },
  async getAttemptResults(attemptId) {
    return request(`/attempts/results/${attemptId}`);
  },
  async getMyAttempts(quizId = null) {
    const q = quizId != null ? `?quiz_id=${quizId}` : "";
    return request(`/attempts/my-attempts${q}`);
  },
  async getCurrentAttempt(quizId) {
    return request(`/attempts/current?quiz_id=${quizId}`);
  },
  async startAttempt(quizId) {
    return request("/attempts/start", {
      method: "POST",
      body: JSON.stringify({ quiz_id: quizId }),
    });
  },
  async submitAnswer(questionId, selectedOptions) {
    return request("/attempts/answer", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, selected_options: selectedOptions }),
    });
  },
  async completeAttempt(attemptId) {
    return request("/attempts/complete", {
      method: "POST",
      body: JSON.stringify({ attempt_id: attemptId }),
    });
  },
};

export function saveTokens(accessToken, refreshToken) {
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}
