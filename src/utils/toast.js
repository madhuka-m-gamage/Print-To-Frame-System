import { toast as sonnerToast } from 'sonner';
import { emitNotification } from './events';

const showCustomToast = (title, message, type) => {
  emitNotification({ title, message, type });
};

export const toast = {
  success: (message, options = {}) => {
    sonnerToast.success(message, options);
    showCustomToast(message, options.description, 'success');
  },
  error: (message, options = {}) => {
    sonnerToast.error(message, options);
    showCustomToast(message, options.description, 'error');
  },
  info: (message, options = {}) => {
    sonnerToast.info(message, options);
    showCustomToast(message, options.description, 'info');
  },
  warning: (message, options = {}) => {
    sonnerToast.warning(message, options);
    showCustomToast(message, options.description, 'warning');
  }
};

export const showToast = (t) => {
  emitNotification(t);
};
