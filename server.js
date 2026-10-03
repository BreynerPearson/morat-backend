// server.js
// Punto de entrada de la API - Backend Morat (multi-evento)

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./config/db"); // inicializa la conexión, crea/migra tablas

const eventoModel = require("./models/eventoModel");
const invitadosRoutes = require("./routes/invitadosRoutes");
const adminToken = require("./middleware/adminToken");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middlewares ----------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// `extensions: ["html"]` permite abrir /picnic además de /picnic.html
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ---------- Resolución de evento ----------
// slugFijo: para la ruta antigua (/api/invitados → siempre "karaoke").
const resolverEvento = (slugFijo) => async (req, res, next) => {
  try {
    const slug = slugFijo || req.params.slug;
    const evento = await eventoModel.porSlug(slug);
    if (!evento) return res.status(404).json({ error: "Evento no encontrado." });
    req.evento = evento;
    next();
  } catch (err) {
    next(err);
  }
};

// ---------- Rutas ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, mensaje: "API Morat funcionando 🎤" });
});

// Compatibilidad: el frontend del Karaoke sigue usando /api/invitados sin cambios.
app.use("/api/invitados", resolverEvento("karaoke"), invitadosRoutes);

// Multi-evento: /api/eventos/picnic/invitados, /api/eventos/karaoke/invitados, ...
app.get("/api/eventos", async (req, res, next) => {
  try {
    res.json({ eventos: await eventoModel.listar() });
  } catch (err) {
    next(err);
  }
});
app.use("/api/eventos/:slug/invitados", adminToken, resolverEvento(), invitadosRoutes);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

// ---------- Manejador de errores central ----------
app.use((err, req, res, next) => {
  console.error("Error inesperado:", err);
  res.status(500).json({ error: "Error interno del servidor." });
});

db.ready.then(() => {
  app.listen(PORT, () => {
    console.log(`\n🎤 Servidor Morat corriendo en http://localhost:${PORT}`);
    console.log(`   Health check:   http://localhost:${PORT}/api/health`);
    console.log(`   Karaoke (API):  /api/invitados  (compatibilidad)`);
    console.log(`   Eventos (API):  /api/eventos/:slug/invitados\n`);
  });
});
