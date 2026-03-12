import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { caisseVoirBebe } from '../lib/caisse';

// ── Constantes ────────────────────────────────────────────────
const COTIS_SIMPLE  = 2000;  // FCFA par adhérent
const COTIS_JUMEAUX = 3000;  // FCFA par adhérent si jumeaux
const DELAI_JOURS   = 30;    // 1 mois de recouvrement

// Éléments obligatoires du fonds intégration qui bloquent le voir bébé
const ELEMENTS_BLOCAGE = ['fond_caisse', 'fonds_maladie', 'chaise', 'couverts'];

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
export default function VoirBebeScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [vue, setVue]           = useState('accueil');
  const [accouchementId, setId] = useState(null);
  const [stats, setStats]       = useState({ demandes: 0, enCours: 0, total: 0 });
  const [loading, setLoading]   = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    const { data } = await supabase.from('accouchement').select('statut');
    setStats({
      demandes: (data || []).filter(a => a.statut === 'demande').length,
      enCours:  (data || []).filter(a => a.statut === 'en_cours').length,
      total:    (data || []).length,
    });
    setLoading(false);
  }

  if (vue === 'annoncer')   return <AnnonceBebeScreen        onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'approuver')  return <ApprouverBebeScreen      onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'enCours')    return <CollectesEnCoursScreen   onBack={() => { setVue('accueil'); loadStats(); }}
                                      onSelect={id => { setId(id); setVue('detail'); }} />;
  if (vue === 'detail')     return <DetailCollecteScreen     onBack={() => { setVue('enCours'); loadStats(); }} accouchementId={accouchementId} />;
  if (vue === 'historique') return <HistoriqueBebeScreen     onBack={() => setVue('accueil')} />;

  return (
    <View style={styles.container}>
      <Header title="👶 Voir Bébé" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {loading ? <ActivityIndicator color="#E91E8C" style={{ marginTop: 20 }} /> : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: '#C55A11' }]}>
              <Text style={[styles.statCardNum, { color: stats.demandes > 0 ? '#C55A11' : '#1F3864' }]}>{stats.demandes}</Text>
              <Text style={styles.statCardLabel}>Annonces{'\n'}en attente</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#E91E8C' }]}>
              <Text style={styles.statCardNum}>{stats.enCours}</Text>
              <Text style={styles.statCardLabel}>Collectes{'\n'}en cours</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#1E7E34' }]}>
              <Text style={styles.statCardNum}>{stats.total}</Text>
              <Text style={styles.statCardLabel}>Total{'\n'}déclarés</Text>
            </View>
          </View>
        )}

        {stats.demandes > 0 && (
          <TouchableOpacity style={styles.alertBox} onPress={() => setVue('approuver')}>
            <Text style={styles.alertText}>🔔 {stats.demandes} annonce(s) en attente d'approbation → Traiter</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setVue('annoncer')}>
          <Text style={styles.btnPrimaryText}>👶 Annoncer un accouchement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('approuver')}>
          <Text style={styles.btnSecondaryText}>
            ✅ Approuver les annonces{stats.demandes > 0 ? ` (${stats.demandes})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('enCours')}>
          <Text style={styles.btnSecondaryText}>📋 Collectes en cours ({stats.enCours})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('historique')}>
          <Text style={styles.btnSecondaryText}>📜 Historique</Text>
        </TouchableOpacity>

        <View style={styles.reglesBox}>
          <Text style={styles.reglesTitre}>📌 Règles Voir Bébé</Text>
          <Text style={styles.regle}>• L'adhérent(e) annonce → le système vérifie → bureau approuve ou rejette</Text>
          <Text style={styles.regle}>• Si non en règle → annonce bloquée sur place, rien transmis au bureau</Text>
          <Text style={styles.regle}>• Simple : {COTIS_SIMPLE.toLocaleString()} FCFA · Jumeaux : {COTIS_JUMEAUX.toLocaleString()} FCFA — par adhérent</Text>
          <Text style={styles.regle}>• Recouvrement sous 1 mois · non-paiement = dette automatique</Text>
          <Text style={styles.regle}>• La bénéficiaire cotise aussi comme tous les autres adhérents</Text>
          <Text style={styles.regle}>• 🚫 Fonds intégration obligatoire non soldé → bloqué</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  ANNONCER — vérification AVANT soumission
//  Si non en règle → bloqué sur place, rien n'est créé
// ══════════════════════════════════════════════════════════════
function AnnonceBebeScreen({ onBack }) {
  const [adherents, setAdherents]       = useState([]);
  const [selectedAdh, setSelectedAdh]   = useState(null);
  const [isJumeaux, setIsJumeaux]       = useState(false);
  const [description, setDescription]  = useState('');
  const [showPicker, setShowPicker]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [verification, setVerification] = useState(null); // null | { ok, motifs[] }

  const cotisation = isJumeaux ? COTIS_JUMEAUX : COTIS_SIMPLE;

  useEffect(() => { loadAdherents(); }, []);

  async function loadAdherents() {
    const { data } = await supabase.from('adherents')
      .select('adherent_id, nom, prenom').eq('statut', 'actif').order('nom');
    setAdherents(data || []);
    setLoading(false);
  }

  async function selectionner(adh) {
    setSelectedAdh(adh);
    setShowPicker(false);
    setVerification(null);

    const motifs = [];

    // 1. Tous les éléments obligatoires du fonds intégration soldés ?
    const { data: paiements } = await supabase.from('paiement_integration')
      .select('element, statut').eq('adherent_id', adh.adherent_id)
      .in('element', ELEMENTS_BLOCAGE);

    const payes = (paiements || []).filter(p => p.statut === 'solde').map(p => p.element);
    const manquants = ELEMENTS_BLOCAGE.filter(e => !payes.includes(e));

    const LABELS = {
      fond_caisse:   'Fond de caisse (20 000 FCFA)',
      fonds_maladie: 'Fonds maladie/malheur (25 000 FCFA)',
      chaise:        'Chaise (5 000 FCFA)',
      couverts:      'Couverts (10 000 FCFA)',
    };
    manquants.forEach(e => motifs.push(`${LABELS[e]} non soldé`));

    // 2. Déjà une collecte active ?
    const { data: dejaActif } = await supabase.from('accouchement')
      .select('accouchement_id').eq('beneficiaire_id', adh.adherent_id)
      .in('statut', ['demande', 'en_cours']).limit(1);
    if ((dejaActif || []).length > 0) {
      motifs.push('Une annonce ou collecte est déjà en cours');
    }

    setVerification({ ok: motifs.length === 0, motifs });
  }

  async function soumettre() {
    if (!selectedAdh || !verification?.ok) return;
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('accouchement').insert({
      beneficiaire_id:    selectedAdh.adherent_id,
      is_jumeaux:         isJumeaux,
      description:        description || (isJumeaux ? 'Naissance de jumeaux' : 'Accouchement'),
      cotisation_par_adh: cotisation,
      date_annonce:       today,
      statut:             'demande',
    });

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    Alert.alert('✅ Annonce soumise au bureau',
      `${selectedAdh.nom} ${selectedAdh.prenom}\n` +
      `${isJumeaux ? '👶👶 Jumeaux' : '👶 Simple'} · ${cotisation.toLocaleString()} FCFA/adhérent\n\n` +
      `En attente de décision du bureau.`);
    onBack();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Header title="👶 Annoncer un accouchement" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Text style={styles.inputLabel}>Adhérent(e) concerné(e) *</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={{ color: selectedAdh ? '#333' : '#aaa' }}>
            {selectedAdh ? `${selectedAdh.nom} ${selectedAdh.prenom}` : 'Sélectionner...'}
          </Text>
        </TouchableOpacity>

        {/* Résultat vérification */}
        {verification && !verification.ok && (
          <View style={styles.bloqueBox}>
            <Text style={styles.bloqueTitle}>🚫 Annonce impossible — adhérent(e) non en règle</Text>
            {verification.motifs.map((m, i) => (
              <Text key={i} style={styles.bloqueText}>• {m}</Text>
            ))}
            <Text style={styles.bloqueNote}>L'annonce n'a pas été transmise au bureau.</Text>
          </View>
        )}

        {verification?.ok && (
          <View style={styles.enRegleBox}>
            <Text style={styles.enRegleText}>✅ {selectedAdh?.nom} est en règle — annonce autorisée</Text>
          </View>
        )}

        {/* Formulaire visible seulement si en règle */}
        {verification?.ok && (
          <>
            <Text style={styles.inputLabel}>Type d'accouchement</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.typeBtn, !isJumeaux && styles.typeBtnActive]}
                onPress={() => setIsJumeaux(false)}>
                <Text style={styles.typeBtnIcon}>👶</Text>
                <Text style={[styles.typeBtnLabel, !isJumeaux && { color: '#fff' }]}>Simple</Text>
                <Text style={[styles.typeBtnMontant, !isJumeaux && { color: '#ffe0f0' }]}>{COTIS_SIMPLE.toLocaleString()} FCFA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, isJumeaux && styles.typeBtnActive]}
                onPress={() => setIsJumeaux(true)}>
                <Text style={styles.typeBtnIcon}>👶👶</Text>
                <Text style={[styles.typeBtnLabel, isJumeaux && { color: '#fff' }]}>Jumeaux</Text>
                <Text style={[styles.typeBtnMontant, isJumeaux && { color: '#ffe0f0' }]}>{COTIS_JUMEAUX.toLocaleString()} FCFA</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Note (optionnel)</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={description} onChangeText={setDescription} multiline placeholder="Précisions..." />

            <View style={styles.calcCard}>
              <Text style={styles.calcTitle}>📋 Récapitulatif</Text>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Cotisation/adhérent</Text>
                <Text style={[styles.calcVal, { color: '#E91E8C', fontWeight: 'bold' }]}>{cotisation.toLocaleString()} FCFA</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Délai de recouvrement</Text>
                <Text style={styles.calcVal}>1 mois après approbation</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: '#888' }]}>Non-paiement</Text>
                <Text style={[styles.calcVal, { color: '#C00000', fontSize: 12 }]}>→ Dette automatique</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1 }]}
              onPress={soumettre} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.btnPrimaryText}>📤 Soumettre l'annonce au bureau</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choisir un(e) adhérent(e)</Text>
            {loading ? <ActivityIndicator color="#E91E8C" /> :
              <FlatList data={adherents} keyExtractor={a => a.adherent_id} style={{ maxHeight: 420 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.modalItem, selectedAdh?.adherent_id === item.adherent_id && styles.modalItemActive]}
                    onPress={() => selectionner(item)}>
                    <Text style={[styles.modalItemText, selectedAdh?.adherent_id === item.adherent_id && { color: '#fff' }]}>
                      {item.nom} {item.prenom}
                    </Text>
                  </TouchableOpacity>
                )} />
            }
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPicker(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  APPROUVER LES ANNONCES (bureau)
// ══════════════════════════════════════════════════════════════
function ApprouverBebeScreen({ onBack }) {
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('accouchement')
      .select('*, adherents!beneficiaire_id(nom, prenom)')
      .eq('statut', 'demande').order('date_annonce', { ascending: true });
    setDemandes(data || []);
    setLoading(false);
  }

  async function approuver(acc) {
    setSaving(acc.accouchement_id);
    const today      = new Date().toISOString().split('T')[0];
    const dateLimite = new Date(Date.now() + DELAI_JOURS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: tousAdherents } = await supabase.from('adherents')
      .select('adherent_id').eq('statut', 'actif');
    const nb = (tousAdherents || []).length;

    await supabase.from('accouchement').update({
      statut:           'en_cours',
      date_approbation: today,
      date_limite:      dateLimite,
      nb_adherents:     nb,
      total_attendu:    acc.cotisation_par_adh * nb,
      total_collecte:   0,
    }).eq('accouchement_id', acc.accouchement_id);

    const cotisations = (tousAdherents || []).map(a => ({
      accouchement_id:  acc.accouchement_id,
      adherent_id:      a.adherent_id,
      montant_du:       acc.cotisation_par_adh,
      montant_paye:     0,
      statut:           'en_attente',
      est_beneficiaire: a.adherent_id === acc.beneficiaire_id,
    }));
    await supabase.from('cotisation_voir_bebe').insert(cotisations);
    // Caisse automatique — toutes les cotisations seront payées individuellement
    // On enregistre ici le total attendu comme entrée prévisionnelle
    const totalAttendu = acc.cotisation_par_adh * nb;
    if (totalAttendu > 0) await caisseVoirBebe.cotisation(totalAttendu, acc.accouchement_id, acc.beneficiaire_id);

    Alert.alert('✅ Annonce approuvée',
      `${acc.adherents.nom} ${acc.adherents.prenom}\n` +
      `${acc.is_jumeaux ? '👶👶 Jumeaux' : '👶 Simple'}\n` +
      `${acc.cotisation_par_adh.toLocaleString()} FCFA × ${nb} adhérents = ${(acc.cotisation_par_adh * nb).toLocaleString()} FCFA\n` +
      `Date limite : ${new Date(dateLimite + 'T12:00:00').toLocaleDateString('fr-FR')}`);
    load();
    setSaving(null);
  }

  async function rejeter(acc) {
    Alert.alert('Rejeter l\'annonce ?',
      `${acc.adherents.nom} ${acc.adherents.prenom}\nCette annonce sera définitivement rejetée.`,
      [{ text: 'Annuler', style: 'cancel' },
       { text: 'Rejeter', style: 'destructive', onPress: async () => {
          await supabase.from('accouchement').update({ statut: 'rejete' })
            .eq('accouchement_id', acc.accouchement_id);
          load();
        }}
      ]);
  }

  return (
    <View style={styles.container}>
      <Header title="✅ Approuver les annonces" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#E91E8C" style={{ marginTop: 40 }} /> :
        <FlatList data={demandes} keyExtractor={a => a.accouchement_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.demandeCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Text style={{ fontSize: 28 }}>{item.is_jumeaux ? '👶👶' : '👶'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demandeNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                  <Text style={styles.demandeSub}>
                    Annoncé le {new Date(item.date_annonce + 'T12:00:00').toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <View style={[styles.typeChip, { backgroundColor: item.is_jumeaux ? '#F3E8FF' : '#FFF0F5' }]}>
                  <Text style={{ color: item.is_jumeaux ? '#7030A0' : '#E91E8C', fontWeight: 'bold', fontSize: 12 }}>
                    {item.is_jumeaux ? 'Jumeaux' : 'Simple'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
                Cotisation : <Text style={{ fontWeight: 'bold', color: '#E91E8C' }}>{item.cotisation_par_adh.toLocaleString()} FCFA</Text> / adhérent
              </Text>
              {item.description ? <Text style={styles.detteDesc}>{item.description}</Text> : null}
              <View style={styles.demandeBtns}>
                <TouchableOpacity
                  style={[styles.btnApprouver, { opacity: saving === item.accouchement_id ? 0.5 : 1 }]}
                  onPress={() => approuver(item)} disabled={!!saving}>
                  {saving === item.accouchement_id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnApprouverText}>✅ Approuver</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnRejeter} onPress={() => rejeter(item)}>
                  <Text style={styles.btnRejeterText}>✕ Rejeter</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucune annonce en attente.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  COLLECTES EN COURS
// ══════════════════════════════════════════════════════════════
function CollectesEnCoursScreen({ onBack, onSelect }) {
  const [collectes, setCollectes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('accouchement')
      .select('*, adherents!beneficiaire_id(nom, prenom)')
      .eq('statut', 'en_cours')
      .order('date_approbation', { ascending: false });
    setCollectes(data || []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📋 Collectes en cours" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#E91E8C" style={{ marginTop: 40 }} /> :
        <FlatList data={collectes} keyExtractor={c => c.accouchement_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const pct      = item.total_attendu > 0 ? Math.round(((item.total_collecte || 0) / item.total_attendu) * 100) : 0;
            const enRetard = item.date_limite && item.date_limite < today;
            return (
              <TouchableOpacity style={[styles.collecteCard, enRetard && styles.collecteCardRetard]}
                onPress={() => onSelect(item.accouchement_id)}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 22 }}>{item.is_jumeaux ? '👶👶' : '👶'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.demandeNom}>{item.adherents?.nom} {item.adherents?.prenom}</Text>
                      <Text style={styles.demandeSub}>
                        {item.is_jumeaux ? 'Jumeaux' : 'Simple'} · approuvé le {item.date_approbation
                          ? new Date(item.date_approbation + 'T12:00:00').toLocaleDateString('fr-FR') : '—'}
                      </Text>
                    </View>
                    {enRetard && <View style={styles.retardBadge}><Text style={styles.retardText}>⏰ Retard</Text></View>}
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: '#E91E8C' }]} />
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
          ListEmptyComponent={<Text style={styles.empty}>Aucune collecte en cours.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  DÉTAIL COLLECTE — paiement adhérent par adhérent
// ══════════════════════════════════════════════════════════════
function DetailCollecteScreen({ onBack, accouchementId }) {
  const [acc, setAcc]             = useState(null);
  const [cotisations, setCotis]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showPaie, setShowPaie]   = useState(null);
  const [montantSaisie, setMontantSaisie] = useState('');
  const [saving, setSaving]       = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from('accouchement')
        .select('*, adherents!beneficiaire_id(nom, prenom)')
        .eq('accouchement_id', accouchementId).single(),
      supabase.from('cotisation_voir_bebe')
        .select('*, adherents(nom, prenom)')
        .eq('accouchement_id', accouchementId)
        .order('est_beneficiaire', { ascending: false })
        .order('statut'),
    ]);
    setAcc(a);
    setCotis(c || []);
    setLoading(false);
  }

  async function enregistrerPaiement(cotis, montant) {
    const m = parseInt(montant);
    if (!m || m <= 0) { Alert.alert('Montant invalide'); return; }
    const reste = cotis.montant_du - cotis.montant_paye;
    if (m > reste) { Alert.alert('Montant supérieur au reste dû'); return; }
    setSaving(true);

    const nouveauPaye = cotis.montant_paye + m;
    const solde       = nouveauPaye >= cotis.montant_du;

    await supabase.from('cotisation_voir_bebe').update({
      montant_paye:  nouveauPaye,
      statut:        solde ? 'paye' : 'partiel',
      date_paiement: today,
    }).eq('cotisation_voir_bebe_id', cotis.cotisation_voir_bebe_id);

    // Mettre à jour total collecté
    const { data: tous } = await supabase.from('cotisation_voir_bebe')
      .select('montant_paye').eq('accouchement_id', accouchementId);
    const totalCollecte = (tous || []).reduce((s, c) => s + c.montant_paye, 0);
    const toutPaye      = totalCollecte >= (acc?.total_attendu || 0);
    await supabase.from('accouchement').update({
      total_collecte: totalCollecte,
      statut:         toutPaye ? 'cloture' : 'en_cours',
    }).eq('accouchement_id', accouchementId);

    setShowPaie(null);
    load();
    setSaving(false);
  }

  async function sanctionner(cotis) {
    const reste = cotis.montant_du - cotis.montant_paye;
    Alert.alert('⚠️ Créer une dette',
      `${cotis.adherents.nom} ${cotis.adherents.prenom}\nNon-paiement : ${reste.toLocaleString()} FCFA`,
      [{ text: 'Annuler', style: 'cancel' },
       { text: 'Créer dette', style: 'destructive', onPress: async () => {
          await supabase.from('dettes').insert({
            adherent_id:       cotis.adherent_id,
            type_dette:        'non_paiement_solidarite',
            montant:           reste,
            montant_initial:   cotis.montant_du,
            montant_rembourse: 0,
            montant_restant:   reste,
            description:       `Cotisation Voir Bébé — ${acc?.adherents?.nom} ${acc?.adherents?.prenom}`,
            date_creation:     today,
            statut:            'en_cours',
            ref_id:            accouchementId,
          });
          await supabase.from('cotisation_voir_bebe')
            .update({ statut: 'dette' })
            .eq('cotisation_voir_bebe_id', cotis.cotisation_voir_bebe_id);
          const { data: adh } = await supabase.from('adherents')
            .select('nb_dettes_en_cours').eq('adherent_id', cotis.adherent_id).single();
          await supabase.from('adherents')
            .update({ nb_dettes_en_cours: (adh?.nb_dettes_en_cours || 0) + 1 })
            .eq('adherent_id', cotis.adherent_id);
          load();
        }}
      ]);
  }

  if (loading || !acc) return (
    <View style={styles.container}>
      <Header title="Détail collecte" onBack={onBack} />
      <ActivityIndicator size="large" color="#E91E8C" style={{ marginTop: 40 }} />
    </View>
  );

  const pct      = acc.total_attendu > 0 ? Math.round(((acc.total_collecte || 0) / acc.total_attendu) * 100) : 0;
  const nbPayes  = cotisations.filter(c => c.statut === 'paye').length;
  const nbAttente= cotisations.filter(c => c.statut === 'en_attente').length;

  return (
    <View style={styles.container}>
      <Header title={`👶 ${acc.adherents?.nom} ${acc.adherents?.prenom}`} onBack={onBack} />

      <View style={styles.evtResume}>
        <Text style={styles.evtResumeType}>{acc.is_jumeaux ? '👶👶 Jumeaux' : '👶 Accouchement simple'}</Text>
        <Text style={styles.evtResumeDate}>
          Approuvé le {acc.date_approbation
            ? new Date(acc.date_approbation + 'T12:00:00').toLocaleDateString('fr-FR') : '—'}
          {acc.date_limite ? ` · Limite : ${new Date(acc.date_limite + 'T12:00:00').toLocaleDateString('fr-FR')}` : ''}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: '#E91E8C' }]} />
        </View>
        <Text style={{ fontSize: 13, color: '#555', marginTop: 6 }}>
          {(acc.total_collecte || 0).toLocaleString()} / {(acc.total_attendu || 0).toLocaleString()} FCFA ({pct}%)
          {'  ·  '}{nbPayes} payés · {nbAttente} en attente
        </Text>
      </View>

      <FlatList data={cotisations} keyExtractor={c => c.cotisation_voir_bebe_id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const paye    = item.statut === 'paye';
          const dette   = item.statut === 'dette';
          const partiel = item.statut === 'partiel';
          return (
            <View style={[styles.cotisCard,
              paye    ? styles.cotisCardPaye :
              dette   ? styles.cotisCardDette :
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
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 20 }}>{paye ? '✅' : dette ? '🚫' : partiel ? '⏳' : '❌'}</Text>
                {!paye && !dette && (
                  <TouchableOpacity style={styles.btnPayerSmall}
                    onPress={() => { setShowPaie(item); setMontantSaisie(String(item.montant_du - item.montant_paye)); }}>
                    <Text style={styles.btnPayerSmallText}>💰</Text>
                  </TouchableOpacity>
                )}
                {!paye && !dette && (
                  <TouchableOpacity style={styles.btnDetteSmall} onPress={() => sanctionner(item)}>
                    <Text style={styles.btnDetteSmallText}>⚠️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      <Modal visible={!!showPaie} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>💰 Enregistrer un paiement</Text>
            {showPaie && <Text style={{ color: '#555', marginBottom: 4 }}>{showPaie.adherents?.nom} {showPaie.adherents?.prenom}</Text>}
            {showPaie && <Text style={{ color: '#888', marginBottom: 16 }}>
              Reste : {(showPaie.montant_du - showPaie.montant_paye).toLocaleString()} FCFA
            </Text>}
            <Text style={styles.inputLabel}>Montant payé (FCFA)</Text>
            <TextInput style={styles.input} value={montantSaisie} onChangeText={setMontantSaisie}
              keyboardType="numeric" placeholder="Montant" />
            <View style={styles.quickBtns}>
              {showPaie && (
                <TouchableOpacity style={styles.quickBtn}
                  onPress={() => setMontantSaisie(String(showPaie.montant_du - showPaie.montant_paye))}>
                  <Text style={styles.quickBtnText}>Tout ({(showPaie.montant_du - showPaie.montant_paye).toLocaleString()})</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.demandeBtns}>
              <TouchableOpacity style={[styles.btnApprouver, { opacity: saving ? 0.5 : 1 }]}
                onPress={() => enregistrerPaiement(showPaie, montantSaisie)} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> :
                  <Text style={styles.btnApprouverText}>✅ Confirmer</Text>}
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
//  HISTORIQUE
// ══════════════════════════════════════════════════════════════
function HistoriqueBebeScreen({ onBack }) {
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('accouchement')
      .select('*, adherents!beneficiaire_id(nom, prenom)')
      .in('statut', ['cloture', 'rejete'])
      .order('date_annonce', { ascending: false });
    setHistorique(data || []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📜 Historique Voir Bébé" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#E91E8C" style={{ marginTop: 40 }} /> :
        <FlatList data={historique} keyExtractor={h => h.accouchement_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const rejete = item.statut === 'rejete';
            return (
              <View style={[styles.historiqueCard, rejete && { opacity: 0.6 }]}>
                <Text style={{ fontSize: 24, marginRight: 12 }}>{item.is_jumeaux ? '👶👶' : '👶'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demandeNom}>{item.adherents?.nom} {item.adherents?.prenom}</Text>
                  <Text style={styles.demandeSub}>
                    {item.is_jumeaux ? 'Jumeaux' : 'Simple'} · {new Date(item.date_annonce + 'T12:00:00').toLocaleDateString('fr-FR')}
                  </Text>
                  <Text style={{ fontSize: 12, color: rejete ? '#C00000' : '#1E7E34', fontWeight: 'bold' }}>
                    {rejete ? '✕ Rejeté' : '✅ Clôturé'}
                  </Text>
                </View>
                {!rejete && (
                  <Text style={[styles.statCardNum, { color: '#E91E8C', fontSize: 15 }]}>
                    {(item.total_collecte || 0).toLocaleString()}{'\n'}
                    <Text style={{ fontSize: 11, color: '#888' }}>FCFA</Text>
                  </Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun historique.</Text>}
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
  header:             { backgroundColor: '#AD1457', padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:            { color: '#F8BBD0', fontSize: 14 },
  statsRow:           { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:           { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderTopWidth: 4 },
  statCardNum:        { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  statCardLabel:      { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  alertBox:           { backgroundColor: '#FCE4EC', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#AD1457' },
  alertText:          { color: '#AD1457', fontWeight: 'bold', fontSize: 13 },
  btnPrimary:         { backgroundColor: '#AD1457', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:     { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary:       { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText:   { color: '#1F3864', fontSize: 15, fontWeight: '600' },
  reglesBox:          { backgroundColor: '#FCE4EC', borderRadius: 12, padding: 14, marginTop: 4, borderLeftWidth: 4, borderLeftColor: '#AD1457' },
  reglesTitre:        { fontSize: 13, fontWeight: 'bold', color: '#AD1457', marginBottom: 8 },
  regle:              { fontSize: 12, color: '#555', marginBottom: 4 },
  inputLabel:         { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 4 },
  bloqueBox:          { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 14, marginTop: 8, borderLeftWidth: 4, borderLeftColor: '#C00000' },
  bloqueTitle:        { color: '#C00000', fontWeight: 'bold', fontSize: 14, marginBottom: 6 },
  bloqueText:         { color: '#C00000', fontSize: 13, marginBottom: 3 },
  bloqueNote:         { color: '#888', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  enRegleBox:         { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12, marginTop: 8, borderLeftWidth: 4, borderLeftColor: '#1E7E34' },
  enRegleText:        { color: '#1E7E34', fontWeight: 'bold', fontSize: 13 },
  typeBtn:            { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#F8BBD0', elevation: 1 },
  typeBtnActive:      { backgroundColor: '#AD1457', borderColor: '#AD1457' },
  typeBtnIcon:        { fontSize: 24, marginBottom: 4 },
  typeBtnLabel:       { fontSize: 14, fontWeight: 'bold', color: '#1F3864' },
  typeBtnMontant:     { fontSize: 12, color: '#888', marginTop: 2 },
  calcCard:           { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 10, elevation: 2 },
  calcTitle:          { fontSize: 14, fontWeight: 'bold', color: '#AD1457', marginBottom: 10 },
  calcRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  calcLabel:          { color: '#666', fontSize: 14, flex: 1 },
  calcVal:            { fontSize: 14, fontWeight: '600', color: '#333' },
  demandeCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  demandeNom:         { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  demandeSub:         { fontSize: 12, color: '#888', marginTop: 2 },
  typeChip:           { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  detteDesc:          { fontSize: 12, color: '#666', fontStyle: 'italic', marginBottom: 8 },
  demandeBtns:        { flexDirection: 'row', gap: 10 },
  btnApprouver:       { flex: 1, backgroundColor: '#1E7E34', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnApprouverText:   { color: '#fff', fontWeight: 'bold' },
  btnRejeter:         { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C00000' },
  btnRejeterText:     { color: '#C00000', fontWeight: 'bold' },
  collecteCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  collecteCardRetard: { borderLeftWidth: 4, borderLeftColor: '#C00000' },
  retardBadge:        { backgroundColor: '#FFEBEE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  retardText:         { color: '#C00000', fontSize: 11, fontWeight: 'bold' },
  progressBar:        { height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill:       { height: '100%', borderRadius: 3 },
  evtResume:          { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  evtResumeType:      { fontSize: 16, fontWeight: 'bold', color: '#1F3864' },
  evtResumeDate:      { fontSize: 12, color: '#888', marginTop: 2 },
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
  quickBtns:          { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 },
  quickBtn:           { flex: 1, backgroundColor: '#F0F4F8', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#D6E4F0' },
  quickBtnText:       { fontSize: 13, color: '#1F3864', fontWeight: '600' },
  historiqueCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle:         { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 12 },
  modalItem:          { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8' },
  modalItemActive:    { backgroundColor: '#AD1457' },
  modalItemText:      { fontSize: 15, color: '#333' },
  modalClose:         { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText:     { color: '#666', fontWeight: 'bold' },
  empty:              { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});