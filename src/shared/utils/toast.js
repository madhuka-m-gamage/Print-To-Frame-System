import { toast as sonnerToast } from 'sonner';
import { emitNotification } from './events';

// Only a toast with `notify: true` also becomes a notification-centre entry (stored by App.jsx).
const show = (kind, message, { notify, ...options } = {}) => {
  sonnerToast[kind](message, options);
  if (notify) emitNotification({ title: message, message: options.description || '', type: kind });
};

export const toast = {
  success: (message, options) => show('success', message, options),
  error: (message, options) => show('error', message, options),
  info: (message, options) => show('info', message, options),
  warning: (message, options) => show('warning', message, options),
};
