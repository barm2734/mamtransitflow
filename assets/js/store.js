/* TransitFlow — connexion a l'API Django REST Framework
   Auteur : Mamadou Barry

   Remplace l'ancienne persistance locale (localStorage + TF_SEED, jamais
   commite) par des appels reseau vers le backend Django (dossier backend/).
   La cle de session et l'URL de base sont definies ici car store.js est
   toujours charge avant auth.js dans les pages HTML. */

const SESSION_KEY = 'transitflow.session';
const API_BASE = 'http://127.0.0.1:8000/api';

function tfSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
  catch (e) { return null; }
}

function tfSauvegarderSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function tfParametres(filtre) {
  if (!filtre) return '';
  const params = new URLSearchParams();
  Object.keys(filtre).forEach(function (cle) {
    const valeur = filtre[cle];
    if (valeur !== undefined && valeur !== null && valeur !== '') params.set(cle, valeur);
  });
  const chaine = params.toString();
  return chaine ? '?' + chaine : '';
}

function tfMessageErreur(donnees) {
  if (!donnees) return 'Une erreur est survenue.';
  if (typeof donnees === 'string') return donnees;
  if (donnees.detail) return donnees.detail;
  if (Array.isArray(donnees.non_field_errors) && donnees.non_field_errors.length) {
    return donnees.non_field_errors[0];
  }
  for (const cle of Object.keys(donnees)) {
    const valeur = donnees[cle];
    if (Array.isArray(valeur) && valeur.length) return valeur[0];
  }
  return 'Une erreur est survenue.';
}

async function tfRafraichirJeton() {
  const session = tfSession();
  if (!session || !session.refresh) return false;
  const reponse = await fetch(API_BASE + '/auth/rafraichir/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: session.refresh })
  });
  if (!reponse.ok) return false;
  const donnees = await reponse.json();
  session.access = donnees.access;
  tfSauvegarderSession(session);
  return true;
}

function tfRetourConnexion() {
  sessionStorage.removeItem(SESSION_KEY);
  const racine = location.pathname.indexOf('/admin/') !== -1 || location.pathname.indexOf('/chauffeur/') !== -1
    ? '../index.html' : 'index.html';
  if (location.pathname.indexOf('index.html') === -1) location.href = racine;
}

async function tfRequete(chemin, options, dejaTente) {
  const session = tfSession();
  options = options || {};
  const entetes = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (session && session.access) entetes['Authorization'] = 'Bearer ' + session.access;

  const reponse = await fetch(API_BASE + chemin, Object.assign({}, options, { headers: entetes }));

  if (reponse.status === 401 && !dejaTente && session && session.refresh) {
    const rafraichi = await tfRafraichirJeton();
    if (rafraichi) return tfRequete(chemin, options, true);
    tfRetourConnexion();
    throw new Error('Session expiree, veuillez vous reconnecter.');
  }

  if (reponse.status === 204) return null;

  let donnees = null;
  try { donnees = await reponse.json(); } catch (e) { donnees = null; }

  if (!reponse.ok) throw new Error(tfMessageErreur(donnees));
  return donnees;
}

async function tfListe(chemin) {
  const donnees = await tfRequete(chemin);
  if (donnees && Array.isArray(donnees.results)) return donnees.results;
  return donnees || [];
}

/* --- Traduction des champs (snake_case Django <-> camelCase front-end) --- */

function depuisChauffeur(c) {
  if (!c) return null;
  return {
    id: c.id,
    prenom: c.prenom,
    nom: c.nom,
    nomComplet: c.nom_complet,
    age: c.age,
    telephone: c.telephone,
    courriel: c.courriel,
    adresse: c.adresse,
    permisNumero: c.permis_numero,
    permisExpiration: c.permis_expiration,
    statut: c.statut,
    plaqueHabituelle: c.plaque_habituelle,
    creeLe: c.cree_le,
    trajetsCount: c.trajets_count,
    incidentsCount: c.incidents_count,
    motDePasseInitial: c.mot_de_passe_initial || null
  };
}

const TF_CHAMPS_CHAUFFEUR = {
  prenom: 'prenom', nom: 'nom', age: 'age', telephone: 'telephone', courriel: 'courriel',
  adresse: 'adresse', permisNumero: 'permis_numero', permisExpiration: 'permis_expiration',
  statut: 'statut', plaqueHabituelle: 'plaque_habituelle', plaque: 'plaque_habituelle'
};

function versChampsChauffeur(champs) {
  const sortie = {};
  Object.keys(champs || {}).forEach(function (cle) {
    const cleDjango = TF_CHAMPS_CHAUFFEUR[cle] || cle;
    sortie[cleDjango] = champs[cle];
  });
  return sortie;
}

function depuisArret(a) {
  if (!a) return null;
  return { lieu: a.lieu, heure: a.heure, note: a.note };
}

function depuisTrajet(t) {
  if (!t) return null;
  return {
    id: t.code,
    chauffeurId: t.chauffeur,
    chauffeurNom: t.chauffeur_nom,
    plaque: t.plaque,
    depart: t.depart,
    departAdresse: t.depart_adresse,
    arrivee: t.arrivee,
    debut: t.debut,
    finPrevue: t.fin_prevue,
    fin: t.fin,
    statut: t.statut,
    arrets: Array.isArray(t.arrets) ? t.arrets.map(depuisArret) : [],
    incidentsCount: t.incidents_count,
    progression: t.progression
  };
}

