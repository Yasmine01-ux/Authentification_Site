// ============================================================
// server.js : le serveur (le "back-end")
// Il reçoit les demandes du navigateur, parle à la base de
// données, et renvoie des réponses en JSON.
// ============================================================

const path = require('path');
const fs = require('fs');
const express = require('express');              // framework web : crée les routes /api/...
const helmet = require('helmet');                // ajoute des protections de sécurité HTTP
const rateLimit = require('express-rate-limit'); // limite le nombre de tentatives
const cookieParser = require('cookie-parser');   // permet de lire les cookies
const bcrypt = require('bcryptjs');              // hache les mots de passe
const jwt = require('jsonwebtoken');             // crée le "badge" de session (token)
const Database = require('better-sqlite3');      // base de données SQLite

// ---------- Configuration ----------
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
// Clé secrète qui signe les tokens. En production elle est obligatoire.
const JWT_SECRET = process.env.JWT_SECRET || (IS_PROD ? null : 'dev-secret-change-me');
if (!JWT_SECRET) throw new Error('JWT_SECRET est obligatoire en production');

// ---------- Base de données ----------
// DB_PATH permet aux tests d'utiliser une base temporaire.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'db', 'app.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true }); // crée le dossier "db" si besoin
const db = new Database(dbPath);
db.pragma('foreign_keys = ON'); // active le lien entre les deux tables

// Création des tables (ne fait rien si elles existent déjà)
db.exec(`
  -- Un utilisateur par ligne. L'email est unique : impossible de s'inscrire deux fois.
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE, -- NOCASE : a@x.fr = A@X.FR
    password   TEXT NOT NULL,                       -- mot de passe HACHÉ, jamais en clair
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT
  );
  -- Historique : une ligne à chaque connexion réussie.
  CREATE TABLE IF NOT EXISTS login_events (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip      TEXT,
    agent   TEXT,
    at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Requêtes SQL préparées : les "?" sont remplis de façon sûre,
// ce qui protège contre les injections SQL.
const sql = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT id, name, email, created_at, last_login FROM users WHERE id = ?'),
  createUser: db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)'),
  updateLastLogin: db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'),
  addEvent: db.prepare('INSERT INTO login_events (user_id, ip, agent) VALUES (?, ?, ?)'),
  lastEvents: db.prepare('SELECT ip, agent, at FROM login_events WHERE user_id = ? ORDER BY id DESC LIMIT 5'),
};

// ---------- Validation des données reçues ----------
// On ne fait jamais confiance au navigateur : on revérifie tout ici.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Renvoie un objet d'erreurs (vide si tout est correct).
// isRegister = true pour l'inscription (règles plus strictes).
function validate({ name, email, password }, isRegister) {
  const errors = {};

  if (isRegister && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60)) {
    errors.name = 'Entrez un nom de 2 à 60 caractères.';
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email) || email.length > 120) {
    errors.email = 'Entrez une adresse email valide.';
  }
  if (typeof password !== 'string' || password.length > 100) {
    errors.password = 'Mot de passe invalide.';
  } else if (isRegister && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
    errors.password = '8 caractères minimum, avec une lettre et un chiffre.';
  }
  return errors;
}

// ---------- Application Express ----------
const app = express();
app.set('trust proxy', 1); // utile derrière un hébergeur (donne la vraie IP du visiteur)

// helmet : en-têtes de sécurité. La CSP indique d'où le navigateur a le droit
// de charger scripts, styles et polices (ici : notre site + Google Fonts).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'style-src': ["'self'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'script-src': ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '10kb' })); // lit le JSON envoyé (taille limitée)
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'src'))); // sert les fichiers du dossier src/

// Anti brute-force : maximum 20 essais par IP toutes les 15 minutes.
// (Pendant les tests, on met une limite haute pour ne pas se bloquer.)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

// Crée le token de session et le place dans un cookie.
// httpOnly : le JavaScript du navigateur ne peut pas le lire (protège du vol par XSS).
// sameSite strict : le cookie n'est pas envoyé depuis un autre site (protège du CSRF).
function startSession(res, userId) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD, // en production : uniquement via HTTPS
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

// Middleware : bloque l'accès si l'utilisateur n'est pas connecté.
// À placer devant toute route privée.
function requireAuth(req, res, next) {
  try {
    const { sub } = jwt.verify(req.cookies.session || '', JWT_SECRET); // vérifie la signature
    const user = sql.findById.get(sub);
    if (!user) throw new Error('utilisateur introuvable');
    req.user = user; // les routes suivantes peuvent utiliser req.user
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
  }
}

// ---------- Routes ----------

// INSCRIPTION : POST /api/register
app.post('/api/register', authLimiter, async (req, res) => {
  const errors = validate(req.body || {}, true);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { name, email, password } = req.body;

  // L'email est-il déjà pris ?
  if (sql.findByEmail.get(email.trim())) {
    return res.status(409).json({ errors: { email: 'Un compte existe déjà avec cet email.' } });
  }

  // On stocke uniquement le hash. 12 = nombre de tours (plus c'est haut, plus c'est lent à casser).
  const hash = await bcrypt.hash(password, 12);
  const { lastInsertRowid } = sql.createUser.run(name.trim(), email.trim(), hash);

  startSession(res, lastInsertRowid); // l'utilisateur est directement connecté
  res.status(201).json({ user: sql.findById.get(lastInsertRowid), events: [] });
});

// CONNEXION : POST /api/login
app.post('/api/login', authLimiter, async (req, res) => {
  const errors = validate(req.body || {}, false);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const user = sql.findByEmail.get(req.body.email.trim());

  // On compare toujours avec bcrypt, même si l'email n'existe pas :
  // ainsi le temps de réponse ne révèle pas si le compte existe.
  const fakeHash = '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const passwordOk = await bcrypt.compare(req.body.password, user ? user.password : fakeHash);

  // Même message dans les deux cas : on ne dit pas lequel est faux.
  if (!user || !passwordOk) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const previousLogins = sql.lastEvents.all(user.id); // connexions AVANT celle-ci
  sql.updateLastLogin.run(user.id);
  sql.addEvent.run(user.id, req.ip, (req.get('user-agent') || '').slice(0, 200));

  startSession(res, user.id);
  res.json({ user: sql.findById.get(user.id), events: previousLogins });
});

// UTILISATEUR COURANT : GET /api/me (route privée)
// Sert à garder la session ouverte quand on recharge la page.
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user, events: sql.lastEvents.all(req.user.id) });
});

// DÉCONNEXION : POST /api/logout (supprime le cookie)
app.post('/api/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

// ---------- Démarrage ----------
// Si on lance "node server.js" : on écoute sur le port.
// Si un test importe ce fichier : on exporte juste "app".
if (require.main === module) {
  app.listen(PORT, () => console.log(`Serveur lancé : http://localhost:${PORT}`));
}
module.exports = app;
