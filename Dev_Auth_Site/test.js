// ============================================================
// test.js : tests automatiques
// Lancer avec : npm test
// Chaque test simule un navigateur qui appelle l'API.
// ============================================================

// On utilise une base temporaire pour ne pas toucher à vos vrais comptes.
process.env.NODE_ENV = 'test';
process.env.DB_PATH = require('path').join(require('os').tmpdir(), `test-${Date.now()}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./server');

let server, base, cookie;

// Avant les tests : démarre le serveur sur un port libre.
test.before(() => new Promise(resolve => {
  server = app.listen(0, () => { base = `http://localhost:${server.address().port}`; resolve(); });
}));
test.after(() => server.close());

// Petite aide pour appeler l'API (et garder le cookie de session).
async function call(path, body) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }) },
    body: body && JSON.stringify(body),
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { status: res.status, data: await res.json() };
}

const user = { name: 'Alice Martin', email: 'alice@test.fr', password: 'motdepasse1' };

test('inscription : crée le compte', async () => {
  const { status, data } = await call('/api/register', user);
  assert.equal(status, 201);
  assert.equal(data.user.email, user.email);
  assert.equal(data.user.password, undefined); // le hash n'est jamais renvoyé
});

test('inscription : refuse un email déjà utilisé', async () => {
  const { status } = await call('/api/register', user);
  assert.equal(status, 409);
});

test('inscription : refuse un mot de passe trop faible', async () => {
  const { status, data } = await call('/api/register', { ...user, email: 'b@test.fr', password: 'abc' });
  assert.equal(status, 400);
  assert.ok(data.errors.password);
});

test('connexion : refuse un mauvais mot de passe', async () => {
  const { status } = await call('/api/login', { email: user.email, password: 'mauvais123' });
  assert.equal(status, 401);
});

test('connexion : refuse un email inconnu (même message)', async () => {
  const { status, data } = await call('/api/login', { email: 'inconnu@test.fr', password: 'motdepasse1' });
  assert.equal(status, 401);
  assert.equal(data.error, 'Email ou mot de passe incorrect.');
});

test('connexion : accepte les bons identifiants', async () => {
  const { status, data } = await call('/api/login', { email: user.email, password: user.password });
  assert.equal(status, 200);
  assert.equal(data.user.name, user.name);
});

test('session : /api/me fonctionne avec le cookie et garde l\'historique', async () => {
  const { status, data } = await call('/api/me');
  assert.equal(status, 200);
  assert.equal(data.events.length, 1); // une connexion enregistrée en base
});

test('session : /api/me est refusé après déconnexion', async () => {
  await call('/api/logout', {});
  cookie = null; // le navigateur a supprimé le cookie
  const { status } = await call('/api/me');
  assert.equal(status, 401);
});
