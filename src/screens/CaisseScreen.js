import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { AjumyDatePicker, toSupabaseDate } from '../components/AjumyDateTimePicker';

// ── Structure exacte du cahier comptable AJUMY ───────────────
const ENTREES = [
  { cle: 'internet_roulement',    label: 'Internet roulement' },
  { cle: 'retour_roulement',      label: 'Retour roulement' },
  { cle: 'retour_presence',       label: 'Retour présence' },
  { cle: 'supplement_presence',   label: 'Supplément présence' },
  { cle: 'retour_vente',          label: 'Retour vente du mois' },
  { cle: 'interet_vente',         label: 'Intérêt vente du mois' },
  { cle: 'banque_ordinaire',      label: 'Banque ordinaire' },
  { cle: 'banque_scolaire',       label: 'Banque scolaire' },
  { cle: 'projet',                label: 'Projet' },
  { cle: 'fond_malheur_maladie',  label: 'Fond malheur/maladie' },
  { cle: 'fond_caisse',           label: 'Fond de caisse' },
  { cle: 'mariage',               label: 'Mariage' },
  { cle: 'inscription',           label: 'Inscription' },
  { cle: 'recouvrement_mm',       label: 'Recouvrement M/M' },
  { cle: 'retour_huile_savon',    label: 'Retour huile+savon' },
  { cle: 'entretien_cahiers',     label: 'Entretien cahiers' },
  { cle: 'retour_tontine_15000',  label: 'Retour Tontine 15000' },
  { cle: 'porte',                 label: 'Porte' },
  { cle: 'sanctions',             label: 'Sanctions' },
  { cle: 'location_chaises',      label: 'Location chaises' },
  { cle: 'argents_saisis',        label: 'Argents saisis',        multiple: true },
  { cle: 'recouvrement_dette',    label: 'Recouvrement dette',    multiple: true },
  { cle: 'surplus',               label: 'Surplus' },
  { cle: 'autre_entree',          label: 'Autre entrée' },
];

const SORTIES = [
  { cle: 'sorties_roulements',        label: 'Sorties Roulements' },
  { cle: 'complement_presence',       label: 'Complément présence' },
  { cle: 'vente_du_mois',             label: 'Vente du mois' },
  { cle: 'complement_huile_savon',    label: 'Complément huile+savon' },
  { cle: 'complement_tontine_15000',  label: 'Complément Tontine 15000' },
  { cle: 'complement_tontine_6000',   label: 'Complément Tontine 6000' },
  { cle: 'aide_malheur_maladie',      label: 'Aide Malheur maladie' },
  { cle: 'autre_sortie',              label: 'Autre sortie' },
];

