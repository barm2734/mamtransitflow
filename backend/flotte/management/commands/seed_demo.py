"""
Recrée des données de démonstration équivalentes au TF_SEED manquant du
prototype front-end (assets/js/store.js le référence mais il n'a jamais été
commité dans le dépôt). Les comptes reprennent ceux de assets/js/auth.js.

Usage : python manage.py seed_demo [--reset]
"""
from datetime import date, datetime, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from flotte.models import Arret, Chauffeur, Incident, Profil, Trajet, Vehicule

User = get_user_model()
MOT_DE_PASSE_DEMO = "demo"

COMPTES_CHAUFFEURS = [
    dict(courriel="a.diallo@transitflow.ca", prenom="Aissatou", nom="Diallo", age=34,
         telephone="514-555-0101", adresse="120 rue Sherbrooke, Montréal",
         permis_numero="D1234-560101-02", permis_expiration=date(2026, 10, 15),
         statut=Chauffeur.Statut.EN_TRAJET, plaque="FLT-101"),
    dict(courriel="m.traore@transitflow.ca", prenom="Moussa", nom="Traoré", age=41,
         telephone="514-555-0102", adresse="45 avenue du Parc, Montréal",
         permis_numero="T5678-410602-14", permis_expiration=date(2027, 3, 1),
         statut=Chauffeur.Statut.DISPONIBLE, plaque="FLT-102"),
    dict(courriel="s.fortin@transitflow.ca", prenom="Sophie", nom="Fortin", age=29,
         telephone="418-555-0103", adresse="8 rue Saint-Jean, Québec",
         permis_numero="F9012-290815-09", permis_expiration=date(2026, 11, 30),
         statut=Chauffeur.Statut.DISPONIBLE, plaque="FLT-103"),
    dict(courriel="m.barry@transitflow.ca", prenom="Mamadou", nom="Barry", age=27,
         telephone="819-555-0104", adresse="2500 boul. de l'Université, Sherbrooke",
         permis_numero="B3456-270210-21", permis_expiration=date(2026, 9, 20),
         statut=Chauffeur.Statut.HORS_SERVICE, plaque="FLT-104"),
]

VEHICULES = [
    ("FLT-101", "Ford Transit 2023"),
    ("FLT-102", "Mercedes Sprinter 2022"),
    ("FLT-103", "Ford Transit 2024"),
    ("FLT-104", "Nissan NV200 2021"),
]


class Command(BaseCommand):
    help = "Crée les comptes et données de démonstration TransitFlow."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Supprime les données existantes de l'app avant de reseeder.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            self.stdout.write("Suppression des données existantes…")
            Incident.objects.all().delete()
            Arret.objects.all().delete()
            Trajet.objects.all().delete()
            Chauffeur.objects.all().delete()
            Vehicule.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        vehicules = {}
        for plaque, modele in VEHICULES:
            v, _ = Vehicule.objects.get_or_create(plaque=plaque, defaults={"modele": modele})
            vehicules[plaque] = v

        admin_user, cree = User.objects.get_or_create(
            username="a.tremblay@transitflow.ca",
            defaults=dict(email="a.tremblay@transitflow.ca", first_name="Alex", last_name="Tremblay",
                          is_staff=True),
        )
        if cree:
            admin_user.set_password(MOT_DE_PASSE_DEMO)
            admin_user.save()
        Profil.objects.get_or_create(user=admin_user, defaults={"role": Profil.Role.ADMIN})

        chauffeurs = {}
        for donnees in COMPTES_CHAUFFEURS:
            courriel = donnees["courriel"]
            user, cree = User.objects.get_or_create(
                username=courriel,
                defaults=dict(email=courriel, first_name=donnees["prenom"], last_name=donnees["nom"]),
            )
            if cree:
                user.set_password(MOT_DE_PASSE_DEMO)
                user.save()
            Profil.objects.get_or_create(user=user, defaults={"role": Profil.Role.CHAUFFEUR})

            chauffeur, _ = Chauffeur.objects.get_or_create(
                user=user,
                defaults=dict(
                    prenom=donnees["prenom"], nom=donnees["nom"], age=donnees["age"],
                    telephone=donnees["telephone"], courriel=courriel, adresse=donnees["adresse"],
                    permis_numero=donnees["permis_numero"], permis_expiration=donnees["permis_expiration"],
                    statut=donnees["statut"], plaque_habituelle=vehicules[donnees["plaque"]],
                ),
            )
            chauffeurs[courriel] = chauffeur

        aujourdhui = timezone.localdate()

        def dt(jours_decalage, heure):
            h, m = map(int, heure.split(":"))
            return timezone.make_aware(
                datetime.combine(aujourdhui + timedelta(days=jours_decalage), datetime.min.time())
                + timedelta(hours=h, minutes=m)
            )

        # Trajet en cours pour Aissatou Diallo
        if not Trajet.objects.filter(chauffeur=chauffeurs["a.diallo@transitflow.ca"],
                                      statut=Trajet.Statut.EN_COURS).exists():
            t1 = Trajet.objects.create(
                chauffeur=chauffeurs["a.diallo@transitflow.ca"],
                vehicule=vehicules["FLT-101"], plaque="FLT-101",
                depart="Terminus Centre-Ville", depart_adresse="1000 rue de la Gauchetière, Montréal",
                arrivee="Aéroport Trudeau", debut=dt(0, "08:15"), fin_prevue=dt(0, "09:30"),
                statut=Trajet.Statut.EN_COURS,
            )
            Arret.objects.create(trajet=t1, lieu="Gare Lucien-L'Allier", heure="08:32", note="Arrêt régulier")

        # Trajets terminés (historique) pour Moussa et Sophie
        for courriel, plaque, depart, arrivee, jour in [
            ("m.traore@transitflow.ca", "FLT-102", "Dépôt Longueuil", "Vieux-Port", -1),
            ("s.fortin@transitflow.ca", "FLT-103", "Université Laval", "Gare du Palais", -2),
        ]:
            t = Trajet.objects.create(
                chauffeur=chauffeurs[courriel], vehicule=vehicules[plaque], plaque=plaque,
                depart=depart, arrivee=arrivee, debut=dt(jour, "07:00"), fin_prevue=dt(jour, "08:00"),
                statut=Trajet.Statut.TERMINE, fin=dt(jour, "07:55"),
            )

        # Un incident ouvert, rattaché au trajet en cours.
        trajet_en_cours = Trajet.objects.filter(
            chauffeur=chauffeurs["a.diallo@transitflow.ca"], statut=Trajet.Statut.EN_COURS
        ).first()
        Incident.objects.get_or_create(
            chauffeur=chauffeurs["a.diallo@transitflow.ca"], titre="Voyant moteur allumé",
            defaults=dict(
                trajet=trajet_en_cours, type=Incident.Type.TECHNIQUE,
                description="Voyant moteur orange allumé après le dernier arrêt, véhicule toujours roulant.",
                lieu="Autoroute 20, sortie 62", date=aujourdhui, heure="08:47",
                statut=Incident.Statut.OUVERT,
            ),
        )

        self.stdout.write(self.style.SUCCESS(
            "Données de démonstration créées. Comptes : a.tremblay@transitflow.ca (admin), "
            "a.diallo / m.traore / s.fortin / m.barry @transitflow.ca (chauffeurs) — mot de passe : demo"
        ))
