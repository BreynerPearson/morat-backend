// middleware/adminToken.js
// Protege las rutas de /api/eventos/... con un token de organizador.
// Si ADMIN_TOKEN no está definido (desarrollo local), no exige nada.
// La ruta antigua /api/invitados (Karaoke) NO usa este middleware: queda como estaba.

const crypto = require("crypto");

function iguales(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

module.exports = function adminToken(req, res, next) {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado) return next();
  if (iguales(req.get("x-admin-token") || "", esperado)) return next();
  return res.status(401).json({ error: "No autorizado." });
};
