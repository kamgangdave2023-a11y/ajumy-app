import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, FlatList, Switch
} from 'react-native';
import { supabase } from '../lib/supabase';
import PermissionsScreen from './PermissionsScreen';

// ── Helpers ──────────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString() + ' FCFA'; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ROLE_COLORS  = { admin: '#C00000', bureau: '#C55A11', adherent: '#1E7E34' };
const ROLE_LABELS  = { admin: '🔴 Admin', bureau: '🟠 Bureau', adherent: '🟢 Adhérent' };
const LOG_ICONS    = { connexion: '🔐', deconnexion: '🔓', modification: '✏️', suppression: '🗑️', export: '📤', creation: '➕' };
const LOG_COLORS   = { connexion: '#2E75B6', deconnexion: '#888', modification: '#C55A11', suppression: '#C00000', export: '#7030A0', creation: '#1E7E34' };

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
//  ÉCRAN PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function AdminScreen({ onBack }) {
  const [vue, setVue] = useState('accueil');

  if (vue === 'utilisateurs')  return <UtilisateursScreen  onBack={() => setVue('accueil')} />;
  if (vue === 'permissions')    return <PermissionsScreen    onBack={() => setVue('accueil')} />;
  if (vue === 'parametres')    return <ParametresScreen    onBack={() => setVue('accueil')} />;
  if (vue === 'logs')          return <LogsScreen          onBack={() => setVue('accueil')} />;
  if (vue === 'session')       return <SessionDimancheScreen onBack={() => setVue('accueil')} />;

  const sections = [
    { key: 'session',      icon: '📍', titre: 'Session Dimanche',     desc: 'Ouvrir/fermer, QR Code, PIN, selfies, présences', color: '#8B1A1A' },
    { key: 'utilisateurs', icon: '👤', titre: 'Utilisateurs',         desc: 'Comptes, rôles, accès',           color: '#1F3864' },
    { key: 'parametres',   icon: '⚙️', titre: 'Paramètres',           desc: 'Taux, cotisations, seuils, infos', color: '#4A2000' },
    { key: 'logs',         icon: '📋', titre: 'Logs & Audit',         desc: 'Historique des actions',          color: '#2E75B6' },
    { key: 'permissions',  icon: '🛡️', titre: 'Permissions',          desc: 'Droits par rôle (Voir/Ajouter/Modifier/Supprimer)', color: '#1E7E34' },
  ];

  return (
    <View style={styles.container}>
      <Header title="🔒 Administration" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.adminBanner}>
          <Text style={styles.adminBannerIcon}>🛡️</Text>
          <Text style={styles.adminBannerText}>Zone réservée aux administrateurs</Text>
        </View>
        {sections.map(s => (
          <TouchableOpacity key={s.key} style={[styles.sectionCard, { borderLeftColor: s.color }]}
            onPress={() => setVue(s.key)}>
            <Text style={styles.sectionIcon}>{s.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitre}>{s.titre}</Text>
              <Text style={styles.sectionDesc}>{s.desc}</Text>
            </View>
            <Text style={{ color: '#aaa', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  GESTION UTILISATEURS
// ══════════════════════════════════════════════════════════════
function UtilisateursScreen({ onBack }) {
  const [adherents, setAdherents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);
  const [modalVue, setModalVue]   = useState(null); // 'detail' | 'creer'
  const [saving, setSaving]       = useState(false);

  // Nouveau compte
  const [nouveauEmail, setNouveauEmail] = useState('');
  const [nouveauRole, setNouveauRole]   = useState('adherent');
  const [nouveauAdh, setNouveauAdh]     = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('adherents')
      .select('adherent_id, nom, prenom, email, statut, role, liste_noire, created_at')
      .order('nom');
    setAdherents(data || []);
    setLoading(false);
  }

  async function changerRole(adherentId, role) {
    await supabase.from('adherents').update({ role }).eq('adherent_id', adherentId);
    await logAction('modification', 'admin', `Rôle changé → ${role}`, { adherent_id: adherentId });
    load();
    setModalVue(null);
  }

  async function toggleStatut(adherent) {
    const newStatut = adherent.statut === 'actif' ? 'inactif' : 'actif';
    await supabase.from('adherents').update({ statut: newStatut }).eq('adherent_id', adherent.adherent_id);
    await logAction('modification', 'admin', `Compte ${newStatut}`, { adherent_id: adherent.adherent_id });
    load();
  }

  async function resetMotDePasse(email) {
    if (!email) { Alert.alert('⚠️', 'Aucun email pour cet adhérent.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://ajumy.app/reset-password',
    });
    setSaving(false);
    if (error) Alert.alert('Erreur', error.message);
    else {
      await logAction('modification', 'admin', `Reset mot de passe envoyé à ${email}`);
      Alert.alert('✅ Email envoyé', `Un lien de réinitialisation a été envoyé à ${email}`);
    }
  }

  async function creerCompte() {
    if (!nouveauEmail || !nouveauAdh) {
      Alert.alert('⚠️', 'Sélectionnez un adhérent et saisissez un email.');
      return;
    }
    setSaving(true);
    // Mettre à jour l'email et le rôle dans adherents
    const { error } = await supabase.from('adherents')
      .update({ email: nouveauEmail, role: nouveauRole })
      .eq('adherent_id', nouveauAdh.adherent_id);
    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    // Inviter l'utilisateur par email
    const { error: invErr } = await supabase.auth.admin?.inviteUserByEmail?.(nouveauEmail) || {};
    await logAction('creation', 'admin', `Compte créé pour ${nouveauAdh.nom} ${nouveauAdh.prenom}`, { email: nouveauEmail, role: nouveauRole });
    setSaving(false);
    Alert.alert('✅ Compte créé', `Un email d'invitation a été envoyé à ${nouveauEmail}`);
    setModalVue(null);
    setNouveauEmail('');
    setNouveauAdh(null);
    load();
  }

  const filtres = adherents.filter(a =>
    `${a.nom} ${a.prenom}`.toLowerCase().includes(search.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Header title="👤 Utilisateurs" onBack={onBack} />

      <View style={{ padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', gap: 8 }}>
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
          placeholder="🔍 Rechercher un adhérent..." />
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setModalVue('creer')}>
          <Text style={styles.btnPrimaryText}>➕ Créer un compte</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={filtres}
          keyExtractor={a => a.adherent_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userCard} onPress={() => { setSelected(item); setModalVue('detail'); }}>
              <View style={[styles.roleTag, { backgroundColor: ROLE_COLORS[item.role || 'adherent'] + '20', borderColor: ROLE_COLORS[item.role || 'adherent'] }]}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: ROLE_COLORS[item.role || 'adherent'] }}>
                  {ROLE_LABELS[item.role || 'adherent']}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.userName}>{item.nom} {item.prenom}</Text>
                <Text style={styles.userEmail}>{item.email || 'Pas de compte'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statutDot, { backgroundColor: item.statut === 'actif' ? '#1E7E34' : '#aaa' }]} />
                <Text style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{item.statut}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal détail utilisateur */}
      <Modal visible={modalVue === 'detail' && !!selected} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitre}>👤 {selected?.nom} {selected?.prenom}</Text>
            <Text style={styles.modalSub}>{selected?.email || 'Aucun email'}</Text>

            <Text style={styles.modalLabel}>Rôle actuel</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {['admin', 'bureau', 'adherent'].map(r => (
                <TouchableOpacity key={r} onPress={() => changerRole(selected?.adherent_id, r)}
                  style={[styles.roleBtn, { borderColor: ROLE_COLORS[r], backgroundColor: selected?.role === r ? ROLE_COLORS[r] : '#fff' }]}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: selected?.role === r ? '#fff' : ROLE_COLORS[r] }}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalLabel}>Compte {selected?.statut === 'actif' ? 'actif' : 'inactif'}</Text>
              <Switch
                value={selected?.statut === 'actif'}
                onValueChange={() => { toggleStatut(selected); setSelected(p => ({ ...p, statut: p.statut === 'actif' ? 'inactif' : 'actif' })); }}
                trackColor={{ true: '#1E7E34', false: '#ccc' }}
              />
            </View>

            <TouchableOpacity style={[styles.btnSecondary, { marginBottom: 8 }]}
              onPress={() => resetMotDePasse(selected?.email)} disabled={saving}>
              {saving ? <ActivityIndicator color="#1F3864" /> :
                <Text style={styles.btnSecondaryText}>🔑 Réinitialiser le mot de passe</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnClose} onPress={() => { setModalVue(null); setSelected(null); }}>
              <Text style={styles.btnCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal créer compte */}
      <Modal visible={modalVue === 'creer'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitre}>➕ Nouveau compte</Text>

            <Text style={styles.modalLabel}>Adhérent</Text>
            <ScrollView style={{ maxHeight: 150, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 12 }}>
              {adherents.filter(a => !a.email).map(a => (
                <TouchableOpacity key={a.adherent_id}
                  style={[styles.pickItem, nouveauAdh?.adherent_id === a.adherent_id && { backgroundColor: '#E8F4FD' }]}
                  onPress={() => setNouveauAdh(a)}>
                  <Text style={{ color: nouveauAdh?.adherent_id === a.adherent_id ? '#2E75B6' : '#333' }}>
                    {a.nom} {a.prenom}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Email</Text>
            <TextInput style={styles.input} value={nouveauEmail} onChangeText={setNouveauEmail}
              placeholder="email@exemple.com" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.modalLabel}>Rôle</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {['admin', 'bureau', 'adherent'].map(r => (
                <TouchableOpacity key={r} onPress={() => setNouveauRole(r)}
                  style={[styles.roleBtn, { borderColor: ROLE_COLORS[r], backgroundColor: nouveauRole === r ? ROLE_COLORS[r] : '#fff' }]}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: nouveauRole === r ? '#fff' : ROLE_COLORS[r] }}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1 }]}
              onPress={creerCompte} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> :
                <Text style={styles.btnPrimaryText}>✅ Créer le compte</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnClose, { marginTop: 8 }]} onPress={() => setModalVue(null)}>
              <Text style={styles.btnCloseText}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  PARAMÈTRES ASSOCIATION
