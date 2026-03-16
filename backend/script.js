const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = 3000;

const dbPath = path.join(__dirname, "database", "database.sqlite");
const db = new sqlite3.Database(dbPath);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "delices-marocains-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  })
);

app.use(express.static(path.join(__dirname, "../public")));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      description TEXT,
      citation TEXT,
      prix REAL NOT NULL,
      image TEXT,
      categorie TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS demandes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      nom TEXT NOT NULL,
      email TEXT NOT NULL,
      telephone TEXT NOT NULL,
      plat TEXT NOT NULL,
      quantite INTEGER NOT NULL,
      date_souhaitee TEXT,
      message TEXT,
      statut TEXT DEFAULT 'En attente',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM plats", (err, row) => {
    if (err) {
      console.error(err);
      return;
    }

    if (row.count === 0) {
      const stmt = db.prepare(`
        INSERT INTO plats (nom, description, citation, prix, image, categorie)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        "Batbout farci",
        "Pain marocain farci et gourmand.",
        "Le goût du fait maison à chaque bouchée.",
        4.5,
        "images/batbout.jpg",
        "salé"
      );

      stmt.run(
        "Msemen",
        "Crêpe feuilletée marocaine traditionnelle.",
        "Une douceur croustillante qui réchauffe le cœur.",
        3.5,
        "images/msemen.jpg",
        "sucré"
      );

      stmt.run(
        "Briouates",
        "Petits feuilletés savoureux.",
        "Petites en taille, grandes en saveur.",
        5.0,
        "images/briouates.jpg",
        "salé"
      );

      stmt.finalize();
    }
  });

  db.get("SELECT * FROM users WHERE email = ?", ["admin@delices.com"], async (err, user) => {
    if (err) {
      console.error(err);
      return;
    }

    if (!user) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      db.run(
        "INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, ?)",
        ["Admin", "admin@delices.com", hashedPassword, "admin"]
      );
    }
  });
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Accès refusé" });
  }
  next();
}

app.post("/api/register", async (req, res) => {
  const { fullname, email, password } = req.body;

  if (!fullname || !email || !password) {
    return res.status(400).json({ error: "Tous les champs sont obligatoires" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)",
      [fullname, email, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ error: "Email déjà utilisé" });
          }
          return res.status(500).json({ error: "Erreur serveur" });
        }

        req.session.user = {
          id: this.lastID,
          fullname,
          email,
          role: "client"
        };

        res.json({ message: "Compte créé avec succès" });
      }
    );
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe obligatoires" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }

    if (!user) {
      return res.status(400).json({ error: "Compte introuvable" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(400).json({ error: "Mot de passe incorrect" });
    }

    req.session.user = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      role: user.role
    };

    res.json({
      message: "Connexion réussie",
      user: req.session.user
    });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Déconnexion réussie" });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.session.user });
});

app.get("/api/plats", (req, res) => {
  db.all("SELECT * FROM plats ORDER BY id DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
    res.json(rows);
  });
});

app.post("/api/demandes", (req, res) => {
  const { nom, email, telephone, plat, quantite, date_souhaitee, message } = req.body;
  const userId = req.session.user ? req.session.user.id : null;

  if (!nom || !email || !telephone || !plat || !quantite) {
    return res.status(400).json({ error: "Veuillez remplir les champs obligatoires" });
  }

  db.run(
    `INSERT INTO demandes (user_id, nom, email, telephone, plat, quantite, date_souhaitee, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, nom, email, telephone, plat, quantite, date_souhaitee || "", message || ""],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json({ message: "Votre demande a bien été envoyée" });
    }
  );
});

app.get("/api/my-demandes", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM demandes WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.user.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json(rows);
    }
  );
});

app.get("/api/admin/demandes", requireAdmin, (req, res) => {
  db.all("SELECT * FROM demandes ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
    res.json(rows);
  });
});

app.post("/api/admin/plats", requireAdmin, (req, res) => {
  const { nom, description, citation, prix, image, categorie } = req.body;

  if (!nom || !prix || !categorie) {
    return res.status(400).json({ error: "Nom, prix et catégorie obligatoires" });
  }

  db.run(
    `INSERT INTO plats (nom, description, citation, prix, image, categorie)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nom, description || "", citation || "", prix, image || "", categorie],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json({ message: "Plat ajouté avec succès", id: this.lastID });
    }
  );
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});