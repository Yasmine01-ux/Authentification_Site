# Dev Auth — Application web d’authentification

Application web d’authentification développée avec **HTML, CSS, JavaScript, Node.js, Express et SQLite**. Le projet met en pratique la création de comptes, la connexion, la persistance de session et le suivi des connexions, avec une attention particulière portée à la validation des données, au stockage des mots de passe et à la simplicité de l’expérience utilisateur.

> **Projet personnel d’apprentissage et de démonstration.** Il permet d’explorer le fonctionnement d’un système d’authentification de bout en bout, de l’interface utilisateur jusqu’à la base de données.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Aperçu technique](#aperçu-technique)
- [Architecture du projet](#architecture-du-projet)
- [Prérequis](#prérequis)
- [Installation et lancement](#installation-et-lancement)
- [Commandes disponibles](#commandes-disponibles)
- [Parcours de test](#parcours-de-test)
- [API](#api)
- [Modèle de données](#modèle-de-données)
- [Mesures de sécurité](#mesures-de-sécurité)
- [Interface et expérience utilisateur](#interface-et-expérience-utilisateur)
- [Limites connues et améliorations envisagées](#limites-connues-et-améliorations-envisagées)

## Fonctionnalités

### Comptes et authentification
- Création de compte avec nom, adresse e-mail et mot de passe.
- Vérification des données côté navigateur et côté serveur.
- Refus des adresses e-mail déjà utilisées.
- Vérification du mot de passe à partir de son hash enregistré.
- Messages d’erreur qui ne distinguent pas une adresse inconnue d’un mot de passe incorrect.

### Sessions et historique
- Ouverture automatique d’une session après l’inscription ou une connexion réussie.
- Cookie de session contenant un jeton JWT, configuré avec `httpOnly` et `SameSite=Strict`.
- Conservation de la session lors d’un rechargement de page, tant que le cookie reste valide.
- Durée de validité du jeton : **7 jours**.
- Enregistrement des connexions réussies et affichage des cinq événements les plus récents.
- Déconnexion par suppression du cookie de session.

### Interface utilisateur
- Onglets Connexion et Inscription.
- Affichage ou masquage du mot de passe.
- Indicateur visuel de robustesse du mot de passe à l’inscription.
- Messages d’erreur et de confirmation.
- Thème clair/sombre, avec préférence conservée dans le navigateur.
- Prise en compte de la préférence système pour la réduction des animations.

## Aperçu technique

| Couche | Technologies | Responsabilité |
|---|---|---|
| Interface | HTML, CSS, JavaScript natif | Formulaires, interactions et affichage de l’espace connecté |
| Serveur | Node.js, Express | API, validation, authentification et gestion des cookies |
| Stockage | SQLite, `better-sqlite3` | Comptes utilisateurs et événements de connexion |
| Mots de passe | `bcryptjs` | Hachage et vérification des mots de passe |
| Jetons | `jsonwebtoken` | Création et vérification des jetons JWT |
| Protection HTTP | `helmet` | En-têtes de sécurité et politique de sécurité du contenu |
| Limitation des requêtes | `express-rate-limit` | Limitation des tentatives sur les routes d’authentification |
| Tests | `node:test` | Tests automatisés des principaux parcours de l’API |

Le projet utilise du JavaScript natif côté navigateur, sans framework front-end.

## Architecture du projet

```text
Dev_Auth_Site/
├── db/
│   └── show-db.js       # Affiche un aperçu des données SQLite
├── src/
│   ├── index.html       # Structure de l’interface
│   ├── styles.css       # Mise en page, thèmes et animations
│   ├── app.js           # Interactions et appels à l’API
│   └── favicon.svg      # Icône du site
├── .env.example         # Exemple de configuration
├── .gitignore           # Fichiers à exclure du contrôle de version
├── package.json         # Dépendances, scripts et version de Node.js
├── README.md            # Documentation du projet
├── server.js            # Serveur Express, routes API et accès à SQLite
└── test.js              # Tests automatisés
```

La base `db/app.db` est créée automatiquement au premier lancement. Elle est générée localement et n’est pas incluse dans le dépôt.

## Prérequis

- [Node.js](https://nodejs.org/) **20.18 ou une version ultérieure**
- npm, fourni avec Node.js
- Un navigateur web récent
- Un terminal et, facultativement, [Visual Studio Code](https://code.visualstudio.com/)

Vérifier les versions installées :

```bash
node -v
npm -v
```

## Installation et lancement

### 1. Récupérer le projet

Ouvrir le dossier `Dev_Auth_Site` dans un terminal. Vérifier qu’il contient `package.json` et `server.js`.

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l’environnement

Créer un fichier `.env` à partir du modèle fourni.

**Windows PowerShell :**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux :**
```bash
cp .env.example .env
```

Ouvrir ensuite `.env` et remplacer `JWT_SECRET` par une longue valeur aléatoire privée. Ne jamais publier cette clé ni la version réelle du fichier `.env`.

Exemple de structure :

```dotenv
PORT=3000
JWT_SECRET=remplacer_par_une_valeur_longue_et_aleatoire
```

Le serveur possède une clé de secours pour le développement local. **Pour un déploiement, définissez impérativement `NODE_ENV=production` et fournissez un `JWT_SECRET` robuste.** En production, le cookie est configuré pour être transmis uniquement en HTTPS.

### 4. Démarrer l’application

```bash
npm start
```

Ouvrir ensuite [http://localhost:3000](http://localhost:3000).

Pour arrêter le serveur, utiliser `Ctrl + C` dans le terminal.

## Commandes disponibles

| Commande | Description |
|---|---|
| `npm install` | Installe les dépendances du projet |
| `npm start` | Démarre le serveur |
| `npm run dev` | Redémarre automatiquement le serveur lors des modifications |
| `npm test` | Exécute les tests automatisés |
| `npm run db` | Affiche les comptes et les connexions enregistrés dans la base locale |

La commande `npm run db` est un outil de diagnostic local : elle affiche des données personnelles de test et un aperçu des hashes. Ne partagez pas sa sortie si elle contient des données réelles.

## Parcours de test

### Vérification manuelle

1. Lancer l’application et ouvrir la page dans le navigateur.
2. Créer un compte avec un nom, une adresse e-mail valide et un mot de passe conforme aux règles affichées.
3. Vérifier l’accès à l’espace connecté.
4. Actualiser la page : la session doit être restaurée si le cookie est toujours valide.
5. Se déconnecter, puis essayer de se connecter avec les bons identifiants.
6. Effectuer un essai avec un mauvais mot de passe et vérifier le message d’erreur.
7. Vérifier l’affichage des connexions récentes dans l’espace utilisateur.

### Tests automatisés

```bash
npm test
```

Le fichier `test.js` couvre huit scénarios : inscription, e-mail déjà utilisé, mot de passe insuffisant, refus d’identifiants incorrects, message d’erreur uniforme, connexion réussie, consultation de la session et accès refusé après déconnexion.

Les tests utilisent une base SQLite temporaire afin de ne pas modifier la base de données locale habituelle.

## API

Toutes les routes renvoient des réponses JSON.

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| `POST` | `/api/register` | Public, limité en fréquence | Valide les données, crée le compte et ouvre une session |
| `POST` | `/api/login` | Public, limité en fréquence | Vérifie les identifiants, enregistre l’événement de connexion et ouvre une session |
| `GET` | `/api/me` | Session requise | Renvoie l’utilisateur courant et ses cinq dernières connexions |
| `POST` | `/api/logout` | Public | Supprime le cookie de session côté navigateur |

### Exemple de requête d’inscription

```http
POST /api/register
Content-Type: application/json
```

```json
{
  "name": "Alice Martin",
  "email": "alice@example.com",
  "password": "Exemple123"
}
```

En cas de succès, le serveur renvoie les informations publiques de l’utilisateur et définit le cookie de session. Le mot de passe et son hash ne sont pas renvoyés dans la réponse.

## Modèle de données

La base SQLite utilise deux tables principales.

### `users`

| Champ | Rôle |
|---|---|
| `id` | Identifiant unique |
| `name` | Nom de l’utilisateur |
| `email` | Adresse e-mail unique |
| `password` | Hash du mot de passe, jamais le mot de passe en clair |
| `created_at` | Date de création du compte |
| `last_login` | Date de la dernière connexion réussie |

### `login_events`

| Champ | Rôle |
|---|---|
| `id` | Identifiant de l’événement |
| `user_id` | Référence vers le compte concerné |
| `ip` | Adresse IP observée par le serveur |
| `agent` | User-Agent du navigateur |
| `at` | Date de l’événement |

La relation entre `login_events.user_id` et `users.id` permet d’associer chaque événement à son compte. Les clés étrangères SQLite sont activées.

## Mesures de sécurité

Le projet met en œuvre plusieurs protections adaptées à une application de démonstration :

- **Hachage des mots de passe :** `bcryptjs` avec un coût de 12.
- **Requêtes SQL préparées :** utilisation de paramètres pour limiter le risque d’injection SQL.
- **Validation serveur :** les données sont vérifiées côté serveur, même si le navigateur réalise aussi des contrôles.
- **Cookie de session :** `httpOnly`, `SameSite=Strict` et durée de validité limitée à sept jours.
- **HTTPS en production :** le cookie est configuré avec `Secure` lorsque `NODE_ENV=production`.
- **En-têtes HTTP :** `helmet` et une politique de sécurité du contenu (CSP).
- **Limitation des tentatives :** jusqu’à 20 requêtes sur les routes d’authentification par IP sur une fenêtre de 15 minutes, hors configuration de test.
- **Réduction de l’énumération de comptes :** même message d’erreur lorsque l’e-mail n’existe pas ou que le mot de passe est incorrect.
- **Configuration séparée :** `.env` et fichiers de base de données exclus du contrôle de version selon `.gitignore`.

> **Périmètre :** ce projet est une base fonctionnelle d’apprentissage, pas un audit de sécurité ni une solution prête à être déployée sans vérifications supplémentaires. Avant une mise en production, il convient notamment de revoir la gestion des secrets, la configuration du proxy, la stratégie de journalisation, la protection CSRF selon le contexte de déploiement, les sauvegardes et la politique de confidentialité des données enregistrées.

## Interface et expérience utilisateur

L’interface a été conçue pour rester claire et réactive sans dépendre d’un framework front-end. Elle comprend des transitions entre les formulaires, des retours visuels en cas de succès ou d’erreur, une bascule de thème et un espace utilisateur présentant les connexions récentes.

Le panneau pédagogique consacré au hachage affiche **des exemples générés aléatoirement** pour illustrer la forme d’un hash. Il ne calcule pas un véritable hash bcrypt dans le navigateur et n’utilise pas le mot de passe saisi pour produire cet exemple.

## Limites connues et améliorations envisagées

Pistes d’évolution possibles :

- Réinitialisation du mot de passe et vérification de l’adresse e-mail.
- Gestion des sessions actives et révocation des jetons.
- Renforcement des contrôles de sécurité avant un déploiement public.
- Tests supplémentaires des erreurs serveur, des limites de requêtes et des cas limites.
- Migration vers PostgreSQL si le besoin de déploiement ou de montée en charge le justifie.
- Conteneurisation avec Docker et ajout d’une procédure de déploiement.
- Amélioration de l’accessibilité et ajout de tests d’interface.

---

**Technologies principales :** HTML · CSS · JavaScript · Node.js · Express · SQLite · bcryptjs · JWT · Helmet · Node.js Test Runner