// ══════════════════════════════════════════════════════════════
function ParametresScreen({ onBack }) {
  const [params, setParams]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [modifs, setModifs]   = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('parametres').select('*').order('categorie');
    const map = {};
    (data || []).forEach(p => { map[p.cle] = p; });
    setParams(map);
    setLoading(false);
  }

  function setVal(cle, val) {
    setModifs(p => ({ ...p, [cle]: val }));
  }

  function getVal(cle) {
    return modifs[cle] !== undefined ? modifs[cle] : (params[cle]?.valeur || '');
  }

  async function sauvegarder() {
    if (Object.keys(modifs).length === 0) { Alert.alert('Aucune modification'); return; }
    setSaving(true);
    for (const [cle, valeur] of Object.entries(modifs)) {
      await supabase.from('parametres').update({ valeur, updated_at: new Date().toISOString() }).eq('cle', cle);
    }
    await logAction('modification', 'admin', `Paramètres modifiés : ${Object.keys(modifs).join(', ')}`);
    setSaving(false);
    setModifs({});
    Alert.alert('✅ Paramètres sauvegardés');
    load();
  }

  const categories = [
    { key: 'infos',       titre: '🏛️ Informations association' },
    { key: 'ventes',      titre: '💹 Ventes banque'           },
    { key: 'cotisations', titre: '💰 Cotisations'             },
    { key: 'alertes',     titre: '⚠️ Seuils alertes'          },
  ];

  return (
    <View style={styles.container}>
      <Header title="⚙️ Paramètres" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#4A2000" style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {categories.map(cat => {
            const items = Object.values(params).filter(p => p.categorie === cat.key);
            if (items.length === 0) return null;
            return (
              <View key={cat.key} style={styles.paramSection}>
                <Text style={styles.paramSectionTitre}>{cat.titre}</Text>
                {items.map(p => (
                  <View key={p.cle} style={{ marginBottom: 12 }}>
                    <Text style={styles.paramLabel}>{p.label}</Text>
                    <TextInput
                      style={[styles.input, modifs[p.cle] !== undefined && { borderColor: '#C55A11', borderWidth: 2 }]}
                      value={getVal(p.cle)}
                      onChangeText={v => setVal(p.cle, v)}
                      keyboardType={p.type === 'number' ? 'numeric' : p.type === 'email' ? 'email-address' : 'default'}
                      placeholder={p.label}
                    />
                    {p.updated_at && (
                      <Text style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                        Modifié le {fmtDate(p.updated_at)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            );
          })}

          {Object.keys(modifs).length > 0 && (
            <View style={styles.modifsBanner}>
              <Text style={{ color: '#C55A11', fontWeight: 'bold', fontSize: 13 }}>
                ✏️ {Object.keys(modifs).length} modification(s) non sauvegardée(s)
              </Text>
            </View>
          )}

          <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1, marginTop: 8 }]}
            onPress={sauvegarder} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.btnPrimaryText}>💾 Sauvegarder les paramètres</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  LOGS / AUDIT
