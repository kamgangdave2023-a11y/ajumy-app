import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { caisseVentes } from '../lib/caisse';
// Caisse Ventes importé depuis ../lib/caisse

// ── Modal Alert global (compatible web) ──────────────────────
// Utilisation : alertRef.current.show(titre, message, boutons)
const _alertQueue = [];
let _alertSetter = null;
function showAlert(titre, message, boutons) {
  const payload = { titre, message, boutons: boutons || [{ text: 'OK' }] };
  if (_alertSetter) { _alertSetter(payload); }
  else { _alertQueue.push(payload); }
}
function AlertModal() {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    _alertSetter = setData;
    if (_alertQueue.length > 0) setData(_alertQueue.shift());
    return () => { _alertSetter = null; };
  }, []);
  if (!data) return null;
  const dismiss = (btn) => {
    setData(null);
    if (btn?.onPress) btn.onPress();
    if (_alertQueue.length > 0) setTimeout(() => setData(_alertQueue.shift()), 100);
  };
  return (
    <Modal transparent animationType="fade" visible>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:24 }}>
        <View style={{ backgroundColor:'#fff', borderRadius:16, padding:24, width:'100%', maxWidth:380, elevation:10 }}>
          <Text style={{ fontSize:17, fontWeight:'bold', color:'#1F3864', marginBottom:10 }}>{data.titre}</Text>
          {data.message ? <Text style={{ fontSize:14, color:'#444', lineHeight:22, marginBottom:20 }}>{data.message}</Text> : null}
          <View style={{ flexDirection:'row', justifyContent:'flex-end', gap:10 }}>
            {data.boutons.map((btn, i) => (
              <TouchableOpacity key={i} onPress={() => dismiss(btn)}
                style={{ paddingHorizontal:20, paddingVertical:10, borderRadius:10,
                  backgroundColor: btn.style === 'cancel' ? '#eee' : btn.color || '#C55A11' }}>
                <Text style={{ color: btn.style === 'cancel' ? '#444' : '#fff', fontWeight:'bold', fontSize:14 }}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Arrondis FCFA ─────────────────────────────────────────────
// Coupures : 5,10,25,50,100,200,250,500,1000,2000,5000,10000
// Distance absolue → coupure la plus proche (sup si égale distance)
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
//  ACCUEIL VENTES
// ══════════════════════════════════════════════════════════════
export default function VentesScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [vue, setVue]       = useState('accueil');
  const [stats, setStats]   = useState({ demandes: 0, enCours: 0, rembourses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    const { data } = await supabase.from('vente_banque').select('statut');
    const demandes   = (data || []).filter(v => v.statut === 'demande').length;
    const enCours    = (data || []).filter(v => v.statut === 'en_cours').length;
    const rembourses = (data || []).filter(v => v.statut === 'rembourse').length;
    setStats({ demandes, enCours, rembourses });
    setLoading(false);
  }

  // ── Disponible global du jour (pour info bureau) ──────────
  const [disponibleJour, setDisponibleJour] = useState(null);
  useEffect(() => { loadDisponible(); }, []);
  async function loadDisponible() {
    const today = new Date().toISOString().split('T')[0];
    const day   = new Date().getDay();
    const diff  = new Date().getDate() - day + (day === 0 ? 0 : 7 - day);
    const dateDim = new Date(new Date().setDate(diff)).toISOString().split('T')[0];

    const [{ data: comptes }, { data: retours }, { data: ventesEnCours }] = await Promise.all([
      supabase.from('compte_banque').select('capital_cumule'),
      supabase.from('vente_banque').select('montant_vente').eq('statut', 'rembourse').eq('date_remboursement', dateDim),
      supabase.from('vente_banque').select('montant_vente').eq('statut', 'en_cours'),
    ]);
    const capitalTotal   = (comptes       || []).reduce((s, c) => s + c.capital_cumule, 0);
    const retoursTotal   = (retours       || []).reduce((s, v) => s + v.montant_vente, 0);
    const ventesTotal    = (ventesEnCours || []).reduce((s, v) => s + v.montant_vente, 0);
    // Disponible = capital actuel (avec intérêts déjà crédités) − montants prêtés non remboursés
    setDisponibleJour(capitalTotal - ventesTotal + retoursTotal);
  }

  if (vue === 'demander') console.log('render DemanderVenteScreen', { saving, selectedAdh: !!selectedAdh });  return <DemanderVenteScreen  onBack={() => { setVue('accueil'); loadStats(); loadDisponible(); }} />;
  if (vue === 'approuver')  return <ApprouverVentesScreen onBack={() => { setVue('accueil'); loadStats(); loadDisponible(); }} />;
  if (vue === 'enCours')    return <VentesEnCoursScreen   onBack={() => { setVue('accueil'); loadStats(); loadDisponible(); }} />;
  if (vue === 'historique') return <HistoriqueVentesScreen onBack={() => { setVue('accueil'); loadStats(); }} />;

  return (
    <View style={styles.container}>
      <AlertModal />
      <Header title="💵 Ventes" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Stats */}
        {loading ? <ActivityIndicator color="#C55A11" style={{ marginTop: 20 }} /> : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: '#C55A11' }]}>
              <Text style={[styles.statCardNum, { color: stats.demandes > 0 ? '#C55A11' : '#1F3864' }]}>{stats.demandes}</Text>
              <Text style={styles.statCardLabel}>Demandes{'\n'}en attente</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#7030A0' }]}>
              <Text style={styles.statCardNum}>{stats.enCours}</Text>
              <Text style={styles.statCardLabel}>Ventes{'\n'}en cours</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#1E7E34' }]}>
              <Text style={styles.statCardNum}>{stats.rembourses}</Text>
              <Text style={styles.statCardLabel}>Remboursées{'\n'}au total</Text>
            </View>
          </View>
        )}

        {/* Disponible du jour */}
        {disponibleJour !== null && (
          <View style={styles.disponibleJourBox}>
            <Text style={styles.disponibleJourLabel}>💰 Disponible total aujourd'hui</Text>
            <Text style={styles.disponibleJourVal}>{disponibleJour.toLocaleString()} FCFA</Text>
            <Text style={styles.disponibleJourSub}>Capitaux banque + retours du jour</Text>
          </View>
        )}

        {/* Alerte demandes */}
        {stats.demandes > 0 && (
          <TouchableOpacity style={styles.alertBox} onPress={() => setVue('approuver')}>
            <Text style={styles.alertText}>🔔 {stats.demandes} demande(s) en attente d'approbation → Approuver</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setVue('demander')}>
          <Text style={styles.btnPrimaryText}>📝 Enregistrer une demande de vente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('approuver')}>
          <Text style={styles.btnSecondaryText}>
            ✅ Approuver les ventes {stats.demandes > 0 ? `(${stats.demandes} en attente)` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('enCours')}>
          <Text style={styles.btnSecondaryText}>
            📋 Ventes en cours {stats.enCours > 0 ? `(${stats.enCours})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('historique')}>
          <Text style={styles.btnSecondaryText}>📜 Historique des ventes</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  DEMANDE DE VENTE
//  Disponible = Ord + Scol + retours du jour
//  Répartition proportionnelle sur les 2 banques
// ══════════════════════════════════════════════════════════════
function DemanderVenteScreen({ onBack }) {
  const [adherents, setAdherents]       = useState([]);
  const [selectedAdh, setSelectedAdh]   = useState(null);
  const [compteOrd, setCompteOrd]       = useState(null);
  const [compteScol, setCompteScol]     = useState(null);
  const [retoursDuJour, setRetoursDuJour] = useState(0);
  const [montantVente, setMontantVente] = useState('');
  const [showPicker, setShowPicker]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [loading, setLoading]           = useState(true);

  const dateDimanche = (() => {
    const t = new Date(); const day = t.getDay();
    // Dernier dimanche passé (ou aujourd'hui si dimanche)
    const diff = t.getDate() - (day === 0 ? 0 : day);
    return new Date(new Date().setDate(diff)).toISOString().split('T')[0];
  })();

  useEffect(() => { loadAdherents(); loadRetours(); }, []);

  async function loadAdherents() {
    setLoading(true);
    const { data } = await supabase
      .from('adherents').select('adherent_id, nom, prenom, liste_noire, motif_liste_noire')
      .in('statut', ['actif', 'en_observation']).order('nom');
    setAdherents(data || []);
    setLoading(false);
  }

  async function loadRetours() {
    const { data } = await supabase.from('vente_banque')
      .select('montant_vente').eq('statut', 'rembourse').eq('date_remboursement', dateDimanche);
    setRetoursDuJour((data || []).reduce((s, v) => s + v.montant_vente, 0));
  }

  async function selectionner(adh) {
    setSelectedAdh(adh);
    setShowPicker(false);
    // Charger le POOL TOTAL (tous les déposants), pas le compte personnel du demandeur
    const { data: tousComptes } = await supabase.from('compte_banque')
      .select('type_banque, capital_cumule').gt('capital_cumule', 0);
    const poolOrd  = (tousComptes || []).filter(c => c.type_banque === 'ordinaire').reduce((s, c) => s + c.capital_cumule, 0);
    const poolScol = (tousComptes || []).filter(c => c.type_banque === 'scolaire') .reduce((s, c) => s + c.capital_cumule, 0);
    // Déduire les ventes en cours du pool disponible
    const { data: ventesEC } = await supabase.from('vente_banque').select('montant_ord, montant_scol').eq('statut', 'en_cours');
    const venteOrd  = (ventesEC || []).reduce((s, v) => s + (v.montant_ord  || 0), 0);
    const venteScol = (ventesEC || []).reduce((s, v) => s + (v.montant_scol || 0), 0);
    const dispOrd  = Math.max(0, poolOrd  - venteOrd);
    const dispScol = Math.max(0, poolScol - venteScol);
    setCompteOrd({ capital_cumule: dispOrd,  type_banque: 'ordinaire' });
    setCompteScol({ capital_cumule: dispScol, type_banque: 'scolaire' });
    setMontantVente((dispOrd + dispScol + retoursDuJour).toString());
  }

  const disponibleOrd   = compteOrd?.capital_cumule  || 0;
  const disponibleScol  = compteScol?.capital_cumule || 0;
  const disponibleTotal = disponibleOrd + disponibleScol + retoursDuJour;
  const montant         = parseInt(montantVente) || 0;

  // Répartition proportionnelle sur le pool (retours au prorata Ord/Scol)
  const baseOrd   = disponibleOrd;
  const baseScol  = disponibleScol;
  const baseTotal = baseOrd + baseScol;
  const partOrd   = baseTotal > 0 ? baseOrd  / baseTotal : 0.5;
  const partScol  = baseTotal > 0 ? baseScol / baseTotal : 0.5;
  const montantOrd  = Math.floor(montant * partOrd);
  const montantScol = montant - montantOrd;

  // 5% exact — toujours une coupure valide (multiple de 5)
  const interetsOrd   = Math.round(montantOrd  * 0.05);
  const interetsScol  = Math.round(montantScol * 0.05);
  const interetsBruts = interetsOrd + interetsScol;
  const interetsAjumy = Math.round(interetsBruts * 0.30);
  const interetsPool  = interetsBruts - interetsAjumy;
  const montantNet    = montant - interetsBruts;
  const sanctionUnitaire = Math.round(montant * 0.15);

  async function soumettre() {
    console.log('SOUMETTRE CLIQUÉ');
    if (!selectedAdh || !montantVente) { console.log('CHAMPS MANQUANTS'); showAlert('Champs manquants'); return; }
    if (montant <= 0) { console.log('MONTANT INVALIDE'); showAlert('Montant invalide'); return; }
    if (selectedAdh.liste_noire) { console.log('LISTE NOIRE'); return; }
    if (montant > disponibleTotal) {
      showAlert('Montant trop élevé',
        `Disponible : ${disponibleTotal.toLocaleString()} FCFA\n\nVoulez-vous demander le maximum ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: `Demander ${disponibleTotal.toLocaleString()} FCFA`, onPress: () => setMontantVente(disponibleTotal.toString()) },
        ]);
      return;
    }

    // Règle : pas de nouvelle demande si une vente en cours existe déjà
    console.log('VÉRIF VENTE ACTIVE...');
    const { data: venteActive } = await supabase.from('vente_banque')
      .select('vente_id, date_remboursement, statut')
      .eq('adherent_id', selectedAdh.adherent_id)
      .in('statut', ['demande', 'en_cours']).limit(1).maybeSingle();
    console.log('venteActive:', venteActive);
    if (venteActive) {
      showAlert('⚠️ Vente en cours', "Cet adhérent a déjà une vente active.\nIl doit la rembourser avant d'en faire une nouvelle.");
      return;
    }

    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('vente_banque').insert({
      adherent_id:   selectedAdh.adherent_id,
      type_banque:   baseOrd > 0 && baseScol > 0 ? 'combinee' : (baseOrd > 0 ? 'ordinaire' : 'scolaire'),
      date_demande:  today,
      montant_vente: montant,
      montant_ord:   montantOrd,
      montant_scol:  montantScol,
      statut:        'demande',
    });
    console.log('INSERT result:', JSON.stringify(error));
    if (error) showAlert('Erreur', error.message);
    else { showAlert('✅ Demande soumise', 'Le bureau va examiner la demande.'); onBack(); }
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <AlertModal />
      <Header title="📝 Demande de vente" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Text style={styles.inputLabel}>Adhérent *</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={{ color: selectedAdh ? '#333' : '#aaa' }}>
            {selectedAdh ? `${selectedAdh.nom} ${selectedAdh.prenom}` : 'Sélectionner...'}
          </Text>
        </TouchableOpacity>

        {/* Disponible détaillé */}
        {selectedAdh && (
          <View style={styles.disponibleBox}>
            <Text style={styles.disponibleTitre}>💰 Disponible</Text>
            <View style={styles.disponibleRow}>
              <Text style={styles.disponibleLabel}>🏦 Ordinaire</Text>
              <Text style={styles.disponibleVal}>{disponibleOrd.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.disponibleRow}>
              <Text style={styles.disponibleLabel}>📚 Scolaire</Text>
              <Text style={styles.disponibleVal}>{disponibleScol.toLocaleString()} FCFA</Text>
            </View>
            {retoursDuJour > 0 && (
              <View style={styles.disponibleRow}>
                <Text style={styles.disponibleLabel}>🔄 Retours du jour</Text>
                <Text style={[styles.disponibleVal, { color: '#1E7E34' }]}>+{retoursDuJour.toLocaleString()} FCFA</Text>
              </View>
            )}
            <View style={[styles.disponibleRow, { borderTopWidth: 2, borderTopColor: '#C55A11', marginTop: 4 }]}>
              <Text style={[styles.disponibleLabel, { fontWeight: 'bold' }]}>Total disponible</Text>
              <Text style={[styles.disponibleVal, { color: '#C55A11', fontWeight: 'bold' }]}>{disponibleTotal.toLocaleString()} FCFA</Text>
            </View>
          </View>
        )}

        <Text style={styles.inputLabel}>Montant demandé (FCFA) *</Text>
        <TextInput
          style={[styles.input, montant > disponibleTotal && disponibleTotal > 0 && { borderColor: '#C00000' }]}
          value={montantVente} onChangeText={setMontantVente}
          keyboardType="numeric" placeholder="Ex: 30 000"
        />
        {montant > disponibleTotal && disponibleTotal > 0 && (
          <Text style={{ color: '#C00000', fontSize: 12, marginTop: 4 }}>
            ⚠️ Dépasse le disponible ({disponibleTotal.toLocaleString()} FCFA)
          </Text>
        )}

        {/* Simulation */}
        {montant > 0 && montant <= disponibleTotal && (
          <View style={styles.calcCard}>
            <Text style={styles.calcTitle}>📊 Détail de la vente</Text>
            {montantOrd  > 0 && <View style={styles.calcRow}><Text style={styles.calcLabel}>🏦 Prélevé Ordinaire ({Math.round(partOrd * 100)}%)</Text><Text style={styles.calcVal}>{montantOrd.toLocaleString()} FCFA</Text></View>}
            {montantScol > 0 && <View style={styles.calcRow}><Text style={styles.calcLabel}>📚 Prélevé Scolaire ({Math.round(partScol * 100)}%)</Text><Text style={styles.calcVal}>{montantScol.toLocaleString()} FCFA</Text></View>}
            <View style={[styles.calcRow, { marginTop: 8 }]}><Text style={styles.calcLabel}>Intérêts déduits (5%)</Text><Text style={[styles.calcVal, { color: '#C55A11' }]}>- {interetsBruts.toLocaleString()} FCFA</Text></View>
            <View style={styles.calcRow}><Text style={styles.calcLabel}>→ AJUMY (30%)</Text><Text style={styles.calcVal}>{interetsAjumy.toLocaleString()} FCFA</Text></View>
            <View style={styles.calcRow}><Text style={styles.calcLabel}>→ Pool déposants (70%)</Text><Text style={[styles.calcVal, { color: '#1E7E34' }]}>{interetsPool.toLocaleString()} FCFA</Text></View>
            <View style={[styles.calcRow, { borderTopWidth: 2, borderTopColor: '#1E7E34', marginTop: 4 }]}>
              <Text style={[styles.calcLabel, { fontWeight: 'bold' }]}>💵 Adhérent reçoit</Text>
              <Text style={[styles.calcVal, { color: '#1E7E34', fontWeight: 'bold', fontSize: 16 }]}>{montantNet.toLocaleString()} FCFA</Text>
            </View>
            <View style={[styles.calcRow, { borderTopWidth: 1, borderTopColor: '#eee', marginTop: 4 }]}>
              <Text style={[styles.calcLabel, { fontWeight: 'bold' }]}>🔄 À rembourser</Text>
              <Text style={[styles.calcVal, { color: '#C55A11', fontWeight: 'bold' }]}>{montant.toLocaleString()} FCFA</Text>
            </View>
            <View style={[styles.sanctionBox]}>
              <Text style={styles.sanctionTitle}>⏱ Échéances de remboursement</Text>
              <Text style={styles.sanctionText}>• 5 dimanches → reconduire ou rembourser</Text>
              <Text style={styles.sanctionText}>• 10 dimanches → dernier délai</Text>
              <Text style={[styles.sanctionText, { color: '#C00000' }]}>• Sanction si manquement : {sanctionUnitaire.toLocaleString()} FCFA (dette) — cumulée tous les 5 dimanches</Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1 }]} onPress={soumettre} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>📝 Soumettre la demande</Text>}
        </TouchableOpacity>             
      </ScrollView>

      {/* Picker adhérent */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choisir un adhérent</Text>
            {loading ? <ActivityIndicator color="#C55A11" /> :
              <FlatList data={adherents} keyExtractor={a => a.adherent_id} style={{ maxHeight: 420 }}
                renderItem={({ item }) => {
                  const ln = item.liste_noire;
                  return (
                    <TouchableOpacity
                      style={[styles.modalItem, selectedAdh?.adherent_id === item.adherent_id && styles.modalItemActive, ln && styles.modalItemNoir]}
                      onPress={() => {
                        if (ln) { showAlert('🚫 Liste noire', `${item.nom} ${item.prenom} ne peut pas faire de demande.`); return; }
                        selectionner(item);
                      }}
                    >
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
//  APPROUVER LES VENTES — BUREAU
//  Règle : dépôts du jour obligatoires avant approbation
// ══════════════════════════════════════════════════════════════
function ApprouverVentesScreen({ onBack }) {
  const [demandes, setDemandes]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [seanceOk, setSeanceOk]       = useState(false);
  const [showDetail, setShowDetail]   = useState(null);

  const dateDimanche = (() => {
    const t = new Date(); const day = t.getDay();
    // Dernier dimanche passé (ou aujourd'hui si dimanche)
    const diff = t.getDate() - (day === 0 ? 0 : day);
    return new Date(new Date().setDate(diff)).toISOString().split('T')[0];
  })();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // Vérifier si la séance de dépôts du jour est enregistrée
    const { data: depot } = await supabase.from('depot_banque')
      .select('depot_id').eq('date_dimanche', dateDimanche).limit(1).maybeSingle();
    setSeanceOk(!!depot);

    const { data } = await supabase.from('vente_banque')
      .select('*, adherents(nom, prenom)').eq('statut', 'demande')
      .order('date_demande', { ascending: true });
    setDemandes(data || []);
    setLoading(false);
  }

  async function approuver(vente) {
    // ── Vérifications jour et séance ───────────────────────
    const aujourdhui = new Date().getDay(); // 0 = dimanche
    if (aujourdhui !== 0) {
      showAlert('⛔ Action bloquée', 'Les approbations de ventes ne sont possibles que le dimanche.');
      return;
    }
    if (!seanceOk) {
      showAlert('⛔ Dépôts manquants', "Enregistrez d'abord les dépôts du dimanche avant d'approuver des ventes.");
      return;
    }
    setSaving(true);
    try {
      const montantOrd   = vente.montant_ord  || 0;
      const montantScol  = vente.montant_scol || 0;
      const today        = new Date().toISOString().split('T')[0];

      // ── Calculs financiers ──────────────────────────────────
      const interetsOrd   = Math.round(montantOrd  * 0.05);
      const interetsScol  = Math.round(montantScol * 0.05);
      const interetsBruts = interetsOrd + interetsScol;
      const interetsAjumy = Math.round(interetsBruts * 0.30);
      const interetsPool  = interetsBruts - interetsAjumy;
      const montantNet    = vente.montant_vente - interetsBruts;
      const totalDu       = vente.montant_vente;
      const dateLimite5   = new Date(Date.now() + 5 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const sanctionUnit  = Math.round(vente.montant_vente * 0.15);

      // ── Distribution intérêts — Ordinaire ──────────────────
      let distribOrd = [], poolOrd = 0;
      if (montantOrd > 0) {
          const { data: cOrd, error: errOrd } = await supabase
          .from('compte_banque')
          .select('compte_id, capital_cumule, adherent_id, adherents(nom, prenom)')
          .eq('type_banque', 'ordinaire')
          .gt('capital_cumule', 0);
          if (errOrd) throw errOrd;
        poolOrd = (cOrd || []).reduce((s, c) => s + c.capital_cumule, 0);
        const pool70Ord = Math.floor(interetsOrd * 0.70);
          for (const c of (cOrd || [])) {
          if (!c.compte_id) continue;
          const part        = poolOrd > 0 ? c.capital_cumule / poolOrd : 0;
          const interetRecu = Math.round(pool70Ord * part);
          if (interetRecu < 1) continue;
              const { error: errUpdate } = await supabase
            .from('compte_banque')
            .update({ capital_cumule: c.capital_cumule + interetRecu })
            .eq('compte_id', c.compte_id);
          if (errUpdate) console.warn('Update compte ord:', JSON.stringify(errUpdate));
          const { error: errDistrib } = await supabase
            .from('distribution_interet_banque').insert({
              vente_id: vente.vente_id,
              compte_id: c.compte_id,
              adherent_id: c.adherent_id,
              type_banque: 'ordinaire',
              capital_au_moment: c.capital_cumule,
              pool_total: poolOrd,
              part_pct: Math.round(part * 10000) / 100,
              interet_recu: interetRecu,
              date_distribution: today,
            });
              if (errDistrib) throw errDistrib;
          distribOrd.push({
            nom: `${c.adherents?.nom || '?'} ${c.adherents?.prenom || '?'}`,
            capital: c.capital_cumule,
            part_pct: Math.round(part * 10000) / 100,
            interet_recu: interetRecu,
          });
        }
      }

      // ── Distribution intérêts — Scolaire ───────────────────
      let distribScol = [], poolScol = 0;
      if (montantScol > 0) {
          const { data: cScol, error: errScol } = await supabase
          .from('compte_banque')
          .select('compte_id, capital_cumule, adherent_id, adherents(nom, prenom)')
          .eq('type_banque', 'scolaire')
          .gt('capital_cumule', 0);
          if (errScol) { console.warn('[APPROUVER] SKIP distrib scol — erreur fetch'); }
        else {
        poolScol = (cScol || []).reduce((s, c) => s + c.capital_cumule, 0);
        const pool70Scol = Math.floor(interetsScol * 0.70);
          for (const c of (cScol || [])) {
          if (!c.compte_id) continue;
          const part        = poolScol > 0 ? c.capital_cumule / poolScol : 0;
          const interetRecu = Math.round(pool70Scol * part);
          if (interetRecu < 1) continue;
          const { error: errUpdate } = await supabase
            .from('compte_banque')
            .update({ capital_cumule: c.capital_cumule + interetRecu })
            .eq('compte_id', c.compte_id);
          if (errUpdate) console.warn('Update compte scol:', JSON.stringify(errUpdate));
          const { error: errDistribS } = await supabase
            .from('distribution_interet_banque').insert({
              vente_id: vente.vente_id,
              compte_id: c.compte_id,
              adherent_id: c.adherent_id,
              type_banque: 'scolaire',
              capital_au_moment: c.capital_cumule,
              pool_total: poolScol,
              part_pct: Math.round(part * 10000) / 100,
              interet_recu: interetRecu,
              date_distribution: today,
            });
              distribScol.push({
            nom: `${c.adherents?.nom || '?'} ${c.adherents?.prenom || '?'}`,
            capital: c.capital_cumule,
            part_pct: Math.round(part * 10000) / 100,
            interet_recu: interetRecu,
          });
        }
        } // fin else errScol
      }

      // ── Mettre à jour la vente ──────────────────────────────
      const { error: errVente } = await supabase
        .from('vente_banque')
        .update({
          statut:               'en_cours',
          frais_5pct:           interetsBruts,
          frais_ajumy:          interetsAjumy,
          frais_pool:           interetsPool,
          montant_net:          montantNet,
          montant_a_rembourser: totalDu,
          sanction_unitaire:    sanctionUnit,
          prochaine_echeance:   dateLimite5,
          nb_echeances_manquees: 0,
          date_approbation:     today,
        })
        .eq('vente_id', vente.vente_id);
      if (errVente) throw errVente;

      // ── Caisse AJUMY ────────────────────────────────────────
      try {
        if (interetsAjumy > 0) {
          await caisseVentes.frais(interetsAjumy, vente.vente_id, vente.adherent_id);
        }
        await caisseVentes.remise(montantNet, vente.vente_id, vente.adherent_id);
      } catch (caisseErr) {
        console.warn('[APPROUVER] Caisse non critique:', caisseErr?.message);
      }

      // ── Afficher le résumé ───────────────────────────────────
      setShowDetail({
        vente, distribOrd, distribScol,
        montantOrd, montantScol,
        interetsBruts, interetsAjumy, interetsPool,
        montantNet, totalDu, sanctionUnit, dateLimite5,
        poolOrd, poolScol,
      });
      // load() appelé uniquement au retour du résumé, pas ici
    } catch (err) {
      showAlert('❌ Erreur approbation', err.message || JSON.stringify(err));
    }
    setSaving(false);
  }

  async function rejeter(venteId) {
    showAlert('Rejeter ?', 'La demande sera annulée.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Rejeter', style: 'destructive', onPress: async () => {
        await supabase.from('vente_banque').update({ statut: 'rejete' }).eq('vente_id', venteId);
        load();
      }}
    ]);
  }

  // ── Récap après approbation ──────────────────────────────
  if (showDetail) {
    const { vente, distribOrd, distribScol, montantOrd, montantScol, interetsBruts, interetsAjumy, interetsPool, montantNet, totalDu, sanctionUnit, dateLimite5, poolOrd, poolScol } = showDetail;
    return (
      <View style={styles.container}>
        <Header title="✅ Vente approuvée" onBack={() => { setShowDetail(null); load(); }} />
        <ScrollView style={{ padding: 16 }}>
          <View style={[styles.resumeCard, { backgroundColor: '#C55A11' }]}>
            <Text style={styles.resumeTitle}>✅ Vente approuvée !</Text>
            <Text style={styles.resumeDate}>{vente.adherents.nom} {vente.adherents.prenom} · {vente.montant_vente.toLocaleString()} FCFA</Text>
          </View>

          {/* Récap financier */}
          <View style={styles.calcCard}>
            <Text style={styles.calcTitle}>💰 Récapitulatif</Text>
            {montantOrd  > 0 && <View style={styles.calcRow}><Text style={styles.calcLabel}>🏦 Prélevé Ordinaire</Text><Text style={styles.calcVal}>{montantOrd.toLocaleString()} FCFA</Text></View>}
            {montantScol > 0 && <View style={styles.calcRow}><Text style={styles.calcLabel}>📚 Prélevé Scolaire</Text><Text style={styles.calcVal}>{montantScol.toLocaleString()} FCFA</Text></View>}
            <View style={styles.calcRow}><Text style={styles.calcLabel}>Intérêts déduits (5%)</Text><Text style={[styles.calcVal, { color: '#C55A11' }]}>- {interetsBruts.toLocaleString()} FCFA</Text></View>
            <View style={styles.calcRow}><Text style={styles.calcLabel}>→ AJUMY (30%)</Text><Text style={styles.calcVal}>{interetsAjumy.toLocaleString()} FCFA</Text></View>
            <View style={styles.calcRow}><Text style={styles.calcLabel}>→ Pool déposants (70%)</Text><Text style={[styles.calcVal, { color: '#1E7E34' }]}>{interetsPool.toLocaleString()} FCFA</Text></View>
            <View style={[styles.calcRow, { borderTopWidth: 2, borderTopColor: '#1E7E34', marginTop: 4 }]}>
              <Text style={[styles.calcLabel, { fontWeight: 'bold' }]}>💵 Remis à l'adhérent</Text>
              <Text style={[styles.calcVal, { color: '#1E7E34', fontWeight: 'bold', fontSize: 16 }]}>{montantNet.toLocaleString()} FCFA</Text>
            </View>
            <View style={[styles.calcRow, { borderTopWidth: 1, borderTopColor: '#eee', marginTop: 4 }]}>
              <Text style={[styles.calcLabel, { fontWeight: 'bold' }]}>🔄 À rembourser</Text>
              <Text style={[styles.calcVal, { color: '#C55A11', fontWeight: 'bold' }]}>{totalDu.toLocaleString()} FCFA</Text>
            </View>
          </View>

          {/* Échéances */}
          <View style={[styles.calcCard, { backgroundColor: '#FFF8F0' }]}>
            <Text style={styles.calcTitle}>⏱ Échéances</Text>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>1ère échéance (5 dimanches)</Text>
              <Text style={[styles.calcVal, { color: '#C55A11' }]}>{new Date(dateLimite5 + 'T12:00:00').toLocaleDateString('fr-FR')}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>2ème échéance (10 dimanches)</Text>
              <Text style={styles.calcVal}>{new Date(new Date(dateLimite5).getTime() + 5 * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}</Text>
            </View>
            <View style={[styles.sanctionBox, { marginTop: 8 }]}>
              <Text style={styles.sanctionTitle}>⚠️ Sanction si manquement</Text>
              <Text style={[styles.sanctionText, { color: '#C00000', fontWeight: 'bold' }]}>{sanctionUnit.toLocaleString()} FCFA (dette) — cumulée tous les 5 dimanches</Text>
            </View>
          </View>

          {distribOrd.length > 0 && (
            <View style={styles.calcCard}>
              <Text style={styles.calcTitle}>🏦 Intérêts distribués — Ordinaire</Text>
              <Text style={styles.poolSub}>Pool : {poolOrd.toLocaleString()} FCFA</Text>
              {distribOrd.map((d, i) => (
                <View key={i} style={styles.distribRow}>
                  <View style={{ flex: 1 }}><Text style={styles.distribNom}>{d.nom}</Text><Text style={styles.distribDetail}>{d.capital.toLocaleString()} FCFA · {d.part_pct}%</Text></View>
                  <Text style={styles.distribInteret}>+{d.interet_recu.toLocaleString()} FCFA</Text>
                </View>
              ))}
            </View>
          )}
          {distribScol.length > 0 && (
            <View style={styles.calcCard}>
              <Text style={styles.calcTitle}>📚 Intérêts distribués — Scolaire</Text>
              <Text style={styles.poolSub}>Pool : {poolScol.toLocaleString()} FCFA</Text>
              {distribScol.map((d, i) => (
                <View key={i} style={styles.distribRow}>
                  <View style={{ flex: 1 }}><Text style={styles.distribNom}>{d.nom}</Text><Text style={styles.distribDetail}>{d.capital.toLocaleString()} FCFA · {d.part_pct}%</Text></View>
                  <Text style={styles.distribInteret}>+{d.interet_recu.toLocaleString()} FCFA</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.btnPrimary} onPress={() => { setShowDetail(null); load(); }}>
            <Text style={styles.btnPrimaryText}>✅ Approuver une autre demande</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#888', marginTop: 8 }]} onPress={onBack}>
            <Text style={styles.btnPrimaryText}>← Retour aux ventes</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AlertModal />
      <Header title="✅ Approuver les ventes" onBack={onBack} />

      {/* Bandeau séance */}
      <View style={[styles.seanceBand, seanceOk ? styles.seanceBandOk : styles.seanceBandWarn]}>
        <Text style={styles.seanceBandText}>
          {seanceOk
            ? `✅ Dépôts du ${new Date(dateDimanche + 'T12:00:00').toLocaleDateString('fr-FR')} enregistrés`
            : `⚠️ Dépôts du ${new Date(dateDimanche + 'T12:00:00').toLocaleDateString('fr-FR')} non encore enregistrés — approuver bloqué`}
        </Text>
      </View>

      {loading ? <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 40 }} /> :
        <FlatList data={demandes} keyExtractor={v => v.vente_id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const interets = Math.floor(item.montant_vente * 0.05);
            const pool70   = interets - Math.floor(interets * 0.30);
            return (
              <View style={styles.demandeCard}>
                <Text style={styles.demandeNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                <Text style={styles.demandeSub}>
                  Demandé le {new Date(item.date_demande + 'T12:00:00').toLocaleDateString('fr-FR')}
                  {item.montant_ord  > 0 ? `  🏦 ${item.montant_ord.toLocaleString()} FCFA` : ''}
                  {item.montant_scol > 0 ? `  📚 ${item.montant_scol.toLocaleString()} FCFA` : ''}
                </Text>
                <View style={{ marginTop: 8, marginBottom: 10 }}>
                  <Text style={styles.demandeMontant}>{item.montant_vente.toLocaleString()} FCFA</Text>
                  <Text style={{ fontSize: 12, color: '#1E7E34', marginTop: 2 }}>Pool 70% à distribuer : {pool70.toLocaleString()} FCFA</Text>
                </View>
                <View style={styles.demandeBtns}>
                  <TouchableOpacity style={[styles.btnApprouver, { opacity: (saving || !seanceOk) ? 0.4 : 1 }]}
                    onPress={() => approuver(item)} disabled={saving || !seanceOk}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnApprouverText}>✅ Approuver</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnRejeter} onPress={() => rejeter(item.vente_id)}>
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
//  VENTES EN COURS — remboursements
// ══════════════════════════════════════════════════════════════
function VentesEnCoursScreen({ onBack }) {
  const [ventes, setVentes]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [alertes, setAlertes]     = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);
  // confirmModal = { titre, message, onConfirm, confirmLabel, confirmColor }

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('vente_banque')
      .select('*, adherents(nom, prenom)').eq('statut', 'en_cours')
      .order('date_approbation', { ascending: true }); // order sur colonne sûre
    if (error) {
      showAlert('Erreur', 'Vérifiez que la migration SQL a bien été exécutée.\n\n' + error.message);
      setLoading(false); return;
    }
    const ventes = data || [];
    const enAlerte = ventes.filter(v => v.prochaine_echeance && v.prochaine_echeance <= today);
    setAlertes(enAlerte);
    setVentes(ventes);
    setLoading(false);
  }

  async function appliquerSanction(vente) {
    // Sanction = 3 × 5% = 15% du montant initial — répétée tous les 5 dimanches
    setSaving(true);
    try {
      const sanction = Math.round(vente.montant_vente * 0.15); // 3 × 5%
      const nbEch    = (vente.nb_echeances_manquees || 0) + 1;
      // Nouvelle échéance = depuis prochaine_echeance (pas depuis aujourd'hui)
      const baseDate = vente.prochaine_echeance
        ? new Date(vente.prochaine_echeance + 'T12:00:00')
        : new Date();
      const nouvelleEcheance = new Date(baseDate.getTime() + 5 * 7 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      // ── Enregistrer la sanction comme dette ─────────────
      const { error: errDette } = await supabase.from('dettes').insert({
        adherent_id:       vente.adherent_id,
        type_dette:        'sanction_vente',
        montant:           sanction,
        montant_initial:   sanction,
        montant_rembourse: 0,
        montant_restant:   sanction,
        description:       `Sanction vente — échéance n°${nbEch} manquée (3×5% = ${sanction.toLocaleString()} FCFA)`,
        date_creation:     today,
        statut:            'en_cours',
      });
      if (errDette) throw errDette;

      // ── Mettre à jour la vente ───────────────────────────
      await supabase.from('vente_banque').update({
        nb_echeances_manquees: nbEch,
        prochaine_echeance:    nouvelleEcheance,
      }).eq('vente_id', vente.vente_id);

      // ── Incrémenter nb_dettes_en_cours sur l'adhérent ───
      const { data: adh } = await supabase.from('adherents')
        .select('nb_dettes_en_cours').eq('adherent_id', vente.adherent_id).single();
      await supabase.from('adherents').update({
        nb_dettes_en_cours: (adh?.nb_dettes_en_cours || 0) + 1,
      }).eq('adherent_id', vente.adherent_id);

      showAlert('⚠️ Sanction appliquée',
        `${vente.adherents.nom} ${vente.adherents.prenom}

` +
        `Sanction n°${nbEch} : ${sanction.toLocaleString()} FCFA (3×5%)
` +
        `Total sanctions : ${(sanction * nbEch).toLocaleString()} FCFA

` +
        `Prochaine échéance : ${new Date(nouvelleEcheance + 'T12:00:00').toLocaleDateString('fr-FR')}`);
    } catch(err) {
      showAlert('❌ Erreur', err.message || JSON.stringify(err));
    }
    load();
    setSaving(false);
  }

  async function reconduire(vente) {
    // ── Max 1 reconduction ──────────────────────────────────
    if ((vente.nb_reconductions || 0) >= 1) {
      showAlert('⛔ Reconduction impossible',
        `${vente.adherents.nom} ${vente.adherents.prenom} a déjà utilisé sa reconduction.

Il doit rembourser les ${(vente.montant_a_rembourser || vente.montant_vente).toLocaleString()} FCFA.

S'il n'y a pas d'autres candidats ce dimanche, il pourra faire une nouvelle demande après remboursement.`);
      return;
    }
    // Frais de reconduction = 5% du montant initial
    const frais = Math.round(vente.montant_vente * 0.05);
    // Nouvelle échéance = depuis prochaine_echeance (pas depuis aujourd'hui)
    const baseDate = vente.prochaine_echeance
      ? new Date(vente.prochaine_echeance + 'T12:00:00')
      : new Date();
    const nouvelleEcheance = new Date(baseDate.getTime() + 5 * 7 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    const nbReconductions  = (vente.nb_reconductions || 0) + 1;

    setConfirmModal({
      titre: '🔄 Reconduction',
      message: `${vente.adherents.nom} ${vente.adherents.prenom}\n\nFrais à payer : ${frais.toLocaleString()} FCFA (5%)\nNouvelle échéance : ${new Date(nouvelleEcheance + 'T12:00:00').toLocaleDateString('fr-FR')}\n(reconduction n°${nbReconductions})`,
      confirmLabel: 'Confirmer',
      confirmColor: '#C55A11',
      onConfirm: async () => {
        setConfirmModal(null);
        setSaving(true);
        try {
            const fraisAjumy = Math.round(frais * 0.30);
            const fraisPool  = frais - fraisAjumy;

            const typeB = vente.type_banque === 'scolaire' ? 'scolaire' : 'ordinaire';
            const { data: comptes } = await supabase.from('compte_banque')
              .select('compte_id, capital_cumule, adherent_id')
              .eq('type_banque', typeB).gt('capital_cumule', 0);
            const poolTotal = (comptes || []).reduce((s, c) => s + c.capital_cumule, 0);
            for (const c of (comptes || [])) {
              if (!c.compte_id || poolTotal === 0) continue;
              const part = c.capital_cumule / poolTotal;
              const gain = Math.round(fraisPool * part);
              if (gain < 1) continue;
              await supabase.from('compte_banque')
                .update({ capital_cumule: c.capital_cumule + gain })
                .eq('compte_id', c.compte_id);
            }

            await supabase.from('vente_banque').update({
              prochaine_echeance: nouvelleEcheance,
              nb_reconductions:   nbReconductions,
              statut:             'en_cours',
            }).eq('vente_id', vente.vente_id);

            try { await caisseVentes.reconduction(fraisAjumy, vente.vente_id, vente.adherent_id); }
            catch(e) { console.warn('Caisse reconduction:', e); }

            setConfirmModal({ titre: '✅ Reconduit', message: `Frais : ${frais.toLocaleString()} FCFA\n→ Pool : ${fraisPool.toLocaleString()} FCFA\n→ AJUMY : ${fraisAjumy.toLocaleString()} FCFA\n\nProchaine échéance : ${new Date(nouvelleEcheance + 'T12:00:00').toLocaleDateString('fr-FR')}`, confirmLabel: 'OK', confirmColor: '#1E7E34', onConfirm: () => setConfirmModal(null) });
          } catch(err) {
            setConfirmModal({ titre: '❌ Erreur', message: err.message || JSON.stringify(err), confirmLabel: 'OK', confirmColor: '#C00000', onConfirm: () => setConfirmModal(null) });
          }
          load(); setSaving(false);
      }
    });
  }

  function rembourser(vente) {
    const montantDu = vente.montant_a_rembourser || vente.montant_vente;
    setConfirmModal({
      titre: '💰 Remboursement',
      message: `${vente.adherents.nom} ${vente.adherents.prenom}\n\nNet reçu : ${(vente.montant_net || 0).toLocaleString()} FCFA\nÀ rembourser : ${montantDu.toLocaleString()} FCFA`,
      confirmLabel: 'Confirmer',
      confirmColor: '#1E7E34',
      onConfirm: async () => {
        setConfirmModal(null);
        setSaving(true);
        try {
          await supabase.from('vente_banque').update({
            statut: 'rembourse',
            montant_rembourse: montantDu,
            date_remboursement: today,
          }).eq('vente_id', vente.vente_id);

          const { data: compte } = await supabase.from('compte_banque')
            .select('capital_cumule, compte_id').eq('adherent_id', vente.adherent_id)
            .eq('type_banque', vente.type_banque === 'combinee' ? 'ordinaire' : (vente.type_banque || 'ordinaire'))
            .maybeSingle();
          if (compte) {
            await supabase.from('compte_banque').update({
              capital_cumule: (compte.capital_cumule || 0) + montantDu,
            }).eq('compte_id', compte.compte_id);
          }

          try { await caisseVentes.remboursement(montantDu, vente.vente_id, vente.adherent_id); }
          catch(e) { console.warn('Caisse remboursement:', e); }

          load();

          const { data: autresDemandes } = await supabase.from('vente_banque')
            .select('vente_id').eq('statut', 'demande')
            .neq('adherent_id', vente.adherent_id).limit(1);
          const msg = (autresDemandes || []).length === 0
            ? `✅ Remboursement enregistré\n\nAucun autre candidat — ${vente.adherents.nom} peut faire une nouvelle demande immédiatement.`
            : `✅ Remboursement enregistré\n\n${autresDemandes.length} autre(s) candidat(s) en attente.`;
          setConfirmModal({ titre: '✅ Succès', message: msg, confirmLabel: 'OK', confirmColor: '#1E7E34', onConfirm: () => setConfirmModal(null) });
        } catch(err) {
          setConfirmModal({ titre: '❌ Erreur', message: err.message || JSON.stringify(err), confirmLabel: 'OK', confirmColor: '#C00000', onConfirm: () => setConfirmModal(null) });
        }
        setSaving(false);
      }
    });
  }

  return (
    <View style={styles.container}>
      <Header title="📋 Ventes en cours" onBack={onBack} />

      {/* ── Modal de confirmation générique ── */}
      {confirmModal && (
        <Modal transparent animationType="fade">
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:24 }}>
            <View style={{ backgroundColor:'#fff', borderRadius:12, padding:24, width:'100%', maxWidth:380 }}>
              <Text style={{ fontSize:17, fontWeight:'bold', color:'#1E2130', marginBottom:12 }}>{confirmModal.titre}</Text>
              <Text style={{ fontSize:14, color:'#444', marginBottom:20, lineHeight:22 }}>{confirmModal.message}</Text>
              <View style={{ flexDirection:'row', gap:10 }}>
                {confirmModal.confirmLabel !== 'OK' && (
                  <TouchableOpacity onPress={() => setConfirmModal(null)}
                    style={{ flex:1, padding:12, borderRadius:8, borderWidth:1, borderColor:'#ccc', alignItems:'center' }}>
                    <Text style={{ color:'#555', fontWeight:'bold' }}>Annuler</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={confirmModal.onConfirm}
                  style={{ flex:1, padding:12, borderRadius:8, backgroundColor: confirmModal.confirmColor || '#1E7E34', alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'bold' }}>{confirmModal.confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Bandeau alertes du jour */}
      {alertes.length > 0 && (
        <View style={styles.alerteBand}>
          <Text style={styles.alerteBandText}>
            🔔 {alertes.length} vente(s) avec échéance dépassée — appliquer sanction ou reconduire
          </Text>
        </View>
      )}

      {loading ? <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 40 }} /> :
        <FlatList data={ventes} keyExtractor={v => v.vente_id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const echeanceDepassee = item.prochaine_echeance && item.prochaine_echeance <= today;
            const nbEch = item.nb_echeances_manquees || 0;
            return (
              <View style={[styles.venteCard, echeanceDepassee && styles.venteCardRetard]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.venteNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                  <Text style={styles.venteSub}>
                    Accordée le {item.date_approbation ? new Date(item.date_approbation + 'T12:00:00').toLocaleDateString('fr-FR') : '—'}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#555', marginTop: 4 }}>
                    Net remis : {(item.montant_net || item.montant_vente).toLocaleString()} FCFA
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#C55A11', marginTop: 2 }}>
                    À rembourser : {(item.montant_a_rembourser || item.montant_vente).toLocaleString()} FCFA
                  </Text>
                  {(item.nb_reconductions||0) > 0 && (
                    <Text style={{ fontSize: 12, color: '#C55A11', marginTop: 2 }}>
                      🔄 {item.nb_reconductions} reconduction(s) — {(Math.round(item.montant_vente*0.05)*item.nb_reconductions).toLocaleString()} FCFA payés
                    </Text>
                  )}
                  {nbEch > 0 && (
                    <Text style={{ fontSize: 12, color: '#C00000', marginTop: 2 }}>
                      ⚠️ {nbEch} sanction(s) — {(Math.round(item.montant_vente*0.15)*nbEch).toLocaleString()} FCFA de dettes
                    </Text>
                  )}
                  {item.prochaine_echeance && (
                    <Text style={{ fontSize: 12, marginTop: 4, color: echeanceDepassee ? '#C00000' : '#888', fontWeight: echeanceDepassee ? 'bold' : 'normal' }}>
                      {echeanceDepassee ? '⏰ Échéance dépassée' : `⏱ Échéance : ${new Date(item.prochaine_echeance + 'T12:00:00').toLocaleDateString('fr-FR')}`}
                    </Text>
                  )}
                </View>

                {/* Boutons d'action */}
                <View style={{ gap: 6 }}>
                  <TouchableOpacity style={styles.btnRembourser} onPress={() => rembourser(item)} disabled={saving}>
                    <Text style={styles.btnRembourserText}>✅{'\n'}Remb.</Text>
                  </TouchableOpacity>
                  {echeanceDepassee && (item.nb_reconductions || 0) === 0 && (
                    <TouchableOpacity style={styles.btnReconduire} onPress={() => reconduire(item)} disabled={saving}>
                      <Text style={styles.btnReconduireText}>🔄{'\n'}+5 dim.</Text>
                    </TouchableOpacity>
                  )}
                  {echeanceDepassee && (item.nb_reconductions || 0) >= 1 && (
                    <View style={[styles.btnReconduire, { opacity: 0.4 }]}>
                      <Text style={styles.btnReconduireText}>🔄{'\n'}utilisée</Text>
                    </View>
                  )}
                  {echeanceDepassee && (
                    <TouchableOpacity style={styles.btnSanction} onPress={() => appliquerSanction(item)} disabled={saving}>
                      <Text style={styles.btnSanctionText}>⚠️{'\n'}Sanct.</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucune vente en cours.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE
// ══════════════════════════════════════════════════════════════
function HistoriqueVentesScreen({ onBack }) {
  const [ventes, setVentes]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('vente_banque')
      .select('*, adherents(nom, prenom)')
      .in('statut', ['en_cours', 'rembourse', 'rejete'])
      .order('date_demande', { ascending: false });
    setVentes(data || []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📜 Historique ventes" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 40 }} /> :
        <FlatList data={ventes} keyExtractor={v => v.vente_id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.historiqueCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.venteNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                <Text style={styles.venteSub}>{new Date(item.date_demande + 'T12:00:00').toLocaleDateString('fr-FR')}</Text>
                <Text style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{item.montant_vente.toLocaleString()} FCFA · Intérêts : {(item.frais_5pct || 0).toLocaleString()} FCFA</Text>
              </View>
              <View style={[styles.statutBadge, {
                backgroundColor: item.statut === 'rembourse' ? '#E8F5E9' : item.statut === 'en_cours' ? '#FFF3E0' : '#FFEBEE'
              }]}>
                <Text style={{
                  color: item.statut === 'rembourse' ? '#1E7E34' : item.statut === 'en_cours' ? '#C55A11' : '#C00000',
                  fontWeight: 'bold', fontSize: 12
                }}>
                  {item.statut === 'rembourse' ? '✅ Remb.' : item.statut === 'en_cours' ? '⏳ En cours' : '✕ Rejeté'}
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
  header:             { backgroundColor: '#C55A11', padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:            { color: '#FFE0CC', fontSize: 14 },

  statsRow:           { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:           { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderTopWidth: 4 },
  statCardNum:        { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  statCardLabel:      { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },

  disponibleJourBox:  { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#C55A11' },
  disponibleJourLabel:{ fontSize: 13, color: '#C55A11', fontWeight: 'bold' },
  disponibleJourVal:  { fontSize: 22, fontWeight: 'bold', color: '#1F3864', marginTop: 4 },
  disponibleJourSub:  { fontSize: 12, color: '#888', marginTop: 2 },

  alertBox:           { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#C55A11' },
  alertText:          { color: '#C55A11', fontWeight: 'bold', fontSize: 13 },

  btnPrimary:         { backgroundColor: '#C55A11', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:     { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary:       { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText:   { color: '#1F3864', fontSize: 15, fontWeight: '600' },

  inputLabel:         { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },

  disponibleBox:      { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 4 },
  disponibleTitre:    { fontSize: 13, fontWeight: 'bold', color: '#C55A11', marginBottom: 8 },
  disponibleRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(197,90,17,0.15)' },
  disponibleLabel:    { color: '#555', fontSize: 14 },
  disponibleVal:      { fontSize: 14, fontWeight: '600', color: '#333' },

  calcCard:           { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 10, elevation: 2 },
  calcTitle:          { fontSize: 14, fontWeight: 'bold', color: '#C55A11', marginBottom: 10 },
  calcRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  calcLabel:          { color: '#666', fontSize: 14 },
  calcVal:            { fontSize: 14, fontWeight: '600', color: '#333' },

  seanceBand:         { padding: 10, alignItems: 'center' },
  seanceBandOk:       { backgroundColor: '#E8F5E9' },
  seanceBandWarn:     { backgroundColor: '#FFF3E0' },
  seanceBandText:     { fontSize: 13, fontWeight: '600' },

  demandeCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  demandeNom:         { fontSize: 16, fontWeight: 'bold', color: '#1F3864' },
  demandeSub:         { fontSize: 12, color: '#888', marginTop: 2 },
  demandeMontant:     { fontSize: 16, fontWeight: 'bold', color: '#C55A11' },
  demandeBtns:        { flexDirection: 'row', gap: 10 },
  btnApprouver:       { flex: 1, backgroundColor: '#1E7E34', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnApprouverText:   { color: '#fff', fontWeight: 'bold' },
  btnRejeter:         { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C00000' },
  btnRejeterText:     { color: '#C00000', fontWeight: 'bold' },

  venteCard:          { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  venteCardRetard:    { borderLeftWidth: 4, borderLeftColor: '#C00000' },
  venteNom:           { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  venteSub:           { fontSize: 12, color: '#888', marginTop: 2 },
  btnRembourser:      { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#1E7E34', alignItems: 'center', marginLeft: 8, minWidth: 52 },
  btnRembourserText:  { color: '#1E7E34', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
  btnReconduire:      { backgroundColor: '#E3F2FD', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#1565C0', alignItems: 'center', marginLeft: 8, minWidth: 52 },
  btnReconduireText:  { color: '#1565C0', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
  btnSanction:        { backgroundColor: '#FFEBEE', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#C00000', alignItems: 'center', marginLeft: 8, minWidth: 52 },
  btnSanctionText:    { color: '#C00000', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
  alerteBand:         { backgroundColor: '#FFEBEE', padding: 12, borderBottomWidth: 1, borderBottomColor: '#FFCDD2' },
  alerteBandText:     { color: '#C00000', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  sanctionBox:        { backgroundColor: '#FFF3E0', borderRadius: 8, padding: 10, marginTop: 8 },
  sanctionTitle:      { fontSize: 13, fontWeight: 'bold', color: '#C55A11', marginBottom: 4 },
  sanctionText:       { fontSize: 12, color: '#555', marginTop: 2 },

  historiqueCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  statutBadge:        { borderRadius: 8, padding: 8, alignItems: 'center', marginLeft: 8 },

  poolSub:            { color: '#888', fontSize: 12, marginBottom: 8 },
  distribRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  distribNom:         { fontSize: 14, fontWeight: 'bold', color: '#1F3864' },
  distribDetail:      { fontSize: 12, color: '#888', marginTop: 2 },
  distribInteret:     { fontSize: 15, fontWeight: 'bold', color: '#1E7E34' },

  resumeCard:         { borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  resumeTitle:        { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  resumeDate:         { color: '#FFE0CC', fontSize: 14, marginTop: 8 },

  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle:         { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 16 },
  modalItem:          { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8' },
  modalItemActive:    { backgroundColor: '#C55A11' },
  modalItemNoir:      { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  modalItemText:      { fontSize: 15, color: '#333' },
  modalClose:         { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText:     { color: '#666', fontWeight: 'bold' },

  empty:              { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});