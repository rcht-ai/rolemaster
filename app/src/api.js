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
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch {
      // Non-JSON body (HTML error page from CDN, auth redirect, 5xx).
      // Build a clean Error so callers don't see "Unexpected token '<'".
      const looksLikeHtml = /^\s*<!doctype|<html/i.test(text);
      const msg = looksLikeHtml
        ? `Server returned HTML (HTTP ${res.status}). Likely auth lost or endpoint missing.`
        : `Bad response (HTTP ${res.status}): ${text.slice(0, 80)}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = text;
      throw err;
    }
  }
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

export const curator = {
  listIntakes: (status = 'submitted') => api.get(`/curator/intakes?status=${status}`),
  publishRolepack: (rpId) => api.post(`/curator/rolepacks/${rpId}/publish`),
  publishAll: (intakeId) => api.post(`/curator/intakes/${intakeId}/publish-all`),
};

export const sales = {
  listRolepacks: () => api.get('/sales/rolepacks'),
  getRolepack: (rpId) => api.get(`/sales/rolepacks/${rpId}`),
};

export const companyInfo = {
  get: () => api.get('/suppliers/me/company-info'),
  patch: (updates) => api.patch('/suppliers/me/company-info', { updates }),
};

// T5.3
export const notifications = {
  list: () => api.get('/notifications'),
  unread: () => api.get('/notifications?unread=1'),
  markRead: (ids) => api.post('/notifications/mark-read', { ids: ids || [] }),
};

// Taxonomies
export const taxonomy = {
  industries: () => api.get('/taxonomy/industries'),
  createIndustry: (body) => api.post('/taxonomy/industries', body),
  patchIndustry: (id, body) => api.patch(`/taxonomy/industries/${id}`, body),
  deleteIndustry: (id) => api.delete(`/taxonomy/industries/${id}`),
  regions: () => api.get('/taxonomy/regions'),
  departments: () => api.get('/taxonomy/departments'),
  companySizes: () => api.get('/taxonomy/company-sizes'),
};

// v2 — intake-based supplier flow
export const intakes = {
  list: () => api.get('/intakes'),
  create: (body) => api.post('/intakes', body || {}),
  get: (id) => api.get(`/intakes/${id}`),
  patch: (id, body) => api.patch(`/intakes/${id}`, body),
  remove: (id) => api.delete(`/intakes/${id}`),
  uploadFile: (id, formData) => api.upload(`/intakes/${id}/files`, formData),
  listFiles: (id) => api.get(`/intakes/${id}/files`),
  renameFile: (id, fid, display_name) => api.patch(`/intakes/${id}/files/${fid}`, { display_name }),
  deleteFile: (id, fid) => api.delete(`/intakes/${id}/files/${fid}`),
  extractCapabilities: (id) => api.post(`/intakes/${id}/extract-capabilities`),
  matchRoles: (id) => api.post(`/intakes/${id}/match-roles`),
  finalize: (id) => api.post(`/intakes/${id}/finalize`),
  // capabilities
  addCapability: (id, body) => api.post(`/intakes/${id}/capabilities`, body),
  patchCapabilities: (id, body) => api.patch(`/intakes/${id}/capabilities`, body),
  patchCapability: (id, capId, body) => api.patch(`/intakes/${id}/capabilities/${capId}`, body),
  deleteCapability: (id, capId) => api.delete(`/intakes/${id}/capabilities/${capId}`),
  confirmCapabilities: (id) => api.patch(`/intakes/${id}/capabilities`, { confirm_all: true }),
  // rolepacks
  addRolepack: (id, body) => api.post(`/intakes/${id}/rolepacks`, body),
  patchRolepack: (id, rpId, body) => api.patch(`/intakes/${id}/rolepacks/${rpId}`, body),
  deleteRolepack: (id, rpId) => api.delete(`/intakes/${id}/rolepacks/${rpId}`),
  prefillRolepack: (id, rpId, force) => api.post(`/intakes/${id}/rolepacks/${rpId}/prefill${force ? '?force=1' : ''}`),
  generateRolepack: (id, rpId, force) => api.post(`/intakes/${id}/rolepacks/${rpId}/generate${force ? '?force=1' : ''}`),
  rolepackCopilot: (id, rpId, message) => api.post(`/intakes/${id}/rolepacks/${rpId}/copilot`, { message }),
  rolepackCopilotHistory: (id, rpId) => api.get(`/intakes/${id}/rolepacks/${rpId}/copilot`),
};
