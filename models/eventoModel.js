// models/eventoModel.js
const { p } = require("../config/db");

const listar = () => p.all("SELECT id, slug, nombre, prefijo FROM eventos ORDER BY id");
const porSlug = (slug) =>
  p.get("SELECT id, slug, nombre, prefijo FROM eventos WHERE slug = ?", [slug]);

module.exports = { listar, porSlug };
