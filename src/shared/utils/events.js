export const notificationTarget = typeof window !== "undefined" ? new EventTarget() : null;

export function emitNotification(notification) {
  if (!notificationTarget) return;
  const id = "notif_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  notificationTarget.dispatchEvent(new CustomEvent("notification", { detail: { id, ...notification } }));
  return id;
}

export function subscribeToNotifications(callback) {
  if (!notificationTarget) return () => {};
  const handler = (event) => {
    event != null && event.detail && callback(event.detail);
  };
  notificationTarget.addEventListener("notification", handler);
  return () => notificationTarget.removeEventListener("notification", handler);
}
