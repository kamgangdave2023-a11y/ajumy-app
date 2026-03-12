import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { caisseEvenements } from '../lib/caisse';
import { AjumyDatePicker, AjumyTimePicker, toSupabaseDate, formatTime } from '../components/AjumyDateTimePicker';

// ── Constantes ────────────────────────────────────────────────
const TYPES_EVENEMENT = {
  sortie:        { label: 'Sortie / Excursion',      icon: '🚌', color: '#2E75B6' },
  reunion_extra: { label: 'Réunion extraordinaire',  icon: '📢', color: '#C55A11' },
  formation:     { label: 'Formation / Atelier',     icon: '📚', color: '#1F7A4D' },
  ceremonie:     { label: 'Cérémonie interne',       icon: '🎖️', color: '#7030A0' },
};

const CATEGORIES_DEPENSE = [
  { cle: 'transport',     label: 'Transport',          icon: '🚌' },
  { cle: 'restauration',  label: 'Restauration',       icon: '🍽️' },
  { cle: 'location',      label: 'Location salle',     icon: '🏠' },
  { cle: 'materiel',      label: 'Matériel',           icon: '🛒' },
  { cle: 'communication', label: 'Communication',      icon: '📣' },
  { cle: 'autre',         label: 'Autre',              icon: '📝' },
];

