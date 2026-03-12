# Guide d'intégration — AjumyDateTimePicker dans AJUMY

## Installation

```bash
npx expo install @react-native-community/datetimepicker
```

Placer `AjumyDateTimePicker.js` dans :
```
src/components/AjumyDateTimePicker.js
```

---

## 1. FormulaireAdherent — Date de naissance

**Avant (TextInput manuel):**
```jsx
<TextInput
  style={fS.input}
  placeholder="JJ/MM/AAAA"
  value={form.date_naissance}
  onChangeText={v => set('date_naissance', v)}
  keyboardType="numeric"
/>
```

**Après (picker natif) :**
```jsx
import { AjumyDatePicker, toSupabaseDate } from '../components/AjumyDateTimePicker';

// Dans le state du formulaire — stocker un objet Date
const [dateNaissance, setDateNaissance] = useState(null);

// Dans le JSX
<AjumyDatePicker
  label="Date de naissance"
  value={dateNaissance}
  onChange={setDateNaissance}
  maximumDate={new Date()}               // Pas de date future
  minimumDate={new Date(1930, 0, 1)}    // Limite minimum
  placeholder="Sélectionner la date de naissance"
/>

// Lors de l'enregistrement — convertir pour Supabase
const { error } = await supabase.from('adherents').insert([{
  ...
  date_naissance: toSupabaseDate(dateNaissance),   // → '1990-05-15'
  date_inscription: toSupabaseDate(new Date()),
  date_fin_observation: toSupabaseDate(
    new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
  ),
}]);
```

---

## 2. EvenementsScreen — Date + Heure de l'événement

```jsx
import {
  AjumyDateTimePicker,
  AjumyDatePicker,
  toSupabaseTimestamp,
  toSupabaseDate,
} from '../components/AjumyDateTimePicker';

const [dateDebut, setDateDebut]   = useState(null);
const [dateFin, setDateFin]       = useState(null);

// Dans le formulaire de création d'événement
<AjumyDateTimePicker
  label="Début de l'événement *"
  value={dateDebut}
  onChange={setDateDebut}
  minimumDate={new Date()}
  dark   // thème sombre si l'écran est dark
/>

<AjumyDateTimePicker
  label="Fin de l'événement"
  value={dateFin}
  onChange={setDateFin}
  minimumDate={dateDebut || new Date()}
  dark
/>

// Enregistrement
await supabase.from('evenements').insert([{
  titre: form.titre,
  date_debut: toSupabaseTimestamp(dateDebut),  // → '2026-03-15T14:00:00.000Z'
  date_fin:   toSupabaseTimestamp(dateFin),
}]);
```

---

## 3. PresenceScreen — Date de séance

```jsx
import { AjumyDatePicker, toSupabaseDate } from '../components/AjumyDateTimePicker';

const [dateSeance, setDateSeance] = useState(new Date()); // default = aujourd'hui

// Dans le formulaire "Nouvelle séance"
<AjumyDatePicker
  label="Date du dimanche *"
  value={dateSeance}
  onChange={(date) => {
    // Forcer au dimanche le plus proche
    const jour = date.getDay();
    if (jour !== 0) {
      Alert.alert('Attention', 'La séance doit être un dimanche.');
    }
    setDateSeance(date);
  }}
  dark
/>

// Enregistrement
const dateStr = toSupabaseDate(dateSeance); // '2026-03-15'
await supabase.from('cahier_presence').insert(rows.map(r => ({
  ...r,
  date_dimanche: dateStr,
})));
```

---

## 4. SanctionsScreen — Date de sanction

```jsx
import { AjumyDatePicker, toSupabaseDate } from '../components/AjumyDateTimePicker';

const [dateSanction, setDateSanction] = useState(new Date());

<AjumyDatePicker
  label="Date de la sanction"
  value={dateSanction}
  onChange={setDateSanction}
  maximumDate={new Date()}   // Pas de sanction dans le futur
  dark
/>

await supabase.from('sanctions').insert([{
  ...form,
  date_sanction: toSupabaseDate(dateSanction),
}]);
```

---

## 5. RoulementScreen — Date du roulement

```jsx
import { AjumyDatePicker, toSupabaseDate } from '../components/AjumyDateTimePicker';

const [dateRoulement, setDateRoulement] = useState(null);

<AjumyDatePicker
  label="Date du tirage"
  value={dateRoulement}
  onChange={setDateRoulement}
  dark
/>
```

---

## Résumé des exports disponibles

| Export                | Usage                                    | Supabase helper         |
|-----------------------|------------------------------------------|-------------------------|
| `AjumyDatePicker`     | Date seule (naissance, séance, sanction) | `toSupabaseDate()`      |
| `AjumyTimePicker`     | Heure seule (heure de réunion)           | _(formater manuellement)_ |
| `AjumyDateTimePicker` | Date + heure (événements, rendez-vous)   | `toSupabaseTimestamp()` |
| `formatDate(date)`    | Affichage court : "15/03/2026"           | —                       |
| `formatDateLong(date)`| Affichage long : "dimanche 15 mars 2026" | —                       |
| `formatTime(date)`    | Affichage heure : "14:30"                | —                       |
| `formatDateTime(date)`| Date + heure : "15/03/2026 à 14:30"     | —                       |

---

## Comportement cross-platform

| Plateforme | Mode `date`     | Mode `time`     | Mode `datetime`                        |
|------------|-----------------|-----------------|----------------------------------------|
| **iOS**    | Modal + spinner | Modal + spinner | Modal + spinner (tout en un)           |
| **Android**| Dialog natif    | Dialog natif    | Dialog date → puis dialog heure auto   |
| **Web**    | Champ HTML date | Champ HTML time | Champ HTML datetime-local              |

> **Note Web (Expo Web)** : `@react-native-community/datetimepicker` affiche
> les inputs HTML natifs du navigateur sur le web. Le style est minimal mais fonctionnel.
> Si vous souhaitez un rendu plus soigné sur web, enveloppez avec une condition
> `Platform.OS === 'web'` et utilisez un `<input type="date" />` stylé manuellement.