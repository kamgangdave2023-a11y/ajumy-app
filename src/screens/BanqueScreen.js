import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { caisseBanque } from '../lib/caisse';
import AvatarAdherent from '../components/AvatarAdherent';

function Header({ title, onBack, right }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 70, alignItems: 'flex-end' }}>{right || null}</View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  ACCUEIL
// ══════════════════════════════════════════════════════════════
export default function BanqueScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [vue, setVue] = useState('accueil');
  const [typeBanque, setTypeBanque] = useState('ordinaire');
  const [stats, setStats] = useState({ ordinaire: 0, scolaire: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    const { data: comptes } = await supabase.from('compte_banque').select('type_banque, capital_cumule');
    const ord  = (comptes || []).filter(c => c.type_banque === 'ordinaire').reduce((s, c) => s + c.capital_cumule, 0);
    const scol = (comptes || []).filter(c => c.type_banque === 'scolaire').reduce((s, c) => s + c.capital_cumule, 0);
    setStats({ ordinaire: ord, scolaire: scol });
    setLoading(false);
  }

  if (vue === 'seance')  return <SeanceDepotScreen typeBanque={typeBanque} onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'comptes') return <ComptesScreen     typeBanque={typeBanque} onBack={() => { setVue('accueil'); loadStats(); }} />;

  return (
    <View style={styles.container}>
      <Header title="🏦 Banque AJUMY" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {loading ? <ActivityIndicator color="#7030A0" style={{ marginTop: 20 }} /> : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: '#7030A0' }]}>
              <Text style={styles.statCardNum}>{stats.ordinaire.toLocaleString()}</Text>
              <Text style={styles.statCardLabel}>Ordinaire (FCFA)</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#2E75B6' }]}>
              <Text style={styles.statCardNum}>{stats.scolaire.toLocaleString()}</Text>
              <Text style={styles.statCardLabel}>Scolaire (FCFA)</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#1E7E34' }]}>
              <Text style={styles.statCardNum}>{(stats.ordinaire + stats.scolaire).toLocaleString()}</Text>
              <Text style={styles.statCardLabel}>Total (FCFA)</Text>
            </View>
          </View>
        )}

        <View style={styles.typeSelector}>
          {['ordinaire', 'scolaire'].map(t => (
            <TouchableOpacity key={t} style={[styles.typeBtn, typeBanque === t && styles.typeBtnActive]} onPress={() => setTypeBanque(t)}>
              <Text style={[styles.typeBtnText, typeBanque === t && styles.typeBtnTextActive]}>
                {t === 'ordinaire' ? '🏦 Ordinaire' : '📚 Scolaire'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setVue('seance')}>
          <Text style={styles.btnPrimaryText}>💰 Enregistrer dépôts du dimanche</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('comptes')}>
          <Text style={styles.btnSecondaryText}>👥 Voir les comptes & parts du pool</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  SÉANCE DÉPÔTS DU DIMANCHE
// ══════════════════════════════════════════════════════════════
function SeanceDepotScreen({ typeBanque, onBack }) {
  const [adherents, setAdherents]   = useState([]);
  const [comptes, setComptes]       = useState({});
  const [depots, setDepots]         = useState({});
  const [presents, setPresents]     = useState({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [resume, setResume]         = useState(null);
  const [dateDimanche] = useState(() => {
    const t = new Date(); const day = t.getDay();
    const diff = t.getDate() - (day === 0 ? 0 : day); // dernier dimanche passé
    return new Date(t.setDate(diff)).toISOString().split('T')[0];
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: adhs } = await supabase
      .from('adherents').select('adherent_id, nom, prenom, photo_url, statut')
      .in('statut', ['actif', 'en_observation']).order('nom');
    const comptesMap = {};
    for (const a of (adhs || [])) {
      let { data: c } = await supabase.from('compte_banque').select('*')
        .eq('adherent_id', a.adherent_id).eq('type_banque', typeBanque).maybeSingle();
      if (!c) {
        const { data: n } = await supabase.from('compte_banque')
          .insert({ adherent_id: a.adherent_id, type_banque: typeBanque }).select().single();
        c = n;
      }
      if (c) comptesMap[a.adherent_id] = c;
    }
    setAdherents(adhs || []);
    setComptes(comptesMap);
    const initD = {}, initP = {};
    (adhs || []).forEach(a => { initD[a.adherent_id] = ''; initP[a.adherent_id] = true; });
    setDepots(initD); setPresents(initP);
    setLoading(false);
  }

  function togglePresent(id) {
    setPresents(prev => { if (prev[id]) setDepots(d => ({ ...d, [id]: '' })); return { ...prev, [id]: !prev[id] }; });
  }

  const totalDepots  = Object.entries(depots).reduce((s, [id, v]) => s + (presents[id] && v ? parseInt(v) || 0 : 0), 0);
  const nbPresents   = Object.values(presents).filter(Boolean).length;

  async function enregistrer() {
    setSaving(true);
    for (const a of adherents) {
      const compte = comptes[a.adherent_id]; if (!compte) continue;
      const estPresent = presents[a.adherent_id];
      const montant    = estPresent ? (parseInt(depots[a.adherent_id]) || 0) : 0;
      const nbConsec   = estPresent ? (compte.nb_dimanches_consecutifs || 0) + 1 : 0;
      const capitalApres = (compte.capital_cumule || 0) + montant;
      const { data: depotData } = await supabase.from('depot_banque').insert({
        compte_id: compte.compte_id, adherent_id: a.adherent_id,
        type_banque: typeBanque, date_dimanche: dateDimanche,
        montant, est_present: estPresent,
        capital_cumule_apres: capitalApres, nb_consecutifs_apres: nbConsec,
      }).select().single();
      if (estPresent && montant > 0) {
        if (typeBanque === 'ordinaire') await caisseBanque.depotOrdinaire(montant, depotData?.compte_id, a.adherent_id);
        else await caisseBanque.depotScolaire(montant, depotData?.compte_id, a.adherent_id);
      }
      await supabase.from('compte_banque').update({
        capital_cumule: capitalApres, nb_dimanches_consecutifs: nbConsec,
        date_derniere_cotisation: estPresent ? dateDimanche : compte.date_derniere_cotisation,
      }).eq('compte_id', compte.compte_id);
    }
    setResume({ date: dateDimanche, typeBanque, nbPresents, totalDepots });
    setSaving(false);
  }

  if (resume) return (
    <View style={styles.container}>
      <Header title="📋 Résumé dépôts" onBack={onBack} />
      <ScrollView style={{ padding: 16 }}>
        <View style={[styles.resumeCard, { backgroundColor: '#7030A0' }]}>
          <Text style={styles.resumeTitle}>✅ Dépôts enregistrés !</Text>
          <Text style={styles.resumeDate}>
            {resume.typeBanque === 'ordinaire' ? '🏦 Ordinaire' : '📚 Scolaire'} ·{' '}
            {new Date(resume.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}><Text style={styles.statNumber}>{resume.nbPresents}</Text><Text style={styles.statLabel}>Présents</Text></View>
          <View style={styles.statBox}><Text style={styles.statNumber}>{resume.totalDepots.toLocaleString()}</Text><Text style={styles.statLabel}>Total déposé (FCFA)</Text></View>
        </View>
        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#7030A0' }]} onPress={onBack}>
          <Text style={styles.btnPrimaryText}>✅ Terminer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title={`💰 Dépôts ${typeBanque === 'ordinaire' ? 'Ordinaire' : 'Scolaire'}`} onBack={onBack} />
      <View style={[styles.counter, { backgroundColor: '#7030A0' }]}>
        <Text style={styles.counterDate}>
          {new Date(dateDimanche + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <View style={styles.counterRow}>
          <View style={styles.counterItem}><Text style={styles.counterNum}>{nbPresents}</Text><Text style={styles.counterLabel}>Présents</Text></View>
          <View style={[styles.counterItem, { borderRightWidth: 0 }]}>
            <Text style={[styles.counterNum, { color: '#FFD700' }]}>{totalDepots.toLocaleString()}</Text>
            <Text style={styles.counterLabel}>Déposé (FCFA)</Text>
          </View>
        </View>
      </View>
      <View style={{ padding: 8, alignItems: 'center' }}>
        <Text style={{ color: '#888', fontSize: 12 }}>Appuyez sur le nom pour absent · Saisissez le montant</Text>
      </View>
      {loading ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} /> :
        <FlatList
          data={adherents} keyExtractor={a => a.adherent_id}
          renderItem={({ item }) => {
            const present = presents[item.adherent_id];
            const compte  = comptes[item.adherent_id];
            return (
              <View style={[styles.card, !present && { opacity: 0.5 }]}>
                <AvatarAdherent
                  nom={item.nom} prenom={item.prenom}
                  photoUrl={item.photo_url} statut={item.statut}
                  size={38} style={{ marginRight: 10 }}
                />
                <TouchableOpacity onPress={() => togglePresent(item.adherent_id)} style={{ flex: 1 }}>
                  <Text style={[styles.cardName, !present && { color: '#bbb' }]}>
                    {present ? '✓' : '✗'} {item.nom} {item.prenom}
                  </Text>
                  <Text style={styles.cardSub}>Capital : {(compte?.capital_cumule || 0).toLocaleString()} FCFA</Text>
                </TouchableOpacity>
                {present && (
                  <TextInput
                    style={styles.montantInput}
                    value={depots[item.adherent_id]}
                    onChangeText={v => setDepots(d => ({ ...d, [item.adherent_id]: v }))}
                    keyboardType="numeric" placeholder="0 FCFA" placeholderTextColor="#bbb"
                  />
                )}
              </View>
            );
          }}
        />
      }
      <TouchableOpacity
        style={[styles.btnPrimary, { margin: 16, backgroundColor: '#7030A0', opacity: saving ? 0.5 : 1 }]}
        onPress={enregistrer} disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>💾 Enregistrer — {totalDepots.toLocaleString()} FCFA</Text>}
      </TouchableOpacity>
    </View>
  );
}


// ══════════════════════════════════════════════════════════════
//  COMPTES
// ══════════════════════════════════════════════════════════════
function ComptesScreen({ typeBanque, onBack }) {
  const [comptes, setComptes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const [selectedCompte, setSelectedCompte] = useState(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('compte_banque')
      .select('*, adherents(nom, prenom, photo_url, statut)').eq('type_banque', typeBanque)
      .order('capital_cumule', { ascending: false });
    setComptes(data || []);
    setLoading(false);
  }

  const total = comptes.reduce((s, c) => s + c.capital_cumule, 0);

  if (selectedCompte) return (
    <HistoriqueCompteScreen
      compte={selectedCompte} typeBanque={typeBanque}
      onBack={() => setSelectedCompte(null)}
    />
  );

  return (
    <View style={styles.container}>
      <Header title={`👥 Comptes ${typeBanque === 'ordinaire' ? 'Ordinaire' : 'Scolaire'}`} onBack={onBack} />
      <View style={[styles.infoBand, { backgroundColor: '#EDE7F6' }]}>
        <Text style={[styles.infoBandText, { color: '#7030A0' }]}>
          Pool total : {total.toLocaleString()} FCFA · {comptes.length} comptes
        </Text>
      </View>
      {loading ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} /> :
        <FlatList data={comptes} keyExtractor={c => c.compte_id} contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const pct = total > 0 ? Math.round(item.capital_cumule / total * 1000) / 10 : 0;
            return (
              <TouchableOpacity style={styles.compteCard} onPress={() => setSelectedCompte(item)}>
                <AvatarAdherent
                  nom={item.adherents.nom} prenom={item.adherents.prenom}
                  photoUrl={item.adherents.photo_url} statut={item.adherents.statut}
                  size={42} style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.compteNom}>{item.adherents.nom} {item.adherents.prenom}</Text>
                  <Text style={styles.compteCapital}>{item.capital_cumule.toLocaleString()} FCFA</Text>
                  <Text style={styles.compteSub}>{item.nb_dimanches_consecutifs} consécutif(s) · {pct}% du pool</Text>
                </View>
                <View style={styles.pctBadge}>
                  <Text style={styles.pctText}>{pct}%</Text>
                  <Text style={styles.pctSub}>du pool</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun compte.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE D'UN COMPTE — dépôts + distributions d'intérêts
// ══════════════════════════════════════════════════════════════
function HistoriqueCompteScreen({ compte, typeBanque, onBack }) {
  const [depots, setDepots]           = useState([]);
  const [distributions, setDists]     = useState([]);
  const [ventes, setVentes]           = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: d }, { data: dist }, { data: v }] = await Promise.all([
      supabase.from('depot_banque')
        .select('*').eq('compte_id', compte.compte_id)
        .order('date_dimanche', { ascending: false }).limit(30),
      supabase.from('distribution_interet_banque')
        .select('*, vente_banque(montant_vente, adherents(nom,prenom))')
        .eq('compte_id', compte.compte_id)
        .order('date_distribution', { ascending: false }).limit(20),
      supabase.from('vente_banque')
        .select('*').eq('adherent_id', compte.adherent_id)
        .eq('type_banque', typeBanque)
        .order('date_demande', { ascending: false }).limit(10),
    ]);
    setDepots(d || []);
    setDists(dist || []);
    setVentes(v || []);
    setLoading(false);
  }

  const totalDeposes   = depots.filter(d => d.est_present).reduce((s, d) => s + (d.montant || 0), 0);
  const totalInterets  = distributions.reduce((s, d) => s + (d.interet_recu || 0), 0);
  const totalVendu     = ventes.filter(v => ['en_cours','rembourse'].includes(v.statut)).reduce((s, v) => s + (v.montant_vente || 0), 0);

  // Fusionner dépôts + distributions en timeline
  const timeline = [
    ...depots.map(d => ({
      date: d.date_dimanche,
      type: d.est_present ? 'depot' : 'absent',
      montant: d.montant || 0,
      label: d.est_present ? `Dépôt ${typeBanque}` : 'Absent',
    })),
    ...distributions.map(d => ({
      date: d.date_distribution,
      type: 'interet',
      montant: d.interet_recu || 0,
      label: `Intérêts vente — ${d.vente_banque?.adherents?.nom || ''}`,
      detail: `Part : ${d.part_pct}% · Pool : ${(d.pool_total || 0).toLocaleString()} FCFA`,
    })),
    // Les ventes ne touchent pas le capital des déposants — retirées de la timeline
  ].sort((a, b) => b.date?.localeCompare(a.date || '') || 0);

  const TYPE_COLORS = {
    depot:     '#1E7E34',
    interet:   '#7030A0',
    vente:     '#C55A11',
    rembourse: '#2E75B6',
    absent:    '#888',
  };
  const TYPE_ICONS = {
    depot: '💰', interet: '📈', vente: '📤', rembourse: '📥', absent: '—',
  };

  return (
    <View style={styles.container}>
      <Header title={`📊 ${compte.adherents.nom} ${compte.adherents.prenom}`} onBack={onBack} />

      {/* Récap solde */}
      <View style={styles.soldeRecapRow}>
        <View style={[styles.soldeRecapChip, { backgroundColor: '#E8F5E9' }]}>
          <Text style={[styles.soldeRecapNum, { color: '#1E7E34' }]}>{totalDeposes.toLocaleString()}</Text>
          <Text style={styles.soldeRecapLbl}>💰 Total déposé</Text>
        </View>
        <View style={[styles.soldeRecapChip, { backgroundColor: '#EDE7F6' }]}>
          <Text style={[styles.soldeRecapNum, { color: '#7030A0' }]}>+{totalInterets.toLocaleString()}</Text>
          <Text style={styles.soldeRecapLbl}>📈 Intérêts reçus</Text>
        </View>
        <View style={[styles.soldeRecapChip, { backgroundColor: '#E8F0FB', borderWidth: 1, borderColor: '#7030A0' }]}>
          <Text style={[styles.soldeRecapNum, { color: '#1F3864', fontWeight: 'bold' }]}>{compte.capital_cumule.toLocaleString()}</Text>
          <Text style={styles.soldeRecapLbl}>🏦 Solde actuel</Text>
        </View>
      </View>

      {loading
        ? <ActivityIndicator size="large" color="#7030A0" style={{ marginTop: 40 }} />
        : <FlatList
            data={timeline}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
            ListHeaderComponent={
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1F3864', marginBottom: 8 }}>
                📋 Historique des mouvements
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.timelineCard}>
                <View style={[styles.timelineDot, { backgroundColor: TYPE_COLORS[item.type] || '#888' }]}>
                  <Text style={{ fontSize: 14 }}>{TYPE_ICONS[item.type] || '•'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timelineLabel, { color: TYPE_COLORS[item.type] }]}>{item.label}</Text>
                  {item.detail && <Text style={styles.timelineDetail}>{item.detail}</Text>}
                  <Text style={styles.timelineDate}>{item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('fr-FR') : '—'}</Text>
                </View>
                {item.type !== 'absent' && (
                  <Text style={[styles.timelineMontant, { color: TYPE_COLORS[item.type] }]}>
                    {item.type === 'vente' ? '-' : '+'}{item.montant.toLocaleString()} FCFA
                  </Text>
                )}
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Aucun mouvement</Text>}
          />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F0F4F8' },
  header:           { backgroundColor: '#7030A0', padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:      { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:          { color: '#E1BEE7', fontSize: 14 },

  statsRow:         { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:         { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderTopWidth: 4 },
  statCardNum:      { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  statCardLabel:    { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },

  alertBox:         { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#C55A11' },
  alertText:        { color: '#C55A11', fontWeight: 'bold', fontSize: 13 },

  typeSelector:     { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 16, elevation: 1 },
  typeBtn:          { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  typeBtnActive:    { backgroundColor: '#7030A0' },
  typeBtnText:      { fontSize: 14, fontWeight: '600', color: '#888' },
  typeBtnTextActive:{ color: '#fff' },

  btnPrimary:       { backgroundColor: '#7030A0', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:   { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText: { color: '#1F3864', fontSize: 15, fontWeight: '600' },

  counter:          { paddingHorizontal: 16, paddingBottom: 12 },
  counterDate:      { color: '#E1BEE7', fontSize: 12, textAlign: 'center', marginBottom: 8, textTransform: 'capitalize' },
  counterRow:       { flexDirection: 'row' },
  counterItem:      { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  counterNum:       { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  counterLabel:     { color: '#E1BEE7', fontSize: 11, marginTop: 2 },

  card:             { backgroundColor: '#fff', margin: 4, marginHorizontal: 12, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  cardName:         { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  cardSub:          { fontSize: 12, color: '#888', marginTop: 2 },
  montantInput:     { borderWidth: 1, borderColor: '#7030A0', borderRadius: 8, padding: 10, width: 90, textAlign: 'right', fontSize: 15, color: '#7030A0', fontWeight: 'bold' },

  inputLabel:       { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 12 },
  input:            { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },

  calcCard:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginVertical: 12, elevation: 2 },
  calcTitle:        { fontSize: 14, fontWeight: 'bold', color: '#7030A0', marginBottom: 10 },
  calcRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  calcLabel:        { color: '#666', fontSize: 14 },
  calcVal:          { fontSize: 14, fontWeight: '600', color: '#333' },
  calcNote:         { color: '#888', fontSize: 12, marginTop: 10, fontStyle: 'italic' },

  demandeCard:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  demandeNom:       { fontSize: 16, fontWeight: 'bold', color: '#1F3864' },
  demandeSub:       { fontSize: 12, color: '#888', marginTop: 2 },
  demandeMontant:   { fontSize: 15, fontWeight: 'bold', color: '#7030A0' },
  demandeBtns:      { flexDirection: 'row', gap: 10 },
  btnApprouver:     { flex: 1, backgroundColor: '#1E7E34', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnApprouverText: { color: '#fff', fontWeight: 'bold' },
  btnRejeter:       { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C00000' },
  btnRejeterText:   { color: '#C00000', fontWeight: 'bold' },

  distribRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  distribNom:       { fontSize: 14, fontWeight: 'bold', color: '#1F3864' },
  distribDetail:    { fontSize: 12, color: '#888', marginTop: 2 },
  distribInteret:   { fontSize: 15, fontWeight: 'bold', color: '#1E7E34' },

  venteCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  venteCardRetard:  { borderLeftWidth: 4, borderLeftColor: '#C00000' },
  venteNom:         { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  venteSub:         { fontSize: 12, color: '#888', marginTop: 2 },
  btnRembourser:    { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#1E7E34', alignItems: 'center', marginLeft: 8 },
  btnRembourserText:{ color: '#1E7E34', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },

  infoBand:         { padding: 10, alignItems: 'center' },
  infoBandText:     { fontWeight: 'bold', fontSize: 13 },
  compteCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  compteNom:        { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  compteCapital:    { fontSize: 18, fontWeight: 'bold', color: '#7030A0', marginTop: 2 },
  compteSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  pctBadge:         { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EDE7F6', justifyContent: 'center', alignItems: 'center' },
  pctText:          { color: '#7030A0', fontWeight: 'bold', fontSize: 14 },
  pctSub:           { color: '#7030A0', fontSize: 10 },

  resumeCard:       { borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  resumeTitle:      { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  resumeDate:       { color: '#E1BEE7', fontSize: 14, marginTop: 8 },
  statsGrid:        { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  statBox:          { width: '48%', margin: '1%', backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2 },
  statNumber:       { fontSize: 22, fontWeight: 'bold', color: '#1F3864' },
  statLabel:        { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle:       { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 16 },
  modalItem:        { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalItemPurple:  { backgroundColor: '#7030A0' },
  modalItemNoir:    { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  disponibleBox:    { backgroundColor: '#EDE7F6', borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 4 },
  disponibleTitre:  { fontSize: 13, fontWeight: 'bold', color: '#7030A0', marginBottom: 8 },
  disponibleRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(112,48,160,0.15)' },
  disponibleLabel:  { color: '#555', fontSize: 14 },
  disponibleVal:    { fontSize: 14, fontWeight: '600', color: '#333' },
  modalItemText:    { fontSize: 15, color: '#333' },
  modalClose:       { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText:   { color: '#666', fontWeight: 'bold' },

  empty:            { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
});