function Header({ title, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 70 }} />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  ACCUEIL
// ══════════════════════════════════════════════════════════════
export default function EvenementsScreen({ onBack }) {
  const { isBureau, peut, isAdmin } = useRole();
  const [vue, setVue]         = useState('accueil');
  const [evenementId, setId]  = useState(null);
  const [stats, setStats]     = useState({ aVenir: 0, enCours: 0, total: 0, totalDepenses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const [{ data: evts }, { data: deps }] = await Promise.all([
      supabase.from('evenement').select('date_evenement, statut'),
      supabase.from('depense_evenement').select('montant'),
    ]);
    const aVenir      = (evts || []).filter(e => e.date_evenement >= today && e.statut !== 'annule').length;
    const totalDepenses = (deps || []).reduce((s, d) => s + d.montant, 0);
    setStats({ aVenir, total: (evts || []).length, totalDepenses });
    setLoading(false);
  }

  if (vue === 'creer')      return <CreerEvenementScreen    onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'liste')      return <ListeEvenementsScreen   onBack={() => { setVue('accueil'); loadStats(); }}
                                      onSelect={id => { setId(id); setVue('detail'); }} />;
  if (vue === 'detail')     return <DetailEvenementScreen   onBack={() => { setVue('liste'); loadStats(); }} evenementId={evenementId} />;
  if (vue === 'historique') return <HistoriqueScreen        onBack={() => setVue('accueil')} />;

  return (
    <View style={styles.container}>
      <Header title="🎉 Événements" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {loading ? <ActivityIndicator color="#7030A0" style={{ marginTop: 20 }} /> : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: '#2E75B6' }]}>
              <Text style={[styles.statCardNum, { color: stats.aVenir > 0 ? '#2E75B6' : '#1F3864' }]}>{stats.aVenir}</Text>
              <Text style={styles.statCardLabel}>À venir</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#7030A0' }]}>
              <Text style={styles.statCardNum}>{stats.total}</Text>
              <Text style={styles.statCardLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#C00000' }]}>
              <Text style={[styles.statCardNum, { fontSize: 14, color: '#C00000' }]}>
                {(stats.totalDepenses / 1000).toFixed(0)}k
              </Text>
              <Text style={styles.statCardLabel}>Dépenses{'\n'}(FCFA)</Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setVue('creer')}>
          <Text style={styles.btnPrimaryText}>➕ Créer un événement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('liste')}>
          <Text style={styles.btnSecondaryText}>📅 Tous les événements</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('historique')}>
          <Text style={styles.btnSecondaryText}>📜 Historique & archives</Text>
        </TouchableOpacity>

        <View style={styles.typesBox}>
          <Text style={styles.typesTitre}>Types d'événements</Text>
          {Object.values(TYPES_EVENEMENT).map((t, i) => (
            <View key={i} style={[styles.typeRow, { borderLeftColor: t.color }]}>
              <Text style={{ fontSize: 18, marginRight: 10 }}>{t.icon}</Text>
              <Text style={{ fontSize: 14, color: '#333' }}>{t.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  CRÉER UN ÉVÉNEMENT
// ══════════════════════════════════════════════════════════════
function CreerEvenementScreen({ onBack }) {
  const [typeEvt, setTypeEvt]     = useState('sortie');
  const [titre, setTitre]         = useState('');
  const [description, setDesc]    = useState('');
  const [lieu, setLieu]           = useState('');
  const [dateEvt, setDateEvt]     = useState(null);  // Date object
  const [heureEvt, setHeureEvt]   = useState(null);  // Date object
  const [showPickerType, setShowPickerType] = useState(false);
  const [saving, setSaving]       = useState(false);

  const type = TYPES_EVENEMENT[typeEvt];

  async function creer() {
    if (!titre.trim())  { Alert.alert('Saisissez un titre'); return; }
    if (!dateEvt)       { Alert.alert('Saisissez une date'); return; }
    setSaving(true);

    const { error } = await supabase.from('evenement').insert({
      type_evenement: typeEvt,
      titre:          titre.trim(),
      description:    description.trim() || null,
      lieu:           lieu.trim() || null,
      date_evenement: toSupabaseDate(dateEvt),
      heure:          heureEvt ? formatTime(heureEvt) : null,
      statut:         'planifie',
      total_depenses: 0,
    });

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }
    Alert.alert('✅ Événement créé', `${type.icon} ${titre}`);
    onBack();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Header title="➕ Créer un événement" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Text style={styles.inputLabel}>Type d'événement *</Text>
        <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
          onPress={() => setShowPickerType(true)}>
          <Text style={{ color: '#333' }}>{type.icon} {type.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Titre *</Text>
        <TextInput style={styles.input} value={titre} onChangeText={setTitre}
          placeholder="Ex: Sortie au lac municipal" />

        <AjumyDatePicker
          label="Date *"
          value={dateEvt}
          onChange={setDateEvt}
          minimumDate={new Date()}
          placeholder="Sélectionner la date"
        />

        <AjumyTimePicker
          label="Heure (optionnel)"
          value={heureEvt}
          onChange={setHeureEvt}
          placeholder="Sélectionner l'heure"
        />

        <Text style={styles.inputLabel}>Lieu</Text>
        <TextInput style={styles.input} value={lieu} onChangeText={setLieu}
          placeholder="Ex: Lac municipal de Yaoundé" />

        <Text style={styles.inputLabel}>Description</Text>
        <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          value={description} onChangeText={setDesc} multiline
          placeholder="Détails, programme, informations utiles..." />

        <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1, marginTop: 16 }]}
          onPress={creer} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> :
            <Text style={styles.btnPrimaryText}>💾 Créer l'événement</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker type */}
      <Modal visible={showPickerType} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Type d'événement</Text>
            {Object.entries(TYPES_EVENEMENT).map(([key, val]) => (
              <TouchableOpacity key={key}
                style={[styles.modalItem, typeEvt === key && styles.modalItemActive]}
                onPress={() => { setTypeEvt(key); setShowPickerType(false); }}>
                <Text style={[styles.modalItemText, typeEvt === key && { color: '#fff' }]}>
                  {val.icon}  {val.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPickerType(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  LISTE DES ÉVÉNEMENTS
// ══════════════════════════════════════════════════════════════
function ListeEvenementsScreen({ onBack, onSelect }) {
  const [evenements, setEvenements] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filtre, setFiltre]         = useState('tous'); // tous | aVenir | passes
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('evenement')
      .select('*').neq('statut', 'annule')
      .order('date_evenement', { ascending: false });
    setEvenements(data || []);
    setLoading(false);
  }

  const filtered = evenements.filter(e => {
    if (filtre === 'aVenir') return e.date_evenement >= today;
    if (filtre === 'passes') return e.date_evenement < today;
    return true;
  });

  return (
    <View style={styles.container}>
      <Header title="📅 Événements" onBack={onBack} />
      <View style={styles.filtreRow}>
        {['tous', 'aVenir', 'passes'].map(f => (
          <TouchableOpacity key={f} style={[styles.filtreBtn, filtre === f && styles.filtreBtnActive]}
            onPress={() => setFiltre(f)}>
            <Text style={[styles.filtreBtnText, filtre === f && { color: '#fff' }]}>
              {f === 'tous' ? 'Tous' : f === 'aVenir' ? 'À venir' : 'Passés'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} /> :
        <FlatList data={filtered} keyExtractor={e => e.evenement_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const t      = TYPES_EVENEMENT[item.type_evenement] || TYPES_EVENEMENT.sortie;
            const passe  = item.date_evenement < today;
            return (
              <TouchableOpacity style={[styles.evtCard, { borderLeftColor: t.color, opacity: passe ? 0.8 : 1 }]}
                onPress={() => onSelect(item.evenement_id)}>
                <Text style={{ fontSize: 26, marginRight: 12 }}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evtTitre}>{item.titre}</Text>
                  <Text style={styles.evtSub}>{t.label}</Text>
                  <Text style={styles.evtDate}>
                    📅 {new Date(item.date_evenement + 'T12:00:00').toLocaleDateString('fr-FR')}
                    {item.heure ? `  ·  ⏰ ${item.heure}` : ''}
                    {item.lieu  ? `  ·  📍 ${item.lieu}` : ''}
                  </Text>
                  {item.total_depenses > 0 && (
                    <Text style={styles.evtDepense}>💸 {item.total_depenses.toLocaleString()} FCFA de dépenses</Text>
                  )}
                </View>
                <Text style={{ fontSize: 18, color: '#aaa' }}>›</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun événement.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  DÉTAIL ÉVÉNEMENT
// ══════════════════════════════════════════════════════════════
function DetailEvenementScreen({ onBack, evenementId }) {
  const [evt, setEvt]           = useState(null);
  const [depenses, setDepenses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [vue, setVue]           = useState('detail'); // detail | ajouterDepense | ajouterPV
  const [showStatutModal, setShowStatutModal] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: e }, { data: d }] = await Promise.all([
      supabase.from('evenement').select('*').eq('evenement_id', evenementId).single(),
      supabase.from('depense_evenement').select('*').eq('evenement_id', evenementId)
        .order('date_depense', { ascending: false }),
    ]);
    setEvt(e);
    setDepenses(d || []);
    setLoading(false);
  }

  async function changerStatut(statut) {
    await supabase.from('evenement').update({ statut }).eq('evenement_id', evenementId);
    setShowStatutModal(false);
    load();
  }

  async function supprimerDepense(dep) {
    Alert.alert('Supprimer cette dépense ?',
      `${dep.libelle} · ${dep.montant.toLocaleString()} FCFA`,
      [{ text: 'Annuler', style: 'cancel' },
       { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await supabase.from('depense_evenement').delete().eq('depense_id', dep.depense_id);
          // Mettre à jour total
          const newTotal = depenses.filter(d => d.depense_id !== dep.depense_id)
            .reduce((s, d) => s + d.montant, 0);
          await supabase.from('evenement').update({ total_depenses: newTotal }).eq('evenement_id', evenementId);
          load();
        }}
      ]);
  }

  if (vue === 'ajouterDepense') return (
    <AjouterDepenseScreen
      onBack={() => { setVue('detail'); load(); }}
      evenementId={evenementId}
      totalActuel={depenses.reduce((s, d) => s + d.montant, 0)}
    />
  );

  if (vue === 'ajouterPV') return (
    <AjouterPVScreen
      onBack={() => { setVue('detail'); load(); }}
      evenementId={evenementId}
      evt={evt}
    />
  );

  if (loading || !evt) return (
    <View style={styles.container}>
      <Header title="Détail" onBack={onBack} />
      <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} />
    </View>
  );

  const t           = TYPES_EVENEMENT[evt.type_evenement] || TYPES_EVENEMENT.sortie;
  const totalDep    = depenses.reduce((s, d) => s + d.montant, 0);
  const STATUTS     = ['planifie', 'en_cours', 'termine', 'annule'];
  const STATUT_LABELS = { planifie: '📋 Planifié', en_cours: '▶️ En cours', termine: '✅ Terminé', annule: '✕ Annulé' };
  const STATUT_COLORS = { planifie: '#2E75B6', en_cours: '#C55A11', termine: '#1E7E34', annule: '#888' };

  return (
    <View style={styles.container}>
      <Header title={`${t.icon} ${evt.titre}`} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Infos événement */}
        <View style={[styles.evtDetailCard, { borderLeftColor: t.color }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.evtTitre}>{evt.titre}</Text>
              <Text style={styles.evtSub}>{t.label}</Text>
            </View>
            <TouchableOpacity
              style={[styles.statutChip, { backgroundColor: STATUT_COLORS[evt.statut] + '22', borderColor: STATUT_COLORS[evt.statut] }]}
              onPress={() => setShowStatutModal(true)}>
              <Text style={[styles.statutChipText, { color: STATUT_COLORS[evt.statut] }]}>
                {STATUT_LABELS[evt.statut]}
              </Text>
            </TouchableOpacity>
          </View>
          {evt.date_evenement && <Text style={styles.evtInfoLigne}>📅 {new Date(evt.date_evenement + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>}
          {evt.heure          && <Text style={styles.evtInfoLigne}>⏰ {evt.heure}</Text>}
          {evt.lieu           && <Text style={styles.evtInfoLigne}>📍 {evt.lieu}</Text>}
          {evt.description    && <Text style={[styles.evtInfoLigne, { marginTop: 8, fontStyle: 'italic', color: '#555' }]}>{evt.description}</Text>}
        </View>

        {/* Dépenses */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitre}>💸 Dépenses</Text>
          <Text style={[styles.sectionTotal, { color: '#C00000' }]}>{totalDep.toLocaleString()} FCFA</Text>
        </View>

        {depenses.map(dep => {
          const cat = CATEGORIES_DEPENSE.find(c => c.cle === dep.categorie) || CATEGORIES_DEPENSE[5];
          return (
            <View key={dep.depense_id} style={styles.depenseCard}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>{cat.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.depenseLibelle}>{dep.libelle}</Text>
                <Text style={styles.depenseSub}>
                  {cat.label} · {new Date(dep.date_depense + 'T12:00:00').toLocaleDateString('fr-FR')}
                </Text>
                {dep.note ? <Text style={styles.depenseNote}>{dep.note}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.depenseMontant}>{dep.montant.toLocaleString()} FCFA</Text>
                <TouchableOpacity onPress={() => supprimerDepense(dep)}>
                  <Text style={{ color: '#C00000', fontSize: 12 }}>🗑 Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('ajouterDepense')}>
          <Text style={styles.btnSecondaryText}>➕ Ajouter une dépense</Text>
        </TouchableOpacity>

        {/* Archives PV / Photos */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitre}>📁 Archives</Text>
        </View>
        {evt.pv_texte ? (
          <View style={styles.pvCard}>
            <Text style={styles.pvTitre}>📄 PV / Compte-rendu</Text>
            <Text style={styles.pvTexte}>{evt.pv_texte}</Text>
          </View>
        ) : null}
        {evt.note_photo ? (
          <View style={styles.pvCard}>
            <Text style={styles.pvTitre}>📸 Note photos</Text>
            <Text style={styles.pvTexte}>{evt.note_photo}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('ajouterPV')}>
          <Text style={styles.btnSecondaryText}>📝 {evt.pv_texte || evt.note_photo ? 'Modifier' : 'Ajouter'} PV / Note photos</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Modal statut */}
      <Modal visible={showStatutModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Changer le statut</Text>
            {STATUTS.map(s => (
              <TouchableOpacity key={s}
                style={[styles.modalItem, evt.statut === s && styles.modalItemActive]}
                onPress={() => changerStatut(s)}>
                <Text style={[styles.modalItemText, evt.statut === s && { color: '#fff' }]}>
                  {STATUT_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowStatutModal(false)}>
              <Text style={styles.modalCloseText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  AJOUTER UNE DÉPENSE
// ══════════════════════════════════════════════════════════════
function AjouterDepenseScreen({ onBack, evenementId, totalActuel }) {
  const [categorie, setCategorie]   = useState('transport');
  const [libelle, setLibelle]       = useState('');
  const [montant, setMontant]       = useState('');
  const [note, setNote]             = useState('');
  const [dateDepense, setDateDepense] = useState(new Date()); // Date object
  const [showPickerCat, setShowPickerCat] = useState(false);
  const [saving, setSaving]         = useState(false);

  const cat = CATEGORIES_DEPENSE.find(c => c.cle === categorie);

  async function enregistrer() {
    if (!libelle.trim()) { Alert.alert('Saisissez un libellé'); return; }
    if (!montant || parseInt(montant) <= 0) { Alert.alert('Montant invalide'); return; }
    setSaving(true);
    const m = parseInt(montant);

    const { error } = await supabase.from('depense_evenement').insert({
      evenement_id:  evenementId,
      categorie,
      libelle:       libelle.trim(),
      montant:       m,
      date_depense:  toSupabaseDate(dateDepense),
      note:          note.trim() || null,
    });

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    // Caisse automatique
    await caisseEvenements.depense(m, libelle.trim(), evenementId);

    // Mettre à jour total_depenses sur l'événement
    await supabase.from('evenement')
      .update({ total_depenses: totalActuel + m })
      .eq('evenement_id', evenementId);

    Alert.alert('✅ Dépense enregistrée', `${cat.icon} ${libelle} · ${m.toLocaleString()} FCFA`);
    onBack();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Header title="💸 Ajouter une dépense" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Text style={styles.inputLabel}>Catégorie *</Text>
        <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
          onPress={() => setShowPickerCat(true)}>
          <Text style={{ color: '#333' }}>{cat?.icon} {cat?.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Libellé *</Text>
        <TextInput style={styles.input} value={libelle} onChangeText={setLibelle}
          placeholder="Ex: Location bus, Repas groupe..." />

        <Text style={styles.inputLabel}>Montant (FCFA) *</Text>
        <TextInput style={styles.input} value={montant} onChangeText={setMontant}
          keyboardType="numeric" placeholder="Ex: 50000" />

        <AjumyDatePicker
          label="Date de la dépense"
          value={dateDepense}
          onChange={setDateDepense}
          maximumDate={new Date()}
          placeholder="Sélectionner la date"
        />

        <Text style={styles.inputLabel}>Note (optionnel)</Text>
        <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          value={note} onChangeText={setNote} multiline placeholder="Précisions..." />

        <View style={styles.calcCard}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Dépenses actuelles</Text>
            <Text style={styles.calcVal}>{totalActuel.toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Cette dépense</Text>
            <Text style={[styles.calcVal, { color: '#C00000' }]}>+ {parseInt(montant || 0).toLocaleString()} FCFA</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={[styles.calcLabel, { fontWeight: 'bold' }]}>Nouveau total</Text>
            <Text style={[styles.calcVal, { fontWeight: 'bold', color: '#C00000' }]}>
              {(totalActuel + parseInt(montant || 0)).toLocaleString()} FCFA
            </Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1, marginTop: 8 }]}
          onPress={enregistrer} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> :
            <Text style={styles.btnPrimaryText}>💾 Enregistrer la dépense</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showPickerCat} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Catégorie de dépense</Text>
            {CATEGORIES_DEPENSE.map(c => (
              <TouchableOpacity key={c.cle}
                style={[styles.modalItem, categorie === c.cle && styles.modalItemActive]}
                onPress={() => { setCategorie(c.cle); setShowPickerCat(false); }}>
                <Text style={[styles.modalItemText, categorie === c.cle && { color: '#fff' }]}>
                  {c.icon}  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPickerCat(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  AJOUTER PV / NOTE PHOTOS
// ══════════════════════════════════════════════════════════════
function AjouterPVScreen({ onBack, evenementId, evt }) {
  const [pvTexte, setPvTexte]     = useState(evt?.pv_texte || '');
  const [notePhoto, setNotePhoto] = useState(evt?.note_photo || '');
  const [saving, setSaving]       = useState(false);

  async function enregistrer() {
    setSaving(true);
    await supabase.from('evenement').update({
      pv_texte:   pvTexte.trim() || null,
      note_photo: notePhoto.trim() || null,
    }).eq('evenement_id', evenementId);
    Alert.alert('✅ Archive enregistrée');
    onBack();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📁 PV & Photos" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Text style={styles.inputLabel}>📄 PV / Compte-rendu</Text>
        <TextInput
          style={[styles.input, { height: 180, textAlignVertical: 'top' }]}
          value={pvTexte} onChangeText={setPvTexte} multiline
          placeholder="Résumé de la réunion, décisions prises, points importants..." />

        <Text style={styles.inputLabel}>📸 Note photos</Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
          value={notePhoto} onChangeText={setNotePhoto} multiline
          placeholder="Lien album, description des photos, observations..." />

        <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1, marginTop: 16 }]}
          onPress={enregistrer} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> :
            <Text style={styles.btnPrimaryText}>💾 Enregistrer</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE — événements terminés + annulés
// ══════════════════════════════════════════════════════════════
function HistoriqueScreen({ onBack }) {
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('evenement')
      .select('*').in('statut', ['termine', 'annule'])
      .order('date_evenement', { ascending: false });
    setHistorique(data || []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📜 Historique" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} /> :
        <FlatList data={historique} keyExtractor={e => e.evenement_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const t      = TYPES_EVENEMENT[item.type_evenement] || TYPES_EVENEMENT.sortie;
            const annule = item.statut === 'annule';
            return (
              <View style={[styles.evtCard, { borderLeftColor: t.color, opacity: annule ? 0.6 : 1 }]}>
                <Text style={{ fontSize: 24, marginRight: 12 }}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evtTitre}>{item.titre}</Text>
                  <Text style={styles.evtDate}>
                    📅 {new Date(item.date_evenement + 'T12:00:00').toLocaleDateString('fr-FR')}
                    {item.lieu ? `  ·  📍 ${item.lieu}` : ''}
                  </Text>
                  {item.total_depenses > 0 && (
                    <Text style={styles.evtDepense}>💸 {item.total_depenses.toLocaleString()} FCFA</Text>
                  )}
                  <Text style={{ fontSize: 12, color: annule ? '#C00000' : '#1E7E34', fontWeight: 'bold', marginTop: 4 }}>
                    {annule ? '✕ Annulé' : '✅ Terminé'}
                    {item.pv_texte ? '  ·  📄 PV archivé' : ''}
                    {item.note_photo ? '  ·  📸 Photos' : ''}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun événement archivé.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F0F4F8' },
  header:             { backgroundColor: '#4A235A', padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:            { color: '#E1BEE7', fontSize: 14 },
  statsRow:           { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:           { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderTopWidth: 4 },
  statCardNum:        { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  statCardLabel:      { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  btnPrimary:         { backgroundColor: '#4A235A', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:     { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary:       { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText:   { color: '#1F3864', fontSize: 15, fontWeight: '600' },
  typesBox:           { backgroundColor: '#F3E8FF', borderRadius: 12, padding: 14, marginTop: 4, borderLeftWidth: 4, borderLeftColor: '#7030A0' },
  typesTitre:         { fontSize: 13, fontWeight: 'bold', color: '#4A235A', marginBottom: 8 },
  typeRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingLeft: 8, borderLeftWidth: 3, marginBottom: 4, borderRadius: 4 },
  inputLabel:         { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 4 },
  filtreRow:          { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 0 },
  filtreBtn:          { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#D6E4F0' },
  filtreBtnActive:    { backgroundColor: '#4A235A', borderColor: '#4A235A' },
  filtreBtnText:      { fontSize: 13, fontWeight: '600', color: '#1F3864' },
  evtCard:            { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2, borderLeftWidth: 4 },
  evtDetailCard:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, borderLeftWidth: 4 },
  evtTitre:           { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  evtSub:             { fontSize: 12, color: '#888', marginTop: 1 },
  evtDate:            { fontSize: 12, color: '#555', marginTop: 4 },
  evtDepense:         { fontSize: 12, color: '#C00000', marginTop: 3 },
  evtInfoLigne:       { fontSize: 13, color: '#444', marginTop: 6 },
  statutChip:         { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 5 },
  statutChipText:     { fontSize: 12, fontWeight: 'bold' },
  sectionHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  sectionTitre:       { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  sectionTotal:       { fontSize: 15, fontWeight: 'bold' },
  depenseCard:        { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'flex-start', elevation: 1 },
  depenseLibelle:     { fontSize: 14, fontWeight: 'bold', color: '#1F3864' },
  depenseSub:         { fontSize: 12, color: '#888', marginTop: 2 },
  depenseNote:        { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 2 },
  depenseMontant:     { fontSize: 14, fontWeight: 'bold', color: '#C00000' },
  pvCard:             { backgroundColor: '#F8F0FF', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#7030A0' },
  pvTitre:            { fontSize: 13, fontWeight: 'bold', color: '#4A235A', marginBottom: 6 },
  pvTexte:            { fontSize: 13, color: '#444', lineHeight: 20 },
  calcCard:           { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 10, elevation: 2 },
  calcRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  calcLabel:          { color: '#666', fontSize: 14, flex: 1 },
  calcVal:            { fontSize: 14, fontWeight: '600', color: '#333' },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle:         { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 12 },
  modalItem:          { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8' },
  modalItemActive:    { backgroundColor: '#4A235A' },
  modalItemText:      { fontSize: 15, color: '#333' },
  modalClose:         { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText:     { color: '#666', fontWeight: 'bold' },
  empty:              { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});