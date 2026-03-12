import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
  Platform, FlatList,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import AvatarAdherent from '../components/AvatarAdherent';
import { caissePresence } from '../lib/caisse';

// ── Constantes métier ────────────────────────────────────────
const COTISATION        = 1200;
const PART_CAGNOTTE     = 1000;
const SUPPLEMENT        = 200;
const NB_BENEFICIAIRES  = 2;

const STATUTS_APPEL = [
  { cle: 'present', label: 'Présent', color: '#4CAF50' },
  { cle: 'absent',  label: 'Absent',  color: '#EF5350' },
];

function fmt(n) { return (n || 0).toLocaleString('fr-FR') + ' F'; }

function formatDateCourt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
function formatDateLong(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getProchainDimanche() {
  const d = new Date();
  const j = d.getDay(); // heure locale (pas UTC)
  const diff = j === 0 ? 0 : 7 - j;
  d.setDate(d.getDate() + diff);
  // Formater en local, pas en UTC (évite le décalage UTC+1 Yaoundé)
  const annee = d.getFullYear();
  const mois  = String(d.getMonth() + 1).padStart(2, '0');
  const jour  = String(d.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

function getOrdreAlterno(adherents, periode) {
  return [...adherents].sort((a, b) => {
    const na = `${a.nom} ${a.prenom}`.toUpperCase();
    const nb = `${b.nom} ${b.prenom}`.toUpperCase();
    return periode % 2 === 1 ? nb.localeCompare(na) : na.localeCompare(nb);
  });
}

// ══════════════════════════════════════════════════════════════
//  ÉCRAN PRINCIPAL — liste des séances
// ══════════════════════════════════════════════════════════════
export default function PresenceScreen({ onBack }) {
  const { isBureau, isAdmin } = useRole();
  const peutSaisir = isBureau || isAdmin;

  const [vue, setVue]               = useState('seances');
  const [seances, setSeances]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [seanceDate, setSeanceDate] = useState(null);

  useEffect(() => { loadSeances(); }, []);

  async function loadSeances() {
    setLoading(true);
    const { data, error } = await supabase
      .from('cahier_presence')
      .select('date_dimanche, statut, montant_paye, est_beneficiaire_1, est_beneficiaire_2, montant_benefice_recu')
      .order('date_dimanche', { ascending: false });

    if (error) { Alert.alert('Erreur', error.message); setLoading(false); return; }

    const map = {};
    for (const row of (data || [])) {
      const d = row.date_dimanche;
      if (!map[d]) map[d] = { date: d, total: 0, presents: 0, absents: 0, cagnotte: 0 };
      map[d].total++;
      if (row.statut === 'present') { map[d].presents++; map[d].cagnotte += PART_CAGNOTTE; }
      else map[d].absents++;
    }
    setSeances(Object.values(map).sort((a, b) => b.date.localeCompare(a.date)));
    setLoading(false);
  }

  if (vue === 'appel') return (
    <AppelSeance date={seanceDate} peutSaisir={peutSaisir}
      onBack={() => { setVue('seances'); setSeanceDate(null); loadSeances(); }} />
  );

  if (vue === 'historique') return <HistoriquePresence onBack={() => setVue('seances')} />;

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>📋 Présence</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.topBtn} onPress={() => setVue('historique')}>
          <Text style={s.topBtnTxt}>📊 Historique</Text>
        </TouchableOpacity>
        {peutSaisir && (
          <TouchableOpacity style={[s.topBtn, { backgroundColor: ACCENT }]}
            onPress={() => { setSeanceDate(getProchainDimanche()); setVue('appel'); }}>
            <Text style={s.topBtnTxt}>+ Nouvelle séance</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

          {/* Prochain dimanche */}
          <View style={s.nextCard}>
            <View style={s.nextCardLeft}>
              <Text style={s.nextCardLabel}>PROCHAIN DIMANCHE</Text>
              <Text style={s.nextCardDate}>{formatDateLong(getProchainDimanche())}</Text>
            </View>
            <View style={s.nextCardRight}>
              <View style={s.nextChip}>
                <Text style={s.nextChipVal}>1 200 F</Text>
                <Text style={s.nextChipLbl}>Cotisation</Text>
              </View>
              <View style={[s.nextChip, { borderColor: '#7030A0' }]}>
                <Text style={[s.nextChipVal, { color: '#CE93D8' }]}>200 F</Text>
                <Text style={s.nextChipLbl}>Supplément</Text>
              </View>
              <View style={[s.nextChip, { borderColor: ACCENT }]}>
                <Text style={[s.nextChipVal, { color: ACCENT }]}>1 000 F</Text>
                <Text style={s.nextChipLbl}>Cagnotte</Text>
              </View>
            </View>
          </View>

          {/* Section séances */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionIcon}>📅</Text>
            <Text style={s.sectionTitle}>Séances passées</Text>
            <View style={s.sectionLine} />
          </View>

          {seances.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <Text style={s.emptyTxt}>Aucune séance enregistrée</Text>
              {peutSaisir && (
                <TouchableOpacity style={s.emptyBtn}
                  onPress={() => { setSeanceDate(getProchainDimanche()); setVue('appel'); }}>
                  <Text style={s.emptyBtnTxt}>Créer la première séance</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : seances.map(sn => {
            const taux     = sn.total > 0 ? Math.round((sn.presents / sn.total) * 100) : 0;
            const parBenef = Math.floor(sn.cagnotte / NB_BENEFICIAIRES);
            const tc       = taux >= 70 ? '#4CAF50' : taux >= 50 ? '#FFA726' : '#EF5350';
            return (
              <TouchableOpacity key={sn.date} style={s.seanceRow}
                onPress={() => { setSeanceDate(sn.date); setVue('appel'); }}>
                <View style={[s.seanceDot, { backgroundColor: tc }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.seanceDate}>{formatDateLong(sn.date)}</Text>
                  <View style={s.seanceBadges}>
                    <Text style={[s.seanceBadge, { color: '#4CAF50' }]}>✅ {sn.presents}</Text>
                    {sn.absents > 0 && <Text style={[s.seanceBadge, { color: '#EF5350' }]}>❌ {sn.absents}</Text>}
                    <Text style={[s.seanceBadge, { color: '#90CAF9' }]}>💰 {fmt(sn.cagnotte)}</Text>
                  </View>
                  <View style={s.taux}>
                    <View style={[s.tauxFill, { width: `${taux}%`, backgroundColor: tc }]} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                  <Text style={[s.tauxPct, { color: tc }]}>{taux}%</Text>
                  <Text style={s.parBenef}>{fmt(parBenef)}</Text>
                  <Text style={s.parBenefLbl}>/bénéf.</Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  APPEL SÉANCE — inspiré Student Attendance UI
// ══════════════════════════════════════════════════════════════
function AppelSeance({ date, peutSaisir, onBack }) {
  const [adherents, setAdherents]           = useState([]);
  const [presences, setPresences]           = useState({});
  const [remarques, setRemarques]           = useState({});
  const [beneficiaires, setBenef]           = useState([]);
  const [avalistes, setAvalistes]           = useState({});
  const [periode, setPeriode]               = useState(1);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [pourTous, setPourTous]             = useState('');
  const [showBenefModal, setShowBenefModal] = useState(false);
  const [showAvalModal, setShowAvalModal]   = useState(false);
  const [benefIdx, setBenefIdx]             = useState(0);
  const [benefAbsentId, setBenefAbsentId]   = useState(null);
  const [remarqueActive, setRemarqueActive] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: adhs } = await supabase
      .from('adherents')
      .select('adherent_id, nom, prenom, titre, photo_url, statut, groupe, cni_numero')
      .eq('statut', 'actif').order('nom');

    const { data: existing } = await supabase
      .from('cahier_presence').select('*').eq('date_dimanche', date);

    const { count } = await supabase
      .from('cahier_presence')
      .select('date_dimanche', { count: 'exact', head: true })
      .lt('date_dimanche', date);
    setPeriode((count || 0) + 1);

    const adList = adhs || [];
    setAdherents(adList);

    if (existing && existing.length > 0) {
      const pm = {}, rm = {}, bl = [], av = {};
      for (const row of existing) {
        pm[row.adherent_id] = row.statut;
        if (row.remarque) rm[row.adherent_id] = row.remarque;
        if (row.est_beneficiaire_1 || row.est_beneficiaire_2) bl.push(row.adherent_id);
        if (row.avaliste_id) av[row.adherent_id] = row.avaliste_id;
      }
      setPresences(pm); setRemarques(rm); setBenef(bl); setAvalistes(av);
    } else {
      const pm = {};
      adList.forEach(a => { pm[a.adherent_id] = 'absent'; });
      setPresences(pm);
    }
    setLoading(false);
  }

  // Appliquer "pour tous"
  function appliquerPourTous(statut) {
    setPourTous(statut);
    if (!statut) return;
    const pm = {};
    adherents.forEach(a => { pm[a.adherent_id] = statut; });
    setPresences(pm);
  }

  function setStatut(id, statut) {
    if (!peutSaisir) return;
    setPresences(p => ({ ...p, [id]: statut }));
  }

  const presents = adherents.filter(a => presences[a.adherent_id] === 'present');
  const cagnotte = presents.length * PART_CAGNOTTE;
  const parBenef = Math.floor(cagnotte / NB_BENEFICIAIRES);
  const supplement = presents.length * SUPPLEMENT;
  const total    = presents.length * COTISATION;
  const ordreAlterno = getOrdreAlterno(presents, periode);

  async function enregistrer() {
    if (beneficiaires.length < NB_BENEFICIAIRES) {
      Alert.alert('Bénéficiaires requis', `Désignez les ${NB_BENEFICIAIRES} bénéficiaires avant d'enregistrer.`);
      return;
    }
    setSaving(true);
    await supabase.from('cahier_presence').delete().eq('date_dimanche', date);
    const rows = adherents.map(a => {
      const estP = presences[a.adherent_id] === 'present';
      const estB1 = beneficiaires[0] === a.adherent_id;
      const estB2 = beneficiaires[1] === a.adherent_id;
      const estB  = estB1 || estB2;
      return {
        adherent_id: a.adherent_id, date_dimanche: date,
        statut: estP ? 'present' : 'absent',
        montant_paye: estP ? COTISATION : 0,
        supplement_presence: estP ? SUPPLEMENT : 0,
        part_cagnotte: estP ? PART_CAGNOTTE : 0,
        nb_presents_jour: presents.length,
        montant_par_beneficiaire: parBenef,
        est_beneficiaire_1: estB1, est_beneficiaire_2: estB2,
        montant_benefice_recu: estB ? parBenef : 0,
        signature_decharge: estP,
        avaliste_id: (!estP && estB) ? (avalistes[a.adherent_id] || null) : null,
        recouvrement_verifie: estB,
        remarque: remarques[a.adherent_id] || null,
      };
    });
    const { error } = await supabase.from('cahier_presence').insert(rows);
    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }

    // ── Enregistrer mouvements caisse automatiques ──
    const sessionRef = `presence_${date}`;
    if (total > 0)      await caissePresence.cotisation(total,      sessionRef);
    if (supplement > 0) await caissePresence.supplement(supplement, sessionRef);

    Alert.alert('✅ Séance enregistrée',
      `${presents.length} présents · Cagnotte : ${fmt(cagnotte)} · Par bénéficiaire : ${fmt(parBenef)}`);
    onBack();
  }

  if (loading) return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>📋 Appel du dimanche</Text>
      </View>
      <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 60 }} />
    </View>
  );

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.topTitle}>📋 Appel du dimanche</Text>
          <Text style={s.topSub}>
            {formatDateLong(date)} · Période {periode} ({periode % 2 === 1 ? 'Z → A' : 'A → Z'})
          </Text>
        </View>
        {peutSaisir && (
          <TouchableOpacity style={[s.topBtn, { backgroundColor: '#4CAF50', opacity: saving ? 0.6 : 1 }]}
            onPress={enregistrer} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.topBtnTxt}>💾 Enregistrer</Text>}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── PANEL "Select Ground" ── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Text style={s.panelHeaderTxt}>Paramètres de la séance</Text>
            <View style={s.panelHeaderLine} />
          </View>

          <View style={s.groundRow}>
            <View style={s.groundField}>
              <Text style={s.groundLabel}>Date *</Text>
              <View style={s.groundInput}>
                <Text style={s.groundInputTxt}>{formatDateCourt(date)}</Text>
                <Text style={{ color: '#666' }}>📅</Text>
              </View>
            </View>
            <View style={s.groundField}>
              <Text style={s.groundLabel}>Période *</Text>
              <View style={s.groundInput}>
                <Text style={s.groundInputTxt}>N°{periode} — {periode % 2 === 1 ? 'Z→A' : 'A→Z'}</Text>
              </View>
            </View>
            <View style={s.groundField}>
              <Text style={s.groundLabel}>Présents</Text>
              <View style={[s.groundInput, { borderColor: '#4CAF5066' }]}>
                <Text style={[s.groundInputTxt, { color: '#4CAF50', fontWeight: 'bold' }]}>
                  {presents.length} / {adherents.length}
                </Text>
              </View>
            </View>
            <View style={s.groundField}>
              <Text style={s.groundLabel}>/ Bénéficiaire</Text>
              <View style={[s.groundInput, { borderColor: ACCENT + '66' }]}>
                <Text style={[s.groundInputTxt, { color: ACCENT, fontWeight: 'bold' }]}>{fmt(parBenef)}</Text>
              </View>
            </View>
          </View>

          {/* Bénéficiaires */}
          <Text style={[s.groundLabel, { paddingHorizontal: 14, marginBottom: 8 }]}>
            Bénéficiaires du jour (ordre alterno) *
          </Text>
          <View style={s.benefRow}>
            {[0, 1].map(i => {
              const bid   = beneficiaires[i];
              const benef = bid ? adherents.find(a => a.adherent_id === bid) : null;
              const absent = bid && presences[bid] !== 'present';
              const avId  = bid && avalistes[bid];
              const aval  = avId ? adherents.find(a => a.adherent_id === avId) : null;
              return (
                <TouchableOpacity key={i}
                  style={[s.benefCard, benef && s.benefCardActive]}
                  onPress={() => { if (!peutSaisir) return; setBenefIdx(i); setShowBenefModal(true); }}>
                  <Text style={s.benefCardLabel}>BÉNÉFICIAIRE {i + 1}</Text>
                  {benef ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <AvatarAdherent nom={benef.nom} prenom={benef.prenom}
                          photoUrl={benef.photo_url} size={38} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.benefCardNom} numberOfLines={1}>{benef.nom} {benef.prenom}</Text>
                          <Text style={s.benefCardMontant}>🏆 {fmt(parBenef)}</Text>
                        </View>
                      </View>
                      {absent && (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <View style={s.absentPill}>
                            <Text style={s.absentPillTxt}>⚠️ Absent</Text>
                          </View>
                          <TouchableOpacity style={s.avalPill}
                            onPress={() => { setBenefAbsentId(bid); setShowAvalModal(true); }}>
                            <Text style={s.avalPillTxt}>
                              {aval ? `✅ ${aval.nom}` : '➕ Désigner avaliste'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={s.benefCardVide}>
                      {peutSaisir ? '▼ Sélectionner dans la liste' : '—'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── PANEL "Students List" → Appel nominal ── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Text style={s.panelHeaderIcon}>👥</Text>
            <Text style={s.panelHeaderTxt}>Liste des membres</Text>
            <View style={s.panelHeaderLine} />
          </View>

          {/* "Select For Everyone" */}
          {peutSaisir && (
            <View style={s.selectAll}>
              <Text style={s.selectAllLabel}>Marquer pour tous *</Text>
              <View style={s.selectAllPills}>
                {[
                  { cle: '', label: 'Non sélectionné', color: '#555' },
                  { cle: 'present', label: 'Présent', color: '#4CAF50' },
                  { cle: 'absent',  label: 'Absent',  color: '#EF5350' },
                ].map(st => (
                  <TouchableOpacity key={st.cle}
                    style={[s.selectAllPill,
                      pourTous === st.cle && { backgroundColor: st.color, borderColor: st.color }]}
                    onPress={() => appliquerPourTous(st.cle)}>
                    <Text style={[s.selectAllPillTxt,
                      pourTous === st.cle && { color: '#fff', fontWeight: 'bold' }]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* En-tête tableau */}
          <View style={s.tableHead}>
            <Text style={[s.th, { width: 32 }]}>#</Text>
            <Text style={[s.th, { width: 46 }]}>Photo</Text>
            <Text style={[s.th, { flex: 1.4 }]}>Nom</Text>
            <Text style={[s.th, { flex: 1 }]}>CNI</Text>
            <Text style={[s.th, { flex: 1.6 }]}>Statut</Text>
            <Text style={[s.th, { flex: 1.1 }]}>Remarque</Text>
          </View>

          {/* Lignes appel */}
          {adherents.map((a, idx) => {
            const statut   = presences[a.adherent_id] || 'absent';
            const estP     = statut === 'present';
            const estBenef = beneficiaires.includes(a.adherent_id);
            const rq       = remarques[a.adherent_id] || '';

            return (
              <View key={a.adherent_id}
                style={[s.tableRow,
                  idx % 2 === 0 && s.tableRowEven,
                  estP && s.tableRowPresent]}>

                <Text style={[s.td, { width: 32, color: '#555' }]}>{idx + 1}</Text>

                <View style={{ width: 46, alignItems: 'center' }}>
                  <AvatarAdherent nom={a.nom} prenom={a.prenom}
                    photoUrl={a.photo_url} statut={a.statut} size={34} />
                </View>

                <View style={{ flex: 1.4 }}>
                  <Text style={s.tdNom} numberOfLines={1}>{a.nom} {a.prenom}</Text>
                  {estBenef && <Text style={s.tdBenef}>🏆 Bénéficiaire</Text>}
                </View>

                <Text style={[s.td, { flex: 1 }]} numberOfLines={1}>
                  {a.cni_numero || '—'}
                </Text>

                {/* Radio buttons Présent / Absent */}
                <View style={[s.radioGroup, { flex: 1.6 }]}>
                  {STATUTS_APPEL.map(st => {
                    const sel = statut === st.cle;
                    return (
                      <TouchableOpacity key={st.cle} style={s.radioItem}
                        onPress={() => setStatut(a.adherent_id, st.cle)}
                        activeOpacity={peutSaisir ? 0.7 : 1}>
                        <View style={[s.radioOuter, sel && { borderColor: st.color }]}>
                          {sel && <View style={[s.radioInner, { backgroundColor: st.color }]} />}
                        </View>
                        <Text style={[s.radioLabel, sel && { color: st.color, fontWeight: '600' }]}>
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Cellule remarque */}
                <TouchableOpacity style={[s.remarqueCell, { flex: 1.1 }]}
                  onPress={() => peutSaisir && setRemarqueActive(a.adherent_id)}>
                  <Text style={[s.remarqueTxt, rq && { color: ACCENT }]} numberOfLines={1}>
                    {rq || 'Remarque'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ── Récapitulatif ── */}
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Text style={s.panelHeaderTxt}>📊 Récapitulatif</Text>
            <View style={s.panelHeaderLine} />
          </View>
          <View style={s.recapGrid}>
            <RecapCard label="Présents"       val={`${presents.length}/${adherents.length}`} color="#4CAF50" />
            <RecapCard label="Total collecté" val={fmt(total)}      color="#90CAF9" />
            <RecapCard label="Cagnotte"       val={fmt(cagnotte)}   color="#FFCC80" />
            <RecapCard label="Supplément"     val={fmt(supplement)} color="#CE93D8" />
            <RecapCard label="/bénéficiaire"  val={fmt(parBenef)}   color={ACCENT} big />
          </View>
        </View>

        {/* ── Ordre alterno ── */}
        {ordreAlterno.length > 0 && (
          <View style={s.panel}>
            <View style={s.panelHeader}>
              <Text style={s.panelHeaderTxt}>
                🔤 Ordre alterno — Période {periode} ({periode % 2 === 1 ? 'Z→A' : 'A→Z'})
              </Text>
              <View style={s.panelHeaderLine} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
              {ordreAlterno.map((a, idx) => {
                const sel = beneficiaires.includes(a.adherent_id);
                return (
                  <View key={a.adherent_id}
                    style={[s.altiChip, sel && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                    <Text style={[s.altiNum, sel && { color: '#fff' }]}>{idx + 1}</Text>
                    <Text style={[s.altiNom, sel && { color: '#fff' }]} numberOfLines={1}>{a.nom}</Text>
                    {sel && <Text style={{ fontSize: 9, color: '#fff' }}>🏆</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Bouton save bas de page */}
        {peutSaisir && (
          <TouchableOpacity style={[s.saveBtn, { opacity: saving ? 0.6 : 1 }]}
            onPress={enregistrer} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.saveBtnTxt}>💾 Enregistrer la séance</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modal sélection bénéficiaire ── */}
      <Modal visible={showBenefModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '72%' }]}>
            <Text style={s.modalTitle}>🏆 Sélectionner bénéficiaire {benefIdx + 1}</Text>
            <Text style={s.modalSub}>Ordre alterno · Période {periode}</Text>
            <ScrollView>
              {ordreAlterno.map((a, idx) => {
                const dejaAutre = beneficiaires.includes(a.adherent_id)
                  && beneficiaires[benefIdx] !== a.adherent_id;
                const sel = beneficiaires[benefIdx] === a.adherent_id;
                return (
                  <TouchableOpacity key={a.adherent_id}
                    style={[s.modalRow, dejaAutre && { opacity: 0.3 }, sel && { backgroundColor: ACCENT }]}
                    onPress={() => {
                      if (dejaAutre) return;
                      const arr = [...beneficiaires]; arr[benefIdx] = a.adherent_id;
                      setBenef(arr); setShowBenefModal(false);
                    }}>
                    <Text style={[s.modalNum, sel && { color: '#fff' }]}>{idx + 1}</Text>
                    <AvatarAdherent nom={a.nom} prenom={a.prenom} photoUrl={a.photo_url} size={34} />
                    <Text style={[s.modalNom, sel && { color: '#fff' }]}>{a.nom} {a.prenom}</Text>
                    {presences[a.adherent_id] !== 'present' && (
                      <Text style={{ fontSize: 10, color: sel ? '#fff' : ACCENT, marginLeft: 'auto' }}>Absent</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={s.modalCloseBtn} onPress={() => setShowBenefModal(false)}>
              <Text style={s.modalCloseTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal avaliste ── */}
      <Modal visible={showAvalModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '65%' }]}>
            <Text style={s.modalTitle}>🤝 Désigner un avaliste</Text>
            <Text style={s.modalSub}>Membre présent qui signe à la place du bénéficiaire absent</Text>
            <ScrollView>
              {presents.map(a => {
                const sel = avalistes[benefAbsentId] === a.adherent_id;
                return (
                  <TouchableOpacity key={a.adherent_id}
                    style={[s.modalRow, sel && { backgroundColor: '#1F3864' }]}
                    onPress={() => {
                      setAvalistes(p => ({ ...p, [benefAbsentId]: a.adherent_id }));
                      setShowAvalModal(false);
                    }}>
                    <AvatarAdherent nom={a.nom} prenom={a.prenom} photoUrl={a.photo_url} size={34} />
                    <Text style={[s.modalNom, sel && { color: '#fff' }]}>{a.nom} {a.prenom}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={s.modalCloseBtn} onPress={() => setShowAvalModal(false)}>
              <Text style={s.modalCloseTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal remarque ── */}
      <Modal visible={!!remarqueActive} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            {remarqueActive && (() => {
              const a = adherents.find(x => x.adherent_id === remarqueActive);
              return (
                <>
                  <Text style={s.modalTitle}>💬 Remarque — {a?.nom} {a?.prenom}</Text>
                  <TextInput
                    style={s.remarqueInput}
                    multiline numberOfLines={4}
                    placeholder="Saisir une remarque..."
                    placeholderTextColor="#555"
                    value={remarques[remarqueActive] || ''}
                    onChangeText={v => setRemarques(p => ({ ...p, [remarqueActive]: v }))}
                  />
                  <TouchableOpacity style={[s.modalCloseBtn, { backgroundColor: ACCENT, marginBottom: 6 }]}
                    onPress={() => setRemarqueActive(null)}>
                    <Text style={[s.modalCloseTxt, { color: '#fff' }]}>Confirmer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modalCloseBtn}
                    onPress={() => { setRemarques(p => ({ ...p, [remarqueActive]: '' })); setRemarqueActive(null); }}>
                    <Text style={s.modalCloseTxt}>Effacer</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE PRÉSENCES
// ══════════════════════════════════════════════════════════════
function HistoriquePresence({ onBack }) {
  const [adherents, setAdherents]       = useState([]);
  const [selected, setSelected]         = useState(null);
  const [stats, setStats]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [search, setSearch]             = useState('');

  useEffect(() => { loadAdherents(); }, []);

  async function loadAdherents() {
    setLoading(true);
    const { data } = await supabase
      .from('adherents')
      .select(`adherent_id, nom, prenom, photo_url, statut,
               cahier_presence(statut, montant_benefice_recu, est_beneficiaire_1, est_beneficiaire_2)`)
      .eq('statut', 'actif').order('nom');
    setAdherents(data || []);
    setLoading(false);
  }

  async function selectAdherent(a) {
    setSelected(a); setLoadingStats(true);
    const { data } = await supabase.from('cahier_presence').select('*')
      .eq('adherent_id', a.adherent_id).order('date_dimanche', { ascending: false });
    setStats(data || []);
    setLoadingStats(false);
  }

  const filtered = adherents.filter(a =>
    `${a.nom} ${a.prenom}`.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    const total  = stats.length;
    const pres   = stats.filter(x => x.statut === 'present').length;
    const taux   = total > 0 ? Math.round((pres / total) * 100) : 0;
    const gained = stats.reduce((acc, r) => acc + (r.montant_benefice_recu || 0), 0);
    const nbBenef = stats.filter(x => x.est_beneficiaire_1 || x.est_beneficiaire_2).length;
    const tc     = taux >= 70 ? '#4CAF50' : taux >= 50 ? '#FFA726' : '#EF5350';

    return (
      <View style={s.screen}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}><Text style={s.backTxt}>←</Text></TouchableOpacity>
          <Text style={s.topTitle} numberOfLines={1}>📊 {selected.nom} {selected.prenom}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <View style={s.statsGrid}>
            <StatCard icon="📋" val={total}        label="Séances"    color="#90CAF9" />
            <StatCard icon="✅" val={pres}          label="Présences"  color="#4CAF50" />
            <StatCard icon="❌" val={total - pres}  label="Absences"   color="#EF5350" />
            <StatCard icon="📊" val={`${taux}%`}   label="Taux"       color={tc} />
            <StatCard icon="🏆" val={nbBenef}       label="Bénéfices"  color={ACCENT} />
            <StatCard icon="💰" val={fmt(gained)}   label="Total reçu" color="#A5D6A7" />
          </View>

          <View style={s.panel}>
            <View style={s.panelHeader}>
              <Text style={s.panelHeaderTxt}>Détail des séances</Text>
              <View style={s.panelHeaderLine} />
            </View>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 1.5 }]}>Date</Text>
              <Text style={[s.th, { flex: 0.8 }]}>Statut</Text>
              <Text style={[s.th, { flex: 1 }]}>Montant</Text>
              <Text style={[s.th, { flex: 1 }]}>Bénéfice</Text>
            </View>
            {loadingStats ? <ActivityIndicator color={ACCENT} style={{ marginVertical: 20 }} />
              : stats.map((st, idx) => {
                  const estB = st.est_beneficiaire_1 || st.est_beneficiaire_2;
                  return (
                    <View key={st.presence_id}
                      style={[s.tableRow, idx % 2 === 0 && s.tableRowEven, st.statut === 'present' && s.tableRowPresent]}>
                      <Text style={[s.td, { flex: 1.5 }]}>{formatDateCourt(st.date_dimanche)}</Text>
                      <View style={{ flex: 0.8, paddingLeft: 6 }}>
                        <View style={[s.statusDot, { backgroundColor: st.statut === 'present' ? '#4CAF50' : '#EF5350' }]} />
                      </View>
                      <Text style={[s.td, { flex: 1, color: st.statut === 'present' ? '#4CAF50' : '#555' }]}>
                        {st.statut === 'present' ? fmt(st.montant_paye) : '—'}
                      </Text>
                      <Text style={[s.td, { flex: 1, color: estB ? ACCENT : '#555' }]}>
                        {estB ? `🏆 ${fmt(st.montant_benefice_recu)}` : '—'}
                      </Text>
                    </View>
                  );
                })
            }
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>📊 Historique présences</Text>
      </View>
      <View style={{ padding: 12, backgroundColor: DARK_PANEL, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <TextInput style={s.searchBox} placeholder="🔍 Rechercher un adhérent..."
          placeholderTextColor="#555" value={search} onChangeText={setSearch} />
      </View>
      {loading ? <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 60 }} /> : (
        <FlatList data={filtered} keyExtractor={a => a.adherent_id}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item: a, index }) => {
            const seances = a.cahier_presence || [];
            const total   = seances.length;
            const pres    = seances.filter(x => x.statut === 'present').length;
            const taux    = total > 0 ? Math.round((pres / total) * 100) : 0;
            const nbB     = seances.filter(x => x.est_beneficiaire_1 || x.est_beneficiaire_2).length;
            const tc      = taux >= 70 ? '#4CAF50' : taux >= 50 ? '#FFA726' : '#EF5350';
            return (
              <TouchableOpacity style={[s.histRow, index % 2 === 0 && s.histRowEven]} onPress={() => selectAdherent(a)}>
                <AvatarAdherent nom={a.nom} prenom={a.prenom}
                  photoUrl={a.photo_url} statut={a.statut} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.histNom}>{a.nom} {a.prenom}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Text style={[s.histBadge, { color: '#4CAF50' }]}>{pres}/{total}</Text>
                    {nbB > 0 && <Text style={[s.histBadge, { color: ACCENT }]}>🏆 {nbB}×</Text>}
                  </View>
                  <View style={[s.taux, { width: 100, marginTop: 5 }]}>
                    <View style={[s.tauxFill, { width: `${taux}%`, backgroundColor: tc }]} />
                  </View>
                </View>
                <Text style={[s.tauxPct, { color: tc, fontSize: 16 }]}>{taux}%</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  COMPOSANTS
// ══════════════════════════════════════════════════════════════
function RecapCard({ label, val, color, big }) {
  return (
    <View style={[s.recapCard, big && { flex: 2, borderColor: color + '88' }]}>
      <Text style={[s.recapVal, { color }, big && { fontSize: 19 }]}>{val}</Text>
      <Text style={s.recapLbl}>{label}</Text>
    </View>
  );
}
function StatCard({ icon, val, label, color }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[s.statCardVal, { color }]}>{val}</Text>
      <Text style={s.statCardLbl}>{label}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES — dark theme inspiré Student Attendance UI
// ══════════════════════════════════════════════════════════════
const DARK_BG    = '#1A1F2E';
const DARK_PANEL = '#212736';
const DARK_ROW   = '#262D3D';
const DARK_ROW2  = '#1E2433';
const ACCENT     = '#E8755A';
const BORDER     = '#2C3548';

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: DARK_BG },

  // Top bar
  topBar:       { backgroundColor: '#151A27', flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 44 : 14, paddingBottom: 12, paddingHorizontal: 12, gap: 8, borderBottomWidth: 2, borderBottomColor: ACCENT },
  backBtn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center' },
  backTxt:      { color: '#fff', fontSize: 18, fontWeight: 'bold', lineHeight: 20 },
  topTitle:     { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1 },
  topSub:       { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },
  topBtn:       { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  topBtnTxt:    { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Séances list
  nextCard:     { backgroundColor: DARK_PANEL, margin: 14, borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: ACCENT, gap: 12 },
  nextCardLeft: {},
  nextCardLabel:{ fontSize: 10, color: '#666', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextCardDate: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  nextCardRight:{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  nextChip:     { borderWidth: 1, borderColor: '#2C3A4A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  nextChipVal:  { fontSize: 13, fontWeight: 'bold', color: '#90CAF9' },
  nextChipLbl:  { fontSize: 9, color: '#666', marginTop: 2 },

  sectionHeader:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10 },
  sectionIcon:  { fontSize: 16, marginRight: 8 },
  sectionTitle: { color: '#ccc', fontSize: 13, fontWeight: '700' },
  sectionLine:  { flex: 1, height: 2, backgroundColor: ACCENT, marginLeft: 10, opacity: 0.5 },

  seanceRow:    { backgroundColor: DARK_PANEL, marginHorizontal: 14, marginBottom: 8, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  seanceDot:    { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  seanceDate:   { fontSize: 13, fontWeight: '700', color: '#ddd', marginBottom: 5 },
  seanceBadges: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  seanceBadge:  { fontSize: 11, fontWeight: '600' },
  taux:         { height: 4, backgroundColor: BORDER, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  tauxFill:     { height: '100%', borderRadius: 2 },
  tauxPct:      { fontSize: 16, fontWeight: 'bold' },
  parBenef:     { fontSize: 12, color: ACCENT, fontWeight: 'bold' },
  parBenefLbl:  { fontSize: 9, color: '#666' },
  chevron:      { color: '#444', fontSize: 22 },

  emptyBox:     { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTxt:     { color: '#555', fontSize: 15 },
  emptyBtn:     { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
  emptyBtnTxt:  { color: '#fff', fontWeight: 'bold' },

  // Panels
  panel:        { backgroundColor: DARK_PANEL, margin: 14, marginTop: 0, marginBottom: 14, borderRadius: 12, overflow: 'hidden' },
  panelHeader:  { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 0, gap: 8, marginBottom: 14 },
  panelHeaderIcon: { fontSize: 16 },
  panelHeaderTxt:  { color: '#bbb', fontSize: 13, fontWeight: '700' },
  panelHeaderLine: { flex: 1, height: 2, backgroundColor: ACCENT, marginLeft: 8 },

  // Ground fields
  groundRow:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 10, marginBottom: 14 },
  groundField:  { flex: 1, minWidth: 130 },
  groundLabel:  { fontSize: 11, color: '#666', marginBottom: 6, fontWeight: '600' },
  groundInput:  { backgroundColor: DARK_BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groundInputTxt:{ fontSize: 13, color: '#bbb' },

  // Bénéficiaires
  benefRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  benefCard:    { flex: 1, backgroundColor: DARK_BG, borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: BORDER, borderStyle: 'dashed', minHeight: 80 },
  benefCardActive: { borderStyle: 'solid', borderColor: ACCENT },
  benefCardLabel: { fontSize: 9, color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  benefCardNom:   { fontSize: 13, color: '#ddd', fontWeight: 'bold' },
  benefCardMontant: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  benefCardVide:  { color: '#444', fontSize: 12, fontStyle: 'italic', marginTop: 10 },
  absentPill:   { backgroundColor: 'rgba(239,83,80,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  absentPillTxt:{ color: '#EF5350', fontSize: 10, fontWeight: '600' },
  avalPill:     { backgroundColor: 'rgba(76,175,80,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  avalPillTxt:  { color: '#4CAF50', fontSize: 10 },

  // Select for everyone
  selectAll:      { paddingHorizontal: 14, marginBottom: 12 },
  selectAllLabel: { fontSize: 11, color: '#666', fontWeight: '600', marginBottom: 8 },
  selectAllPills: { flexDirection: 'row', gap: 8 },
  selectAllPill:  { borderRadius: 8, borderWidth: 1.5, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 8 },
  selectAllPillTxt:{ fontSize: 13, color: '#666' },

  // Tableau
  tableHead:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151A27', paddingHorizontal: 12, paddingVertical: 10 },
  th:           { fontSize: 10, color: '#444', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.4 },
  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#1A2030', backgroundColor: DARK_ROW },
  tableRowEven: { backgroundColor: DARK_ROW2 },
  tableRowPresent: { backgroundColor: 'rgba(76,175,80,0.05)' },
  td:           { fontSize: 12, color: '#777' },
  tdNom:        { fontSize: 13, fontWeight: '600', color: '#ccc' },
  tdBenef:      { fontSize: 10, color: ACCENT, fontWeight: '600' },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },

  // Radio buttons
  radioGroup:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  radioItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  radioOuter:   { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#444', justifyContent: 'center', alignItems: 'center' },
  radioInner:   { width: 8, height: 8, borderRadius: 4 },
  radioLabel:   { fontSize: 12, color: '#666' },

  // Remarque
  remarqueCell: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: DARK_BG },
  remarqueTxt:  { fontSize: 11, color: '#444' },
  remarqueInput:{ backgroundColor: DARK_BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER, color: '#ccc', padding: 12, fontSize: 14, minHeight: 90, marginBottom: 12 },

  // Recap
  recapGrid:    { flexDirection: 'row', flexWrap: 'wrap', padding: 14, paddingTop: 0, gap: 8 },
  recapCard:    { flex: 1, minWidth: 80, backgroundColor: DARK_BG, borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  recapVal:     { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  recapLbl:     { fontSize: 10, color: '#555', textAlign: 'center' },

  // Ordre alterno
  altiChip:     { backgroundColor: DARK_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginRight: 6, alignItems: 'center', minWidth: 56 },
  altiNum:      { fontSize: 9, color: '#444', marginBottom: 2 },
  altiNom:      { fontSize: 11, color: '#888', fontWeight: '600' },

  // Save button
  saveBtn:      { backgroundColor: ACCENT, margin: 14, marginTop: 0, borderRadius: 12, padding: 16, alignItems: 'center' },
  saveBtnTxt:   { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // Historique
  histRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: DARK_PANEL, borderBottomWidth: 1, borderBottomColor: BORDER },
  histRowEven:  { backgroundColor: DARK_ROW },
  histNom:      { fontSize: 14, fontWeight: '600', color: '#ccc' },
  histBadge:    { fontSize: 11, fontWeight: '600' },

  // Stats grid
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statCard:     { flex: 1, minWidth: 88, backgroundColor: DARK_PANEL, borderRadius: 10, padding: 12, alignItems: 'center', borderTopWidth: 3 },
  statCardVal:  { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  statCardLbl:  { fontSize: 10, color: '#555', marginTop: 3 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: DARK_PANEL, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:   { fontSize: 16, fontWeight: 'bold', color: '#ddd', marginBottom: 4 },
  modalSub:     { fontSize: 12, color: '#555', marginBottom: 14 },
  modalRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK_BG, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6, gap: 10 },
  modalNum:     { fontSize: 13, fontWeight: 'bold', color: '#555', width: 22 },
  modalNom:     { fontSize: 14, color: '#aaa', fontWeight: '500', flex: 1 },
  modalCloseBtn:{ backgroundColor: DARK_BG, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6, borderWidth: 1, borderColor: BORDER },
  modalCloseTxt:{ fontWeight: 'bold', fontSize: 14, color: '#888' },

  searchBox:    { backgroundColor: DARK_BG, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#ccc', borderWidth: 1, borderColor: BORDER },
});