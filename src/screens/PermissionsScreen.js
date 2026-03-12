import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Switch, Animated, Platform
} from 'react-native';
import { supabase } from '../lib/supabase';
import { ROLES } from '../lib/useRole';

// ══════════════════════════════════════════════════════════════
//  MODULES AJUMY — définition des fonctionnalités par module
// ══════════════════════════════════════════════════════════════
const MODULES = [
  {
    section: 'Gestion des membres',
    items: [
      { key: 'adherents_view',   label: 'Voir les adhérents',       actions: ['voir', 'ajouter', 'modifier', 'supprimer'] },
      { key: 'presence',         label: 'Présences',                 actions: ['voir', 'ajouter', 'modifier'] },
      { key: 'sanctions',        label: 'Sanctions',                 actions: ['voir', 'ajouter', 'modifier', 'supprimer'] },
    ]
  },
  {
    section: 'Finance',
    items: [
      { key: 'caisse',           label: 'Caisse AJUMY',              actions: ['voir', 'ajouter', 'modifier'] },
      { key: 'banque',           label: 'Banque interne',            actions: ['voir', 'ajouter', 'modifier'] },
      { key: 'ventes',           label: 'Ventes banque',             actions: ['voir', 'ajouter', 'approuver'] },
      { key: 'dettes',           label: 'Dettes',                    actions: ['voir', 'ajouter', 'modifier', 'supprimer'] },
    ]
  },
  {
    section: 'Tontines & Roulements',
    items: [
      { key: 'grande_tontine',   label: 'Grande tontine',            actions: ['voir', 'ajouter', 'modifier'] },
      { key: 'roulement',        label: 'Roulements',                actions: ['voir', 'ajouter', 'approuver'] },
      { key: 'huile_savon',      label: 'Huile & Savon',             actions: ['voir', 'ajouter', 'approuver'] },
    ]
  },
  {
    section: 'Solidarité & Événements',
    items: [
      { key: 'solidarite',       label: 'Solidarité',                actions: ['voir', 'ajouter', 'approuver'] },
      { key: 'voir_bebe',        label: 'Voir bébé',                 actions: ['voir', 'ajouter', 'approuver'] },
      { key: 'evenements',       label: 'Événements AJUMY',          actions: ['voir', 'ajouter', 'modifier', 'supprimer'] },
    ]
  },
  {
    section: 'Communication',
    items: [
      { key: 'chat',             label: 'Chat & Messagerie',         actions: ['voir', 'ajouter', 'supprimer'] },
      { key: 'ressources',       label: 'Ressources',                actions: ['voir', 'ajouter', 'supprimer'] },
    ]
  },
  {
    section: 'Administration',
    items: [
      { key: 'rapports',         label: 'Rapports & Statistiques',   actions: ['voir'] },
      { key: 'admin',            label: 'Administration',            actions: ['voir', 'modifier'] },
    ]
  },
];

const ACTION_LABELS = { voir: 'Voir', ajouter: 'Ajouter', modifier: 'Modifier', supprimer: 'Supprimer', approuver: 'Approuver' };
const ACTION_COLORS = { voir: '#2E75B6', ajouter: '#1E7E34', modifier: '#C55A11', supprimer: '#C00000', approuver: '#7030A0' };

