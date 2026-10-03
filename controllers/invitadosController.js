// controllers/invitadosController.js
// Recibe req/res, valida entradas y llama al modelo. No tiene SQL aquí.

const invitadoModel = require("../models/invitadoModel");

const TIPOS_VALIDOS = ["Invitado", "Artista", "Staff"];
const ESTADOS_VALIDOS = ["pendiente", "ingreso", "falta"];

/**
 * POST /api/invitados
 * body: { nombre, tipo }
 */
async function crear(req, res) {
  try {
    const { nombre, tipo } = req.body;

    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return res.status(400).json({ error: "El campo 'nombre' es obligatorio." });
    }

    const tipoFinal = tipo && TIPOS_VALIDOS.includes(tipo) ? tipo : "Invitado";

    const invitado = await invitadoModel.crearInvitado({
      eventoId: req.evento.id,
      nombre: nombre.trim(),
      tipo: tipoFinal,
    });

    return res.status(201).json({ mensaje: "Invitado creado correctamente.", invitado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al crear el invitado." });
  }
}

/**
 * GET /api/invitados?tipo=&estado=&q=
 */
async function listar(req, res) {
  try {
    const { tipo, estado, q } = req.query;
    const invitados = await invitadoModel.listarInvitados({ eventoId: req.evento.id, tipo, estado, q });
    return res.json({ total: invitados.length, invitados });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al listar los invitados." });
  }
}

/**
 * GET /api/invitados/:cod
 */
async function obtenerPorCodigo(req, res) {
  try {
    const invitado = await invitadoModel.obtenerPorCodigo(req.evento.id, req.params.cod);
    if (!invitado) {
      return res.status(404).json({ error: "No existe un invitado con ese código." });
    }
    return res.json({ invitado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al buscar el invitado." });
  }
}

/**
 * PATCH /api/invitados/ingreso/:cod
 * Marca el ingreso (check-in) por código y guarda la hora exacta.
 */
async function marcarIngreso(req, res) {
  try {
    const { cod } = req.params;

    const { resultado, invitado } = await invitadoModel.marcarIngresoPorCodigo(req.evento.id, cod);

    if (resultado === "no_existe") {
      return res.status(404).json({ error: "Código no reconocido.", cod });
    }
    if (resultado === "ya_ingreso") {
      return res.status(409).json({
        error: "Este invitado ya había ingresado.",
        invitado,
      });
    }

    return res.json({ mensaje: `Bienvenido, ${invitado.nombre} ✓`, invitado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al marcar el ingreso." });
  }
}

/**
 * PATCH /api/invitados/:id/estado
 * body: { estado: 'pendiente' | 'ingreso' | 'falta' }
 * Endpoint genérico para cambiar el estado manualmente desde el panel admin.
 */
async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Usa uno de: ${ESTADOS_VALIDOS.join(", ")}`,
      });
    }

    const invitado = await invitadoModel.actualizarEstado(req.evento.id, id, estado);
    if (!invitado) {
      return res.status(404).json({ error: "No existe un invitado con ese id." });
    }

    return res.json({ mensaje: "Estado actualizado.", invitado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al actualizar el estado." });
  }
}

/**
 * DELETE /api/invitados/:id
 */
async function eliminar(req, res) {
  try {
    const eliminado = await invitadoModel.eliminarInvitado(req.evento.id, req.params.id);
    if (!eliminado) {
      return res.status(404).json({ error: "No existe un invitado con ese id." });
    }
    return res.json({ mensaje: "Invitado eliminado." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al eliminar el invitado." });
  }
}

const ITEMS_VALIDOS = ["refrigerio", "ceramica"];
const ETIQUETA_ITEM = { refrigerio: "Refrigerio", ceramica: "Kit de cerámicas" };

/**
 * PATCH /entrega/:item/:cod  (escáner de entregas)
 * Marca la entrega del refrigerio o del kit de cerámicas; 409 si ya se entregó.
 */
async function entregarPorCodigo(req, res) {
  try {
    const { item, cod } = req.params;
    if (!ITEMS_VALIDOS.includes(item)) {
      return res.status(400).json({ error: "Ítem inválido." });
    }
    const { resultado, invitado } = await invitadoModel.entregarPorCodigo(req.evento.id, item, cod);
    if (resultado === "no_existe") {
      return res.status(404).json({ error: "Código no reconocido.", cod });
    }
    if (resultado === "ya_entregado") {
      return res.status(409).json({
        error: `${ETIQUETA_ITEM[item]} ya fue entregado a esta persona.`,
        invitado,
      });
    }
    return res.json({
      mensaje: `${ETIQUETA_ITEM[item]} entregado a ${invitado.nombre}`,
      aviso: invitado.estado !== "ingreso" ? "Aún no aparece como ingresado." : null,
      invitado,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al registrar la entrega." });
  }
}

/**
 * PATCH /:id/entrega   body: { item, entregado }
 * Marca o desmarca una entrega desde la lista (para corregir errores).
 */
async function cambiarEntrega(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { item, entregado } = req.body;
    if (!ITEMS_VALIDOS.includes(item) || typeof entregado !== "boolean") {
      return res.status(400).json({ error: "Datos de entrega inválidos." });
    }
    const invitado = await invitadoModel.cambiarEntrega(req.evento.id, id, item, entregado);
    if (!invitado) return res.status(404).json({ error: "Invitado no encontrado." });
    return res.json({ invitado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al actualizar la entrega." });
  }
}

/**
 * GET /api/invitados/stats/resumen
 */
async function estadisticas(req, res) {
  try {
    const stats = await invitadoModel.obtenerEstadisticas(req.evento.id);
    return res.json(stats);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error al calcular estadísticas." });
  }
}

module.exports = {
  crear,
  listar,
  obtenerPorCodigo,
  marcarIngreso,
  actualizarEstado,
  entregarPorCodigo,
  cambiarEntrega,
  eliminar,
  estadisticas,
};
