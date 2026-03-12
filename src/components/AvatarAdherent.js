import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

/**
 * AvatarAdherent — composant réutilisable
 *
 * Usage :
 *   <AvatarAdherent nom="KAMGA" prenom="David" photoUrl={item.photo_url} statut="actif" size={40} />
 *
 * Props :
 *   nom       {string}  — nom de l'adhérent (pour l'initiale)
 *   prenom    {string}  — prénom (optionnel)
 *   photoUrl  {string}  — URL photo Supabase Storage (ou null)
 *   statut    {string}  — 'actif' | 'en_observation' | 'suspendu' (pour la couleur)
 *   size      {number}  — taille en px (défaut: 40)
 *   style     {object}  — styles supplémentaires
 */
export default function AvatarAdherent({ nom, prenom, photoUrl, statut, size = 40, style }) {
  const couleur = statut === 'actif' ? '#1E7E34'
    : statut === 'en_observation'   ? '#C55A11'
    : statut === 'suspendu'         ? '#C00000'
    : '#888';

  const initiale = (nom?.[0] || prenom?.[0] || '?').toUpperCase();
  const fontSize  = Math.round(size * 0.42);
  const radius    = size / 2;

  return (
    <View style={[
      styles.wrapper,
      { width: size, height: size, borderRadius: radius, backgroundColor: couleur },
      style,
    ]}>
      {photoUrl
        ? <Image
            source={{ uri: photoUrl }}
            style={{ width: size, height: size, borderRadius: radius }}
            resizeMode="cover"
          />
        : <Text style={[styles.initiale, { fontSize }]}>{initiale}</Text>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initiale: {
    color: '#fff',
    fontWeight: 'bold',
  },
});