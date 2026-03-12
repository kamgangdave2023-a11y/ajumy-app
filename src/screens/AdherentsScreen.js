import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, ScrollView, Image,
  LayoutAnimation, Platform, UIManager, Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AjumyDatePicker, toSupabaseDate } from '../components/AjumyDateTimePicker';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import AvatarAdherent from '../components/AvatarAdherent';
import { caisseIntegration } from '../lib/caisse';

// ── Constantes ───────────────────────────────────────────────
const TITRES = ['M.', 'Mme'];

const GROUPES = [
  { cle: 'bureau',    label: 'Membres du Bureau',  icon: '👔', color: '#1F3864' },
  { cle: 'fondateur', label: 'Membres Fondateurs', icon: '🏅', color: '#C55A11' },
  { cle: 'doyen',     label: 'Doyens',             icon: '👴', color: '#7030A0' },
  { cle: 'diaspora',  label: 'Diaspora',           icon: '🌍', color: '#1F7A4D' },
  { cle: 'simple',    label: 'Adhérents Simples',  icon: '👤', color: '#2E75B6' },
];
const GROUPE_MAP = Object.fromEntries(GROUPES.map(g => [g.cle, g]));

const ROLES = [
  { cle: 'ADHERENT',       label: 'Membre simple',           icon: '👤', color: '#888'    },
  { cle: 'PRESIDENT',      label: 'Président',               icon: '👑', color: '#C55A11' },
  { cle: 'VICE_PRESIDENT', label: 'Vice-Président',          icon: '🎖', color: '#7030A0' },
  { cle: 'SECRETAIRE',     label: 'Secrétaire',              icon: '📋', color: '#2E75B6' },
  { cle: 'TRESORIER',      label: 'Trésorier',               icon: '💰', color: '#1E7E34' },
  { cle: 'CENSEUR',        label: 'Censeur',                 icon: '🔍', color: '#AD1457' },
  { cle: 'COMMISSAIRE',    label: 'Commissaire aux comptes', icon: '⚖️', color: '#4A2000' },
  { cle: 'SUPER_ADMIN',    label: 'Super Admin',             icon: '⚙️', color: '#1F3864' },
];

const STATUTS = [
  { cle: 'actif',          label: 'Actif',       color: '#1E7E34' },
  { cle: 'en_observation', label: 'Observation', color: '#C55A11' },
  { cle: 'suspendu',       label: 'Suspendu',    color: '#C00000' },
];

const FONDS_INTEGRATION = [
  { cle: 'fond_caisse',   label: 'Fond de caisse',        montant: 20000, icon: '🏦', obligatoire: true  },
  { cle: 'fonds_maladie', label: 'Fonds maladie/malheur', montant: 25000, icon: '🏥', obligatoire: true  },
  { cle: 'chaise',        label: 'Chaise',                montant: 5000,  icon: '🪑', obligatoire: true  },
  { cle: 'couverts',      label: 'Couverts',              montant: 10000, icon: '🍽️', obligatoire: true  },
  { cle: 'projet',        label: 'Projet (optionnel)',     montant: 40000, icon: '📋', obligatoire: false },
];

const PAGE_SIZE = 10;

function getStatutColor(s) {
  return STATUTS.find(x => x.cle === s)?.color || '#888';
}
function getStatutLabel(s) {
  return STATUTS.find(x => x.cle === s)?.label || s;
}
function getRoleInfo(role) {
  return ROLES.find(x => x.cle === (role || 'ADHERENT').toUpperCase()) || ROLES[0];
}
function formatFCFA(n) {
  return (n || 0).toLocaleString('fr-FR') + ' FCFA';
}

