// ============================================================
//  UTILITAIRE ARRONDIS FCFA
//  Coupures : 5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000
//  Règle : distance absolue → coupure la plus proche (sup si égale distance)
// ============================================================

export const COUPURES_FCFA = [5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];

/**
 * Arrondit à la coupure FCFA la plus proche
 * ex: 250 → 250 | 350 → 500 | 750 → 1000 | 25000 → 25000
 */
export function arrondiCoupure(montant) {
  if (!montant || montant <= 0) return 0;
  if (montant > 10000) return Math.round(montant / 500) * 500;
  let inf = COUPURES_FCFA[0], sup = COUPURES_FCFA[COUPURES_FCFA.length - 1];
  for (let i = 0; i < COUPURES_FCFA.length; i++) {
    if (COUPURES_FCFA[i] <= montant) inf = COUPURES_FCFA[i];
    if (COUPURES_FCFA[i] >= montant) { sup = COUPURES_FCFA[i]; break; }
  }
  if (inf === sup) return inf;
  return (montant - inf) >= (sup - montant) ? sup : inf;
}

/**
 * Formatte un montant FCFA avec séparateurs de milliers
 * ex: 9500 → "9 500 FCFA"
 */
export function formatFCFA(montant) {
  if (montant === null || montant === undefined) return '—';
  return `${Math.round(montant).toLocaleString('fr-FR')} FCFA`;
}