/**
 * GpsGateScreen.js
 * ─────────────────────────────────────────────────────────────
 * Écran de pointage dimanche :
 *   1. Vérification GPS (dans les 100m du siège)
 *   2. Scan QR Code OU saisie PIN de secours
 *   3. Selfie obligatoire
 *   4. Surveillance GPS toutes les 15min (usePresenceGate)
 *
 * Installation :
 *   npx expo install expo-camera expo-location expo-image-picker expo-device
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Image, Modal
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import { CameraView, useCameraPermissions } from 'expo-camera';

// ── Helpers ────────────────────────────────────────────────────
function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ══════════════════════════════════════════════════════════════
export default function GpsGateScreen({ session, adherentId, onAcces, onBloquer }) {
  const [etape, setEtape]         = useState('gps');    // gps → qr → selfie → ok
  const [loading, setLoading]     = useState(false);
  const [position, setPosition]   = useState(null);
  const [distance, setDistance]   = useState(null);
  const [modePin, setModePin]     = useState(false);
  const [pin, setPin]             = useState('');
  const [selfieUri, setSelfieUri] = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => { verifierGps(); }, []);

  // ── Étape 1 : GPS ──────────────────────────────────────────
  async function verifierGps() {
    setLoading(true);
    setEtape('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // GPS refusé → proposer PIN directement
        setModePin(true);
        setEtape('qr');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setPosition({ latitude, longitude });

      const dist = distanceMetres(latitude, longitude, session.gps_lat, session.gps_lng);
      setDistance(Math.round(dist));

      if (dist <= (session.gps_rayon || 100)) {
        setEtape('qr');
      } else {
        setEtape('hors_zone');
      }
    } catch (e) {
      setModePin(true);
      setEtape('qr');
    }
    setLoading(false);
  }

  // ── Étape 2a : Scan QR ────────────────────────────────────
  async function validerQr(data) {
    if (!scanning) return;
    setScanning(false);
    if (data === session.qr_code) {
      setEtape('selfie');
    } else {
      Alert.alert('QR invalide', 'Ce QR Code ne correspond pas à la session du jour.');
      setScanning(true);
    }
  }

  // ── Étape 2b : PIN de secours ──────────────────────────────
  function validerPin() {
    if (pin === session.pin_code) {
      setEtape('selfie');
    } else {
      Alert.alert('PIN incorrect', 'Le code saisi est incorrect. Demandez au bureau.');
      setPin('');
    }
  }

  // ── Étape 3 : Selfie ──────────────────────────────────────
  async function prendrePhoto() {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled) {
      setSelfieUri(result.assets[0].uri);
    }
  }

  async function confirmerSelfie() {
    if (!selfieUri) {
      Alert.alert('Selfie requis', 'Prenez votre photo pour confirmer votre présence.');
      return;
    }
    setLoading(true);
    try {
      // Upload selfie dans Supabase Storage
      const blob = await (await fetch(selfieUri)).blob();
      const fileName = `selfies/${session.session_id}/${adherentId}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('presence')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      const selfieUrl = uploadErr ? null : supabase.storage.from('presence').getPublicUrl(fileName).data.publicUrl;

      // Récupérer device ID
      const deviceId = Device.osInternalBuildId || Device.modelId || 'unknown';

      // Enregistrer le pointage
      const { error } = await supabase.from('pointage_presence').upsert({
        session_id:    session.session_id,
        adherent_id:   adherentId,
        methode:       modePin ? 'pin' : 'qr_gps',
        statut:        'present',
        device_id:     deviceId,
        gps_lat:       position?.latitude || null,
        gps_lng:       position?.longitude || null,
        gps_distance:  distance || null,
        selfie_url:    selfieUrl,
        heure_arrivee: new Date().toISOString(),
        derniere_verif_gps: new Date().toISOString(),
      }, { onConflict: 'session_id,adherent_id' });

      if (error) throw error;

      // Vérifier/enregistrer l'appareil
      await supabase.from('appareils_autorises').upsert({
        adherent_id:         adherentId,
        device_id:           deviceId,
        derniere_connexion:  new Date().toISOString(),
        statut:              'actif',
      }, { onConflict: 'adherent_id,device_id' });

      setEtape('ok');
      setTimeout(() => onAcces(), 1500);
    } catch (e) {
      Alert.alert('Erreur', e.message);
    }
    setLoading(false);
  }

  // ── Rendu selon étape ──────────────────────────────────────
  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#1F3864" />
      <Text style={s.loadingTxt}>Vérification en cours…</Text>
    </View>
  );

  // Hors zone GPS
  if (etape === 'hors_zone') return (
    <View style={s.center}>
      <Text style={s.bigIcon}>📍</Text>
      <Text style={s.titre}>Vous êtes trop loin</Text>
      <Text style={s.desc}>
        Vous êtes à <Text style={{ fontWeight: 'bold', color: '#C00000' }}>{distance}m</Text> du siège.{'\n'}
        Rapprochez-vous à moins de <Text style={{ fontWeight: 'bold' }}>{session.gps_rayon || 100}m</Text>.
      </Text>
      <TouchableOpacity style={s.btn} onPress={verifierGps}>
        <Text style={s.btnTxt}>🔄 Réessayer</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btn, s.btnSecondaire]} onPress={() => { setModePin(true); setEtape('qr'); }}>
        <Text style={[s.btnTxt, { color: '#1F3864' }]}>🔢 Utiliser le code PIN</Text>
      </TouchableOpacity>
    </View>
  );

  // Scan QR ou saisie PIN
  if (etape === 'qr') return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitre}>📋 Pointage du dimanche</Text>
        <Text style={s.headerSub}>
          {position ? `✅ GPS validé (${distance}m du siège)` : '⚠️ GPS non disponible'}
        </Text>
      </View>

      {!modePin ? (
        <View style={{ flex: 1 }}>
          <Text style={s.etapeTitre}>📷 Scannez le QR Code affiché au siège</Text>
          {scanning ? (
            <CameraView
              style={{ flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden' }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => validerQr(data)}
            />
          ) : (
            <TouchableOpacity style={[s.btn, { margin: 16 }]} onPress={() => setScanning(true)}>
              <Text style={s.btnTxt}>📷 Ouvrir le scanner</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btnLink]} onPress={() => setModePin(true)}>
            <Text style={s.btnLinkTxt}>Vieux téléphone ? Utiliser le code PIN →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.pinContainer}>
          <Text style={s.etapeTitre}>🔢 Code PIN du jour</Text>
          <Text style={s.desc}>Demandez le code PIN au bureau AJUMY sur place.</Text>
          <TextInput
            style={s.pinInput}
            value={pin}
            onChangeText={v => setPin(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="______"
            placeholderTextColor="#ccc"
            secureTextEntry
          />
          <TouchableOpacity style={[s.btn, pin.length < 6 && { opacity: 0.5 }]}
            onPress={validerPin} disabled={pin.length < 6}>
            <Text style={s.btnTxt}>✅ Valider le code</Text>
          </TouchableOpacity>
          {cameraPermission?.granted !== false && (
            <TouchableOpacity style={s.btnLink} onPress={() => setModePin(false)}>
              <Text style={s.btnLinkTxt}>← Revenir au scan QR</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  // Selfie
  if (etape === 'selfie') return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitre}>📸 Confirmez votre présence</Text>
        <Text style={s.headerSub}>Une photo est requise pour valider votre pointage</Text>
      </View>
      <View style={s.selfieContainer}>
        {selfieUri ? (
          <>
            <Image source={{ uri: selfieUri }} style={s.selfiePreview} />
            <TouchableOpacity style={[s.btn, s.btnSecondaire, { marginBottom: 8 }]} onPress={prendrePhoto}>
              <Text style={[s.btnTxt, { color: '#1F3864' }]}>🔄 Reprendre la photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { opacity: loading ? 0.6 : 1 }]}
              onPress={confirmerSelfie} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> :
                <Text style={s.btnTxt}>✅ Confirmer ma présence</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={s.selfiePlaceholder}>
              <Text style={{ fontSize: 60 }}>🤳</Text>
              <Text style={s.desc}>Prenez un selfie pour confirmer{'\n'}que vous êtes bien présent</Text>
            </View>
            <TouchableOpacity style={s.btn} onPress={prendrePhoto}>
              <Text style={s.btnTxt}>📸 Prendre le selfie</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  // Succès
  if (etape === 'ok') return (
    <View style={s.center}>
      <Text style={{ fontSize: 72 }}>✅</Text>
      <Text style={s.titre}>Présence confirmée !</Text>
      <Text style={s.desc}>Bienvenue à la réunion AJUMY</Text>
      <ActivityIndicator color="#1E7E34" style={{ marginTop: 20 }} />
    </View>
  );

  return null;
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F0F4F8' },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#F0F4F8' },
  header:           { backgroundColor: '#1F3864', padding: 20, paddingTop: 50, alignItems: 'center' },
  headerTitre:      { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub:        { color: '#B0C4DE', fontSize: 12, marginTop: 4 },
  bigIcon:          { fontSize: 72, marginBottom: 16 },
  titre:            { fontSize: 22, fontWeight: 'bold', color: '#1F3864', textAlign: 'center', marginBottom: 8 },
  etapeTitre:       { fontSize: 16, fontWeight: 'bold', color: '#1F3864', textAlign: 'center', margin: 20 },
  desc:             { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  loadingTxt:       { marginTop: 16, color: '#888', fontSize: 14 },
  btn:              { backgroundColor: '#1F3864', borderRadius: 14, padding: 16, alignItems: 'center', marginHorizontal: 16, marginBottom: 10 },
  btnSecondaire:    { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1F3864' },
  btnTxt:           { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  btnLink:          { alignItems: 'center', padding: 12 },
  btnLinkTxt:       { color: '#2E75B6', fontSize: 13, textDecorationLine: 'underline' },
  pinContainer:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  pinInput:         { fontSize: 36, fontWeight: 'bold', letterSpacing: 12, textAlign: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 20, borderWidth: 2, borderColor: '#1F3864', width: '100%', marginBottom: 20, color: '#1F3864' },
  selfieContainer:  { flex: 1, padding: 16, justifyContent: 'center' },
  selfiePreview:    { width: '100%', height: 300, borderRadius: 16, marginBottom: 16, backgroundColor: '#eee' },
  selfiePlaceholder:{ alignItems: 'center', justifyContent: 'center', height: 260, borderRadius: 16, backgroundColor: '#fff', marginBottom: 16, borderWidth: 2, borderColor: '#D6E4F0', borderStyle: 'dashed' },
});
