import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { caisseSolidarite } from '../lib/caisse';

// ── Constantes ────────────────────────────────────────────────
const TYPES_SOLIDARITE = {
  maladie: {
    label: 'Maladie',
    icon: '🏥', color: '#2E75B6',
    cotisation_type: 'libre',
    cotisation_montant: null,
    delai_jours: null,
    obligatoire: false,
    present_biere: false,
    note: 'Main levée — chaque adhérent donne ce qu\'il veut (volontaire)',
  },
  deces_membre: {
    label: 'Décès membre AJUMY',
    icon: '🕊️', color: '#1F3864',
    cotisation_type: 'fixe',
    cotisation_montant: 25000,
    delai_jours: 30,
    obligatoire: true,
    present_biere: false,
    note: '25 000 FCFA/adhérent · recouvrement sous 1 mois',
  },
  deces_famille_enterrement: {
    label: 'Décès famille — Enterrement simple',
    icon: '⚰️', color: '#555',
    cotisation_type: 'fixe',
    cotisation_montant: 5000,
    delai_jours: 30,
    obligatoire: true,
    present_biere: true,
    note: '5 000 FCFA/adhérent · présent + bière le jour J · argent sous 1 mois',
  },
  deces_famille_enterrement_funerailles: {
    label: 'Décès famille — Enterrement + Funérailles',
    icon: '⚰️', color: '#555',
    cotisation_type: 'fixe',
    cotisation_montant: 7500,
    delai_jours: 60,
    obligatoire: true,
    present_biere: true,
    note: '7 500 FCFA/adhérent · présent + bière le jour J · argent sous 2 mois',
  },
  deces_famille_funerailles: {
    label: 'Décès famille — Funérailles seules',
    icon: '⚰️', color: '#555',
    cotisation_type: 'fixe',
    cotisation_montant: 5000,
    delai_jours: 30,
    obligatoire: true,
    present_biere: true,
    note: '5 000 FCFA/adhérent · présent + bière le jour J · argent sous 1 mois',
  },
  mariage: {
    label: 'Mariage',
    icon: '💍', color: '#C55A11',
    cotisation_type: 'fixe',
    cotisation_montant: 10000,
    delai_jours: 60,
    obligatoire: true,
    present_biere: true,
    note: '10 000 FCFA + présent + bière · recouvrement sous 2 mois',
  },
  autre: {
    label: 'Autre événement',
    icon: '🤝', color: '#7030A0',
    cotisation_type: 'libre',
    cotisation_montant: null,
    delai_jours: null,
    obligatoire: false,
    present_biere: false,
    note: 'Montant défini par le bureau',
  },
};

function Header({ title, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 70 }} />
    </View>
  );
}

function getDimanche() {
  const t = new Date(); const day = t.getDay();
  const diff = t.getDate() - day + (day === 0 ? 0 : 7 - day);
  return new Date(new Date().setDate(diff)).toISOString().split('T')[0];
}

