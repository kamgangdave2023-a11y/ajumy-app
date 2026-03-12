import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView, Platform
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import AvatarAdherent from '../components/AvatarAdherent';
import { AjumyDatePicker, toSupabaseDate } from '../components/AjumyDateTimePicker';
import { caisseDettes } from '../lib/caisse';

// ── Constantes ────────────────────────────────────────────────
const ROLES_SAISIE = ['SUPER_ADMIN', 'PRESIDENT', 'CENSEUR'];

const MOTIFS = [
  { cle: 'absence',      label: 'Absence non justifiée',  icon: '🚫', montant_defaut: 2000 },
  { cle: 'absence_ag',   label: 'Absence AG',              icon: '🏛️', montant_defaut: 1000 },
  { cle: 'absence_nag',  label: 'Absence NAG',             icon: '📋', montant_defaut: 500  },
  { cle: 'retard',       label: 'Retard cotisation',       icon: '⏰', montant_defaut: 1000 },
  { cle: 'roulement',    label: 'Manquement roulement',    icon: '🔄', montant_defaut: 5000 },
  { cle: 'comportement', label: 'Comportement',            icon: '⚠️', montant_defaut: 3000 },
  { cle: 'autre',        label: 'Autre',                   icon: '📝', montant_defaut: 0    },
];

