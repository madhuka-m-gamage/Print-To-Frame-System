import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { isReadByRecipient } from './messageFilters';

export default function MessageStatus({ msg, size = 11 }) {
  if (msg.status === 'sending') return <Clock size={size} role="img" aria-label="Sending" className="opacity-60" />;
  if (isReadByRecipient(msg)) return <CheckCheck size={size} role="img" aria-label="Read" className="text-primary" />;
  return <Check size={size} role="img" aria-label="Sent" className="opacity-60" />;
}