function depuisIncident(i) {
  if (!i) return null;
  return {
    id: i.code,
    trajetId: i.trajet,
    chauffeurId: i.chauffeur,
    chauffeurNom: i.chauffeur_nom,
    type: i.type,
    titre: i.titre,
    description: i.description,
    lieu: i.lieu,
    date: i.date,
    heure: i.heure,
    statut: i.statut
  };
}

function depuisVehicule(v) {
  if (!v) return null;
  return { id: v.id, plaque: v.plaque, modele: v.modele };
}

function depuisIndicateurs(k) {
  if (!k) return null;
  return {
    chauffeursActifs: k.chauffeurs_actifs,
    trajetsEnCours: k.trajets_en_cours,
    trajetsDuJour: k.trajets_du_jour,
    incidentsOuverts: k.incidents_ouverts,
    incidentsDuJour: k.incidents_du_jour,
    permisAExpirer: k.permis_a_expirer
  };
}

/* --- Store --- */

const Store = {
  /* Chauffeurs */
  async chauffeurs(filtre) {
    const liste = await tfListe('/chauffeurs/' + tfParametres(filtre));
    return liste.map(depuisChauffeur);
  },

  async chauffeur(id) {
    const donnees = await tfRequete('/chauffeurs/' + id + '/');
    return depuisChauffeur(donnees);
  },

  async ajouterChauffeur(chauffeur) {
    const donnees = await tfRequete('/chauffeurs/', {
      method: 'POST', body: JSON.stringify(versChampsChauffeur(chauffeur))
    });
    return depuisChauffeur(donnees);
  },

  async majChauffeur(id, champs) {
    const donnees = await tfRequete('/chauffeurs/' + id + '/', {
      method: 'PATCH', body: JSON.stringify(versChampsChauffeur(champs))
    });
    return depuisChauffeur(donnees);
  },

  /* Trajets */
  async trajets(filtre) {
    const parametres = Object.assign({}, filtre);
    if (parametres.chauffeurId) { parametres.chauffeur = parametres.chauffeurId; delete parametres.chauffeurId; }
    const liste = await tfListe('/trajets/' + tfParametres(parametres));
    return liste.map(depuisTrajet);
  },

  async trajet(id) {
    const donnees = await tfRequete('/trajets/' + id + '/');
    return depuisTrajet(donnees);
  },

  async trajetEnCours(chauffeurId) {
    const liste = await tfListe('/trajets/en-cours/' + tfParametres({ chauffeur: chauffeurId }));
    const trouve = liste.find(function (t) { return t.statut === 'en-cours'; });
    return trouve ? depuisTrajet(trouve) : null;
  },

  async ajouterTrajet(trajet) {
    const donnees = await tfRequete('/trajets/', {
      method: 'POST',
      body: JSON.stringify({
        plaque: trajet.plaque,
        vehicule: trajet.vehiculeId,
        depart: trajet.depart,
        depart_adresse: trajet.departAdresse,
        arrivee: trajet.arrivee,
        debut: trajet.debut,
        fin_prevue: trajet.finPrevue
      })
    });
    return depuisTrajet(donnees);
  },

  async ajouterArret(trajetId, arret) {
    const donnees = await tfRequete('/trajets/' + trajetId + '/ajouter-arret/', {
      method: 'POST', body: JSON.stringify({ lieu: arret.lieu, heure: arret.heure, note: arret.note })
    });
    return depuisTrajet(donnees);
  },

  async terminerTrajet(trajetId) {
    const donnees = await tfRequete('/trajets/' + trajetId + '/terminer/', { method: 'POST' });
    return depuisTrajet(donnees);
  },

  /* Incidents */
  async incidents(filtre) {
    const parametres = Object.assign({}, filtre);
    if (parametres.chauffeurId) { parametres.chauffeur = parametres.chauffeurId; delete parametres.chauffeurId; }
    const liste = await tfListe('/incidents/' + tfParametres(parametres));
    return liste.map(depuisIncident);
  },

  async incident(id) {
    const donnees = await tfRequete('/incidents/' + id + '/');
    return depuisIncident(donnees);
  },

  async ajouterIncident(incident) {
    const donnees = await tfRequete('/incidents/', {
      method: 'POST',
      body: JSON.stringify({
        trajet: incident.trajetId || null,
        type: incident.type,
        titre: incident.titre,
        description: incident.description,
        lieu: incident.lieu,
        date: incident.date,
        heure: incident.heure
      })
    });
    return depuisIncident(donnees);
  },

  async traiterIncident(id) {
    const donnees = await tfRequete('/incidents/' + id + '/traiter/', { method: 'POST' });
    return depuisIncident(donnees);
  },

  async vehicules() {
    const liste = await tfListe('/vehicules/');
    return liste.map(depuisVehicule);
  },

  /* Indicateurs du tableau de bord */
  async indicateurs() {
    const donnees = await tfRequete('/indicateurs/');
    return depuisIndicateurs(donnees);
  }
};