// ══════════════════════════════════════════════════════════════
//  ACCUEIL SOLIDARITÉ
// ══════════════════════════════════════════════════════════════
export default function SolidariteScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [vue, setVue]         = useState('accueil');
  const [evenementId, setEvenementId] = useState(null);
  const [stats, setStats]     = useState({ fonds: 0, enCours: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    const [{ data: fonds }, { data: evts }] = await Promise.all([
      supabase.from('fonds_solidarite').select('solde').single(),
      supabase.from('evenement_solidarite').select('statut'),
    ]);
    const enCours = (evts || []).filter(e => e.statut === 'en_cours').length;
    setStats({ fonds: fonds?.solde || 0, enCours, total: (evts || []).length });
    setLoading(false);
  }

  if (vue === 'creer')        return <CreerEvenementScreen     onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'enCours')      return <EvenementsEnCoursScreen  onBack={() => { setVue('accueil'); loadStats(); }}
                                        onSelect={(id) => { setEvenementId(id); setVue('detail'); }} />;
  if (vue === 'detail')       return <DetailEvenementScreen    onBack={() => { setVue('enCours'); loadStats(); }} evenementId={evenementId} />;
  if (vue === 'historique')   return <HistoriqueSolidariteScreen onBack={() => setVue('accueil')} />;
  if (vue === 'fonds')        return <FondsSolidariteScreen    onBack={() => { setVue('accueil'); loadStats(); }} />;

  return (
    <View style={styles.container}>
      <Header title="🤝 Solidarité" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {loading ? <ActivityIndicator color="#1F7A4D" style={{ marginTop: 20 }} /> : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: '#1F7A4D' }]}>
              <Text style={styles.statCardNum}>{stats.fonds.toLocaleString()}</Text>
              <Text style={styles.statCardLabel}>Fonds{'\n'}(FCFA)</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#C55A11' }]}>
              <Text style={[styles.statCardNum, { color: stats.enCours > 0 ? '#C55A11' : '#1F3864' }]}>{stats.enCours}</Text>
              <Text style={styles.statCardLabel}>Événements{'\n'}en cours</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#2E75B6' }]}>
              <Text style={styles.statCardNum}>{stats.total}</Text>
              <Text style={styles.statCardLabel}>Total{'\n'}événements</Text>
            </View>
          </View>
        )}

        {stats.enCours > 0 && (
          <TouchableOpacity style={styles.alertBox} onPress={() => setVue('enCours')}>
            <Text style={styles.alertText}>🔔 {stats.enCours} événement(s) en cours de recouvrement → Voir</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setVue('creer')}>
          <Text style={styles.btnPrimaryText}>➕ Déclarer un événement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('enCours')}>
          <Text style={styles.btnSecondaryText}>📋 Événements en cours ({stats.enCours})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('fonds')}>
          <Text style={styles.btnSecondaryText}>💰 Gérer le fonds solidarité</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('historique')}>
          <Text style={styles.btnSecondaryText}>📜 Historique</Text>
        </TouchableOpacity>

        {/* Rappel règles */}
        <View style={styles.reglesBox}>
          <Text style={styles.reglesTitre}>📌 Règles solidarité</Text>
          {Object.values(TYPES_SOLIDARITE).map((t, i) => (
            <Text key={i} style={styles.regle}>{t.icon} {t.label} : {t.note}</Text>
          ))}
          <Text style={[styles.regle, { marginTop: 8, color: '#C00000' }]}>
            🚫 Fonds intégration maladie (25 000 FCFA) non payé → solidarité bloquée
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  CRÉER UN ÉVÉNEMENT
// ══════════════════════════════════════════════════════════════
function CreerEvenementScreen({ onBack }) {
  const [adherents, setAdherents]       = useState([]);
  const [selectedAdh, setSelectedAdh]   = useState(null);
  const [typeEvt, setTypeEvt]           = useState('maladie');
  const [isJumeaux, setIsJumeaux]       = useState(false);
  const [montantLibre, setMontantLibre] = useState('');
  const [description, setDescription]  = useState('');
  const [showPickerAdh, setShowPickerAdh]   = useState(false);
  const [showPickerType, setShowPickerType] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [loading, setLoading]           = useState(true);
  const [bloque, setBloque]             = useState(false);

  const today      = new Date().toISOString().split('T')[0];
  const dimanche   = getDimanche();
  const type       = TYPES_SOLIDARITE[typeEvt];

  useEffect(() => { loadAdherents(); }, []);

  async function loadAdherents() {
    const { data } = await supabase.from('adherents')
      .select('adherent_id, nom, prenom').in('statut', ['actif']).order('nom');
    setAdherents(data || []);
    setLoading(false);
  }

  async function selectionner(adh) {
    setSelectedAdh(adh);
    setShowPickerAdh(false);
    setBloque(false);
    // Vérifier fonds intégration maladie payé
    const { data } = await supabase.from('paiement_integration')
      .select('statut').eq('adherent_id', adh.adherent_id).eq('element', 'fonds_maladie').single()
      .catch(() => ({ data: null }));
    if (!data || data.statut !== 'solde') setBloque(true);
  }

  // Calcul montant cotisation
  const montantCotis = type.cotisation_type === 'fixe'
    ? (typeEvt === 'accouchement' && isJumeaux ? type.cotisation_montant_jumeaux : type.cotisation_montant)
    : type.cotisation_type === 'libre' ? (parseInt(montantLibre) || 0) : type.cotisation_montant;

  // Date limite recouvrement
  const dateLimite = type.delai_jours
    ? new Date(Date.now() + type.delai_jours * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null;

  async function creer() {
    if (!selectedAdh) { Alert.alert('Sélectionnez un adhérent'); return; }
    if (bloque) { Alert.alert('🚫 Bloqué', `${selectedAdh.nom} n'a pas payé son fonds intégration maladie (25 000 FCFA).`); return; }
    if (type.cotisation_type === 'libre' && !montantLibre) { Alert.alert('Saisissez un montant'); return; }

    setSaving(true);

    // Récupérer tous les adhérents actifs pour créer les cotisations
    const { data: tousAdherents } = await supabase.from('adherents')
      .select('adherent_id').eq('statut', 'actif');

    // Créer l'événement
    const { data: evt, error } = await supabase.from('evenement_solidarite').insert({
      beneficiaire_id:    selectedAdh.adherent_id,
      type_evenement:     typeEvt,
      description:        description || type.label,
      montant_cotisation: montantCotis,
      is_jumeaux:         isJumeaux,
      present_biere:      type.present_biere,
      date_annonce:       today,
      date_limite:        dateLimite,
      nb_adherents:       (tousAdherents || []).length,
      total_attendu:      montantCotis * (tousAdherents || []).length,
      statut:             type.delai_jours ? 'en_cours' : 'collecte',
    }).select().single();

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    // Créer une ligne de cotisation pour chaque adhérent
    if (type.cotisation_type !== 'libre' && montantCotis > 0) {
      const cotisations = (tousAdherents || []).map(a => ({
        evenement_id:  evt.evenement_id,
        adherent_id:   a.adherent_id,
        montant_du:    montantCotis,
        montant_paye:  0,
        statut:        'en_attente',
        est_beneficiaire: a.adherent_id === selectedAdh.adherent_id,
      }));
      await supabase.from('cotisation_solidarite').insert(cotisations);
    }

    const msg = [
      `Bénéficiaire : ${selectedAdh.nom} ${selectedAdh.prenom}`,
      `Type : ${type.label}`,
      montantCotis > 0 ? `Cotisation/adhérent : ${montantCotis.toLocaleString()} FCFA` : 'Collecte libre',
      `Total attendu : ${(montantCotis * (tousAdherents || []).length).toLocaleString()} FCFA`,
      dateLimite ? `Date limite : ${new Date(dateLimite + 'T12:00:00').toLocaleDateString('fr-FR')}` : '',
      type.present_biere ? '🎁 Présent + bière requis le jour de l\'annonce' : '',
    ].filter(Boolean).join('\n');

    Alert.alert('✅ Événement créé', msg);
    onBack();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Header title="➕ Déclarer un événement" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Text style={styles.inputLabel}>Adhérent concerné *</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPickerAdh(true)}>
          <Text style={{ color: selectedAdh ? '#333' : '#aaa' }}>
            {selectedAdh ? `${selectedAdh.nom} ${selectedAdh.prenom}` : 'Sélectionner...'}
          </Text>
        </TouchableOpacity>
        {bloque && selectedAdh && (
          <View style={styles.bloqueBox}>
            <Text style={styles.bloqueText}>🚫 {selectedAdh.nom} n'a pas payé son fonds intégration maladie — solidarité bloquée</Text>
          </View>
        )}

        <Text style={styles.inputLabel}>Type d'événement *</Text>
        <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
          onPress={() => setShowPickerType(true)}>
          <Text style={{ color: '#333' }}>{type.icon} {type.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        {/* Jumeaux si accouchement */}
        {typeEvt === 'accouchement' && (
          <TouchableOpacity style={[styles.toggleBtn, isJumeaux && styles.toggleBtnActive]}
            onPress={() => setIsJumeaux(!isJumeaux)}>
            <Text style={[styles.toggleBtnText, isJumeaux && { color: '#fff' }]}>
              👶👶 Jumeaux {isJumeaux ? '✅' : '(appuyer pour activer)'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Montant libre */}
        {type.cotisation_type === 'libre' && (
          <>
            <Text style={styles.inputLabel}>Montant suggéré (FCFA) — optionnel</Text>
            <TextInput style={styles.input} value={montantLibre} onChangeText={setMontantLibre}
              keyboardType="numeric" placeholder="Laisser vide = main levée libre" />
          </>
        )}

        <Text style={styles.inputLabel}>Description (optionnel)</Text>
        <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          value={description} onChangeText={setDescription} multiline placeholder="Précisions..." />

        {/* Récapitulatif */}
        <View style={styles.calcCard}>
          <Text style={styles.calcTitle}>📋 Récapitulatif</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Cotisation par adhérent</Text>
            <Text style={[styles.calcVal, { color: '#1F7A4D', fontWeight: 'bold' }]}>
              {montantCotis > 0 ? `${montantCotis.toLocaleString()} FCFA` : 'Libre (main levée)'}
            </Text>
          </View>
          {dateLimite && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Date limite recouvrement</Text>
              <Text style={styles.calcVal}>{new Date(dateLimite + 'T12:00:00').toLocaleDateString('fr-FR')}</Text>
            </View>
          )}
          {type.present_biere && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Présent + bière</Text>
              <Text style={[styles.calcVal, { color: '#C55A11' }]}>✅ Requis le jour de l'annonce</Text>
            </View>
          )}
          {type.obligatoire && (
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: '#888' }]}>Non-paiement</Text>
              <Text style={[styles.calcVal, { color: '#C00000', fontSize: 12 }]}>→ Dette automatique</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.btnPrimary, { opacity: saving || bloque ? 0.5 : 1 }]}
          onPress={creer} disabled={saving || bloque}>
          {saving ? <ActivityIndicator color="#fff" /> :
            <Text style={styles.btnPrimaryText}>✅ Créer l'événement</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker adhérent */}
      <Modal visible={showPickerAdh} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choisir un adhérent</Text>
            {loading ? <ActivityIndicator color="#1F7A4D" /> :
              <FlatList data={adherents} keyExtractor={a => a.adherent_id} style={{ maxHeight: 420 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.modalItem, selectedAdh?.adherent_id === item.adherent_id && styles.modalItemActive]}
                    onPress={() => selectionner(item)}>
                    <Text style={[styles.modalItemText, selectedAdh?.adherent_id === item.adherent_id && { color: '#fff' }]}>
                      {item.nom} {item.prenom}
                    </Text>
                  </TouchableOpacity>
                )} />
            }
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPickerAdh(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Picker type événement */}
      <Modal visible={showPickerType} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Type d'événement</Text>
            <FlatList data={Object.entries(TYPES_SOLIDARITE)} keyExtractor={([k]) => k} style={{ maxHeight: 450 }}
              renderItem={({ item: [key, val] }) => (
                <TouchableOpacity
                  style={[styles.modalItem, typeEvt === key && styles.modalItemActive]}
                  onPress={() => { setTypeEvt(key); setShowPickerType(false); }}>
                  <Text style={[styles.modalItemText, typeEvt === key && { color: '#fff' }]}>{val.icon} {val.label}</Text>
                  <Text style={{ fontSize: 11, color: typeEvt === key ? '#ddd' : '#888', marginTop: 2 }}>{val.note}</Text>
                </TouchableOpacity>
              )} />
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
//  ÉVÉNEMENTS EN COURS
// ══════════════════════════════════════════════════════════════
function EvenementsEnCoursScreen({ onBack, onSelect }) {
  const [evenements, setEvenements] = useState([]);
  const [loading, setLoading]       = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('evenement_solidarite')
      .select('*, adherents!beneficiaire_id(nom, prenom)')
      .eq('statut', 'en_cours')
      .order('date_annonce', { ascending: false });
    setEvenements(data || []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📋 Événements en cours" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#1F7A4D" style={{ marginTop: 40 }} /> :
        <FlatList data={evenements} keyExtractor={e => e.evenement_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const type     = TYPES_SOLIDARITE[item.type_evenement] || TYPES_SOLIDARITE.autre;
            const enRetard = item.date_limite && item.date_limite < today;
            const pct      = item.total_attendu > 0
              ? Math.round(((item.total_collecte || 0) / item.total_attendu) * 100) : 0;
            return (
              <TouchableOpacity style={[styles.evtCard, enRetard && styles.evtCardRetard]}
                onPress={() => onSelect(item.evenement_id)}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 20 }}>{type.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evtNom}>{item.adherents?.nom} {item.adherents?.prenom}</Text>
                      <Text style={styles.evtType}>{type.label}</Text>
                    </View>
                    {enRetard && <Text style={styles.retardBadge}>⏰ Retard</Text>}
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: type.color }]} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: '#888' }}>
                      {(item.total_collecte || 0).toLocaleString()} / {(item.total_attendu || 0).toLocaleString()} FCFA ({pct}%)
                    </Text>
                    {item.date_limite && (
                      <Text style={{ fontSize: 12, color: enRetard ? '#C00000' : '#888' }}>
                        Limite : {new Date(item.date_limite + 'T12:00:00').toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={{ fontSize: 18, marginLeft: 10, color: '#888' }}>›</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun événement en cours.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  DÉTAIL ÉVÉNEMENT — saisir cotisations adhérent par adhérent
// ══════════════════════════════════════════════════════════════
function DetailEvenementScreen({ onBack, evenementId }) {
  const [evt, setEvt]             = useState(null);
  const [cotisations, setCotisations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);
  const [showPaie, setShowPaie]   = useState(null);
  const [montantSaisie, setMontantSaisie] = useState('');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('evenement_solidarite')
        .select('*, adherents!beneficiaire_id(nom, prenom)').eq('evenement_id', evenementId).single(),
      supabase.from('cotisation_solidarite')
        .select('*, adherents(nom, prenom)').eq('evenement_id', evenementId)
        .order('statut').order('est_beneficiaire', { ascending: false }),
    ]);
    setEvt(e);
    setCotisations(c || []);
    setLoading(false);
  }

  async function enregistrerPaiement(cotis, montant) {
    const m = parseInt(montant);
    if (!m || m <= 0) { Alert.alert('Montant invalide'); return; }
    setSaving(cotis.cotisation_solidarite_id);

    const nouveau = cotis.montant_paye + m;
    const solde   = nouveau >= cotis.montant_du;

    await supabase.from('cotisation_solidarite').update({
      montant_paye: nouveau,
      statut:       solde ? 'paye' : 'partiel',
      date_paiement: today,
    }).eq('cotisation_solidarite_id', cotis.cotisation_solidarite_id);
    // Caisse automatique
    await caisseSolidarite.cotisation(m, evenementId, cotis.adherent_id);

    // Si non payé → créer dette
    if (!solde && cotis.statut === 'en_attente') {
      const reste = cotis.montant_du - nouveau;
      await supabase.from('dettes').insert({
        adherent_id:       cotis.adherent_id,
        type_dette:        'non_paiement_solidarite',
        montant:           reste,
        montant_initial:   cotis.montant_du,
        montant_rembourse: 0,
        montant_restant:   reste,
        description:       `Cotisation solidarité ${TYPES_SOLIDARITE[evt.type_evenement]?.label || ''} — ${evt.adherents?.nom}`,
        date_creation:     today,
        statut:            'en_cours',
        ref_id:            evenementId,
      });
    }

    // Mettre à jour total collecté sur l'événement
    const { data: tous } = await supabase.from('cotisation_solidarite')
      .select('montant_paye').eq('evenement_id', evenementId);
    const totalCollecte = (tous || []).reduce((s, c) => s + c.montant_paye, 0);
    const nbPayes = (tous || []).filter(c => c.statut === 'paye').length;
    const toutPaye = nbPayes >= evt.nb_adherents;
    await supabase.from('evenement_solidarite').update({
      total_collecte: totalCollecte,
      statut: toutPaye ? 'cloture' : 'en_cours',
    }).eq('evenement_id', evenementId);

    setShowPaie(null);
    load();
    setSaving(null);
  }

  async function sanctionnerNonPaiement(cotis) {
    Alert.alert('⚠️ Sanctionner non-paiement',
      `${cotis.adherents.nom} ${cotis.adherents.prenom}\nDette : ${cotis.montant_du.toLocaleString()} FCFA`,
      [{ text: 'Annuler', style: 'cancel' },
       { text: 'Créer dette', style: 'destructive', onPress: async () => {
          await supabase.from('dettes').insert({
            adherent_id:       cotis.adherent_id,
            type_dette:        'non_paiement_solidarite',
            montant:           cotis.montant_du - cotis.montant_paye,
            montant_initial:   cotis.montant_du,
            montant_rembourse: 0,
            montant_restant:   cotis.montant_du - cotis.montant_paye,
            description:       `Cotisation solidarité non payée — ${TYPES_SOLIDARITE[evt?.type_evenement]?.label}`,
            date_creation:     today,
            statut:            'en_cours',
          });
          await supabase.from('cotisation_solidarite').update({ statut: 'dette' })
            .eq('cotisation_solidarite_id', cotis.cotisation_solidarite_id);
          load();
        }}
      ]);
  }

  if (loading || !evt) return <View style={styles.container}><Header title="Détail" onBack={onBack} /><ActivityIndicator size="large" color="#1F7A4D" style={{ marginTop: 40 }} /></View>;

  const type        = TYPES_SOLIDARITE[evt.type_evenement] || TYPES_SOLIDARITE.autre;
  const pct         = evt.total_attendu > 0 ? Math.round(((evt.total_collecte || 0) / evt.total_attendu) * 100) : 0;
  const nbPayes     = cotisations.filter(c => c.statut === 'paye').length;
  const nbEnAttente = cotisations.filter(c => c.statut === 'en_attente').length;

  return (
    <View style={styles.container}>
      <Header title={`${type.icon} ${evt.adherents?.nom}`} onBack={onBack} />

      {/* Résumé événement */}
      <View style={styles.evtResume}>
        <Text style={styles.evtResumeType}>{type.label}</Text>
        <Text style={styles.evtResumeDate}>Annoncé le {new Date(evt.date_annonce + 'T12:00:00').toLocaleDateString('fr-FR')}</Text>
        {type.present_biere && <Text style={{ fontSize: 13, color: '#C55A11', marginTop: 4 }}>🎁 Présent + bière requis le jour de l'annonce</Text>}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: type.color }]} />
        </View>
        <Text style={{ fontSize: 13, color: '#555', marginTop: 6 }}>
          {(evt.total_collecte || 0).toLocaleString()} / {(evt.total_attendu || 0).toLocaleString()} FCFA ({pct}%)
          {'  ·  '}{nbPayes} payés · {nbEnAttente} en attente
        </Text>
      </View>

      <FlatList data={cotisations} keyExtractor={c => c.cotisation_solidarite_id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const paye   = item.statut === 'paye';
          const dette  = item.statut === 'dette';
          const partiel = item.statut === 'partiel';
          return (
            <View style={[styles.cotisCard,
              paye   ? styles.cotisCardPaye :
              dette  ? styles.cotisCardDette :
              partiel ? styles.cotisCardPartiel :
              styles.cotisCardAttente]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cotisNom}>
                  {item.est_beneficiaire ? '⭐ ' : ''}{item.adherents?.nom} {item.adherents?.prenom}
                </Text>
                <Text style={styles.cotisSub}>
                  Payé : {item.montant_paye.toLocaleString()} / {item.montant_du.toLocaleString()} FCFA
                </Text>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 20 }}>{paye ? '✅' : dette ? '🚫' : partiel ? '⏳' : '❌'}</Text>
                {!paye && !dette && (
                  <TouchableOpacity style={styles.btnPayerSmall}
                    onPress={() => { setShowPaie(item); setMontantSaisie(String(item.montant_du - item.montant_paye)); }}>
                    <Text style={styles.btnPayerSmallText}>💰</Text>
                  </TouchableOpacity>
                )}
                {!paye && !dette && item.statut === 'en_attente' && (
                  <TouchableOpacity style={styles.btnDetteSmall} onPress={() => sanctionnerNonPaiement(item)}>
                    <Text style={styles.btnDetteSmallText}>⚠️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Modal paiement */}
      <Modal visible={!!showPaie} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>💰 Paiement solidarité</Text>
            {showPaie && <Text style={{ color: '#555', marginBottom: 4 }}>{showPaie.adherents?.nom} {showPaie.adherents?.prenom}</Text>}
            {showPaie && <Text style={{ color: '#888', marginBottom: 16 }}>
              Reste : {(showPaie.montant_du - showPaie.montant_paye).toLocaleString()} FCFA
            </Text>}
            <Text style={styles.inputLabel}>Montant payé (FCFA)</Text>
            <TextInput style={styles.input} value={montantSaisie} onChangeText={setMontantSaisie}
              keyboardType="numeric" placeholder="Montant" />
            <View style={styles.demandeBtns}>
              <TouchableOpacity style={styles.btnApprouver}
                onPress={() => enregistrerPaiement(showPaie, montantSaisie)}>
                <Text style={styles.btnApprouverText}>✅ Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnRejeter} onPress={() => setShowPaie(null)}>
                <Text style={styles.btnRejeterText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  FONDS SOLIDARITÉ
// ══════════════════════════════════════════════════════════════
function FondsSolidariteScreen({ onBack }) {
  const [fonds, setFonds]       = useState(0);
  const [fondsId, setFondsId]   = useState(null);
  const [montant, setMontant]   = useState('');
  const [typeOp, setTypeOp]     = useState('depot');
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [mouvements, setMouvements] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: f }, { data: m }] = await Promise.all([
      supabase.from('fonds_solidarite').select('solde, fonds_id').single(),
      supabase.from('mouvement_fonds_solidarite').select('*').order('date_mouvement', { ascending: false }).limit(20),
    ]);
    setFonds(f?.solde || 0);
    setFondsId(f?.fonds_id);
    setMouvements(m || []);
    setLoading(false);
  }

  async function enregistrer() {
    const m = parseInt(montant);
    if (!m || m <= 0) { Alert.alert('Montant invalide'); return; }
    setSaving(true);
    const today  = new Date().toISOString().split('T')[0];
    const delta  = typeOp === 'depot' ? m : -m;
    const newSolde = fonds + delta;
    if (newSolde < 0) { Alert.alert('Solde insuffisant'); setSaving(false); return; }
    await supabase.from('fonds_solidarite').update({ solde: newSolde }).eq('fonds_id', fondsId);
    await supabase.from('mouvement_fonds_solidarite').insert({
      type_mouvement: typeOp, montant: delta, date_mouvement: today,
      description: typeOp === 'depot' ? `Dépôt fonds solidarité` : `Retrait fonds solidarité`,
    });
    setMontant('');
    load();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Header title="💰 Fonds solidarité" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.fondsBand}>
          <Text style={styles.fondsBandText}>Solde : {fonds.toLocaleString()} FCFA</Text>
        </View>

        <Text style={styles.inputLabel}>Opération</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TouchableOpacity style={[styles.toggleBtn, typeOp === 'depot' && styles.toggleBtnActive]}
            onPress={() => setTypeOp('depot')}>
            <Text style={[styles.toggleBtnText, typeOp === 'depot' && { color: '#fff' }]}>+ Dépôt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, typeOp === 'retrait' && styles.toggleBtnActive]}
            onPress={() => setTypeOp('retrait')}>
            <Text style={[styles.toggleBtnText, typeOp === 'retrait' && { color: '#fff' }]}>− Retrait</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>Montant (FCFA)</Text>
        <TextInput style={styles.input} value={montant} onChangeText={setMontant}
          keyboardType="numeric" placeholder="Ex: 50000" />

        <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1 }]}
          onPress={enregistrer} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> :
            <Text style={styles.btnPrimaryText}>💾 Enregistrer</Text>}
        </TouchableOpacity>

        <Text style={[styles.inputLabel, { marginTop: 20 }]}>Derniers mouvements</Text>
        {loading ? <ActivityIndicator color="#1F7A4D" /> :
          mouvements.map(m => (
            <View key={m.mouvement_id} style={styles.historiqueCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adherentNom}>{m.description}</Text>
                <Text style={styles.adherentSub}>{new Date(m.date_mouvement + 'T12:00:00').toLocaleDateString('fr-FR')}</Text>
              </View>
              <Text style={[styles.adherentTotal, { color: m.montant > 0 ? '#1E7E34' : '#C00000' }]}>
                {m.montant > 0 ? '+' : ''}{m.montant.toLocaleString()} FCFA
              </Text>
            </View>
          ))
        }
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE
// ══════════════════════════════════════════════════════════════
function HistoriqueSolidariteScreen({ onBack }) {
  const [evts, setEvts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('evenement_solidarite')
      .select('*, adherents!beneficiaire_id(nom, prenom)')
      .in('statut', ['cloture']).order('date_annonce', { ascending: false });
    setEvts(data || []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📜 Historique solidarité" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#1F7A4D" style={{ marginTop: 40 }} /> :
        <FlatList data={evts} keyExtractor={e => e.evenement_id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const type = TYPES_SOLIDARITE[item.type_evenement] || TYPES_SOLIDARITE.autre;
            return (
              <View style={styles.historiqueCard}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>{type.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adherentNom}>{item.adherents?.nom} {item.adherents?.prenom}</Text>
                  <Text style={styles.adherentSub}>{type.label}</Text>
                  <Text style={{ fontSize: 12, color: '#888' }}>
                    {new Date(item.date_annonce + 'T12:00:00').toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <Text style={[styles.adherentTotal, { color: '#1F7A4D' }]}>
                  {(item.total_collecte || 0).toLocaleString()}{'\n'}
                  <Text style={{ fontSize: 11, color: '#888' }}>FCFA</Text>
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun événement clôturé.</Text>}
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
  header:             { backgroundColor: '#1F7A4D', padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:            { color: '#B2DFDB', fontSize: 14 },
  statsRow:           { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:           { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderTopWidth: 4 },
  statCardNum:        { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  statCardLabel:      { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  alertBox:           { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#1F7A4D' },
  alertText:          { color: '#1F7A4D', fontWeight: 'bold', fontSize: 13 },
  btnPrimary:         { backgroundColor: '#1F7A4D', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:     { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary:       { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText:   { color: '#1F3864', fontSize: 15, fontWeight: '600' },
  reglesBox:          { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, marginTop: 4, borderLeftWidth: 4, borderLeftColor: '#1F7A4D' },
  reglesTitre:        { fontSize: 13, fontWeight: 'bold', color: '#1F7A4D', marginBottom: 8 },
  regle:              { fontSize: 12, color: '#555', marginBottom: 5 },
  inputLabel:         { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 4 },
  bloqueBox:          { backgroundColor: '#FFEBEE', borderRadius: 8, padding: 10, marginTop: 4, borderLeftWidth: 3, borderLeftColor: '#C00000' },
  bloqueText:         { color: '#C00000', fontSize: 13 },
  toggleBtn:          { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: '#D6E4F0' },
  toggleBtnActive:    { backgroundColor: '#1F7A4D', borderColor: '#1F7A4D' },
  toggleBtnText:      { fontSize: 14, fontWeight: '600', color: '#1F3864' },
  calcCard:           { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 10, elevation: 2 },
  calcTitle:          { fontSize: 14, fontWeight: 'bold', color: '#1F7A4D', marginBottom: 10 },
  calcRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  calcLabel:          { color: '#666', fontSize: 14, flex: 1 },
  calcVal:            { fontSize: 14, fontWeight: '600', color: '#333' },
  fondsBand:          { backgroundColor: '#E8F5E9', padding: 12, alignItems: 'center', marginBottom: 4 },
  fondsBandText:      { fontSize: 16, fontWeight: 'bold', color: '#1F7A4D' },
  evtCard:            { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  evtCardRetard:      { borderLeftWidth: 4, borderLeftColor: '#C00000' },
  evtNom:             { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  evtType:            { fontSize: 12, color: '#888', marginTop: 1 },
  evtResume:          { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  evtResumeType:      { fontSize: 16, fontWeight: 'bold', color: '#1F3864' },
  evtResumeDate:      { fontSize: 12, color: '#888', marginTop: 2 },
  retardBadge:        { backgroundColor: '#FFEBEE', color: '#C00000', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  cotisCard:          { borderRadius: 12, padding: 14, marginBottom: 6, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  cotisCardPaye:      { backgroundColor: '#E8F5E9', borderLeftWidth: 3, borderLeftColor: '#1E7E34' },
  cotisCardAttente:   { backgroundColor: '#FFF8E1', borderLeftWidth: 3, borderLeftColor: '#C55A11' },
  cotisCardPartiel:   { backgroundColor: '#FFF3E0', borderLeftWidth: 3, borderLeftColor: '#FF9800' },
  cotisCardDette:     { backgroundColor: '#FFEBEE', borderLeftWidth: 3, borderLeftColor: '#C00000' },
  cotisNom:           { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  cotisSub:           { fontSize: 12, color: '#888', marginTop: 2 },
  btnPayerSmall:      { backgroundColor: '#E8F5E9', borderRadius: 6, padding: 6, borderWidth: 1, borderColor: '#1E7E34' },
  btnPayerSmallText:  { fontSize: 16 },
  btnDetteSmall:      { backgroundColor: '#FFF3E0', borderRadius: 6, padding: 6, borderWidth: 1, borderColor: '#C55A11' },
  btnDetteSmallText:  { fontSize: 16 },
  progressBar:        { height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill:       { height: '100%', borderRadius: 3 },
  historiqueCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  adherentNom:        { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  adherentSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  adherentTotal:      { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  demandeBtns:        { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnApprouver:       { flex: 1, backgroundColor: '#1E7E34', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnApprouverText:   { color: '#fff', fontWeight: 'bold' },
  btnRejeter:         { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C00000' },
  btnRejeterText:     { color: '#C00000', fontWeight: 'bold' },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle:         { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 12 },
  modalItem:          { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8' },
  modalItemActive:    { backgroundColor: '#1F7A4D' },
  modalItemText:      { fontSize: 15, color: '#333' },
  modalClose:         { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText:     { color: '#666', fontWeight: 'bold' },
  empty:              { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});