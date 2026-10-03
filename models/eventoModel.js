// models/eventoModel.js
const { p } = require("../config/db");

const listar = () => p.all("SELECT id, slug, nombre, prefijo FROM eventos ORDER BY id");
const porSlug = (slug) =>
  p.get("SELECT id, slug, nombre, prefijo, cupos FROM eventos WHERE slug = ?", [slug]);

// Datos públicos (sin información personal): solo conteos.
async function resumenPublico(evento) {
  const r = await p.get(
    "SELECT COUNT(*) AS registrados FROM invitados WHERE evento_id = ?",
    [evento.id]
  );
  return { nombre: evento.nombre, cupos: evento.cupos, registrados: r.registrados };
}

const actualizarCupos = (id, cupos) =>
  p.run("UPDATE eventos SET cupos = ? WHERE id = ?", [cupos, id]);

module.exports = { listar, porSlug, resumenPublico, actualizarCupos };
