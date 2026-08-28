function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  req.user = req.session.user
  return next()
}

function requireRole(...allowedRoles) {
  return [requireAuth, (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' })
    }

    return next()
  }]
}

function requireSelf(req, res, next) {
  const requestedUserId = Number(req.params.userId)

  if (!Number.isInteger(requestedUserId) || requestedUserId !== req.user.id) {
    return res.status(403).json({ error: 'You can only access your own profile.' })
  }

  return next()
}

module.exports = {
  requireAuth,
  requireRole,
  requireSelf,
}
