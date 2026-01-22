// Minimal frontend helpers for auth and basic flows

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Login form
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const res = await postJSON('/api/auth/login', { username, password });
    const out = document.getElementById('login-result');
    if (res.access_token) {
      localStorage.setItem('token', res.access_token);
      out.innerHTML = '<div class="alert alert-success">Logged in</div>';
      setTimeout(() => window.location.href = '/', 600);
    } else {
      out.innerHTML = '<div class="alert alert-danger">' + (res.detail || 'Login failed') + '</div>';
    }
  });
}

// Register form
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const username = document.getElementById('r_username') ? document.getElementById('r_username').value : document.getElementById('username').value;
    const first_name = document.getElementById('first_name').value;
    const last_name = document.getElementById('last_name').value;
    const password = document.getElementById('r_password') ? document.getElementById('r_password').value : document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const code = document.getElementById('code').value;

    const path = role === 'teacher' ? '/api/auth/register/teacher' : '/api/auth/register/student';
    const payload = { email, username, first_name, last_name, password };
    const res = await postJSON(path + '?code=' + encodeURIComponent(code), payload);
    const out = document.getElementById('register-result');
    out.innerHTML = '<div class="alert alert-info">' + (res.message || JSON.stringify(res)) + '</div>';
  });
}

// Join group form
const joinForm = document.getElementById('join-group-form');
if (joinForm) {
  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('join-code').value;
    const token = localStorage.getItem('token');
    const res = await fetch('/api/student/groups/join?code=' + encodeURIComponent(code), {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    document.getElementById('join-result').innerHTML = '<div class="alert alert-info">' + (data.message || JSON.stringify(data)) + '</div>';
  });
}

// Create group form on teacher page
const createGroupForm = document.getElementById('create-group-form');
if (createGroupForm) {
  createGroupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('group-name').value;
    const token = localStorage.getItem('token');
    const res = await fetch('/api/teacher/groups?name=' + encodeURIComponent(name), {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    document.getElementById('create-group-result').innerHTML = '<div class="alert alert-info">' + (data.message || JSON.stringify(data)) + '</div>';
  });
}

