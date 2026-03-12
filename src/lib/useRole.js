import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// ══════════════════════════════════════════════════════════════
//  RÔLES AJUMY — référence centrale
// ══════════════════════════════════════════════════════════════
export const ROLES = {
  SUPER_ADMIN:    { label: 'Super Admin',             icon: '⚙️', color: '#1F3864' },
  PRESIDENT:      { label: 'Président',               icon: '👑', color: '#C55A11' },
  VICE_PRESIDENT: { label: 'Vice-Président',          icon: '🎖', color: '#7030A0' },
  SECRETAIRE:     { label: 'Secrétaire',              icon: '📋', color: '#2E75B6' },
  TRESORIER:      { label: 'Trésorier',               icon: '💰', color: '#1E7E34' },
  CENSEUR:        { label: 'Censeur',                 icon: '🔍', color: '#AD1457' },
  COMMISSAIRE:    { label: 'Commissaire aux comptes', icon: '⚖️', color: '#4A2000' },
  ADHERENT:       { label: 'Membre simple',           icon: '👤', color: '#888'    },
};

// Permissions par fonctionnalité
const PERMISSIONS = {
  // Peut tout faire
  superAdmin:       ['SUPER_ADMIN'],
  // Peut gérer les sanctions
  sanctions:        ['SUPER_ADMIN', 'PRESIDENT', 'CENSEUR'],
  // Peut approuver les ventes banque
  ventesApprobation:['SUPER_ADMIN', 'PRESIDENT', 'TRESORIER'],
  // Peut gérer les adhérents (ajouter, modifier statut)
  adherents:        ['SUPER_ADMIN', 'PRESIDENT', 'SECRETAIRE'],
  // Peut gérer la caisse
  caisse:           ['SUPER_ADMIN', 'TRESORIER'],
  // Peut voir les rapports financiers
  rapports:         ['SUPER_ADMIN', 'PRESIDENT', 'TRESORIER', 'COMMISSAIRE'],
  // Membres du bureau (peuvent accéder aux infos sensibles)
  bureau:           ['SUPER_ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE', 'TRESORIER', 'CENSEUR', 'COMMISSAIRE'],
};

// ══════════════════════════════════════════════════════════════
//  HOOK useRole
//  Usage : const { role, peut, isAdmin, isBureau, moi } = useRole();
// ══════════════════════════════════════════════════════════════
export function useRole() {
  const [role, setRole]       = useState(null);
  const [moi, setMoi]         = useState(null);   // profil adhérent complet
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setRole('ADHERENT'); setLoading(false); return; }

        // Chercher par email d'abord, puis par user_id
        let adh = null;
        const { data: byEmail } = await supabase
          .from('adherents')
          .select('adherent_id, nom, prenom, titre, role, statut, photo_url, email')
          .eq('email', user.email)
          .maybeSingle();
        adh = byEmail;

        if (!adh) {
          const { data: byUid } = await supabase
            .from('adherents')
            .select('adherent_id, nom, prenom, titre, role, statut, photo_url, email')
            .eq('user_id', user.id)
            .maybeSingle();
          adh = byUid;
        }

        const roleNorm = (adh?.role || 'ADHERENT').toUpperCase();
        setRole(roleNorm);
        setMoi(adh ? { ...adh, role: roleNorm } : null);
      } catch (e) {
        console.error('useRole:', e);
        setRole('ADHERENT');
      }
      setLoading(false);
    }
    fetchRole();
  }, []);

  // Vérifie si le rôle actuel a une permission
  function peut(permission) {
    if (!role) return false;
    const autorises = PERMISSIONS[permission] || [];
    return autorises.includes(role);
  }

  // Vérifie si le rôle est dans une liste custom
  function aRole(...roles) {
    if (!role) return false;
    return roles.map(r => r.toUpperCase()).includes(role);
  }

  return {
    role,                                          // 'PRESIDENT', 'TRESORIER', etc.
    moi,                                           // profil adhérent complet
    loading,
    peut,                                          // peut('sanctions'), peut('caisse'), etc.
    aRole,                                         // aRole('PRESIDENT', 'CENSEUR')

    // Raccourcis communs
    isAdmin:    role === 'SUPER_ADMIN',
    isBureau:   PERMISSIONS.bureau.includes(role),
    canEdit:    PERMISSIONS.bureau.includes(role),

    // Permissions spécifiques
    canSanctions:  peut('sanctions'),
    canCaisse:     peut('caisse'),
    canRapports:   peut('rapports'),
    canAdherents:  peut('adherents'),
    canVentes:     peut('ventesApprobation'),
  };
}

// ══════════════════════════════════════════════════════════════
//  UTILITAIRES EXPORTS
// ══════════════════════════════════════════════════════════════

// Obtenir le label + icône d'un rôle
export function getRoleInfo(roleStr) {
  const key = (roleStr || 'ADHERENT').toUpperCase();
  return ROLES[key] || ROLES.ADHERENT;
}

// Vérifier si un rôle peut faire une action (sans hook, pour usage dans des fonctions)
export function rolepeut(role, permission) {
  const autorises = PERMISSIONS[permission] || [];
  return autorises.includes((role || '').toUpperCase());
}
