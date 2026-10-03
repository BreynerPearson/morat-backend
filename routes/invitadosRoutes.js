// routes/invitadosRoutes.js
// Definición de rutas REST. Importante: rutas más específicas ("/stats/resumen",
// "/ingreso/:cod") van ANTES que "/:cod" para que Express no las confunda.

const express = require("express");
const router = express.Router();
const controller = require("../controllers/invitadosController");

// Estadísticas / resumen de aforo
router.get("/stats/resumen", controller.estadisticas);

// Check-in por código (para el escáner QR)
router.patch("/ingreso/:cod", controller.marcarIngreso);

// Cambiar estado manualmente (panel admin: pendiente | ingreso | falta)
router.patch("/:id/estado", controller.actualizarEstado);

// CRUD básico
router.post("/", controller.crear);
router.get("/", controller.listar);
router.get("/:cod", controller.obtenerPorCodigo);
router.delete("/:id", controller.eliminar);

module.exports = router;
