export function getIncomingMessages(messages, myId) {
  const me = String(myId || '').trim().toLowerCase();
  return (messages || []).filter(msg => String(msg.fromId || '').trim().toLowerCase() !== me);
}

export function isReadByRecipient(msg) {
  const to = String(msg?.toId || '').trim().toLowerCase();
  return !!to && (msg.readBy || []).some(r => String(r).trim().toLowerCase() === to);
}

export function buildReplyTo(msg) {
  if (!msg) return null;
  return {
    id: msg._firestoreId || msg.id || null,
    text: msg.text || '',
    fromId: msg.fromId || null,
    senderName: msg.senderName || msg.sender?.name || msg.fromId || null,
  };
}
