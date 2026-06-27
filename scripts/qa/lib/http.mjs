export async function http(url, { method = 'GET', body, token, headers = {} } = {}) {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const ms = Date.now() - start
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }
    return { status: res.status, data, ms, ok: res.ok }
  } catch (err) {
    return { status: 0, data: null, ms: Date.now() - start, ok: false, error: err.message }
  }
}

export function assertStatus(res, expected, label = '') {
  if (res.status !== expected) {
    throw new Error(
      `${label ? label + ': ' : ''}Expected HTTP ${expected}, got ${res.status}. Body: ${JSON.stringify(res.data)}`
    )
  }
}

export function assertField(obj, field, label = '') {
  if (obj?.[field] === undefined || obj?.[field] === null) {
    throw new Error(`${label ? label + ': ' : ''}Expected field "${field}" in response. Got: ${JSON.stringify(obj)}`)
  }
}