// ══════════════════════════════════════════════════════════════
function LogsScreen({ onBack }) {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtreType, setFiltreType] = useState('tous');
  const [filtreModule, setFiltreModule] = useState('tous');
  const [page, setPage]         = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { load(); }, [filtreType, filtreModule, page]);

  async function load() {
    setLoading(true);
    let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (filtreType !== 'tous') q = q.eq('type', filtreType);
    if (filtreModule !== 'tous') q = q.eq('module', filtreModule);
    const { data } = await q;
    setLogs(data || []);
    setLoading(false);
  }

  const types = ['tous', 'connexion', 'deconnexion', 'modification', 'suppression', 'creation', 'export'];

  return (
    <View style={styles.container}>
      <Header title="📋 Logs & Audit" onBack={onBack} />

      {/* Filtres type */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' }}
        contentContainerStyle={{ padding: 10, gap: 8, flexDirection: 'row' }}>
        {types.map(t => (
          <TouchableOpacity key={t} onPress={() => { setFiltreType(t); setPage(0); }}
            style={[styles.filtreChip, filtreType === t && { backgroundColor: LOG_COLORS[t] || '#1F3864' }]}>
            <Text style={{ fontSize: 12, color: filtreType === t ? '#fff' : '#555', fontWeight: filtreType === t ? 'bold' : 'normal' }}>
              {t === 'tous' ? '📋 Tous' : `${LOG_ICONS[t]} ${t}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator size="large" color="#2E75B6" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={logs}
          keyExtractor={l => l.log_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.logCard, { borderLeftColor: LOG_COLORS[item.type] || '#888' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 18 }}>{LOG_ICONS[item.type] || '📋'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1F3864' }}>{item.action}</Text>
                  {item.adherent_nom && (
                    <Text style={{ fontSize: 11, color: '#888' }}>par {item.adherent_nom}</Text>
                  )}
                </View>
                <Text style={{ fontSize: 10, color: '#aaa', textAlign: 'right' }}>
                  {item.module && `[${item.module}]\n`}{fmtDate(item.created_at)}
                </Text>
              </View>
              {item.details && Object.keys(item.details).length > 0 && (
                <Text style={{ fontSize: 11, color: '#777', fontFamily: 'monospace' }}>
                  {JSON.stringify(item.details)}
                </Text>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucun log enregistré.</Text>}
          ListFooterComponent={
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              {page > 0 && (
                <TouchableOpacity style={styles.btnPage} onPress={() => setPage(p => p - 1)}>
                  <Text style={styles.btnPageText}>← Page précédente</Text>
                </TouchableOpacity>
              )}
              {logs.length === PAGE_SIZE && (
                <TouchableOpacity style={styles.btnPage} onPress={() => setPage(p => p + 1)}>
                  <Text style={styles.btnPageText}>Page suivante →</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  SESSION DIMANCHE — QR + PIN + Selfies + Présences
// ══════════════════════════════════════════════════════════════
function SessionDimancheScreen({ onBack }) {
  const today = new Date().toISOString().split('T')[0];
  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [pointages, setPointages]     = useState([]);
  const [selfieModal, setSelfieModal] = useState(null);
  const [validModal, setValidModal]   = useState(false);
  const [monRole, setMonRole]         = useState(null);
  const [monId, setMonId]             = useState(null);

  useEffect(() => { load(); chargerMonProfil(); }, []);

  async function chargerMonProfil() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('adherents')
      .select('adherent_id, role').eq('email', user.email).maybeSingle();
    if (data) { setMonRole(data.role); setMonId(data.adherent_id); }
  }

  async function load() {
    setLoading(true);
    const { data: sess } = await supabase.from('session_dimanche')
      .select('*').eq('date_session', today).maybeSingle();
    setSession(sess || null);
    if (sess) {
      const { data: pts } = await supabase.from('pointage_presence')
        .select('*, adherents(nom, prenom, identifiant_ajumy)')
        .eq('session_id', sess.session_id).order('heure_arrivee');
      setPointages(pts || []);
    }
    setLoading(false);
  }

  async function ouvrirSession() {
    setSaving(true);
    try {
      const qrCode  = `AJUMY-${today}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
      const pinCode = Math.floor(100000 + Math.random() * 900000).toString();
      let lat = null, lng = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      }
      const { error } = await supabase.from('session_dimanche').upsert({
        date_session: today, statut: 'ouverte',
        qr_code: qrCode, pin_code: pinCode,
        gps_lat: lat, gps_lng: lng, gps_rayon: 100,
        ouvert_par: monId, ouvert_a: new Date().toISOString(),
      }, { onConflict: 'date_session' });
      if (error) throw error;
      await logAction('creation', 'presence', `Session ouverte — ${today}`);
      Alert.alert('✅ Session ouverte', `QR Code : ${qrCode}\nPIN secours : ${pinCode}\n\nAffichez ces codes au siège.`);
      load();
    } catch(e) { Alert.alert('Erreur', e.message); }
    setSaving(false);
  }

  async function fermerSession() {
    Alert.alert('Fermer la session ?', 'Les absents seront marqués automatiquement.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Fermer', style: 'destructive', onPress: async () => {
        setSaving(true);
        await supabase.from('session_dimanche').update({
          statut: 'fermee', ferme_par: monId, ferme_a: new Date().toISOString(),
        }).eq('session_id', session.session_id);
        await logAction('modification', 'presence', `Session fermée — ${today}`);
        load(); setSaving(false);
      }},
    ]);
  }

  async function validerManuellement(adherentId, role) {
    const field     = role === 'censeur' ? 'censeur_id'      : 'secretaire_id';
    const timeField = role === 'censeur' ? 'censeur_valide_a': 'secretaire_valide_a';
    const { data: existing } = await supabase.from('validation_manuelle')
      .select('*').eq('session_id', session.session_id).eq('adherent_id', adherentId).maybeSingle();
    if (existing) {
      await supabase.from('validation_manuelle').update({
        [field]: monId, [timeField]: new Date().toISOString(),
      }).eq('validation_id', existing.validation_id);
      const updated = { ...existing, [field]: monId };
      if (updated.censeur_id && updated.secretaire_id) {
        await supabase.from('pointage_presence').upsert({
          session_id: session.session_id, adherent_id: adherentId,
          methode: 'manuelle', statut: 'present',
          valide_par1: updated.censeur_id, valide_par2: updated.secretaire_id,
          heure_arrivee: new Date().toISOString(),
        }, { onConflict: 'session_id,adherent_id' });
        await supabase.from('validation_manuelle').update({ statut: 'valide' }).eq('validation_id', existing.validation_id);
        Alert.alert('✅ Double signature complète', 'Présence enregistrée.');
      } else {
        Alert.alert('✅ 1ère signature', 'En attente de la 2ème signature.');
      }
    } else {
      await supabase.from('validation_manuelle').insert({
        session_id: session.session_id, adherent_id: adherentId,
        [field]: monId, [timeField]: new Date().toISOString(), statut: 'en_attente',
      });
      Alert.alert('✅ 1ère signature', 'En attente de la 2ème signature.');
    }
    setValidModal(false); load();
  }

  const peutGerer = ['CENSEUR','SECRETAIRE','PRESIDENT','VICE_PRESIDENT','SUPER_ADMIN'].includes(monRole);

  return (
    <View style={styles.container}>
      <Header title="📍 Session Dimanche" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#8B1A1A" style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>

          <View style={[styles.sessionCard, { borderColor: session?.statut === 'ouverte' ? '#1E7E34' : '#C00000' }]}>
            <Text style={styles.sessionStatut}>
              {session?.statut === 'ouverte' ? '🟢 Session OUVERTE' : '🔴 Session FERMÉE'}
            </Text>
            <Text style={styles.sessionDate}>
              {new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            {session?.statut === 'ouverte' && (
              <>
                <View style={styles.sessionInfoRow}>
                  <Text style={styles.sessionInfoLabel}>📷 QR Code</Text>
                  <Text style={styles.sessionInfoVal}>{session.qr_code}</Text>
                </View>
                <View style={styles.sessionInfoRow}>
                  <Text style={styles.sessionInfoLabel}>🔢 PIN secours</Text>
                  <Text style={[styles.sessionInfoVal, { fontSize: 22, fontWeight: 'bold', letterSpacing: 6 }]}>{session.pin_code}</Text>
                </View>
                <View style={styles.sessionInfoRow}>
                  <Text style={styles.sessionInfoLabel}>📍 GPS siège</Text>
                  <Text style={styles.sessionInfoVal}>
                    {session.gps_lat ? `${session.gps_lat.toFixed(4)}, ${session.gps_lng.toFixed(4)} (${session.gps_rayon}m)` : 'Non configuré'}
                  </Text>
                </View>
              </>
            )}
            {peutGerer && (
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: session?.statut === 'ouverte' ? '#C00000' : '#1E7E34', marginTop: 12 }]}
                onPress={session?.statut === 'ouverte' ? fermerSession : ouvrirSession} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.btnPrimaryText}>{session?.statut === 'ouverte' ? '🔴 Fermer la session' : '🟢 Ouvrir la session'}</Text>}
              </TouchableOpacity>
            )}
          </View>

          {session && (
            <>
              <Text style={[styles.paramSectionTitre, { marginTop: 8 }]}>👥 Présences ({pointages.length})</Text>
              {pointages.length === 0
                ? <Text style={styles.empty}>Aucun pointage enregistré</Text>
                : pointages.map(p => (
                  <View key={p.pointage_id} style={styles.pointageCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pointageNom}>{p.adherents?.nom} {p.adherents?.prenom}
                        <Text style={{ color: '#888', fontSize: 11 }}> · {p.adherents?.identifiant_ajumy}</Text>
                      </Text>
                      <Text style={styles.pointageInfos}>
                        {p.methode === 'qr_gps' ? '📷 QR+GPS' : p.methode === 'pin' ? '🔢 PIN' : '✍️ Manuel'}
                        {p.gps_distance ? ` · ${p.gps_distance}m` : ''}
                        {p.heure_arrivee ? ` · ${new Date(p.heure_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </Text>
                      <View style={[styles.statutBadge, { backgroundColor: p.statut === 'present' ? '#E8F5E9' : '#FFEBEE' }]}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: p.statut === 'present' ? '#1E7E34' : '#C00000' }}>
                          {p.statut === 'present' ? '✅ Présent' : '🚪 Sorti'}
                        </Text>
                      </View>
                    </View>
                    {p.selfie_url && (
                      <TouchableOpacity onPress={() => setSelfieModal(p.selfie_url)}>
                        <Image source={{ uri: p.selfie_url }} style={styles.selfieThumb} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              }
              {peutGerer && session.statut === 'ouverte' && (
                <TouchableOpacity style={[styles.btnSecondary, { marginTop: 8 }]} onPress={() => setValidModal(true)}>
                  <Text style={styles.btnSecondaryText}>✍️ Valider manuellement (sans téléphone)</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={!!selfieModal} transparent animationType="fade">
        <TouchableOpacity style={{ flex:1, backgroundColor:'rgba(0,0,0,0.85)', justifyContent:'center', alignItems:'center' }}
          onPress={() => setSelfieModal(null)}>
          {selfieModal && <Image source={{ uri: selfieModal }} style={{ width:'90%', height:'70%', borderRadius:16 }} resizeMode="contain" />}
          <Text style={{ color:'#fff', marginTop:16 }}>Appuyez pour fermer</Text>
        </TouchableOpacity>
      </Modal>

      <Modal visible={validModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitre}>✍️ Validation manuelle</Text>
            <Text style={styles.modalSub}>Adhérent sans téléphone — double signature requise</Text>
            <ValidationManuelleAdherents
              sessionId={session?.session_id}
              monRole={monRole} monId={monId}
              onValider={validerManuellement}
            />
            <TouchableOpacity style={[styles.btnClose, { marginTop: 12 }]} onPress={() => setValidModal(false)}>
              <Text style={styles.btnCloseText}>Fermer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function ValidationManuelleAdherents({ sessionId, monRole, onValider }) {
  const [adherents, setAdherents] = useState([]);
  const [loading, setLoading]     = useState(true);
  useEffect(() => {
    async function load() {
      const { data: tous } = await supabase.from('adherents')
        .select('adherent_id, nom, prenom, identifiant_ajumy').eq('statut', 'actif').order('nom');
      const { data: deja } = await supabase.from('pointage_presence')
        .select('adherent_id').eq('session_id', sessionId);
      const dejaIds = new Set((deja || []).map(d => d.adherent_id));
      setAdherents((tous || []).filter(a => !dejaIds.has(a.adherent_id)));
      setLoading(false);
    }
    load();
  }, [sessionId]);
  const role = (monRole || '').includes('CENSEUR') ? 'censeur' : 'secretaire';
  if (loading) return <ActivityIndicator color="#8B1A1A" style={{ margin: 20 }} />;
  if (adherents.length === 0) return <Text style={{ textAlign:'center', color:'#888', padding:20 }}>Tous les adhérents actifs sont déjà pointés ✅</Text>;
  return adherents.map(a => (
    <TouchableOpacity key={a.adherent_id} style={styles.pickItem} onPress={() => onValider(a.adherent_id, role)}>
      <Text style={{ fontWeight: 'bold', color: '#1F3864' }}>{a.nom} {a.prenom}</Text>
      <Text style={{ fontSize: 11, color: '#888' }}>{a.identifiant_ajumy} · Valider en tant que {role}</Text>
    </TouchableOpacity>
  ));
}


// ══════════════════════════════════════════════════════════════
//  HELPER — Enregistrer un log depuis n'importe quel screen
// ══════════════════════════════════════════════════════════════
export async function logAction(type, module, action, details = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let adherentNom = null;
    let adherentId  = null;
    if (user) {
      const { data: adh } = await supabase.from('adherents')
        .select('adherent_id, nom, prenom').eq('email', user.email).maybeSingle();
      if (adh) { adherentId = adh.adherent_id; adherentNom = `${adh.nom} ${adh.prenom}`; }
    }
    await supabase.from('audit_logs').insert({
      type, module, action, details,
      adherent_id: adherentId,
      adherent_nom: adherentNom,
    });
  } catch (e) { console.warn('logAction error:', e); }
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F0F4F8' },
  header:             { backgroundColor: '#1F3864', padding: 16, paddingTop: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:        { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:            { color: '#B0C4DE', fontSize: 14 },

  adminBanner:        { backgroundColor: '#1F3864', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  adminBannerIcon:    { fontSize: 28 },
  adminBannerText:    { color: '#B0C4DE', fontSize: 13, fontWeight: '600', flex: 1 },

  sectionCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2, borderLeftWidth: 5, gap: 12 },
  sectionIcon:        { fontSize: 26 },
  sectionTitre:       { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  sectionDesc:        { fontSize: 12, color: '#888', marginTop: 2 },

  searchInput:        { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#F8FBFF' },
  btnPrimary:         { backgroundColor: '#1F3864', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnPrimaryText:     { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  btnSecondary:       { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText:   { color: '#1F3864', fontSize: 14, fontWeight: '600' },

  userCard:           { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  userName:           { fontSize: 14, fontWeight: 'bold', color: '#1F3864' },
  userEmail:          { fontSize: 12, color: '#888', marginTop: 2 },
  roleTag:            { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  statutDot:          { width: 10, height: 10, borderRadius: 5 },

  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitre:         { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 4 },
  modalSub:           { fontSize: 13, color: '#888', marginBottom: 16 },
  modalLabel:         { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 8 },
  roleBtn:            { flex: 1, borderWidth: 2, borderRadius: 10, padding: 8, alignItems: 'center' },
  btnClose:           { backgroundColor: '#F0F4F8', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnCloseText:       { color: '#888', fontSize: 14, fontWeight: '600' },
  input:              { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fff', marginBottom: 4 },
  pickItem:           { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },

  paramSection:       { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  paramSectionTitre:  { fontSize: 14, fontWeight: 'bold', color: '#4A2000', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 8 },
  paramLabel:         { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  modifsBanner:       { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 12, borderLeftWidth: 4, borderLeftColor: '#C55A11', marginBottom: 8 },

  logCard:            { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, elevation: 1 },
  filtreChip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F0F4F8' },
  btnPage:            { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#D6E4F0' },
  btnPageText:        { color: '#1F3864', fontWeight: '600', fontSize: 13 },
  empty:              { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },

  // Session dimanche
  sessionCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 2, elevation: 3 },
  sessionStatut:      { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 4 },
  sessionDate:        { fontSize: 13, color: '#888', marginBottom: 14, textTransform: 'capitalize' },
  sessionInfoRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  sessionInfoLabel:   { fontSize: 12, color: '#888', fontWeight: '600', width: 100 },
  sessionInfoVal:     { flex: 1, fontSize: 12, color: '#1F3864', fontFamily: 'monospace' },
  pointageCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  pointageNom:        { fontSize: 14, fontWeight: 'bold', color: '#1F3864' },
  pointageInfos:      { fontSize: 11, color: '#888', marginTop: 2 },
  statutBadge:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  selfieThumb:        { width: 56, height: 56, borderRadius: 10, marginLeft: 10, backgroundColor: '#eee' },
});