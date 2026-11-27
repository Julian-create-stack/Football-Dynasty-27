const KEY = 'ufm_save_id'

export function getSaveId() {
  try { return localStorage.getItem(KEY) } catch { return null }
}
export function setSaveId(id) {
  try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY) } catch {}
}
export function clearSaveId() { setSaveId(null) }

async function request(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const saveId = getSaveId()
  if (saveId) headers['x-save-id'] = saveId
  const res = await fetch(`/api${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  let data = null
  try { data = await res.json() } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (p) => request(p),
  post: (p, body = {}) => request(p, { method: 'POST', body }),
  del: (p) => request(p, { method: 'DELETE' }),
}
