// GpsPointageComponent.jsx
// Composant de pointage GPS pour les réunions du dimanche

import React, { useState, useEffect } from 'react';
import { MapPin, Camera, QrCode, CheckCircle, AlertCircle, X } from 'lucide-react';

const GpsPointageComponent = ({ session, currentUser, onSuccess, onClose }) => {
  const [etape, setEtape] = useState('gps'); // gps → qr → selfie → ok
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(null);
  const [distance, setDistance] = useState(null);
  const [modePin, setModePin] = useState(false);
  const [pin, setPin] = useState('');
  const [selfieData, setSelfieData] = useState(null);
  const [scannerActif, setScannerActif] = useState(false);

  // Coordonnées du siège AJUMY (configurables dans la session)
  const SIEGE_GPS = {
    lat: session?.gps_lat || 3.8480,
    lng: session?.gps_lng || 11.5021,
    rayon: session?.gps_rayon || 100
  };

  useEffect(() => {
    verifierGPS();
  }, []);

  // ══════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════════════════════════════

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

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 1 : VÉRIFICATION GPS
  // ══════════════════════════════════════════════════════════════

  const verifierGPS = async () => {
    setLoading(true);
    setEtape('gps');

    if (!navigator.geolocation) {
      alert('Votre navigateur ne supporte pas la géolocalisation. Utilisez le code PIN.');
      setModePin(true);
      setEtape('qr');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ latitude, longitude });

        const dist = calculerDistance(latitude, longitude, SIEGE_GPS.lat, SIEGE_GPS.lng);
        const distanceMetres = Math.round(dist);
        setDistance(distanceMetres);

        if (distanceMetres <= SIEGE_GPS.rayon) {
          setEtape('qr');
        } else {
          setEtape('hors_zone');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Erreur GPS:', error);
        setModePin(true);
        setEtape('qr');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 2 : VALIDATION (QR ou PIN)
  // ══════════════════════════════════════════════════════════════

  const demarrerScanQR = async () => {
    setScannerActif(true);
    // Simulation scan QR pour démo - à remplacer par html5-qrcode
    // Pour l'instant, on passe directement à l'étape selfie en mode démo
    setTimeout(() => {
      const qrSimule = prompt('Entrez le QR Code (ou laissez vide pour passer en démo):');
      if (qrSimule === session.qr_code || qrSimule === '') {
        setEtape('selfie');
      } else {
        alert('QR Code invalide');
      }
      setScannerActif(false);
    }, 500);
  };

  const validerPin = () => {
    if (pin === session.pin_code) {
      setEtape('selfie');
    } else {
      alert('PIN incorrect. Demandez le code au bureau AJUMY.');
      setPin('');
    }
  };

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 3 : SELFIE
  // ══════════════════════════════════════════════════════════════

  const prendrePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        setTimeout(() => {
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          const imageData = canvas.toDataURL('image/jpeg', 0.7);
          setSelfieData(imageData);
          
          stream.getTracks().forEach(track => track.stop());
        }, 1000);
      };
    } catch (err) {
      alert('Impossible d\'accéder à la caméra: ' + err.message);
    }
  };

  const confirmerPresence = async () => {
    if (!selfieData) {
      alert('Veuillez prendre un selfie');
      return;
    }

    setLoading(true);

    try {
      const pointage = {
        session_id: session.session_id,
        adherent_id: currentUser.id,
        adherent_name: currentUser.name,
        methode: modePin ? 'pin' : 'qr_gps',
        statut: 'present',
        gps_lat: position?.latitude,
        gps_lng: position?.longitude,
        gps_distance: distance,
        selfie_data: selfieData,
        heure_arrivee: new Date().toISOString(),
        derniere_verif_gps: new Date().toISOString()
      };

      // Sauvegarder le pointage individuel
      await window.storage.set(
        `pointage_${session.session_id}_${currentUser.id}`,
        JSON.stringify(pointage),
        true
      );

      // Ajouter à la liste globale des pointages de la session
      const pointagesKey = `pointages_session_${session.session_id}`;
      const existingData = await window.storage.get(pointagesKey, true);
      const pointages = existingData?.value ? JSON.parse(existingData.value) : [];
      
      const index = pointages.findIndex(p => p.adherent_id === currentUser.id);
      if (index >= 0) {
        pointages[index] = pointage;
      } else {
        pointages.push(pointage);
      }
      
      await window.storage.set(pointagesKey, JSON.stringify(pointages), true);

      setEtape('ok');
      setTimeout(() => {
        onSuccess && onSuccess(pointage);
      }, 1500);
      
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de l\'enregistrement: ' + error.message);
    }

    setLoading(false);
  };

  // ══════════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Vérification en cours...</p>
        </div>
      </div>
    );
  }

  // Hors zone GPS
  if (etape === 'hors_zone') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center z-50 p-6">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} />
          </button>
          
          <MapPin className="mx-auto mb-4 text-red-400" size={64} />
          <h2 className="text-2xl font-bold text-white mb-4">Vous êtes trop loin</h2>
          <p className="text-purple-200 mb-6">
            Vous êtes à <span className="font-bold text-red-400">{distance}m</span> du siège.
            <br />
            Rapprochez-vous à moins de <span className="font-bold">{SIEGE_GPS.rayon}m</span>.
          </p>
          <button
            onClick={verifierGPS}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-semibold mb-3"
          >
            🔄 Réessayer
          </button>
          <button
            onClick={() => { setModePin(true); setEtape('qr'); }}
            className="w-full bg-white/10 text-white px-6 py-3 rounded-full"
          >
            🔢 Utiliser le code PIN
          </button>
        </div>
      </div>
    );
  }

  // QR Code ou PIN
  if (etape === 'qr') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-50 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} className="text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">📋 Pointage du dimanche</h1>
          <p className="text-purple-100 text-sm mt-2">
            {position ? `✅ GPS validé (${distance}m du siège)` : '⚠️ GPS non disponible'}
          </p>
        </div>

        <div className="p-6">
          {!modePin ? (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 text-center">
                📷 Scannez le QR Code
              </h2>
              <p className="text-purple-200 text-sm mb-4 text-center">
                QR Code affiché au siège de l'association
              </p>
              
              <div className="bg-white/5 border-2 border-dashed border-purple-400 rounded-xl p-12 mb-4 text-center">
                <QrCode className="mx-auto mb-4 text-purple-400" size={64} />
                <p className="text-purple-200 text-sm">
                  Scanner QR disponible dans la version mobile
                </p>
              </div>

              <button
                onClick={demarrerScanQR}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-semibold mb-3"
              >
                📷 Mode Démo (Continuer)
              </button>
              <button
                onClick={() => setModePin(true)}
                className="w-full text-purple-300 text-sm underline"
              >
                Utiliser le code PIN →
              </button>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 text-center">
                🔢 Code PIN du jour
              </h2>
              <p className="text-purple-200 text-sm mb-4 text-center">
                Demandez le code au bureau AJUMY
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                <p className="text-yellow-300 text-xs text-center">
                  💡 Code PIN de test : <span className="font-bold">{session.pin_code}</span>
                </p>
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="______"
                className="w-full text-4xl font-bold text-center bg-white/10 border-2 border-purple-500 rounded-xl p-4 text-white mb-4 tracking-widest"
              />
              <button
                onClick={validerPin}
                disabled={pin.length < 6}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-semibold disabled:opacity-50 mb-3"
              >
                ✅ Valider le code
              </button>
              <button
                onClick={() => setModePin(false)}
                className="w-full text-purple-300 text-sm underline"
              >
                ← Revenir au scan QR
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Selfie
  if (etape === 'selfie') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-50 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} className="text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">📸 Confirmez votre présence</h1>
          <p className="text-purple-100 text-sm mt-2">Une photo est requise</p>
        </div>

        <div className="p-6">
          <div className="glass-card rounded-2xl p-6 max-w-md mx-auto">
            {selfieData ? (
              <>
                <img 
                  src={selfieData} 
                  alt="Selfie" 
                  className="w-full h-64 object-cover rounded-xl mb-4"
                />
                <button
                  onClick={prendrePhoto}
                  className="w-full bg-white/10 text-white px-6 py-3 rounded-full mb-3"
                >
                  🔄 Reprendre la photo
                </button>
                <button
                  onClick={confirmerPresence}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full font-semibold disabled:opacity-50"
                >
                  {loading ? 'Enregistrement...' : '✅ Confirmer ma présence'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-white/5 border-2 border-dashed border-purple-400 rounded-xl p-12 mb-4 text-center">
                  <Camera className="mx-auto mb-4 text-purple-400" size={64} />
                  <p className="text-purple-200">
                    Prenez un selfie pour confirmer
                    <br />
                    que vous êtes bien présent
                  </p>
                </div>
                <button
                  onClick={prendrePhoto}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-semibold"
                >
                  📸 Prendre le selfie
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Succès
  if (etape === 'ok') {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center z-50 p-6">
        <div className="text-center">
          <CheckCircle className="mx-auto mb-4 text-green-400 animate-bounce" size={96} />
          <h2 className="text-3xl font-bold text-white mb-2">Présence confirmée !</h2>
          <p className="text-purple-200">Bienvenue à la réunion AJUMY</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mt-6"></div>
        </div>
      </div>
    );
  }

  return null;
};

export default GpsPointageComponent;
