import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import AdherentsScreen      from './AdherentsScreen';
import PresenceScreen       from './PresenceScreen';
import HuileSavonScreen     from './HuileSavonScreen';
import GrandeTontineScreen  from './GrandeTontineScreen';
import BanqueScreen         from './BanqueScreen';
import VentesScreen         from './VentesScreen';
import RoulementScreen      from './RoulementScreen';
import SolidariteScreen     from './SolidariteScreen';
import VoirbebeScreen       from './VoirbebeScreen';
import DettesScreen         from './DettesScreen';
import EvenementsScreen     from './EvenementsScreen';
import CaisseScreen         from './CaisseScreen';
import RessourcesScreen     from './RessourcesScreen';
import AdminScreen from './AdminScreen';

// Screens optionnels (commentez si non créés)
let SanctionsScreen = null;
let ChatScreen = null;
try { SanctionsScreen = require('./SanctionsScreen').default; } catch(e) {}
try { ChatScreen     = require('./ChatScreen').default;      } catch(e) {}

const MODULES = [
  { icon: '🔒', title: 'Administration', color: '#8B0000' },
  { icon: '👥', title: 'Adhérents',      color: '#1F3864' },
  { icon: '✅', title: 'Présence',        color: '#2E75B6' },
  { icon: '🪣', title: 'Huile+Savon',    color: '#1E7E34' },
  { icon: '🏆', title: 'Grande Tontine', color: '#C55A11' },
  { icon: '🏦', title: 'Banque',          color: '#7030A0' },
  { icon: '💹', title: 'Ventes',          color: '#1F3864' },
  { icon: '🔄', title: 'Roulements',     color: '#2E75B6' },
  { icon: '🤝', title: 'Solidarité',     color: '#1F7A4D' },
  { icon: '👶', title: 'Voir Bébé',      color: '#AD1457' },
  { icon: '⚠️', title: 'Dettes',         color: '#C00000' },
  { icon: '💰', title: 'Caisse',          color: '#4A2000' },
  { icon: '🎉', title: 'Événements',     color: '#4A235A' },
  { icon: '🏛️', title: 'Ressources',     color: '#1A5276' },
  { icon: '📊', title: 'Rapports',       color: '#7030A0' },
  { icon: '💬', title: 'Chat',            color: '#1F3864', badge: true },
];