const FILTRES = ['Toutes', 'Impayées', 'Payées'];

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR') + ' FCFA'; }
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ══════════════════════════════════════════════════════════════
//  CARTE SANCTION
// ══════════════════════════════════════════════════════════════
function CarteSanction({ item, adherents, isAdmin, onPayer, onSupprimer }) {
  const [open, setOpen] = useState(false);
  const adh   = adherents.find(a => a.adherent_id === item.adherent_id);
  const motif = MOTIFS.find(m => m.cle === item.motif) || MOTIFS[4];
  const payee = item.statut === 'payee';

  return (
    <TouchableOpacity
      style={[s.carte, payee && s.cartePayee]}
      onPress={() => setOpen(o => !o)}
      activeOpacity={0.85}
    >
      {/* En-tête */}
      <View style={s.carteHeader}>
        <AvatarAdherent
          nom={adh?.nom} prenom={adh?.prenom}
          photoUrl={adh?.photo_url} statut={adh?.statut}
          size={42}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.carteNom}>
            {adh?.titre ? `${adh.titre} ` : ''}{adh?.nom || '—'} {adh?.prenom || ''}
          </Text>
          <Text style={s.carteMotif}>{motif.icon} {motif.label}</Text>
          <Text style={s.carteDate}>{fmtDate(item.date_sanction)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[s.carteMontant, payee && { color: '#1E7E34' }]}>
            {fmt(item.montant)}
          </Text>
          <View style={[s.badge, payee ? s.badgePayee : s.badgeImpayee]}>
            <Text style={[s.badgeTxt, { color: payee ? '#1E7E34' : '#C00000' }]}>
              {payee ? '✅ Payée' : '⏳ Impayée'}
            </Text>
          </View>
        </View>
      </View>

      {/* Détail déplié */}
      {open && (
        <View style={s.carteDetail}>
          <View style={s.separateur} />
          {item.description ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>📝 Note</Text>
              <Text style={s.infoVal}>{item.description}</Text>
            </View>
          ) : null}
          {payee && item.date_paiement ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>💳 Payée le</Text>
              <Text style={[s.infoVal, { color: '#1E7E34' }]}>{fmtDate(item.date_paiement)}</Text>
            </View>
          ) : null}
          {isAdmin && !payee && (
            <TouchableOpacity style={s.btnPayer} onPress={() => onPayer(item)}>
              <Text style={s.btnPayerTxt}>💳 Marquer comme payée → Caisse</Text>
            </TouchableOpacity>
          )}
          {isAdmin && (
            <TouchableOpacity style={s.btnSupprimer} onPress={() => onSupprimer(item)}>
              <Text style={s.btnSupprimerTxt}>🗑 Supprimer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════
//  MODAL AJOUT
// ══════════════════════════════════════════════════════════════
function ModalAjout({ visible, adherents, onClose, onSaved }) {
  const [adherentId, setAdherentId]   = useState('');
  const [motif, setMotif]             = useState('absence');
  const [montant, setMontant]         = useState('2000');
  const [description, setDescription] = useState('');
  const [date, setDate]               = useState(new Date());
  const [saving, setSaving]           = useState(false);
  const [erreur, setErreur]           = useState('');
  const [searchAdh, setSearchAdh]     = useState('');

  const adhFiltres = adherents.filter(a =>
    `${a.nom} ${a.prenom}`.toLowerCase().includes(searchAdh.toLowerCase())
  );
  const adhSelectionne = adherents.find(a => a.adherent_id === adherentId);

  function choisirMotif(m) {
    setMotif(m.cle);
    if (m.montant_defaut > 0) setMontant(String(m.montant_defaut));
  }

  async function enregistrer() {
    if (!adherentId) { setErreur('Choisissez un adhérent'); return; }
    if (!montant || isNaN(Number(montant))) { setErreur('Montant invalide'); return; }
    setSaving(true); setErreur('');
    const { error } = await supabase.from('sanctions').insert({
      adherent_id:   adherentId,
      motif,
      montant:       Number(montant),
      description:   description || null,
      date_sanction: toSupabaseDate(date),
      statut:        'impayee',
    });
    if (error) { setErreur(error.message); setSaving(false); return; }
    setSaving(false);
    setAdherentId(''); setMotif('absence'); setMontant('2000');
    setDescription(''); setSearchAdh('');
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitre}>⚠️ Nouvelle sanction</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: '#C55A11', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Adhérent */}
            <Text style={s.label}>Adhérent *</Text>
            {adhSelectionne ? (
              <TouchableOpacity style={s.adhChip} onPress={() => setAdherentId('')}>
                <AvatarAdherent nom={adhSelectionne.nom} prenom={adhSelectionne.prenom}
                  photoUrl={adhSelectionne.photo_url} statut={adhSelectionne.statut} size={32} />
                <Text style={s.adhChipNom}>
                  {adhSelectionne.titre ? `${adhSelectionne.titre} ` : ''}
                  {adhSelectionne.nom} {adhSelectionne.prenom}
                </Text>
                <Text style={{ color: '#C55A11', marginLeft: 8 }}>✕</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput style={s.input} value={searchAdh} onChangeText={setSearchAdh}
                  placeholder="Rechercher..." placeholderTextColor="#aaa" />
                <View style={s.listeAdh}>
                  {adhFiltres.slice(0, 6).map(a => (
                    <TouchableOpacity key={a.adherent_id} style={s.adhItem}
                      onPress={() => { setAdherentId(a.adherent_id); setSearchAdh(''); }}>
                      <AvatarAdherent nom={a.nom} prenom={a.prenom}
                        photoUrl={a.photo_url} statut={a.statut} size={32} />
                      <Text style={s.adhItemNom}>
                        {a.titre ? `${a.titre} ` : ''}{a.nom} {a.prenom}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Motif */}
            <Text style={s.label}>Motif *</Text>
            <View style={s.motifsGrid}>
              {MOTIFS.map(m => (
                <TouchableOpacity key={m.cle}
                  style={[s.motifBtn, motif === m.cle && s.motifBtnActif]}
                  onPress={() => choisirMotif(m)}>
                  <Text style={s.motifIcon}>{m.icon}</Text>
                  <Text style={[s.motifLabel, motif === m.cle && { color: '#fff' }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Montant */}
            <Text style={s.label}>Montant (FCFA) *</Text>
            <TextInput style={s.input} value={montant} onChangeText={setMontant}
              keyboardType="numeric" placeholder="Ex: 2000" placeholderTextColor="#aaa" />

            {/* Date */}
            <AjumyDatePicker
              label="Date"
              value={date}
              onChange={setDate}
              maximumDate={new Date()}
            />

            {/* Note */}
            <Text style={s.label}>Note (optionnel)</Text>
            <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              value={description} onChangeText={setDescription}
              multiline placeholder="Détails..." placeholderTextColor="#aaa" />

            {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}

            <TouchableOpacity style={[s.btnSave, saving && { opacity: 0.5 }]}
              onPress={enregistrer} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> :
                <Text style={s.btnSaveTxt}>✅ Enregistrer la sanction</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
//  MODAL CONFIRMATION
// ══════════════════════════════════════════════════════════════
function ModalConfirm({ visible, titre, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { paddingVertical: 28 }]}>
          <Text style={[s.modalTitre, { textAlign: 'center', marginBottom: 10 }]}>{titre}</Text>
          <Text style={{ color: '#555', textAlign: 'center', marginBottom: 24 }}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[s.btnConfirm, { backgroundColor: '#eee' }]} onPress={onCancel}>
              <Text style={{ color: '#555', fontWeight: 'bold' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnConfirm, { backgroundColor: confirmColor || '#C55A11' }]} onPress={onConfirm}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>{confirmLabel || 'Confirmer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
//  ÉCRAN PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function SanctionsScreen({ onBack }) {
  const { isBureau, canSanctions } = useRole();
  const [sanctions, setSanctions] = useState([]);
  const [adherents, setAdherents] = useState([]);
  const [moi, setMoi]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [filtre, setFiltre]       = useState('Toutes');
  const [search, setSearch]       = useState('');
  const [showAjout, setShowAjout] = useState(false);
  const [confirm, setConfirm]     = useState(null);

  const isAdmin = moi && ROLES_SAISIE.includes((moi.role || '').toUpperCase());

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      let adh = null;
      const { data: byEmail } = await supabase.from('adherents')
        .select('adherent_id, nom, prenom, role').eq('email', user.email).maybeSingle();
      adh = byEmail;
      if (!adh) {
        const { data: byUid } = await supabase.from('adherents')
          .select('adherent_id, nom, prenom, role').eq('user_id', user.id).maybeSingle();
        adh = byUid;
      }
      setMoi(adh);
    }
    const { data: adhs } = await supabase.from('adherents')
      .select('adherent_id, nom, prenom, titre, photo_url, statut')
      .in('statut', ['actif', 'en_observation']).order('nom');
    setAdherents(adhs || []);
    await charger();
    setLoading(false);
  }

  async function charger() {
    const { data } = await supabase.from('sanctions')
      .select('*').order('date_sanction', { ascending: false });
    setSanctions(data || []);
  }

  const sanctionsFiltrees = sanctions.filter(item => {
    const adh = adherents.find(a => a.adherent_id === item.adherent_id);
    const matchSearch = !search ||
      `${adh?.nom || ''} ${adh?.prenom || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchFiltre =
      filtre === 'Toutes'   ? true :
      filtre === 'Impayées' ? item.statut === 'impayee' :
                              item.statut === 'payee';
    return matchSearch && matchFiltre;
  });

  const nbImpayees    = sanctions.filter(s => s.statut === 'impayee').length;
  const totalImpayees = sanctions.filter(s => s.statut === 'impayee').reduce((sum, s) => sum + (s.montant || 0), 0);
  const nbPayees      = sanctions.filter(s => s.statut === 'payee').length;
  const totalPayees   = sanctions.filter(s => s.statut === 'payee').reduce((sum, s) => sum + (s.montant || 0), 0);

  async function marquerPayee(item) {
    setConfirm(null);
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('sanctions').update({
      statut:        'payee',
      date_paiement: today,
    }).eq('sanction_id', item.sanction_id);

    if (error) { Alert.alert('Erreur', error.message); return; }

    // Versement caisse via helper centralisé
    const { error: errCaisse } = await caisseDettes.sanction(
      item.montant,
      item.sanction_id,
      item.adherent_id
    );
    if (errCaisse) console.warn('[Caisse] sanction insert failed:', errCaisse.message);

    charger();
  }

  async function supprimer(item) {
    setConfirm(null);
    await supabase.from('sanctions').delete().eq('sanction_id', item.sanction_id);
    charger();
  }

  return (
    <View style={s.container}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.headerTitre}>⚠️ Sanctions</Text>
          <Text style={s.headerSub}>Gestion des sanctions membres</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={s.btnAjout} onPress={() => setShowAjout(true)}>
            <Text style={s.btnAjoutTxt}>+ Ajouter</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 60 }} />
      ) : (
        <>
          {/* ── Stats ── */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { borderTopColor: '#C00000' }]}>
              <Text style={s.statVal}>{nbImpayees}</Text>
              <Text style={s.statLabel}>Impayées</Text>
              <Text style={[s.statMontant, { color: '#C00000' }]}>{fmt(totalImpayees)}</Text>
            </View>
            <View style={[s.statCard, { borderTopColor: '#1E7E34' }]}>
              <Text style={s.statVal}>{nbPayees}</Text>
              <Text style={s.statLabel}>Payées</Text>
              <Text style={[s.statMontant, { color: '#1E7E34' }]}>{fmt(totalPayees)}</Text>
            </View>
            <View style={[s.statCard, { borderTopColor: '#C55A11' }]}>
              <Text style={s.statVal}>{sanctions.length}</Text>
              <Text style={s.statLabel}>Total</Text>
              <Text style={[s.statMontant, { color: '#C55A11' }]}>{fmt(totalImpayees + totalPayees)}</Text>
            </View>
          </View>

          {/* ── Recherche ── */}
          <TextInput style={s.search} value={search} onChangeText={setSearch}
            placeholder="🔍 Rechercher un membre..." placeholderTextColor="#aaa" />

          {/* ── Filtres ── */}
          <View style={s.filtresRow}>
            {FILTRES.map(f => (
              <TouchableOpacity key={f}
                style={[s.filtreBtn, filtre === f && s.filtreBtnActif]}
                onPress={() => setFiltre(f)}>
                <Text style={[s.filtreTxt, filtre === f && s.filtreTxtActif]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Liste ── */}
          <FlatList
            data={sanctionsFiltrees}
            keyExtractor={i => i.sanction_id}
            contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <CarteSanction
                item={item}
                adherents={adherents}
                isAdmin={isAdmin}
                onPayer={item => setConfirm({ type: 'payer', item })}
                onSupprimer={item => setConfirm({ type: 'supprimer', item })}
              />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Text style={{ fontSize: 40 }}>✅</Text>
                <Text style={{ color: '#888', marginTop: 12, fontSize: 15 }}>
                  {filtre === 'Toutes' ? 'Aucune sanction enregistrée' : `Aucune sanction ${filtre.toLowerCase()}`}
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* ── Modal ajout ── */}
      <ModalAjout
        visible={showAjout}
        adherents={adherents}
        onClose={() => setShowAjout(false)}
        onSaved={() => { setShowAjout(false); charger(); }}
      />

      {/* ── Confirm payer ── */}
      {confirm?.type === 'payer' && (
        <ModalConfirm
          visible
          titre="💳 Confirmer le paiement"
          message={`Marquer la sanction de ${fmt(confirm.item.montant)} comme payée ?\nLe montant sera versé à la caisse AJUMY.`}
          confirmLabel="Confirmer"
          confirmColor="#1E7E34"
          onConfirm={() => marquerPayee(confirm.item)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Confirm supprimer ── */}
      {confirm?.type === 'supprimer' && (
        <ModalConfirm
          visible
          titre="🗑 Supprimer la sanction"
          message="Cette action est irréversible. Confirmer ?"
          confirmLabel="Supprimer"
          confirmColor="#C00000"
          onConfirm={() => supprimer(confirm.item)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5F0EB' },

  header:          { backgroundColor: '#C55A11', paddingTop: Platform.OS === 'ios' ? 44 : 16, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:         { padding: 4 },
  backTxt:         { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerTitre:     { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub:       { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
  btnAjout:        { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  btnAjoutTxt:     { color: '#C55A11', fontWeight: 'bold', fontSize: 13 },

  statsRow:        { flexDirection: 'row', gap: 10, padding: 12 },
  statCard:        { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderTopWidth: 4, elevation: 2 },
  statVal:         { fontSize: 22, fontWeight: 'bold', color: '#1E2130' },
  statLabel:       { fontSize: 11, color: '#888', marginTop: 2 },
  statMontant:     { fontSize: 10, fontWeight: 'bold', marginTop: 4 },

  search:          { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1E2130', borderWidth: 1, borderColor: '#E8D8CC' },
  filtresRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  filtreBtn:       { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8D8CC' },
  filtreBtnActif:  { backgroundColor: '#C55A11', borderColor: '#C55A11' },
  filtreTxt:       { fontSize: 13, color: '#888' },
  filtreTxtActif:  { color: '#fff', fontWeight: 'bold' },

  carte:           { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, padding: 14, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#C00000' },
  cartePayee:      { borderLeftColor: '#1E7E34', opacity: 0.85 },
  carteHeader:     { flexDirection: 'row', alignItems: 'center' },
  carteNom:        { fontSize: 15, fontWeight: 'bold', color: '#1E2130' },
  carteMotif:      { fontSize: 12, color: '#888', marginTop: 2 },
  carteDate:       { fontSize: 11, color: '#aaa', marginTop: 2 },
  carteMontant:    { fontSize: 16, fontWeight: 'bold', color: '#C00000' },
  badge:           { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeImpayee:    { backgroundColor: '#FFEBEE' },
  badgePayee:      { backgroundColor: '#E8F5E9' },
  badgeTxt:        { fontSize: 11, fontWeight: 'bold' },

  carteDetail:     { marginTop: 10 },
  separateur:      { height: 1, backgroundColor: '#F0E8E0', marginBottom: 10 },
  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel:       { fontSize: 13, color: '#888' },
  infoVal:         { fontSize: 13, color: '#1E2130', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  btnPayer:        { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#1E7E34' },
  btnPayerTxt:     { color: '#1E7E34', fontWeight: 'bold', fontSize: 14 },
  btnSupprimer:    { borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 6, borderWidth: 1, borderColor: '#eee' },
  btnSupprimerTxt: { color: '#C00000', fontSize: 13 },

  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitre:      { fontSize: 17, fontWeight: 'bold', color: '#1E2130' },
  label:           { fontSize: 13, fontWeight: '600', color: '#888', marginTop: 14, marginBottom: 6 },
  input:           { backgroundColor: '#F5F5F0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1E2130', borderWidth: 1, borderColor: '#E8E8E0' },

  adhChip:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3EE', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#C55A11' },
  adhChipNom:      { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', color: '#1E2130' },
  listeAdh:        { marginTop: 6, backgroundColor: '#F9F9F9', borderRadius: 10, overflow: 'hidden' },
  adhItem:         { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  adhItemNom:      { marginLeft: 10, fontSize: 14, color: '#1E2130' },

  motifsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motifBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F5F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#E8E8E0' },
  motifBtnActif:   { backgroundColor: '#C55A11', borderColor: '#C55A11' },
  motifIcon:       { fontSize: 16 },
  motifLabel:      { fontSize: 12, color: '#555', fontWeight: '500' },

  erreur:          { color: '#C00000', fontSize: 13, marginTop: 8, textAlign: 'center' },
  btnSave:         { backgroundColor: '#C55A11', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  btnSaveTxt:      { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  btnConfirm:      { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
});