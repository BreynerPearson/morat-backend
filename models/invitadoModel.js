// models/invitadoModel.js
// Capa de datos. Todas las consultas van acotadas a un evento (eventoId),
// así los invitados de un evento nunca se mezclan con los de otro.

const { p } = require("../config/db");

// Hora de Colombia sin importar la zona horaria del servidor (Railway corre en UTC).
function horaLocal() {
  return new Date().toLocaleString("es-CO", { hour12: false, timeZone: "America/Bogota" });
}

/**
 * Crea un invitado con código único por evento: MORAT-001, PICNIC-001...
 * El contador vive en la tabla eventos y se incrementa de forma atómica,
 * por lo que un código nunca se reutiliza (aunque borres invitados).
 */
async function crearInvitado({ eventoId, nombre, tipo }) {
  const ev = await p.get(
    "UPDATE eventos SET ultimo_num = ultimo_num + 1 WHERE id = ? RETURNING prefijo, ultimo_num",
    [eventoId]
  );
  if (!ev) throw new Error("Evento inexistente");

  const cod = `${ev.prefijo}-${String(ev.ultimo_num).padStart(3, "0")}`;
  const r = await p.run(
    `INSERT INTO invitados (nombre, tipo, cod, estado, horaIngreso, evento_id, creadoEn)
     VALUES (?, ?, ?, 'pendiente', NULL, ?, datetime('now', '-5 hours'))`,
    [nombre, tipo, cod, eventoId]
  );
  return p.get("SELECT * FROM invitados WHERE id = ?", [r.lastID]);
}

function listarInvitados({ eventoId, tipo, estado, q }) {
  let sql = "SELECT * FROM invitados WHERE evento_id = ?";
  const params = [eventoId];
  if (tipo) { sql += " AND tipo = ?"; params.push(tipo); }
  if (estado) { sql += " AND estado = ?"; params.push(estado); }
  if (q) { sql += " AND nombre LIKE ?"; params.push(`%${q}%`); }
  sql += " ORDER BY id ASC";
  return p.all(sql, params);
}

function obtenerPorCodigo(eventoId, cod) {
  return p.get("SELECT * FROM invitados WHERE cod = ? AND evento_id = ?", [cod, eventoId]);
}

/**
 * Check-in atómico: un solo UPDATE que solo actúa si aún no había ingresado.
 * Si dos celulares escanean el mismo QR a la vez, solo uno gana.
 * @returns {{resultado: 'ok'|'ya_ingreso'|'no_existe', invitado?: object}}
 */
async function marcarIngresoPorCodigo(eventoId, cod) {
  const r = await p.run(
    `UPDATE invitados SET estado = 'ingreso', horaIngreso = ?
     WHERE cod = ? AND evento_id = ? AND estado != 'ingreso'`,
    [horaLocal(), cod, eventoId]
  );
  const invitado = await obtenerPorCodigo(eventoId, cod);
  if (!invitado) return { resultado: "no_existe" };
  return { resultado: r.changes > 0 ? "ok" : "ya_ingreso", invitado };
}

async function actualizarEstado(eventoId, id, estado) {
  const hora = estado === "ingreso" ? horaLocal() : null;
  const r = await p.run(
    "UPDATE invitados SET estado = ?, horaIngreso = ? WHERE id = ? AND evento_id = ?",
    [estado, hora, id, eventoId]
  );
  if (r.changes === 0) return null;
  return p.get("SELECT * FROM invitados WHERE id = ? AND evento_id = ?", [id, eventoId]);
}

async function eliminarInvitado(eventoId, id) {
  const r = await p.run("DELETE FROM invitados WHERE id = ? AND evento_id = ?", [id, eventoId]);
  return r.changes > 0;
}

async function obtenerEstadisticas(eventoId) {
  const row = await p.get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN estado = 'ingreso' THEN 1 ELSE 0 END) AS ingresados,
       SUM(CASE WHEN estado = 'falta' THEN 1 ELSE 0 END) AS noAsistieron,
       SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes
     FROM invitados WHERE evento_id = ?`,
    [eventoId]
  );
  return {
    total: row.total || 0,
    ingresados: row.ingresados || 0,
    noAsistieron: row.noAsistieron || 0,
    pendientes: row.pendientes || 0,
  };
}

module.exports = {
  crearInvitado,
  listarInvitados,
  obtenerPorCodigo,
  marcarIngresoPorCodigo,
  actualizarEstado,
  eliminarInvitado,
  obtenerEstadisticas,
};
