import { LogBox } from 'react-native';
LogBox.ignoreLogs(['props.pointerEvents is deprecated']);
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { supabase } from './src/lib/supabase';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  return (
    <>
      <StatusBar style="light" />
      {session ? <DashboardScreen /> : <LoginScreen />}
    </>
  );
}