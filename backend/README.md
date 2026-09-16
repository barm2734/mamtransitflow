# TransitFlow — Backend Django + API REST

API du projet TransitFlow (gestion de flotte : chauffeurs, trajets, incidents),
exposée en JSON via Django REST Framework. En développement (`DEBUG=True`),
ce même serveur sert aussi le front-end statique à la racine du dépôt
(`index.html`, `admin/`, `chauffeur/`, `assets/`) — un seul `runserver`
suffit pour tout faire tourner.

## Installation

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # sous Windows : venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # puis adapter les valeurs si besoin
python manage.py migrate
python manage.py seed_demo      # crée les comptes et données de démonstration
python manage.py runserver
```

Tout est alors sur `http://127.0.0.1:8000/` :
- Le site (front-end) : `http://127.0.0.1:8000/` (page de connexion),
  `http://127.0.0.1:8000/admin/…` et `http://127.0.0.1:8000/chauffeur/…`
  pour les espaces admin et chauffeur.
- L'API : `http://127.0.0.1:8000/api/…`.
- L'admin Django (outillage interne, différent de l'espace admin du
  front-end) : `http://127.0.0.1:8000/django-admin/` (créer un compte avec
  `python manage.py createsuperuser`).

Ce service conjoint (via `django.views.static.serve`) n'est actif que quand
`DEBUG=True` — il ne fonctionne pas et ne doit pas être utilisé en
production ; à ce moment-là, servir `index.html`/`assets/` avec un vrai
serveur web (nginx, etc.) devant l'API Django.

## Comptes de démonstration (créés par `seed_demo`)

Mot de passe pour tous : `demo`

| Courriel | Rôle |
|---|---|
| a.tremblay@transitflow.ca | Administrateur |
| a.diallo@transitflow.ca | Chauffeur (trajet en cours) |
| m.traore@transitflow.ca | Chauffeur |
| s.fortin@transitflow.ca | Chauffeur |
| m.barry@transitflow.ca | Chauffeur (hors service) |

`python manage.py seed_demo --reset` supprime les données existantes avant de
recréer le jeu de démonstration.

## Endpoints principaux

Authentification (JWT, via `djangorestframework-simplejwt`) :
- `POST /api/auth/connexion/` — `{ "courriel": "...", "password": "..." }` → `{ access, refresh, moi }`
- `POST /api/auth/rafraichir/` — `{ "refresh": "..." }` → nouveau `access`
- `GET /api/auth/moi/` — profil de l'utilisateur connecté

Toutes les routes ci-dessous nécessitent l'en-tête `Authorization: Bearer <access>`.

- `GET/POST /api/chauffeurs/` · `GET/PATCH /api/chauffeurs/{id}/` — liste et fiches
  chauffeur. Un chauffeur ne voit que sa propre fiche ; seul un admin peut en
  créer un (la création crée aussi le compte utilisateur associé).
- `GET/POST /api/vehicules/` — parc de véhicules (écriture réservée à l'admin).
- `GET/POST /api/trajets/` · `GET /api/trajets/{id}/` — liste/détail des trajets
  (filtres `?statut=`, `?chauffeur=`). Un chauffeur ne voit que ses trajets et
  ne peut en démarrer qu'un à la fois.
  - `POST /api/trajets/{id}/ajouter-arret/` — ajoute un arrêt au trajet.
  - `POST /api/trajets/{id}/terminer/` — clôture le trajet et repasse le
    chauffeur "disponible".
- `GET/POST /api/incidents/` — liste/détail des incidents (filtres `?type=`,
  `?statut=`, `?chauffeur=`).
  - `POST /api/incidents/{id}/traiter/` — marque l'incident comme traité
    (réservé à l'admin).
- `GET /api/indicateurs/` — indicateurs du tableau de bord admin (réservé à
  l'admin) : chauffeurs actifs, trajets en cours/du jour, incidents
  ouverts/du jour, permis bientôt expirés.

## Basculer vers PostgreSQL

Par défaut le backend utilise SQLite. Pour passer sur une base PostgreSQL
créée dans pgAdmin, renseigner ces variables dans `.env` (voir
`.env.example`) :

```
POSTGRES_DB=transitflow
POSTGRES_USER=postgres
POSTGRES_PASSWORD=votre-mot-de-passe
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

`config/settings.py` bascule automatiquement sur PostgreSQL dès que
`POSTGRES_DB` est défini — rien d'autre à changer. Ensuite, comme pour
SQLite :

```bash
python manage.py migrate
python manage.py seed_demo
```

## Notes de conception

- Les rôles (`admin` / `chauffeur`) sont portés par le modèle `Profil`
  (`flotte.models.Profil`), pas par `is_staff`/`is_superuser` de Django (qui
  ne servent qu'à l'admin Django). Un compte créé avec `createsuperuser`
  reçoit automatiquement un `Profil` admin (voir `flotte/signals.py`).
- Les identifiants `T-xxxx` / `I-xxxx` reprennent le format du prototype
  front-end (`assets/js/store.js`), générés dans `Trajet.save()` /
  `Incident.save()`.
- Le prototype front-end référence des données de démonstration (`TF_SEED`)
  qui n'ont jamais été committées dans le dépôt — la commande `seed_demo`
  les recrée à partir des comptes visibles dans `assets/js/auth.js`.
- Base de données : SQLite par défaut pour le développement ; bascule sur
  PostgreSQL automatiquement si `POSTGRES_DB` est défini (voir section
  "Basculer vers PostgreSQL" ci-dessus).
