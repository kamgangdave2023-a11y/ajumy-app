import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { caisseRoulement } from '../lib/caisse';

// ── Arrondis FCFA ─────────────────────────────────────────────
const COUPURES = [5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
function arrondiCoupure(montant) {
  if (!montant || montant <= 0) return 0;
  if (montant > 10000) return Math.round(montant / 500) * 500;
  let inf = COUPURES[0], sup = COUPURES[COUPURES.length - 1];
  for (let i = 0; i < COUPURES.length; i++) {
    if (COUPURES[i] <= montant) inf = COUPURES[i];
    if (COUPURES[i] >= montant) { sup = COUPURES[i]; break; }
  }
  if (inf === sup) return inf;
  return (montant - inf) >= (sup - montant) ? sup : inf;
}
// ─────────────────────────────────────────────────────────────

const PAS_MONTANT  = 10000; // 1 pas = 10 000 FCFA
const PAS_MAX      = 5;     // plafond cumulé actif par adhérent
const COTIS_PAS    = 250;   // FCFA par pas, chaque dimanche
const SANCTION_ABS = 500;   // FCFA si absent le dimanche de remise

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
//  ACCUEIL
// ══════════════════════════════════════════════════════════════
export default function RoulementScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [vue, setVue]           = useState('accueil');
  const [stats, setStats]       = useState({ fonds: 0, enCours: 0, demandes: 0 });
  const [seanceOk, setSeanceOk] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    const dim = getDimanche();
    const [{ data: fonds }, { data: roulements }, { data: seance }] = await Promise.all([
      supabase.from('fonds_roulement').select('solde').single(),
      supabase.from('roulement').select('statut, nb_pas'),
      supabase.from('cotisation_roulement').select('cotisation_id').eq('date_dimanche', dim).limit(1),
    ]);
    const enCours  = (roulements || []).filter(r => r.statut === 'en_cours').reduce((s, r) => s + r.nb_pas, 0);
    const demandes = (roulements || []).filter(r => r.statut === 'demande').length;
    setStats({ fonds: fonds?.solde || 0, enCours, demandes });
    setSeanceOk((seance || []).length > 0);
    setLoading(false);
  }

  if (vue === 'demander')    return <DemanderRoulementScreen   onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'approuver')   return <ApprouverRoulementScreen  onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'cotisations') return <CotisationsDimancheScreen onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'enCours')     return <RoulementsEnCoursScreen   onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'historique')  return <HistoriqueRoulementScreen onBack={() => { setVue('accueil'); loadStats(); }} />;

  return (
    <View style={styles.container}>
      <Header title="🔄 Roulements" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {loading ? <ActivityIndicator color="#7030A0" style={{ marginTop: 20 }} /> : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: '#7030A0' }]}>
              <Text style={styles.statCardNum}>{stats.fonds.toLocaleString()}</Text>
              <Text style={styles.statCardLabel}>Fonds{'\n'}(FCFA)</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#C55A11' }]}>
              <Text style={[styles.statCardNum, { color: stats.demandes > 0 ? '#C55A11' : '#1F3864' }]}>{stats.demandes}</Text>
              <Text style={styles.statCardLabel}>Demandes{'\n'}en attente</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#2E75B6' }]}>
              <Text style={styles.statCardNum}>{stats.enCours}</Text>
              <Text style={styles.statCardLabel}>Pas en{'\n'}cours</Text>
            </View>
          </View>
        )}

        {stats.demandes > 0 && (
          <TouchableOpacity style={styles.alertBox} onPress={() => setVue('approuver')}>
            <Text style={styles.alertText}>🔔 {stats.demandes} demande(s) en attente → Approuver</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btnPrimary, seanceOk && { backgroundColor: '#1E7E34' }]}
          onPress={() => setVue('cotisations')}>
          <Text style={styles.btnPrimaryText}>
            {seanceOk ? '✅ Cotisations du dimanche saisies' : '💳 Saisir les cotisations du dimanche'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('demander')}>
          <Text style={styles.btnSecondaryText}>📝 Nouvelle demande / Modifier pas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('approuver')}>
          <Text style={styles.btnSecondaryText}>
            ✅ Approuver les demandes {stats.demandes > 0 ? `(${stats.demandes})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('enCours')}>
          <Text style={styles.btnSecondaryText}>📋 Roulements en cours</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('historique')}>
          <Text style={styles.btnSecondaryText}>📜 Historique</Text>
        </TouchableOpacity>

        <View style={styles.reglesBox}>
          <Text style={styles.reglesTitre}>📌 Règles</Text>
          <Text style={styles.regle}>• 1 pas = {PAS_MONTANT.toLocaleString()} FCFA · max {PAS_MAX} pas cumulés</Text>
          <Text style={styles.regle}>• Cotisation : {COTIS_PAS} FCFA × pas, chaque dimanche dès le jour de la demande</Text>
          <Text style={styles.regle}>• Ajout de pas → reçoit la différence + cotisation ajustée ce dimanche</Text>
          <Text style={styles.regle}>• Réduction → rembourse la différence immédiatement + cotisation réduite</Text>
          <Text style={styles.regle}>• Remboursement total libre · cotisation s'arrête</Text>
          <Text style={styles.regle}>• Sanction absence dimanche de remise : {SANCTION_ABS} FCFA (dette)</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  DEMANDE / AJOUT / RÉDUCTION DE PAS
//  - Nouvelle demande       → bureau approuve, reçoit montant brut
//  - Ajout de pas           → bureau approuve, reçoit la différence
//  - Réduction de pas       → immédiat, rembourse la différence
//  Dans tous les cas :       cotisation du dimanche = 250 × nouveau nb pas
// ══════════════════════════════════════════════════════════════
function DemanderRoulementScreen({ onBack }) {
  const [adherents, setAdherents]           = useState([]);
  const [selectedAdh, setSelectedAdh]       = useState(null);
  const [roulementsActifs, setRoulementsActifs] = useState([]);
  const [pasActuels, setPasActuels]         = useState(0);
  const [nbPasChoisi, setNbPasChoisi]       = useState(0);
  const [showPicker, setShowPicker]         = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [loading, setLoading]               = useState(true);

  const dateDimanche = getDimanche();

  useEffect(() => { loadAdherents(); }, []);

  async function loadAdherents() {
    setLoading(true);
    const { data } = await supabase
      .from('adherents')
      .select('adherent_id, nom, prenom, liste_noire, motif_liste_noire')
      .in('statut', ['actif', 'en_observation']).order('nom');
    setAdherents(data || []);
    setLoading(false);
  }

  async function selectionner(adh) {
    setSelectedAdh(adh);
    setShowPicker(false);
    const { data } = await supabase.from('roulement')
      .select('roulement_id, nb_pas, montant, montant_du')
      .eq('adherent_id', adh.adherent_id).eq('statut', 'en_cours');
    setRoulementsActifs(data || []);
    const total = (data || []).reduce((s, r) => s + r.nb_pas, 0);
    setPasActuels(total);
    setNbPasChoisi(total || 1);
  }

  const isNouveauClient = pasActuels === 0;
  const diff            = nbPasChoisi - pasActuels;   // + ajout, - réduction, 0 rien
  const montantDiff     = Math.abs(diff) * PAS_MONTANT;
  const cotisationJour  = nbPasChoisi * COTIS_PAS;

  const action = isNouveauClient ? 'nouvelle'
               : diff > 0        ? 'ajout'
               : diff < 0        ? 'reduction'
               : null;

  async function soumettre() {
    if (!selectedAdh) { Alert.alert('Sélectionnez un adhérent'); return; }
    if (nbPasChoisi <= 0) { Alert.alert('Choisissez au moins 1 pas'); return; }
    if (!action) { Alert.alert('Aucun changement', 'Modifiez le nombre de pas.'); return; }
    if (selectedAdh.liste_noire) {
      Alert.alert('🚫 Liste noire',
        `${selectedAdh.nom} ${selectedAdh.prenom} est sur liste noire.\n` +
        (selectedAdh.motif_liste_noire ? `Motif : ${selectedAdh.motif_liste_noire}` : ''));
      return;
    }
    if (nbPasChoisi > PAS_MAX) {
      Alert.alert('Plafond dépassé', `Maximum : ${PAS_MAX} pas.`);
      return;
    }

    setSaving(true);
    const today = new Date().toISOString().split('T')[0];

    if (action === 'nouvelle' || action === 'ajout') {
      // ── Nouvelle demande ou ajout → bureau doit approuver ──
      const montant = (action === 'nouvelle' ? nbPasChoisi : diff) * PAS_MONTANT;
      const { error } = await supabase.from('roulement').insert({
        adherent_id:          selectedAdh.adherent_id,
        nb_pas:               action === 'nouvelle' ? nbPasChoisi : diff,
        montant:              montant,
        montant_du:           montant,
        cotisation_par_dim:   cotisationJour,
        date_demande:         today,
        date_dimanche_remise: dateDimanche,
        statut:               'demande',
        type_demande:         action,
      });
      if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }
      Alert.alert('✅ Demande soumise',
        action === 'nouvelle'
          ? `${nbPasChoisi} pas · ${montant.toLocaleString()} FCFA\nCotisation ce dimanche : ${cotisationJour.toLocaleString()} FCFA\nEn attente d'approbation.`
          : `+${diff} pas · ${montantDiff.toLocaleString()} FCFA supplémentaires\nNouvelle cotisation/dim : ${cotisationJour.toLocaleString()} FCFA\nEn attente d'approbation.`
      );

    } else {
      // ── Réduction → immédiate, rembourse la différence ──
      const pasARetirer = Math.abs(diff);
      let pasRestants   = pasARetirer;

      // Ajuster les roulements actifs (retirer du plus récent)
      for (const r of [...roulementsActifs].reverse()) {
        if (pasRestants <= 0) break;
        const retrait    = Math.min(pasRestants, r.nb_pas);
        const nouveauPas = r.nb_pas - retrait;
        if (nouveauPas === 0) {
          await supabase.from('roulement').update({
            statut: 'rembourse', date_remboursement: today, nb_pas: 0, montant_du: 0,
          }).eq('roulement_id', r.roulement_id);
        } else {
          await supabase.from('roulement').update({
            nb_pas:            nouveauPas,
            montant:           nouveauPas * PAS_MONTANT,
            montant_du:        nouveauPas * PAS_MONTANT,
            cotisation_par_dim: nouveauPas * COTIS_PAS,
          }).eq('roulement_id', r.roulement_id);
        }
        pasRestants -= retrait;
      }

      // Recréditer le fonds de la différence remboursée
      const { data: f } = await supabase.from('fonds_roulement').select('solde, fonds_id').single();
      await supabase.from('fonds_roulement')
        .update({ solde: (f?.solde || 0) + montantDiff })
        .eq('fonds_id', f.fonds_id);

      // Log mouvement
      await supabase.from('mouvement_fonds_roulement').insert({
        type_mouvement: 'remboursement_partiel',
        montant:        montantDiff,
        date_mouvement: today,
        description:    `Réduction ${pasARetirer} pas — ${selectedAdh.nom} ${selectedAdh.prenom}`,
      });

      Alert.alert('✅ Réduction effectuée',
        `Remboursé : ${montantDiff.toLocaleString()} FCFA\n` +
        `Nouvelle cotisation/dim : ${cotisationJour.toLocaleString()} FCFA`);
      onBack(); setSaving(false); return;
    }

    onBack(); setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📝 Demande / Modifier pas" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Text style={styles.inputLabel}>Adhérent *</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={{ color: selectedAdh ? '#333' : '#aaa' }}>
            {selectedAdh ? `${selectedAdh.nom} ${selectedAdh.prenom}` : 'Sélectionner...'}
          </Text>
        </TouchableOpacity>

        {selectedAdh && pasActuels > 0 && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📋 En cours : <Text style={{ fontWeight: 'bold' }}>{pasActuels} pas</Text>
              {' '}· {(pasActuels * PAS_MONTANT).toLocaleString()} FCFA à rembourser
            </Text>
            {roulementsActifs.map((r, i) => (
              <Text key={i} style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                → {r.nb_pas} pas · doit : {(r.montant_du || r.montant).toLocaleString()} FCFA
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.inputLabel}>
          {isNouveauClient ? 'Nombre de pas demandés' : 'Nouveau total de pas'}
        </Text>
        <View style={styles.pasSelector}>
          {[1, 2, 3, 4, 5].map(p => {
            const desactive  = p > PAS_MAX;
            const estActuel  = p === pasActuels && !isNouveauClient;
            const estChoisi  = nbPasChoisi === p;
            return (
              <TouchableOpacity key={p}
                style={[styles.pasBtn, estChoisi && styles.pasBtnActive, desactive && styles.pasBtnDisabled, estActuel && !estChoisi && styles.pasBtnActuel]}
                onPress={() => !desactive && setNbPasChoisi(p)}
                disabled={desactive}>
                <Text style={[styles.pasBtnText, estChoisi && styles.pasBtnTextActive, desactive && { color: '#ccc' }]}>{p}</Text>
                <Text style={[styles.pasBtnSub, desactive && { color: '#ddd' }]}>{(p * PAS_MONTANT / 1000)}k</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!isNouveauClient && (
          <Text style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 4 }}>
            Actuel : {pasActuels} pas (bordure pointillée) · Choisir pour modifier
          </Text>
        )}

        {/* Simulation */}
        {nbPasChoisi > 0 && action && (
          <View style={styles.calcCard}>
            <Text style={styles.calcTitle}>
              {action === 'nouvelle' ? `💰 Nouvelle demande — ${nbPasChoisi} pas`
               : action === 'ajout'  ? `➕ Ajout de ${diff} pas`
               :                       `➖ Réduction de ${Math.abs(diff)} pas`}
            </Text>

            {action === 'nouvelle' && (
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Montant reçu à l'approbation</Text>
                <Text style={[styles.calcVal, { color: '#1E7E34', fontWeight: 'bold' }]}>
                  {(nbPasChoisi * PAS_MONTANT).toLocaleString()} FCFA
                </Text>
              </View>
            )}
            {action === 'ajout' && (
              <>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Reçoit en plus (+{diff} pas)</Text>
                  <Text style={[styles.calcVal, { color: '#1E7E34', fontWeight: 'bold' }]}>{montantDiff.toLocaleString()} FCFA</Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Total à rembourser après</Text>
                  <Text style={[styles.calcVal, { color: '#C55A11', fontWeight: 'bold' }]}>{(nbPasChoisi * PAS_MONTANT).toLocaleString()} FCFA</Text>
                </View>
              </>
            )}
            {action === 'reduction' && (
              <>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Rembourse maintenant</Text>
                  <Text style={[styles.calcVal, { color: '#C55A11', fontWeight: 'bold' }]}>{montantDiff.toLocaleString()} FCFA</Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Reste à rembourser</Text>
                  <Text style={[styles.calcVal, { color: '#C55A11' }]}>{(nbPasChoisi * PAS_MONTANT).toLocaleString()} FCFA</Text>
                </View>
              </>
            )}

            <View style={[styles.calcRow, { borderTopWidth: 2, borderTopColor: '#7030A0', marginTop: 4 }]}>
              <Text style={[styles.calcLabel, { fontWeight: 'bold' }]}>💳 Cotisation ce dimanche</Text>
              <Text style={[styles.calcVal, { color: '#7030A0', fontWeight: 'bold', fontSize: 16 }]}>{cotisationJour.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: '#888' }]}>Cotisation chaque dimanche suivant</Text>
              <Text style={[styles.calcVal, { color: '#888' }]}>{cotisationJour.toLocaleString()} FCFA</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btnPrimary, { opacity: saving || !action ? 0.5 : 1 }]}
          onPress={soumettre} disabled={saving || !action}>
          {saving ? <ActivityIndicator color="#fff" /> :
            <Text style={styles.btnPrimaryText}>
              {action === 'nouvelle'  ? '📝 Soumettre la demande'
               : action === 'ajout'  ? '📝 Demander l\'ajout'
               : action === 'reduction' ? '✅ Confirmer la réduction'
               : 'Aucun changement'}
            </Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker adhérent */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choisir un adhérent</Text>
            {loading ? <ActivityIndicator color="#7030A0" /> :
              <FlatList data={adherents} keyExtractor={a => a.adherent_id} style={{ maxHeight: 420 }}
                renderItem={({ item }) => {
                  const ln = item.liste_noire;
                  return (
                    <TouchableOpacity
                      style={[styles.modalItem, selectedAdh?.adherent_id === item.adherent_id && styles.modalItemActive, ln && styles.modalItemNoir]}
                      onPress={() => {
                        if (ln) { Alert.alert('🚫 Liste noire', `${item.nom} ${item.prenom} — demande impossible.`); return; }
                        selectionner(item);
                      }}>
                      <Text style={[styles.modalItemText, selectedAdh?.adherent_id === item.adherent_id && { color: '#fff' }, ln && { color: '#C00000' }]}>
                        {ln ? '🚫 ' : ''}{item.nom} {item.prenom}
                      </Text>
                      {ln && <Text style={{ fontSize: 11, color: '#C00000' }}>Liste noire</Text>}
                    </TouchableOpacity>
                  );
                }}
              />
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
//  COTISATIONS DU DIMANCHE
//  Chaque adhérent avec roulement actif paie 250 × nb_pas
//  Non-paiement → dette automatique
// ══════════════════════════════════════════════════════════════
function CotisationsDimancheScreen({ onBack }) {
  const [roulements, setRoulements] = useState([]);
  const [paiements, setPaiements]   = useState({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const dateDimanche                = getDimanche();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('roulement')
      .select('*, adherents(nom, prenom)')
      .eq('statut', 'en_cours')
      .order('date_approbation', { ascending: true });

    // Filtrer ceux déjà saisis ce dimanche
    const { data: dejaPayes } = await supabase.from('cotisation_roulement')
      .select('roulement_id').eq('date_dimanche', dateDimanche);
    const dejaSaisIds = new Set((dejaPayes || []).map(c => c.roulement_id));

    const aFaire = (data || []).filter(r => !dejaSaisIds.has(r.roulement_id));
    const init   = {};
    aFaire.forEach(r => { init[r.roulement_id] = true; }); // défaut : payé
    setRoulements(aFaire);
    setPaiements(init);
    setLoading(false);
  }

  const totalAttendu = roulements.reduce((s, r) => {
    const m = r.cotisation_par_dim || r.nb_pas * COTIS_PAS;
    return paiements[r.roulement_id] !== false ? s + m : s;
  }, 0);

  const nbPayes    = roulements.filter(r => paiements[r.roulement_id] !== false).length;
  const nbNonPayes = roulements.length - nbPayes;

  async function enregistrer() {
    if (roulements.length === 0) return;
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    let fondsAjoute = 0;

    for (const r of roulements) {
      const paye   = paiements[r.roulement_id] !== false;
      const montant = r.cotisation_par_dim || r.nb_pas * COTIS_PAS;

      await supabase.from('cotisation_roulement').insert({
        roulement_id:  r.roulement_id,
        adherent_id:   r.adherent_id,
        date_dimanche: dateDimanche,
        nb_pas:        r.nb_pas,
        montant:       montant,
        statut:        paye ? 'paye' : 'non_paye',
      });

      if (paye) {
        fondsAjoute += montant;
      } else {
        // Créer une dette
        await supabase.from('dettes').insert({
          adherent_id:       r.adherent_id,
          type_dette:        'cotisation_roulement',
          montant:           montant,
          montant_initial:   montant,
          montant_rembourse: 0,
          montant_restant:   montant,
          description:       `Cotisation roulement (${r.nb_pas} pas) — ${new Date(dateDimanche + 'T12:00:00').toLocaleDateString('fr-FR')}`,
          date_creation:     today,
          statut:            'en_cours',
        });
        const { data: adh } = await supabase.from('adherents')
          .select('nb_dettes_en_cours').eq('adherent_id', r.adherent_id).single();
        await supabase.from('adherents')
          .update({ nb_dettes_en_cours: (adh?.nb_dettes_en_cours || 0) + 1 })
          .eq('adherent_id', r.adherent_id);
      }
    }

    // Créditer le fonds en une seule opération
    if (fondsAjoute > 0) {
      const { data: f } = await supabase.from('fonds_roulement').select('solde, fonds_id').single();
      await supabase.from('fonds_roulement')
        .update({ solde: (f?.solde || 0) + fondsAjoute })
        .eq('fonds_id', f.fonds_id);
      // Caisse automatique
      await caisseRoulement.cotisation(fondsAjoute, dateDimanche);
    }

    Alert.alert('✅ Cotisations enregistrées',
      `✅ Payés : ${nbPayes}  ·  Total : ${fondsAjoute.toLocaleString()} FCFA` +
      (nbNonPayes > 0 ? `\n⚠️ Non payés (dettes créées) : ${nbNonPayes}` : ''));
    onBack();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Header title="💳 Cotisations du dimanche" onBack={onBack} />
      <View style={styles.fondsBand}>
        <Text style={styles.fondsBandText}>
          {new Date(dateDimanche + 'T12:00:00').toLocaleDateString('fr-FR')}
          {'  ·  '}Attendu : {totalAttendu.toLocaleString()} FCFA
          {'  ·  '}{nbNonPayes > 0 ? `⚠️ ${nbNonPayes} absent(s)` : '✅ Tous présents'}
        </Text>
      </View>

      {loading ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} /> :
        roulements.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={styles.empty}>✅ Cotisations déjà saisies pour ce dimanche.</Text>
          </View>
        ) : (
          <>
            <FlatList data={roulements} keyExtractor={r => r.roulement_id}
              contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
              renderItem={({ item }) => {
                const paye   = paiements[item.roulement_id] !== false;
                const montant = item.cotisation_par_dim || item.nb_pas * COTIS_PAS;
                return (
                  <TouchableOpacity
                    style={[styles.cotisCard, paye ? styles.cotisCardPaye : styles.cotisCardNonPaye]}
                    onPress={() => setPaiements(prev => ({ ...prev, [item.roulement_id]: !paye }))}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cotisNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                      <Text style={styles.cotisSub}>{item.nb_pas} pas · reste à rembourser {(item.montant_du || item.montant).toLocaleString()} FCFA</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.cotisMontant, { color: paye ? '#1E7E34' : '#C00000' }]}>
                        {montant.toLocaleString()} FCFA
                      </Text>
                      <Text style={{ fontSize: 22, marginTop: 4 }}>{paye ? '✅' : '❌'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={styles.stickyBottom}>
              <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1 }]}
                onPress={enregistrer} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.btnPrimaryText}>
                    💾 Enregistrer ({nbPayes} payé{nbPayes > 1 ? 's' : ''}{nbNonPayes > 0 ? `, ${nbNonPayes} absent${nbNonPayes > 1 ? 's' : ''}` : ''})
                  </Text>}
              </TouchableOpacity>
            </View>
          </>
        )
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  APPROUVER LES DEMANDES
// ══════════════════════════════════════════════════════════════
function ApprouverRoulementScreen({ onBack }) {
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [fonds, setFonds]       = useState(0);
  const [fondsId, setFondsId]   = useState(null);
  const dateDimanche            = getDimanche();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data }, { data: f }] = await Promise.all([
      supabase.from('roulement').select('*, adherents(nom, prenom)')
        .eq('statut', 'demande').order('date_demande', { ascending: true }),
      supabase.from('fonds_roulement').select('solde, fonds_id').single(),
    ]);
    setDemandes(data || []);
    setFonds(f?.solde || 0);
    setFondsId(f?.fonds_id);
    setLoading(false);
  }

  async function approuver(r) {
    if (fonds < r.montant) {
      Alert.alert('Fonds insuffisants',
        `Disponible : ${fonds.toLocaleString()} FCFA\nÀ remettre : ${r.montant.toLocaleString()} FCFA`);
      return;
    }
    setSaving(true);
    const today      = new Date().toISOString().split('T')[0];
    const cotisJour  = r.nb_pas * COTIS_PAS;
    const soldeApres = fonds - r.montant + cotisJour; // débite le montant remis, crédite la cotisation du jour

    // 1. Approuver
    await supabase.from('roulement').update({
      statut:               'en_cours',
      date_approbation:     today,
      date_dimanche_remise: dateDimanche,
      cotisation_par_dim:   cotisJour,
      montant_du:           r.montant,
    }).eq('roulement_id', r.roulement_id);

    // 2. Mettre à jour le fonds
    await supabase.from('fonds_roulement').update({ solde: soldeApres }).eq('fonds_id', fondsId);

    // 3. Enregistrer la cotisation du jour même
    await supabase.from('cotisation_roulement').insert({
      roulement_id:  r.roulement_id,
      adherent_id:   r.adherent_id,
      date_dimanche: dateDimanche,
      nb_pas:        r.nb_pas,
      montant:       cotisJour,
      statut:        'paye',
    });

    // 4. Logs
    await supabase.from('mouvement_fonds_roulement').insert([
      { roulement_id: r.roulement_id, type_mouvement: 'remise',     montant: -r.montant, date_mouvement: today, description: `Remise ${r.nb_pas} pas — ${r.adherents.nom}` },
      { roulement_id: r.roulement_id, type_mouvement: 'cotisation', montant: cotisJour,  date_mouvement: today, description: `Cotisation J1 ${r.nb_pas} pas — ${r.adherents.nom}` },
      // Caisse automatique remise + cotisation J1
    ]); await caisseRoulement.remise(r.montant, r.roulement_id, r.adherent_id); await caisseRoulement.cotisation(cotisJour, r.roulement_id, r.adherent_id); await supabase.from('mouvement_fonds_roulement').insert([
    ]);

    Alert.alert('✅ Approuvé',
      `${r.adherents.nom} ${r.adherents.prenom}\n` +
      `Remis : ${r.montant.toLocaleString()} FCFA\n` +
      `Cotisation J1 encaissée : ${cotisJour.toLocaleString()} FCFA\n` +
      `À rembourser : ${r.montant.toLocaleString()} FCFA`);
    load();
    setSaving(false);
  }

  async function rejeter(id) {
    Alert.alert('Rejeter ?', 'La demande sera annulée.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Rejeter', style: 'destructive', onPress: async () => {
        await supabase.from('roulement').update({ statut: 'rejete' }).eq('roulement_id', id);
        load();
      }}
    ]);
  }

  return (
    <View style={styles.container}>
      <Header title="✅ Approuver les demandes" onBack={onBack} />
      <View style={styles.fondsBand}>
        <Text style={styles.fondsBandText}>💰 Fonds disponible : {fonds.toLocaleString()} FCFA</Text>
      </View>
      {loading ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} /> :
        <FlatList data={demandes} keyExtractor={r => r.roulement_id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const cotisJour = item.nb_pas * COTIS_PAS;
            const fondsOk   = fonds >= item.montant;
            const isAjout   = item.type_demande === 'ajout';
            return (
              <View style={styles.demandeCard}>
                <Text style={styles.demandeNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                <Text style={styles.demandeSub}>
                  {isAjout ? '➕ Ajout · ' : ''}{item.nb_pas} pas · Demandé le {new Date(item.date_demande + 'T12:00:00').toLocaleDateString('fr-FR')}
                </Text>
                <View style={{ marginVertical: 10 }}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Montant à remettre</Text>
                    <Text style={[styles.calcVal, { color: fondsOk ? '#1E7E34' : '#C00000', fontWeight: 'bold' }]}>
                      {item.montant.toLocaleString()} FCFA
                    </Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Cotisation ce dimanche ({item.nb_pas} × {COTIS_PAS})</Text>
                    <Text style={[styles.calcVal, { color: '#7030A0', fontWeight: 'bold' }]}>{cotisJour.toLocaleString()} FCFA</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { color: '#888' }]}>Cotisation chaque dimanche suivant</Text>
                    <Text style={[styles.calcVal, { color: '#888' }]}>{cotisJour.toLocaleString()} FCFA</Text>
                  </View>
                  {!fondsOk && <Text style={{ color: '#C00000', fontSize: 12, marginTop: 4 }}>⚠️ Fonds insuffisants</Text>}
                </View>
                <View style={styles.demandeBtns}>
                  <TouchableOpacity
                    style={[styles.btnApprouver, { opacity: (!fondsOk || saving) ? 0.4 : 1 }]}
                    onPress={() => approuver(item)} disabled={!fondsOk || saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnApprouverText}>✅ Approuver</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnRejeter} onPress={() => rejeter(item.roulement_id)}>
                    <Text style={styles.btnRejeterText}>✕ Rejeter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucune demande en attente.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  ROULEMENTS EN COURS
// ══════════════════════════════════════════════════════════════
function RoulementsEnCoursScreen({ onBack }) {
  const [roulements, setRoulements] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const today                       = new Date().toISOString().split('T')[0];
  const dateDimanche                = getDimanche();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('roulement')
      .select('*, adherents(nom, prenom)').eq('statut', 'en_cours')
      .order('date_approbation', { ascending: true });
    setRoulements(data || []);
    setLoading(false);
  }

  async function rembourser(r) {
    const montantDu = r.montant_du || r.montant;
    Alert.alert('💰 Remboursement total',
      `${r.adherents.nom} ${r.adherents.prenom}\n${r.nb_pas} pas\nMontant : ${montantDu.toLocaleString()} FCFA\n\nConfirmer ?`,
      [{ text: 'Annuler', style: 'cancel' },
       { text: 'Confirmer', onPress: async () => {
          setSaving(true);
          await supabase.from('roulement').update({
            statut: 'rembourse', date_remboursement: today, montant_du: 0,
          }).eq('roulement_id', r.roulement_id);
          const { data: f } = await supabase.from('fonds_roulement').select('solde, fonds_id').single();
          await supabase.from('fonds_roulement').update({ solde: (f?.solde || 0) + montantDu }).eq('fonds_id', f.fonds_id);
          await supabase.from('mouvement_fonds_roulement').insert({
            roulement_id: r.roulement_id, type_mouvement: 'remboursement',
            montant: montantDu, date_mouvement: today,
            description: `Remboursement total — ${r.adherents.nom} ${r.adherents.prenom}`,
          });
          load(); setSaving(false);
        }}
      ]);
  }

  async function sanctionnerAbsence(r) {
    Alert.alert('⚠️ Sanction absence',
      `${r.adherents.nom} ${r.adherents.prenom}\nAbsent le dimanche de sa remise.\nDette : ${SANCTION_ABS} FCFA`,
      [{ text: 'Annuler', style: 'cancel' },
       { text: 'Sanctionner', style: 'destructive', onPress: async () => {
          setSaving(true);
          await supabase.from('dettes').insert({
            adherent_id: r.adherent_id, type_dette: 'sanction_roulement',
            montant: SANCTION_ABS, montant_initial: SANCTION_ABS, montant_rembourse: 0, montant_restant: SANCTION_ABS,
            description: `Absence dimanche remise roulement (${r.nb_pas} pas)`,
            date_creation: today, statut: 'en_cours',
          });
          const { data: adh } = await supabase.from('adherents')
            .select('nb_dettes_en_cours').eq('adherent_id', r.adherent_id).single();
          await supabase.from('adherents')
            .update({ nb_dettes_en_cours: (adh?.nb_dettes_en_cours || 0) + 1 })
            .eq('adherent_id', r.adherent_id);
          Alert.alert('✅ Sanction enregistrée', `Dette de ${SANCTION_ABS} FCFA créée.`);
          load(); setSaving(false);
        }}
      ]);
  }

  return (
    <View style={styles.container}>
      <Header title="📋 Roulements en cours" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} /> :
        <FlatList data={roulements} keyExtractor={r => r.roulement_id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const estDimancheRemise = item.date_dimanche_remise === dateDimanche;
            const cotisJour         = item.cotisation_par_dim || item.nb_pas * COTIS_PAS;
            return (
              <View style={[styles.venteCard, estDimancheRemise && styles.venteCardActif]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.venteNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                  <Text style={styles.venteSub}>
                    {item.nb_pas} pas · Approuvé le {item.date_approbation
                      ? new Date(item.date_approbation + 'T12:00:00').toLocaleDateString('fr-FR') : '—'}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#7030A0', marginTop: 4 }}>
                    Cotisation/dim : {cotisJour.toLocaleString()} FCFA
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#C55A11', marginTop: 2 }}>
                    À rembourser : {(item.montant_du || item.montant).toLocaleString()} FCFA
                  </Text>
                  {estDimancheRemise && (
                    <Text style={{ fontSize: 12, color: '#7030A0', fontWeight: 'bold', marginTop: 4 }}>
                      📅 Dimanche de remise aujourd'hui
                    </Text>
                  )}
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity style={styles.btnRembourser} onPress={() => rembourser(item)} disabled={saving}>
                    <Text style={styles.btnRembourserText}>✅{'\n'}Remb.</Text>
                  </TouchableOpacity>
                  {estDimancheRemise && (
                    <TouchableOpacity style={styles.btnSanction} onPress={() => sanctionnerAbsence(item)} disabled={saving}>
                      <Text style={styles.btnSanctionText}>⚠️{'\n'}Abs.</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun roulement en cours.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE
// ══════════════════════════════════════════════════════════════
function HistoriqueRoulementScreen({ onBack }) {
  const [roulements, setRoulements] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('roulement')
      .select('*, adherents(nom, prenom)').in('statut', ['rembourse', 'rejete'])
      .order('date_demande', { ascending: false });
    setRoulements(data || []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📜 Historique roulements" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} /> :
        <FlatList data={roulements} keyExtractor={r => r.roulement_id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.historiqueCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.venteNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                <Text style={styles.venteSub}>
                  {new Date(item.date_demande + 'T12:00:00').toLocaleDateString('fr-FR')} · {item.nb_pas} pas
                </Text>
                <Text style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{item.montant.toLocaleString()} FCFA</Text>
              </View>
              <View style={[styles.statutBadge, { backgroundColor: item.statut === 'rembourse' ? '#E8F5E9' : '#FFEBEE' }]}>
                <Text style={{ color: item.statut === 'rembourse' ? '#1E7E34' : '#C00000', fontWeight: 'bold', fontSize: 12 }}>
                  {item.statut === 'rembourse' ? '✅ Remb.' : '✕ Rejeté'}
                </Text>
              </View>
            </View>
          )}
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
  header:             { backgroundColor: '#7030A0', padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:            { color: '#E8D5F5', fontSize: 14 },
  statsRow:           { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:           { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderTopWidth: 4 },
  statCardNum:        { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  statCardLabel:      { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  alertBox:           { backgroundColor: '#F3E8FF', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#7030A0' },
  alertText:          { color: '#7030A0', fontWeight: 'bold', fontSize: 13 },
  btnPrimary:         { backgroundColor: '#7030A0', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:     { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary:       { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText:   { color: '#1F3864', fontSize: 15, fontWeight: '600' },
  reglesBox:          { backgroundColor: '#F3E8FF', borderRadius: 12, padding: 14, marginTop: 4, borderLeftWidth: 4, borderLeftColor: '#7030A0' },
  reglesTitre:        { fontSize: 13, fontWeight: 'bold', color: '#7030A0', marginBottom: 8 },
  regle:              { fontSize: 13, color: '#555', marginBottom: 4 },
  inputLabel:         { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  infoBox:            { backgroundColor: '#F3E8FF', borderRadius: 8, padding: 10, marginTop: 8 },
  infoText:           { fontSize: 13, color: '#555' },
  pasSelector:        { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4 },
  pasBtn:             { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: '#D6E4F0' },
  pasBtnActive:       { backgroundColor: '#7030A0', borderColor: '#7030A0' },
  pasBtnActuel:       { borderColor: '#7030A0', borderStyle: 'dashed' },
  pasBtnDisabled:     { backgroundColor: '#f5f5f5', borderColor: '#eee' },
  pasBtnText:         { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  pasBtnTextActive:   { color: '#fff' },
  pasBtnSub:          { fontSize: 11, color: '#888', marginTop: 2 },
  calcCard:           { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 10, elevation: 2 },
  calcTitle:          { fontSize: 14, fontWeight: 'bold', color: '#7030A0', marginBottom: 10 },
  calcRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  calcLabel:          { color: '#666', fontSize: 14, flex: 1 },
  calcVal:            { fontSize: 14, fontWeight: '600', color: '#333' },
  fondsBand:          { backgroundColor: '#F3E8FF', padding: 10, alignItems: 'center' },
  fondsBandText:      { fontSize: 13, fontWeight: 'bold', color: '#7030A0', textAlign: 'center' },
  demandeCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  demandeNom:         { fontSize: 16, fontWeight: 'bold', color: '#1F3864' },
  demandeSub:         { fontSize: 12, color: '#888', marginTop: 2 },
  demandeBtns:        { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnApprouver:       { flex: 1, backgroundColor: '#1E7E34', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnApprouverText:   { color: '#fff', fontWeight: 'bold' },
  btnRejeter:         { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C00000' },
  btnRejeterText:     { color: '#C00000', fontWeight: 'bold' },
  cotisCard:          { borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  cotisCardPaye:      { backgroundColor: '#E8F5E9', borderLeftWidth: 4, borderLeftColor: '#1E7E34' },
  cotisCardNonPaye:   { backgroundColor: '#FFEBEE', borderLeftWidth: 4, borderLeftColor: '#C00000' },
  cotisNom:           { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  cotisSub:           { fontSize: 12, color: '#888', marginTop: 2 },
  cotisMontant:       { fontSize: 16, fontWeight: 'bold' },
  stickyBottom:       { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#F0F4F8', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  venteCard:          { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  venteCardActif:     { borderLeftWidth: 4, borderLeftColor: '#7030A0' },
  venteNom:           { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  venteSub:           { fontSize: 12, color: '#888', marginTop: 2 },
  btnRembourser:      { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#1E7E34', alignItems: 'center', marginLeft: 8 },
  btnRembourserText:  { color: '#1E7E34', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  btnSanction:        { backgroundColor: '#FFF3E0', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#C55A11', alignItems: 'center', marginLeft: 8 },
  btnSanctionText:    { color: '#C55A11', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  historiqueCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  statutBadge:        { borderRadius: 8, padding: 8, alignItems: 'center', marginLeft: 8 },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle:         { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 16 },
  modalItem:          { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8' },
  modalItemActive:    { backgroundColor: '#7030A0' },
  modalItemNoir:      { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  modalItemText:      { fontSize: 15, color: '#333' },
  modalClose:         { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText:     { color: '#666', fontWeight: 'bold' },
  empty:              { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});