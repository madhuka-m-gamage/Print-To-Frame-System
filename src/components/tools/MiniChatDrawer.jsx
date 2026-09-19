import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Send, MessageSquare, ArrowLeft, ExternalLink, 
  Search, Users, MessageCircle, ChevronRight, Minimize2, 
  Sparkles, CheckCheck
} from 'lucide-react';
import { useMessaging, getChannelId } from '../../context/MessagingContext';
import { UserAvatar } from '../common/ui';

export default function MiniChatDrawer({ currentUser, setActiveTab }) {
  const { 
    isMiniChatOpen, 
    miniChatContact, 
    openMiniChat, 
    toggleMiniChat, 
    closeMiniChat, 
    clearActiveContact, 
    messages, 
    sendDirectMessage, 
    markChatAsRead, 
    resolveUserProfile, 
    recentConversations, 
    totalUnreadCount 
  } = useMessaging();

  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  const scrollRef = useRef(null);

  // Dynamically resolve full active contact profile
  const resolvedContact = useMemo(() => {
    return resolveUserProfile ? resolveUserProfile(miniChatContact) : miniChatContact;
  }, [miniChatContact, resolveUserProfile]);

  // Messages in currently active conversation channel
  const channelMessages = useMemo(() => {
    if (!currentUser?.identifier || !resolvedContact?.identifier) return [];
    const chan = getChannelId(currentUser.identifier, resolvedContact.identifier);
    return messages.filter(m => m.channelId === chan);
  }, [messages, currentUser, resolvedContact]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [channelMessages, resolvedContact, isMiniChatOpen]);

  // Auto mark active chat as read
  useEffect(() => {
    if (isMiniChatOpen && resolvedContact?.identifier) {
      markChatAsRead(resolvedContact.identifier);
    }
  }, [isMiniChatOpen, resolvedContact, markChatAsRead, channelMessages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending || !resolvedContact) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      await sendDirectMessage({
        toId: resolvedContact.identifier,
        text: textToSend
      });
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenFullMessages = () => {
    closeMiniChat();
    if (setActiveTab) {
      setActiveTab('messages');
    }
  };

  // Filter recent conversations & colleagues
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return recentConversations;
    const q = searchQuery.toLowerCase().trim();
    return recentConversations.filter(item => 
      (item.user?.name || '').toLowerCase().includes(q) ||
      (item.user?.identifier || '').toLowerCase().includes(q) ||
      (item.user?.role || '').toLowerCase().includes(q) ||
      (item.lastMessage || '').toLowerCase().includes(q)
    );
  }, [recentConversations, searchQuery]);

  return (
    <>
      {/* 1. Persistent Floating Action Button (FAB) */}
      <div className="fixed bottom-5 right-5 z-50 flex items-center select-none">
        <button
          onClick={toggleMiniChat}
          aria-label="Toggle Quick Messenger"
          title={isMiniChatOpen ? "Close Quick Messenger" : "Open Quick Messenger"}
          className={`relative group w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-90 cursor-pointer ${
            isMiniChatOpen
              ? 'bg-surface-container-highest border border-outline-variant text-on-surface shadow-xl rotate-90'
              : 'bg-primary text-on-primary shadow-[0_0_25px_rgba(0,218,243,0.45)] hover:shadow-[0_0_35px_rgba(0,218,243,0.65)] hover:scale-105'
          }`}
        >
          {isMiniChatOpen ? (
            <X size={22} className="transition-transform duration-200" />
          ) : (
            <MessageCircle size={24} className="transition-transform duration-200 group-hover:rotate-12" />
          )}

          {/* Live Unread Counter Badge */}
          {!isMiniChatOpen && totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 bg-error text-on-error font-black text-[10px] rounded-full flex items-center justify-center ring-2 ring-surface shadow-md animate-bounce">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 2. Floating Quick Messenger Popover Window */}
      {isMiniChatOpen && (
        <div 
          className="fixed bottom-20 right-4 sm:right-5 z-50 w-[calc(100vw-32px)] sm:w-96 h-[520px] max-h-[80vh] flex flex-col bg-surface-container-high border-2 border-outline rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden animate-in slide-in-from-bottom-5 zoom-in-95 duration-200"
        >
          {resolvedContact ? (
            /* ─────────────────────────────────────────────────────────────
               MODE B: DIRECT ACTIVE CONVERSATION
               ───────────────────────────────────────────────────────────── */
            <>
              {/* Header */}
              <div className="p-3.5 bg-surface-container-highest border-b border-outline flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <button
                    onClick={clearActiveContact}
                    className="p-1.5 -ml-1 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
                    title="Back to Recent Chats"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <UserAvatar user={resolvedContact} size="sm" showStatus status="active" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-on-surface truncate">
                      {resolvedContact.name || resolvedContact.identifier}
                    </h4>
                    <p className="text-[9px] font-bold text-primary uppercase tracking-tight truncate">
                      {resolvedContact.role || 'Colleague'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={handleOpenFullMessages}
                    className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                    title="Open Fullscreen Messages View"
                  >
                    <ExternalLink size={13} />
                  </button>
                  <button
                    onClick={closeMiniChat}
                    className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                    title="Minimize"
                  >
                    <Minimize2 size={13} />
                  </button>
                </div>
              </div>

              {/* Messages Stream */}
              <div ref={scrollRef} className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar bg-surface-container-lowest/40">
                {channelMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant select-none">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                      <MessageSquare size={22} />
                    </div>
                    <p className="text-xs font-bold text-on-surface">Start a direct conversation</p>
                    <p className="text-[10px] text-on-surface-variant/70 mt-1 max-w-[200px]">
                      Say hello to {resolvedContact.name || 'your colleague'}
                    </p>
                  </div>
                ) : (
                  channelMessages.map((msg) => {
                    const isMe = String(msg.fromId || '').toLowerCase() === String(currentUser?.identifier || '').toLowerCase();
                    return (
                      <div key={msg._firestoreId || msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[84%] p-2.5 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-primary text-on-primary rounded-br-none shadow-sm'
                              : 'bg-surface-container-high text-on-surface border border-outline-variant/40 rounded-bl-none shadow-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>
                        <span className="text-[8px] font-mono text-on-surface-variant/60 mt-0.5 px-1 flex items-center gap-1">
                          {new Date(Number(msg.timestamp) || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMe && <CheckCheck size={10} className="text-primary opacity-80" />}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Footer */}
              <form onSubmit={handleSend} className="p-2.5 bg-surface-container-highest border-t border-outline flex items-center space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type message..."
                  className="flex-1 px-3 py-2 bg-surface-container border border-outline rounded-xl text-xs text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-on-surface-variant"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="p-2 bg-primary text-on-primary rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-all flex-shrink-0 cursor-pointer active:scale-95"
                >
                  <Send size={13} />
                </button>
              </form>
            </>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               MODE A: RECENT CHATS & DIRECTORY
               ───────────────────────────────────────────────────────────── */
            <>
              {/* Header */}
              <div className="p-3.5 bg-surface-container-highest border-b border-outline flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-primary/15 text-primary rounded-xl">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-on-surface">Team Messenger</h3>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                      {recentConversations.length} Contact{recentConversations.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={handleOpenFullMessages}
                    className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                    title="Open Fullscreen Messages"
                  >
                    <ExternalLink size={13} />
                  </button>
                  <button
                    onClick={closeMiniChat}
                    className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-2.5 border-b border-outline bg-surface-container-high">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" size={13} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search colleagues..."
                    className="w-full pl-8 pr-3 py-1.5 bg-surface-container-highest border border-outline rounded-xl text-xs text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-on-surface-variant"
                  />
                </div>
              </div>

              {/* Recent Conversations List */}
              <div className="flex-1 overflow-y-auto divide-y divide-outline custom-scrollbar">
                {filteredConversations.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center text-on-surface-variant">
                    <Users size={24} className="opacity-30 mb-2" />
                    <p className="text-xs font-bold">No contacts found</p>
                    <p className="text-[10px] opacity-70 mt-0.5">Try searching with another name or role</p>
                  </div>
                ) : (
                  filteredConversations.map((item) => {
                    const u = item.user;
                    return (
                      <div
                        key={u.identifier}
                        onClick={() => openMiniChat(u)}
                        className="p-3 hover:bg-surface-container-high transition-colors flex items-center space-x-3 cursor-pointer group"
                      >
                        <UserAvatar user={u} size="sm" showStatus status="active" />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h4 className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                              {u.name || u.identifier}
                            </h4>
                            {item.lastTimestamp > 0 && (
                              <span className="text-[8px] font-mono text-on-surface-variant/70 whitespace-nowrap ml-2">
                                {new Date(item.lastTimestamp).toLocaleDateString() === new Date().toLocaleDateString()
                                  ? new Date(item.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : new Date(item.lastTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between items-center">
                            <p className="text-[10px] text-on-surface-variant truncate max-w-[180px]">
                              {item.lastMessage || u.role || 'Available'}
                            </p>
                            {item.unreadCount > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1 bg-primary text-on-primary font-extrabold text-[9px] rounded-full flex items-center justify-center shadow-xs">
                                {item.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight size={13} className="text-on-surface-variant/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
