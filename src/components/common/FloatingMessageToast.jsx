import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, ExternalLink, CornerDownLeft } from 'lucide-react';
import { useMessaging } from '../../context/MessagingContext';
import { UserAvatar } from '../common/ui';

export default function FloatingMessageToast({ setActiveTab }) {
  const { activeToastMessage, dismissToast, openMiniChat, sendDirectMessage, resolveUserProfile } = useMessaging();
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);

  const timerRef = useRef(null);

  const sender = React.useMemo(() => {
    if (!activeToastMessage) return null;
    const raw = activeToastMessage.sender || activeToastMessage.fromId;
    return resolveUserProfile ? resolveUserProfile(raw) : raw;
  }, [activeToastMessage, resolveUserProfile]) || {
    identifier: activeToastMessage?.fromId,
    name: activeToastMessage?.senderName || 'Team Member',
    role: 'Staff'
  };

  useEffect(() => {
    if (!activeToastMessage) {
      setQuickReplyText('');
      setShowReplyBox(false);
      return;
    }

    // Auto dismiss after 7 seconds if not hovering or typing
    if (!isHovered && !showReplyBox) {
      timerRef.current = setTimeout(() => {
        dismissToast();
      }, 7000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeToastMessage, isHovered, showReplyBox, dismissToast]);

  if (!activeToastMessage) return null;

  const handleSendQuickReply = async (e) => {
    e.preventDefault();
    if (!quickReplyText.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendDirectMessage({
        toId: sender.identifier,
        text: quickReplyText.trim(),
        replyTo: activeToastMessage
      });
      setQuickReplyText('');
      setShowReplyBox(false);
      dismissToast();
    } catch (err) {
      console.error("Quick reply error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenChat = () => {
    if (openMiniChat) {
      openMiniChat(sender);
    } else if (setActiveTab) {
      setActiveTab('messages');
      dismissToast();
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-22 right-4 sm:right-5 z-50 max-w-sm w-full sm:w-96 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto"
    >
      <div className="bg-surface-container/95 backdrop-blur-xl border border-primary/40 rounded-2xl shadow-[0_10px_35px_rgba(0,218,243,0.15)] overflow-hidden transition-all">
        {/* Top Header Bar */}
        <div className="bg-primary/10 border-b border-primary/20 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary flex items-center gap-1">
              <MessageSquare size={11} /> New Message
            </span>
          </div>
          <button
            onClick={dismissToast}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-3.5 space-y-3">
          <div className="flex items-start space-x-3">
            <UserAvatar user={sender} size="md" showStatus status="active" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-black text-on-surface truncate">{sender.name || sender.identifier}</p>
                <span className="text-[9px] font-mono text-on-surface-variant ml-2">Just now</span>
              </div>
              <p className="text-[9px] font-bold text-primary uppercase tracking-wider mt-0.5">
                {sender.role || 'Team Member'}
              </p>
              <div className="mt-1.5 p-2 bg-surface-container-low rounded-xl border border-outline-variant/50 text-xs text-on-surface leading-relaxed line-clamp-3">
                {activeToastMessage.text || 'Sent an attachment'}
              </div>
            </div>
          </div>

          {/* Quick Actions / Inline Reply */}
          {showReplyBox ? (
            <form onSubmit={handleSendQuickReply} className="space-y-2 pt-1 border-t border-outline-variant/30">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={quickReplyText}
                  onChange={(e) => setQuickReplyText(e.target.value)}
                  placeholder={`Reply to ${sender.name?.split(' ')[0] || 'chat'}...`}
                  className="w-full pl-3 pr-10 py-2 bg-surface-container-low border border-primary/40 rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/60"
                />
                <button
                  type="submit"
                  disabled={!quickReplyText.trim() || isSending}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-on-primary rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-all"
                >
                  <Send size={12} />
                </button>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <button
                  type="button"
                  onClick={() => setShowReplyBox(false)}
                  className="text-on-surface-variant hover:text-on-surface font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOpenChat}
                  className="text-primary font-bold hover:underline flex items-center gap-0.5"
                >
                  Open Full Thread <ExternalLink size={10} />
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowReplyBox(true)}
                className="flex-1 py-1.5 px-3 bg-surface-container-high hover:bg-primary/20 text-on-surface hover:text-primary border border-outline-variant hover:border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 active:scale-95"
              >
                <CornerDownLeft size={12} />
                <span>Quick Reply</span>
              </button>
              <button
                type="button"
                onClick={handleOpenChat}
                className="py-1.5 px-3 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 shadow-sm active:scale-95"
              >
                <ExternalLink size={12} />
                <span>Open Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
