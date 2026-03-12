# 🐘 AJUMY — Système de Présence Sécurisé
> Document de spécifications — Conclusions des discussions

---

## 1. Objectif

Contraindre chaque adhérent à être **physiquement présent au siège** chaque dimanche de réunion avant d'avoir accès à l'application AJUMY, tout en gérant les cas particuliers (vieux téléphones, sans téléphone) et en empêchant toute fraude.

---

## 2. Connexion

| Paramètre | Valeur |
|---|---|
| Méthode | Identifiant AJUMY + mot de passe |
| Format identifiant | Ex : `AJU-0023` (généré à l'inscription) |
| Compatibilité | iOS + Android |

---

## 3. Méthode de vérification de présence

### Méthode principale — Téléphone récent
Combinaison **QR Code + GPS** pour une sécurité maximale.

| Paramètre | Valeur |
|---|---|
| QR Code | Généré par le bureau chaque dimanche, unique à la date |
| GPS | Rayon de 100m autour du siège |
| Les deux requis | OUI — QR valide + dans la zone GPS |

### Méthode de secours — Vieux téléphone
Si le téléphone ne supporte pas le scan QR ou le GPS :

| Paramètre | Valeur |
|---|---|
| Méthode | Code PIN à 6 chiffres |
| Affichage | Affiché au siège par le bureau |
| Validité | Uniquement le dimanche de la session |

---

## 4. Anti-fraude — Usurpation d'identité

Mesures actives pour empêcher qu'un adhérent utilise les accès d'un autre :

| Protection | Détail |
|---|---|
| **Device ID fixe** | 1 compte = 1 seul téléphone enregistré |
| **Alerte bureau** | Toute connexion depuis un nouvel appareil déclenche une alerte immédiate au bureau |
| **Biométrie** | Empreinte digitale ou Face ID obligatoire à chaque connexion |
| **Selfie obligatoire** | Photo prise au moment du scan, stockée dans Supabase, visible par le bureau |

---

## 5. Présence continue — Rester jusqu'à la fin

Pour s'assurer que l'adhérent ne repart pas après le scan :

| Paramètre | Valeur |
|---|---|
| Méthode | GPS surveillé en continu pendant toute la réunion |
| Fréquence | Vérification toutes les **15 minutes** |
| Si hors zone | App bloquée immédiatement + alerte envoyée au bureau |
| Fin de surveillance | Quand le bureau ferme manuellement la session |
| Accès après fermeture | Maintenu pour tous les présents validés |

---

## 6. Session du dimanche

Le bureau contrôle manuellement l'ouverture et la fermeture :

| Action | Qui | Effet |
|---|---|---|
| **Ouvrir la session** | N'importe quel membre du bureau | Active QR + PIN + GPS, les adhérents peuvent pointer |
| **Fermer la session** | N'importe quel membre du bureau | Arrête la surveillance GPS, absents marqués automatiquement |
| **Avant ouverture** | — | Scan refusé, app accessible normalement |
| **Pas dimanche** | — | Aucune vérification, accès direct au Dashboard |

---

## 7. Cas — Adhérent sans téléphone

Pour les membres ne disposant d'aucun téléphone :

| Étape | Action |
|---|---|
| 1 | Le **Censeur** valide la présence depuis son téléphone |
| 2 | Le **Secrétaire** valide indépendamment depuis son téléphone |
| 3 | Les 2 validations = présence enregistrée (**double signature obligatoire**) |
| 4 | Notification envoyée à **tout le bureau** |
| 5 | Audit log enregistré (qui a validé + horodatage exact) |

> ⚠️ Une seule validation ne suffit pas — protection contre la connivence.

---

## 8. Traçabilité & Audit

Toutes les actions sont enregistrées et consultables par le bureau :

| Événement | Données enregistrées |
|---|---|
| Connexion | Identifiant, device_id, heure, appareil |
| Nouvel appareil | Alerte + log + device_id précédent vs nouveau |
| Scan QR | Heure, position GPS, selfie, résultat |
| Vérification GPS 15min | Position, distance au siège, statut |
| Sortie de zone | Heure, position, alerte bureau |
| Validation manuelle | Censeur, Secrétaire, adhérent, horodatage |
| Ouverture/fermeture session | Membre bureau, heure exacte |

---

## 9. Tables Supabase à créer

| Table | Contenu |
|---|---|
| `session_dimanche` | QR code, PIN, coordonnées GPS siège, statut ouvert/fermé, heure ouverture/fermeture |
| `pointage_presence` | Adhérent, device_id, selfie URL, position GPS, méthode utilisée, statut |
| `appareils_autorises` | device_id par adhérent, date enregistrement, statut actif/révoqué |
| `validation_manuelle` | Adhérent pointé, validateur1 (Censeur), validateur2 (Secrétaire), horodatage |
| `audit_presence` | Log complet de toutes les actions liées à la présence |

---

## 10. Fichiers à créer / modifier

| Fichier | Type | Rôle |
|---|---|---|
| `migration_presence.sql` | SQL | Création des 5 tables Supabase |
| `LoginScreen.js` | Modifier | Login AJUMY + vérification Device ID + biométrie |
| `GpsGateScreen.js` | Créer | Écran QR + GPS + selfie + PIN de secours |
| `usePresenceGate.js` | Créer | Hook surveillance GPS toutes les 15min |
| `ValidationManuelleScreen.js` | Créer | Double signature Censeur + Secrétaire |
| `AdminScreen.js` | Modifier | Ouvrir/fermer session, afficher QR, voir selfies, audit log |

---

## 11. Récapitulatif des flux

### Flux A — Téléphone récent (cas normal)
```
Login (Identifiant AJUMY + mot de passe)
    ↓
Vérification Device ID
  ├─ Même appareil → OK
  └─ Nouvel appareil → Alerte bureau + bloqué
    ↓
Biométrie (empreinte / Face ID)
    ↓
Dimanche + session ouverte ?
  ├─ NON → Dashboard direct
  └─ OUI → GpsGateScreen
    ↓
QR Code valide + dans la zone GPS (100m)
    ↓
📸 Selfie obligatoire
    ↓
✅ Accès Dashboard
GPS surveillé toutes les 15min jusqu'à fermeture session
```

### Flux B — Vieux téléphone
```
Login → Device ID → Biométrie
    ↓
Code PIN 6 chiffres (affiché au siège)
    ↓
📸 Selfie
    ↓
✅ Accès Dashboard
```

### Flux C — Sans téléphone
```
Censeur valide sur son téléphone
    +
Secrétaire valide sur son téléphone
    ↓
Notification à tout le bureau
Audit log enregistré
    ↓
✅ Présence enregistrée
```

---

*Document généré le 10 mars 2026 — AJUMY App*
