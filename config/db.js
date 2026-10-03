// config/db.js
// Conexión a SQLite + creación/migración de tablas (multi-evento).

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// En producción (Railway): DATABASE_PATH=/data/morat.db (volumen persistente).
const DB_PATH = process.env.DATABASE_PATH
  ? process.env.DATABASE_PATH
  : path.join(__dirname, "..", "database", "morat.db");

const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Error al conectar con la base de datos:", err.message);
    process.exit(1);
  }
  console.log("✅ Conectado a SQLite en:", DB_PATH);
});

// Helpers con Promises (db.p.run / db.p.get / db.p.all)
const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    })
  );
const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );
const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );
db.p = { run, get, all };

// Eventos disponibles. Para agregar uno nuevo en el futuro, añade una línea aquí
// (id nuevo, slug único y prefijo de código) y reinicia el servidor.
// El id 1 es el Karaoke original: sus invitados y códigos (MORAT-###) no cambian.
const EVENTOS_INICIALES = [
  { id: 1, slug: "karaoke", nombre: "Karaoke Ya Es Mañana", prefijo: "MORAT" },
  { id: 2, slug: "picnic", nombre: "Picnic Moratero – Balas Perdidas", prefijo: "PICNIC" },
];

async function init() {
  await run("PRAGMA foreign_keys = ON;");
  await run("PRAGMA journal_mode = WAL;");

  await run(`
    CREATE TABLE IF NOT EXISTS invitados (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT NOT NULL,
      tipo          TEXT NOT NULL DEFAULT 'Invitado',
      cod           TEXT UNIQUE,
      estado        TEXT NOT NULL DEFAULT 'pendiente',
      horaIngreso   TEXT,
      creadoEn      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS eventos (
      id          INTEGER PRIMARY KEY,
      slug        TEXT NOT NULL UNIQUE,
      nombre      TEXT NOT NULL,
      prefijo     TEXT NOT NULL,
      ultimo_num  INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migración: los invitados existentes quedan asignados al evento 1 (Karaoke).
  const cols = await all("PRAGMA table_info(invitados)");
  if (!cols.some((c) => c.name === "evento_id")) {
    await run("ALTER TABLE invitados ADD COLUMN evento_id INTEGER NOT NULL DEFAULT 1");
    console.log("✅ Migración: columna evento_id agregada (invitados existentes → Karaoke).");
  }
  await run("CREATE INDEX IF NOT EXISTS idx_invitados_evento ON invitados(evento_id)");

  // Cupos (aforo) por evento; NULL = sin definir (el Karaoke lo maneja en su propia pantalla).
  const colsEv = await all("PRAGMA table_info(eventos)");
  if (!colsEv.some((c) => c.name === "cupos")) {
    await run("ALTER TABLE eventos ADD COLUMN cupos INTEGER");
  }

  for (const e of EVENTOS_INICIALES) {
    let ultimo = 0;
    if (e.id === 1) {
      // Continúa la numeración del karaoke sin reutilizar códigos ya emitidos.
      const seq = await get("SELECT seq FROM sqlite_sequence WHERE name = 'invitados'");
      ultimo = seq ? seq.seq : 0;
    }
    await run(
      "INSERT OR IGNORE INTO eventos (id, slug, nombre, prefijo, ultimo_num) VALUES (?, ?, ?, ?, ?)",
      [e.id, e.slug, e.nombre, e.prefijo, ultimo]
    );
  }
  console.log("✅ Tablas 'invitados' y 'eventos' listas.");
}

db.ready = init().catch((err) => {
  console.error("❌ Error al inicializar la base de datos:", err.message);
  process.exit(1);
});

module.exports = db;
