from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve as serve_static

# Racine du dépôt (dossier au-dessus de backend/) : c'est là que vivent
# index.html, admin/*.html, chauffeur/*.html et assets/ — le front-end
# statique du prototype.
FRONTEND_DIR = settings.BASE_DIR.parent

urlpatterns = [
    # L'admin Django (outillage interne, pas l'espace "Administrateur" du
    # front-end) est déplacé sous /django-admin/ pour libérer /admin/, que
    # le front-end utilise pour ses propres pages (admin/tableau-de-bord.html…).
    path("django-admin/", admin.site.urls),
    path("api/", include("flotte.urls")),
]

if settings.DEBUG:
    # Sert le front-end statique (index.html, admin/, chauffeur/, assets/)
    # depuis le même serveur que l'API, pour que tout tourne sur un seul
    # `python manage.py runserver`. django.views.static.serve n'est pas
    # fait pour la production — seulement pour le développement local.
    urlpatterns += [
        path("", serve_static, {"document_root": FRONTEND_DIR, "path": "index.html"}, name="accueil"),
        re_path(r"^(?P<path>.+)$", serve_static, {"document_root": FRONTEND_DIR}),
    ]
