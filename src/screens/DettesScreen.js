import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import { caisseDettes, caisseIntegration } from '../lib/caisse';
import AvatarAdherent from '../components/AvatarAdherent';

// ── Constantes ────────────────────────────────────────────────
const SEUIL_BLOCAGE = 100000; // > 100 000 FCFA → accès modules bloqué

const FONDS_INTEGRATION = [
  { cle: 'fond_caisse',   label: 'Fond de caisse',         montant: 20000, obligatoire: true  },
  { cle: 'fonds_maladie', label: 'Fonds maladie/malheur',  montant: 25000, obligatoire: true  },
  { cle: 'chaise',        label: 'Chaise',                  montant: 5000,  obligatoire: true  },
  { cle: 'couverts',      label: 'Couverts',                montant: 10000, obligatoire: true  },
  { cle: 'projet',        label: 'Projet (optionnel)',       montant: 40000, obligatoire: false },
];
// Obligatoire : fond_caisse+fonds_maladie+chaise+couverts = 42 000 FCFA
const TOTAL_INTEGRATION       = FONDS_INTEGRATION.reduce((s, f) => s + f.montant, 0);
const TOTAL_INTEGRATION_OBLIG = FONDS_INTEGRATION.filter(f => f.obligatoire).reduce((s, f) => s + f.montant, 0);

const TYPES_DETTE = {
  absence_reunion:          { label: 'Absence réunion',                  icon: '🏠', color: '#C55A11' },
  cotisation_roulement:     { label: 'Cotisation roulement',             icon: '🔄', color: '#7030A0' },
  sanction_vente:           { label: 'Sanction vente banque',            icon: '🏦', color: '#C00000' },
  sanction_roulement:       { label: 'Sanction roulement',               icon: '🔄', color: '#7030A0' },
  sanction_huile_savon:     { label: 'Sanction huile/savon',             icon: '🧴', color: '#2E75B6' },
  sanction_grande_tontine:  { label: 'Sanction grande tontine',          icon: '🏆', color: '#1F7A4D' },
  retour_attendu:           { label: 'Retour attendu',                   icon: '↩️', color: '#833C00' },
  non_paiement_solidarite:  { label: 'Non-paiement collecte solidarité', icon: '🤝', color: '#1F3864' },
  retard_aide_solidarite:   { label: 'Retard aide solidarité',           icon: '🤝', color: '#C00000' },
  retard:                   { label: 'Retard de paiement',               icon: '⏰', color: '#C55A11' },
  sanction_speciale:        { label: 'Sanction spéciale',                icon: '⚠️', color: '#C00000' },
  fonds_integration:        { label: 'Fonds intégration',                icon: '🆕', color: '#1F7A4D' },
  manuel:                   { label: 'Autre (manuel)',                    icon: '📝', color: '#666'    },
};

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
//  ACCUEIL DETTES
// ══════════════════════════════════════════════════════════════
export default function DettesScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [vue, setVue]       = useState('accueil');
  const [stats, setStats]   = useState({ totalDu: 0, nbDebiteurs: 0, nbBloques: 0, nbDettes: 0 });
  const [loading, setLoading] = useState(true);
  const [parAdh, setParAdh]   = useState({});

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    const { data } = await supabase
      .from('dettes').select('adherent_id, montant_restant').eq('statut', 'en_cours');
    const totalDu  = (data || []).reduce((s, d) => s + d.montant_restant, 0);
    const nbDettes = (data || []).length;
    const map = {};
    (data || []).forEach(d => { map[d.adherent_id] = (map[d.adherent_id] || 0) + d.montant_restant; });
    const nbDebiteurs = Object.keys(map).length;
    const nbBloques   = Object.values(map).filter(t => t > SEUIL_BLOCAGE).length;
    setStats({ totalDu, nbDebiteurs, nbBloques, nbDettes });
    setParAdh(map);
    setLoading(false);
  }

  if (vue === 'liste')        return <ListeDettesScreen      onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'ajouter')      return <AjouterDetteScreen     onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'integration')  return <IntegrationScreen      onBack={() => { setVue('accueil'); loadStats(); }} />;
  if (vue === 'historique')   return <HistoriqueDettesScreen onBack={() => setVue('accueil')} />;

  return (
    <View style={styles.container}>
      <Header title="⚠️ Dettes" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {loading ? <ActivityIndicator color="#C00000" style={{ marginTop: 20 }} /> : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: '#C00000' }]}>
              <Text style={[styles.statCardNum, { color: '#C00000' }]}>{stats.totalDu.toLocaleString()}</Text>
              <Text style={styles.statCardLabel}>Total dû{'\n'}(FCFA)</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#C55A11' }]}>
              <Text style={styles.statCardNum}>{stats.nbDebiteurs}</Text>
              <Text style={styles.statCardLabel}>Débiteurs{'\n'}actifs</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#7B0000' }]}>
              <Text style={[styles.statCardNum, { color: stats.nbBloques > 0 ? '#C00000' : '#1F3864' }]}>{stats.nbBloques}</Text>
              <Text style={styles.statCardLabel}>Bloqués{'\n'}(+{(SEUIL_BLOCAGE / 1000)}k)</Text>
            </View>
          </View>
        )}

        {stats.nbBloques > 0 && (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>🚫 {stats.nbBloques} adhérent(s) bloqué(s) — total dettes &gt; {SEUIL_BLOCAGE.toLocaleString()} FCFA</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setVue('liste')}>
          <Text style={styles.btnPrimaryText}>📋 Voir toutes les dettes ({stats.nbDettes})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('ajouter')}>
          <Text style={styles.btnSecondaryText}>➕ Ajouter une dette manuellement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('integration')}>
          <Text style={styles.btnSecondaryText}>🆕 Fonds d'intégration (chaise, couverts...)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('historique')}>
          <Text style={styles.btnSecondaryText}>📜 Historique remboursements</Text>
        </TouchableOpacity>

        <View style={styles.reglesBox}>
          <Text style={styles.reglesTitre}>📌 Règles</Text>
          <Text style={styles.regle}>• Blocage modules si total dettes &gt; {SEUIL_BLOCAGE.toLocaleString()} FCFA</Text>
          <Text style={styles.regle}>• Fonds intégration non payés → pas d'accès à la solidarité</Text>
          <Text style={styles.regle}>• Remboursement partiel autorisé</Text>
          <Text style={styles.regle}>• Intégration obligatoire : fond caisse 2k + maladie 25k + chaise 5k + couverts 10k = {TOTAL_INTEGRATION_OBLIG.toLocaleString()} FCFA{' · '}Projet 40k (optionnel)</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  LISTE DES DETTES PAR ADHÉRENT