// Simple page loaders
window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (document.getElementById('groups-list')) {
    // load my groups
    const res = await fetch('/api/student/groups', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    const el = document.getElementById('groups-list');
    if (Array.isArray(data)) {
      el.innerHTML = data.map(g => `<div class="card mb-2"><div class="card-body"><strong>${g.name}</strong> — code: ${g.code}</div></div>`).join('');
    } else {
      el.innerHTML = '<div class="alert alert-warning">Could not load groups</div>';
    }
  }

  // Admin init form
  const adminInitForm = document.getElementById('admin-init-form');
  if (adminInitForm) {
    // check if admin already exists
    try {
      const resp = await fetch('/api/admin/init');
      const j = await resp.json();
      if (j.initialized) {
        document.getElementById('admin-init-result').innerHTML = '<div class="alert alert-warning">Admin already initialized. Please login.</div>';
        adminInitForm.style.display = 'none';
      }
    } catch (err) {
      // ignore
    }
    adminInitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin_email').value;
      const username = document.getElementById('admin_username').value;
      const first_name = document.getElementById('admin_first').value;
      const last_name = document.getElementById('admin_last').value;
      const password = document.getElementById('admin_password').value;

      const res = await postJSON('/api/admin/init', { email, username, first_name, last_name, password });
      const out = document.getElementById('admin-init-result');
      if (res.access_token) {
        localStorage.setItem('token', res.access_token);
        out.innerHTML = '<div class="alert alert-success">Admin created</div>';
        setTimeout(() => window.location.href = '/admin', 800);
      } else {
        out.innerHTML = '<div class="alert alert-danger">' + (res.detail || JSON.stringify(res)) + '</div>';
      }
    });
  }

  if (document.getElementById('quizzes-list')) {
    const res = await fetch('/api/teacher/quizzes', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    const el = document.getElementById('quizzes-list');
    if (Array.isArray(data)) {
      el.innerHTML = data.map(q => `<div class="card mb-2"><div class="card-body"><strong>${q.title}</strong> — ${q.question_count} questions</div></div>`).join('');
    } else {
      el.innerHTML = '<div class="alert alert-warning">Could not load quizzes</div>';
    }
  }

  if (document.getElementById('requests-list')) {
    const res = await fetch('/api/admin/registration-requests', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    const el = document.getElementById('requests-list');
    if (Array.isArray(data)) {
      el.innerHTML = data.map(r => `<div class="card mb-2"><div class="card-body">${r.email} — ${r.role} — ${r.status} <div class="mt-2"><a class="btn btn-sm btn-success" href="#" data-id="${r.id}" data-action="approve">Approve</a> <a class="btn btn-sm btn-danger" href="#" data-id="${r.id}" data-action="reject">Reject</a></div></div></div>`).join('');
      el.querySelectorAll('a[data-action]').forEach(a => {
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          const id = a.dataset.id; const action = a.dataset.action;
          const res = await fetch('/api/admin/registration-requests/' + id + '/' + (action === 'approve' ? 'approve' : 'reject'), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
          const json = await res.json();
          alert(json.message || JSON.stringify(json));
          location.reload();
        });
      });
    } else {
      el.innerHTML = '<div class="alert alert-warning">Could not load requests</div>';
    }
  }

  // Admin users tab
  if (document.getElementById('users-list')) {
    async function loadUsers() {
      const res = await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      const el = document.getElementById('users-list');
      if (Array.isArray(data)) {
        el.innerHTML = data.map(u => `
          <div class="card mb-2"><div class="card-body d-flex justify-content-between align-items-center">
            <div>
              <strong>${u.username || ''}</strong> — ${u.email} <div class="small text-muted">${u.first_name || ''} ${u.last_name || ''}</div>
            </div>
            <div class="d-flex gap-2 align-items-center">
              <select class="form-select form-select-sm role-select" data-id="${u.id}">
                <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
                <option value="teacher" ${u.role==='teacher'?'selected':''}>teacher</option>
                <option value="student" ${u.role==='student'?'selected':''}>student</option>
              </select>
              <button class="btn btn-sm btn-danger deactivate-btn" data-id="${u.id}">Deactivate</button>
            </div>
          </div></div>
        `).join('');

        el.querySelectorAll('.role-select').forEach(s => {
          s.addEventListener('change', async (e) => {
            const id = s.dataset.id; const role = s.value;
            const res = await fetch('/api/admin/users/' + id, { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
            const json = await res.json();
            alert(json.message || 'Updated');
            loadUsers();
          });
        });

        el.querySelectorAll('.deactivate-btn').forEach(b => {
          b.addEventListener('click', async (e) => {
            const id = b.dataset.id;
            if (!confirm('Deactivate user?')) return;
            const res = await fetch('/api/admin/users/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
            const json = await res.json();
            alert(json.message || 'Deactivated');
            loadUsers();
          });
        });
      } else {
        el.innerHTML = '<div class="alert alert-warning">Could not load users</div>';
      }
    }
    loadUsers();
  }

  // Admin registration codes tab
  if (document.getElementById('codes-list')) {
    async function loadCodes() {
      const res = await fetch('/api/admin/registration-codes', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      const el = document.getElementById('codes-list');
      if (Array.isArray(data)) {
        el.innerHTML = data.map(c => `<div class="card mb-2"><div class="card-body d-flex justify-content-between align-items-center"><div><strong>${c.role_type}</strong> — ${c.code} <div class="small text-muted">expires: ${new Date(c.expires_at).toLocaleString()}</div></div><div><button class="btn btn-sm btn-danger delete-code" data-id="${c.id}">Delete</button></div></div></div>`).join('');
        el.querySelectorAll('.delete-code').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (!confirm('Delete registration code?')) return;
            const res = await fetch('/api/admin/registration-codes/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
            const json = await res.json();
            alert(json.message || 'Deleted');
            loadCodes();
          });
        });
      } else {
        el.innerHTML = '<div class="alert alert-warning">Could not load codes</div>';
      }
    }

    // create code form
    const createCodeForm = document.getElementById('create-code-form');
    if (createCodeForm) {
      createCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = document.getElementById('code-role').value;
        const expires = parseInt(document.getElementById('code-expires').value || '24', 10);
        const res = await fetch('/api/admin/registration-codes?role_type=' + encodeURIComponent(role) + '&expires_in_hours=' + encodeURIComponent(expires), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
        const json = await res.json();
        if (json && json.code) {
          alert('Created: ' + json.code);
        } else {
          alert(JSON.stringify(json));
        }
        loadCodes();
      });
    }

    loadCodes();
  }

  // Teacher quizzes page
  if (document.getElementById('create-quiz-form')) {
    const groupsRes = await fetch('/api/teacher/groups', { headers: { 'Authorization': 'Bearer ' + token } });
    const groups = await groupsRes.json();
    const groupSelect = document.getElementById('quiz-group');
    if (Array.isArray(groups)) {
      groupSelect.innerHTML = groups.map(g => `<option value="${g.id}">${g.name} (${g.code})</option>`).join('');
    }

    const createQuizForm = document.getElementById('create-quiz-form');
    createQuizForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('quiz-title').value;
      const group_id = parseInt(document.getElementById('quiz-group').value, 10);
      const res = await fetch('/api/teacher/quizzes', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ title, group_id }) });
      const data = await res.json();
      if (data.id) {
        window.location.href = '/teacher/quizzes/' + data.id + '/edit';
      } else {
        alert(JSON.stringify(data));
      }
    });

    // load quizzes list (reuse existing element id 'quizzes-list')
    async function loadTeacherQuizzes() {
      const res = await fetch('/api/teacher/quizzes', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      const el = document.getElementById('quizzes-list');
      if (Array.isArray(data)) {
        el.innerHTML = data.map(q => `<div class="card mb-2"><div class="card-body d-flex justify-content-between align-items-center"><div><strong>${q.title}</strong><div class="small text-muted">${q.description||''}</div></div><div><a class="btn btn-sm btn-primary me-2" href="/teacher/quizzes/${q.id}/edit">Edit</a><a class="btn btn-sm btn-secondary" href="/quiz/${q.id}">Take</a></div></div></div>`).join('');
      } else {
        el.innerHTML = '<div class="alert alert-warning">Could not load quizzes</div>';
      }
    }
    loadTeacherQuizzes();
  }

  // Teacher quiz editor
  if (typeof EDIT_QUIZ_ID !== 'undefined' && document.getElementById('questions-list')) {
    const quizId = EDIT_QUIZ_ID;

    async function loadQuiz() {
      const res = await fetch('/api/teacher/quizzes/' + quizId, { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      document.getElementById('quiz-title').value = data.title || '';
      document.getElementById('quiz-desc').value = data.description || '';
    }

    async function loadQuestions() {
      const res = await fetch('/api/teacher/quizzes/' + quizId + '/questions', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      const el = document.getElementById('questions-list');
      if (Array.isArray(data)) {
        el.innerHTML = data.map(q => `
          <div class="card mb-2"><div class="card-body">
            <div class="d-flex justify-content-between"><div><strong>${q.text}</strong><div class="small text-muted">Points: ${q.points}</div></div><div><button class="btn btn-sm btn-danger delete-question" data-id="${q.id}">Delete</button></div></div>
            <ul class="mt-2">${q.options.map(o => `<li>${o.is_correct?'<strong>✔</strong> ':''}${o.text}</li>`).join('')}</ul>
          </div></div>
        `).join('');

        el.querySelectorAll('.delete-question').forEach(b => {
          b.addEventListener('click', async () => {
            if (!confirm('Delete question?')) return;
            const id = b.dataset.id;
            const res = await fetch('/api/teacher/questions/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
            const json = await res.json();
            alert(json.message || JSON.stringify(json));
            loadQuestions();
          });
        });
      } else {
        el.innerHTML = '<div class="alert alert-warning">Could not load questions</div>';
      }
    }

    // add question form
    const addQuestionForm = document.getElementById('add-question-form');
    addQuestionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = document.getElementById('question-text').value;
      const optsRaw = document.getElementById('question-options').value.split('\n').map(s => s.trim()).filter(Boolean);
      const options = optsRaw.map((line, idx) => ({ text: line.replace(/^\*/, '').trim(), is_correct: line.startsWith('*'), order: idx }));
      const payload = { text, question_type: 'single_choice', order: 0, points: 1.0, time_limit: null, options };
      const res = await fetch('/api/teacher/quizzes/' + quizId + '/questions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.id) {
        document.getElementById('question-text').value = '';
        document.getElementById('question-options').value = '';
        loadQuestions();
      } else {
        alert(JSON.stringify(json));
      }
    });

    await loadQuiz();
    await loadQuestions();
  }
});
