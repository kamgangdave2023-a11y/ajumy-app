// usePresenceGps.js
// Hook de surveillance GPS toutes les 15 minutes

import { useState, useEffect, useCallback, useRef } from 'react';

const INTERVALLE_MS = 15 * 60 * 1000; // 15 minutes
const TOLERANCE_SUPP = 20; // +20m de tolérance supplémentaire

const calculerDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const usePresenceGps = ({ sessionId, adherentId, session, actif = true }) => {
  const [horsZone, setHorsZone] = useState(false);
  const [derniereVerif, setDerniereVerif] = useState(null);
  const [distanceActuelle, setDistanceActuelle] = useState(null);
  const intervalRef = useRef(null);

  const verifierPosition = useCallback(async () => {
    if (!session?.gps_lat || !session?.gps_lng || !actif) return;

    if (!navigator.geolocation) {
      console.warn('Géolocalisation non disponible');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = calculerDistance(
          latitude,
          longitude,
          session.gps_lat,
          session.gps_lng
        );

        const rayon = (session.gps_rayon || 100) + TOLERANCE_SUPP;
        const now = new Date().toISOString();
        const distanceMetres = Math.round(dist);

        setDistanceActuelle(distanceMetres);

        // Mettre à jour la dernière vérification
        const pointageKey = `pointage_${sessionId}_${adherentId}`;
        try {
          const data = await window.storage.get(pointageKey, true);
          
          if (data?.value) {
            const pointage = JSON.parse(data.value);
            pointage.derniere_verif_gps = now;
            pointage.gps_distance = distanceMetres;
            pointage.gps_lat = latitude;
            pointage.gps_lng = longitude;
            
            if (dist > rayon && !horsZone) {
              pointage.statut = 'sorti';
              pointage.heure_sortie = now;
              setHorsZone(true);

              // Log dans la console pour débogage
              console.warn(`⚠️ SORTIE DE ZONE DÉTECTÉE: ${distanceMetres}m du siège (rayon: ${rayon}m)`);
              
              // Notifier l'application parente
              window.dispatchEvent(new CustomEvent('presence-sortie-zone', {
                detail: { adherentId, distanceMetres, sessionId }
              }));
            }

            await window.storage.set(pointageKey, JSON.stringify(pointage), true);
          }
        } catch (error) {
          console.error('Erreur mise à jour pointage:', error);
        }

        setDerniereVerif(new Date());
      },
      (error) => {
        console.error('Erreur GPS surveillance:', error);
      },
      {
        enableHighAccuracy: false, // Économie batterie
        timeout: 10000,
        maximumAge: 60000 // 1 minute de cache max
      }
    );
  }, [session, sessionId, adherentId, actif, horsZone]);

  useEffect(() => {
    if (!actif || !sessionId || !adherentId) return;

    // Vérification immédiate
    verifierPosition();

    // Puis toutes les 15 minutes
    intervalRef.current = setInterval(verifierPosition, INTERVALLE_MS);

    // Vérifier aussi quand la page devient visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifierPosition();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [actif, sessionId, adherentId, verifierPosition]);

  return { 
    horsZone, 
    derniereVerif, 
    distanceActuelle,
    verifierMaintenant: verifierPosition 
  };
};

export default usePresenceGps;
