import React from 'react';
import { User, Phone, Mail, Building, MapPin, MessageSquare, ExternalLink } from 'lucide-react';
import UserAvatar from '../UserAvatar';

/**
 * DetailCustomerCard - Reusable customer contact information card across all modules.
 * Includes direct WhatsApp and phone call triggers.
 */
export default function DetailCustomerCard({
  customerName = 'Direct Client',
  company,
  phone,
  email,
  address,
  photoURL,
  onWhatsApp,
  compact = false
}) {
  const handleWhatsApp = () => {
    if (onWhatsApp) {
      onWhatsApp();
      return;
    }
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    }
  };

  return (
    <div className="p-4 bg-surface-container-high rounded-2xl border border-outline relative group hover:border-primary/50 transition-all shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <UserAvatar 
            user={{ name: customerName, photoURL, company }} 
            size="md" 
          />
          <div>
            <h4 className="text-sm font-bold text-on-surface leading-tight">
              {customerName}
            </h4>
            {company && (
              <p className="text-xs text-on-surface-variant font-medium flex items-center mt-0.5">
                <Building size={10} className="mr-1 opacity-60" /> {company}
              </p>
            )}
          </div>
        </div>

        {phone && (
          <button
            type="button"
            onClick={handleWhatsApp}
            className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg border border-emerald-500/30 transition-all shadow-sm"
            title="Chat on WhatsApp"
          >
            <MessageSquare size={13} />
          </button>
        )}
      </div>

      <div className={`mt-3 space-y-1.5 pt-3 border-t border-outline text-xs text-on-surface font-medium ${compact ? 'text-[11px]' : ''}`}>
        {phone && (
          <div className="flex items-center">
            <Phone size={11} className="mr-2 text-primary opacity-75 flex-shrink-0" />
            <a href={`tel:${phone}`} className="hover:text-primary transition-colors font-mono font-medium">
              {phone}
            </a>
          </div>
        )}
        {email && (
          <div className="flex items-center">
            <Mail size={11} className="mr-2 text-primary opacity-75 flex-shrink-0" />
            <a href={`mailto:${email}`} className="hover:text-primary transition-colors truncate font-medium">
              {email}
            </a>
          </div>
        )}
        {address && (
          <div className="flex items-start">
            <MapPin size={11} className="mr-2 mt-0.5 text-primary opacity-75 flex-shrink-0" />
            <span className="truncate leading-relaxed">{address}</span>
          </div>
        )}
      </div>
    </div>
  );
}
