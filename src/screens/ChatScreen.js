import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRole } from '../lib/useRole';
import AvatarAdherent from '../components/AvatarAdherent';

// ── Constantes ────────────────────────────────────────────────
const EMOJIS = ['👍','❤️','😂','😮','😢','🙏','🔥','✅'];
const ROLES_ADMIN = ['SUPER_ADMIN','PRESIDENT','VICE_PRESIDENT','TRESORIER','SECRETAIRE','CENSEUR','COMMISSAIRE'];
const GROUPE_ID = '00000000-0000-0000-0000-000000000001';

// Désignations affichées dans le chat
const ROLE_LABELS = {
  PRESIDENT:           '👑 Président',
  VICE_PRESIDENT:      '🎖 Vice-Président',
  SECRETAIRE:          '📋 Secrétaire',
  TRESORIER:           '💰 Trésorier',
  CENSEUR:             '🔍 Censeur',
  COMMISSAIRE:         '⚖️ Commissaire aux comptes',
  SUPER_ADMIN:         '⚙️ Super Admin',
  ADHERENT:            '',
};

const ROLE_COLORS = {
  PRESIDENT:           '#C55A11',
  VICE_PRESIDENT:      '#7030A0',
  SECRETAIRE:          '#2E75B6',
  TRESORIER:           '#1E7E34',
  CENSEUR:             '#AD1457',
  COMMISSAIRE:         '#4A2000',
  SUPER_ADMIN:         '#1F3864',
  ADHERENT:            '',
}; // ID fixe pour le chat groupe

// ── Composant Header ──────────────────────────────────────────
function Header({ title, subtitle, onBack, right }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} style={s.backBtn}>
        <Text style={s.backTxt}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ── Bulle de message ──────────────────────────────────────────