// Permissions par défaut par rôle
const DEFAULTS = {
  SUPER_ADMIN: () => {
    const p = {};
    MODULES.forEach(m => m.items.forEach(i => i.actions.forEach(a => { p[`${i.key}_${a}`] = true; })));
    return p;
  },
  PRESIDENT: () => {
    const p = {}; const full = ['adherents_view','presence','sanctions','caisse','ventes','grande_tontine','roulement','huile_savon','solidarite','voir_bebe','evenements','chat','ressources','rapports'];
    MODULES.forEach(m => m.items.forEach(i => {
      i.actions.forEach(a => { p[`${i.key}_${a}`] = full.includes(i.key); });
    })); return p;
  },
  VICE_PRESIDENT: () => {
    const p = {}; const view_only = ['caisse','admin'];
    MODULES.forEach(m => m.items.forEach(i => {
      i.actions.forEach(a => {
        p[`${i.key}_${a}`] = !view_only.includes(i.key) && a !== 'supprimer';
      });
    })); return p;
  },
  SECRETAIRE: () => {
    const p = {}; const allowed = ['adherents_view','presence','sanctions','evenements','chat','ressources'];
    MODULES.forEach(m => m.items.forEach(i => {
      i.actions.forEach(a => { p[`${i.key}_${a}`] = allowed.includes(i.key) && a !== 'supprimer'; });
    })); return p;
  },
  TRESORIER: () => {
    const p = {}; const allowed = ['caisse','banque','ventes','dettes','rapports'];
    MODULES.forEach(m => m.items.forEach(i => {
      i.actions.forEach(a => { p[`${i.key}_${a}`] = allowed.includes(i.key); });
    })); return p;
  },
  CENSEUR: () => {
    const p = {}; const allowed = ['adherents_view','sanctions','presence','rapports'];
    MODULES.forEach(m => m.items.forEach(i => {
      i.actions.forEach(a => { p[`${i.key}_${a}`] = allowed.includes(i.key) && a !== 'supprimer'; });
    })); return p;
  },
  COMMISSAIRE: () => {
    const p = {}; const view_only = ['caisse','banque','ventes','dettes','rapports','grande_tontine'];
    MODULES.forEach(m => m.items.forEach(i => {
      i.actions.forEach(a => { p[`${i.key}_${a}`] = view_only.includes(i.key) && a === 'voir'; });
    })); return p;
  },
  ADHERENT: () => {
    const p = {}; const view_only = ['chat','evenements','ressources','roulement','huile_savon','solidarite','voir_bebe','grande_tontine'];
    MODULES.forEach(m => m.items.forEach(i => {
      i.actions.forEach(a => { p[`${i.key}_${a}`] = view_only.includes(i.key) && a === 'voir'; });
    })); return p;
  },
};

// ══════════════════════════════════════════════════════════════
//  CASE À COCHER animée
// ══════════════════════════════════════════════════════════════
function CheckBox({ value, onToggle, color, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onToggle();
  }

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.7}
      style={{ width: 36, alignItems: 'center' }}>
      <Animated.View style={[
        cb.box,
        value && { backgroundColor: color, borderColor: color },
        disabled && { opacity: 0.3 }
      ]}>
        {value && <Text style={cb.check}>✓</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}
const cb = StyleSheet.create({
  box:   { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E0', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  check: { color: '#fff', fontSize: 13, fontWeight: 'bold', lineHeight: 16 },
});

// ══════════════════════════════════════════════════════════════
//  LIGNE DE MODULE
// ══════════════════════════════════════════════════════════════
function LigneModule({ item, perms, onChange, isSuperAdmin }) {
  const allChecked = item.actions.every(a => perms[`${item.key}_${a}`]);

  function toggleAll() {
    const newVal = !allChecked;
    const updates = {};
    item.actions.forEach(a => { updates[`${item.key}_${a}`] = newVal; });
    onChange(updates);
  }

  return (
    <View style={lg.row}>
      {/* Label + toggle all */}
      <TouchableOpacity style={lg.labelCell} onPress={toggleAll} activeOpacity={0.7}>
        <View style={[lg.dot, allChecked && { backgroundColor: '#1E7E34' }]} />
        <Text style={[lg.label, allChecked && { color: '#1E2130' }]}>{item.label}</Text>
      </TouchableOpacity>

      {/* Cases par action */}
      {['voir', 'ajouter', 'modifier', 'supprimer', 'approuver'].map(action => {
        const supported = item.actions.includes(action);
        const key = `${item.key}_${action}`;
        return (
          <View key={action} style={lg.cell}>
            {supported
              ? <CheckBox
                  value={perms[key] || false}
                  color={ACTION_COLORS[action]}
                  disabled={isSuperAdmin}
                  onToggle={() => onChange({ [key]: !perms[key] })}
                />
              : <View style={lg.dash}><Text style={lg.dashTxt}>—</Text></View>
            }
          </View>
        );
      })}
    </View>
  );
}
const lg = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EBE5' },
  labelCell: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E0', marginRight: 10 },
  label:     { fontSize: 13, color: '#777', flex: 1 },
  cell:      { width: 52, alignItems: 'center' },
  dash:      { width: 36, alignItems: 'center' },
  dashTxt:   { color: '#DDD', fontSize: 12 },
});

