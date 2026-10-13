// ============================================================
// app.js : le code qui tourne dans le navigateur (le "front-end")
// Il gère les onglets, la validation, les appels au serveur
// et l'affichage de l'espace connecté.
// ============================================================

// Pause asynchrone (en millisecondes), utilisée par les animations
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Raccourcis pour sélectionner des éléments HTML
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const loginForm = $('#loginForm');
const registerForm = $('#registerForm');
const forms = { login: loginForm, register: registerForm };
const tabs = $$('.tabs button');

// ---------- Appel au serveur ----------
// Envoie une requête à l'API et renvoie la réponse en objet JavaScript.
// Si le serveur répond avec une erreur (400, 401...), on "lance" l'erreur
// pour la traiter dans le catch de l'appelant.
async function api(path, body) {
  const isPost = Boolean(body) || path === '/api/logout';
  const response = await fetch(path, {
    method: isPost ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw data;
  return data;
}

// ---------- Notification (petit message en bas de l'écran) ----------
let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---------- Onglets Connexion / Inscription ----------
function switchTab(mode) {
  tabs.forEach(tab => tab.setAttribute('aria-selected', tab.dataset.mode === mode));
  loginForm.hidden = mode !== 'login';
  registerForm.hidden = mode !== 'register';
  $('.tabs').dataset.mode = mode; // le CSS fait glisser la pastille
  $('input', forms[mode]).focus(); // place le curseur dans le premier champ
}
tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.mode)));

