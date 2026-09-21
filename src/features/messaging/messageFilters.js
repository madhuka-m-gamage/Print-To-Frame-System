export function getIncomingMessages(messages, myId) {
  const me = String(myId || '').trim().toLowerCase();
  return (messages || []).filter(msg => String(msg.fromId || '').trim().toLowerCase() !== me);
}