function MessageBulle({ msg, moi, onLongPress, onRepondre, isAdmin, allAdherents }) {
  const auteur = allAdherents.find(a => a.adherent_id === msg.expediteur_id);
  const repMsg = msg.reponse_a ? null : null; // simplifié

  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(msg)}
      activeOpacity={0.85}
      style={[s.bulleWrap, moi ? s.bulleWrapMoi : s.bulleWrapAutre]}
    >
      {/* Avatar — seulement si pas moi */}
      {!moi && (
        <View style={{ marginRight: 6, alignSelf: 'flex-end' }}>
          <AvatarAdherent
            nom={auteur?.nom} prenom={auteur?.prenom}
            photoUrl={auteur?.photo_url} statut={auteur?.statut}
            size={28}
          />
        </View>
      )}

      <View style={{ maxWidth: '78%' }}>
        {/* Nom + badge rôle (chat groupe, pas moi) */}
        {!moi && msg.conversation_id === GROUPE_ID && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={s.bulleAuteur}>{auteur?.prenom || '?'} {auteur?.nom || ''}</Text>
            {auteur?.role && ROLE_LABELS[auteur.role.toUpperCase()] ? (
              <View style={[s.roleBadge, { backgroundColor: ROLE_COLORS[auteur.role.toUpperCase()] || '#888' }]}>
                <Text style={s.roleBadgeTxt}>{ROLE_LABELS[auteur.role.toUpperCase()]}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Message auquel on répond */}
        {msg.reponse_a_texte ? (
          <View style={s.reponsePreview}>
            <Text style={s.reponsePreviewTxt} numberOfLines={1}>↩ {msg.reponse_a_texte}</Text>
          </View>
        ) : null}

        {/* Contenu */}
        <View style={[s.bulle, moi ? s.bulleMoi : s.bulleAutre]}>
          {msg.type === 'image' && msg.media_url ? (
            <Image source={{ uri: msg.media_url }} style={s.msgImage} resizeMode="cover" />
          ) : null}
          {msg.contenu ? (
            <Text style={[s.bulleTxt, moi ? s.bulleTxtMoi : s.bulleTxtAutre]}>{msg.contenu}</Text>
          ) : null}
          <Text style={[s.bulleHeure, moi ? { color: 'rgba(255,255,255,0.65)' } : {}]}>
            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {msg.supprime ? '  🚫' : ''}
          </Text>
        </View>

        {/* Réactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <View style={[s.reactionsWrap, moi ? { alignSelf: 'flex-end' } : {}]}>
            {Object.entries(msg.reactions).map(([emoji, count]) => (
              <View key={emoji} style={s.reactionBadge}>
                <Text style={s.reactionTxt}>{emoji} {count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Bouton répondre */}
      <TouchableOpacity onPress={() => onRepondre(msg)} style={s.btnRepondre}>
        <Text style={s.btnRepondreTxt}>↩</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════
//  ÉCRAN CONVERSATION (groupe ou privé)
// ══════════════════════════════════════════════════════════════
function ConversationScreen({ conversationId, titre, sousTitre, moi, isAdmin, allAdherents, onBack }) {
  const [messages, setMessages]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [texte, setTexte]             = useState('');
  const [sending, setSending]         = useState(false);
  const [reponseA, setReponseA]       = useState(null);
  const [menuMsg, setMenuMsg]         = useState(null); // modal actions
  const [emojiModal, setEmojiModal]   = useState(null); // { msg }
  const flatRef = useRef(null);

  // ── Chargement initial ──────────────────────────────────────
  useEffect(() => {
    charger();
    marquerLu();
  }, [conversationId]);

  // ── Supabase Realtime ───────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => {
          // Éviter les doublons si déjà ajouté en optimiste
          if (prev.find(m => m.message_id === payload.new.message_id)) return prev;
          return [...prev, payload.new];
        });
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        marquerLu();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => prev.map(m => m.message_id === payload.new.message_id ? payload.new : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function marquerLu() {
    // Mettre à jour lu_par dans la conversation
    const { data: conv } = await supabase
      .from('conversations')
      .select('lu_par').eq('conversation_id', conversationId).maybeSingle();
    if (!conv) return;
    const luPar = conv.lu_par || [];
    if (!luPar.includes(moi.adherent_id)) {
      await supabase.from('conversations').update({
        lu_par: [...luPar, moi.adherent_id]
      }).eq('conversation_id', conversationId);
    }
  }

  // ── Envoyer message texte ───────────────────────────────────
  async function envoyer() {
    const txt = texte.trim();
    if (!txt || sending) return;
    setSending(true);
    try {
      const msgData = {
        conversation_id: conversationId,
        expediteur_id:       moi.adherent_id,
        type:            'texte',
        contenu:         txt,
        reactions:       {},
        supprime:        false,
      };
      if (reponseA) {
        msgData.reponse_a       = reponseA.message_id;
        msgData.reponse_a_texte = reponseA.contenu?.slice(0, 60);
      }

      console.log('[CHAT] Envoi message — conv:', conversationId, 'auteur:', moi.adherent_id);
      // Ajout optimiste avec ID temporaire
      const tempId = 'temp-' + Date.now();
      setMessages(prev => [...prev, { ...msgData, message_id: tempId, created_at: new Date().toISOString() }]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);

      const { data: msgInsere, error: errMsg } = await supabase.from('messages').insert(msgData).select().single();
      if (errMsg) throw errMsg;

      // Remplacer le message temporaire par le vrai (Realtime peut arriver en double — on déduplique)
      setMessages(prev => {
        const sansTmp = prev.filter(m => m.message_id !== tempId);
        // Si Realtime l'a déjà ajouté, ne pas rajouter
        if (sansTmp.find(m => m.message_id === msgInsere.message_id)) return sansTmp;
        return [...sansTmp, msgInsere];
      });

      // Mettre à jour la conversation
      await supabase.from('conversations').update({
        dernier_message:   txt,
        derniere_activite: new Date().toISOString(),
        lu_par:            [moi.adherent_id],
      }).eq('conversation_id', conversationId);

      setTexte('');
      setReponseA(null);
    } catch(err) {
      console.error('[CHAT] Erreur envoi:', err);
      // Afficher l'erreur visuellement
      setMessages(prev => [...prev, {
        message_id: 'err-' + Date.now(),
        conversation_id: conversationId,
        expediteur_id: moi.adherent_id,
        type: 'texte',
        contenu: '❌ Erreur : ' + (err.message || JSON.stringify(err)),
        reactions: {},
        supprime: false,
        created_at: new Date().toISOString(),
      }]);
    }
    setSending(false);
  }

  // ── Réagir à un message ─────────────────────────────────────
  async function reagir(msg, emoji) {
    setEmojiModal(null);
    setMenuMsg(null);
    const reactions = { ...(msg.reactions || {}) };
    reactions[emoji] = (reactions[emoji] || 0) + 1;
    await supabase.from('messages').update({ reactions }).eq('message_id', msg.message_id);
  }

  // ── Supprimer message (admin ou auteur) ─────────────────────
  async function supprimer(msg) {
    setMenuMsg(null);
    await supabase.from('messages').update({
      supprime: true,
      contenu: '🚫 Message supprimé',
    }).eq('message_id', msg.message_id);
  }

  const peutSupprimer = (msg) => isAdmin || msg.expediteur_id === moi.adherent_id;

  // ── Rendu ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: '#F5F5F0' }}>
        <Header title={titre} subtitle={sousTitre} onBack={onBack} />

        {loading
          ? <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 40 }} />
          : <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={m => m.message_id}
              contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
              onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => (
                <MessageBulle
                  msg={item}
                  moi={item.expediteur_id === moi.adherent_id}
                  onLongPress={setMenuMsg}
                  onRepondre={setReponseA}
                  isAdmin={isAdmin}
                  allAdherents={allAdherents}
                />
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 60 }}>
                  <Text style={{ fontSize: 32 }}>💬</Text>
                  <Text style={{ color: '#888', marginTop: 8 }}>Aucun message. Dites bonjour !</Text>
                </View>
              }
            />
        }

        {/* Barre réponse */}
        {reponseA && (
          <View style={s.reponseBar}>
            <Text style={s.reponseBarTxt} numberOfLines={1}>↩ {reponseA.contenu}</Text>
            <TouchableOpacity onPress={() => setReponseA(null)}>
              <Text style={{ color: '#C55A11', fontWeight: 'bold', fontSize: 16, paddingHorizontal: 8 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Saisie */}
        <View style={s.saisieBar}>
          <TextInput
            style={s.saisieInput}
            value={texte}
            onChangeText={setTexte}
            placeholder="Écrire un message…"
            placeholderTextColor="#aaa"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[s.btnEnvoyer, (!texte.trim() || sending) && { opacity: 0.4 }]}
            onPress={envoyer}
            disabled={!texte.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnEnvoyerTxt}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal actions sur message */}
      {menuMsg && (
        <Modal transparent animationType="fade">
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setMenuMsg(null)}>
            <View style={s.menuModal}>
              <Text style={s.menuModalTitre}>Actions</Text>

              {/* Réactions rapides */}
              <View style={s.emojiRow}>
                {EMOJIS.map(e => (
                  <TouchableOpacity key={e} onPress={() => reagir(menuMsg, e)} style={s.emojiBtnQuick}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.menuItem} onPress={() => { setReponseA(menuMsg); setMenuMsg(null); }}>
                <Text style={s.menuItemTxt}>↩ Répondre</Text>
              </TouchableOpacity>

              {peutSupprimer(menuMsg) && !menuMsg.supprime && (
                <TouchableOpacity style={[s.menuItem, { borderTopWidth: 1, borderTopColor: '#eee' }]}
                  onPress={() => supprimer(menuMsg)}>
                  <Text style={[s.menuItemTxt, { color: '#C00000' }]}>🗑 Supprimer</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[s.menuItem, { borderTopWidth: 1, borderTopColor: '#eee' }]}
                onPress={() => setMenuMsg(null)}>
                <Text style={[s.menuItemTxt, { color: '#888' }]}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

// ══════════════════════════════════════════════════════════════
//  LISTE DES CONVERSATIONS (accueil chat)
// ══════════════════════════════════════════════════════════════
function ListeConversations({ moi, isAdmin, allAdherents, onOuvrir, onBack }) {
  const [convs, setConvs]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [nonLus, setNonLus]         = useState({});
  const [creationPrivee, setCreationPrivee] = useState(false);

  useEffect(() => { charger(); }, []);

  // Realtime sur conversations
  useEffect(() => {
    const channel = supabase
      .channel('conversations-liste')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' },
        () => charger())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function charger() {
    setLoading(true);
    // Récupérer toutes les conversations où moi est participant
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`type.eq.groupe,participants.cs.{${moi.adherent_id}}`)
      .order('derniere_activite', { ascending: false });

    const liste = data || [];

    // Calculer non lus
    const nl = {};
    for (const c of liste) {
      const luPar = c.lu_par || [];
      if (!luPar.includes(moi.adherent_id)) nl[c.conversation_id] = true;
    }
    setNonLus(nl);
    setConvs(liste);
    setLoading(false);
  }

  async function creerConvPrivee(autreAdherent) {
    setCreationPrivee(false);
    // Vérifier si conversation déjà existante
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('type', 'privee')
      .contains('participants', [moi.adherent_id, autreAdherent.adherent_id])
      .maybeSingle();

    if (existing) {
      onOuvrir(existing.conversation_id, `${autreAdherent.prenom} ${autreAdherent.nom}`, '', existing);
      return;
    }

    // Créer nouvelle conversation privée
    const { data: nouv } = await supabase.from('conversations').insert({
      type:              'privee',
      participants:      [moi.adherent_id, autreAdherent.adherent_id],
      dernier_message:   '',
      derniere_activite: new Date().toISOString(),
      lu_par:            [moi.adherent_id],
    }).select().single();

    if (nouv) {
      onOuvrir(nouv.conversation_id, `${autreAdherent.prenom} ${autreAdherent.nom}`, '', nouv);
      charger();
    }
  }

  // Infos d'affichage d'une conversation
  function infoConv(conv) {
    if (conv.type === 'groupe') {
      return { titre: '👥 Groupe AJUMY', sous: `${allAdherents.length} membres`, avatar: null };
    }
    const autreId = (conv.participants || []).find(id => id !== moi.adherent_id);
    const autre = allAdherents.find(a => a.adherent_id === autreId);
    return {
      titre: autre ? `${autre.prenom} ${autre.nom}` : 'Conversation',
      sous:  autre?.statut || '',
      avatar: autre,
    };
  }

  // S'assurer que le groupe existe
  async function assurerGroupe() {
    const { data: g } = await supabase
      .from('conversations').select('conversation_id')
      .eq('conversation_id', GROUPE_ID).maybeSingle();
    if (!g) {
      await supabase.from('conversations').insert({
        conversation_id:   GROUPE_ID,
        type:              'groupe',
        dernier_message:   '',
        derniere_activite: new Date().toISOString(),
        lu_par:            [],
        participants:      [],
      });
    }
    charger();
  }

  useEffect(() => { assurerGroupe(); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F0' }}>
      <Header
        title="💬 Chat AJUMY"
        onBack={onBack}
        right={
          <TouchableOpacity onPress={() => setCreationPrivee(true)} style={s.btnNouv}>
            <Text style={s.btnNouvTxt}>✏️</Text>
          </TouchableOpacity>
        }
      />

      {loading
        ? <ActivityIndicator size="large" color="#C55A11" style={{ marginTop: 40 }} />
        : <FlatList
            data={convs}
            keyExtractor={c => c.conversation_id}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => {
              const { titre, sous, avatar } = infoConv(item);
              const nonLu = nonLus[item.conversation_id];
              return (
                <TouchableOpacity
                  style={[s.convItem, nonLu && s.convItemNonLu]}
                  onPress={() => onOuvrir(item.conversation_id, titre, sous, item)}
                >
                  {/* Avatar */}
                  <View style={s.convAvatar}>
                    {item.type === 'groupe'
                      ? <View style={s.convAvatarGroupe}><Text style={{ fontSize: 20 }}>👥</Text></View>
                      : <AvatarAdherent
                          nom={avatar?.nom} prenom={avatar?.prenom}
                          photoUrl={avatar?.photo_url} statut={avatar?.statut}
                          size={46}
                        />
                    }
                    {nonLu && <View style={s.pastilleNonLu} />}
                  </View>

                  {/* Infos */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.convTitre, nonLu && { fontWeight: 'bold' }]}>{titre}</Text>
                    <Text style={s.convDernier} numberOfLines={1}>
                      {item.dernier_message || 'Aucun message'}
                    </Text>
                  </View>

                  {/* Heure */}
                  <Text style={s.convHeure}>
                    {item.derniere_activite
                      ? new Date(item.derniere_activite).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })
                      : ''}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 80 }}>
                <Text style={{ fontSize: 40 }}>💬</Text>
                <Text style={{ color: '#888', marginTop: 12, fontSize: 15 }}>Aucune conversation</Text>
                <Text style={{ color: '#aaa', marginTop: 4 }}>Le groupe AJUMY apparaîtra ici</Text>
              </View>
            }
          />
      }

      {/* Modal sélection membre pour conv privée */}
      {creationPrivee && (
        <Modal transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={[s.menuModal, { maxHeight: '80%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={s.menuModalTitre}>Nouvelle conversation</Text>
                <TouchableOpacity onPress={() => setCreationPrivee(false)}>
                  <Text style={{ color: '#C55A11', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {allAdherents
                  .filter(a => a.adherent_id !== moi.adherent_id)
                  .map(a => (
                    <TouchableOpacity key={a.adherent_id} style={s.membreItem} onPress={() => creerConvPrivee(a)}>
                      <AvatarAdherent
                        nom={a.nom} prenom={a.prenom}
                        photoUrl={a.photo_url} statut={a.statut}
                        size={38}
                      />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={s.membreNom}>{a.prenom} {a.nom}</Text>
                        <Text style={s.membreStatut}>{a.statut}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                }
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  SCREEN PRINCIPAL — ChatScreen
// ══════════════════════════════════════════════════════════════
export default function ChatScreen({ onBack, onNonLusChange }) {
  const { isAdmin: isAdminHook, isBureau } = useRole();
  const [moi, setMoi]                   = useState(null);
  const [allAdherents, setAllAdherents] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [convActive, setConvActive]     = useState(null);
  // convActive = { id, titre, sous, conv }

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    // 1. Récupérer l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // 2. Trouver l'adhérent — d'abord par email, sinon par user_id
    let adherent = null;

    // Tentative 1 : par email
    const { data: byEmail } = await supabase
      .from('adherents')
      .select('adherent_id, nom, prenom, photo_url, statut, role, email, user_id')
      .eq('email', user.email)
      .maybeSingle();
    adherent = byEmail;

    // Tentative 2 : par user_id si disponible
    if (!adherent) {
      const { data: byUid } = await supabase
        .from('adherents')
        .select('adherent_id, nom, prenom, photo_url, statut, role, email, user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      adherent = byUid;
    }

    // Tentative 3 : prendre le premier adhérent actif (admin connecté sans profil lié)
    if (!adherent) {
      const { data: premier } = await supabase
        .from('adherents')
        .select('adherent_id, nom, prenom, photo_url, statut, role')
        .eq('statut', 'actif')
        .order('nom').limit(1).maybeSingle();
      adherent = premier;
    }

    console.log('[CHAT] init — user.email:', user.email, 'adherent trouvé:', adherent?.adherent_id, adherent?.nom);
    setMoi(adherent || { adherent_id: user.id, nom: user.email, prenom: '', statut: 'actif', role: 'SUPER_ADMIN' });

    // 3. Charger tous les adhérents actifs
    const { data: adhs } = await supabase
      .from('adherents')
      .select('adherent_id, nom, prenom, photo_url, statut, role, email')
      .in('statut', ['actif', 'en_observation'])
      .order('nom');
    setAllAdherents(adhs || []);
    setLoading(false);
  }

  // Compter non lus pour pastille Dashboard
  async function compterNonLus() {
    if (!moi || !onNonLusChange) return;
    const { data } = await supabase
      .from('conversations')
      .select('lu_par, conversation_id')
      .or(`type.eq.groupe,participants.cs.{${moi.adherent_id}}`);
    const count = (data || []).filter(c => !(c.lu_par || []).includes(moi.adherent_id)).length;
    onNonLusChange(count);
  }

  useEffect(() => {
    if (moi) compterNonLus();
  }, [moi, convActive]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F0' }}>
        <ActivityIndicator size="large" color="#C55A11" />
      </View>
    );
  }

  if (!moi) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#888' }}>Profil introuvable</Text>
        <TouchableOpacity onPress={onBack} style={{ marginTop: 16 }}>
          <Text style={{ color: '#C55A11' }}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Vue conversation ouverte ──────────────────────────────
  if (convActive) {
    return (
      <ConversationScreen
        conversationId={convActive.id}
        titre={convActive.titre}
        sousTitre={convActive.sous}
        moi={moi}
        isAdmin={ROLES_ADMIN.includes(moi.role?.toUpperCase())}
        allAdherents={allAdherents}
        onBack={() => { setConvActive(null); compterNonLus(); }}
      />
    );
  }

  // ── Liste conversations ───────────────────────────────────
  return (
    <ListeConversations
      moi={moi}
      isAdmin={ROLES_ADMIN.includes(moi.role?.toUpperCase())}
      allAdherents={allAdherents}
      onOuvrir={(id, titre, sous, conv) => setConvActive({ id, titre, sous, conv })}
      onBack={onBack}
    />
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  // Rôle badge
  roleBadge:     { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  roleBadgeTxt:  { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  // Header
  header:        { flexDirection:'row', alignItems:'center', backgroundColor:'#C55A11', paddingTop: Platform.OS === 'ios' ? 44 : 16, paddingBottom:14, paddingHorizontal:16 },
  backBtn:       { padding: 4 },
  backTxt:       { color:'#fff', fontSize:22, fontWeight:'bold' },
  headerTitle:   { color:'#fff', fontSize:17, fontWeight:'bold' },
  headerSub:     { color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:1 },
  btnNouv:       { backgroundColor:'rgba(255,255,255,0.2)', borderRadius:20, width:36, height:36, justifyContent:'center', alignItems:'center' },
  btnNouvTxt:    { fontSize:16 },

  // Liste conversations
  convItem:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F0F0EC' },
  convItemNonLu: { backgroundColor:'#FFF8F3' },
  convAvatar:    { position:'relative' },
  convAvatarGroupe: { width:46, height:46, borderRadius:23, backgroundColor:'#E8755A22', justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:'#C55A1133' },
  pastilleNonLu: { position:'absolute', top:0, right:0, width:12, height:12, borderRadius:6, backgroundColor:'#C00000', borderWidth:2, borderColor:'#fff' },
  convTitre:     { fontSize:15, color:'#1E2130', marginBottom:3 },
  convDernier:   { fontSize:13, color:'#888' },
  convHeure:     { fontSize:11, color:'#aaa', marginLeft:8 },

  // Bulles
  bulleWrap:       { flexDirection:'row', marginVertical:3, alignItems:'flex-end' },
  bulleWrapMoi:    { justifyContent:'flex-end' },
  bulleWrapAutre:  { justifyContent:'flex-start' },
  bulleAuteur:     { fontSize:11, color:'#C55A11', fontWeight:'bold', marginBottom:2, marginLeft:4 },
  bulle:           { borderRadius:16, paddingHorizontal:12, paddingVertical:8, paddingBottom:6 },
  bulleMoi:        { backgroundColor:'#C55A11', borderBottomRightRadius:4 },
  bulleAutre:      { backgroundColor:'#fff', borderBottomLeftRadius:4, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:4, elevation:1 },
  bulleTxt:        { fontSize:15, lineHeight:21 },
  bulleTxtMoi:     { color:'#fff' },
  bulleTxtAutre:   { color:'#1E2130' },
  bulleHeure:      { fontSize:10, color:'#aaa', textAlign:'right', marginTop:2 },
  msgImage:        { width:200, height:150, borderRadius:10, marginBottom:4 },

  // Réponse
  reponsePreview:    { backgroundColor:'rgba(0,0,0,0.08)', borderLeftWidth:3, borderLeftColor:'#C55A11', borderRadius:4, paddingHorizontal:8, paddingVertical:4, marginBottom:4 },
  reponsePreviewTxt: { fontSize:12, color:'#555', fontStyle:'italic' },
  reponseBar:        { flexDirection:'row', alignItems:'center', backgroundColor:'#FFF0E8', borderTopWidth:1, borderTopColor:'#F0D0C0', paddingHorizontal:16, paddingVertical:8 },
  reponseBarTxt:     { flex:1, fontSize:13, color:'#C55A11', fontStyle:'italic' },

  // Réactions
  reactionsWrap:  { flexDirection:'row', flexWrap:'wrap', marginTop:3, gap:4 },
  reactionBadge:  { backgroundColor:'#fff', borderRadius:10, paddingHorizontal:6, paddingVertical:2, borderWidth:1, borderColor:'#eee' },
  reactionTxt:    { fontSize:12 },

  // Bouton répondre
  btnRepondre:    { padding:6, opacity:0, width:24 }, // visible au long press seulement
  btnRepondreTxt: { fontSize:14, color:'#888' },

  // Saisie
  saisieBar:    { flexDirection:'row', alignItems:'flex-end', backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#eee', paddingHorizontal:12, paddingVertical:8, gap:8 },
  saisieInput:  { flex:1, backgroundColor:'#F5F5F0', borderRadius:20, paddingHorizontal:16, paddingVertical:10, fontSize:15, maxHeight:100, color:'#1E2130' },
  btnEnvoyer:   { width:42, height:42, borderRadius:21, backgroundColor:'#C55A11', justifyContent:'center', alignItems:'center' },
  btnEnvoyerTxt:{ color:'#fff', fontSize:18, fontWeight:'bold' },

  // Modal
  modalOverlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' },
  menuModal:      { backgroundColor:'#fff', borderTopLeftRadius:20, borderTopRightRadius:20, padding:20 },
  menuModalTitre: { fontSize:16, fontWeight:'bold', color:'#1E2130', marginBottom:12 },
  emojiRow:       { flexDirection:'row', justifyContent:'space-around', marginBottom:12, paddingBottom:12, borderBottomWidth:1, borderBottomColor:'#f0f0f0' },
  emojiBtnQuick:  { padding:6 },
  menuItem:       { paddingVertical:14 },
  menuItemTxt:    { fontSize:15, color:'#1E2130', fontWeight:'500' },

  // Nouvelle conv
  membreItem:   { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#f5f5f5' },
  membreNom:    { fontSize:15, color:'#1E2130', fontWeight:'500' },
  membreStatut: { fontSize:12, color:'#888', textTransform:'capitalize' },
});