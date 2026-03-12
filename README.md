# 🐘 AJUMY

Application mobile de gestion pour l'**Association des Jeunes Unis de Manjo à Yaoundé**.

## Fonctionnalités

- **Adhérents** — gestion des membres, statuts, rôles
- **Présence** — pointage sécurisé QR Code + GPS chaque dimanche
- **Caisse** — sessions de caisse, mouvements financiers en temps réel
- **Banque** — dépôts ordinaires et scolaires
- **Ventes** — ventes du mois avec suivi des échéances
- **Roulements** — tontine rotative avec suivi des pas
- **Grande Tontine** — gestion de la grande tontine
- **Solidarité** — aide malheur/maladie
- **Dettes & Sanctions** — suivi des débiteurs et pénalités
- **Voir Bébé** — annonces de naissances
- **Événements** — calendrier des activités
- **Ressources** — inventaire du matériel (chaises, couverts…)
- **Huile + Savon** — ventes de produits
- **Chat** — messagerie interne
- **Administration** — gestion des sessions, audit, permissions

## Stack technique

- [Expo](https://expo.dev) / React Native
- [Supabase](https://supabase.com) — base de données et authentification
- React 19 · Zustand · React Navigation

## Démarrage

```bash
npm install
npx expo start
```

Scannez le QR code avec **Expo Go** (iOS / Android).

## Rôles

| Rôle | Accès |
|---|---|
| `SUPER_ADMIN` | Accès total |
| `PRESIDENT` | Bureau + sanctions + adhérents + ventes |
| `TRESORIER` | Caisse + rapports financiers |
| `SECRETAIRE` | Gestion adhérents |
| `CENSEUR` | Sanctions + validation présence |
| `COMMISSAIRE` | Rapports financiers |
| `ADHERENT` | Accès standard |

---

*AJUMY — Yaoundé, Cameroun*
