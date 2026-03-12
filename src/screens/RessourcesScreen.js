import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, SectionList,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal, ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { caisseRessources } from '../lib/caisse';
import { AjumyDatePicker, toSupabaseDate } from '../components/AjumyDateTimePicker';

// ── Constantes ────────────────────────────────────────────────
const COULEUR = '#1A5276';

const CATEGORIES = [
  { cle: 'chaises',    label: 'Chaises',            icon: '🪑', color: '#1A5276' },
  { cle: 'couverts',   label: 'Couverts / Vaisselle',icon: '🍽️', color: '#117A65' },
  { cle: 'sono',       label: 'Sono / Matériel audio',icon: '🔊', color: '#6E2F8A' },
  { cle: 'fournitures',label: 'Fournitures bureau',  icon: '📦', color: '#B7770D' },
  { cle: 'autre',      label: 'Autre',               icon: '🗂️', color: '#717D7E' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.cle, c]));

const ETATS = [
  { cle: 'bon',          label: 'Bon état',      color: '#1E7E34' },
  { cle: 'usage',        label: 'Usagé',         color: '#C55A11' },
  { cle: 'mauvais',      label: 'Mauvais état',  color: '#C00000' },
  { cle: 'hors_service', label: 'Hors service',  color: '#888'    },
];
const ETAT_MAP = Object.fromEntries(ETATS.map(e => [e.cle, e]));

const MVT_TYPES = [
  { cle: 'achat',        label: '🛒 Achat / Acquisition',   flux: 'depense' },
  { cle: 'ajout_stock',  label: '➕ Ajout stock',            flux: null      },
  { cle: 'location_out', label: '🤝 Location sortante',      flux: 'entree'  },
  { cle: 'retour',       label: '↩️ Retour location',        flux: null      },
  { cle: 'reparation',   label: '🔧 Réparation',             flux: 'depense' },
  { cle: 'reforme',      label: '🗑️ Mise au rebut',          flux: null      },
];

function fcfa(n) {
  return (n || 0).toLocaleString('fr-FR') + ' FCFA';
}

