const { rateLimit } = require('express-rate-limit')

// All error responses in this app are JSON, so the default text/plain
// "Too many requests" body is replaced with the standard error shape.
function jsonRateLimitHandler(req, res) {
  res.status(429).json({ error: 'Too many requests, please try again later.' })
}

/**
 * Brute-force protection for credential endpoints (register + login).
 * 20 attempts per 15 minutes per IP — generous enough for a human who
 * mis-types a password a few times, tight enough to stop online guessing.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
})

/**
 * Cost protection for the LLM-backed assistant. Every message and confirm
 * call hits the AI provider, so the ceiling is per-minute rather than
 * per-quarter-hour: 30 requests per minute per IP.
 */
const aiAssistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
})

module.exports = {
  authLimiter,
  aiAssistantLimiter,
}
