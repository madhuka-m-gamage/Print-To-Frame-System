import React, { useState, useMemo } from 'react';
import { 
  Bell, CheckCircle2, AlertCircle, Info, Trash2, MessageSquare, 
  ExternalLink, Filter, Clock, Sparkles, User, ArrowUpRight 
} from 'lucide-react';
import { useMessaging } from '../../context/MessagingContext';
import { PageHeader, FilterBar, StatusBadge, UserAvatar, TwoToneIcon } from '../common/ui';
import { formatDateTime } from '../../utils/dateUtils';

export default function NotificationsView({ notifications = [], setNotifications, users = [], setActiveTab }) {
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'SYSTEM' | 'MESSAGES'
  const [searchQuery, setSearchQuery] = useState('');
  const { messages, openMiniChat, resolveUserProfile, markAllAsRead } = useMessaging();

  const handleClearAll = async () => {
    if (filterType === 'SYSTEM') {
      setNotifications([]);
    } else if (filterType === 'MESSAGES') {
      if (markAllAsRead) await markAllAsRead();
    } else {
      setNotifications([]);
      if (markAllAsRead) await markAllAsRead();
    }
  };

  const handleDelete = (id) => {
    setNotifications((prev) => prev.filter(n => n.id !== id));
  };

  // Convert direct messages to notification feed items with resolved sender profile & photoURL
  const messageItems = useMemo(() => {
    return (messages || []).slice(-30).reverse().map(msg => {
      const senderProfile = resolveUserProfile 
        ? resolveUserProfile({ identifier: msg.fromId, name: msg.senderName, photoURL: msg.photoURL || msg.senderAvatar })
        : (users.find(u => u.identifier?.toLowerCase() === msg.fromId?.toLowerCase() || u.email?.toLowerCase() === msg.fromId?.toLowerCase() || u.name?.toLowerCase() === msg.senderName?.toLowerCase()) || null);

      return {
        id: `msg_${msg._firestoreId || msg.id}`,
        type: 'message',
        title: `Message from ${senderProfile?.name || msg.senderName || msg.fromId}`,
        message: msg.text || 'Attachment / Image',
        date: new Date(Number(msg.timestamp) || Date.now()).toISOString(),
        senderUser: senderProfile || { name: msg.senderName || msg.fromId, identifier: msg.fromId, photoURL: msg.photoURL },
        rawMessage: msg
      };
    });
  }, [messages, resolveUserProfile, users]);

  const combinedNotifications = useMemo(() => {
    let list = [];
    if (filterType === 'SYSTEM') list = notifications;
    else if (filterType === 'MESSAGES') list = messageItems;
    else list = [...notifications, ...messageItems].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(item => 
      item.title?.toLowerCase().includes(q) ||
      item.message?.toLowerCase().includes(q) ||
      item.type?.toLowerCase().includes(q)
    );
  }, [notifications, messageItems, filterType, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Standardized Header */}
      <PageHeader
        title="Notifications"
        subtitle="Real-time feed of system status updates, production pipeline alerts, and direct team messages."
        metrics={[
          { label: "Total Alerts", value: notifications.length + messageItems.length, color: "cyan" },
          { label: "Team Messages", value: messageItems.length, color: "purple" },
          { label: "System Alerts", value: notifications.length, color: "emerald" },
          { label: "Active Feed", value: combinedNotifications.length, color: "amber" }
        ]}
        actions={
          ((notifications.length > 0 && filterType !== 'MESSAGES') || (filterType === 'MESSAGES' && messageItems.length > 0) || (filterType === 'ALL' && (notifications.length > 0 || messageItems.length > 0))) && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-container border border-outline-variant text-on-surface hover:text-status-danger-on hover:border-status-danger-border rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>
                {filterType === 'MESSAGES' ? 'Mark Messages Read' : filterType === 'SYSTEM' ? 'Clear System Alerts' : 'Clear & Mark Read'}
              </span>
            </button>
          )
        }
      />

      {/* Standardized Filter & Search Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search alerts by sender, message content, or alert type..."
        activeFilter={filterType}
        onFilterChange={setFilterType}
        filterOptions={[
          { id: 'ALL', label: 'All Activity', count: notifications.length + messageItems.length },
          { id: 'MESSAGES', label: 'Team Messages', count: messageItems.length },
          { id: 'SYSTEM', label: 'System Alerts', count: notifications.length }
        ]}
        totalCount={notifications.length + messageItems.length}
        filteredCount={combinedNotifications.length}
      />

      {/* Notification Feed List */}
      <div className="bg-surface-container/60 border border-outline-variant/60 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex flex-col">
        <div className="p-3.5 px-4 bg-surface-container-low/80 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          <span className="flex items-center gap-2">
            <Bell size={14} className="text-primary" />
            Activity Stream ({combinedNotifications.length})
          </span>
          <span className="text-[10px] text-on-surface-variant/70 lowercase font-medium">
            real-time feed
          </span>
        </div>

        <div className="divide-y divide-outline-variant/30">
          {combinedNotifications.length === 0 ? (
            <div className="p-16 text-center text-on-surface-variant text-xs">
              <Bell size={40} className="mx-auto mb-3 opacity-25" />
              <p className="font-bold text-on-surface text-sm">No notifications found</p>
              <p className="text-[11px] text-on-surface-variant mt-1">You are all caught up! New alerts and messages will appear here in real time.</p>
            </div>
          ) : (
            combinedNotifications.map((item) => {
              const isMessage = item.type === 'message';
              const isSystem = item.type === 'system';
              const isOrder = item.type === 'order' || item.type === 'lead';

              return (
                <div 
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-surface-container-high/40 transition-colors group"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Dynamic Avatar / Two-Tone Icon */}
                    {isMessage ? (
                      <UserAvatar 
                        user={item.senderUser}
                        photoURL={item.senderUser?.photoURL}
                        name={item.senderUser?.name || item.rawMessage?.senderName || 'Teammate'}
                        role={item.senderUser?.role || 'internal'}
                        size="md"
                      />
                    ) : (
                      <TwoToneIcon 
                        type={item.type || (isOrder ? 'order' : 'system')} 
                        size="md" 
                      />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-on-surface">{item.title}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.2 rounded border ${
                          isMessage 
                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' 
                            : 'bg-primary/15 text-primary border-primary/30'
                        }`}>
                          {isMessage ? 'Direct Chat' : item.type?.toUpperCase() || 'SYSTEM'}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-mono mt-1.5">
                        <Clock size={10} className="text-primary" />
                        <span>{formatDateTime(item.date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    {isMessage && (
                      <button
                        onClick={() => {
                          if (openMiniChat) {
                            openMiniChat({
                              identifier: item.rawMessage?.fromId,
                              name: item.rawMessage?.senderName || item.rawMessage?.fromId,
                            });
                          } else if (setActiveTab) {
                            setActiveTab('messages');
                          }
                        }}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl border border-primary/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare size={13} />
                        <span>Reply Chat</span>
                      </button>
                    )}

                    {!isMessage && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-on-surface-variant hover:text-status-danger-on hover:bg-status-danger-bg rounded-xl border border-transparent hover:border-status-danger-border transition-colors cursor-pointer"
                        title="Dismiss Alert"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