// ══════════════════════════════════════════════════════════════
//  DASHBOARD PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function DashboardScreen() {
  const { isAdmin, isBureau, peut } = useRole();
  const [activeModule, setActiveModule] = useState(null);
  const [nonLusChat, setNonLusChat]     = useState(0);
  const [notifs, setNotifs]             = useState([]);
  const [showNotifs, setShowNotifs]     = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // ── Modal bienvenue ──
  const [showBienvenue, setShowBienvenue] = useState(false);
  const [profil, setProfil]               = useState(null);

  useEffect(() => { loadStats(); loadNotifs(); loadProfil(); }, []);

  async function loadProfil() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let adh = null;
      const { data: a1 } = await supabase.from('adherents')
        .select('*').eq('email', user.email).maybeSingle();
      if (a1) adh = a1;
      if (!adh) {
        const { data: a2 } = await supabase.from('adherents')
          .select('*').eq('user_id', user.id).maybeSingle();
        if (a2) adh = a2;
      }
      if (!adh) return;
      const adhId = adh.adherent_id;
      const today = new Date().toISOString().split('T')[0];
      const [
        { data: dettes },
        { data: sanctions },
        { data: roulement },
        { data: prochainBenef },
      ] = await Promise.all([
        supabase.from('dettes')
          .select('type_dette, montant_restant, description, statut')
          .eq('adherent_id', adhId)
          .in('statut', ['en_cours', 'partiellement_rembourse']),
        supabase.from('sanctions')
          .select('motif, montant, date_sanction, statut')
          .eq('adherent_id', adhId).eq('statut', 'impayee'),
        supabase.from('roulement')
          .select('code_pas, nb_pas, montant_du, montant_paye, statut, type_roulement')
          .eq('adherent_id', adhId).eq('statut', 'en_cours'),
        supabase.from('cahier_presence')
          .select('date_dimanche, beneficiaire')
          .eq('adherent_id', adhId).eq('beneficiaire', true)
          .gte('date_dimanche', today)
          .order('date_dimanche', { ascending: true }).limit(1),
      ]);
      const totalDettes    = (dettes    || []).reduce((s, d)  => s + (d.montant_restant || 0), 0);
      const totalSanctions = (sanctions || []).reduce((s, s2) => s + (s2.montant || 0), 0);
      setProfil({
        nom: adh.nom, prenom: adh.prenom, titre: adh.titre || '',
        groupe: adh.groupe, statut: adh.statut, role: adh.role,
        dateInscription: adh.date_inscription,
        dettes: dettes || [], totalDettes,
        sanctions: sanctions || [], totalSanctions,
        roulement: roulement || [],
        prochainBenef: prochainBenef?.[0] || null,
      });
      setShowBienvenue(true);
    } catch(e) { console.error('loadProfil', e); }
  }

  async function loadStats() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        { data: adherents },
        { data: presence },
        { data: dettes },
        { data: ventes },
        { data: roulements },
        { data: caisse },
        { data: bebe },
        { data: solidarite },
        { data: evenements },
        { data: fondRoulement },
      ] = await Promise.all([
        supabase.from('adherents').select('statut, liste_noire'),
        supabase.from('cahier_presence').select('date_dimanche').order('date_dimanche', { ascending: false }).limit(1),
        supabase.from('dettes').select('adherent_id, montant_restant').eq('statut', 'en_cours'),
        supabase.from('vente_banque').select('statut, montant_vente').eq('statut', 'en_cours'),
        supabase.from('roulement').select('statut, nb_pas, cotisation_par_dim').eq('statut', 'en_cours'),
        supabase.from('session_caisse').select('solde_jour, total_entrees, total_sorties, total_depenses').order('date_session', { ascending: false }).limit(1),
        supabase.from('accouchement').select('statut').eq('statut', 'demande'),
        supabase.from('evenement_solidarite').select('statut').eq('statut', 'en_cours'),
        supabase.from('evenement').select('date_evenement, statut').gte('date_evenement', today).neq('statut', 'annule').order('date_evenement').limit(3),
        supabase.from('fonds_roulement').select('solde').single(),
      ]);         

      // Adhérents
      const nbActifs      = (adherents || []).filter(a => a.statut === 'actif').length;
      const nbObservation = (adherents || []).filter(a => a.statut === 'en_observation').length;
      const nbBloques     = (adherents || []).filter(a => a.liste_noire).length;

      // Dettes
      const mapDettes = {};
      (dettes || []).forEach(d => { mapDettes[d.adherent_id] = (mapDettes[d.adherent_id] || 0) + d.montant_restant; });
      const nbDebiteurs = Object.keys(mapDettes).length;
      const totalDettes = Object.values(mapDettes).reduce((s, v) => s + v, 0);
      const nbBloquesD  = Object.values(mapDettes).filter(v => v > 100000).length;

      // Ventes
      const nbVentes        = (ventes || []).length;
      const totalVentes     = (ventes || []).reduce((s, v) => s + (v.montant_vente || 0), 0);

      // Roulement
      const totalPas        = (roulements || []).reduce((s, r) => s + r.nb_pas, 0);
      const cotisHebdo      = (roulements || []).reduce((s, r) => s + r.cotisation_par_dim, 0);

      // Caisse
      const dernSession     = caisse?.[0];
      const soldeGlobal     = dernSession ? dernSession.solde_jour : 0;

      // Dernière présence
      const dernPresence    = presence?.[0]?.date_dimanche || null;

      setStats({
        nbActifs, nbObservation, nbBloques,
        nbDebiteurs, totalDettes, nbBloquesD,
        nbVentes, totalVentes,
        totalPas, cotisHebdo,
        fondRoulement: fondRoulement?.solde || 0,
        soldeGlobal,
        dernSession,
        dernPresence,
        bebeEnAttente: (bebe || []).length,
        solidariteEnCours: (solidarite || []).length,
        evenementsAVenir: (evenements || []),
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setRefreshing(false);
  }

  function onRefresh() { setRefreshing(true); loadStats(); loadNotifs(); }

  async function loadNotifs() {
    setLoadingNotifs(true);
    const today = new Date().toISOString().split('T')[0];
    const liste = [];

    try {
      // 1. Messages chat non lus
      const { data: { user } } = await supabase.auth.getUser();
      let moiId = null;
      if (user) {
        const { data: adh } = await supabase.from('adherents')
          .select('adherent_id').eq('email', user.email).maybeSingle();
        if (adh) moiId = adh.adherent_id;
        if (!moiId) {
          const { data: adh2 } = await supabase.from('adherents')
            .select('adherent_id').eq('user_id', user.id).maybeSingle();
          if (adh2) moiId = adh2.adherent_id;
        }
      }
      if (moiId) {
        const { data: convs } = await supabase.from('conversations')
          .select('conversation_id, dernier_message, lu_par')
          .or(`type.eq.groupe,participants.cs.{${moiId}}`);
        const nbChat = (convs || []).filter(cv => !(cv.lu_par || []).includes(moiId)).length;
        if (nbChat > 0) {
          liste.push({ id: 'chat', icon: '💬', titre: 'Nouveaux messages', desc: `${nbChat} conversation(s) non lue(s)`, module: 'Chat', couleur: '#2E75B6' });
          setNonLusChat(nbChat);
        }
      }

      // 2. Sanctions impayées
      const { data: sanct } = await supabase.from('sanctions')
        .select('sanction_id').eq('statut', 'impayee');
      if ((sanct || []).length > 0)
        liste.push({ id: 'sanctions', icon: '⚠️', titre: 'Sanctions impayées', desc: `${sanct.length} sanction(s) en attente de paiement`, module: 'Sanctions', couleur: '#8B1A1A' });

      // 3. Échéances ventes banque
      const { data: ventes } = await supabase.from('vente_banque')
        .select('vente_id, prochaine_echeance').eq('statut', 'en_cours')
        .lte('prochaine_echeance', today);
      if ((ventes || []).length > 0)
        liste.push({ id: 'ventes', icon: '💹', titre: 'Échéances ventes', desc: `${ventes.length} vente(s) à l'échéance aujourd'hui`, module: 'Ventes', couleur: '#7030A0' });

      // 4. Adhérents en observation (nouveaux)
      const { data: obs } = await supabase.from('adherents')
        .select('adherent_id').eq('statut', 'en_observation');
      if ((obs || []).length > 0)
        liste.push({ id: 'adherents', icon: '👥', titre: 'Adhérents en observation', desc: `${obs.length} membre(s) en période d'observation`, module: 'Adhérents', couleur: '#C55A11' });

      // 5. Événements à venir (7 prochains jours)
      const dans7j = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const { data: evts } = await supabase.from('evenement')
        .select('evenement_id, titre').gte('date_evenement', today)
        .lte('date_evenement', dans7j).neq('statut', 'annule');
      if ((evts || []).length > 0)
        liste.push({ id: 'evenements', icon: '🎉', titre: 'Événements à venir', desc: `${evts.length} événement(s) dans les 7 prochains jours`, module: 'Événements', couleur: '#4A235A' });

      // 6. Dettes en retard
      const { data: dettes } = await supabase.from('dettes')
        .select('dette_id').eq('statut', 'en_cours').lte('date_limite', today);
      if ((dettes || []).length > 0)
        liste.push({ id: 'dettes', icon: '💸', titre: 'Dettes en retard', desc: `${dettes.length} dette(s) échue(s)`, module: 'Dettes', couleur: '#C00000' });

    } catch(e) { console.error('loadNotifs', e); }

    setNotifs(liste);
    setLoadingNotifs(false);
  }

  // Navigation modules
  if (activeModule === 'Administration') return <AdminScreen onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Adhérents')      return <AdherentsScreen     onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Présence')       return <PresenceScreen      onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Huile+Savon')    return <HuileSavonScreen    onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Grande Tontine') return <GrandeTontineScreen onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Banque')         return <BanqueScreen        onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Ventes')         return <VentesScreen        onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Roulements')     return <RoulementScreen     onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Solidarité')     return <SolidariteScreen    onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Voir Bébé')      return <VoirbebeScreen      onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Dettes')         return <DettesScreen        onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Caisse')         return <CaisseScreen        onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Événements')     return <EvenementsScreen    onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Ressources')     return <RessourcesScreen    onBack={() => setActiveModule(null)} />;
  if (activeModule === 'Sanctions')      return SanctionsScreen ? <SanctionsScreen onBack={() => setActiveModule(null)} /> : null;
  if (activeModule === 'Chat')           return ChatScreen ? <ChatScreen onBack={() => setActiveModule(null)} onNonLusChange={setNonLusChat} /> : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🐘 AJUMY</Text>
          <Text style={styles.headerSub}>Association des Jeunes Unis de Manjo à Yaoundé</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Cloche */}
          <TouchableOpacity style={styles.clocheBtn} onPress={() => setShowNotifs(true)}>
            <Text style={styles.clocheIcon}>🔔</Text>
            {notifs.length > 0 && (
              <View style={styles.clocheBadge}>
                <Text style={styles.clocheBadgeTxt}>{notifs.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Déconnexion */}
          <TouchableOpacity onPress={() => supabase.auth.signOut()}>
            <Text style={styles.logout}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1F3864']} />}>

        {loading ? <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 40 }} /> : (
          <>
            {/* ── Alertes urgentes ── */}
            {stats && (stats.nbBloquesD > 0 || stats.nbBloques > 0 || stats.bebeEnAttente > 0) && (
              <View style={styles.alertesContainer}>
                {stats.nbBloquesD > 0 && (
                  <TouchableOpacity style={styles.alerteCard} onPress={() => setActiveModule('Dettes')}>
                    <Text style={styles.alerteText}>🚫 {stats.nbBloquesD} adhérent(s) bloqué(s) — dettes &gt; 100 000 FCFA</Text>
                  </TouchableOpacity>
                )}
                {stats.nbBloques > 0 && (
                  <TouchableOpacity style={[styles.alerteCard, { backgroundColor: '#FFF3E0', borderColor: '#C55A11' }]}
                    onPress={() => setActiveModule('Ventes')}>
                    <Text style={[styles.alerteText, { color: '#C55A11' }]}>⚠️ {stats.nbBloques} adhérent(s) sur liste noire</Text>
                  </TouchableOpacity>
                )}
                {stats.bebeEnAttente > 0 && (
                  <TouchableOpacity style={[styles.alerteCard, { backgroundColor: '#FCE4EC', borderColor: '#AD1457' }]}
                    onPress={() => setActiveModule('Voir Bébé')}>
                    <Text style={[styles.alerteText, { color: '#AD1457' }]}>👶 {stats.bebeEnAttente} annonce(s) Voir Bébé en attente</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Résumé Caisse ── */}
            {stats && (
              <TouchableOpacity style={styles.caisseCard} onPress={() => setActiveModule('Caisse')}>
                <Text style={styles.caisseLabel}>💰 Solde de la dernière session</Text>
                <Text style={[styles.caisseVal, { color: (stats.dernSession?.solde_jour || 0) >= 0 ? '#1E7E34' : '#C00000' }]}>
                  {((stats.dernSession?.solde_jour || 0)).toLocaleString()} FCFA
                </Text>
                {stats.dernSession && (
                  <Text style={styles.caisseSub}>
                    📥 {(stats.dernSession.total_entrees || 0).toLocaleString()} · 📤 {(stats.dernSession.total_sorties || 0).toLocaleString()} · 💸 {(stats.dernSession.total_depenses || 0).toLocaleString()} FCFA
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* ── Indicateurs clés ── */}
            {stats && (
              <>
                <Text style={styles.sectionTitle}>📊 État de l'association</Text>

                <View style={styles.indicateursGrid}>

                  {/* Adhérents */}
                  <TouchableOpacity style={[styles.indicCard, { borderTopColor: '#1F3864' }]}
                    onPress={() => setActiveModule('Adhérents')}>
                    <Text style={styles.indicIcon}>👥</Text>
                    <Text style={styles.indicVal}>{stats.nbActifs}</Text>
                    <Text style={styles.indicLabel}>Adhérents{'\n'}actifs</Text>
                    {stats.nbObservation > 0 && <Text style={styles.indicSub}>{stats.nbObservation} en observation</Text>}
                  </TouchableOpacity>

                  {/* Dettes */}
                  <TouchableOpacity style={[styles.indicCard, { borderTopColor: '#C00000' }]}
                    onPress={() => setActiveModule('Dettes')}>
                    <Text style={styles.indicIcon}>⚠️</Text>
                    <Text style={[styles.indicVal, { color: stats.nbDebiteurs > 0 ? '#C00000' : '#1F3864' }]}>{stats.nbDebiteurs}</Text>
                    <Text style={styles.indicLabel}>Débiteurs{'\n'}actifs</Text>
                    {stats.totalDettes > 0 && <Text style={[styles.indicSub, { color: '#C00000' }]}>{(stats.totalDettes / 1000).toFixed(0)}k FCFA dû</Text>}
                  </TouchableOpacity>

                  {/* Ventes banque */}
                  <TouchableOpacity style={[styles.indicCard, { borderTopColor: '#7030A0' }]}
                    onPress={() => setActiveModule('Ventes')}>
                    <Text style={styles.indicIcon}>💹</Text>
                    <Text style={styles.indicVal}>{stats.nbVentes}</Text>
                    <Text style={styles.indicLabel}>Ventes{'\n'}actives</Text>
                    {stats.totalVentes > 0 && <Text style={styles.indicSub}>{(stats.totalVentes / 1000).toFixed(0)}k engagés</Text>}
                  </TouchableOpacity>

                  {/* Roulement */}
                  <TouchableOpacity style={[styles.indicCard, { borderTopColor: '#2E75B6' }]}
                    onPress={() => setActiveModule('Roulements')}>
                    <Text style={styles.indicIcon}>🔄</Text>
                    <Text style={styles.indicVal}>{stats.totalPas}</Text>
                    <Text style={styles.indicLabel}>Pas de{'\n'}roulement</Text>
                    {stats.cotisHebdo > 0 && <Text style={styles.indicSub}>{stats.cotisHebdo.toLocaleString()} FCFA/dim</Text>}
                  </TouchableOpacity>

                  {/* Fonds roulement */}
                  <TouchableOpacity style={[styles.indicCard, { borderTopColor: '#2E75B6' }]}
                    onPress={() => setActiveModule('Roulements')}>
                    <Text style={styles.indicIcon}>🏦</Text>
                    <Text style={[styles.indicVal, { fontSize: 14 }]}>{(stats.fondRoulement / 1000).toFixed(0)}k</Text>
                    <Text style={styles.indicLabel}>Fonds{'\n'}roulement</Text>
                    <Text style={styles.indicSub}>FCFA</Text>
                  </TouchableOpacity>

                  {/* Solidarité en cours */}
                  <TouchableOpacity style={[styles.indicCard, { borderTopColor: '#1F7A4D' }]}
                    onPress={() => setActiveModule('Solidarité')}>
                    <Text style={styles.indicIcon}>🤝</Text>
                    <Text style={styles.indicVal}>{stats.solidariteEnCours}</Text>
                    <Text style={styles.indicLabel}>Solidarité{'\n'}en cours</Text>
                  </TouchableOpacity>

                </View>

                {/* ── Dernière présence ── */}
                {stats.dernPresence && (
                  <TouchableOpacity style={styles.presenceCard} onPress={() => setActiveModule('Présence')}>
                    <Text style={styles.presenceLabel}>✅ Dernière réunion</Text>
                    <Text style={styles.presenceDate}>
                      {new Date(stats.dernPresence + 'T12:00:00').toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* ── Événements à venir ── */}
                {stats.evenementsAVenir.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>🎉 Événements à venir</Text>
                    {stats.evenementsAVenir.map(evt => (
                      <TouchableOpacity key={evt.evenement_id || Math.random()} style={styles.evtCard}
                        onPress={() => setActiveModule('Événements')}>
                        <Text style={styles.evtDate}>
                          📅 {new Date(evt.date_evenement + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Text>
                        <Text style={styles.evtTitre}>{evt.titre}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ── Grille des modules ── */}
            <Text style={styles.sectionTitle}>🧭 Modules</Text>
            <View style={styles.modulesGrid}>
              {MODULES.map((mod, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.moduleCard, { backgroundColor: mod.color }]}
                  onPress={() => setActiveModule(mod.title)}>
                  <Text style={styles.moduleIcon}>{mod.icon}</Text>
                  <Text style={styles.moduleTitle}>{mod.title}</Text>
                  {mod.badge && nonLusChat > 0 && (
                    <View style={styles.moduleBadge}>
                      <Text style={styles.moduleBadgeTxt}>{nonLusChat}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {/* ── Modal Bienvenue ── */}
      {profil && (
        <Modal visible={showBienvenue} transparent animationType="fade">
          <View style={styles.bienvenueOverlay}>
            <View style={styles.bienvenuePanel}>

              {/* En-tête salutation */}
              <View style={styles.bienvenueHeader}>
                <View style={styles.bienvenueAvatar}>
                  <Text style={styles.bienvenueAvatarTxt}>
                    {(profil.prenom?.[0] || '') + (profil.nom?.[0] || '')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bienvenueBonjour}>
                    {new Date().getHours() < 12 ? '🌅 Bonjour' : new Date().getHours() < 18 ? '☀️ Bonne journée' : '🌙 Bonsoir'},
                  </Text>
                  <Text style={styles.bienvenueName}>
                    {profil.titre} {profil.prenom} {profil.nom}
                  </Text>
                  <Text style={styles.bienvenueRole}>
                    {profil.role?.replace(/_/g, ' ')} · {profil.groupe}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowBienvenue(false)} style={styles.bienvenueClose}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Statut général */}
              <View style={[styles.bienvenueStatut, {
                backgroundColor: profil.statut === 'actif' ? '#E8F5E9' :
                                  profil.statut === 'en_observation' ? '#FFF8E1' : '#FFEBEE',
                borderColor:     profil.statut === 'actif' ? '#1E7E34' :
                                  profil.statut === 'en_observation' ? '#F9A825' : '#C00000',
              }]}>
                <Text style={[styles.bienvenueStatutTxt, {
                  color: profil.statut === 'actif' ? '#1E7E34' :
                          profil.statut === 'en_observation' ? '#F9A825' : '#C00000',
                }]}>
                  {profil.statut === 'actif' ? '✅ Membre actif' :
                   profil.statut === 'en_observation' ? '👁️ En observation' : '🚫 Inactif'}
                </Text>
                {profil.dateInscription && (
                  <Text style={styles.bienvenueStatutSub}>
                    Membre depuis le {new Date(profil.dateInscription + 'T12:00:00')
                      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                )}
              </View>

              {/* Dettes */}
              <View style={styles.bienvenueSectionCard}>
                <View style={styles.bienvenueSectionHdr}>
                  <Text style={styles.bienvenueSectionIcon}>💸</Text>
                  <Text style={styles.bienvenueSectionTitle}>Dettes en cours</Text>
                  <Text style={[styles.bienvenueBadge, { backgroundColor: profil.totalDettes > 0 ? '#C00000' : '#1E7E34' }]}>
                    {profil.totalDettes > 0 ? `${profil.totalDettes.toLocaleString()} FCFA` : 'RAS'}
                  </Text>
                </View>
                {profil.dettes.length === 0
                  ? <Text style={styles.bienvenueEmpty}>Aucune dette 🎉</Text>
                  : profil.dettes.slice(0, 3).map((d, i) => (
                      <View key={i} style={styles.bienvenueRow}>
                        <Text style={styles.bienvenueRowLabel} numberOfLines={1}>
                          {d.description || d.type_dette?.replace(/_/g, ' ')}
                        </Text>
                        <Text style={[styles.bienvenueRowVal, { color: '#C00000' }]}>
                          {(d.montant_restant || 0).toLocaleString()} FCFA
                        </Text>
                      </View>
                    ))
                }
                {profil.dettes.length > 3 && (
                  <Text style={styles.bienvenueMore}>+ {profil.dettes.length - 3} autre(s)…</Text>
                )}
              </View>

              {/* Sanctions */}
              <View style={styles.bienvenueSectionCard}>
                <View style={styles.bienvenueSectionHdr}>
                  <Text style={styles.bienvenueSectionIcon}>⚖️</Text>
                  <Text style={styles.bienvenueSectionTitle}>Sanctions impayées</Text>
                  <Text style={[styles.bienvenueBadge, { backgroundColor: profil.totalSanctions > 0 ? '#8B1A1A' : '#1E7E34' }]}>
                    {profil.totalSanctions > 0 ? `${profil.totalSanctions.toLocaleString()} FCFA` : 'RAS'}
                  </Text>
                </View>
                {profil.sanctions.length === 0
                  ? <Text style={styles.bienvenueEmpty}>Aucune sanction 👍</Text>
                  : profil.sanctions.slice(0, 3).map((s, i) => (
                      <View key={i} style={styles.bienvenueRow}>
                        <Text style={styles.bienvenueRowLabel}>
                          {s.motif?.replace(/_/g, ' ')} · {s.date_sanction
                            ? new Date(s.date_sanction + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                            : ''}
                        </Text>
                        <Text style={[styles.bienvenueRowVal, { color: '#8B1A1A' }]}>
                          {(s.montant || 0).toLocaleString()} FCFA
                        </Text>
                      </View>
                    ))
                }
              </View>

              {/* Roulement en cours */}
              {profil.roulement.length > 0 && (
                <View style={styles.bienvenueSectionCard}>
                  <View style={styles.bienvenueSectionHdr}>
                    <Text style={styles.bienvenueSectionIcon}>🔄</Text>
                    <Text style={styles.bienvenueSectionTitle}>Roulement en cours</Text>
                  </View>
                  {profil.roulement.map((r, i) => {
                    const restant = (r.montant_du || 0) - (r.montant_paye || 0);
                    return (
                      <View key={i} style={styles.bienvenueRow}>
                        <Text style={styles.bienvenueRowLabel}>
                          {r.code_pas} · {r.type_roulement?.replace(/_/g, ' ')}
                        </Text>
                        <Text style={[styles.bienvenueRowVal, { color: restant > 0 ? '#C55A11' : '#1E7E34' }]}>
                          {restant > 0 ? `${restant.toLocaleString()} FCFA restant` : '✅ Soldé'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Prochain bénéfice */}
              {profil.prochainBenef && (
                <View style={[styles.bienvenueSectionCard, { backgroundColor: '#E8F5E9', borderColor: '#1E7E34' }]}>
                  <View style={styles.bienvenueSectionHdr}>
                    <Text style={styles.bienvenueSectionIcon}>🎁</Text>
                    <Text style={[styles.bienvenueSectionTitle, { color: '#1E7E34' }]}>Votre prochain bénéfice</Text>
                  </View>
                  <Text style={[styles.bienvenueEmpty, { color: '#1E7E34', fontWeight: 'bold', fontSize: 14 }]}>
                    📅 {new Date(profil.prochainBenef.date_dimanche + 'T12:00:00')
                      .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              )}

              {/* Bouton fermer */}
              <TouchableOpacity style={styles.bienvenueBtnOk} onPress={() => setShowBienvenue(false)}>
                <Text style={styles.bienvenueBtnOkTxt}>Accéder au tableau de bord  →</Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>
      )}

      {/* ── Panel Notifications ── */}
      <Modal visible={showNotifs} transparent animationType="slide">
        <View style={styles.notifsOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowNotifs(false)} />
          <View style={styles.notifsPanel}>
            <View style={styles.notifsHeader}>
              <Text style={styles.notifsTitre}>🔔 Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifs(false)}>
                <Text style={{ color: '#C55A11', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingNotifs
              ? <ActivityIndicator color="#C55A11" style={{ marginTop: 20 }} />
              : notifs.length === 0
                ? <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Text style={{ fontSize: 36 }}>✅</Text>
                    <Text style={{ color: '#888', marginTop: 12 }}>Aucune notification</Text>
                  </View>
                : notifs.map(n => (
                    <TouchableOpacity key={n.id} style={[styles.notifItem, { borderLeftColor: n.couleur }]}
                      onPress={() => { setShowNotifs(false); setActiveModule(n.module); }}>
                      <Text style={styles.notifIcon}>{n.icon}</Text>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.notifTitre}>{n.titre}</Text>
                        <Text style={styles.notifDesc}>{n.desc}</Text>
                      </View>
                      <Text style={{ color: '#ccc', fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                  ))
            }
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F0F4F8' },
  header:             { backgroundColor: '#1F3864', padding: 16, paddingTop: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerSub:          { color: '#B0C4DE', fontSize: 11, marginTop: 2 },
  logout:             { color: '#D6E4F0', fontSize: 13 },

  alertesContainer:   { marginBottom: 10 },
  alerteCard:         { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 12, marginBottom: 6, borderLeftWidth: 4, borderColor: '#C00000' },
  alerteText:         { color: '#C00000', fontWeight: 'bold', fontSize: 13 },

  caisseCard:         { backgroundColor: '#1F3864', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 14, elevation: 4 },
  caisseLabel:        { color: '#B0C4DE', fontSize: 13, marginBottom: 4 },
  caisseVal:          { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  caisseSub:          { color: '#B0C4DE', fontSize: 12, marginTop: 6 },

  sectionTitle:       { fontSize: 14, fontWeight: 'bold', color: '#1F3864', marginVertical: 10 },

  indicateursGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  indicCard:          { backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderTopWidth: 4, elevation: 2, width: '30.5%' },
  indicIcon:          { fontSize: 20, marginBottom: 4 },
  indicVal:           { fontSize: 20, fontWeight: 'bold', color: '#1F3864' },
  indicLabel:         { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 2 },
  indicSub:           { fontSize: 10, color: '#888', marginTop: 3, textAlign: 'center' },

  presenceCard:       { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#1E7E34' },
  presenceLabel:      { fontSize: 12, color: '#1E7E34', fontWeight: 'bold', marginBottom: 2 },
  presenceDate:       { fontSize: 14, color: '#1F3864', fontWeight: '600', textTransform: 'capitalize' },

  evtCard:            { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  evtDate:            { fontSize: 12, color: '#7030A0', fontWeight: 'bold', width: 70 },
  evtTitre:           { fontSize: 14, color: '#1F3864', fontWeight: '600', flex: 1 },

  modulesGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  moduleCard:         { position: 'relative', width: '22%', aspectRatio: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 3, padding: 6 },
  moduleIcon:         { fontSize: 22 },
  moduleTitle:        { color: '#fff', fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  moduleBadge:        { position: 'absolute', top: 4, right: 4, backgroundColor: '#C00000', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  moduleBadgeTxt:     { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Cloche
  clocheBtn:          { position: 'relative', width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  clocheIcon:         { fontSize: 20 },
  clocheBadge:        { position: 'absolute', top: 0, right: 0, backgroundColor: '#C00000', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#1F3864' },
  clocheBadgeTxt:     { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  // Modal bienvenue
  bienvenueOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  bienvenuePanel:        { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxHeight: '90%', overflow: 'hidden', elevation: 10 },
  bienvenueHeader:       { backgroundColor: '#1F3864', flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  bienvenueAvatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: '#C55A11', justifyContent: 'center', alignItems: 'center' },
  bienvenueAvatarTxt:    { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  bienvenueBonjour:      { color: '#B0C4DE', fontSize: 12 },
  bienvenueName:         { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 1 },
  bienvenueRole:         { color: '#B0C4DE', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  bienvenueClose:        { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  bienvenueStatut:       { margin: 12, marginBottom: 4, borderRadius: 10, padding: 10, borderWidth: 1 },
  bienvenueStatutTxt:    { fontWeight: 'bold', fontSize: 13 },
  bienvenueStatutSub:    { fontSize: 11, color: '#888', marginTop: 2 },
  bienvenueSectionCard:  { marginHorizontal: 12, marginTop: 8, backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E8E8E0' },
  bienvenueSectionHdr:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  bienvenueSectionIcon:  { fontSize: 16 },
  bienvenueSectionTitle: { flex: 1, fontSize: 13, fontWeight: 'bold', color: '#1F3864' },
  bienvenueBadge:        { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  bienvenueEmpty:        { color: '#888', fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 4 },
  bienvenueRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  bienvenueRowLabel:     { flex: 1, fontSize: 12, color: '#444', textTransform: 'capitalize' },
  bienvenueRowVal:       { fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  bienvenueMore:         { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 4 },
  bienvenueBtnOk:        { margin: 12, marginTop: 14, backgroundColor: '#1F3864', borderRadius: 12, padding: 14, alignItems: 'center' },
  bienvenueBtnOkTxt:     { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Panel notifs
  notifsOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  notifsPanel:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  notifsHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  notifsTitre:        { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  notifItem:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4 },
  notifIcon:          { fontSize: 22 },
  notifTitre:         { fontSize: 14, fontWeight: 'bold', color: '#1E2130' },
  notifDesc:          { fontSize: 12, color: '#888', marginTop: 2 },
});