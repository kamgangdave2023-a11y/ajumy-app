import { supabase } from './supabase';

// ══════════════════════════════════════════════════════════════
//  UTILITAIRE CAISSE — appelé par tous les modules
//  Enregistre un mouvement en temps réel dans mouvement_caisse
// ══════════════════════════════════════════════════════════════

/**
 * Enregistre un mouvement de caisse automatiquement
 * @param {Object} params
 * @param {'entree'|'sortie'|'depense'} params.type       - Type de mouvement
 * @param {string} params.source     - Clé rubrique (ex: 'cotis_presence', 'frais_vente'...)
 * @param {string} params.libelle    - Description lisible
 * @param {number} params.montant    - Montant en FCFA
 * @param {string} [params.ref_id]   - ID de référence (session, vente, roulement...)
 * @param {string} [params.module]   - Nom du module source
 * @param {string} [params.adherent_id] - Adhérent concerné (optionnel)
 */
export async function enregistrerMouvementCaisse({
  type, source, libelle, montant, ref_id = null, module = null, adherent_id = null
}) {
  if (!montant || montant <= 0) return { error: 'Montant invalide' };

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase.from('mouvement_caisse').insert({
    type_mouvement: type,   // entree | sortie | depense
    source,                 // rubrique métier
    libelle,
    montant,
    date_mouvement: today,
    ref_id,
    module,
    adherent_id,
    automatique: true,      // distingue des entrées manuelles
  });

  if (error) console.error('[Caisse]', error.message);
  return { data, error };
}

// ── Sources prédéfinies par module ────────────────────────────

// PRÉSENCE
export const caissePresence = {
  cotisation:  (montant, refId) => enregistrerMouvementCaisse({ type: 'entree',  source: 'retour_presence',      libelle: 'Cotisation présence',         montant, ref_id: refId, module: 'presence' }),
  supplement:  (montant, refId) => enregistrerMouvementCaisse({ type: 'entree',  source: 'supplement_presence',  libelle: 'Supplément présence',         montant, ref_id: refId, module: 'presence' }),
};

// BANQUE
export const caisseBanque = {
  depotOrdinaire: (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'banque_ordinaire', libelle: 'Dépôt banque ordinaire', montant, ref_id: refId, module: 'banque', adherent_id: adhId }),
  depotScolaire:  (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'banque_scolaire',  libelle: 'Dépôt banque scolaire',  montant, ref_id: refId, module: 'banque', adherent_id: adhId }),
};

// VENTES
export const caisseVentes = {
  frais:          (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'interet_vente', libelle: 'Intérêt vente du mois',    montant, ref_id: refId, module: 'ventes', adherent_id: adhId }),
  reconduction:   (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'interet_vente', libelle: 'Intérêt Reconduction',      montant, ref_id: refId, module: 'ventes', adherent_id: adhId }),
  remboursement:  (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'retour_vente',  libelle: 'Retour vente du mois',      montant, ref_id: refId, module: 'ventes', adherent_id: adhId }),
  remise:         (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'sortie', source: 'vente_du_mois', libelle: 'Vente du mois',             montant, ref_id: refId, module: 'ventes', adherent_id: adhId }),
};

// ROULEMENT
export const caisseRoulement = {
  cotisation: (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'internet_roulement', libelle: 'Internet roulement',  montant, ref_id: refId, module: 'roulement', adherent_id: adhId }),
  remise:     (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'sortie', source: 'sorties_roulements', libelle: 'Sorties Roulements',      montant, ref_id: refId, module: 'roulement', adherent_id: adhId }),
  retour:     (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'retour_roulement',   libelle: 'Retour roulement',      montant, ref_id: refId, module: 'roulement', adherent_id: adhId }),
};

// SOLIDARITÉ
export const caisseSolidarite = {
  cotisation: (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'recouvrement_mm',      libelle: 'Recouvrement M/M',    montant, ref_id: refId, module: 'solidarite', adherent_id: adhId }),
  aide:       (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'sortie', source: 'aide_malheur_maladie', libelle: 'Aide Malheur maladie',   montant, ref_id: refId, module: 'solidarite', adherent_id: adhId }),
};

// VOIR BÉBÉ
export const caisseVoirBebe = {
  cotisation: (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'voire_bebe', libelle: 'Cotisation Voir Bébé', montant, ref_id: refId, module: 'voir_bebe', adherent_id: adhId }),
};

// DETTES
export const caisseDettes = {
  remboursement: (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'recouvrement_dette', libelle: 'Remboursement dette', montant, ref_id: refId, module: 'dettes', adherent_id: adhId }),
  sanction:      (montant, refId, adhId) => enregistrerMouvementCaisse({ type: 'entree', source: 'sanctions',          libelle: 'Sanction / Pénalité', montant, ref_id: refId, module: 'dettes', adherent_id: adhId }),
};

// INTÉGRATION
// Chaque fonds a sa propre source pour un suivi précis dans mouvement_caisse
// Chaise (5 000) et couverts (10 000) : entrée caisse + ajout stock ressources automatique (géré dans DettesScreen)
export const caisseIntegration = {
  /**
   * @param {number} montant
   * @param {string} element    - Label lisible (ex: 'Fond de caisse', 'Projet')
   * @param {string} typeFonds  - Clé technique (ex: 'fond_caisse', 'projet', 'chaise', 'couvert', 'fond_malheur')
   * @param {string} refId      - fonds_id
   * @param {string} adhId      - adherent_id
   */
  paiement: (montant, element, typeFonds, refId, adhId) => {
    // Mapper typeFonds → source caisse (rubrique métier précise)
    const sourceMap = {
      fond_caisse:  'fond_caisse',
      fond_malheur: 'fond_malheur_maladie',
      chaise:       'fond_chaise',
      couvert:      'fond_couvert',
      projet:       'fond_projet',
    };
    const source = sourceMap[typeFonds] || 'fond_caisse';
    return enregistrerMouvementCaisse({
      type:        'entree',
      source,
      libelle:     `Intégration — ${element}`,
      montant,
      ref_id:      refId,
      module:      'integration',
      adherent_id: adhId,
    });
  },
};

// ÉVÉNEMENTS
export const caisseEvenements = {
  depense: (montant, libelle, refId) => enregistrerMouvementCaisse({ type: 'depense', source: 'achats_fournitures', libelle: `Dépense événement — ${libelle}`, montant, ref_id: refId, module: 'evenements' }),
};

// RESSOURCES
// Règles caisse : achat → dépense | location → entrée | réparation → sans mouvement caisse | rebut → sans mouvement caisse
export const caisseRessources = {
  achat:    (montant, libelle, refId) => enregistrerMouvementCaisse({ type: 'depense', source: 'achats_fournitures', libelle: `Achat ressource — ${libelle}`,    montant, ref_id: refId, module: 'ressources' }),
  location: (montant, libelle, refId) => enregistrerMouvementCaisse({ type: 'entree', source: 'location_chaises',   libelle: `Location ressource — ${libelle}`, montant, ref_id: refId, module: 'ressources' }),
  // reparation et reforme : pas de mouvement caisse
};