// ══════════════════════════════════════════════════════════════
//  ÉCRAN PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function RessourcesScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [ressources, setRessources]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('tous');
  const [vue, setVue]                 = useState('liste'); // liste | stats
  const [showForm, setShowForm]       = useState(false);
  const [showMvt, setShowMvt]         = useState(null);   // ressource pour mouvement
  const [showDetail, setShowDetail]   = useState(null);   // ressource détail

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('ressource').select('*').order('categorie').order('nom');
    if (error) Alert.alert('Erreur', error.message);
    else setRessources(data || []);
    setLoading(false);
  }

  const filtered = ressources.filter(r => {
    const matchSearch = r.nom.toLowerCase().includes(search.toLowerCase());
    const matchCat    = filtreCategorie === 'tous' || r.categorie === filtreCategorie;
    return matchSearch && matchCat;
  });

  const sections = CATEGORIES.map(c => ({
    categorie: c,
    data: filtered.filter(r => r.categorie === c.cle),
  })).filter(s => s.data.length > 0);

  // Stats
  const totalValeur = ressources.reduce((s, r) => s + (r.valeur_achat || 0), 0);
  const nbHorsService = ressources.filter(r => r.etat === 'hors_service').length;
  const nbDispo = ressources.reduce((s, r) => s + (r.quantite_disponible || 0), 0);
  const nbTotal = ressources.reduce((s, r) => s + (r.quantite || 0), 0);

  if (showForm)   return <FormulaireRessource onBack={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />;
  if (showDetail) return <DetailRessource ressource={showDetail} onBack={() => setShowDetail(null)} onUpdated={() => { setShowDetail(null); load(); }} onMouvement={(r) => { setShowDetail(null); setShowMvt(r); }} />;
  if (showMvt)    return <SaisirMouvement ressource={showMvt}   onBack={() => setShowMvt(null)}   onSaved={() => { setShowMvt(null); load(); }} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>🏛️ Ressources</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}><Text style={styles.addBtn}>+ Ajouter</Text></TouchableOpacity>
      </View>

      {/* Stats rapides */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: '#E8F0FB' }]}>
          <Text style={[styles.statNum, { color: COULEUR }]}>{nbTotal}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#E8F5E9' }]}>
          <Text style={[styles.statNum, { color: '#1E7E34' }]}>{nbDispo}</Text>
          <Text style={styles.statLbl}>Disponibles</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#FFF3E0' }]}>
          <Text style={[styles.statNum, { color: '#C55A11' }]}>{nbHorsService}</Text>
          <Text style={styles.statLbl}>Hors service</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#F3E8FF' }]}>
          <Text style={[styles.statNum, { color: '#6E2F8A', fontSize: 13 }]}>{(totalValeur/1000).toFixed(0)}k</Text>
          <Text style={styles.statLbl}>Valeur</Text>
        </View>
      </View>

      {/* Recherche */}
      <TextInput style={styles.search} placeholder="🔍 Rechercher..." value={search} onChangeText={setSearch} />

      {/* Filtre catégories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtreRow}>
        <TouchableOpacity style={[styles.filtreBtn, filtreCategorie === 'tous' && styles.filtreBtnActive]} onPress={() => setFiltreCategorie('tous')}>
          <Text style={[styles.filtreBtnText, filtreCategorie === 'tous' && { color: '#fff' }]}>Tous</Text>
        </TouchableOpacity>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c.cle}
            style={[styles.filtreBtn, filtreCategorie === c.cle && { backgroundColor: c.color, borderColor: c.color }]}
            onPress={() => setFiltreCategorie(c.cle)}>
            <Text style={[styles.filtreBtnText, filtreCategorie === c.cle && { color: '#fff' }]}>{c.icon} {c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading
        ? <ActivityIndicator size="large" color={COULEUR} style={{ marginTop: 40 }} />
        : <SectionList
            sections={sections}
            keyExtractor={item => item.ressource_id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderSectionHeader={({ section: { categorie, data } }) => (
              <View style={[styles.sectionHeader, { borderLeftColor: categorie.color }]}>
                <Text style={styles.sectionHeaderText}>{categorie.icon}  {categorie.label}</Text>
                <View style={[styles.sectionBadge, { backgroundColor: categorie.color }]}>
                  <Text style={styles.sectionBadgeText}>{data.length}</Text>
                </View>
              </View>
            )}
            renderItem={({ item }) => {
              const etat = ETAT_MAP[item.etat] || ETAT_MAP.bon;
              const dispo = item.quantite_disponible ?? item.quantite;
              return (
                <TouchableOpacity style={styles.card} onPress={() => setShowDetail(item)}>
                  <View style={styles.cardLeft}>
                    <Text style={{ fontSize: 28 }}>{CAT_MAP[item.categorie]?.icon || '📦'}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardNom}>{item.nom}</Text>
                    <Text style={styles.cardSub}>Qté : {dispo}/{item.quantite} disponibles</Text>
                    {item.valeur_achat > 0 && <Text style={styles.cardSub}>Valeur : {fcfa(item.valeur_achat)}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: etat.color }]}>
                      <Text style={styles.badgeText}>{etat.label}</Text>
                    </View>
                    <TouchableOpacity style={styles.btnMvt} onPress={() => setShowMvt(item)}>
                      <Text style={styles.btnMvtText}>+ Mouvement</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Aucune ressource trouvée</Text>}
          />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  FORMULAIRE AJOUT RESSOURCE
// ══════════════════════════════════════════════════════════════
function FormulaireRessource({ onBack, onSaved }) {
  const [form, setForm] = useState({
    categorie: 'chaises', nom: '', quantite: '1',
    valeur_achat: '', etat: 'bon', description: '',
  });
  const [dateAchat, setDateAchat] = useState(null); // Date object
  const [saving, setSaving] = useState(false);
  const [showPickerCat, setShowPickerCat]   = useState(false);
  const [showPickerEtat, setShowPickerEtat] = useState(false);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function enregistrer() {
    if (!form.nom.trim()) { Alert.alert('Champ requis', 'Nom de la ressource obligatoire'); return; }
    setSaving(true);

    const dateAchatStr = toSupabaseDate(dateAchat); // null si non renseigné

    const qte = parseInt(form.quantite) || 1;
    const valeur = parseInt(form.valeur_achat) || 0;

    const { data, error } = await supabase.from('ressource').insert({
      categorie:           form.categorie,
      nom:                 form.nom,
      quantite:            qte,
      quantite_disponible: qte,
      etat:                form.etat,
      valeur_achat:        valeur,
      date_achat:          dateAchatStr,
      description:         form.description || null,
    }).select().single();

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    // Si valeur > 0 → mouvement caisse automatique
    if (valeur > 0 && data) {
      await caisseRessources.achat(valeur, form.nom, data.ressource_id);
    }

    Alert.alert('✅ Ressource ajoutée !');
    onSaved();
    setSaving(false);
  }

  const catSel  = CAT_MAP[form.categorie];
  const etatSel = ETAT_MAP[form.etat];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle ressource</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        {/* Note intégration */}
        <View style={{ backgroundColor: '#E8F0FB', borderRadius: 10, padding: 12, marginBottom: 4 }}>
          <Text style={{ color: '#1A5276', fontSize: 13 }}>
            💡 Les chaises et couverts sont ajoutés automatiquement au stock à chaque paiement d'intégration (Fonds d'intégration).
          </Text>
        </View>

        <Text style={styles.label}>Catégorie *</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => setShowPickerCat(true)}>
          <Text style={styles.selectBtnText}>{catSel.icon}  {catSel.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Nom / Désignation *</Text>
        <TextInput style={styles.input} value={form.nom} onChangeText={v => set('nom', v)} placeholder="Ex: Chaises plastiques bleues, Assiettes creuses..." />

        <Text style={styles.label}>Quantité</Text>
        <TextInput style={styles.input} value={form.quantite} onChangeText={v => set('quantite', v)} keyboardType="numeric" placeholder="1" />

        <Text style={styles.label}>Valeur d'achat (FCFA)</Text>
        <TextInput style={styles.input} value={form.valeur_achat} onChangeText={v => set('valeur_achat', v)} keyboardType="numeric" placeholder="0" />

        <AjumyDatePicker
          label="Date d'achat"
          value={dateAchat}
          onChange={setDateAchat}
          maximumDate={new Date()}
          placeholder="Sélectionner la date d'achat"
        />

        <Text style={styles.label}>État</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => setShowPickerEtat(true)}>
          <Text style={[styles.selectBtnText, { color: etatSel.color }]}>{etatSel.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Description / Notes</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={form.description} onChangeText={v => set('description', v)}
          multiline placeholder="Informations complémentaires..." />

        <TouchableOpacity style={[styles.btnSave, { opacity: saving ? 0.5 : 1, marginTop: 24 }]} onPress={enregistrer} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>✅ Enregistrer</Text>}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal visible={showPickerCat} titre="Catégorie" items={CATEGORIES.map(c => ({ cle: c.cle, label: `${c.icon}  ${c.label}`, color: c.color }))}
        selected={form.categorie} onSelect={v => { set('categorie', v); setShowPickerCat(false); }} onClose={() => setShowPickerCat(false)} />
      <PickerModal visible={showPickerEtat} titre="État" items={ETATS.map(e => ({ cle: e.cle, label: e.label, color: e.color }))}
        selected={form.etat} onSelect={v => { set('etat', v); setShowPickerEtat(false); }} onClose={() => setShowPickerEtat(false)} />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  SAISIR MOUVEMENT (location, achat, réparation...)
