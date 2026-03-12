import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, TextInput
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import AvatarAdherent from '../components/AvatarAdherent';
//  HEADER
// ══════════════════════════════════════════════════════════════
function Header({ title, onBack, right }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backBtn}>← Retour</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 70, alignItems: 'flex-end' }}>{right || null}</View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  ÉCRAN PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function GrandeTontineScreen({ onBack }) {
  const { isBureau, peut } = useRole();
  const [vue, setVue] = useState('accueil');
  const [cycle, setCycle] = useState(null);
  const [entrees, setEntrees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCycleActif(); }, []);

  async function loadCycleActif() {
    setLoading(true);
    const { data } = await supabase
      .from('cycle_grande_tontine')
      .select('*')
      .eq('statut', 'actif')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setCycle(data);
      await loadEntrees(data.cycle_id);
    } else {
      setCycle(null);
      setEntrees([]);
    }
    setLoading(false);
  }

  async function loadEntrees(cycleId) {
    const { data } = await supabase
      .from('entree_grande_tontine')
      .select('*, adherents(nom, prenom, photo_url, statut)')
      .eq('cycle_id', cycleId)
      .eq('statut', 'actif')
      .order('position_ordre');
    setEntrees(data || []);
  }

  async function creerCycle() {
    const annee = new Date().getFullYear();
    const { data, error } = await supabase
      .from('cycle_grande_tontine')
      .insert({ nom: `Grande Tontine ${annee}`, date_debut: new Date().toISOString().split('T')[0] })
      .select().single();
    if (error) Alert.alert('Erreur', error.message);
    else { setCycle(data); setEntrees([]); }
  }

  if (loading) return (
    <View style={styles.container}>
      <Header title="🏆 Grande Tontine" onBack={onBack} />
      <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 60 }} />
    </View>
  );

  if (vue === 'seance') return (
    <SeanceScreen cycle={cycle} entrees={entrees}
      onBack={() => { setVue('accueil'); loadCycleActif(); }} />
  );
  if (vue === 'gestion') return (
    <GestionEntreesScreen cycle={cycle} entrees={entrees}
      onBack={() => { setVue('accueil'); loadCycleActif(); }} />
  );
  if (vue === 'historique') return (
    <HistoriqueScreen cycle={cycle} onBack={() => setVue('accueil')} />
  );

  // ── Accueil ──────────────────────────────────────────────
  const prochainBenef = entrees.find(e => !e.a_beneficie);
  const totalParticipants = entrees.length;
  const cagnotteEstimee = totalParticipants * 15000;

  return (
    <View style={styles.container}>
      <Header title="🏆 Grande Tontine" onBack={onBack}
        right={cycle ? (
          <TouchableOpacity onPress={() => setVue('historique')}>
            <Text style={styles.backBtn}>📋 Hist.</Text>
          </TouchableOpacity>
        ) : null}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {!cycle ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>Aucun cycle actif</Text>
            <Text style={styles.emptySub}>Créez un nouveau cycle pour commencer</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={creerCycle}>
              <Text style={styles.btnPrimaryText}>+ Créer un cycle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Carte cycle */}
            <View style={styles.cycleCard}>
              <Text style={styles.cycleNom}>{cycle.nom}</Text>
              <Text style={styles.cycleSub}>
                {totalParticipants} entrée(s) · Tour {cycle.nb_tours_ecoules || 0}
              </Text>
              <View style={styles.cycleStatsRow}>
                <View style={styles.cycleStat}>
                  <Text style={styles.cycleStatNum}>{totalParticipants}</Text>
                  <Text style={styles.cycleStatLabel}>Entrées</Text>
                </View>
                <View style={styles.cycleStat}>
                  <Text style={styles.cycleStatNum}>{cycle.nb_tours_ecoules || 0}</Text>
                  <Text style={styles.cycleStatLabel}>Tours passés</Text>
                </View>
                <View style={styles.cycleStat}>
                  <Text style={[styles.cycleStatNum, { color: '#C55A11' }]}>
                    {cagnotteEstimee.toLocaleString()}
                  </Text>
                  <Text style={styles.cycleStatLabel}>Cagnotte (F)</Text>
                </View>
              </View>
            </View>

            {/* Prochain bénéficiaire */}
            {prochainBenef && (
              <View style={styles.benefBox}>
                <Text style={styles.benefLabel}>🏆 Prochain bénéficiaire</Text>
                <Text style={styles.benefName}>{prochainBenef.nom_tontine}</Text>
                <Text style={styles.benefSub}>
                  {prochainBenef.adherents.nom} {prochainBenef.adherents.prenom}
                  {prochainBenef.complement_requis > 0
                    ? ` · Complément requis : ${prochainBenef.complement_requis.toLocaleString()} FCFA`
                    : ' · Pas de complément'}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.btnPrimary} onPress={() => setVue('seance')}>
              <Text style={styles.btnPrimaryText}>✅ Séance du dimanche</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setVue('gestion')}>
              <Text style={styles.btnSecondaryText}>👥 Gérer entrées & ordre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={creerCycle}>
              <Text style={styles.btnSecondaryText}>🔄 Nouveau cycle</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  SÉANCE DU DIMANCHE
// ══════════════════════════════════════════════════════════════
function SeanceScreen({ cycle, entrees, onBack }) {
  const [cotisations, setCotisations] = useState({});
  const [benefEntree, setBenefEntree] = useState(null);
  const [completeurs, setCompleteurs] = useState([]); // [{adherent_id, nom, montant}]
  const [showBenefModal, setShowBenefModal] = useState(false);
  const [showCompleteurModal, setShowCompleteurModal] = useState(false);
  const [adherents, setAdherents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [resume, setResume] = useState(null);
  const [dateDimanche] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? 0 : (7 - day));
    return new Date(today.setDate(diff)).toISOString().split('T')[0];
  });

  useEffect(() => {
    const init = {};
    entrees.forEach(e => { init[e.entree_id] = 'paye'; });
    setCotisations(init);
    const prochain = entrees.find(e => !e.a_beneficie);
    if (prochain) setBenefEntree(prochain);
    loadAdherents();
  }, []);

  async function loadAdherents() {
    const { data } = await supabase
      .from('adherents').select('adherent_id, nom, prenom, photo_url, statut')
      .in('statut', ['actif', 'en_observation']).order('nom');
    setAdherents(data || []);
  }

  function toggleCotisation(entreeId) {
    setCotisations(prev => ({
      ...prev,
      [entreeId]: prev[entreeId] === 'paye' ? 'echec' : 'paye'
    }));
  }

  const nbPayes = Object.values(cotisations).filter(v => v === 'paye').length;
  const totalCollecte = entrees.reduce((sum, e) => {
    return sum + (cotisations[e.entree_id] === 'paye' ? e.niveau_cotisation : 0);
  }, 0);
  const totalCagnotte = entrees.length * 15000; // théorique

  async function verifierEtSaisirDettes(adherentId, montantBenefice) {
    const { data: dettes } = await supabase
      .from('dettes')
      .select('*')
      .eq('adherent_id', adherentId)
      .in('statut', ['en_cours', 'partiellement_rembourse'])
      .order('date_creation', { ascending: true });

    if (!dettes || dettes.length === 0) {
      return { totalDette: 0, montantSaisi: 0, montantVerse: montantBenefice };
    }

    const totalDette = dettes.reduce((s, d) => s + (d.montant_restant || 0), 0);
    const montantSaisi = Math.min(totalDette, montantBenefice);
    const montantVerse = montantBenefice - montantSaisi;

    let resteSaisie = montantSaisi;
    for (const dette of dettes) {
      if (resteSaisie <= 0) break;
      const remboursement = Math.min(resteSaisie, dette.montant_restant);
      const nouveauRembourse = (dette.montant_rembourse || 0) + remboursement;
      const nouveauRestant = dette.montant_initial - nouveauRembourse;
      await supabase.from('dettes').update({
        montant_rembourse: nouveauRembourse,
        statut: nouveauRestant <= 0 ? 'solde' : 'partiellement_rembourse',
      }).eq('dette_id', dette.dette_id);
      await supabase.from('saisie').insert({
        dette_id: dette.dette_id,
        adherent_id: adherentId,
        date_saisie: new Date().toISOString().split('T')[0],
        type_saisie: 2, // grande_tontine
        montant_tontine_saisi: remboursement,
        montant_impute_dette: remboursement,
        dette_restante_apres_saisie: nouveauRestant,
        recouvrement_reste_en_cours: nouveauRestant > 0,
        statut: 'execute',
        notifie_adherent: false,
      });
      resteSaisie -= remboursement;
    }
    const { data: dettesRestantes } = await supabase
      .from('dettes').select('dette_id').eq('adherent_id', adherentId)
      .in('statut', ['en_cours', 'partiellement_rembourse']);
    await supabase.from('adherents')
      .update({ nb_dettes_en_cours: (dettesRestantes || []).length })
      .eq('adherent_id', adherentId);

    return { totalDette, montantSaisi, montantVerse };
  }

  async function enregistrer() {
    if (!benefEntree) { Alert.alert('Bénéficiaire requis', 'Sélectionnez le bénéficiaire du jour.'); return; }

    // Vérifier que les compléteurs couvrent bien le complément requis
    if (benefEntree.complement_requis > 0) {
      const totalComplement = completeurs.reduce((s, c) => s + c.montant, 0);
      if (totalComplement < benefEntree.complement_requis) {
        Alert.alert(
          'Complément insuffisant',
          `Le bénéficiaire nécessite ${benefEntree.complement_requis.toLocaleString()} FCFA de complément.\nActuellement couvert : ${totalComplement.toLocaleString()} FCFA`
        );
        return;
      }
    }

    setSaving(true);
    const numeroTour = (cycle.nb_tours_ecoules || 0) + 1;

    const lignes = entrees.map(e => ({
      cycle_id: cycle.cycle_id,
      entree_id: e.entree_id,
      adherent_id: e.adherent_id,
      date_dimanche: dateDimanche,
      numero_tour: numeroTour,
      montant_theorique: e.niveau_cotisation,
      montant_paye: cotisations[e.entree_id] === 'paye' ? e.niveau_cotisation : 0,
      est_complement: false,
      beneficiaire_entree_id: benefEntree.entree_id,
      a_deja_beneficie: e.a_beneficie,
      statut: cotisations[e.entree_id] === 'paye' ? 'paye' : 'echec',
    }));

    // Lignes compléteurs
    const lignesCompleteurs = completeurs.map(c => ({
      cycle_id: cycle.cycle_id,
      entree_id: benefEntree.entree_id,
      adherent_id: c.adherent_id,
      date_dimanche: dateDimanche,
      numero_tour: numeroTour,
      montant_theorique: c.montant,
      montant_paye: c.montant,
      montant_complement_paye: c.montant,
      est_complement: true,
      beneficiaire_entree_id: benefEntree.entree_id,
      statut: 'paye',
    }));

    const { error } = await supabase.from('cotisation_grande_tontine').insert([...lignes, ...lignesCompleteurs]);
    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return; }

    await supabase.from('cycle_grande_tontine').update({ nb_tours_ecoules: numeroTour }).eq('cycle_id', cycle.cycle_id);
    await supabase.from('entree_grande_tontine').update({ a_beneficie: true, date_benefice: dateDimanche }).eq('entree_id', benefEntree.entree_id);

    const montantReel = totalCollecte + completeurs.reduce((s, c) => s + c.montant, 0);
    const saisie = await verifierEtSaisirDettes(benefEntree.adherent_id, montantReel);
    setResume({ date: dateDimanche, numeroTour, nbPayes, totalCollecte, montantReel, montantVerse: saisie.montantVerse, montantSaisi: saisie.montantSaisi, totalDette: saisie.totalDette, benefEntree, completeurs });
    setSaving(false);
  }

  // ── Résumé ───────────────────────────────────────────────
  if (resume) return (
    <View style={styles.container}>
      <Header title="📋 Résumé séance" onBack={onBack} />
      <ScrollView style={{ padding: 16 }}>
        <View style={[styles.cycleCard, { backgroundColor: '#C55A11' }]}>
          <Text style={[styles.cycleNom, { color: '#fff' }]}>✅ Séance enregistrée !</Text>
          <Text style={{ color: '#FFE0CC', marginTop: 4 }}>
            Tour #{resume.numeroTour} · {new Date(resume.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <View style={styles.statsGrid}>
          {[
            { n: resume.nbPayes, l: 'Payeurs' },
            { n: resume.totalCollecte.toLocaleString(), l: 'Collecté (F)' },
            { n: resume.completeurs.length, l: 'Compléteurs' },
            { n: resume.montantReel.toLocaleString(), l: 'Versé bénéf. (F)' },
          ].map((s, i) => (
            <View key={i} style={styles.statBox}>
              <Text style={styles.statNumber}>{s.n}</Text>
              <Text style={styles.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>
        <View style={styles.benefBox}>
          <Text style={styles.benefLabel}>🏆 Bénéficiaire</Text>
          <Text style={styles.benefName}>{resume.benefEntree.nom_tontine}</Text>
          <Text style={[styles.benefSub, { fontSize: 18, color: '#C55A11', marginTop: 4 }]}>
            {(resume.montantVerse ?? resume.montantReel).toLocaleString()} FCFA versés
          </Text>
          {resume.completeurs.length > 0 && (
            <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              dont {resume.completeurs.reduce((s, c) => s + c.montant, 0).toLocaleString()} FCFA de complément
            </Text>
          )}
        </View>
        {resume.montantSaisi > 0 && (
          <View style={styles.saisiBox}>
            <Text style={styles.saisiTitre}>⚠️ Saisie pour remboursement de dette</Text>
            <View style={styles.saisiRow}>
              <Text style={styles.saisiLabel}>Bénéfice brut</Text>
              <Text style={styles.saisiVal}>{resume.montantReel.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.saisiRow}>
              <Text style={styles.saisiLabel}>Saisi (dette)</Text>
              <Text style={[styles.saisiVal, { color: '#C00000' }]}>− {resume.montantSaisi.toLocaleString()} FCFA</Text>
            </View>
            <View style={[styles.saisiRow, { borderTopWidth: 2, borderTopColor: '#C55A11', marginTop: 4 }]}>
              <Text style={[styles.saisiLabel, { fontWeight: 'bold' }]}>Versé au bénéficiaire</Text>
              <Text style={[styles.saisiVal, { color: '#1E7E34', fontWeight: 'bold' }]}>{resume.montantVerse.toLocaleString()} FCFA</Text>
            </View>
          </View>
        )}
        <TouchableOpacity style={styles.btnPrimary} onPress={onBack}>
          <Text style={styles.btnPrimaryText}>✅ Terminer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ── Saisie ───────────────────────────────────────────────
  const totalComplement = completeurs.reduce((s, c) => s + c.montant, 0);
  const complementManquant = benefEntree ? Math.max(0, benefEntree.complement_requis - totalComplement) : 0;

  return (
    <View style={styles.container}>
      <Header title="✅ Séance GT" onBack={onBack} />

      <View style={styles.counter}>
        <Text style={styles.counterDate}>
          {new Date(dateDimanche + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · Tour #'}{(cycle.nb_tours_ecoules || 0) + 1}
        </Text>
        <View style={styles.counterRow}>
          <View style={styles.counterItem}>
            <Text style={styles.counterNum}>{nbPayes}</Text>
            <Text style={styles.counterLabel}>Payeurs</Text>
          </View>
          <View style={styles.counterItem}>
            <Text style={styles.counterNum}>{entrees.length - nbPayes}</Text>
            <Text style={styles.counterLabel}>Absents</Text>
          </View>
          <View style={[styles.counterItem, { borderRightWidth: 0 }]}>
            <Text style={[styles.counterNum, { color: '#FFD700' }]}>{totalCollecte.toLocaleString()}</Text>
            <Text style={styles.counterLabel}>Collecté (F)</Text>
          </View>
        </View>
      </View>

      {/* Bénéficiaire */}
      <TouchableOpacity style={styles.benefSelectBtn} onPress={() => setShowBenefModal(true)}>
        {benefEntree
          ? <View style={{ flex: 1 }}>
              <Text style={styles.benefSelectText}>🏆 <Text style={{ fontWeight: 'bold' }}>{benefEntree.nom_tontine}</Text></Text>
              <Text style={{ fontSize: 12, color: '#888' }}>
                Cotise {benefEntree.niveau_cotisation.toLocaleString()} F · Complément : {benefEntree.complement_requis.toLocaleString()} F
              </Text>
            </View>
          : <Text style={styles.benefSelectPlaceholder}>👆 Choisir le bénéficiaire</Text>
        }
        <Text>✏️</Text>
      </TouchableOpacity>

      {/* Compléteurs (si nécessaire) */}
      {benefEntree && benefEntree.complement_requis > 0 && (
        <View style={styles.completeurBox}>
          <View style={styles.completeurHeader}>
            <Text style={styles.completeurTitle}>
              🤝 Compléteurs — {totalComplement.toLocaleString()} / {benefEntree.complement_requis.toLocaleString()} FCFA
            </Text>
            <TouchableOpacity style={styles.btnAjouterComp} onPress={() => setShowCompleteurModal(true)}>
              <Text style={styles.btnAjouterCompText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          {complementManquant > 0 && (
            <Text style={styles.complementWarning}>⚠️ Manque encore {complementManquant.toLocaleString()} FCFA</Text>
          )}
          {completeurs.map((c, i) => (
            <View key={i} style={styles.completeurRow}>
              <Text style={styles.completeurNom}>{c.nom}</Text>
              <Text style={styles.completeurMontant}>{c.montant.toLocaleString()} F</Text>
              <TouchableOpacity onPress={() => setCompleteurs(prev => prev.filter((_, idx) => idx !== i))}>
                <Text style={{ color: '#C00000', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Légende */}
      <View style={styles.legende}>
        <View style={styles.legendeItem}>
          <View style={[styles.legendeDot, { backgroundColor: '#C55A11' }]} />
          <Text style={styles.legendeText}>Payé</Text>
        </View>
        <View style={styles.legendeItem}>
          <View style={[styles.legendeDot, { backgroundColor: '#ddd' }]} />
          <Text style={styles.legendeText}>Absent</Text>
        </View>
      </View>

      <FlatList
        data={entrees}
        keyExtractor={e => e.entree_id}
        renderItem={({ item }) => {
          const paye = cotisations[item.entree_id] === 'paye';
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: paye ? '#FFF3E0' : '#fff', borderLeftColor: paye ? '#C55A11' : 'transparent' }]}
              onPress={() => toggleCotisation(item.entree_id)}
            >
              <View style={[styles.statutDot, { backgroundColor: paye ? '#C55A11' : '#ddd' }]}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{paye ? '✓' : ''}</Text>
              </View>
              <AvatarAdherent
                nom={item.adherents.nom} prenom={item.adherents.prenom}
                photoUrl={item.adherents.photo_url} statut={item.adherents.statut}
                size={34} style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, paye && { fontWeight: 'bold', color: '#1F3864' }]}>
                  {item.nom_tontine}
                </Text>
                <Text style={styles.cardSub}>
                  {item.adherents.nom} {item.adherents.prenom}
                </Text>
              </View>
              <Text style={{ color: paye ? '#C55A11' : '#bbb', fontWeight: 'bold', fontSize: 13 }}>
                {paye ? `${item.niveau_cotisation.toLocaleString()} F` : 'Absent'}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={[styles.btnPrimary, { margin: 16, opacity: (!benefEntree || saving) ? 0.5 : 1 }]}
        onPress={enregistrer} disabled={!benefEntree || saving}
      >
        {saving ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnPrimaryText}>💾 Enregistrer — {totalCollecte.toLocaleString()} FCFA collectés</Text>
        }
      </TouchableOpacity>

      {/* Modal bénéficiaire */}
      <Modal visible={showBenefModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🏆 Choisir le bénéficiaire</Text>
            <FlatList
              data={entrees.filter(e => !e.a_beneficie)}
              keyExtractor={e => e.entree_id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, benefEntree?.entree_id === item.entree_id && styles.modalItemSelected]}
                  onPress={() => { setBenefEntree(item); setCompleteurs([]); setShowBenefModal(false); }}
                >
                  <AvatarAdherent
                    nom={item.adherents.nom} prenom={item.adherents.prenom}
                    photoUrl={item.adherents.photo_url} statut={item.adherents.statut}
                    size={32} style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemText, benefEntree?.entree_id === item.entree_id && { color: '#fff', fontWeight: 'bold' }]}>
                      #{item.position_ordre} · {item.nom_tontine}
                    </Text>
                    <Text style={{ fontSize: 12, color: benefEntree?.entree_id === item.entree_id ? '#FFE0CC' : '#888' }}>
                      {item.adherents.nom} {item.adherents.prenom} · {item.niveau_cotisation.toLocaleString()} F/dim
                      {item.complement_requis > 0 ? ` · Complément: ${item.complement_requis.toLocaleString()} F` : ''}
                    </Text>
                  </View>
                  {benefEntree?.entree_id === item.entree_id && <Text style={{ color: '#fff' }}>✓</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Tous ont déjà bénéficié.</Text>}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowBenefModal(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal compléteur */}
      {showCompleteurModal && (
        <CompleteurModal
          adherents={adherents}
          complementManquant={complementManquant}
          onAdd={(c) => { setCompleteurs(prev => [...prev, c]); setShowCompleteurModal(false); }}
          onClose={() => setShowCompleteurModal(false)}
        />
      )}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
//  MODAL COMPLÉTEUR
// ──────────────────────────────────────────────────────────────
function CompleteurModal({ adherents, complementManquant, onAdd, onClose }) {
  const [selected, setSelected] = useState(null);
  const [montant, setMontant] = useState(complementManquant.toString());

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>🤝 Ajouter un compléteur</Text>
          <Text style={styles.modalSub}>Manque : {complementManquant.toLocaleString()} FCFA</Text>

          <Text style={styles.inputLabel}>Montant apporté (FCFA)</Text>
          <TextInput
            style={styles.input}
            value={montant}
            onChangeText={setMontant}
            keyboardType="numeric"
            placeholder="Ex: 5000"
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Choisir l'adhérent</Text>
          <FlatList
            data={adherents}
            keyExtractor={a => a.adherent_id}
            style={{ maxHeight: 260 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, selected?.adherent_id === item.adherent_id && styles.modalItemSelected]}
                onPress={() => setSelected(item)}
              >
                <Text style={[styles.modalItemText, selected?.adherent_id === item.adherent_id && { color: '#fff', fontWeight: 'bold' }]}>
                  {item.nom} {item.prenom}
                </Text>
                {selected?.adherent_id === item.adherent_id && <Text style={{ color: '#fff' }}>✓</Text>}
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            style={[styles.btnPrimary, { opacity: (!selected || !montant) ? 0.5 : 1, marginTop: 12 }]}
            disabled={!selected || !montant}
            onPress={() => onAdd({
              adherent_id: selected.adherent_id,
              nom: `${selected.nom} ${selected.prenom}`,
              montant: parseInt(montant) || 0,
            })}
          >
            <Text style={styles.btnPrimaryText}>✅ Confirmer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
//  GESTION DES ENTRÉES
// ══════════════════════════════════════════════════════════════
function GestionEntreesScreen({ cycle, entrees: initEntrees, onBack }) {
  const [entrees, setEntrees] = useState(initEntrees);
  const [adherents, setAdherents] = useState([]);
  const [showAjout, setShowAjout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ adherent_id: null, nom_tontine: '', niveau_cotisation: '15000' });
  const [selectedAdherent, setSelectedAdherent] = useState(null);
  const [showAdherentPicker, setShowAdherentPicker] = useState(false);

  useEffect(() => { loadAdherents(); }, []);

  async function loadAdherents() {
    const { data } = await supabase
      .from('adherents').select('adherent_id, nom, prenom, photo_url, statut')
      .in('statut', ['actif', 'en_observation']).order('nom');
    setAdherents(data || []);
  }

  async function reload() {
    setLoading(true);
    const { data } = await supabase
      .from('entree_grande_tontine')
      .select('*, adherents(nom, prenom, photo_url, statut)')
      .eq('cycle_id', cycle.cycle_id)
      .eq('statut', 'actif')
      .order('position_ordre');
    setEntrees(data || []);
    setLoading(false);
  }

  async function ajouterEntree() {
    if (!selectedAdherent || !form.nom_tontine || !form.niveau_cotisation) {
      Alert.alert('Champs manquants', 'Remplissez tous les champs.');
      return;
    }
    const niveau = parseInt(form.niveau_cotisation);
    if (isNaN(niveau) || niveau <= 0) { Alert.alert('Erreur', 'Montant invalide.'); return; }
    if (niveau > 15000) { Alert.alert('Erreur', 'Le niveau ne peut pas dépasser 15 000 FCFA.'); return; }

    setSaving(true);
    const { error } = await supabase.from('entree_grande_tontine').insert({
      cycle_id: cycle.cycle_id,
      adherent_id: selectedAdherent.adherent_id,
      nom_tontine: form.nom_tontine,
      niveau_cotisation: niveau,
      position_ordre: entrees.length + 1,
    });
    if (error) Alert.alert('Erreur', error.message);
    else {
      setShowAjout(false);
      setForm({ adherent_id: null, nom_tontine: '', niveau_cotisation: '15000' });
      setSelectedAdherent(null);
      reload();
    }
    setSaving(false);
  }

  async function changerPosition(entree, direction) {
    const newPos = entree.position_ordre + direction;
    if (newPos < 1 || newPos > entrees.length) return;
    const autre = entrees.find(e => e.position_ordre === newPos);
    if (!autre) return;
    await Promise.all([
      supabase.from('entree_grande_tontine').update({ position_ordre: newPos }).eq('entree_id', entree.entree_id),
      supabase.from('entree_grande_tontine').update({ position_ordre: entree.position_ordre }).eq('entree_id', autre.entree_id),
    ]);
    reload();
  }

  return (
    <View style={styles.container}>
      <Header title="👥 Entrées Tontine" onBack={onBack} />
      <View style={styles.infoBand}>
        <Text style={styles.infoBandText}>
          {cycle.nom} · {entrees.length} entrée(s) · Tour {cycle.nb_tours_ecoules || 0}
        </Text>
      </View>

      {loading
        ? <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 40 }} />
        : <FlatList
            data={entrees}
            keyExtractor={e => e.entree_id}
            contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.partCard}>
                <View style={styles.partOrdre}>
                  <TouchableOpacity onPress={() => changerPosition(item, -1)}>
                    <Text style={styles.arrowBtn}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.partNum}>#{item.position_ordre}</Text>
                  <TouchableOpacity onPress={() => changerPosition(item, 1)}>
                    <Text style={styles.arrowBtn}>▼</Text>
                  </TouchableOpacity>
                </View>
                <AvatarAdherent
                  nom={item.adherents.nom} prenom={item.adherents.prenom}
                  photoUrl={item.adherents.photo_url} statut={item.adherents.statut}
                  size={38} style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.partName}>{item.nom_tontine}</Text>
                  <Text style={styles.partSub}>{item.adherents.nom} {item.adherents.prenom}</Text>
                  <View style={styles.niveauRow}>
                    <View style={[styles.niveauBadge, { backgroundColor: item.niveau_cotisation === 15000 ? '#C55A11' : '#2E75B6' }]}>
                      <Text style={styles.niveauBadgeText}>{item.niveau_cotisation.toLocaleString()} F/dim</Text>
                    </View>
                    {item.complement_requis > 0 && (
                      <Text style={styles.complementNote}>+{item.complement_requis.toLocaleString()} F complément</Text>
                    )}
                  </View>
                  {item.a_beneficie && <Text style={styles.tagBeneficie}>✅ A bénéficié le {new Date(item.date_benefice + 'T12:00:00').toLocaleDateString('fr-FR')}</Text>}
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Aucune entrée. Ajoutez-en ci-dessous.</Text>}
          />
      }

      <TouchableOpacity style={[styles.btnPrimary, { margin: 16 }]} onPress={() => setShowAjout(true)}>
        <Text style={styles.btnPrimaryText}>+ Ajouter une entrée</Text>
      </TouchableOpacity>

      {/* Modal ajout */}
      <Modal visible={showAjout} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>+ Nouvelle entrée tontine</Text>

            <Text style={styles.inputLabel}>Adhérent *</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowAdherentPicker(true)}>
              <Text style={{ color: selectedAdherent ? '#333' : '#aaa' }}>
                {selectedAdherent ? `${selectedAdherent.nom} ${selectedAdherent.prenom}` : 'Sélectionner un adhérent'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Nom de la tontine *</Text>
            <TextInput
              style={styles.input}
              value={form.nom_tontine}
              onChangeText={v => setForm({ ...form, nom_tontine: v })}
              placeholder="Ex: David 1, Marie 2..."
            />

            <Text style={styles.inputLabel}>Niveau de cotisation (FCFA) *</Text>
            <TextInput
              style={styles.input}
              value={form.niveau_cotisation}
              onChangeText={v => setForm({ ...form, niveau_cotisation: v })}
              keyboardType="numeric"
              placeholder="Ex: 15000, 10000, 7500, 5000..."
            />
            {parseInt(form.niveau_cotisation) < 15000 && parseInt(form.niveau_cotisation) > 0 && (
              <Text style={{ color: '#C55A11', fontSize: 12, marginTop: 4 }}>
                ℹ️ Complément requis lors du tour : {(15000 - parseInt(form.niveau_cotisation)).toLocaleString()} FCFA
              </Text>
            )}

            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 16, opacity: saving ? 0.5 : 1 }]}
              onPress={ajouterEntree} disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>✅ Enregistrer</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowAjout(false)}>
              <Text style={styles.modalCloseText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Picker adhérent */}
      <Modal visible={showAdherentPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choisir un adhérent</Text>
            <FlatList
              data={adherents}
              keyExtractor={a => a.adherent_id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, selectedAdherent?.adherent_id === item.adherent_id && styles.modalItemSelected]}
                  onPress={() => {
                    setSelectedAdherent(item);
                    setForm(f => ({ ...f, nom_tontine: `${item.nom} 1` }));
                    setShowAdherentPicker(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedAdherent?.adherent_id === item.adherent_id && { color: '#fff' }]}>
                    {item.nom} {item.prenom}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowAdherentPicker(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE
// ══════════════════════════════════════════════════════════════
function HistoriqueScreen({ cycle, onBack }) {
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    if (!cycle) { setLoading(false); return; }
    const { data } = await supabase
      .from('cotisation_grande_tontine')
      .select('*, entree:entree_grande_tontine!cotisation_grande_tontine_entree_id_fkey(nom_tontine, niveau_cotisation), benef:entree_grande_tontine!cotisation_grande_tontine_beneficiaire_entree_id_fkey(nom_tontine)')
      .eq('cycle_id', cycle.cycle_id)
      .eq('est_complement', false)
      .order('date_dimanche', { ascending: false });
    setHistorique(data || []);
    setLoading(false);
  }

  const dates = [...new Set(historique.map(h => h.date_dimanche))];

  return (
    <View style={styles.container}>
      <Header title="📋 Historique GT" onBack={onBack} />
      {loading
        ? <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 40 }} />
        : <FlatList
            data={dates}
            keyExtractor={d => d}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item: date }) => {
              const lignes = historique.filter(h => h.date_dimanche === date);
              const collecte = lignes.reduce((s, l) => s + (l.montant_paye || 0), 0);
              const benef = lignes[0]?.benef;
              const nbEchecs = lignes.filter(l => l.statut === 'echec').length;
              const tour = lignes[0]?.numero_tour;
              return (
                <View style={styles.histCard}>
                  <View style={styles.histHeader}>
                    <Text style={styles.histDate}>
                      Tour #{tour} · {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                    <Text style={styles.histTotal}>{collecte.toLocaleString()} F</Text>
                  </View>
                  {benef && <Text style={styles.histBenef}>🏆 {benef.nom_tontine}</Text>}
                  {nbEchecs > 0 && <Text style={styles.histDette}>⚠️ {nbEchecs} impayé(s)</Text>}
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Aucun historique</Text>}
          />
      }
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  header: {
    backgroundColor: '#C55A11', padding: 16, paddingTop: 40,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn: { color: '#FFE0CC', fontSize: 14 },

  emptyBox: { alignItems: 'center', marginTop: 60, padding: 20 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F3864', marginBottom: 8 },
  emptySub: { color: '#888', marginBottom: 24, textAlign: 'center' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },

  cycleCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 3 },
  cycleNom: { fontSize: 16, fontWeight: 'bold', color: '#1F3864', marginBottom: 4 },
  cycleSub: { color: '#888', fontSize: 13, marginBottom: 12 },
  cycleStatsRow: { flexDirection: 'row' },
  cycleStat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f0f0f0' },
  cycleStatNum: { fontSize: 20, fontWeight: 'bold', color: '#1F3864' },
  cycleStatLabel: { fontSize: 11, color: '#888', marginTop: 2 },

  benefBox: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2, alignItems: 'center', borderWidth: 2, borderColor: '#C55A11' },
  benefLabel: { color: '#C55A11', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  benefName: { fontSize: 18, fontWeight: 'bold', color: '#1F3864' },
  benefSub: { color: '#888', fontSize: 13, marginTop: 2, textAlign: 'center' },

  btnPrimary: { backgroundColor: '#C55A11', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnSecondary: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#D6E4F0' },
  btnSecondaryText: { color: '#1F3864', fontSize: 15, fontWeight: '600' },

  counter: { backgroundColor: '#C55A11', paddingHorizontal: 16, paddingBottom: 12 },
  counterDate: { color: '#FFE0CC', fontSize: 12, textAlign: 'center', marginBottom: 8, textTransform: 'capitalize' },
  counterRow: { flexDirection: 'row' },
  counterItem: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  counterNum: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  counterLabel: { color: '#FFE0CC', fontSize: 11, marginTop: 2 },

  benefSelectBtn: { backgroundColor: '#fff', margin: 12, marginBottom: 4, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#C55A11', elevation: 2 },
  benefSelectText: { flex: 1, color: '#333', fontSize: 14 },
  benefSelectPlaceholder: { flex: 1, color: '#aaa', fontSize: 14, fontStyle: 'italic' },

  completeurBox: { backgroundColor: '#FFF3E0', marginHorizontal: 12, marginBottom: 4, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#C55A11' },
  completeurHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  completeurTitle: { fontSize: 13, fontWeight: 'bold', color: '#C55A11', flex: 1 },
  btnAjouterComp: { backgroundColor: '#C55A11', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnAjouterCompText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  complementWarning: { color: '#C00000', fontSize: 12, marginBottom: 6, fontStyle: 'italic' },
  completeurRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#FFD0A0' },
  completeurNom: { flex: 1, fontSize: 14, color: '#333' },
  completeurMontant: { color: '#C55A11', fontWeight: 'bold', marginRight: 12, fontSize: 13 },

  legende: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 8, gap: 16 },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendeDot: { width: 22, height: 22, borderRadius: 6 },
  legendeText: { fontSize: 12, color: '#666' },

  card: { backgroundColor: '#fff', margin: 4, marginHorizontal: 12, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', elevation: 1, borderLeftWidth: 4 },
  statutDot: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardName: { fontSize: 15, color: '#333' },
  cardSub: { fontSize: 12, color: '#888', marginTop: 2 },

  infoBand: { backgroundColor: '#FFF3E0', padding: 10, alignItems: 'center' },
  infoBandText: { color: '#C55A11', fontWeight: 'bold', fontSize: 13 },

  partCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  partOrdre: { alignItems: 'center', marginRight: 12, width: 36 },
  partNum: { fontSize: 16, fontWeight: 'bold', color: '#1F3864', marginVertical: 2 },
  arrowBtn: { color: '#C55A11', fontSize: 16, paddingVertical: 2 },
  partName: { fontSize: 15, fontWeight: 'bold', color: '#1F3864' },
  partSub: { fontSize: 12, color: '#888', marginTop: 2 },
  niveauRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  niveauBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  niveauBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  complementNote: { fontSize: 11, color: '#C55A11' },
  tagBeneficie: { fontSize: 11, color: '#1E7E34', marginTop: 4 },

  inputLabel: { fontSize: 13, fontWeight: '600', color: '#1F3864', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  statBox: { width: '48%', margin: '1%', backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2 },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#1F3864' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F3864', marginBottom: 4 },
  modalSub: { color: '#C55A11', fontWeight: 'bold', marginBottom: 16 },
  modalItem: { padding: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#F0F4F8', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalItemSelected: { backgroundColor: '#C55A11' },
  modalItemText: { fontSize: 15, color: '#333' },
  modalClose: { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: '#F0F4F8', alignItems: 'center' },
  modalCloseText: { color: '#666', fontWeight: 'bold' },

  histCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  histDate: { fontSize: 13, color: '#1F3864', fontWeight: 'bold', flex: 1 },
  histTotal: { fontSize: 14, fontWeight: 'bold', color: '#C55A11' },
  histBenef: { fontSize: 13, color: '#C55A11', marginTop: 6 },
  histDette: { fontSize: 12, color: '#C00000', marginTop: 4 },
  saisiBox: { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#C55A11' },
  saisiTitre: { fontSize: 14, fontWeight: 'bold', color: '#C55A11', marginBottom: 10 },
  saisiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#FFD0A0' },
  saisiLabel: { color: '#666', fontSize: 14 },
  saisiVal: { fontSize: 14, fontWeight: '600', color: '#333' },
});