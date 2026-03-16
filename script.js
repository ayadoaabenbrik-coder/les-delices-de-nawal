const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./database.sqlite");

// =========================
// CREATION DES TABLES
// =========================
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      variant TEXT,
      quantity INTEGER NOT NULL,
      note TEXT,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);
});

// =========================
// INSCRIPTION
// =========================
app.post("/api/register", async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: "Tous les champs sont obligatoires." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)`,
      [name, email.toLowerCase(), phone, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ error: "Cet email existe déjà." });
          }
          return res.status(500).json({ error: "Erreur serveur lors de l'inscription." });
        }

        return res.json({
          message: "Compte créé avec succès.",
          user: {
            id: this.lastID,
            name,
            email: email.toLowerCase(),
            phone
          }
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ error: "Erreur serveur." });
  }
});

// =========================
// CONNEXION
// =========================
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  db.get(
    `SELECT * FROM users WHERE email = ?`,
    [email.toLowerCase()],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Erreur serveur." });
      }

      if (!user) {
        return res.status(400).json({ error: "Utilisateur introuvable." });
      }

      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        return res.status(400).json({ error: "Mot de passe incorrect." });
      }

      return res.json({
        message: "Connexion réussie.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone
        }
      });
    }
  );
});

// =========================
// ENREGISTRER UNE COMMANDE
// =========================
app.post("/api/orders", (req, res) => {
  const { userId, items, total } = req.body;

  if (!userId || !items || !Array.isArray(items) || items.length === 0 || total == null) {
    return res.status(400).json({ error: "Commande invalide." });
  }

  db.run(
    `INSERT INTO orders (user_id, total) VALUES (?, ?)`,
    [userId, total],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Impossible d'enregistrer la commande." });
      }

      const orderId = this.lastID;
      const stmt = db.prepare(`
        INSERT INTO order_items (
          order_id,
          product_name,
          variant,
          quantity,
          note,
          unit_price,
          total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        stmt.run([
          orderId,
          item.name,
          item.variant || "",
          item.quantity,
          item.note || "",
          item.unitPrice,
          item.total
        ]);
      }

      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          return res.status(500).json({ error: "Erreur lors de l'enregistrement des articles." });
        }

        return res.json({
          message: "Commande enregistrée avec succès.",
          orderId
        });
      });
    }
  );
});

// =========================
// VOIR LES COMMANDES D'UN CLIENT
// =========================
app.get("/api/orders/:userId", (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
    (err, orders) => {
      if (err) {
        return res.status(500).json({ error: "Erreur serveur." });
      }

      return res.json({ orders });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});