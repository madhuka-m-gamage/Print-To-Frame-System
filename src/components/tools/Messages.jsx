import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Send, Users, MessageSquare, Trash2, Reply, X, Check, CheckCheck, 
  ArrowLeft, Phone, Mail, PhoneCall, Sparkles, User, ChevronRight,
  Smile, Paperclip, MoreVertical, MessageCircle
} from "lucide-react";
import { toast } from "../../utils/toast";
import { setDocument, COLLECTIONS } from "../../services/firestoreSync";
import { db } from "../../services/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { PageHeader, FilterBar, StatusBadge, UserAvatar, EmailTemplateModal } from "../common/ui";
import { useMessaging, getChannelId } from "../../context/MessagingContext";

export default function Messages({ users = [], currentUser, onUnreadCountChange }) {
  const { 
    messages, 
    unreadCounts, 
    sendDirectMessage, 
    markChatAsRead, 
    setActiveChatContactId 
  } = useMessaging();

  const [activeUser, setActiveUser] = useState(null);
  const [inputText, setInputText] = useState("");
  const [typingState, setTypingState] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [mobileView, setMobileView] = useState("list"); // 'list' | 'chat'
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const chatContainerRef = useRef(null);

  // Sync active contact with global messaging context
  useEffect(() => {
    if (activeUser?.identifier) {
      setActiveChatContactId(String(activeUser.identifier).trim().toLowerCase());
      markChatAsRead(activeUser.identifier);
    } else {
      setActiveChatContactId(null);
    }
    return () => setActiveChatContactId(null);
  }, [activeUser, setActiveChatContactId, markChatAsRead]);

  // Typing indicators
  useEffect(() => {
    if (!currentUser) return;
    const typingUnsub = onSnapshot(collection(db, COLLECTIONS.TYPING_INDICATORS), (snap) => {
      const typingData = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.isTyping && Date.now() - data.timestamp < 3000) {
          typingData[data.fromId] = data.channelId;
        }
      });
      setTypingState(typingData);
    }, () => {});
    return () => typingUnsub();
  }, [currentUser]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeUser]);

  const sendTypingIndicator = (isTyping) => {
    if (!activeUser || !currentUser) return;
    const myId = String(currentUser.identifier).trim().toLowerCase();
    const targetId = String(activeUser.identifier).trim().toLowerCase();
    const activeChan = getChannelId(myId, targetId);
    try {
      setDocument(COLLECTIONS.TYPING_INDICATORS, myId, {
        fromId: myId,
        channelId: activeChan,
        isTyping,
        timestamp: Date.now()
      }, true);
    } catch(e) {}
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeUser || !currentUser) return;

    const myId = String(currentUser.identifier).trim().toLowerCase();
    const targetId = String(activeUser.identifier).trim().toLowerCase();
    const textToSend = inputText.trim();

    setInputText("");
    setReplyTo(null);
    sendTypingIndicator(false);

    try {
      await sendDirectMessage({
        toId: targetId,
        text: textToSend,
        replyTo: replyTo ? {
          id: replyTo._firestoreId || replyTo.id,
          text: replyTo.text,
          senderName: replyTo.senderName
        } : null
      });
    } catch(err) {
      console.error(err);
      toast.error("Failed to send message: " + err.message);
    }
  };

  // Filtered contacts list
  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      if (u.identifier === currentUser?.identifier) return false;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        u.name?.toLowerCase().includes(q) ||
        u.identifier?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.company?.toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;

      if (activeFilter === 'unread') {
        const uId = String(u.identifier).trim().toLowerCase();
        return (unreadCounts[uId] || 0) > 0;
      }
      return true;
    });
  }, [users, currentUser, searchQuery, activeFilter, unreadCounts]);

  // Current channel messages
  const activeChannelMessages = useMemo(() => {
    if (!currentUser?.identifier || !activeUser?.identifier) return [];
    const myId = String(currentUser.identifier).trim().toLowerCase();
    const targetId = String(activeUser.identifier).trim().toLowerCase();
    const chan = getChannelId(myId, targetId);
    return messages.filter(m => m.channelId === chan || (m.participants?.includes(myId) && m.participants?.includes(targetId)));
  }, [messages, currentUser, activeUser]);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts || {}).reduce((s, c) => s + (Number(c) || 0), 0);
  }, [unreadCounts]);

  // Auto select first user on mount
  useEffect(() => {
    if (!activeUser && filteredUsers.length > 0) {
      setActiveUser(filteredUsers[0]);
    }
  }, [activeUser, filteredUsers]);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-6">
      {/* Standardized Header */}
      <PageHeader
        title="Messages"
        subtitle="Direct real-time communication, presence indicators, and cross-department collaboration."
        metrics={[
          { label: "Teammates", value: users.filter(u => u.identifier !== currentUser?.identifier).length, color: "cyan" },
          { label: "Unread Messages", value: totalUnreadCount, color: totalUnreadCount > 0 ? "amber" : "neutral" },
          { label: "Active Channel", value: activeUser ? activeUser.name : "None", color: "emerald" }
        ]}
      />

      {/* Standardized Filter & Search Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search colleagues by name, email, company, or role..."
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        filterOptions={[
          { id: 'all', label: 'All Teammates', count: users.filter(u => u.identifier !== currentUser?.identifier).length },
          { id: 'unread', label: 'Unread Chats', count: Object.keys(unreadCounts || {}).filter(k => (unreadCounts[k] || 0) > 0).length }
        ]}
        totalCount={users.filter(u => u.identifier !== currentUser?.identifier).length}
        filteredCount={filteredUsers.length}
      />

      {/* Main Master-Detail 2-Panel Layout */}
      <div className="flex-1 flex lg:flex-row flex-col gap-6 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: Teammates Registry (1/3 Width) */}
        <div className={`w-full lg:w-1/3 ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'} flex-col border border-outline-variant/60 bg-surface-container/60 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full`}>
          <div className="bg-surface-container-low/80 p-3.5 px-4 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider flex-shrink-0">
            <span className="flex items-center gap-2">
              <Users size={14} className="text-primary" />
              Direct Contacts ({filteredUsers.length})
            </span>
            <span className="text-[10px] text-on-surface-variant/70 lowercase font-medium">
              click to chat
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-sm font-medium">
                <Users size={36} className="mx-auto mb-3 opacity-25" />
                <p className="font-bold text-on-surface">No contacts found</p>
                <p className="text-xs text-on-surface-variant mt-1">Try searching another name or reset filter.</p>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = activeUser?.identifier === user.identifier;
                const userKey = String(user.identifier).trim().toLowerCase();
                const unread = unreadCounts[userKey] || 0;

                return (
                  <div
                    key={user.identifier}
                    onClick={() => {
                      setActiveUser(user);
                      setMobileView('chat');
                    }}
                    className={`p-4 transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isSelected
                        ? 'bg-primary/10 border-l-4 border-primary shadow-[inset_0_0_15px_rgba(0,218,243,0.08)]'
                        : 'hover:bg-surface-container-high/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        user={user}
                        size="md"
                        showStatus={true}
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-xs truncate ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                            {user.name}
                          </p>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface-container-high border border-outline-variant/60 text-on-surface-variant flex-shrink-0">
                            {user.role}
                          </span>
                        </div>

                        <p className="text-[10px] text-on-surface-variant truncate font-mono mt-0.5">
                          {user.identifier}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {unread > 0 && (
                        <span className="px-2 py-0.5 bg-primary text-on-primary font-mono text-[9px] font-extrabold rounded-full shadow-sm">
                          {unread}
                        </span>
                      )}
                      <ChevronRight size={14} className={`text-on-surface-variant/40 transition-transform group-hover:translate-x-0.5 ${isSelected ? 'text-primary' : ''}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Room (2/3 Width) */}
        <div className={`flex-1 ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col border border-outline-variant/60 bg-surface-container/40 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full`}>
          {!activeUser ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-25 text-on-surface-variant" />
              <h3 className="font-bold text-on-surface text-base">No Conversation Selected</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mt-1">
                Select a teammate from the left directory to start a direct instant message channel.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Top Chat Header Banner */}
              <div className="p-4 sm:p-5 bg-surface-container-low/90 border-b border-outline-variant/60 flex justify-between items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <button 
                    onClick={() => setMobileView('list')}
                    className="lg:hidden p-1.5 bg-surface-container hover:bg-surface-container-high rounded-lg text-on-surface-variant"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <UserAvatar
                    user={activeUser}
                    size="lg"
                    showStatus={true}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm sm:text-base text-on-surface truncate">{activeUser.name}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                        {activeUser.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant font-mono truncate mt-0.5">
                      {activeUser.identifier} {activeUser.company ? `· ${activeUser.company}` : ''}
                    </p>
                  </div>
                </div>

                {/* Direct Action triggers */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  {activeUser.contactNumber && (
                    <>
                      <a
                        href={`tel:${activeUser.contactNumber.replace(/[^0-9+]/g, '')}`}
                        className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold border border-outline-variant flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                        title="Call Teammate"
                        aria-label={`Call ${activeUser.name}`}
                      >
                        <PhoneCall size={12} className="text-primary" aria-hidden="true" /> Call
                      </a>
                      <a
                        href={`https://wa.me/${activeUser.contactNumber.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-400"
                        title="Open WhatsApp Chat"
                        aria-label={`Open WhatsApp chat with ${activeUser.name}`}
                      >
                        <MessageCircle size={13} aria-hidden="true" /> WhatsApp
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(true)}
                    className="px-3 py-1.5 bg-primary/15 hover:bg-primary/25 text-primary rounded-xl text-xs font-bold border border-primary/30 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                    title="Open Email Template Dispatcher & Gmail Web Compose"
                    aria-label={`Open email template dispatcher for ${activeUser.name}`}
                  >
                    <Mail size={13} aria-hidden="true" /> Email Dispatcher
                  </button>
                </div>
              </div>

              {/* Message Bubbles Container */}
              <div 
                ref={chatContainerRef}
                className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-3"
                role="log"
                aria-live="polite"
                aria-label={`Conversation with ${activeUser.name}`}
              >
                {activeChannelMessages.length === 0 ? (
                  <div className="py-16 text-center text-on-surface-variant text-xs">
                    <MessageSquare size={36} className="mx-auto mb-2 opacity-25" aria-hidden="true" />
                    <p className="font-bold text-on-surface">Start a conversation with {activeUser.name}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">Direct messages are encrypted and synchronized across all devices in real time.</p>
                  </div>
                ) : (
                  activeChannelMessages.map((msg, idx) => {
                    const isMe = msg.fromId === currentUser?.identifier;

                    return (
                      <div
                        key={msg._firestoreId || msg.id || idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${isMe ? 'ml-auto' : 'mr-auto'}`}
                      >
                        {msg.replyTo && (
                          <div className="text-[10px] text-on-surface-variant bg-surface-container-low p-2 rounded-t-xl border border-outline-variant/40 mb-0.5 max-w-full truncate">
                            Replying to <strong>{msg.replyTo.senderName}</strong>: {msg.replyTo.text}
                          </div>
                        )}

                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isMe 
                            ? 'bg-primary text-on-primary font-medium rounded-tr-sm shadow-[0_2px_15px_rgba(0,218,243,0.15)]'
                            : 'bg-surface-container border border-outline-variant/60 text-on-surface rounded-tl-sm'
                        }`}>
                          {msg.text}
                        </div>

                        <div className="flex items-center gap-1.5 text-[9px] text-on-surface-variant font-mono mt-1 px-1">
                          <span>{new Date(Number(msg.timestamp) || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && <CheckCheck size={11} className="text-primary" aria-hidden="true" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Typing indicator */}
              {typingState[activeUser.identifier] && (
                <div role="status" aria-live="polite" className="px-5 py-1 text-[10px] text-primary font-bold italic animate-pulse">
                  {activeUser.name} is typing...
                </div>
              )}

              {/* Bottom Message Input Bar */}
              <form 
                onSubmit={handleSendMessage}
                className="p-3.5 bg-surface-container-low/90 border-t border-outline-variant/60 flex items-center gap-2 flex-shrink-0"
              >
                <input
                  type="text"
                  placeholder={`Message ${activeUser.name}...`}
                  aria-label={`Message ${activeUser.name}`}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    sendTypingIndicator(e.target.value.length > 0);
                  }}
                  className="flex-1 bg-surface-container border border-outline-variant/60 rounded-xl px-4 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary outline-none"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  aria-label="Send message"
                  className="p-2.5 bg-primary text-on-primary rounded-xl font-bold shadow-md hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send size={15} aria-hidden="true" />
                </button>
              </form>

            </div>
          )}
        </div>
      </div>

      {/* Email Template Dispatcher Modal */}
      {isEmailModalOpen && activeUser && (
        <EmailTemplateModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          recipient={activeUser}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
