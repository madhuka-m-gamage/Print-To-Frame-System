import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { addDocument, updateDocument, COLLECTIONS } from '../services/firestoreSync';
import { triggerBrowserNotification } from '../App';

const MessagingContext = createContext(null);

export function getChannelId(id1, id2) {
  if (!id1 || !id2) return null;
  return [String(id1).trim().toLowerCase(), String(id2).trim().toLowerCase()].sort().join('_');
}

export function MessagingProvider({ children, currentUser, users = [], activeTab, setActiveTab }) {
  const [messages, setMessages] = useState([]);
  const [activeToastMessage, setActiveToastMessage] = useState(null);
  const [isMiniChatOpen, setIsMiniChatOpen] = useState(false);
  const [miniChatContact, setMiniChatContact] = useState(null);
  const [activeChatContactId, setActiveChatContactId] = useState(null); // When user is on Messages tab viewing specific contact

  const lastMsgTimestampRef = useRef(Date.now());
  const initialLoadDoneRef = useRef(false);

  // 1. Continuous Session-Level Firestore Subscription
  useEffect(() => {
    if (!currentUser?.identifier) {
      setMessages([]);
      return;
    }

    const myId = String(currentUser.identifier).trim().toLowerCase();

    const q = query(
      collection(db, COLLECTIONS.MESSAGES),
      where('participants', 'array-contains', myId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ _firestoreId: docSnap.id, ...docSnap.data() });
      });

      fetched.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

      // Check for incoming new messages if initial load is already done
      if (initialLoadDoneRef.current) {
        fetched.forEach((msg) => {
          const msgFrom = String(msg.fromId || '').trim().toLowerCase();
          const isFromOther = msgFrom !== myId;
          const isUnread = !(msg.readBy || []).map(r => String(r).toLowerCase()).includes(myId);
          const isNewer = (Number(msg.timestamp) || 0) > lastMsgTimestampRef.current;

          if (isFromOther && isUnread && isNewer) {
            // Check if user is currently looking at this active conversation
            const isCurrentlyViewingChat = (activeTab === 'messages' && activeChatContactId === msgFrom) ||
                                           (isMiniChatOpen && miniChatContact?.identifier?.toLowerCase() === msgFrom);

            if (!isCurrentlyViewingChat) {
              const sender = users.find(u => String(u.identifier || '').trim().toLowerCase() === msgFrom) || {
                identifier: msg.fromId,
                name: msg.senderName || msg.fromId,
                role: 'Team Member'
              };

              setActiveToastMessage({
                ...msg,
                sender
              });

              if (triggerBrowserNotification) {
                triggerBrowserNotification(`Message from ${sender.name || msg.fromId}`, {
                  body: msg.text ? (msg.text.length > 80 ? msg.text.substring(0, 80) + '...' : msg.text) : 'Sent an attachment',
                  tag: 'chat-message'
                });
              }
            }
          }
        });
      } else {
        initialLoadDoneRef.current = true;
      }

      if (fetched.length > 0) {
        const latestTime = Math.max(...fetched.map(m => Number(m.timestamp) || 0));
        lastMsgTimestampRef.current = Math.max(lastMsgTimestampRef.current, latestTime);
      }

      setMessages(fetched);
    }, (err) => {
      console.warn("Global messages subscription notice:", err.message);
    });

    return () => unsubscribe();
  }, [currentUser, users, activeTab, activeChatContactId, isMiniChatOpen, miniChatContact]);

  // 2. Real-Time Unread Counts Calculation
  const { unreadCounts, totalUnreadCount } = useMemo(() => {
    if (!currentUser?.identifier) return { unreadCounts: {}, totalUnreadCount: 0 };

    const myId = String(currentUser.identifier).trim().toLowerCase();
    const counts = {};

    users.forEach((u) => {
      const uId = String(u.identifier || '').trim().toLowerCase();
      if (!uId || uId === myId) return;

      const chan = getChannelId(myId, uId);
      const chanMsgs = messages.filter((m) => m.channelId === chan);

      const unread = chanMsgs.filter(
        (m) => String(m.fromId || '').trim().toLowerCase() === uId &&
               !(m.readBy || []).map(r => String(r).toLowerCase()).includes(myId)
      ).length;

      counts[uId] = unread;
    });

    const total = Object.values(counts).reduce((acc, curr) => acc + curr, 0);
    return { unreadCounts: counts, totalUnreadCount: total };
  }, [messages, currentUser, users]);

  // 3. Dynamic Browser Tab Title with Unread Indicator
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const baseTitle = 'Print To Frame ERP';
    if (totalUnreadCount > 0) {
      document.title = `(${totalUnreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [totalUnreadCount]);

  // 4. Action: Send Direct Message
  const sendDirectMessage = useCallback(async ({ toId, text, replyTo = null }) => {
    if (!text?.trim() || !toId || !currentUser?.identifier) return false;

    const myId = String(currentUser.identifier).trim().toLowerCase();
    const targetId = String(toId).trim().toLowerCase();
    const activeChan = getChannelId(myId, targetId);

    const newMsg = {
      channelId: activeChan,
      participants: [myId, targetId],
      fromId: myId,
      toId: targetId,
      senderName: currentUser.name || myId,
      text: text.trim(),
      timestamp: Date.now(),
      readBy: [myId],
      replyTo: replyTo ? {
        id: replyTo._firestoreId || replyTo.id,
        text: replyTo.text,
        fromId: replyTo.fromId
      } : null
    };

    const docId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await addDocument(COLLECTIONS.MESSAGES, newMsg, docId);
    return true;
  }, [currentUser]);

  // 5. Action: Mark Conversation as Read
  const markChatAsRead = useCallback(async (contactId) => {
    if (!currentUser?.identifier || !contactId) return;

    const myId = String(currentUser.identifier).trim().toLowerCase();
    const targetId = String(contactId).trim().toLowerCase();
    const activeChan = getChannelId(myId, targetId);

    const unreadMsgs = messages.filter(
      (m) => m.channelId === activeChan &&
             String(m.fromId || '').trim().toLowerCase() !== myId &&
             !(m.readBy || []).map(r => String(r).toLowerCase()).includes(myId)
    );

    if (unreadMsgs.length) {
      for (const m of unreadMsgs) {
        const readBy = m.readBy || [];
        if (!readBy.map(r => String(r).toLowerCase()).includes(myId)) {
          updateDocument(COLLECTIONS.MESSAGES, m._firestoreId, {
            readBy: [...readBy, myId]
          }).catch(e => console.warn("Read sync error:", e));
        }
      }
    }
  }, [currentUser, messages]);

  // 5b. Action: Mark All Messages as Read across all conversations
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.identifier) return;

    const myId = String(currentUser.identifier).trim().toLowerCase();
    const unreadMsgs = messages.filter((m) => {
      const fromId = String(m.fromId || '').trim().toLowerCase();
      const readBy = (m.readBy || []).map(r => String(r).toLowerCase());
      return fromId !== myId && !readBy.includes(myId);
    });

    if (unreadMsgs.length) {
      await Promise.all(
        unreadMsgs.map((m) => {
          const readBy = m.readBy || [];
          if (!readBy.map(r => String(r).toLowerCase()).includes(myId)) {
            return updateDocument(COLLECTIONS.MESSAGES, m._firestoreId, {
              readBy: [...readBy, myId]
            }).catch(e => console.warn("Read sync error:", e));
          }
          return Promise.resolve();
        })
      );
    }
  }, [currentUser, messages]);

  // Helper: Dynamically resolve complete user profile from global users list
  const resolveUserProfile = useCallback((target) => {
    if (!target) return null;
    const targetObj = typeof target === 'string' ? { identifier: target } : target;
    const targetId = String(targetObj.identifier || targetObj.email || targetObj.id || target || '').trim().toLowerCase();
    const targetName = String(targetObj.name || targetObj.senderName || '').trim().toLowerCase();

    const matchedUser = users.find(u => {
      const uId = String(u.identifier || u.email || '').trim().toLowerCase();
      const uName = String(u.name || '').trim().toLowerCase();
      return (targetId && uId === targetId) || (targetName && uName === targetName);
    });

    if (matchedUser) {
      return {
        ...matchedUser,
        ...targetObj,
        photoURL: matchedUser.photoURL || matchedUser.avatar || targetObj.photoURL || targetObj.avatar || '',
        name: matchedUser.name || targetObj.name || targetObj.identifier,
        role: matchedUser.role || targetObj.role || 'Team Member',
      };
    }

    return targetObj;
  }, [users]);

  // 6. Action: Open Mini-Chat Drawer (Direct conversation or General list)
  const openMiniChat = useCallback((contact = null) => {
    if (contact) {
      const fullContact = resolveUserProfile(contact);
      setMiniChatContact(fullContact);
      markChatAsRead(fullContact.identifier);
    } else {
      setMiniChatContact(null);
    }
    setIsMiniChatOpen(true);
    setActiveToastMessage(null);
  }, [resolveUserProfile, markChatAsRead]);

  // 7. Action: Toggle Messenger Window (Collapse / Expand)
  const toggleMiniChat = useCallback(() => {
    setIsMiniChatOpen(prev => !prev);
  }, []);

  // 8. Action: Close Mini-Chat Drawer
  const closeMiniChat = useCallback(() => {
    setIsMiniChatOpen(false);
  }, []);

  // 9. Action: Navigate Back to Recent Chats List
  const clearActiveContact = useCallback(() => {
    setMiniChatContact(null);
  }, []);

  // 10. Action: Dismiss Toast
  const dismissToast = useCallback(() => {
    setActiveToastMessage(null);
  }, []);

  // 11. Selector: Recent Conversations Summary List
  const recentConversations = useMemo(() => {
    if (!currentUser?.identifier || !users.length) return [];

    const myId = String(currentUser.identifier).trim().toLowerCase();
    const map = new Map();

    // Scan all messages to extract latest message per partner
    messages.forEach((msg) => {
      const participants = (msg.participants || []).map(p => String(p).trim().toLowerCase());
      const partnerId = participants.find(p => p !== myId) || (String(msg.fromId).toLowerCase() === myId ? String(msg.toId).toLowerCase() : String(msg.fromId).toLowerCase());

      if (!partnerId || partnerId === myId) return;

      const existing = map.get(partnerId);
      const msgTime = Number(msg.timestamp) || 0;

      if (!existing || msgTime > existing.lastTimestamp) {
        const isUnread = String(msg.fromId).toLowerCase() === partnerId && !(msg.readBy || []).map(r => String(r).toLowerCase()).includes(myId);
        map.set(partnerId, {
          partnerId,
          lastMessage: msg.text || 'Attachment / Photo',
          lastTimestamp: msgTime,
          isUnread
        });
      }
    });

    // Merge with user profile details
    const result = [];
    users.forEach((u) => {
      const uId = String(u.identifier || '').trim().toLowerCase();
      if (!uId || uId === myId) return;

      const conv = map.get(uId);
      const unreadCount = unreadCounts[uId] || (u.identifier ? unreadCounts[u.identifier] : 0) || 0;

      result.push({
        user: resolveUserProfile(u),
        lastMessage: conv?.lastMessage || null,
        lastTimestamp: conv?.lastTimestamp || 0,
        unreadCount,
        hasHistory: !!conv
      });
    });

    // Sort: Users with active conversations first (by timestamp descending), then others alphabetically
    return result.sort((a, b) => {
      if (a.hasHistory && b.hasHistory) {
        return b.lastTimestamp - a.lastTimestamp;
      }
      if (a.hasHistory) return -1;
      if (b.hasHistory) return 1;
      return (a.user.name || '').localeCompare(b.user.name || '');
    });
  }, [messages, currentUser, users, unreadCounts, resolveUserProfile]);

  const value = {
    messages,
    unreadCounts,
    totalUnreadCount,
    activeToastMessage,
    dismissToast,
    isMiniChatOpen,
    miniChatContact,
    openMiniChat,
    toggleMiniChat,
    closeMiniChat,
    clearActiveContact,
    recentConversations,
    activeChatContactId,
    setActiveChatContactId,
    sendDirectMessage,
    markChatAsRead,
    markAllAsRead,
    resolveUserProfile,
    getChannelId
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
}
