/* TransitFlow — session et garde de page
   Auteur : Mamadou Barry

   SESSION_KEY et API_BASE sont definis dans store.js (charge avant ce
   fichier dans toutes les pages) : pas de redeclaration ici. */

const Auth = {
  session() {
    return tfSession();
  },

  async connecter(courriel, motDePasse, role) {
    let donnees;
    try {
      const reponse = await fetch(API_BASE + '/auth/connexion/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courriel: courriel, password: motDePasse })
      });
      donnees = await reponse.json().catch(function () { return null; });
      if (!reponse.ok) {
        return { ok: false, message: tfMessageErreur(donnees) };
      }
    } catch (e) {
      return { ok: false, message: 'Impossible de joindre le serveur. Reessayez plus tard.' };
    }

    const moi = donnees.moi || {};

    /* Le formulaire de connexion propose un role (admin / chauffeur) ; le
       backend Django ne le valide pas lui-meme (contrairement au prototype
       d'origine), donc la verification se fait ici, cote client. */
    if (role && moi.role !== role) {
      return { ok: false, message: 'Ce compte n est pas un compte ' + role + '.' };
    }

    const session = {
      access: donnees.access,
      refresh: donnees.refresh,
      courriel: moi.courriel,
      role: moi.role,
      nom: moi.nom,
      initiales: moi.initiales,
      chauffeurId: moi.chauffeur_id
    };
    tfSauvegarderSession(session);
    return { ok: true, session: session };
  },

  /* Pas d'appel serveur : les jetons JWT sont sans etat (aucune app de
     liste noire installee), la deconnexion se fait donc uniquement cote
     client. */
  deconnecter(racine) {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = (racine || '../') + 'index.html';
  },

  /* Redirige vers la connexion si le role attendu n est pas celui de la session. */
  exiger(role, racine) {
    const s = this.session();
    if (!s || s.role !== role) {
      window.location.href = (racine || '../') + 'index.html';
      return null;
    }
    return s;
  },

  accueil(session) {
    return session.role === 'admin'
      ? 'admin/tableau-de-bord.html'
      : 'chauffeur/mes-trajets.html';
  }
};

/* Remplit la zone utilisateur de la barre de navigation et branche la deconnexion. */
function monterBarreUtilisateur(session, racine) {
  const zone = document.querySelector('[data-navbar-user]');
  if (!zone || !session) return;
  zone.innerHTML =
    '<span class="tf-avatar sm ' + (session.role === 'admin' ? 'on-dark' : '') + '">' +
      Format.echapper(session.initiales) + '</span>' +
    '<span>' + Format.echapper(session.nom) + '</span>' +
    '<button type="button" class="tf-btn tf-btn-outline-dark" ' +
      'style="height:34px;padding:0 14px;font-size:13px" data-deconnexion>Quitter</button>';
  zone.querySelector('[data-deconnexion]').addEventListener('click', function () {
    Auth.deconnecter(racine);
  });
}
