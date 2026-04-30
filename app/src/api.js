// Tiny session-aware fetch wrapper. Every request sends/receives the rm_session cookie.

const BASE = '/api';

async function request(method, path, body, opts = {}) {
  const headers = { 'Accept': 'application/json' };
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: payload,
    credentials: 'include',
    ...opts,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, body) => request('POST', p, body),
  patch: (p, body) => request('PATCH', p, body),
  delete: (p) => request('DELETE', p),
  upload: (p, formData) => request('POST', p, formData),
};

// Convenience wrappers for the routes we hit a lot.
export const auth = {
  me: () => api.get('/auth/me'),
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (payload) => api.post('/auth/register', payload),
  logout: () => api.post('/auth/logout'),
};

export const subs = {
  list: () => api.get('/submissions'),
  get: (id) => api.get(`/submissions/${id}`),
  create: (payload) => api.post('/submissions', payload),
  patchField: (id, fid, body) => api.patch(`/submissions/${id}/fields/${fid}`, body),
  patchFields: (id, updates) => api.patch(`/submissions/${id}/fields`, { updates }),
  submit: (id) => api.post(`/submissions/${id}/submit`),
  uploadFile: (id, formData) => api.upload(`/submissions/${id}/files`, formData),
  listFiles: (id) => api.get(`/submissions/${id}/files`),
  copilot: (id, text, lang) => api.post(`/submissions/${id}/copilot`, { text, lang }),
  copilotHistory: (id) => api.get(`/submissions/${id}/copilot`),
};

export const curator = {
  decide: (id, decision, comments) => api.post(`/curator/submissions/${id}/decision`, { decision, comments }),
  publish: (id, data) => api.post(`/curator/submissions/${id}/publish`, { data }),
};

export const catalog = {
  list: () => api.get('/catalog'),
  get: (id) => api.get(`/catalog/${id}`),
};