// ---------- Bouton Afficher / Masquer le mot de passe ----------
$$('.toggle').forEach(button => {
  button.addEventListener('click', () => {
    const input = $('input', button.parentElement);
    const willShow = input.type === 'password';
    input.type = willShow ? 'text' : 'password';
    button.textContent = willShow ? 'Masquer' : 'Afficher';
    button.setAttribute('aria-pressed', willShow);
    button.setAttribute('aria-label', willShow ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });
});

// ---------- Jauge de robustesse du mot de passe ----------
const strengthLabels = ['', 'Trop faible', 'Moyen', 'Bon', 'Excellent'];
const defaultHint = '8 caractères minimum, avec une lettre et un chiffre.';

// 1 point par critère rempli (maximum 4)
function passwordScore(password) {
  let score = 0;
  if (password.length >= 8) score++;                                  // assez long
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score++;      // lettres + chiffres
  if (password.length >= 12) score++;                                 // très long
  if (/[^A-Za-z0-9]/.test(password) && /[A-Z]/.test(password)) score++; // symbole + majuscule
  return score;
}

$('#regPassword').addEventListener('input', event => {
  const password = event.target.value;
  const score = passwordScore(password) || 1; // au minimum 1 si le champ n'est pas vide
  $('.meter', registerForm).dataset.level = password ? score : 0; // le CSS colore les barres
  $('#strengthText').textContent = password ? `Robustesse : ${strengthLabels[score]}` : defaultHint;
});

// ---------- Validation et affichage des erreurs ----------
// Affiche les erreurs sous chaque champ (errors = { email: '...', password: '...' }).
function showErrors(form, errors = {}) {
  $$('[data-error]', form).forEach(p => { p.textContent = errors[p.dataset.error] || ''; });
  $$('input', form).forEach(input => input.setAttribute('aria-invalid', Boolean(errors[input.name])));
  const firstInvalid = $$('input', form).find(input => errors[input.name]);
  if (firstInvalid) firstInvalid.focus();

  // Secousse du formulaire s'il y a au moins une erreur
  if (Object.keys(errors).length) {
    form.classList.remove('shake');
    void form.offsetWidth; // force le navigateur à relancer l'animation
    form.classList.add('shake');
    form.addEventListener('animationend', () => form.classList.remove('shake'), { once: true });
  }
}

// Vérification rapide côté navigateur (le serveur revérifie de toute façon).
function checkForm(form, mode) {
  const data = Object.fromEntries(new FormData(form)); // { name, email, password }
  const errors = {};

  if (mode === 'register' && data.name.trim().length < 2) {
    errors.name = 'Entrez votre nom (2 caractères minimum).';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
    errors.email = 'Entrez une adresse email valide.';
  }
  if (!data.password) {
    errors.password = 'Entrez votre mot de passe.';
  } else if (mode === 'register' && passwordScore(data.password) < 2) {
    errors.password = '8 caractères minimum, avec une lettre et un chiffre.';
  }
  return { data, errors };
}

// ---------- Envoi des formulaires ----------
// Même logique pour la connexion et l'inscription : seule l'URL change.
['login', 'register'].forEach(mode => {
  const form = forms[mode];

  form.addEventListener('submit', async event => {
    event.preventDefault(); // empêche le rechargement de la page

    const { data, errors } = checkForm(form, mode);
    showErrors(form, errors);
    if (Object.keys(errors).length) return; // on s'arrête s'il y a des erreurs

    const button = $('.btn', form);
    button.disabled = true; // évite le double clic + affiche le spinner

    try {
      const result = await api(`/api/${mode}`, data);
      // Le bouton devient une coche verte avant d'afficher l'espace connecté
      button.disabled = false;
      button.classList.add('success');
      await sleep(750);
      button.classList.remove('success');
      showToast(mode === 'login' ? 'Connecté' : 'Compte créé');
      form.reset();
      $('.meter', registerForm).dataset.level = 0; // remet la jauge à zéro
      showDashboard(result.user, result.events);
    } catch (error) {
      // Erreur champ par champ, sinon message général
      showErrors(form, error.errors || { form: error.error || 'Serveur injoignable. Réessayez.' });
    } finally {
      button.disabled = false;
    }
  });
});

// ---------- Espace connecté ----------
// La base stocke l'heure en UTC ; on la convertit en heure locale lisible.
function formatDate(sqlDate) {
  return new Date(sqlDate.replace(' ', 'T') + 'Z')
    .toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function showDashboard(user, events) {
  $('#authView').hidden = true;
  $('#dashView').hidden = false;

  $('#avatar').textContent = user.name.trim()[0].toUpperCase(); // initiale du nom
  $('#welcome').textContent = `Bonjour ${user.name.split(' ')[0]}`;
  $('#since').textContent = `Membre depuis le ${formatDate(user.created_at)}`;

  // Liste des connexions récentes. On utilise textContent (pas innerHTML)
  // pour qu'aucun code malveillant ne puisse s'injecter dans la page.
  const list = $('#events');
  list.replaceChildren();
  if (events.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Aucune connexion précédente.';
    list.append(item);
  }
  events.forEach(event => {
    const item = document.createElement('li');
    const ip = document.createElement('span');
    const date = document.createElement('small');
    ip.textContent = event.ip || 'IP inconnue';
    date.textContent = formatDate(event.at);
    item.append(ip, date);
    list.append(item);
  });
}

$('#logout').addEventListener('click', async () => {
  await api('/api/logout').catch(() => {});
  $('#dashView').hidden = true;
  $('#authView').hidden = false;
  switchTab('login');
  showToast('Déconnecté');
});

// ---------- Au chargement de la page ----------
// Si le cookie de session est encore valide, on affiche directement l'espace connecté.
api('/api/me')
  .then(result => showDashboard(result.user, result.events))
  .catch(() => {}); // pas connecté : on reste sur le formulaire

// ============================================================
// Thème clair / sombre
// Le choix est mémorisé dans le navigateur (localStorage).
// ============================================================
const themeButton = $('#themeToggle');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme; // le CSS change toutes les couleurs
  themeButton.textContent = theme === 'dark' ? 'Mode clair' : 'Mode sombre';
  themeButton.setAttribute('aria-pressed', theme === 'dark');
  try { localStorage.setItem('theme', theme); } catch {} // ignoré si le stockage est bloqué
}

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch {}
// Sans choix mémorisé, on suit le réglage du système
applyTheme(savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

themeButton.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// ============================================================
// Démo du hachage (panneau de gauche)
// Un mot de passe est tapé lettre par lettre, puis se transforme
// en hash. Les hash affichés sont des EXEMPLES aléatoires : ils
// illustrent le principe, ce ne sont pas de vrais calculs bcrypt.
// ============================================================
const demoPlain = $('#demoPlain');
const demoHash = $('#demoHash');
const samplePasswords = ['motdepasse1', 'Soleil2026!', 'azerty123'];
const hashChars = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// Texte aléatoire de n caractères
const randomText = n => Array.from({ length: n }, () => hashChars[Math.floor(Math.random() * hashChars.length)]).join('');
// Faux hash au format bcrypt : $2a$12$ + 53 caractères
const fakeHash = () => '$2a$12$' + randomText(53);

async function runHashDemo() {
  // Si l'utilisateur préfère moins d'animations : affichage fixe, sans boucle
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    demoPlain.textContent = samplePasswords[0];
    demoHash.textContent = fakeHash();
    return;
  }
  let i = 0;
  while (true) {
    const password = samplePasswords[i++ % samplePasswords.length];
    const hash = fakeHash();
    demoPlain.textContent = '';
    demoHash.textContent = '';

    for (const letter of password) {      // 1. on "tape" le mot de passe
      demoPlain.textContent += letter;
      await sleep(90);
    }
    await sleep(500);

    for (let n = 0; n <= hash.length; n += 3) { // 2. le hash se "fixe" de gauche à droite
      demoHash.textContent = hash.slice(0, n) + randomText(hash.length - n);
      await sleep(35);
    }
    demoHash.textContent = hash;
    await sleep(3000);                    // 3. pause avant l'exemple suivant
  }
}
runHashDemo();
