// Auth disabled — open access for all
function requireAdmin(req, res, next) {
  next();
}

module.exports = { requireAdmin };