// ── Helpers date locale (évite décalage UTC+1 Yaoundé) ──────
function getDateLocale(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getDateLocaleOffset(jours) {
  const d = new Date(Date.now() + jours * 24 * 60 * 60 * 1000);
  return getDateLocale(d);
}


export default function AdherentsScreen({ onBack }) {
  const { canEdit, isBureau, isAdmin } = useRole();
  const peutModifier = isBureau || isAdmin;

  const [adherents, setAdherents]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [selectedAdh, setSelectedAdh] = useState(null);
  const [filtreGroupe, setFiltreGroupe]   = useState('tous');
  const [filtreStatut, setFiltreStatut]   = useState('tous');
  const [filtreFonds, setFiltreFonds]     = useState('tous');  // 'tous' | 'complet' | 'incomplet'
  const [showFiltresModal, setShowFiltresModal] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { loadAdherents(); }, []);

  async function loadAdherents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('adherents').select('*').order('groupe').order('nom');
    if (error) Alert.alert('Erreur', error.message);
    else setAdherents(data || []);
    setLoading(false);
  }

  async function supprimerAdherent(adherent) {
    Alert.alert(
      '🗑️ Supprimer l\'adhérent',
      `Supprimer définitivement ${adherent.nom} ${adherent.prenom} ?\nCette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('adherents')
            .delete().eq('adherent_id', adherent.adherent_id);
          if (error) Alert.alert('Erreur', error.message);
          else loadAdherents();
        }},
      ]
    );
  }

  // ── Filtrage ──
  const filtered = adherents.filter(a => {
    const matchSearch = `${a.titre || ''} ${a.nom} ${a.prenom} ${a.cni_numero || ''}`.toLowerCase()
      .includes(search.toLowerCase());
    const matchGroupe = filtreGroupe === 'tous' || a.groupe === filtreGroupe;
    const matchStatut = filtreStatut === 'tous' || a.statut === filtreStatut;
    const fondsOk = FONDS_INTEGRATION.filter(f => f.obligatoire).every(f => a[`${f.cle}_solde`]);
    const matchFonds = filtreFonds === 'tous'
      || (filtreFonds === 'complet' && fondsOk)
      || (filtreFonds === 'incomplet' && !fondsOk);
    return matchSearch && matchGroupe && matchStatut && matchFonds;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats
  const nbActifs      = adherents.filter(a => a.statut === 'actif').length;
  const nbObservation = adherents.filter(a => a.statut === 'en_observation').length;
  const nbSuspendus   = adherents.filter(a => a.statut === 'suspendu').length;

  const hasFiltresActifs = filtreGroupe !== 'tous' || filtreStatut !== 'tous' || filtreFonds !== 'tous';

  if (showForm) return (
    <FormulaireAdherent
      onBack={() => setShowForm(false)}
      onSaved={() => { setShowForm(false); loadAdherents(); }}
    />
  );

  if (selectedAdh) return (
    <DetailAdherent
      adherent={selectedAdh}
      peutModifier={peutModifier}
      onBack={() => setSelectedAdh(null)}
      onUpdated={() => { setSelectedAdh(null); loadAdherents(); }}
    />
  );

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>👥 Adhérents</Text>
        <View style={{ flex: 1 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Nom, prénom, CNI..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={t => { setSearch(t); setPage(0); }}
        />
        <TouchableOpacity
          style={[styles.filtreBtn, hasFiltresActifs && styles.filtreBtnActive]}
          onPress={() => setShowFiltresModal(true)}>
          <Text style={styles.filtreBtnTxt}>{hasFiltresActifs ? '⚡ Filtres' : '⚙️ Filtres'}</Text>
        </TouchableOpacity>
        {peutModifier && (
          <TouchableOpacity style={styles.btnAjouter} onPress={() => setShowForm(true)}>
            <Text style={styles.btnAjouterTxt}>+ Ajouter</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Onglets groupes ── */}
      <View style={styles.tabsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[{ cle: 'tous', label: 'Tous', icon: '👥', color: '#1F3864' }, ...GROUPES].map(g => {
            const count = g.cle === 'tous'
              ? adherents.length
              : adherents.filter(a => a.groupe === g.cle).length;
            if (g.cle !== 'tous' && count === 0) return null;
            const active = filtreGroupe === g.cle;
            return (
              <TouchableOpacity key={g.cle}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => { setFiltreGroupe(g.cle); setPage(0); }}>
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>
                  {g.icon} {g.label} ({count})
                </Text>
                {active && <View style={[styles.tabLine, { backgroundColor: g.color }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Stats bar ── */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statChip} onPress={() => { setFiltreStatut(filtreStatut === 'actif' ? 'tous' : 'actif'); setPage(0); }}>
          <View style={[styles.statDot, { backgroundColor: '#1E7E34' }]} />
          <Text style={styles.statLabel}><Text style={[styles.statNum, { color: '#1E7E34' }]}>{nbActifs}</Text> Actifs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statChip} onPress={() => { setFiltreStatut(filtreStatut === 'en_observation' ? 'tous' : 'en_observation'); setPage(0); }}>
          <View style={[styles.statDot, { backgroundColor: '#C55A11' }]} />
          <Text style={styles.statLabel}><Text style={[styles.statNum, { color: '#C55A11' }]}>{nbObservation}</Text> Observation</Text>
        </TouchableOpacity>
        {nbSuspendus > 0 && (
          <TouchableOpacity style={styles.statChip} onPress={() => { setFiltreStatut(filtreStatut === 'suspendu' ? 'tous' : 'suspendu'); setPage(0); }}>
            <View style={[styles.statDot, { backgroundColor: '#C00000' }]} />
            <Text style={styles.statLabel}><Text style={[styles.statNum, { color: '#C00000' }]}>{nbSuspendus}</Text> Suspendus</Text>
          </TouchableOpacity>
        )}
        <View style={styles.statChip}>
          <View style={[styles.statDot, { backgroundColor: '#888' }]} />
          <Text style={styles.statLabel}><Text style={[styles.statNum, { color: '#555' }]}>{adherents.length}</Text> Total</Text>
        </View>
        <Text style={styles.showingTxt}>
          {filtered.length > 0
            ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} / ${filtered.length}`
            : '0 résultat'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1F3864" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* ── En-tête tableau ── */}
          <View style={styles.tableHead}>
            <Text style={[styles.thCell, { width: 36 }]}>N°</Text>
            <Text style={[styles.thCell, { width: 52 }]}>Photo</Text>
            <Text style={[styles.thCell, { flex: 1.4 }]}>Nom complet</Text>
            <Text style={[styles.thCell, { flex: 1.2 }]}>CNI</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>Désignation</Text>
            <Text style={[styles.thCell, { flex: 0.9 }]}>Groupe</Text>
            <Text style={[styles.thCell, { width: 75 }]}>Statut</Text>
            <Text style={[styles.thCell, { width: 64 }]}>Actions</Text>
          </View>

          {/* ── Lignes ── */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {paginated.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Text style={{ fontSize: 40 }}>🔍</Text>
                <Text style={{ color: '#888', marginTop: 12, fontSize: 15 }}>Aucun adhérent trouvé</Text>
                {hasFiltresActifs && (
                  <TouchableOpacity
                    style={{ marginTop: 12, backgroundColor: '#1F3864', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
                    onPress={() => { setFiltreGroupe('tous'); setFiltreStatut('tous'); setFiltreFonds('tous'); setSearch(''); }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Effacer les filtres</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : paginated.map((item, idx) => {
              const roleInfo = getRoleInfo(item.role);
              const groupeInfo = GROUPE_MAP[item.groupe];
              const isEven = idx % 2 === 0;
              const fondsComplet = FONDS_INTEGRATION.filter(f => f.obligatoire).every(f => item[`${f.cle}_solde`]);

              return (
                <TouchableOpacity
                  key={item.adherent_id}
                  style={[styles.tableRow, isEven && styles.tableRowEven]}
                  onPress={() => setSelectedAdh(item)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.tdCell, { width: 36, color: '#aaa', fontSize: 12 }]}>
                    {page * PAGE_SIZE + idx + 1}
                  </Text>

                  <View style={{ width: 52, alignItems: 'center' }}>
                    <AvatarAdherent
                      nom={item.nom} prenom={item.prenom}
                      photoUrl={item.photo_url} statut={item.statut}
                      size={36}
                    />
                  </View>

                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.tdName} numberOfLines={1}>
                      {item.titre ? `${item.titre} ` : ''}{item.nom} {item.prenom}
                    </Text>
                    {item.telephone && (
                      <Text style={styles.tdSub} numberOfLines={1}>📞 {item.telephone}</Text>
                    )}
                  </View>

                  <Text style={[styles.tdCell, { flex: 1.2 }]} numberOfLines={1}>
                    {item.cni_numero || '—'}
                  </Text>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tdCell, { color: roleInfo.color, fontWeight: '600', fontSize: 11 }]} numberOfLines={1}>
                      {roleInfo.icon} {roleInfo.label}
                    </Text>
                  </View>

                  {groupeInfo ? (
                    <View style={[styles.groupeChip, { flex: 0.9, backgroundColor: groupeInfo.color + '22', borderColor: groupeInfo.color }]}>
                      <Text style={[styles.groupeChipTxt, { color: groupeInfo.color }]} numberOfLines={1}>
                        {groupeInfo.icon} {groupeInfo.label}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.tdCell, { flex: 0.9 }]}>—</Text>
                  )}

                  <View style={{ width: 75, alignItems: 'center' }}>
                    <View style={[styles.statutBadge, { backgroundColor: getStatutColor(item.statut) }]}>
                      <Text style={styles.statutBadgeTxt}>{getStatutLabel(item.statut)}</Text>
                    </View>
                    {!fondsComplet && (
                      <Text style={{ fontSize: 9, color: '#C55A11', marginTop: 2 }}>⚠️ Fonds incomplets</Text>
                    )}
                  </View>

                  <View style={[styles.actionCell, { width: 64 }]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setSelectedAdh(item)}>
                      <Text style={{ fontSize: 14 }}>👁️</Text>
                    </TouchableOpacity>
                    {peutModifier && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
                        onPress={() => supprimerAdherent(item)}>
                        <Text style={{ fontSize: 14 }}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                onPress={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}>
                <Text style={styles.pageBtnTxt}>‹</Text>
              </TouchableOpacity>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum = i;
                if (totalPages > 7) {
                  if (page < 4) pageNum = i;
                  else if (page > totalPages - 4) pageNum = totalPages - 7 + i;
                  else pageNum = page - 3 + i;
                }
                return (
                  <TouchableOpacity key={pageNum}
                    style={[styles.pageBtn, pageNum === page && styles.pageBtnActive]}
                    onPress={() => setPage(pageNum)}>
                    <Text style={[styles.pageBtnTxt, pageNum === page && { color: '#fff' }]}>{pageNum + 1}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.pageBtn, page === totalPages - 1 && styles.pageBtnDisabled]}
                onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}>
                <Text style={styles.pageBtnTxt}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ── Modal Filtres avancés ── */}
      <Modal visible={showFiltresModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>⚙️ Filtres avancés</Text>

            <Text style={styles.modalSectionLabel}>Statut</Text>
            <View style={styles.filtreChipsRow}>
              {[{ cle: 'tous', label: 'Tous' }, ...STATUTS].map(s => (
                <TouchableOpacity key={s.cle}
                  style={[styles.filtreChip, filtreStatut === s.cle && { backgroundColor: s.color || '#1F3864', borderColor: s.color || '#1F3864' }]}
                  onPress={() => setFiltreStatut(s.cle)}>
                  <Text style={[styles.filtreChipTxt, filtreStatut === s.cle && { color: '#fff' }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSectionLabel}>Fonds d'intégration</Text>
            <View style={styles.filtreChipsRow}>
              {[
                { cle: 'tous',      label: 'Tous',             color: '#1F3864' },
                { cle: 'complet',   label: '✅ Fonds complets', color: '#1E7E34' },
                { cle: 'incomplet', label: '⏳ Incomplets',     color: '#C55A11' },
              ].map(f => (
                <TouchableOpacity key={f.cle}
                  style={[styles.filtreChip, filtreFonds === f.cle && { backgroundColor: f.color, borderColor: f.color }]}
                  onPress={() => setFiltreFonds(f.cle)}>
                  <Text style={[styles.filtreChipTxt, filtreFonds === f.cle && { color: '#fff' }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity style={[styles.modalClose, { flex: 1, backgroundColor: '#EEF0F5' }]}
                onPress={() => { setFiltreGroupe('tous'); setFiltreStatut('tous'); setFiltreFonds('tous'); }}>
                <Text style={[styles.modalCloseText, { color: '#555' }]}>Effacer tout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalClose, { flex: 1, backgroundColor: '#1F3864' }]}
                onPress={() => { setPage(0); setShowFiltresModal(false); }}>
                <Text style={[styles.modalCloseText, { color: '#fff' }]}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  FORMULAIRE AJOUT
// ══════════════════════════════════════════════════════════════
function FormulaireAdherent({ onBack, onSaved }) {
  const [form, setForm] = useState({
    titre: 'M.', nom: '', prenom: '', cni_numero: '',
    telephone: '', email: '', quartier: '',
    ville: '', pays: 'Cameroun',
    groupe: 'simple', role: 'ADHERENT',
    photo_url: null,
  });
  const [dateNaissance, setDateNaissance] = useState(null); // objet Date
  const [saving, setSaving]                       = useState(false);
  const [showPickerGroupe, setShowPickerGroupe]   = useState(false);
  const [showPickerRole, setShowPickerRole]       = useState(false);
  const [uploadingPhoto, setUploadingPhoto]       = useState(false);

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }

  async function choisirPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setUploadingPhoto(true);
      const uri = result.assets[0].uri;
      const fileName = `adherent_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error } = await supabase.storage
        .from('photos-adherents').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
      if (error) { Alert.alert('Erreur upload', error.message); setUploadingPhoto(false); return; }
      const { data: urlData } = supabase.storage.from('photos-adherents').getPublicUrl(fileName);
      set('photo_url', urlData.publicUrl);
      setUploadingPhoto(false);
    }
  }

  async function enregistrer() {
    if (!form.nom.trim() || !form.prenom.trim() || !form.cni_numero.trim()) {
      Alert.alert('Champs obligatoires', 'Nom, prénom et N° CNI sont requis');
      return;
    }
    setSaving(true);

    let dateFormatee = toSupabaseDate(dateNaissance); // null si non renseigné

    const { error } = await supabase.from('adherents').insert([{
      titre:                  form.titre,
      nom:                    form.nom.toUpperCase().trim(),
      prenom:                 form.prenom.trim(),
      cni_numero:             form.cni_numero.trim(),
      telephone:              form.telephone || null,
      email:                  form.email || null,
      quartier:               form.quartier || null,
      ville:                  form.ville || null,
      pays:                   form.pays || 'Cameroun',
      photo_url:              form.photo_url || null,
      groupe:                 form.groupe,
      role:                   form.role,
      date_naissance:         dateFormatee,
      date_inscription:       getDateLocale(),
      date_debut_observation: getDateLocale(),
      date_fin_observation:   getDateLocaleOffset(180),
      statut:                 'en_observation',
    }]);

    if (error) { setSaving(false); Alert.alert('Erreur', error.message); return; }

    // Récupérer l'adhérent créé pour avoir son ID
    const { data: newAdh } = await supabase
      .from('adherents')
      .select('adherent_id, date_inscription')
      .eq('cni_numero', form.cni_numero.trim())
      .maybeSingle();

    if (newAdh) {
      // Créer automatiquement la fiche fonds_adhesion
      await supabase.from('fonds_adhesion').insert([{
        adherent_id:         newAdh.adherent_id,
        date_adhesion:       newAdh.date_inscription,
        fond_caisse_du:      20000, fond_caisse_paye:   0, fond_caisse_statut:   'en_cours',
        fond_malheur_du:     25000, fond_malheur_paye:  0, fond_malheur_statut:  'en_cours',
        chaise_du:           5000,  chaise_paye:        0, chaise_statut:        'en_cours',
        couvert_du:          10000, couvert_paye:       0, couvert_statut:       'en_cours',
        projet_souscrit:     false, projet_du:          0, projet_paye:          0,
        fonds_soldes:        false,
        date_limite:         getDateLocaleOffset(180),
      }]);
    }

    setSaving(false);
    Alert.alert('✅ Adhérent ajouté !', `${form.prenom} ${form.nom} a bien été enregistré(e).`);
    onSaved();
  }

  const groupeSelectionne = GROUPE_MAP[form.groupe];
  const roleSelectionne   = ROLES.find(r => r.cle === form.role) || ROLES[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>➕ Nouvel adhérent</Text>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* Photo en haut du formulaire */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={choisirPhoto} style={fS.photoCercle}>
            {uploadingPhoto ? (
              <ActivityIndicator color="#fff" />
            ) : form.photo_url ? (
              <Image source={{ uri: form.photo_url }} style={fS.photoImg} />
            ) : (
              <View style={fS.photoPlaceholder}>
                <Text style={{ fontSize: 38 }}>📸</Text>
                <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>Photo de profil</Text>
              </View>
            )}
            <View style={fS.photoEditOverlay}><Text style={{ color: '#fff' }}>✏️</Text></View>
          </TouchableOpacity>
        </View>

        {/* Titre */}
        <Text style={fS.sectionLabel}>INFORMATIONS PERSONNELLES</Text>
        <Text style={fS.label}>Titre *</Text>
        <View style={fS.titreRow}>
          {TITRES.map(t => (
            <TouchableOpacity key={t}
              style={[fS.titreBtn, form.titre === t && fS.titreBtnActive]}
              onPress={() => set('titre', t)}>
              <Text style={[fS.titreBtnText, form.titre === t && { color: '#fff', fontWeight: 'bold' }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={fS.row}>
          <View style={{ flex: 1 }}>
            <Text style={fS.label}>Nom *</Text>
            <TextInput style={fS.input} value={form.nom}
              onChangeText={v => set('nom', v.toUpperCase())} placeholder="NOM" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={fS.label}>Prénom *</Text>
            <TextInput style={fS.input} value={form.prenom}
              onChangeText={v => set('prenom', v)} placeholder="Prénom" />
          </View>
        </View>

        <Text style={fS.label}>N° CNI *</Text>
        <TextInput style={fS.input} value={form.cni_numero}
          onChangeText={v => set('cni_numero', v)} placeholder="Ex: 123456789" />

        <AjumyDatePicker
          label="Date de naissance"
          value={dateNaissance}
          onChange={setDateNaissance}
          maximumDate={new Date()}
          minimumDate={new Date(1930, 0, 1)}
          placeholder="Sélectionner la date de naissance"
        />

        <Text style={fS.sectionLabel}>COORDONNÉES</Text>

        <Text style={fS.label}>Téléphone</Text>
        <TextInput style={fS.input} value={form.telephone}
          onChangeText={v => set('telephone', v)} placeholder="+237 6XX XXX XXX"
          keyboardType="phone-pad" />

        <Text style={fS.label}>Email</Text>
        <TextInput style={fS.input} value={form.email}
          onChangeText={v => set('email', v)} placeholder="exemple@email.com"
          keyboardType="email-address" autoCapitalize="none" />

        <Text style={fS.label}>Quartier</Text>
        <TextInput style={fS.input} value={form.quartier}
          onChangeText={v => set('quartier', v)} placeholder="Ex: Melen, Bastos..." />

        <View style={fS.row}>
          <View style={{ flex: 1 }}>
            <Text style={fS.label}>Ville</Text>
            <TextInput style={fS.input} value={form.ville}
              onChangeText={v => set('ville', v)} placeholder="Ex: Yaoundé..." />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={fS.label}>Pays</Text>
            <TextInput style={fS.input} value={form.pays}
              onChangeText={v => set('pays', v)} placeholder="Cameroun" />
          </View>
        </View>

        <Text style={fS.sectionLabel}>RÔLE DANS L'ASSOCIATION</Text>

        <Text style={fS.label}>Groupe *</Text>
        <TouchableOpacity style={[fS.input, fS.picker]}
          onPress={() => setShowPickerGroupe(true)}>
          <Text style={fS.pickerTxt}>{groupeSelectionne.icon}  {groupeSelectionne.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <Text style={fS.label}>Désignation</Text>
        <TouchableOpacity style={[fS.input, fS.picker]}
          onPress={() => setShowPickerRole(true)}>
          <Text style={[fS.pickerTxt, { color: roleSelectionne.color }]}>{roleSelectionne.icon}  {roleSelectionne.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[fS.btnSave, { opacity: saving ? 0.5 : 1, marginTop: 28 }]}
          onPress={enregistrer} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> :
            <Text style={fS.btnSaveTxt}>✅ Enregistrer l'adhérent</Text>}
        </TouchableOpacity>

      </ScrollView>

      <PickerModal
        visible={showPickerGroupe}
        title="Choisir un groupe"
        items={GROUPES.map(g => ({ cle: g.cle, label: `${g.icon}  ${g.label}`, color: g.color }))}
        selected={form.groupe}
        onSelect={v => { set('groupe', v); setShowPickerGroupe(false); }}
        onClose={() => setShowPickerGroupe(false)}
      />
      <PickerModal
        visible={showPickerRole}
        title="Désignation dans l'association"
        items={ROLES.map(r => ({ cle: r.cle, label: `${r.icon}  ${r.label}`, color: r.color }))}
        selected={form.role}
        onSelect={v => { set('role', v); setShowPickerRole(false); }}
        onClose={() => setShowPickerRole(false)}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  DETAIL ADHÉRENT
// ══════════════════════════════════════════════════════════════
function DetailAdherent({ adherent, peutModifier, onBack, onUpdated }) {
  const [groupe, setGroupe]       = useState(adherent.groupe || 'simple');
  const [titre, setTitre]         = useState(adherent.titre || 'M.');
  const [statut, setStatut]       = useState(adherent.statut || 'en_observation');
  const [photoUrl, setPhotoUrl]   = useState(adherent.photo_url || null);
  const [nom, setNom]             = useState(adherent.nom || '');
  const [prenom, setPrenom]       = useState(adherent.prenom || '');
  const [telephone, setTelephone] = useState(adherent.telephone || '');
  const [email, setEmail]         = useState(adherent.email || '');
  const [quartier, setQuartier]   = useState(adherent.quartier || '');
  const [ville, setVille]         = useState(adherent.ville || '');
  const [pays, setPays]           = useState(adherent.pays || 'Cameroun');
  const [cniNumero, setCniNumero] = useState(adherent.cni_numero || '');
  const [role, setRole]           = useState((adherent.role || 'ADHERENT').toUpperCase());
  const [saving, setSaving]       = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [showPickerGroupe, setShowPickerGroupe] = useState(false);
  const [showPickerStatut, setShowPickerStatut] = useState(false);
  const [showPickerRole, setShowPickerRole]     = useState(false);

  const [openTab, setOpenTab] = useState('infos');
  const [dettes, setDettes]   = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [fonds, setFonds]         = useState(null);
  const [loadingFonds, setLoadingFonds]         = useState(false);
  const [savingPaiement, setSavingPaiement]     = useState(false);
  const [modalPaiement, setModalPaiement]       = useState(null); // { champ, montantActuel, montantDu, label }
  const [montantSaisi, setMontantSaisi]         = useState('');
  const [loadingDettes, setLoadingDettes]     = useState(false);
  const [loadingSanctions, setLoadingSanctions] = useState(false);

  const g = GROUPE_MAP[groupe] || GROUPE_MAP.simple;

  function toggleTab(tab) {
    if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = openTab === tab ? null : tab;
    setOpenTab(next);
    if (next === 'dettes')    loadDettes();
    if (next === 'sanctions') loadSanctions();
    if (next === 'fonds' && !fonds) loadFonds();
  }

  async function loadFonds() {
    setLoadingFonds(true);
    const { data } = await supabase
      .from('fonds_adhesion')
      .select('*')
      .eq('adherent_id', adherent.adherent_id)
      .maybeSingle();
    setFonds(data || null);
    setLoadingFonds(false);
  }

  function enregistrerPaiement(champ, montantActuel, montantDu, label) {
    setMontantSaisi('');
    setModalPaiement({ champ, montantActuel, montantDu, label });
  }

  async function confirmerPaiement() {
    if (!modalPaiement) return;
    const { champ, montantActuel, montantDu, label } = modalPaiement;
    const val = parseInt(montantSaisi, 10);
    if (!val || val <= 0) { Alert.alert('Montant invalide', 'Entrez un montant supérieur à 0'); return; }
    const restant = montantDu - montantActuel;
    if (val > restant) { Alert.alert('Montant trop élevé', `Le restant est de ${restant.toLocaleString()} FCFA`); return; }

    const nouveau = montantActuel + val;
    const solde   = nouveau >= montantDu;
    const cleStatut = champ.replace('_paye', '_statut');
    setSavingPaiement(true);

    const update = { [champ]: nouveau };
    // projet_paye n'a pas de colonne projet_statut → on ne l'ajoute que pour les autres fonds
    if (champ !== 'projet_paye') {
      update[cleStatut] = solde ? 'solde' : 'en_cours';
    }

    // Vérifier si tous les obligatoires sont soldés
    const fondsMaj = { ...fonds, ...update };
    const tousObligatoiresSoldes =
      fondsMaj.fond_caisse_paye  >= fondsMaj.fond_caisse_du  &&
      fondsMaj.fond_malheur_paye >= fondsMaj.fond_malheur_du &&
      fondsMaj.chaise_paye       >= fondsMaj.chaise_du       &&
      fondsMaj.couvert_paye      >= fondsMaj.couvert_du;
    update.fonds_soldes = tousObligatoiresSoldes;

    const { error } = await supabase.from('fonds_adhesion')
      .update(update).eq('adherent_id', adherent.adherent_id);

    if (!error && tousObligatoiresSoldes) {
      await supabase.from('adherents')
        .update({ fonds_obligatoires_soldes: true })
        .eq('adherent_id', adherent.adherent_id);
    }

    setSavingPaiement(false);
    setModalPaiement(null);

    if (error) { Alert.alert('Erreur', error.message); return; }

    // ── Enregistrer mouvement caisse automatique ──
    await caisseIntegration.paiement(val, label, fonds.fonds_id, adherent.adherent_id);

    Alert.alert('✅ Paiement enregistré',
      `${label} : ${nouveau.toLocaleString()} / ${montantDu.toLocaleString()} FCFA${tousObligatoiresSoldes ? '\n\n🎉 Tous les fonds sont soldés !' : ''}`
    );
    loadFonds();
  }

  async function loadDettes() {
    setLoadingDettes(true);
    const { data } = await supabase
      .from('dettes')
      .select('dette_id, type_dette, description, montant_initial, montant_rembourse, montant_restant, statut, date_creation')
      .eq('adherent_id', adherent.adherent_id)
      .order('statut')                              // en_cours en premier
      .order('date_creation', { ascending: false });
    // Normaliser montant_rembourse null → 0
    setDettes((data || []).map(d => ({ ...d, montant_rembourse: d.montant_rembourse ?? 0 })));
    setLoadingDettes(false);
  }

  async function loadSanctions() {
    setLoadingSanctions(true);
    const { data } = await supabase
      .from('sanctions')
      .select('sanction_id, motif, montant, statut, date_sanction, description')
      .eq('adherent_id', adherent.adherent_id)
      .order('date_sanction', { ascending: false });
    setSanctions(data || []);
    setLoadingSanctions(false);
  }

  async function choisirPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setUploadingPhoto(true);
      const uri = result.assets[0].uri;
      const fileName = `adherent_${adherent.adherent_id}_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error } = await supabase.storage
        .from('photos-adherents').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (error) { Alert.alert('Erreur upload', error.message); setUploadingPhoto(false); return; }
      const { data: urlData } = supabase.storage.from('photos-adherents').getPublicUrl(fileName);
      setPhotoUrl(urlData.publicUrl);
      setUploadingPhoto(false);
    }
  }

  async function sauvegarder() {
    if (!nom.trim() || !prenom.trim() || !cniNumero.trim()) {
      Alert.alert('Champs requis', 'Nom, prénom et CNI sont obligatoires');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('adherents').update({
      titre, groupe, statut, role, photo_url: photoUrl,
      ville: ville || null, pays: pays || null,
      nom: nom.toUpperCase().trim(), prenom: prenom.trim(),
      telephone: telephone || null, email: email || null,
      quartier: quartier || null, cni_numero: cniNumero.trim(),
    }).eq('adherent_id', adherent.adherent_id);
    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    Alert.alert('✅ Mis à jour', 'Les modifications ont été enregistrées.');
    onUpdated();
  }

  const anciennete = adherent.date_inscription
    ? Math.floor((Date.now() - new Date(adherent.date_inscription)) / (1000 * 60 * 60 * 24 * 30))
    : 0;

  const roleInfo = getRoleInfo(role);
  const totalFonds = 60000; // 20000+25000+5000+10000
  const fondsPayesCalc = fonds
    ? (fonds.fond_caisse_paye||0) + (fonds.fond_malheur_paye||0) + (fonds.chaise_paye||0) + (fonds.couvert_paye||0)
    : 0;
  const fondsProgress = fondsPayesCalc / totalFonds;

  return (
    <View style={{ flex: 1, backgroundColor: '#151826' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>

        {/* ── BANNIÈRE ── */}
        <View style={dS.banniere}>
          <View style={[dS.banniereGradient, { backgroundColor: g.color }]} />
          <View style={dS.banniereOverlay} />

          <TouchableOpacity style={dS.btnRetour} onPress={onBack}>
            <Text style={dS.btnRetourTxt}>← Retour</Text>
          </TouchableOpacity>

          <View style={dS.banniereContenu}>
            {/* Photo */}
            <TouchableOpacity onPress={peutModifier ? choisirPhoto : null} style={dS.photoWrapper}>
              {uploadingPhoto ? (
                <View style={[dS.photoImg, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' }]}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : photoUrl ? (
                <Image source={{ uri: photoUrl }} style={dS.photoImg} />
              ) : (
                <View style={[dS.photoImg, { backgroundColor: g.color + '99', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 36, fontWeight: 'bold' }}>
                    {(nom?.[0] || '?')}{(prenom?.[0] || '')}
                  </Text>
                </View>
              )}
              {peutModifier && (
                <View style={dS.photoEditOverlay}><Text style={{ color: '#fff', fontSize: 14 }}>📷</Text></View>
              )}
            </TouchableOpacity>

            {/* Infos */}
            <View style={dS.banniereInfos}>
              <Text style={dS.banniereNom} numberOfLines={2}>
                {titre} {nom} {prenom}
              </Text>
              <Text style={dS.banniereGroupe}>{g.icon}  {g.label}</Text>

              <View style={dS.banniereBadges}>
                <View style={[dS.roleBadge, { backgroundColor: roleInfo.color + '33', borderColor: roleInfo.color }]}>
                  <Text style={[dS.roleBadgeTxt, { color: roleInfo.color }]}>{roleInfo.icon} {roleInfo.label}</Text>
                </View>
                <View style={[dS.statutBadge, { backgroundColor: getStatutColor(statut) }]}>
                  <Text style={dS.statutBadgeTxt}>{getStatutLabel(statut)}</Text>
                </View>
              </View>

              {adherent.telephone && (
                <Text style={dS.banniereContact}>📞 {adherent.telephone}</Text>
              )}
              {adherent.email && (
                <Text style={dS.banniereContact}>✉️ {adherent.email}</Text>
              )}
              {(adherent.ville || adherent.pays) && (
                <Text style={dS.banniereContact}>📍 {[adherent.ville, adherent.pays].filter(Boolean).join(', ')}</Text>
              )}
            </View>
          </View>

          {/* Barre ancienneté */}
          <View style={dS.ancienneteBar}>
            <Text style={dS.ancienneteTxt}>📅 {anciennete} mois d'ancienneté</Text>
            <View style={dS.fondsProgressBar}>
              <View style={[dS.fondsProgressFill, { width: `${Math.round(fondsProgress * 100)}%` }]} />
            </View>
            <Text style={dS.fondsProgressTxt}>
              Fonds d'intégration : {formatFCFA(fondsPayesCalc)} / {formatFCFA(totalFonds)} ({Math.round(fondsProgress * 100)}%)
            </Text>
          </View>
        </View>

        {/* ── ACCORDÉONS ── */}
        <View style={dS.tabsContainer}>

          {/* Infos de base */}
          <TabAccordeon icon="👤" label="Informations de base"
            open={openTab === 'infos'} onPress={() => toggleTab('infos')}>
            <InfoLigne label="CNI"              val={adherent.cni_numero || '—'} />
            <InfoLigne label="Téléphone"        val={adherent.telephone || '—'} />
            <InfoLigne label="Email"            val={adherent.email || '—'} />
            <InfoLigne label="Quartier"         val={adherent.quartier || '—'} />
            <InfoLigne label="Ville"            val={[adherent.ville, adherent.pays].filter(Boolean).join(', ') || '—'} />
            <InfoLigne label="Date naissance"   val={adherent.date_naissance ? new Date(adherent.date_naissance + 'T12:00:00').toLocaleDateString('fr-FR') : '—'} />
            <InfoLigne label="Date inscription" val={adherent.date_inscription ? new Date(adherent.date_inscription + 'T12:00:00').toLocaleDateString('fr-FR') : '—'} />
            <InfoLigne label="Fin observation"  val={adherent.date_fin_observation ? new Date(adherent.date_fin_observation + 'T12:00:00').toLocaleDateString('fr-FR') : '—'} last />
          </TabAccordeon>

          {/* Fonds d'intégration */}
          <TabAccordeon icon="🆕" label="Fonds d'intégration"
            open={openTab === 'fonds'} onPress={() => toggleTab('fonds')}
            badgeCount={fonds && !fonds.fonds_soldes ? 1 : 0}
            badgeColor="#C55A11">
            {loadingFonds
              ? <ActivityIndicator color="#C55A11" style={{ marginVertical: 16 }} />
              : !fonds
                ? <Text style={dS.tabEmpty}>⚠️ Aucune fiche fonds trouvée</Text>
                : (() => {
                    const lignes = [
                      { cle: 'fond_caisse',   label: 'Fond de caisse',        icon: '🏦', du: fonds.fond_caisse_du,   paye: fonds.fond_caisse_paye,   statut: fonds.fond_caisse_statut   },
                      { cle: 'fond_malheur',  label: 'Fonds maladie/malheur', icon: '🏥', du: fonds.fond_malheur_du,  paye: fonds.fond_malheur_paye,  statut: fonds.fond_malheur_statut  },
                      { cle: 'chaise',        label: 'Chaise',                icon: '🪑', du: fonds.chaise_du,        paye: fonds.chaise_paye,        statut: fonds.chaise_statut        },
                      { cle: 'couvert',       label: 'Couverts',              icon: '🍽️', du: fonds.couvert_du,       paye: fonds.couvert_paye,       statut: fonds.couvert_statut       },
                    ];
                    const totalDu   = lignes.reduce((s, l) => s + (l.du   || 0), 0);
                    const totalPaye = lignes.reduce((s, l) => s + (l.paye || 0), 0);
                    return (
                      <>
                        {/* Résumé global */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                          <View>
                            <Text style={{ color: '#8894AA', fontSize: 11 }}>Total payé</Text>
                            <Text style={{ color: '#4CAF50', fontSize: 18, fontWeight: 'bold' }}>{formatFCFA(totalPaye)}</Text>
                          </View>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: '#8894AA', fontSize: 11 }}>Progression</Text>
                            <Text style={{ color: '#E8755A', fontSize: 18, fontWeight: 'bold' }}>{Math.round((totalPaye/totalDu)*100)}%</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: '#8894AA', fontSize: 11 }}>Restant</Text>
                            <Text style={{ color: '#EF5350', fontSize: 18, fontWeight: 'bold' }}>{formatFCFA(totalDu - totalPaye)}</Text>
                          </View>
                        </View>

                        {/* Barre globale */}
                        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
                          <View style={{ height: '100%', width: `${Math.round((totalPaye/totalDu)*100)}%`, backgroundColor: totalPaye >= totalDu ? '#4CAF50' : '#E8755A', borderRadius: 3 }} />
                        </View>

                        {/* Lignes détail */}
                        {lignes.map((l, idx) => {
                          const solde   = l.paye >= l.du;
                          const restant = l.du - l.paye;
                          const pct     = Math.round((l.paye / l.du) * 100);
                          return (
                            <View key={l.cle} style={[dS.fondsLigne, idx < lignes.length - 1 && dS.fondsLigneBorder]}>
                              <View style={[dS.fondsIconBadge, { backgroundColor: solde ? '#1E7E34' : '#C55A11' }]}>
                                <Text style={{ fontSize: 15 }}>{l.icon}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={dS.fondsLabel}>{l.label}</Text>
                                <Text style={dS.fondsMontant}>{(l.paye||0).toLocaleString()} / {(l.du||0).toLocaleString()} FCFA</Text>
                                <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 5, width: 120 }}>
                                  <View style={{ height: '100%', width: `${pct}%`, backgroundColor: solde ? '#4CAF50' : '#E8755A', borderRadius: 2 }} />
                                </View>
                              </View>
                              {solde ? (
                                <View style={[dS.fondsStatutBadge, { backgroundColor: '#1E7E3422', borderColor: '#1E7E34' }]}>
                                  <Text style={[dS.fondsStatutTxt, { color: '#4CAF50' }]}>✓ Soldé</Text>
                                </View>
                              ) : peutModifier ? (
                                <TouchableOpacity
                                  disabled={savingPaiement}
                                  style={{ backgroundColor: '#E8755A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                                  onPress={() => enregistrerPaiement(`${l.cle}_paye`, l.paye, l.du, l.label)}>
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Payer</Text>
                                </TouchableOpacity>
                              ) : (
                                <View style={[dS.fondsStatutBadge, { backgroundColor: '#C55A1122', borderColor: '#C55A11' }]}>
                                  <Text style={[dS.fondsStatutTxt, { color: '#C55A11' }]}>⏳ {restant.toLocaleString()} F</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {/* Projet optionnel */}
                        <View style={[dS.fondsLigne, { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                          <View style={[dS.fondsIconBadge, { backgroundColor: fonds.projet_souscrit ? '#1E7E34' : '#555' }]}>
                            <Text style={{ fontSize: 15 }}>📋</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dS.fondsLabel}>Projet (optionnel)</Text>
                            <Text style={dS.fondsMontant}>
                              {fonds.projet_souscrit
                                ? `${(fonds.projet_paye||0).toLocaleString()} / 40 000 FCFA`
                                : '40 000 FCFA'}
                            </Text>
                            {fonds.projet_souscrit && (
                              <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 5, width: 120 }}>
                                <View style={{ height: '100%', width: `${Math.round(((fonds.projet_paye||0)/40000)*100)}%`, backgroundColor: (fonds.projet_paye||0) >= 40000 ? '#4CAF50' : '#E8755A', borderRadius: 2 }} />
                              </View>
                            )}
                          </View>
                          {peutModifier && (
                            !fonds.projet_souscrit ? (
                              <TouchableOpacity
                                style={{ backgroundColor: '#555', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                                onPress={async () => {
                                  await supabase.from('fonds_adhesion')
                                    .update({ projet_souscrit: true, projet_du: 40000 })
                                    .eq('adherent_id', adherent.adherent_id);
                                  loadFonds();
                                }}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Souscrire</Text>
                              </TouchableOpacity>
                            ) : (fonds.projet_paye||0) < 40000 ? (
                              <TouchableOpacity
                                disabled={savingPaiement}
                                style={{ backgroundColor: '#E8755A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                                onPress={() => enregistrerPaiement('projet_paye', fonds.projet_paye||0, 40000, 'Projet')}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Payer</Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={[dS.fondsStatutBadge, { backgroundColor: '#1E7E3422', borderColor: '#1E7E34' }]}>
                                <Text style={[dS.fondsStatutTxt, { color: '#4CAF50' }]}>✓ Soldé</Text>
                              </View>
                            )
                          )}
                        </View>

                        {/* Date limite */}
                        {fonds.date_limite && (
                          <Text style={{ color: '#8894AA', fontSize: 11, marginTop: 12, textAlign: 'center' }}>
                            📅 Date limite : {new Date(fonds.date_limite + 'T12:00:00').toLocaleDateString('fr-FR')}
                          </Text>
                        )}
                      </>
                    );
                  })()
            }
          </TabAccordeon>

          {/* Dettes */}
          <TabAccordeon icon="⚠️" label="Dettes en cours"
            open={openTab === 'dettes'} onPress={() => toggleTab('dettes')}
            badgeCount={adherent.nb_dettes_en_cours || 0}
            badgeColor="#C00000">
            {loadingDettes
              ? <ActivityIndicator color="#1F3864" style={{ marginVertical: 16 }} />
              : dettes.length === 0
                ? <Text style={dS.tabEmpty}>✅ Aucune dette enregistrée</Text>
                : dettes.map((d, idx) => {
                    const pct = d.montant_initial > 0 ? Math.round((1 - d.montant_restant / d.montant_initial) * 100) : 0;
                    const couleur = d.statut === 'solde' ? '#1E7E34' : d.statut === 'partiellement_rembourse' ? '#C55A11' : '#C00000';
                    const statutLabel = d.statut === 'solde' ? 'Soldé' : d.statut === 'partiellement_rembourse' ? 'Partiel' : 'En cours';
                    return (
                      <View key={d.dette_id} style={[dS.detteItem, idx < dettes.length - 1 && dS.detteItemBorder]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <View style={[dS.detteStatutDot, { backgroundColor: couleur }]} />
                          <Text style={dS.detteType} numberOfLines={1}>{d.description || (d.type_dette || '').replace(/_/g, ' ')}</Text>
                          <View style={[dS.detteStatutChip, { backgroundColor: couleur + '18', borderColor: couleur }]}>
                            <Text style={[dS.detteStatutChipTxt, { color: couleur }]}>{statutLabel}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          {['Initial', 'Remboursé', 'Restant'].map(l => <Text key={l} style={dS.detteMontantLabel}>{l}</Text>)}
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={dS.detteMontantVal}>{d.montant_initial.toLocaleString()} F</Text>
                          <Text style={[dS.detteMontantVal, { color: '#1E7E34' }]}>{(d.montant_rembourse || 0).toLocaleString()} F</Text>
                          <Text style={[dS.detteMontantVal, { color: couleur, fontWeight: 'bold' }]}>{d.montant_restant.toLocaleString()} F</Text>
                        </View>
                        <View style={dS.progressBar}>
                          <View style={[dS.progressFill, { width: `${pct}%`, backgroundColor: couleur }]} />
                        </View>
                        <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                          {new Date(d.date_creation + 'T12:00:00').toLocaleDateString('fr-FR')} · {pct}% remboursé
                        </Text>
                      </View>
                    );
                  })
            }
          </TabAccordeon>

          {/* Sanctions */}
          <TabAccordeon icon="⚖️" label="Historique sanctions"
            open={openTab === 'sanctions'} onPress={() => toggleTab('sanctions')}
            badgeCount={sanctions.filter(s => s.statut === 'impayee').length}
            badgeColor="#C00000">
            {loadingSanctions
              ? <ActivityIndicator color="#1F3864" style={{ marginVertical: 16 }} />
              : sanctions.length === 0
                ? <Text style={dS.tabEmpty}>✅ Aucune sanction enregistrée</Text>
                : sanctions.map((s, idx) => {
                    const couleur = s.statut === 'payee' ? '#1E7E34' : '#C00000';
                    const sLabel  = s.statut === 'payee' ? 'Payée' : 'Impayée';
                    return (
                      <View key={s.sanction_id} style={[dS.detteItem, idx < sanctions.length - 1 && dS.detteItemBorder]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 18, marginRight: 8 }}>⚖️</Text>
                          <Text style={[dS.detteType, { flex: 1 }]} numberOfLines={1}>{s.motif || '—'}</Text>
                          <View style={[dS.detteStatutChip, { backgroundColor: couleur + '18', borderColor: couleur }]}>
                            <Text style={[dS.detteStatutChipTxt, { color: couleur }]}>{sLabel}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[dS.detteMontantVal, { color: couleur, fontWeight: 'bold' }]}>
                            {(s.montant || 0).toLocaleString()} FCFA
                          </Text>
                          <Text style={{ fontSize: 11, color: '#999' }}>
                            {s.date_sanction ? new Date(s.date_sanction + 'T12:00:00').toLocaleDateString('fr-FR') : '—'}
                          </Text>
                        </View>
                        {s.description && <Text style={{ fontSize: 11, color: '#aaa', marginTop: 4, fontStyle: 'italic' }}>{s.description}</Text>}
                      </View>
                    );
                  })
            }
          </TabAccordeon>

          {/* Modifier le profil (bureau uniquement) */}
          {peutModifier && (
            <TabAccordeon icon="✏️" label="Modifier le profil"
              open={openTab === 'edit'} onPress={() => toggleTab('edit')}>

              <Text style={dS.editSectionLabel}>Titre</Text>
              <View style={fS.titreRow}>
                {TITRES.map(t => (
                  <TouchableOpacity key={t}
                    style={[fS.titreBtn, titre === t && fS.titreBtnActive]}
                    onPress={() => setTitre(t)}>
                    <Text style={[fS.titreBtnText, titre === t && { color: '#fff', fontWeight: 'bold' }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={fS.row}>
                <View style={{ flex: 1 }}>
                  <Text style={dS.editLabel}>Nom</Text>
                  <TextInput style={dS.editInput} value={nom}
                    onChangeText={v => setNom(v.toUpperCase())} placeholder="NOM" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dS.editLabel}>Prénom</Text>
                  <TextInput style={dS.editInput} value={prenom}
                    onChangeText={setPrenom} placeholder="Prénom" />
                </View>
              </View>

              <Text style={dS.editLabel}>N° CNI</Text>
              <TextInput style={dS.editInput} value={cniNumero}
                onChangeText={setCniNumero} placeholder="Ex: 123456789" />

              <Text style={dS.editLabel}>Téléphone</Text>
              <TextInput style={dS.editInput} value={telephone}
                onChangeText={setTelephone} placeholder="+237 6XX XXX XXX" keyboardType="phone-pad" />

              <Text style={dS.editLabel}>Email</Text>
              <TextInput style={dS.editInput} value={email}
                onChangeText={setEmail} placeholder="exemple@email.com"
                keyboardType="email-address" autoCapitalize="none" />

              <Text style={dS.editLabel}>Quartier</Text>
              <TextInput style={dS.editInput} value={quartier}
                onChangeText={setQuartier} placeholder="Ex: Melen, Bastos..." />

              <View style={fS.row}>
                <View style={{ flex: 1 }}>
                  <Text style={dS.editLabel}>Ville</Text>
                  <TextInput style={dS.editInput} value={ville} onChangeText={setVille} placeholder="Yaoundé..." />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dS.editLabel}>Pays</Text>
                  <TextInput style={dS.editInput} value={pays} onChangeText={setPays} placeholder="Cameroun" />
                </View>
              </View>

              <Text style={dS.editLabel}>Groupe</Text>
              <TouchableOpacity style={[dS.editInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setShowPickerGroupe(true)}>
                <Text style={{ color: '#ccc' }}>{GROUPE_MAP[groupe]?.icon}  {GROUPE_MAP[groupe]?.label}</Text>
                <Text style={{ color: '#aaa' }}>▼</Text>
              </TouchableOpacity>

              <Text style={dS.editLabel}>Statut</Text>
              <TouchableOpacity style={[dS.editInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setShowPickerStatut(true)}>
                <Text style={{ color: getStatutColor(statut), fontWeight: 'bold' }}>{getStatutLabel(statut)}</Text>
                <Text style={{ color: '#aaa' }}>▼</Text>
              </TouchableOpacity>

              <Text style={dS.editLabel}>Désignation</Text>
              <TouchableOpacity style={[dS.editInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setShowPickerRole(true)}>
                <Text style={{ color: roleInfo.color }}>{roleInfo.icon}  {roleInfo.label}</Text>
                <Text style={{ color: '#aaa' }}>▼</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[dS.btnSave, { opacity: saving ? 0.5 : 1, marginTop: 20 }]}
                onPress={sauvegarder} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> :
                  <Text style={dS.btnSaveTxt}>💾 Enregistrer les modifications</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[dS.btnDanger, { opacity: saving ? 0.5 : 1 }]}
                onPress={() => Alert.alert(
                  '🗑️ Supprimer l\'adhérent',
                  `Supprimer définitivement ${adherent.nom} ${adherent.prenom} ?\nCette action est irréversible.`,
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Supprimer', style: 'destructive', onPress: async () => {
                        await supabase.from('adherents').delete().eq('adherent_id', adherent.adherent_id);
                        onUpdated(); onBack();
                      }
                    },
                  ]
                )}>
                <Text style={dS.btnDangerTxt}>🗑️ Supprimer cet adhérent</Text>
              </TouchableOpacity>
            </TabAccordeon>
          )}
        </View>
      </ScrollView>

      {/* Pickers */}
      <PickerModal visible={showPickerGroupe} title="Choisir un groupe"
        items={GROUPES.map(g => ({ cle: g.cle, label: `${g.icon}  ${g.label}`, color: g.color }))}
        selected={groupe} onSelect={v => { setGroupe(v); setShowPickerGroupe(false); }}
        onClose={() => setShowPickerGroupe(false)} />

      <PickerModal visible={showPickerStatut} title="Changer le statut"
        items={STATUTS.map(s => ({ cle: s.cle, label: s.label, color: s.color }))}
        selected={statut} onSelect={v => { setStatut(v); setShowPickerStatut(false); }}
        onClose={() => setShowPickerStatut(false)} />

      <PickerModal visible={showPickerRole} title="Désignation dans l'association"
        items={ROLES.map(r => ({ cle: r.cle, label: `${r.icon}  ${r.label}`, color: r.color }))}
        selected={role} onSelect={v => { setRole(v); setShowPickerRole(false); }}
        onClose={() => setShowPickerRole(false)} />

      {/* ── Modal saisie paiement fonds ── */}
      <Modal visible={!!modalPaiement} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: '#1E2130' }]}>
            {modalPaiement && (
              <>
                <Text style={[styles.modalTitle, { color: '#ddd' }]}>
                  💳 {modalPaiement.label}
                </Text>
                <Text style={{ color: '#8894AA', fontSize: 13, marginBottom: 16 }}>
                  Payé : {modalPaiement.montantActuel.toLocaleString()} FCFA{'\n'}
                  Restant : {(modalPaiement.montantDu - modalPaiement.montantActuel).toLocaleString()} FCFA
                </Text>
                <Text style={{ color: '#8894AA', fontSize: 12, marginBottom: 6 }}>
                  Montant à enregistrer (FCFA)
                </Text>
                <TextInput
                  style={[dS.editInput, { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#E8755A' }]}
                  keyboardType="numeric"
                  placeholder="Ex: 10000"
                  placeholderTextColor="#555"
                  value={montantSaisi}
                  onChangeText={setMontantSaisi}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.modalClose, { flex: 1 }]}
                    onPress={() => setModalPaiement(null)}>
                    <Text style={styles.modalCloseText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalClose, { flex: 1, backgroundColor: '#E8755A', opacity: savingPaiement ? 0.6 : 1 }]}
                    onPress={confirmerPaiement}
                    disabled={savingPaiement}>
                    {savingPaiement
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={[styles.modalCloseText, { color: '#fff' }]}>✅ Confirmer</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  COMPOSANTS PARTAGÉS
// ══════════════════════════════════════════════════════════════

function PickerModal({ visible, title, items, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 350 }}>
            {items.map(item => (
              <TouchableOpacity key={item.cle}
                style={[styles.modalItem, selected === item.cle && { backgroundColor: item.color || '#1F3864' }]}
                onPress={() => onSelect(item.cle)}>
                <Text style={[styles.modalItemText, selected === item.cle && { color: '#fff' }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function TabAccordeon({ icon, label, open, onPress, children, badgeCount, badgeColor }) {
  return (
    <View style={tabS.wrapper}>
      <TouchableOpacity style={tabS.header} onPress={onPress} activeOpacity={0.75}>
        <View style={tabS.left}>
          <Text style={tabS.icon}>{icon}</Text>
          <Text style={tabS.label}>{label}</Text>
          {badgeCount > 0 && (
            <View style={[tabS.badge, { backgroundColor: badgeColor || '#C00000' }]}>
              <Text style={tabS.badgeText}>{badgeCount}</Text>
            </View>
          )}
        </View>
        <Text style={[tabS.chevron, open && tabS.chevronOpen]}>›</Text>
      </TouchableOpacity>
      {open && <View style={tabS.body}>{children}</View>}
    </View>
  );
}

function InfoLigne({ label, val, last }) {
  return (
    <View style={[dS.infoLigne, !last && dS.infoLigneBorder]}>
      <Text style={dS.infoLabel}>{label}</Text>
      <Text style={dS.infoVal}>{val}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F0F2F5' },
  header:          { backgroundColor: '#1F3864', flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 44 : 14, paddingBottom: 12, paddingHorizontal: 12, gap: 8 },
  backBtn:         { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  backTxt:         { color: '#fff', fontSize: 18, fontWeight: 'bold', lineHeight: 20 },
  headerTitle:     { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  searchInput:     { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 13, minWidth: 100 },
  filtreBtn:       { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  filtreBtnActive: { backgroundColor: '#C55A11' },
  filtreBtnTxt:    { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnAjouter:      { backgroundColor: '#C55A11', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  btnAjouterTxt:   { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  tabsBar:         { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8ECF0' },
  tab:             { paddingHorizontal: 14, paddingVertical: 12, position: 'relative' },
  tabActive:       { backgroundColor: '#F8F9FB' },
  tabTxt:          { fontSize: 12, color: '#888', fontWeight: '500' },
  tabTxtActive:    { color: '#1F3864', fontWeight: 'bold' },
  tabLine:         { position: 'absolute', bottom: 0, left: 8, right: 8, height: 3, borderRadius: 2 },

  statsRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF0F3', gap: 14, flexWrap: 'wrap' },
  statChip:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot:         { width: 8, height: 8, borderRadius: 4 },
  statNum:         { fontWeight: 'bold', fontSize: 14 },
  statLabel:       { fontSize: 12, color: '#666' },
  showingTxt:      { marginLeft: 'auto', fontSize: 11, color: '#AAA', fontStyle: 'italic' },

  tableHead:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C3E60', paddingHorizontal: 12, paddingVertical: 10 },
  thCell:          { fontSize: 10, color: '#AAB8CC', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },

  tableRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  tableRowEven:    { backgroundColor: '#F8F9FB' },
  tdCell:          { fontSize: 12, color: '#555' },
  tdName:          { fontSize: 13, fontWeight: '600', color: '#1E2130' },
  tdSub:           { fontSize: 10, color: '#888', marginTop: 2 },

  groupeChip:      { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, marginHorizontal: 2 },
  groupeChipTxt:   { fontSize: 10, fontWeight: 'bold' },

  statutBadge:     { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  statutBadgeTxt:  { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  actionCell:      { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  actionBtn:       { width: 28, height: 28, borderRadius: 6, backgroundColor: '#EEF2F8', justifyContent: 'center', alignItems: 'center' },

  pagination:      { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 12, gap: 6, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  pageBtn:         { width: 32, height: 32, borderRadius: 6, backgroundColor: '#EEF2F8', justifyContent: 'center', alignItems: 'center' },
  pageBtnActive:   { backgroundColor: '#C55A11' },
  pageBtnDisabled: { opacity: 0.3 },
  pageBtnTxt:      { fontSize: 14, fontWeight: 'bold', color: '#555' },

  // Filtres modal
  filtreChipsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filtreChip:      { borderRadius: 20, borderWidth: 1.5, borderColor: '#ccc', paddingHorizontal: 14, paddingVertical: 8 },
  filtreChipTxt:   { fontSize: 13, color: '#555', fontWeight: '500' },

  // Modal partagé
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:      { fontSize: 16, fontWeight: 'bold', color: '#1E2130', marginBottom: 16 },
  modalSectionLabel: { fontSize: 12, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  modalItem:       { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 6, backgroundColor: '#F5F7FA' },
  modalItemText:   { fontSize: 14, color: '#333', fontWeight: '500' },
  modalClose:      { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6, backgroundColor: '#F0F2F5' },
  modalCloseText:  { fontWeight: 'bold', fontSize: 14, color: '#555' },
});

// Styles accordéon (DetailAdherent)
const tabS = {
  wrapper: { backgroundColor: '#1E2130', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16 },
  left:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  icon:    { fontSize: 18 },
  label:   { fontSize: 15, fontWeight: '600', color: '#E8755A' },
  badge:   { marginLeft: 8, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  chevron: { fontSize: 24, color: '#E8755A', fontWeight: 'bold' },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  body:    { backgroundColor: '#252840', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
};

// Styles bannière + détail
const dS = StyleSheet.create({
  banniere:         { minHeight: 200, position: 'relative', paddingTop: Platform.OS === 'ios' ? 54 : 24, paddingBottom: 0 },
  banniereGradient: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
  banniereOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  btnRetour:        { marginLeft: 16, marginBottom: 12 },
  btnRetourTxt:     { color: '#fff', fontSize: 15, fontWeight: '600' },

  banniereContenu:  { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 14, alignItems: 'flex-start' },
  photoWrapper:     { position: 'relative' },
  photoImg:         { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  photoEditOverlay: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },

  banniereInfos:    { flex: 1, paddingTop: 4 },
  banniereNom:      { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4, lineHeight: 22 },
  banniereGroupe:   { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 8 },
  banniereBadges:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  roleBadge:        { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeTxt:     { fontSize: 11, fontWeight: 'bold' },
  statutBadge:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statutBadgeTxt:   { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  banniereContact:  { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginBottom: 2 },

  ancienneteBar:    { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 16, paddingVertical: 10 },
  ancienneteTxt:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 6 },
  fondsProgressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  fondsProgressFill:{ height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  fondsProgressTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },

  tabsContainer:    { backgroundColor: '#151826' },
  infoLigne:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
  infoLigneBorder:  { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  infoLabel:        { color: '#8894AA', fontSize: 13, flex: 1 },
  infoVal:          { color: '#DDE3EE', fontSize: 13, fontWeight: '500', flex: 1.5, textAlign: 'right' },

  fondsLigne:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  fondsLigneBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  fondsIconBadge:   { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fondsLabel:       { color: '#DDE3EE', fontSize: 13, fontWeight: '500' },
  fondsMontant:     { color: '#8894AA', fontSize: 11, marginTop: 2 },
  fondsStatutBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  fondsStatutTxt:   { fontSize: 11, fontWeight: 'bold' },

  detteItem:        { paddingVertical: 12 },
  detteItemBorder:  { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  detteStatutDot:   { width: 8, height: 8, borderRadius: 4, marginRight: 8, flexShrink: 0 },
  detteType:        { color: '#DDE3EE', fontSize: 13, fontWeight: '500', flex: 1 },
  detteStatutChip:  { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6 },
  detteStatutChipTxt: { fontSize: 11, fontWeight: 'bold' },
  detteMontantLabel:{ color: '#8894AA', fontSize: 11 },
  detteMontantVal:  { color: '#DDE3EE', fontSize: 13, fontWeight: '500' },
  progressBar:      { height: 5, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' },
  progressFill:     { height: '100%', borderRadius: 3 },

  tabEmpty:         { color: '#8894AA', fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },

  editSectionLabel: { color: '#8894AA', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  editLabel:        { color: '#8894AA', fontSize: 12, marginBottom: 5, marginTop: 12 },
  editInput:        { backgroundColor: '#1E2A40', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#DDE3EE', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnSave:          { backgroundColor: '#1F3864', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnSaveTxt:       { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  btnDanger:        { backgroundColor: '#C00000', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  btnDangerTxt:     { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});

// Styles formulaire ajout
const fS = StyleSheet.create({
  sectionLabel: { fontSize: 11, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 20, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E8ECF0' },
  label:        { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 12 },
  input:        { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#E0E4EA', marginBottom: 2 },
  row:          { flexDirection: 'row', gap: 10 },
  titreRow:     { flexDirection: 'row', gap: 10, marginBottom: 4 },
  titreBtn:     { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: '#ccc', paddingVertical: 12, alignItems: 'center' },
  titreBtnActive: { backgroundColor: '#1F3864', borderColor: '#1F3864' },
  titreBtnText: { fontSize: 14, color: '#555' },
  picker:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerTxt:    { fontSize: 14, color: '#333' },
  photoCercle:  { width: 110, height: 110, borderRadius: 55, overflow: 'hidden', position: 'relative', borderWidth: 3, borderColor: '#1F3864' },
  photoImg:     { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F2F5' },
  photoEditOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(31,56,100,0.75)', paddingVertical: 6, alignItems: 'center' },
  btnSave:      { backgroundColor: '#1F3864', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnSaveTxt:   { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});