// ══════════════════════════════════════════════════════════════
function ListeDettesScreen({ onBack }) {
  const [adherents, setAdherents]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);  // adhérent sélectionné pour détail
  const [dettesAdh, setDettesAdh]   = useState([]);
  const [loadingDettes, setLoadingDettes] = useState(false);
  const [showRemboursement, setShowRemboursement] = useState(null); // dette à rembourser

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // Récupérer tous les adhérents avec dettes en cours
    const { data: dettes } = await supabase
      .from('dettes')
      .select('adherent_id, montant_restant, adherents(nom, prenom, photo_url, statut)')
      .eq('statut', 'en_cours');

    // Regrouper par adhérent
    const map = {};
    (dettes || []).forEach(d => {
      const id = d.adherent_id;
      if (!map[id]) map[id] = { adherent_id: id, nom: d.adherents?.nom, prenom: d.adherents?.prenom, total: 0, nb: 0 };
      map[id].total += d.montant_restant;
      map[id].nb++;
    });
    const liste = Object.values(map).sort((a, b) => b.total - a.total);
    setAdherents(liste);
    setLoading(false);
  }

  async function selectAdherent(adh) {
    setSelected(adh);
    setLoadingDettes(true);
    const { data } = await supabase
      .from('dettes')
      .select('*')
      .eq('adherent_id', adh.adherent_id)
      .eq('statut', 'en_cours')
      .order('date_creation', { ascending: true });
    setDettesAdh(data || []);
    setLoadingDettes(false);
  }

  async function rembourser(dette, montantPartiel) {
    const montant = parseInt(montantPartiel);
    if (!montant || montant <= 0) { Alert.alert('Montant invalide'); return; }
    if (montant > dette.montant_restant) { Alert.alert('Montant supérieur à la dette restante'); return; }

    const today         = new Date().toISOString().split('T')[0];
    const resteApres       = dette.montant_restant - montant;
    const dejaRembourse    = (dette.montant_rembourse || 0) + montant;
    const nouveauStatut    = resteApres === 0 ? 'solde' : 'partiellement_rembourse';

    // Mise à jour de la dette
    await supabase.from('dettes').update({
      montant_restant:  resteApres,
      montant_rembourse: dejaRembourse,
      statut:            nouveauStatut,
      date_solde:        nouveauStatut === 'solde' ? today : null,
    }).eq('dette_id', dette.dette_id);

    // Log remboursement
    await supabase.from('remboursement_dette').insert({
      dette_id:       dette.dette_id,
      adherent_id:    dette.adherent_id,
      montant:        montant,
      date_paiement:  today,
      mode_paiement:  'especes',
    });
    // Caisse automatique
    await caisseDettes.remboursement(montant, dette.dette_id, dette.adherent_id);

    // Mettre à jour nb_dettes_en_cours sur l'adhérent si soldée
    if (nouveauStatut === 'solde') {
      const { data: adh } = await supabase.from('adherents')
        .select('nb_dettes_en_cours').eq('adherent_id', dette.adherent_id).single();
      await supabase.from('adherents')
        .update({ nb_dettes_en_cours: Math.max(0, (adh?.nb_dettes_en_cours || 1) - 1) })
        .eq('adherent_id', dette.adherent_id);
    }

    Alert.alert('✅ Remboursement enregistré',
      resteApres === 0
        ? 'Dette entièrement soldée !'
        : `Reste : ${resteApres.toLocaleString()} FCFA`);
    setShowRemboursement(null);
    selectAdherent(selected);
    load();
  }

  // ── Vue détail d'un adhérent ──
  if (selected) {
    const bloque = selected.total > SEUIL_BLOCAGE;
    return (
      <View style={styles.container}>
        <Header title={`${selected.nom} ${selected.prenom}`} onBack={() => setSelected(null)} />
        <View style={[styles.fondsBand, { backgroundColor: bloque ? '#FFEBEE' : '#FFF8E1' }]}>
          <Text style={[styles.fondsBandText, { color: bloque ? '#C00000' : '#C55A11' }]}>
            {bloque ? '🚫 BLOQUÉ · ' : ''}Total dû : {selected.total.toLocaleString()} FCFA · {selected.nb} dette(s)
          </Text>
        </View>
        {loadingDettes ? <ActivityIndicator color="#C00000" style={{ marginTop: 30 }} /> :
          <FlatList data={dettesAdh} keyExtractor={d => d.dette_id}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => {
              const t = TYPES_DETTE[item.type_dette] || TYPES_DETTE.manuel;
              return (
                <View style={[styles.detteCard, { borderLeftColor: t.color }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detteType}>{t.icon} {t.label}</Text>
                    <Text style={styles.detteSub}>
                      Créée le {new Date(item.date_creation + 'T12:00:00').toLocaleDateString('fr-FR')}
                    </Text>
                    {item.description ? <Text style={styles.detteDesc}>{item.description}</Text> : null}
                    <View style={styles.detteAmounts}>
                      <Text style={styles.detteInitial}>Initial : {item.montant_initial.toLocaleString()} FCFA</Text>
                      <Text style={[styles.detteRestant, { color: t.color }]}>Reste : {item.montant_restant.toLocaleString()} FCFA</Text>
                    </View>
                    {item.montant_initial !== item.montant_restant && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, {
                          width: `${Math.round((1 - item.montant_restant / item.montant_initial) * 100)}%`,
                          backgroundColor: t.color
                        }]} />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.btnRembourserDette}
                    onPress={() => setShowRemboursement(item)}>
                    <Text style={styles.btnRembourserDetteText}>💰{'\n'}Payer</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Aucune dette en cours.</Text>}
          />
        }

        {/* Modal remboursement */}
        <ModalRemboursement
          visible={!!showRemboursement}
          dette={showRemboursement}
          onClose={() => setShowRemboursement(null)}
          onConfirm={rembourser}
        />
      </View>
    );
  }

  // ── Vue liste des débiteurs ──
  return (
    <View style={styles.container}>
      <Header title="📋 Débiteurs actifs" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#C00000" style={{ marginTop: 40 }} /> :
        <FlatList data={adherents} keyExtractor={a => a.adherent_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const bloque = item.total > SEUIL_BLOCAGE;
            return (
              <TouchableOpacity style={[styles.adherentCard, bloque && styles.adherentCardBloque]}
                onPress={() => selectAdherent(item)}>
                <AvatarAdherent
                  nom={item.nom} prenom={item.prenom}
                  photoUrl={item.photo_url} statut={item.statut}
                  size={40} style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {bloque && <Text style={styles.bloqueBadge}>🚫 BLOQUÉ</Text>}
                    <Text style={styles.adherentNom}>{item.nom} {item.prenom}</Text>
                  </View>
                  <Text style={styles.adherentSub}>{item.nb} dette(s) en cours</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.adherentTotal, { color: bloque ? '#C00000' : '#C55A11' }]}>
                    {item.total.toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#888' }}>FCFA →</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>✅ Aucune dette en cours.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  MODAL REMBOURSEMENT
// ══════════════════════════════════════════════════════════════
function ModalRemboursement({ visible, dette, onClose, onConfirm }) {
  const [montant, setMontant] = useState('');
  const t = dette ? (TYPES_DETTE[dette.type_dette] || TYPES_DETTE.manuel) : null;

  useEffect(() => {
    if (dette) setMontant(String(dette.montant_restant));
  }, [dette]);

  if (!dette) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>💰 Remboursement</Text>
          <Text style={{ color: '#555', marginBottom: 4 }}>{t?.icon} {t?.label}</Text>
          <Text style={{ color: '#888', marginBottom: 16 }}>Dette restante : {dette.montant_restant.toLocaleString()} FCFA</Text>

          <Text style={styles.inputLabel}>Montant payé (FCFA)</Text>
          <TextInput
            style={styles.input}
            value={montant}
            onChangeText={setMontant}
            keyboardType="numeric"
            placeholder="Montant"
          />

          <View style={styles.quickBtns}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setMontant(String(dette.montant_restant))}>
              <Text style={styles.quickBtnText}>Tout ({dette.montant_restant.toLocaleString()})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setMontant(String(Math.floor(dette.montant_restant / 2)))}>
              <Text style={styles.quickBtnText}>Moitié</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.demandeBtns}>
            <TouchableOpacity style={styles.btnApprouver} onPress={() => onConfirm(dette, montant)}>
              <Text style={styles.btnApprouverText}>✅ Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnRejeter} onPress={onClose}>
              <Text style={styles.btnRejeterText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
//  AJOUTER UNE DETTE MANUELLEMENT
// ══════════════════════════════════════════════════════════════
function AjouterDetteScreen({ onBack }) {
  const [adherents, setAdherents]   = useState([]);
  const [selectedAdh, setSelectedAdh] = useState(null);
  const [typeDette, setTypeDette]   = useState('manuel');
  const [montant, setMontant]       = useState('');
  const [description, setDescription] = useState('');
  const [showPickerAdh, setShowPickerAdh] = useState(false);
  const [showPickerType, setShowPickerType] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  useEffect(() => { loadAdherents(); }, []);

  async function loadAdherents() {
    const { data } = await supabase.from('adherents')
      .select('adherent_id, nom, prenom, photo_url, statut').in('statut', ['actif', 'en_observation']).order('nom');
    setAdherents(data || []);
    setLoading(false);
  }

  async function enregistrer() {
    if (!selectedAdh) { Alert.alert('Sélectionnez un adhérent'); return; }
    if (!montant || parseInt(montant) <= 0) { Alert.alert('Montant invalide'); return; }
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const m     = parseInt(montant);

    const { error } = await supabase.from('dettes').insert({
      adherent_id:      selectedAdh.adherent_id,
      type_dette:       typeDette,
      montant:          m,
      montant_initial:  m,
      montant_rembourse: 0,
      montant_restant:  m,
      description:      description || null,
      date_creation:    today,
      statut:           'en_cours',
    });

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    // Mettre à jour nb_dettes_en_cours
    const { data: adh } = await supabase.from('adherents')
      .select('nb_dettes_en_cours').eq('adherent_id', selectedAdh.adherent_id).single();
    await supabase.from('adherents')
      .update({ nb_dettes_en_cours: (adh?.nb_dettes_en_cours || 0) + 1 })
      .eq('adherent_id', selectedAdh.adherent_id);

    Alert.alert('✅ Dette enregistrée');
    onBack();
    setSaving(false);
  }

  const t = TYPES_DETTE[typeDette];

  return (
    <View style={styles.container}>
      <Header title="➕ Ajouter une dette" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        <Text style={styles.inputLabel}>Adhérent *</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPickerAdh(true)}>
          <Text style={{ color: selectedAdh ? '#333' : '#aaa' }}>
            {selectedAdh ? `${selectedAdh.nom} ${selectedAdh.prenom}` : 'Sélectionner...'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Type de dette *</Text>
        <TouchableOpacity style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          onPress={() => setShowPickerType(true)}>
          <Text style={{ color: '#333' }}>{t?.icon} {t?.label}</Text>
          <Text style={{ color: '#aaa' }}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Montant (FCFA) *</Text>
        <TextInput style={styles.input} value={montant} onChangeText={setMontant}
          keyboardType="numeric" placeholder="Ex: 5000" />

        <Text style={styles.inputLabel}>Description (optionnel)</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={description} onChangeText={setDescription}
          placeholder="Précisions..." multiline />

        <TouchableOpacity style={[styles.btnPrimary, { opacity: saving ? 0.5 : 1, marginTop: 16 }]}
          onPress={enregistrer} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> :
            <Text style={styles.btnPrimaryText}>💾 Enregistrer la dette</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Picker adhérent */}
      <Modal visible={showPickerAdh} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choisir un adhérent</Text>
            {loading ? <ActivityIndicator color="#C00000" /> :
              <FlatList data={adherents} keyExtractor={a => a.adherent_id} style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.modalItem, selectedAdh?.adherent_id === item.adherent_id && styles.modalItemActive]}
                    onPress={() => { setSelectedAdh(item); setShowPickerAdh(false); }}>
                    <AvatarAdherent
                      nom={item.nom} prenom={item.prenom}
                      photoUrl={item.photo_url} statut={item.statut}
                      size={30} style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.modalItemText, selectedAdh?.adherent_id === item.adherent_id && { color: '#fff' }]}>
                      {item.nom} {item.prenom}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            }
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPickerAdh(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Picker type de dette */}
      <Modal visible={showPickerType} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Type de dette</Text>
            <FlatList data={Object.entries(TYPES_DETTE)} keyExtractor={([k]) => k} style={{ maxHeight: 450 }}
              renderItem={({ item: [key, val] }) => (
                <TouchableOpacity
                  style={[styles.modalItem, typeDette === key && styles.modalItemActive, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                  onPress={() => { setTypeDette(key); setShowPickerType(false); }}>
                  <Text style={{ fontSize: 18 }}>{val.icon}</Text>
                  <Text style={[styles.modalItemText, typeDette === key && { color: '#fff' }]}>{val.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowPickerType(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  FONDS D'INTÉGRATION
//  Nouveaux adhérents (après 6 mois) + anciens non encore payé
//  Bloque l'accès à la solidarité si non payé
// ══════════════════════════════════════════════════════════════
function IntegrationScreen({ onBack }) {
  const [adherents, setAdherents]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [paiements, setPaiements]   = useState({});
  const [saving, setSaving]         = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // Tous les adhérents non-observation
    const { data: adhs } = await supabase.from('adherents')
      .select('adherent_id, nom, prenom, photo_url, statut, date_adhesion')
      .in('statut', ['actif']).order('nom');

    // Paiements intégration déjà enregistrés
    const { data: paiementsDB } = await supabase
      .from('paiement_integration').select('*');

    const mapPaiements = {};
    (paiementsDB || []).forEach(p => {
      if (!mapPaiements[p.adherent_id]) mapPaiements[p.adherent_id] = {};
      mapPaiements[p.adherent_id][p.element] = p.montant_paye;
    });

    // Calculer le total payé / restant par adhérent
    const liste = (adhs || []).map(a => {
      const payes  = mapPaiements[a.adherent_id] || {};
      const totalPaye = FONDS_INTEGRATION.reduce((s, f) => s + (payes[f.cle] || 0), 0);
      const resteTotal = TOTAL_INTEGRATION - totalPaye;
      return { ...a, payes, totalPaye, resteTotal };
    });

    setAdherents(liste);
    setPaiements(mapPaiements);
    setLoading(false);
  }

  async function enregistrerPaiement(adh, cle, montantStr) {
    const montant = parseInt(montantStr);
    const elem    = FONDS_INTEGRATION.find(f => f.cle === cle);
    if (!montant || montant <= 0 || !elem) return;

    const dejaPayé = adh.payes[cle] || 0;
    const restElem = elem.montant - dejaPayé;
    if (montant > restElem) {
      Alert.alert('Montant trop élevé', `Reste à payer pour ${elem.label} : ${restElem.toLocaleString()} FCFA`);
      return;
    }

    setSaving(true);
    const today     = new Date().toISOString().split('T')[0];
    const nouveauTotal = dejaPayé + montant;
    const solde     = nouveauTotal >= elem.montant;

    // Upsert paiement intégration
    const { data: exist } = await supabase.from('paiement_integration')
      .select('paiement_id, montant_paye').eq('adherent_id', adh.adherent_id).eq('element', cle).single().catch(() => ({ data: null }));

    if (exist) {
      await supabase.from('paiement_integration').update({
        montant_paye: nouveauTotal,
        date_solde:   solde ? today : null,
        statut:       solde ? 'solde' : 'partiel',
      }).eq('paiement_id', exist.paiement_id);
    } else {
      await supabase.from('paiement_integration').insert({
        adherent_id:  adh.adherent_id,
        element:      cle,
        montant_total: elem.montant,
        montant_paye: montant,
        date_premier: today,
        date_solde:   solde ? today : null,
        statut:       solde ? 'solde' : 'partiel',
      });
    }

    // Caisse automatique intégration
    await caisseIntegration.paiement(montant, elem.label, adh.adherent_id, adh.adherent_id);

    // Si chaise ou couverts soldés → ajout automatique au stock ressources
    if (solde && (cle === 'chaise' || cle === 'couverts')) {
      await ajouterStockIntegration(cle, adh.adherent_id);
    }

    Alert.alert('✅ Paiement enregistré',
      solde ? `${elem.label} entièrement payé !` : `Reste : ${(elem.montant - nouveauTotal).toLocaleString()} FCFA`);
    setSelected(null);
    load();
    setSaving(false);
  }

  async function ajouterStockIntegration(cle, adherentId) {
    // Chercher la ressource principale chaise ou couverts
    const nomRessource = cle === 'chaise' ? 'Chaises' : 'Couverts / Vaisselle';
    const categorie    = cle === 'chaise' ? 'chaises' : 'couverts';
    const { data: ressources } = await supabase.from('ressource')
      .select('ressource_id, quantite, quantite_disponible')
      .eq('categorie', categorie).order('created_at').limit(1);

    if (ressources && ressources.length > 0) {
      const r = ressources[0];
      await supabase.from('ressource').update({
        quantite:            r.quantite + 1,
        quantite_disponible: r.quantite_disponible + 1,
      }).eq('ressource_id', r.ressource_id);
      await supabase.from('mouvement_ressource').insert({
        ressource_id:   r.ressource_id,
        type_mouvement: 'ajout_stock',
        libelle:        `Intégration adhérent`,
        quantite:       1,
        montant:        0,
        date_mouvement: new Date().toISOString().split('T')[0],
        beneficiaire:   adherentId,
      });
    } else {
      // Créer la ressource si elle n'existe pas encore
      await supabase.from('ressource').insert({
        categorie,
        nom:                 nomRessource,
        quantite:            1,
        quantite_disponible: 1,
        etat:                'bon',
        valeur_achat:        cle === 'chaise' ? 5000 : 10000,
        date_achat:          new Date().toISOString().split('T')[0],
        description:         'Créé automatiquement depuis intégration adhérent',
      });
    }
  }

  // ── Vue détail d'un adhérent ──
  if (selected) {
    return (
      <View style={styles.container}>
        <Header title={`🆕 ${selected.nom} ${selected.prenom}`} onBack={() => setSelected(null)} />
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={[styles.fondsBand, { backgroundColor: selected.resteTotal > 0 ? '#FFF3E0' : '#E8F5E9', marginBottom: 12 }]}>
            <Text style={[styles.fondsBandText, { color: selected.resteTotal > 0 ? '#C55A11' : '#1E7E34' }]}>
              {selected.resteTotal > 0
                ? `Reste à payer : ${selected.resteTotal.toLocaleString()} FCFA`
                : '✅ Intégration complète'}
            </Text>
            {selected.resteTotal > 0 && (
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>⚠️ Accès solidarité bloqué tant que non soldé</Text>
            )}
          </View>

          {FONDS_INTEGRATION.map(elem => {
            const dejaPayé = selected.payes[elem.cle] || 0;
            const reste    = elem.montant - dejaPayé;
            const solde    = reste === 0;
            return (
              <IntegrationElem key={elem.cle} elem={elem} dejaPayé={dejaPayé} reste={reste} solde={solde}
                onPayer={(montant) => enregistrerPaiement(selected, elem.cle, montant)} saving={saving} />
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── Vue liste adhérents ──
  return (
    <View style={styles.container}>
      <Header title="🆕 Fonds d'intégration" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#C00000" style={{ marginTop: 40 }} /> :
        <FlatList data={adherents} keyExtractor={a => a.adherent_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const pct  = Math.round((item.totalPaye / TOTAL_INTEGRATION) * 100);
            const ok   = item.resteTotal === 0;
            return (
              <TouchableOpacity style={[styles.integCard, ok && styles.integCardOk]} onPress={() => setSelected(item)}>
                <AvatarAdherent
                  nom={item.nom} prenom={item.prenom}
                  photoUrl={item.photo_url} statut={item.statut}
                  size={38} style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adherentNom}>{item.nom} {item.prenom}</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: ok ? '#1E7E34' : '#C55A11' }]} />
                  </View>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    {item.totalPaye.toLocaleString()} / {TOTAL_INTEGRATION.toLocaleString()} FCFA ({pct}%)
                  </Text>
                </View>
                <Text style={{ fontSize: 20, marginLeft: 12 }}>{ok ? '✅' : '⏳'}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun adhérent actif.</Text>}
        />
      }
    </View>
  );
}

function IntegrationElem({ elem, dejaPayé, reste, solde, onPayer, saving }) {
  const [montant, setMontant] = useState(String(reste));
  return (
    <View style={[styles.detteCard, { borderLeftColor: solde ? '#1E7E34' : '#C55A11', marginBottom: 12 }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.detteType}>{elem.label}</Text>
          {!elem.obligatoire && <Text style={styles.optionnelBadge}>Optionnel</Text>}
        </View>
        <View style={styles.detteAmounts}>
          <Text style={styles.detteInitial}>Total : {elem.montant.toLocaleString()} FCFA</Text>
          <Text style={[styles.detteRestant, { color: solde ? '#1E7E34' : '#C55A11' }]}>
            {solde ? '✅ Soldé' : `Reste : ${reste.toLocaleString()} FCFA`}
          </Text>
        </View>
        {!solde && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={montant} onChangeText={setMontant}
              keyboardType="numeric" placeholder="Montant" />
            <TouchableOpacity style={[styles.btnApprouver, { paddingVertical: 12, paddingHorizontal: 14 }]}
              onPress={() => onPayer(montant)} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> :
                <Text style={styles.btnApprouverText}>💰 Payer</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE REMBOURSEMENTS
// ══════════════════════════════════════════════════════════════
function HistoriqueDettesScreen({ onBack }) {
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('remboursement_dette')
      .select('*, dette(type_dette, description), adherents(nom, prenom, photo_url, statut)')
      .order('date_paiement', { ascending: false })
      .limit(100);
    setHistorique(data || []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Header title="📜 Historique remboursements" onBack={onBack} />
      {loading ? <ActivityIndicator size="large" color="#C00000" style={{ marginTop: 40 }} /> :
        <FlatList data={historique} keyExtractor={h => h.remboursement_id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const t = TYPES_DETTE[item.dette?.type_dette] || TYPES_DETTE.manuel;
            return (
              <View style={styles.historiqueCard}>
                <AvatarAdherent
                  nom={item.adherents?.nom} prenom={item.adherents?.prenom}
                  photoUrl={item.adherents?.photo_url} statut={item.adherents?.statut}
                  size={38} style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adherentNom}>{item.adherents?.nom} {item.adherents?.prenom}</Text>
                  <Text style={styles.adherentSub}>{t.icon} {t.label}</Text>
                  <Text style={{ fontSize: 12, color: '#888' }}>
                    {new Date(item.date_paiement + 'T12:00:00').toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <Text style={[styles.adherentTotal, { color: '#1E7E34' }]}>
                  +{item.montant.toLocaleString()}
                  {'\n'}<Text style={{ fontSize: 11, color: '#888' }}>FCFA</Text>
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun remboursement enregistré.</Text>}
        />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#F0F4F8' },
  header:               { backgroundColor: '#8B0000', padding: 16, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:          { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:              { color: '#FFCDD2', fontSize: 14 },
  statsRow:             { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:             { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderTopWidth: 4 },
  statCardNum:          { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  statCardLabel:        { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' },
  alertBox:             { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#C00000' },
  alertText:            { color: '#C00000', fontWeight: 'bold', fontSize: 13 },
  btnPrimary:           { backgroundColor: '#8B0000', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText:       { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText:     { color: '#1F3864', fontSize: 15, fontWeight: '600' },
  reglesBox:            { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, marginTop: 4, borderLeftWidth: 4, borderLeftColor: '#8B0000' },
  reglesTitre:          { fontSize: 13, fontWeight: 'bold', color: '#8B0000', marginBottom: 8 },
  regle:                { fontSize: 12, color: '#555', marginBottom: 4 },
  fondsBand:            { backgroundColor: '#FFEBEE', padding: 10, alignItems: 'center' },
  fondsBandText:        { fontSize: 14, fontWeight: 'bold', color: '#C00000', textAlign: 'center' },
  adherentCard:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  adherentCardBloque:   { borderLeftWidth: 4, borderLeftColor: '#C00000', backgroundColor: '#FFF5F5' },
  adherentNom:          { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  adherentSub:          { fontSize: 12, color: '#888', marginTop: 2 },
  adherentTotal:        { fontSize: 18, fontWeight: 'bold', color: '#C55A11', textAlign: 'right' },
  bloqueBadge:          { backgroundColor: '#C00000', color: '#fff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  detteCard:            { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', elevation: 1, borderLeftWidth: 4 },
  detteType:            { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  detteSub:             { fontSize: 12, color: '#888', marginTop: 2 },
  detteDesc:            { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  detteAmounts:         { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  detteInitial:         { fontSize: 13, color: '#888' },
  detteRestant:         { fontSize: 14, fontWeight: 'bold' },
  progressBar:          { height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill:         { height: '100%', borderRadius: 3 },
  btnRembourserDette:   { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#1E7E34', alignItems: 'center', marginLeft: 10 },
  btnRembourserDetteText: { color: '#1E7E34', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  integCard:            { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  integCardOk:          { borderLeftWidth: 4, borderLeftColor: '#1E7E34' },
  historiqueCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  inputLabel:           { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 12 },
  input:                { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 4 },
  quickBtns:            { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 },
  quickBtn:             { flex: 1, backgroundColor: '#F0F4F8', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#D6E4F0' },
  quickBtnText:         { fontSize: 13, color: '#1F3864', fontWeight: '600' },
  demandeBtns:          { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnApprouver:         { flex: 1, backgroundColor: '#1E7E34', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnApprouverText:     { color: '#fff', fontWeight: 'bold' },
  btnRejeter:           { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C00000' },
  btnRejeterText:       { color: '#C00000', fontWeight: 'bold' },
  modalOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:             { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle:           { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 12 },
  modalItem:            { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8' },
  modalItemActive:      { backgroundColor: '#8B0000' },
  modalItemText:        { fontSize: 15, color: '#333' },
  modalClose:           { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText:       { color: '#666', fontWeight: 'bold' },
  empty:                { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
  optionnelBadge:       { backgroundColor: '#E8F4FD', color: '#2E75B6', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
});