const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- App middleware wiring tests (real express app, no mocks) ----------
//
// Rate limiting and CORS are middleware concerns, so these tests boot the real
// app from app.js on an ephemeral port and drive it over HTTP. No database
// rows are touched: the throttled register requests carry an invalid body
// (rejected with 400 before any query) and the AI-assistant requests are
// unauthenticated (401 before the controller runs).
//
// The CORS policy is read from the environment when app.js is first required,
// so FRONTEND_ORIGIN must be set before the require call.

process.env.FRONTEND_ORIGIN = 'https://tibb-assist.example.com'

const app = require('../app')

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

function post(server, path, body) {
  const { port } = server.address()
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function get(server, path, headers = {}) {
  const { port } = server.address()
  return fetch(`http://127.0.0.1:${port}${path}`, { headers })
}

// ---------- POST /api/auth/register — auth rate limiter ----------

test('auth limiter: the 21st register attempt within 15 minutes is throttled with 429', async () => {
  const server = await listen()
  try {
    let lastStatus = null
    let lastBody = null
    for (let attempt = 0; attempt < 21; attempt++) {
      const response = await post(server, '/api/auth/register', {})
      lastStatus = response.status
      lastBody = await response.json()
    }
    // The first 20 attempts fail validation (400); the ceiling turns into 429.
    assert.equal(lastStatus, 429)
    assert.equal(lastBody.error, 'Too many requests, please try again later.')
  } finally {
    await close(server)
  }
})

test('auth limiter: throttled responses carry the RateLimit headers', async () => {
  const server = await listen()
  try {
    // The limiter store is per-process and the previous test already consumed
    // the register budget for this IP, so a single request is enough here.
    const response = await post(server, '/api/auth/register', {})
    assert.equal(response.status, 429)
    assert.ok(response.headers.get('ratelimit-limit'), 'RateLimit-Limit header present')
    assert.ok(response.headers.get('ratelimit-remaining') !== null, 'RateLimit-Remaining header present')
  } finally {
    await close(server)
  }
})

// ---------- POST /api/ai-assistant/* — AI assistant rate limiter ----------

test('ai-assistant limiter: the 31st unauthenticated message within a minute is throttled with 429', async () => {
  const server = await listen()
  try {
    let lastStatus = null
    for (let attempt = 0; attempt < 31; attempt++) {
      const response = await post(server, '/api/ai-assistant/message', { message: 'hello' })
      lastStatus = response.status
    }
    // The first 30 attempts are unauthenticated (401); the ceiling is 429.
    assert.equal(lastStatus, 429)
  } finally {
    await close(server)
  }
})

// ---------- CORS — FRONTEND_ORIGIN restriction ----------

test('cors: requests from FRONTEND_ORIGIN are allowed with credentials', async () => {
  const server = await listen()
  try {
    const response = await get(server, '/api/health', {
      Origin: 'https://tibb-assist.example.com',
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://tibb-assist.example.com')
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  } finally {
    await close(server)
  }
})

test('cors: requests from any other origin receive no Access-Control-Allow-Origin header', async () => {
  const server = await listen()
  try {
    const response = await get(server, '/api/health', {
      Origin: 'https://not-the-frontend.example.com',
    })
    assert.equal(response.status, 200)
    // Without a matching Access-Control-Allow-Origin the browser refuses to
    // expose the response to that origin, credentials header or not.
    assert.equal(response.headers.get('access-control-allow-origin'), null)
  } finally {
    await close(server)
  }
})