const DEPENSES = [
  { cle: 'achats_fournitures',        label: 'Achats fournitures' },
  { cle: 'boissons_fin_mois',         label: 'Boissons fin du mois' },
  { cle: 'transports',                label: 'Transports' },
  { cle: 'nettoyage_salle',           label: 'Nettoyage de la salle' },
  { cle: 'cassation_banque',          label: 'Cassation banque scolaire/ordinaire' },
  { cle: 'manquant',                  label: 'Manquant' },
  { cle: 'autre_depense',             label: 'Autre dépense' },
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

function fmt(n) { return (n || 0).toLocaleString() + ' FCFA'; }

// ══════════════════════════════════════════════════════════════
//  ACCUEIL CAISSE
// ══════════════════════════════════════════════════════════════
export default function CaisseScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [vue, setVue]           = useState('accueil');
  const [sessionId, setSessionId] = useState(null);
  const [stats, setStats]       = useState({ solde: 0, totalEntrees: 0, totalSorties: 0, totalDepenses: 0, nbSessions: 0 });
  const [derniereSessions, setDerniereSessions] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);

    // Sessions manuelles du dimanche
    const { data: sessions } = await supabase
      .from('session_caisse').select('*').order('date_session', { ascending: false });

    const entreesSessions  = (sessions || []).reduce((s, sess) => s + (sess.total_entrees || 0), 0);
    const sortiesSessions  = (sessions || []).reduce((s, sess) => s + (sess.total_sorties || 0), 0);
    const depensesSessions = (sessions || []).reduce((s, sess) => s + (sess.total_depenses || 0), 0);

    // Mouvements automatiques des modules (présence, banque, ventes, roulement...)
    const { data: mouvements } = await supabase
      .from('mouvement_caisse').select('type_mouvement, montant').eq('automatique', true);

    const entreesAuto  = (mouvements || []).filter(m => m.type_mouvement === 'entree') .reduce((s, m) => s + (m.montant || 0), 0);
    const sortiesAuto  = (mouvements || []).filter(m => m.type_mouvement === 'sortie') .reduce((s, m) => s + (m.montant || 0), 0);
    const depensesAuto = (mouvements || []).filter(m => m.type_mouvement === 'depense').reduce((s, m) => s + (m.montant || 0), 0);

    const totalEntrees  = entreesSessions  + entreesAuto;
    const totalSorties  = sortiesSessions  + sortiesAuto;
    const totalDepenses = depensesSessions + depensesAuto;
    const solde         = totalEntrees - totalSorties - totalDepenses;

    setStats({ solde, totalEntrees, totalSorties, totalDepenses, nbSessions: (sessions || []).length });
    setDerniereSessions((sessions || []).slice(0, 5));
    setLoading(false);
  }

  if (vue === 'nouvelle')    return <NouvelleSessionScreen  onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'historique')  return <HistoriqueSessionsScreen onBack={() => setVue('accueil')}
                                      onSelect={id => { setSessionId(id); setVue('detail'); }} />;
  if (vue === 'detail')      return <DetailSessionScreen    onBack={() => { setVue('historique'); loadStats(); }} sessionId={sessionId} />;
  if (vue === 'recap')       return <RecapDimancheScreen    onBack={() => setVue('accueil')} />;

  return (
    <View style={styles.container}>
      <Header title="💰 Caisse AJUMY" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {loading ? <ActivityIndicator color="#833C00" style={{ marginTop: 20 }} /> : (
          <>
            {/* Solde global */}
            <View style={[styles.soldeCard, { borderColor: stats.solde >= 0 ? '#1E7E34' : '#C00000' }]}>
              <Text style={styles.soldeTitre}>Solde global</Text>
              <Text style={[styles.soldeVal, { color: stats.solde >= 0 ? '#1E7E34' : '#C00000' }]}>
                {fmt(stats.solde)}
              </Text>
              <Text style={styles.soldeSessions}>{stats.nbSessions} session(s) enregistrée(s)</Text>
            </View>

            {/* Stats 3 colonnes */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderTopColor: '#1E7E34' }]}>
                <Text style={[styles.statNum, { color: '#1E7E34' }]}>+{(stats.totalEntrees / 1000).toFixed(0)}k</Text>
                <Text style={styles.statLabel}>Entrées{'\n'}(FCFA)</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#C55A11' }]}>
                <Text style={[styles.statNum, { color: '#C55A11' }]}>-{(stats.totalSorties / 1000).toFixed(0)}k</Text>
                <Text style={styles.statLabel}>Sorties{'\n'}(FCFA)</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#C00000' }]}>
                <Text style={[styles.statNum, { color: '#C00000' }]}>-{(stats.totalDepenses / 1000).toFixed(0)}k</Text>
                <Text style={styles.statLabel}>Dépenses{'\n'}(FCFA)</Text>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setVue('nouvelle')}>
          <Text style={styles.btnPrimaryText}>📋 Saisir la session du dimanche</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnSecondary, { borderColor: '#2E75B6', borderWidth: 1 }]} onPress={() => setVue('recap')}>
          <Text style={[styles.btnSecondaryText, { color: '#2E75B6' }]}>📊 Récap du dimanche</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('historique')}>
          <Text style={styles.btnSecondaryText}>📜 Historique des sessions</Text>
        </TouchableOpacity>

        {/* Dernières sessions */}
        {derniereSessions.length > 0 && (
          <>
            <Text style={styles.sectionTitre}>Dernières sessions</Text>
            {derniereSessions.map(sess => (
              <TouchableOpacity key={sess.session_id} style={styles.sessionCard}
                onPress={() => { setSessionId(sess.session_id); setVue('detail'); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionDate}>
                    📅 {new Date(sess.date_session + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: '#1E7E34' }}>+{fmt(sess.total_entrees)}</Text>
                    <Text style={{ fontSize: 12, color: '#C55A11' }}>-{fmt(sess.total_sorties)}</Text>
                    <Text style={{ fontSize: 12, color: '#C00000' }}>-{fmt(sess.total_depenses)}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.sessionSolde, { color: sess.solde_jour >= 0 ? '#1E7E34' : '#C00000' }]}>
                    {fmt(sess.solde_jour)}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#aaa' }}>solde ›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Légende structure */}
        <View style={styles.legendeBox}>
          <Text style={styles.legendeTitre}>📌 Structure du cahier comptable</Text>
          <Text style={styles.legendeItem}>📥 <Text style={{ fontWeight: 'bold' }}>Entrées</Text> : {ENTREES.length} rubriques</Text>
          <Text style={styles.legendeItem}>📤 <Text style={{ fontWeight: 'bold' }}>Sorties</Text> : {SORTIES.length} rubriques</Text>
          <Text style={styles.legendeItem}>💸 <Text style={{ fontWeight: 'bold' }}>Dépenses</Text> : {DEPENSES.length} rubriques</Text>
          <Text style={styles.legendeItem}>✍️ Signé par : Comptable · Président · Trésorier</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  NOUVELLE SESSION DU DIMANCHE
// ══════════════════════════════════════════════════════════════
function NouvelleSessionScreen({ onBack }) {
  const [date, setDate]               = useState(() => {
    // Initialise directement sur le prochain dimanche
    const t = new Date(); const day = t.getDay();
    const d = new Date(t); d.setDate(day === 0 ? t.getDate() : t.getDate() + (7 - day));
    return d;
  });
  const [entrees, setEntrees]         = useState({});
  const [entreesMulti, setEntreesMulti] = useState({}); // pour argents saisis / recouvrements dettes (multiple)
  const [sorties, setSorties]         = useState({});
  const [depenses, setDepenses]       = useState({});
  const [observation, setObservation]     = useState('');
  const [comptable, setComptable]         = useState('');
  const [president, setPresident]         = useState('');
  const [tresorier, setTresorier]         = useState('');
  const [commissaire, setCommissaire]     = useState('');
  const [adherents, setAdherents]         = useState([]);
  const [showPickerComp, setShowPickerComp] = useState(false);
  const [showPickerPres, setShowPickerPres] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [onglet, setOnglet]           = useState('entrees'); // entrees | sorties | depenses | recap

  useEffect(() => {
    supabase.from('adherents').select('adherent_id, nom, prenom')
      .eq('statut', 'actif').order('nom')
      .then(({ data }) => setAdherents(data || []));
  }, []);

  function getDimanche() {
    const t = new Date(); const day = t.getDay();
    const diff = t.getDate() - day + (day === 0 ? 0 : 7 - day + (day > 0 ? 0 : 0));
    const d = new Date(t); d.setDate(day === 0 ? t.getDate() : t.getDate() + (7 - day));
    return d.toISOString().split('T')[0];
  }

  function setEntree(cle, val) { setEntrees(p => ({ ...p, [cle]: val })); }
  function setSortie(cle, val) { setSorties(p => ({ ...p, [cle]: val })); }
  function setDepense(cle, val) { setDepenses(p => ({ ...p, [cle]: val })); }

  // Lignes multiples (argents saisis, recouvrements dettes)
  function addMultiLigne(cle) {
    setEntreesMulti(p => ({ ...p, [cle]: [...(p[cle] || [{ nom: '', montant: '' }]), { nom: '', montant: '' }] }));
  }
  function setMultiLigne(cle, idx, field, val) {
    setEntreesMulti(p => {
      const arr = [...(p[cle] || [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...p, [cle]: arr };
    });
  }

  const totalEntrees = ENTREES.reduce((s, e) => {
    if (e.multiple) {
      return s + (entreesMulti[e.cle] || []).reduce((ss, l) => ss + (parseInt(l.montant) || 0), 0);
    }
    return s + (parseInt(entrees[e.cle]) || 0);
  }, 0);

  const totalSorties  = SORTIES.reduce((s, e) => s + (parseInt(sorties[e.cle]) || 0), 0);
  const totalDepenses = DEPENSES.reduce((s, e) => s + (parseInt(depenses[e.cle]) || 0), 0);
  const soldeJour     = totalEntrees - totalSorties - totalDepenses;

  async function enregistrer() {
    if (!date) { Alert.alert('Saisissez la date'); return; }
    setSaving(true);

    // Construire lignes détail
    const lignes = [];

    ENTREES.forEach(e => {
      if (e.multiple) {
        (entreesMulti[e.cle] || []).forEach(l => {
          const m = parseInt(l.montant) || 0;
          if (m > 0) lignes.push({ rubrique: e.cle, libelle: l.nom || e.label, montant: m, type: 'entree' });
        });
      } else {
        const m = parseInt(entrees[e.cle]) || 0;
        if (m > 0) lignes.push({ rubrique: e.cle, libelle: e.label, montant: m, type: 'entree' });
      }
    });

    SORTIES.forEach(e => {
      const m = parseInt(sorties[e.cle]) || 0;
      if (m > 0) lignes.push({ rubrique: e.cle, libelle: e.label, montant: m, type: 'sortie' });
    });

    DEPENSES.forEach(e => {
      const m = parseInt(depenses[e.cle]) || 0;
      if (m > 0) lignes.push({ rubrique: e.cle, libelle: e.label, montant: m, type: 'depense' });
    });

    // Créer session
    const { data: sess, error } = await supabase.from('session_caisse').insert({
      date_session:    toSupabaseDate(date),
      total_entrees:   totalEntrees,
      total_sorties:   totalSorties,
      total_depenses:  totalDepenses,
      solde_jour:      soldeJour,
      observation:     observation || null,
      comptable:       comptable || null,
      president:       president || null,
      tresorier:       tresorier || null,
    }).select().single();

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    // Insérer lignes
    if (lignes.length > 0) {
      await supabase.from('ligne_caisse').insert(
        lignes.map(l => ({ ...l, session_id: sess.session_id }))
      );
    }

    Alert.alert('✅ Session enregistrée',
      `Date : ${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR')}\n` +
      `Entrées : ${fmt(totalEntrees)}\n` +
      `Sorties : ${fmt(totalSorties)}\n` +
      `Dépenses : ${fmt(totalDepenses)}\n` +
      `Solde : ${fmt(soldeJour)}`);
    onBack();
    setSaving(false);
  }

  const onglets = [
    { key: 'entrees',  label: '📥 Entrées'  },
    { key: 'sorties',  label: '📤 Sorties'  },
    { key: 'depenses', label: '💸 Dépenses' },
    { key: 'recap',    label: '📋 Récap'    },
  ];

  return (
    <View style={styles.container}>
      <Header title="📋 Session du dimanche" onBack={onBack} />

      {/* Date */}
      <View style={{ padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' }}>
        <AjumyDatePicker
          label="Date de la session"
          value={date}
          onChange={setDate}
          placeholder="Sélectionner la date du dimanche"
        />
      </View>

      {/* Onglets */}
      <View style={styles.ongletRow}>
        {onglets.map(o => (
          <TouchableOpacity key={o.key} style={[styles.ongletBtn, onglet === o.key && styles.ongletBtnActive]}
            onPress={() => setOnglet(o.key)}>
            <Text style={[styles.ongletText, onglet === o.key && { color: '#fff', fontWeight: 'bold' }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* ── ENTRÉES ── */}
        {onglet === 'entrees' && (
          <>
            <View style={styles.totalBand}>
              <Text style={styles.totalBandLabel}>Total entrées</Text>
              <Text style={[styles.totalBandVal, { color: '#1E7E34' }]}>+{fmt(totalEntrees)}</Text>
            </View>
            {ENTREES.map(e => {
              if (e.multiple) {
                const lignes = entreesMulti[e.cle] || [];
                return (
                  <View key={e.cle} style={styles.multiBlock}>
                    <Text style={styles.inputLabel}>{e.label}</Text>
                    {lignes.map((l, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                        <TextInput style={[styles.input, { flex: 2, marginBottom: 0 }]}
                          value={l.nom} onChangeText={v => setMultiLigne(e.cle, idx, 'nom', v)}
                          placeholder="Nom / motif" />
                        <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]}
                          value={l.montant} onChangeText={v => setMultiLigne(e.cle, idx, 'montant', v)}
                          keyboardType="numeric" placeholder="Montant" />
                      </View>
                    ))}
                    <TouchableOpacity style={styles.btnAjouter} onPress={() => addMultiLigne(e.cle)}>
                      <Text style={styles.btnAjouterText}>+ Ajouter une ligne</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
              return (
                <View key={e.cle}>
                  <Text style={styles.inputLabel}>{e.label}</Text>
                  <TextInput style={styles.input} value={entrees[e.cle] || ''}
                    onChangeText={v => setEntree(e.cle, v)}
                    keyboardType="numeric" placeholder="0" />
                </View>
              );
            })}
          </>
        )}

        {/* ── SORTIES ── */}
        {onglet === 'sorties' && (
          <>
            <View style={styles.totalBand}>
              <Text style={styles.totalBandLabel}>Total sorties</Text>
              <Text style={[styles.totalBandVal, { color: '#C55A11' }]}>-{fmt(totalSorties)}</Text>
            </View>
            {SORTIES.map(e => (
              <View key={e.cle}>
                <Text style={styles.inputLabel}>{e.label}</Text>
                <TextInput style={styles.input} value={sorties[e.cle] || ''}
                  onChangeText={v => setSortie(e.cle, v)}
                  keyboardType="numeric" placeholder="0" />
              </View>
            ))}
          </>
        )}

        {/* ── DÉPENSES ── */}
        {onglet === 'depenses' && (
          <>
            <View style={styles.totalBand}>
              <Text style={styles.totalBandLabel}>Total dépenses</Text>
              <Text style={[styles.totalBandVal, { color: '#C00000' }]}>-{fmt(totalDepenses)}</Text>
            </View>
            {DEPENSES.map(e => (
              <View key={e.cle}>
                <Text style={styles.inputLabel}>{e.label}</Text>
                <TextInput style={styles.input} value={depenses[e.cle] || ''}
                  onChangeText={v => setDepense(e.cle, v)}
                  keyboardType="numeric" placeholder="0" />
              </View>
            ))}
          </>
        )}

        {/* ── RÉCAPITULATIF ── */}
        {onglet === 'recap' && (
          <>
            {/* Récap entrées */}
            <Text style={styles.recapSectionTitre}>📥 Entrées</Text>
            {ENTREES.map(e => {
              let montant = 0;
              if (e.multiple) {
                montant = (entreesMulti[e.cle] || []).reduce((s, l) => s + (parseInt(l.montant) || 0), 0);
              } else {
                montant = parseInt(entrees[e.cle]) || 0;
              }
              if (montant === 0) return null;
              return (
                <View key={e.cle} style={styles.recapRow}>
                  <Text style={styles.recapLabel}>{e.label}</Text>
                  <Text style={[styles.recapVal, { color: '#1E7E34' }]}>{fmt(montant)}</Text>
                </View>
              );
            })}
            <View style={[styles.recapRow, styles.recapTotal]}>
              <Text style={styles.recapTotalLabel}>TOTAL ENTRÉES</Text>
              <Text style={[styles.recapTotalVal, { color: '#1E7E34' }]}>+{fmt(totalEntrees)}</Text>
            </View>

            {/* Récap sorties */}
            <Text style={[styles.recapSectionTitre, { marginTop: 16 }]}>📤 Sorties</Text>
            {SORTIES.map(e => {
              const montant = parseInt(sorties[e.cle]) || 0;
              if (montant === 0) return null;
              return (
                <View key={e.cle} style={styles.recapRow}>
                  <Text style={styles.recapLabel}>{e.label}</Text>
                  <Text style={[styles.recapVal, { color: '#C55A11' }]}>-{fmt(montant)}</Text>
                </View>
              );
            })}
            <View style={[styles.recapRow, styles.recapTotal]}>
              <Text style={styles.recapTotalLabel}>TOTAL SORTIES</Text>
              <Text style={[styles.recapTotalVal, { color: '#C55A11' }]}>-{fmt(totalSorties)}</Text>
            </View>

            {/* Récap dépenses */}
            <Text style={[styles.recapSectionTitre, { marginTop: 16 }]}>💸 Dépenses</Text>
            {DEPENSES.map(e => {
              const montant = parseInt(depenses[e.cle]) || 0;
              if (montant === 0) return null;
              return (
                <View key={e.cle} style={styles.recapRow}>
                  <Text style={styles.recapLabel}>{e.label}</Text>
                  <Text style={[styles.recapVal, { color: '#C00000' }]}>-{fmt(montant)}</Text>
                </View>
              );
            })}
            <View style={[styles.recapRow, styles.recapTotal]}>
              <Text style={styles.recapTotalLabel}>TOTAL DÉPENSES</Text>
              <Text style={[styles.recapTotalVal, { color: '#C00000' }]}>-{fmt(totalDepenses)}</Text>
            </View>

            {/* Solde du jour */}
            <View style={[styles.soldeJourCard, { borderColor: soldeJour >= 0 ? '#1E7E34' : '#C00000' }]}>
              <Text style={styles.soldeJourLabel}>SOLDE DU JOUR</Text>
              <Text style={[styles.soldeJourVal, { color: soldeJour >= 0 ? '#1E7E34' : '#C00000' }]}>{fmt(soldeJour)}</Text>
            </View>

            {/* Signatures */}
            <Text style={[styles.recapSectionTitre, { marginTop: 16 }]}>✍️ Signatures</Text>
            <Text style={styles.inputLabel}>Le comptable du jour</Text>
            <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setShowPickerComp(true)}>
              <Text style={{ color: comptable ? '#333' : '#aaa' }}>{comptable || 'Sélectionner un adhérent...'}</Text>
              <Text style={{ color: '#aaa' }}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Le président du jour</Text>
            <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setShowPickerPres(true)}>
              <Text style={{ color: president ? '#333' : '#aaa' }}>{president || 'Sélectionner un adhérent...'}</Text>
              <Text style={{ color: '#aaa' }}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Le trésorier</Text>
            <TextInput style={styles.input} value={tresorier} onChangeText={setTresorier} placeholder="Nom et prénom (membre bureau)" />

            <Text style={styles.inputLabel}>Le commissaire aux comptes</Text>
            <TextInput style={styles.input} value={commissaire} onChangeText={setCommissaire} placeholder="Nom et prénom (membre bureau)" />

            <Text style={styles.inputLabel}>Observation</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={observation} onChangeText={setObservation} multiline placeholder="Observations du jour..." />

            <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1, marginTop: 16 }]}
              onPress={enregistrer} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.btnPrimaryText}>💾 Enregistrer la session</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* Bouton récap visible sur tous les onglets */}
        {onglet !== 'recap' && (
          <TouchableOpacity style={[styles.btnSecondary, { marginTop: 16 }]} onPress={() => setOnglet('recap')}>
            <Text style={styles.btnSecondaryText}>📋 Voir le récapitulatif → Solde : {fmt(soldeJour)}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE DES SESSIONS
// ══════════════════════════════════════════════════════════════
function HistoriqueSessionsScreen({ onBack, onSelect }) {
  const [sessions, setSessions]   = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [onglet, setOnglet]       = useState('sessions'); // 'sessions' | 'automatiques'
  const [loading, setLoading]     = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: sess }, { data: mouvs }] = await Promise.all([
      supabase.from('session_caisse').select('*').order('date_session', { ascending: false }),
      supabase.from('mouvement_caisse').select('*').eq('automatique', true).order('created_at', { ascending: false }).limit(100),
    ]);
    setSessions(sess || []);
    setMouvements(mouvs || []);
    setLoading(false);
  }

  const TYPE_COLOR = { entree: '#1E7E34', sortie: '#C55A11', depense: '#C00000' };
  const TYPE_ICON  = { entree: '📥', sortie: '📤', depense: '💸' };

  return (
    <View style={styles.container}>
      <Header title="📜 Historique caisse" onBack={onBack} />
      {/* Onglets */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' }}>
        {[['sessions', '📋 Sessions'], ['automatiques', '⚡ Mouvements auto']].map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setOnglet(key)}
            style={{ flex: 1, padding: 12, alignItems: 'center',
              borderBottomWidth: 2, borderBottomColor: onglet === key ? '#833C00' : 'transparent' }}>
            <Text style={{ fontSize: 13, fontWeight: onglet === key ? 'bold' : 'normal',
              color: onglet === key ? '#833C00' : '#888' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator size="large" color="#833C00" style={{ marginTop: 40 }} /> :
        onglet === 'sessions' ? (
          <FlatList data={sessions} keyExtractor={s => s.session_id}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.sessionCard} onPress={() => onSelect(item.session_id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionDate}>
                    📅 {new Date(item.date_session + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 12, color: '#1E7E34' }}>📥 {fmt(item.total_entrees)}</Text>
                    <Text style={{ fontSize: 12, color: '#C55A11' }}>📤 {fmt(item.total_sorties)}</Text>
                    <Text style={{ fontSize: 12, color: '#C00000' }}>💸 {fmt(item.total_depenses)}</Text>
                  </View>
                  {item.comptable && <Text style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>✍️ {item.comptable}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.sessionSolde, { color: item.solde_jour >= 0 ? '#1E7E34' : '#C00000' }]}>
                    {fmt(item.solde_jour)}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#aaa' }}>solde ›</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Aucune session enregistrée.</Text>}
          />
        ) : (
          <FlatList data={mouvements} keyExtractor={(m, i) => m.mouvement_id || String(i)}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <View style={[styles.sessionCard, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                <Text style={{ fontSize: 20 }}>{TYPE_ICON[item.type_mouvement] || '💰'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1F3864' }}>{item.libelle || item.source}</Text>
                  <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {item.module || '—'} · {item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '—'}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: TYPE_COLOR[item.type_mouvement] || '#333' }}>
                  {item.type_mouvement === 'entree' ? '+' : '-'}{(item.montant || 0).toLocaleString()} F
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Aucun mouvement automatique.</Text>}
          />
        )
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  DÉTAIL D'UNE SESSION
// ══════════════════════════════════════════════════════════════
function DetailSessionScreen({ onBack, sessionId }) {
  const [session, setSession] = useState(null);
  const [lignes, setLignes]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase.from('session_caisse').select('*').eq('session_id', sessionId).single(),
      supabase.from('ligne_caisse').select('*').eq('session_id', sessionId).order('type'),
    ]);
    setSession(s);
    setLignes(l || []);
    setLoading(false);
  }

  if (loading || !session) return (
    <View style={styles.container}>
      <Header title="Détail session" onBack={onBack} />
      <ActivityIndicator size="large" color="#833C00" style={{ marginTop: 40 }} />
    </View>
  );

  const entreesLignes  = lignes.filter(l => l.type === 'entree');
  const sortiesLignes  = lignes.filter(l => l.type === 'sortie');
  const depensesLignes = lignes.filter(l => l.type === 'depense');

  return (
    <View style={styles.container}>
      <Header title={`📋 ${new Date(session.date_session + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Solde */}
        <View style={[styles.soldeJourCard, { borderColor: session.solde_jour >= 0 ? '#1E7E34' : '#C00000', marginBottom: 12 }]}>
          <Text style={styles.soldeJourLabel}>SOLDE DU JOUR</Text>
          <Text style={[styles.soldeJourVal, { color: session.solde_jour >= 0 ? '#1E7E34' : '#C00000' }]}>{fmt(session.solde_jour)}</Text>
        </View>

        {/* Entrées */}
        {entreesLignes.length > 0 && (
          <>
            <Text style={styles.recapSectionTitre}>📥 Entrées</Text>
            {entreesLignes.map((l, i) => (
              <View key={i} style={styles.recapRow}>
                <Text style={styles.recapLabel}>{l.libelle}</Text>
                <Text style={[styles.recapVal, { color: '#1E7E34' }]}>+{fmt(l.montant)}</Text>
              </View>
            ))}
            <View style={[styles.recapRow, styles.recapTotal]}>
              <Text style={styles.recapTotalLabel}>TOTAL</Text>
              <Text style={[styles.recapTotalVal, { color: '#1E7E34' }]}>+{fmt(session.total_entrees)}</Text>
            </View>
          </>
        )}

        {/* Sorties */}
        {sortiesLignes.length > 0 && (
          <>
            <Text style={[styles.recapSectionTitre, { marginTop: 16 }]}>📤 Sorties</Text>
            {sortiesLignes.map((l, i) => (
              <View key={i} style={styles.recapRow}>
                <Text style={styles.recapLabel}>{l.libelle}</Text>
                <Text style={[styles.recapVal, { color: '#C55A11' }]}>-{fmt(l.montant)}</Text>
              </View>
            ))}
            <View style={[styles.recapRow, styles.recapTotal]}>
              <Text style={styles.recapTotalLabel}>TOTAL</Text>
              <Text style={[styles.recapTotalVal, { color: '#C55A11' }]}>-{fmt(session.total_sorties)}</Text>
            </View>
          </>
        )}

        {/* Dépenses */}
        {depensesLignes.length > 0 && (
          <>
            <Text style={[styles.recapSectionTitre, { marginTop: 16 }]}>💸 Dépenses</Text>
            {depensesLignes.map((l, i) => (
              <View key={i} style={styles.recapRow}>
                <Text style={styles.recapLabel}>{l.libelle}</Text>
                <Text style={[styles.recapVal, { color: '#C00000' }]}>-{fmt(l.montant)}</Text>
              </View>
            ))}
            <View style={[styles.recapRow, styles.recapTotal]}>
              <Text style={styles.recapTotalLabel}>TOTAL</Text>
              <Text style={[styles.recapTotalVal, { color: '#C00000' }]}>-{fmt(session.total_depenses)}</Text>
            </View>
          </>
        )}

        {/* Signatures */}
        {(session.comptable || session.president || session.tresorier || session.commissaire) && (
          <View style={styles.signaturesCard}>
            <Text style={styles.recapSectionTitre}>✍️ Signatures</Text>
            {session.comptable && <Text style={styles.signatureLigne}>Le comptable : <Text style={{ fontWeight: 'bold' }}>{session.comptable}</Text></Text>}
            {session.president && <Text style={styles.signatureLigne}>Le président : <Text style={{ fontWeight: 'bold' }}>{session.president}</Text></Text>}
            {session.tresorier && <Text style={styles.signatureLigne}>Le trésorier : <Text style={{ fontWeight: 'bold' }}>{session.tresorier}</Text></Text>}
            {session.commissaire && <Text style={styles.signatureLigne}>Commissaire aux comptes : <Text style={{ fontWeight: 'bold' }}>{session.commissaire}</Text></Text>}
          </View>
        )}

        {session.observation && (
          <View style={styles.observationCard}>
            <Text style={styles.recapSectionTitre}>📝 Observation</Text>
            <Text style={{ fontSize: 13, color: '#444', marginTop: 4 }}>{session.observation}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  RÉCAP DU DIMANCHE
// ══════════════════════════════════════════════════════════════
function RecapDimancheScreen({ onBack }) {
  const [mouvements, setMouvements] = useState([]);
  const [loading, setLoading]       = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: mouvs }, { data: sessions }] = await Promise.all([
      supabase.from('mouvement_caisse').select('*').eq('automatique', true)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59')
        .order('created_at', { ascending: true }),
      supabase.from('session_caisse').select('*, ligne_caisse(*)')
        .eq('date_session', today).limit(1),
    ]);

    // Convertir les lignes manuelles en mouvements pour uniformiser
    const lignesManuelles = [];
    if (sessions && sessions[0]?.ligne_caisse) {
      for (const l of sessions[0].ligne_caisse) {
        if (!l.montant || l.montant <= 0) continue;
        lignesManuelles.push({
          libelle: l.libelle || l.rubrique,
          source:  l.rubrique,
          montant: l.montant,
          type_mouvement: l.type,
          module: 'manuel',
          automatique: false,
        });
      }
    }
    setMouvements([...(mouvs || []), ...lignesManuelles]);
    setLoading(false);
  }

  const entrees  = mouvements.filter(m => m.type_mouvement === 'entree');
  const sorties  = mouvements.filter(m => m.type_mouvement === 'sortie');
  const depenses = mouvements.filter(m => m.type_mouvement === 'depense');
  const totalEntrees  = entrees.reduce((s, m) => s + (m.montant || 0), 0);
  const totalSorties  = sorties.reduce((s, m) => s + (m.montant || 0), 0);
  const totalDepenses = depenses.reduce((s, m) => s + (m.montant || 0), 0);
  const soldeJour     = totalEntrees - totalSorties - totalDepenses;

  const Section = ({ titre, items, color, icon }) => items.length === 0 ? null : (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color, marginBottom: 8 }}>{icon} {titre}</Text>
      {items.map((m, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between',
          paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: '#1F3864', fontWeight: '600' }}>{m.libelle || m.source}</Text>
            <Text style={{ fontSize: 11, color: '#888' }}>{m.module || '—'}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color }}>{(m.montant || 0).toLocaleString()} F</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6,
        borderTopWidth: 2, borderTopColor: color }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold', color }}>Total {titre}</Text>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color }}>
          {items.reduce((s, m) => s + (m.montant || 0), 0).toLocaleString()} F
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="📊 Récap du dimanche" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Solde du jour */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20,
          elevation: 3, alignItems: 'center', borderTopWidth: 4,
          borderTopColor: soldeJour >= 0 ? '#1E7E34' : '#C00000' }}>
          <Text style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            📅 {new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: soldeJour >= 0 ? '#1E7E34' : '#C00000' }}>
            {soldeJour >= 0 ? '+' : ''}{soldeJour.toLocaleString()} FCFA
          </Text>
          <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Solde du jour (mouvements auto)</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: '#1E7E34' }}>📥 +{totalEntrees.toLocaleString()}</Text>
            <Text style={{ fontSize: 12, color: '#C55A11' }}>📤 -{totalSorties.toLocaleString()}</Text>
            <Text style={{ fontSize: 12, color: '#C00000' }}>💸 -{totalDepenses.toLocaleString()}</Text>
          </View>
        </View>

        {loading
          ? <ActivityIndicator size="large" color="#833C00" />
          : mouvements.length === 0
            ? <Text style={styles.empty}>Aucun mouvement automatique aujourd'hui.</Text>
            : <>
                <Section titre="Entrées"  items={entrees}  color="#1E7E34" icon="📥" />
                <Section titre="Sorties"  items={sorties}  color="#C55A11" icon="📤" />
                <Section titre="Dépenses" items={depenses} color="#C00000" icon="💸" />
              </>
        }
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F0F4F8' },
  header:             { backgroundColor: '#4A2000', padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:            { color: '#FFCCBC', fontSize: 14 },
  soldeCard:          { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 12, borderWidth: 2, elevation: 3 },
  soldeTitre:         { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 4 },
  soldeVal:           { fontSize: 28, fontWeight: 'bold' },
  soldeSessions:      { fontSize: 12, color: '#aaa', marginTop: 6 },
  statsRow:           { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:           { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderTopWidth: 4 },
  statNum:            { fontSize: 16, fontWeight: 'bold', color: '#1F3864' },
  statLabel:          { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  btnPrimary:         { backgroundColor: '#4A2000', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:     { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary:       { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText:   { color: '#1F3864', fontSize: 15, fontWeight: '600' },
  sectionTitre:       { fontSize: 14, fontWeight: 'bold', color: '#4A2000', marginVertical: 10 },
  sessionCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2, borderLeftWidth: 4, borderLeftColor: '#4A2000' },
  sessionDate:        { fontSize: 14, fontWeight: 'bold', color: '#1F3864' },
  sessionSolde:       { fontSize: 16, fontWeight: 'bold' },
  legendeBox:         { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14, marginTop: 8, borderLeftWidth: 4, borderLeftColor: '#4A2000' },
  legendeTitre:       { fontSize: 13, fontWeight: 'bold', color: '#4A2000', marginBottom: 8 },
  legendeItem:        { fontSize: 12, color: '#555', marginBottom: 4 },
  ongletRow:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  ongletBtn:          { flex: 1, padding: 12, alignItems: 'center' },
  ongletBtnActive:    { backgroundColor: '#4A2000' },
  ongletText:         { fontSize: 12, color: '#666' },
  inputLabel:         { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 4 },
  totalBand:          { backgroundColor: '#F0F4F8', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalBandLabel:     { fontSize: 14, fontWeight: 'bold', color: '#1F3864' },
  totalBandVal:       { fontSize: 16, fontWeight: 'bold' },
  multiBlock:         { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#eee' },
  btnAjouter:         { backgroundColor: '#E8F4FD', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 6 },
  btnAjouterText:     { color: '#2E75B6', fontWeight: '600', fontSize: 13 },
  recapSectionTitre:  { fontSize: 14, fontWeight: 'bold', color: '#4A2000', marginBottom: 8, borderBottomWidth: 2, borderBottomColor: '#4A2000', paddingBottom: 4 },
  recapRow:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  recapLabel:         { color: '#444', fontSize: 13, flex: 1 },
  recapVal:           { fontSize: 13, fontWeight: '600' },
  recapTotal:         { backgroundColor: '#F0F4F8', borderRadius: 6, paddingHorizontal: 8, marginTop: 4 },
  recapTotalLabel:    { color: '#1F3864', fontSize: 14, fontWeight: 'bold', flex: 1 },
  recapTotalVal:      { fontSize: 14, fontWeight: 'bold' },
  soldeJourCard:      { borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 2, elevation: 3, backgroundColor: '#fff', marginVertical: 16 },
  soldeJourLabel:     { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 4 },
  soldeJourVal:       { fontSize: 30, fontWeight: 'bold' },
  signaturesCard:     { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14, marginTop: 16, borderLeftWidth: 4, borderLeftColor: '#C55A11' },
  signatureLigne:     { fontSize: 13, color: '#444', marginBottom: 4 },
  observationCard:    { backgroundColor: '#F3E8FF', borderRadius: 12, padding: 14, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#7030A0' },
  empty:              { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});