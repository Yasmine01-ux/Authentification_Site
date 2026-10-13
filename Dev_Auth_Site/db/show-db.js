// ============================================================
// db/show-db.js : affiche le contenu de la base dans le terminal
// Lancer avec : npm run db
// (les mots de passe apparaissent HACHÉS : c'est normal et voulu)
// ============================================================
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'app.db'); // la base est dans le même dossier que ce script

// La base est créée au premier "npm start" : si elle n'existe pas, on l'explique.
if (!fs.existsSync(dbPath)) {
  console.log('Base introuvable. Lancez d\'abord "npm start" pour la créer.');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true }); // lecture seule : on ne modifie rien

console.log('\n=== Table users ===');
// On n'affiche que le début du hash (les textes SQL s'écrivent avec des apostrophes)
console.table(db.prepare(`
  SELECT id, name, email, substr(password, 1, 20) || '...' AS password_hash, created_at, last_login
  FROM users
`).all());

console.log('=== Table login_events (20 dernières connexions) ===');
console.table(db.prepare('SELECT * FROM login_events ORDER BY id DESC LIMIT 20').all());