// ══════════════════════════════════════════════════════════════
function SaisirMouvement({ ressource, onBack, onSaved }) {
  const [type, setType]             = useState('location_out');
  const [montant, setMontant]       = useState('');
  const [quantite, setQuantite]     = useState('1');
  const [beneficiaire, setBenef]    = useState('');
  const [libelle, setLibelle]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const mvtSel = MVT_TYPES.find(m => m.cle === type) || MVT_TYPES[0];

  async function enregistrer() {
    setSaving(true);
    const qte = parseInt(quantite) || 1;
    const mnt = parseInt(montant) || 0;
    const today = new Date().toISOString().split('T')[0];

    // Mise à jour quantité disponible
    let delta = 0;
    if (type === 'location_out') delta = -qte;
    else if (type === 'retour')  delta = +qte;
    else if (type === 'ajout_stock') delta = +qte;
    else if (type === 'reforme') delta = -qte;

    const nouvelleQteDispo = Math.max(0, (ressource.quantite_disponible || 0) + delta);
    const nouvelleQte      = type === 'ajout_stock' || type === 'achat'
      ? (ressource.quantite || 0) + qte
      : ressource.quantite;

    // Insertion mouvement
    const { data, error } = await supabase.from('mouvement_ressource').insert({
      ressource_id:   ressource.ressource_id,
      type_mouvement: type,
      libelle:        libelle || mvtSel.label,
      quantite:       qte,
      montant:        mnt,
      date_mouvement: today,
      beneficiaire:   beneficiaire || null,
    }).select().single();

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    // Mise à jour stock
    await supabase.from('ressource').update({
      quantite_disponible: nouvelleQteDispo,
      quantite: nouvelleQte,
    }).eq('ressource_id', ressource.ressource_id);

    // Mouvement caisse automatique
    // Règles : achat → dépense caisse | location → entrée caisse | réparation/rebut → pas de mouvement caisse
    if (mnt > 0) {
      if (type === 'achat') {
        await caisseRessources.achat(mnt, ressource.nom, data.mouvement_ressource_id);
      } else if (type === 'location_out') {
        await caisseRessources.location(mnt, ressource.nom, data.mouvement_ressource_id);
      }
      // reparation et reforme : pas de mouvement caisse
    }

    Alert.alert('✅ Mouvement enregistré !');
    onSaved();
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Mouvement</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        {/* Info ressource */}
        <View style={styles.ressourceInfoBox}>
          <Text style={styles.ressourceInfoIcon}>{CAT_MAP[ressource.categorie]?.icon || '📦'}</Text>
          <View>
            <Text style={styles.ressourceInfoNom}>{ressource.nom}</Text>
            <Text style={styles.ressourceInfoSub}>Disponibles : {ressource.quantite_disponible}/{ressource.quantite}</Text>
          </View>
        </View>

        <Text style={styles.label}>Type de mouvement</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.selectBtnText}>{mvtSel.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Quantité</Text>
        <TextInput style={styles.input} value={quantite} onChangeText={setQuantite} keyboardType="numeric" placeholder="1" />

        {(type === 'location_out') && (
          <>
            <Text style={styles.label}>Bénéficiaire</Text>
            <TextInput style={styles.input} value={beneficiaire} onChangeText={setBenef} placeholder="Nom de la personne / organisation" />
          </>
        )}

        {(type === 'achat' || type === 'reparation' || type === 'location_out') && (
          <>
            <Text style={styles.label}>
              {type === 'location_out' ? 'Montant location (FCFA)' : type === 'reparation' ? 'Coût réparation (FCFA)' : 'Coût achat (FCFA)'}
            </Text>
            <TextInput style={styles.input} value={montant} onChangeText={setMontant} keyboardType="numeric" placeholder="0" />
          </>
        )}

        <Text style={styles.label}>Note (optionnel)</Text>
        <TextInput style={styles.input} value={libelle} onChangeText={setLibelle} placeholder="Précision..." />

        {/* Avertissement caisse */}
        {parseInt(montant) > 0 && (type === 'achat' || type === 'location_out') && (
          <View style={styles.caisseAlert}>
            <Text style={styles.caisseAlertText}>
              {type === 'location_out' ? '💰 Entrée caisse' : '💸 Dépense caisse'} : {parseInt(montant).toLocaleString('fr-FR')} FCFA enregistrée automatiquement
            </Text>
          </View>
        )}
        {parseInt(montant) > 0 && type === 'reparation' && (
          <View style={[styles.caisseAlert, { borderLeftColor: '#888' }]}>
            <Text style={[styles.caisseAlertText, { color: '#888' }]}>
              ℹ️ Réparation : aucun mouvement caisse automatique
            </Text>
          </View>
        )}

        <TouchableOpacity style={[styles.btnSave, { opacity: saving ? 0.5 : 1, marginTop: 24 }]} onPress={enregistrer} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>✅ Confirmer</Text>}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal visible={showPicker} titre="Type de mouvement"
        items={MVT_TYPES.map(m => ({ cle: m.cle, label: m.label, color: '#1A5276' }))}
        selected={type} onSelect={v => { setType(v); setShowPicker(false); }} onClose={() => setShowPicker(false)} />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  DÉTAIL RESSOURCE + HISTORIQUE MOUVEMENTS
// ══════════════════════════════════════════════════════════════
function DetailRessource({ ressource, onBack, onUpdated, onMouvement }) {
  const [mouvements, setMouvements] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [etat, setEtat]             = useState(ressource.etat);
  const [showPickerEtat, setShowPickerEtat] = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => { loadMouvements(); }, []);

  async function loadMouvements() {
    const { data } = await supabase.from('mouvement_ressource')
      .select('*').eq('ressource_id', ressource.ressource_id)
      .order('date_mouvement', { ascending: false }).limit(20);
    setMouvements(data || []);
    setLoading(false);
  }

  async function sauvegarder() {
    setSaving(true);
    await supabase.from('ressource').update({ etat }).eq('ressource_id', ressource.ressource_id);
    Alert.alert('✅ Mis à jour');
    onUpdated();
    setSaving(false);
  }

  const etatSel = ETAT_MAP[etat];
  const cat     = CAT_MAP[ressource.categorie];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Fiche ressource</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        {/* En-tête */}
        <View style={styles.ficheHeader}>
          <Text style={{ fontSize: 48 }}>{cat?.icon || '📦'}</Text>
          <Text style={styles.ficheNom}>{ressource.nom}</Text>
          <View style={[styles.badge, { backgroundColor: cat?.color || '#888', alignSelf: 'center', marginTop: 4 }]}>
            <Text style={styles.badgeText}>{cat?.label}</Text>
          </View>
        </View>

        {/* Infos */}
        <View style={styles.ficheInfos}>
          <InfoLigne label="Quantité totale"    val={`${ressource.quantite}`} />
          <InfoLigne label="Disponibles"         val={`${ressource.quantite_disponible}`} />
          <InfoLigne label="Valeur d'achat"      val={ressource.valeur_achat > 0 ? fcfa(ressource.valeur_achat) : '—'} />
          <InfoLigne label="Date d'achat"        val={ressource.date_achat ? new Date(ressource.date_achat + 'T12:00:00').toLocaleDateString('fr-FR') : '—'} />
          {ressource.description ? <InfoLigne label="Notes" val={ressource.description} /> : null}
        </View>

        {/* État modifiable */}
        <Text style={styles.label}>État</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => setShowPickerEtat(true)}>
          <Text style={[styles.selectBtnText, { color: etatSel.color, fontWeight: 'bold' }]}>{etatSel.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <TouchableOpacity style={[styles.btnSave, { flex: 1, backgroundColor: '#1A5276', opacity: saving ? 0.5 : 1 }]} onPress={sauvegarder} disabled={saving}>
            <Text style={styles.btnSaveText}>💾 Sauvegarder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnSave, { flex: 1, backgroundColor: '#117A65' }]} onPress={() => onMouvement(ressource)}>
            <Text style={styles.btnSaveText}>+ Mouvement</Text>
          </TouchableOpacity>
        </View>

        {/* Historique */}
        <Text style={[styles.label, { marginTop: 24 }]}>📋 Historique des mouvements</Text>
        {loading
          ? <ActivityIndicator color={COULEUR} />
          : mouvements.length === 0
            ? <Text style={styles.empty}>Aucun mouvement</Text>
            : mouvements.map(m => (
                <View key={m.mouvement_ressource_id} style={styles.mvtCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mvtLabel}>{MVT_TYPES.find(t => t.cle === m.type_mouvement)?.label || m.type_mouvement}</Text>
                    {m.beneficiaire && <Text style={styles.mvtSub}>→ {m.beneficiaire}</Text>}
                    <Text style={styles.mvtDate}>{new Date(m.date_mouvement + 'T12:00:00').toLocaleDateString('fr-FR')} · Qté : {m.quantite}</Text>
                  </View>
                  {m.montant > 0 && (
                    <Text style={[styles.mvtMontant, { color: m.type_mouvement === 'location_out' ? '#1E7E34' : '#C00000' }]}>
                      {m.type_mouvement === 'location_out' ? '+' : '-'}{fcfa(m.montant)}
                    </Text>
                  )}
                </View>
              ))
        }
      </ScrollView>

      <PickerModal visible={showPickerEtat} titre="Changer l'état" items={ETATS.map(e => ({ cle: e.cle, label: e.label, color: e.color }))}
        selected={etat} onSelect={v => { setEtat(v); setShowPickerEtat(false); }} onClose={() => setShowPickerEtat(false)} />
    </View>
  );
}

