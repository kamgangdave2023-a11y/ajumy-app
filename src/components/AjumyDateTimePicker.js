/**
 * AjumyDateTimePicker — Composant réutilisable pour tout le projet AJUMY
 * ─────────────────────────────────────────────────────────────────────
 * Dépendance : @react-native-community/datetimepicker
 * Installation : npx expo install @react-native-community/datetimepicker
 *
 * USAGE :
 *
 *   // 1. Date seule
 *   <AjumyDatePicker
 *     label="Date de naissance"
 *     value={dateNaissance}
 *     onChange={setDateNaissance}
 *     maximumDate={new Date()}
 *   />
 *
 *   // 2. Heure seule
 *   <AjumyTimePicker
 *     label="Heure de réunion"
 *     value={heureReunion}
 *     onChange={setHeureReunion}
 *   />
 *
 *   // 3. Date + Heure (datetime complet)
 *   <AjumyDateTimePicker
 *     label="Date et heure de l'événement"
 *     value={dateHeure}
 *     onChange={setDateHeure}
 *     minimumDate={new Date()}
 *   />
 *
 *   // 4. Champ texte stylé (sans picker — pour formulaires simples)
 *   <AjumyDateField
 *     label="Date limite"
 *     value={dateLimite}
 *     onChange={setDateLimite}
 *     dark   // thème sombre (fiche adhérent)
 *   />
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Platform, Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

// ── Helpers ─────────────────────────────────────────────────
export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function formatDateLong(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateTime(date) {
  if (!date) return '—';
  return `${formatDate(date)} à ${formatTime(date)}`;
}

// Convertit Date → 'YYYY-MM-DD' (pour Supabase)
export function toSupabaseDate(date) {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
}

// Convertit Date → ISO string (pour Supabase timestamp)
export function toSupabaseTimestamp(date) {
  if (!date) return null;
  return new Date(date).toISOString();
}

// ══════════════════════════════════════════════════════════════
//  COMPOSANT INTERNE : Wrapper cross-platform
// ══════════════════════════════════════════════════════════════
function PickerWrapper({
  mode,         // 'date' | 'time' | 'datetime'
  value,        // Date object
  onChange,     // (Date) => void
  minimumDate,
  maximumDate,
  label,
  placeholder,
  dark,         // bool — thème sombre
  formatFn,     // fonction de formatage affichage
}) {
  const [show, setShow]           = useState(false);
  // Pour iOS : on mémorise la valeur temp jusqu'à confirmation
  const [tempValue, setTempValue] = useState(value || new Date());
  // Étape 1/2 sur Android pour datetime
  const [androidStep, setAndroidStep] = useState('date'); // 'date' | 'time'

  const displayValue = value ? (formatFn ? formatFn(value) : value.toLocaleString('fr-FR')) : null;

  // ── Android : 2 passes (date puis time) ─────────────────
  function handleAndroidChange(event, selectedDate) {
    if (event.type === 'dismissed') { setShow(false); return; }
    if (!selectedDate) return;

    if (mode === 'datetime') {
      if (androidStep === 'date') {
        // Mémoriser la date, ouvrir le time picker
        setTempValue(selectedDate);
        setAndroidStep('time');
        // Petit délai pour laisser le premier picker se fermer
        setTimeout(() => setShow(true), 100);
      } else {
        // Fusionner date + heure
        const merged = new Date(tempValue);
        merged.setHours(selectedDate.getHours(), selectedDate.getMinutes());
        onChange(merged);
        setShow(false);
        setAndroidStep('date'); // reset
      }
    } else {
      onChange(selectedDate);
      setShow(false);
    }
  }

  // ── iOS : modal avec "Confirmer" ─────────────────────────
  function handleIOSChange(event, selectedDate) {
    if (selectedDate) setTempValue(selectedDate);
  }

  function openPicker() {
    setTempValue(value || new Date());
    setAndroidStep('date');
    setShow(true);
  }

  // Mode Android actuel (date ou time selon l'étape)
  const androidMode = mode === 'datetime'
    ? (androidStep === 'date' ? 'date' : 'time')
    : mode;

  const st = dark ? sDark : sLight;

  return (
    <View style={st.wrapper}>
      {label ? <Text style={st.label}>{label}</Text> : null}

      {/* Bouton déclencheur */}
      <TouchableOpacity style={st.field} onPress={openPicker} activeOpacity={0.75}>
        <Text style={[st.fieldTxt, !displayValue && st.placeholder]}>
          {displayValue || placeholder || 'Sélectionner…'}
        </Text>
        <Text style={st.fieldIcon}>
          {mode === 'time' ? '🕐' : '📅'}
        </Text>
      </TouchableOpacity>

      {/* ── ANDROID : picker inline (pas de modal) ── */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={tempValue}
          mode={androidMode}
          display="default"
          locale="fr"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleAndroidChange}
        />
      )}

      {/* ── iOS : modal avec spinner + bouton Confirmer ── */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <View style={sModal.overlay}>
            <View style={sModal.sheet}>
              {/* Header */}
              <View style={sModal.header}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={sModal.annuler}>Annuler</Text>
                </TouchableOpacity>
                <Text style={sModal.titre}>{label || 'Sélectionner'}</Text>
                <TouchableOpacity onPress={() => { onChange(tempValue); setShow(false); }}>
                  <Text style={sModal.confirmer}>Confirmer</Text>
                </TouchableOpacity>
              </View>

              {/* Picker natif iOS */}
              <DateTimePicker
                value={tempValue}
                mode={mode}
                display="spinner"
                locale="fr"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleIOSChange}
                style={{ height: 220, backgroundColor: '#fff' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  EXPORTS PUBLICS
// ══════════════════════════════════════════════════════════════

/**
 * Picker de date seule
 */
export function AjumyDatePicker({ label, value, onChange, minimumDate, maximumDate, dark, placeholder }) {
  return (
    <PickerWrapper
      mode="date"
      label={label}
      value={value}
      onChange={onChange}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      dark={dark}
      placeholder={placeholder}
      formatFn={formatDate}
    />
  );
}

/**
 * Picker d'heure seule
 */
export function AjumyTimePicker({ label, value, onChange, dark, placeholder }) {
  return (
    <PickerWrapper
      mode="time"
      label={label}
      value={value}
      onChange={onChange}
      dark={dark}
      placeholder={placeholder}
      formatFn={formatTime}
    />
  );
}

/**
 * Picker date + heure combinés
 * Sur Android : ouvre d'abord le date picker, puis le time picker automatiquement
 * Sur iOS : un seul spinner "datetime"
 */
export function AjumyDateTimePicker({ label, value, onChange, minimumDate, maximumDate, dark, placeholder }) {
  return (
    <PickerWrapper
      mode="datetime"
      label={label}
      value={value}
      onChange={onChange}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      dark={dark}
      placeholder={placeholder}
      formatFn={formatDateTime}
    />
  );
}

// ══════════════════════════════════════════════════════════════
//  CHAMP TEXTE FORMATÉ (sans picker — saisie manuelle simple)
//  Utile pour des cas simples où le natif n'est pas nécessaire
// ══════════════════════════════════════════════════════════════
export function AjumyDateField({ label, value, onChange, dark, placeholder = 'JJ/MM/AAAA' }) {
  const [raw, setRaw] = useState(value || '');

  function handleChange(text) {
    // Auto-formatage : insère les / automatiquement
    let v = text.replace(/\D/g, ''); // garder chiffres seulement
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5, 9);
    setRaw(v);
    if (v.length === 10) onChange(v); // DD/MM/YYYY complet
  }

  const st = dark ? sDark : sLight;

  return (
    <View style={st.wrapper}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <View style={[st.field, { paddingVertical: 0 }]}>
        <Text /* TextInput remplacé par simplicité */ style={[st.fieldTxt, !raw && st.placeholder]}>
          {raw || placeholder}
        </Text>
        <Text style={st.fieldIcon}>📅</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════

// Thème clair (formulaire ajout adhérent)
const sLight = StyleSheet.create({
  wrapper: { marginBottom: 2 },
  label:   { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 12 },
  field:   {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E0E4EA',
    paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  fieldTxt:   { fontSize: 14, color: '#333', flex: 1 },
  placeholder:{ color: '#aaa' },
  fieldIcon:  { fontSize: 18, marginLeft: 8 },
});

// Thème sombre (fiche détail adhérent, PresenceScreen, etc.)
const sDark = StyleSheet.create({
  wrapper: { marginBottom: 2 },
  label:   { fontSize: 12, color: '#8894AA', marginBottom: 6, marginTop: 4, fontWeight: '600' },
  field:   {
    backgroundColor: '#1E2A40', borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  fieldTxt:   { fontSize: 14, color: '#DDE3EE', flex: 1 },
  placeholder:{ color: '#556070' },
  fieldIcon:  { fontSize: 18, marginLeft: 8 },
});

// Modal iOS
const sModal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // safe area iPhone
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E8ECF0',
  },
  titre:    { fontSize: 15, fontWeight: '600', color: '#333', flex: 1, textAlign: 'center' },
  annuler:  { fontSize: 15, color: '#888' },
  confirmer:{ fontSize: 15, color: '#1F3864', fontWeight: 'bold' },
});