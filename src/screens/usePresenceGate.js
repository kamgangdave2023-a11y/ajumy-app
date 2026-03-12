/**
 * usePresenceGate.js
 * ─────────────────────────────────────────────────────────────
 * Hook de surveillance GPS toutes les 15min pendant la réunion.
 * Si l'adhérent sort de la zone → app bloquée + alerte bureau.
 *
 * Usage dans DashboardScreen :
 *   const { horsZone } = usePresenceGate({ sessionId, adherentId, session });
 *   if (horsZone) return <HorsZoneScreen />;
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';

const INTERVALLE_MS  = 15 * 60 * 1000; // 15 minutes
const TOLERANCE_SUPP = 20;              // +20m de tolérance supplémentaire

function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function usePresenceGate({ sessionId, adherentId, session, actif = true }) {
  const [horsZone, setHorsZone]       = useState(false);
  const [derniereVerif, setDerniere]  = useState(null);
  const [sessionFermee, setFermee]    = useState(false);
  const intervalRef                   = useRef(null);
  const appStateRef                   = useRef(AppState.currentState);

  // ── Vérification GPS ────────────────────────────────────────
  const verifierPosition = useCallback(async () => {
    if (!session?.gps_lat || !session?.gps_lng) return;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const dist = distanceMetres(
        loc.coords.latitude, loc.coords.longitude,
        session.gps_lat, session.gps_lng
      );
      const rayon = (session.gps_rayon || 100) + TOLERANCE_SUPP;
      const now = new Date().toISOString();

      // Mettre à jour dernière vérification dans Supabase
      await supabase.from('pointage_presence')
        .update({ derniere_verif_gps: now, gps_distance: Math.round(dist) })
        .eq('session_id', sessionId)
        .eq('adherent_id', adherentId);

      setDerniere(new Date());

      if (dist > rayon) {
        // Marquer comme sorti
        await supabase.from('pointage_presence')
          .update({ statut: 'sorti', heure_sortie: now })
          .eq('session_id', sessionId)
          .eq('adherent_id', adherentId);

        // Alerte bureau dans audit_logs
        await supabase.from('audit_logs').insert({
          type:    'modification',
          module:  'presence_gps',
          action:  `Sortie de zone détectée — ${Math.round(dist)}m du siège`,
          details: { adherent_id: adherentId, distance: Math.round(dist), session_id: sessionId },
        });

        setHorsZone(true);
      }
    } catch (e) {
      console.warn('usePresenceGate GPS error:', e.message);
    }
  }, [session, sessionId, adherentId]);

  // ── Surveiller si la session est toujours ouverte ───────────
  const verifierSession = useCallback(async () => {
    const { data } = await supabase
      .from('session_dimanche')
      .select('statut')
      .eq('session_id', sessionId)
      .single();
    if (data?.statut === 'fermee') {
      setFermee(true);
      clearInterval(intervalRef.current);
    }
  }, [sessionId]);

  // ── Démarrer / arrêter la surveillance ───────────────────────
  useEffect(() => {
    if (!actif || !sessionId || !adherentId) return;

    // Vérification immédiate
    verifierPosition();
    verifierSession();

    // Puis toutes les 15 minutes
    intervalRef.current = setInterval(() => {
      verifierPosition();
      verifierSession();
    }, INTERVALLE_MS);

    // Aussi vérifier quand l'app revient au premier plan
    const sub = AppState.addEventListener('change', state => {
      if (appStateRef.current.match(/inactive|background/) && state === 'active') {
        verifierPosition();
        verifierSession();
      }
      appStateRef.current = state;
    });

    return () => {
      clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [actif, sessionId, adherentId]);

  return { horsZone, derniereVerif, sessionFermee };
}
