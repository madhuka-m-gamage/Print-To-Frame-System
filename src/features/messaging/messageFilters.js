export function getIncomingMessages(messages, myId) {
  const me = String(myId || '').trim().toLowerCase();
  return (messages || []).filter(msg => String(msg.fromId || '').trim().toLowerCase() !== me);
}

export function isReadByRecipient(msg) {
  const to = String(msg?.toId || '').trim().toLowerCase();
  return !!to && (msg.readBy || []).some(r => String(r).trim().toLowerCase() === to);
}
