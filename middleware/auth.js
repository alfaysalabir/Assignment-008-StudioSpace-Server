// Challenge 1: JWT security
// The token comes from an HTTPOnly cookie (or Bearer header from the Next.js proxy).
// If the token is missing or wrong, we send 401 Unauthorized.
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  let token = null;

  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  } else if (req.cookies && req.cookies.studio_token) {
    token = req.cookies.studio_token;
  }

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: please login first" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid or expired token" });
  }
}

module.exports = verifyToken;