// ══════════════════════════════════════════════════════════════
//  ONGLET RÔLE
// ══════════════════════════════════════════════════════════════
function OngletRole({ roleKey, isActive, onPress }) {
  const info = ROLES[roleKey] || {};
  return (
    <TouchableOpacity style={[ot.tab, isActive && ot.tabActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={ot.icon}>{info.icon}</Text>
      <Text style={[ot.label, isActive && { color: '#fff', fontWeight: 'bold' }]} numberOfLines={1}>
        {info.label || roleKey}
      </Text>
      {isActive && <View style={[ot.bar, { backgroundColor: info.color || '#C55A11' }]} />}
    </TouchableOpacity>
  );
}
const ot = StyleSheet.create({
  tab:       { paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', position: 'relative', minWidth: 90 },
  tabActive: { backgroundColor: '#1F3864' },
  icon:      { fontSize: 18, marginBottom: 3 },
  label:     { fontSize: 10, color: '#AAB4C5', textAlign: 'center' },
  bar:       { position: 'absolute', bottom: 0, left: 8, right: 8, height: 3, borderRadius: 2 },
});

// ══════════════════════════════════════════════════════════════
//  SCREEN PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function PermissionsScreen({ onBack }) {
  const [roleActif, setRoleActif]   = useState('PRESIDENT');
  const [perms, setPerms]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [dirty, setDirty]           = useState(false);
  const [saved, setSaved]           = useState(false);
  const rolesList = Object.keys(ROLES);

  useEffect(() => { charger(roleActif); }, [roleActif]);

  async function charger(role) {
    setLoading(true); setDirty(false);
    // Chercher en base
    const { data } = await supabase
      .from('role_permissions')
      .select('permissions')
      .eq('role', role)
      .maybeSingle();

    if (data?.permissions) {
      setPerms(data.permissions);
    } else {
      // Appliquer les valeurs par défaut
      const defFn = DEFAULTS[role] || DEFAULTS.ADHERENT;
      setPerms(defFn());
    }
    setLoading(false);
  }

  function handleChange(updates) {
    setPerms(prev => ({ ...prev, ...updates }));
    setDirty(true);
    setSaved(false);
  }

  async function sauvegarder() {
    setSaving(true);
    const { error } = await supabase
      .from('role_permissions')
      .upsert({ role: roleActif, permissions: perms, updated_at: new Date().toISOString() },
               { onConflict: 'role' });
    setSaving(false);
    if (!error) { setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  function reinitialiser() {
    const defFn = DEFAULTS[roleActif] || DEFAULTS.ADHERENT;
    setPerms(defFn());
    setDirty(true); setSaved(false);
  }

  // Compter les permissions actives
  const total  = Object.keys(perms).length;
  const active = Object.values(perms).filter(Boolean).length;
  const isSA   = roleActif === 'SUPER_ADMIN';
  const info   = ROLES[roleActif] || {};

  return (
    <View style={s.container}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitre}>🛡️ Permissions</Text>
          <Text style={s.headerSub}>Gestion des droits par rôle</Text>
        </View>
        {dirty && (
          <TouchableOpacity style={[s.btnSave, saving && { opacity: 0.5 }]}
            onPress={sauvegarder} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnSaveTxt}>💾 Sauvegarder</Text>}
          </TouchableOpacity>
        )}
        {saved && !dirty && (
          <View style={s.savedBadge}><Text style={s.savedTxt}>✅ Sauvegardé</Text></View>
        )}
      </View>

      {/* ── Onglets rôles (scroll horizontal) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsBar}>
        {rolesList.map(r => (
          <OngletRole key={r} roleKey={r} isActive={r === roleActif}
            onPress={() => setRoleActif(r)} />
        ))}
      </ScrollView>

      {/* ── Bandeau rôle actif ── */}
      <View style={[s.roleBanner, { borderLeftColor: info.color || '#C55A11' }]}>
        <Text style={s.roleBannerIcon}>{info.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.roleBannerLabel}>{info.label || roleActif}</Text>
          {isSA
            ? <Text style={s.roleBannerSub}>Super Admin — toutes les permissions sont fixes</Text>
            : <Text style={s.roleBannerSub}>{active} permission(s) active(s) sur {total}</Text>
          }
        </View>
        {/* Barre de progression */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${total > 0 ? (active/total)*100 : 0}%`, backgroundColor: info.color || '#C55A11' }]} />
        </View>
        {!isSA && (
          <TouchableOpacity style={s.btnReset} onPress={reinitialiser}>
            <Text style={s.btnResetTxt}>↺ Défaut</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>

          {/* ── En-tête colonnes ── */}
          <View style={s.colHeader}>
            <View style={{ flex: 1 }}><Text style={s.colLabel}>Module</Text></View>
            {['voir','ajouter','modifier','supprimer','approuver'].map(a => (
              <View key={a} style={{ width: 52, alignItems: 'center' }}>
                <Text style={[s.colLabel, { color: ACTION_COLORS[a], fontSize: 9 }]}>
                  {ACTION_LABELS[a].toUpperCase()}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Sections ── */}
          {MODULES.map(section => (
            <View key={section.section} style={s.section}>
              <Text style={s.sectionTitre}>{section.section}</Text>
              {section.items.map(item => (
                <LigneModule
                  key={item.key}
                  item={item}
                  perms={perms}
                  onChange={handleChange}
                  isSuperAdmin={isSA}
                />
              ))}
            </View>
          ))}

          {/* ── Bouton bas de page ── */}
          {dirty && !isSA && (
            <TouchableOpacity style={[s.btnSaveBottom, saving && { opacity: 0.5 }]}
              onPress={sauvegarder} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnSaveBottomTxt}>💾 Sauvegarder les permissions de {info.label}</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F5F0EB' },

  header:           { backgroundColor: '#1F3864', paddingTop: Platform.OS === 'ios' ? 44 : 16, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:          { padding: 4 },
  backTxt:          { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerTitre:      { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub:        { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  btnSave:          { backgroundColor: '#C55A11', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  btnSaveTxt:       { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  savedBadge:       { backgroundColor: '#1E7E34', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  savedTxt:         { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  tabsBar:          { backgroundColor: '#162A50', flexGrow: 0 },

  roleBanner:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, marginBottom: 4, borderRadius: 14, padding: 14, borderLeftWidth: 5, elevation: 2, gap: 10 },
  roleBannerIcon:   { fontSize: 24 },
  roleBannerLabel:  { fontSize: 15, fontWeight: 'bold', color: '#1E2130' },
  roleBannerSub:    { fontSize: 11, color: '#888', marginTop: 2 },
  progressTrack:    { width: 60, height: 6, backgroundColor: '#EEE', borderRadius: 3, overflow: 'hidden' },
  progressFill:     { height: 6, borderRadius: 3 },
  btnReset:         { backgroundColor: '#F0EBE5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  btnResetTxt:      { fontSize: 11, color: '#888', fontWeight: '600' },

  colHeader:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EDE8E2', borderRadius: 10, marginBottom: 8 },
  colLabel:         { fontSize: 10, color: '#AAA', fontWeight: 'bold', textTransform: 'uppercase' },

  section:          { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', elevation: 1 },
  sectionTitre:     { fontSize: 11, fontWeight: 'bold', color: '#fff', backgroundColor: '#1F3864', paddingHorizontal: 14, paddingVertical: 8, textTransform: 'uppercase', letterSpacing: 1 },

  btnSaveBottom:    { backgroundColor: '#C55A11', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16 },
  btnSaveBottomTxt: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});