// ── Composants réutilisables ──────────────────────────────────
function InfoLigne({ label, val }) {
  return (
    <View style={styles.infoLigne}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoVal}>{val}</Text>
    </View>
  );
}

function PickerModal({ visible, titre, items, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{titre}</Text>
          {items.map(item => (
            <TouchableOpacity key={item.cle}
              style={[styles.modalItem, selected === item.cle && { backgroundColor: item.color || COULEUR }]}
              onPress={() => onSelect(item.cle)}>
              <Text style={[styles.modalItemText, selected === item.cle && { color: '#fff' }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F0F4F8' },
  header:           { backgroundColor: COULEUR, padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:      { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backBtn:          { color: '#D6E4F0', fontSize: 14 },
  addBtn:           { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  statsRow:         { flexDirection: 'row', gap: 6, padding: 12, paddingBottom: 4 },
  statChip:         { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center' },
  statNum:          { fontSize: 16, fontWeight: 'bold', color: COULEUR },
  statLbl:          { fontSize: 10, color: '#888', marginTop: 2 },
  search:           { margin: 12, padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#D6E4F0' },
  filtreRow:        { paddingHorizontal: 12, paddingBottom: 8, gap: 8, alignItems: 'flex-start' },
  filtreBtn:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D6E4F0', alignSelf: 'flex-start' },
  filtreBtnActive:  { backgroundColor: COULEUR, borderColor: COULEUR },
  filtreBtnText:    { fontSize: 12, fontWeight: '600', color: COULEUR },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0F4F8', paddingHorizontal: 14, paddingVertical: 10, marginTop: 8, borderLeftWidth: 4 },
  sectionHeaderText:{ fontSize: 14, fontWeight: 'bold', color: '#1F3864', flex: 1 },
  sectionBadge:     { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  sectionBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  card:             { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 6, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  cardLeft:         { marginRight: 12 },
  cardBody:         { flex: 1 },
  cardNom:          { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  cardSub:          { fontSize: 12, color: '#888', marginTop: 2 },
  badge:            { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText:        { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  btnMvt:           { backgroundColor: '#E8F0FB', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  btnMvtText:       { color: COULEUR, fontSize: 11, fontWeight: 'bold' },
  empty:            { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
  label:            { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 14 },
  input:            { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 2 },
  selectBtn:        { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  selectBtnText:    { fontSize: 15, color: '#333' },
  btnSave:          { backgroundColor: COULEUR, borderRadius: 10, padding: 16, alignItems: 'center' },
  btnSaveText:      { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  ficheHeader:      { alignItems: 'center', marginBottom: 16 },
  ficheNom:         { fontSize: 20, fontWeight: 'bold', color: '#1F3864', textAlign: 'center', marginTop: 8 },
  ficheInfos:       { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  infoLigne:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel:        { fontSize: 13, color: '#888', flex: 1 },
  infoVal:          { fontSize: 13, fontWeight: '600', color: '#1F3864', flex: 2, textAlign: 'right' },
  ressourceInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F0FB', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  ressourceInfoIcon:{ fontSize: 32 },
  ressourceInfoNom: { fontSize: 16, fontWeight: 'bold', color: COULEUR },
  ressourceInfoSub: { fontSize: 13, color: '#666', marginTop: 2 },
  caisseAlert:      { backgroundColor: '#FFF9E6', borderRadius: 10, padding: 12, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#B7770D' },
  caisseAlertText:  { color: '#B7770D', fontSize: 13, fontWeight: '600' },
  mvtCard:          { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  mvtLabel:         { fontSize: 13, fontWeight: 'bold', color: '#1F3864' },
  mvtSub:           { fontSize: 12, color: '#666' },
  mvtDate:          { fontSize: 11, color: '#aaa', marginTop: 2 },
  mvtMontant:       { fontSize: 13, fontWeight: 'bold' },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:       { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 12 },
  modalItem:        { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8' },
  modalItemText:    { fontSize: 15, color: '#333' },
  modalClose:       { marginTop: 8, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText:   { color: '#666', fontWeight: 'bold' },
});