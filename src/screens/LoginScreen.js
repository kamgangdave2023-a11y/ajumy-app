import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function resolveEmail(id) {
    const val = id.trim().replace(/[^0-9]/g, '').padStart(4, '0');
    const normalized = `AJU-${val}`;
    const { data } = await supabase
      .from('adherents')
      .select('email')
      .eq('identifiant_ajumy', normalized)
      .maybeSingle();
    return data?.email || null;
  }

  async function handleLogin() {
    if (!identifiant.trim() || !password) {
      Alert.alert('Champs manquants', 'Veuillez remplir votre identifiant et mot de passe.');
      return;
    }
    setLoading(true);
    try {
      const email = await resolveEmail(identifiant);
      if (!email) {
        Alert.alert('Identifiant inconnu', `Aucun membre trouvé pour "AJU-${identifiant.replace(/[^0-9]/g,'').padStart(4,'0')}".`);
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Échec de connexion', 'Mot de passe incorrect.');
    } catch (e) {
      Alert.alert('Erreur', e.message);
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>AJUMY</Text>
        <Text style={styles.subtitle}>— Amis Sincères - Amis Actifs —</Text>
        <Text style={styles.subtitle2}>Association des Jeunes Unis{'\n'}de Manjo à Yaoundé</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Identifiant AJUMY</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputPrefix}>AJU-</Text>
          <TextInput
            style={styles.inputWithPrefix}
            placeholder="0001"
            value={identifiant}
            onChangeText={v => setIdentifiant(v.replace(/[^0-9]/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <Text style={styles.inputHint}>Votre numéro de membre (ex : AJU-0023)</Text>

        <Text style={[styles.label, { marginTop: 16 }]}>Mot de passe</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Se connecter</Text>}
        </TouchableOpacity>

        <Text style={styles.formHint}>
          Votre identifiant et mot de passe vous ont été remis par le bureau AJUMY.
        </Text>
      </View>

      <Text style={styles.footer}>AJUMY © 2026</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#1F3864', justifyContent: 'center', padding: 30 },
  header:          { alignItems: 'center', marginBottom: 40 },
  logo:            { width: 160, height: 160, marginBottom: 8 },
  title:           { fontSize: 48, fontWeight: 'bold', color: '#fff', letterSpacing: 8 },
  subtitle:        { fontSize: 13, color: '#D6E4F0', textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
  subtitle2:       { fontSize: 13, color: '#D6E4F0', textAlign: 'center', marginTop: 6 },
  form:            { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  label:           { fontSize: 14, fontWeight: '600', color: '#1F3864', marginBottom: 6 },
  inputHint:       { fontSize: 11, color: '#999', marginTop: 4 },
  formHint:        { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 16, lineHeight: 16 },
  inputWrapper:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  inputPrefix:     { backgroundColor: '#1F3864', color: '#fff', fontWeight: 'bold', fontSize: 15, paddingHorizontal: 12, paddingVertical: 12 },
  inputWithPrefix: { flex: 1, padding: 12, fontSize: 18, fontWeight: 'bold', color: '#1F3864', letterSpacing: 4 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D6E4F0', borderRadius: 8, backgroundColor: '#F8FAFC' },
  passwordInput:   { flex: 1, padding: 12, fontSize: 16 },
  eyeBtn:          { paddingHorizontal: 12 },
  eyeIcon:         { fontSize: 18 },
  button:          { backgroundColor: '#1F3864', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonText:      { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footer:          { color: '#D6E4F0', textAlign: 'center', marginTop: 30, fontSize: 12 },
});
