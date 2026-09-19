import React, { useState, useEffect } from 'react';
import { Users, X, Mail, Phone, Building, Check, Search, AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';
import { fetchGoogleContacts } from '../../services/contactsService';
import { ModalWrapper } from '../common/ui';
import { toast } from '../../utils/toast';

export default function ContactSyncModal({ isOpen, onClose, onImportContacts }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const googleContacts = await fetchGoogleContacts();
      setContacts(googleContacts);
    } catch (err) {
      setError(err.message || 'Failed to fetch Google Contacts. Please ensure Google Sign-In with Contacts permission is active.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedContactIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedContactIds(next);
  };

  const toggleAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map(c => c.resourceName)));
    }
  };

  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  const handleImport = () => {
    const chosen = contacts.filter(c => selectedContactIds.has(c.resourceName));
    if (chosen.length === 0) {
      toast.error('Select at least one contact to import.');
      return;
    }
    onImportContacts(chosen);
    toast.success(`Successfully imported ${chosen.length} contacts from Google Contacts & WhatsApp sync.`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-3xl"
      height="h-[95dvh] sm:h-[88vh] max-h-[860px]"
      ariaLabel="Google Contacts & WhatsApp Sync"
    >
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 flex-shrink-0">
            <Users size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-on-surface truncate">
              Google Contacts & WhatsApp Sync
            </h3>
            <p className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-0.5 truncate">
              Import Client Address Book Into ERP CRM
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-on-surface-variant hover:text-on-surface bg-surface-container-high rounded-full border border-outline-variant/60 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search & Actions */}
      <div className="p-3 sm:p-4 bg-surface-container-low border-b border-outline-variant flex items-center justify-between gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-on-surface-variant" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts by name, email, or phone..."
            className="w-full bg-surface-container border border-outline-variant/60 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={toggleAll}
          className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/60 text-on-surface text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer"
        >
          {selectedContactIds.size === filteredContacts.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {loading ? (
          <div className="py-20 text-center text-on-surface-variant">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-xs sm:text-sm font-medium">Syncing with Google People API...</p>
          </div>
        ) : error ? (
          <div className="py-10 px-5 text-center bg-error/10 border border-error/30 rounded-2xl my-2">
            <AlertCircle className="text-error mx-auto mb-2" size={32} />
            <p className="text-sm font-bold text-error mb-1">Google Contacts Sync Required</p>
            <p className="text-xs text-on-surface-variant mb-4 max-w-md mx-auto">{error}</p>
            <button
              onClick={loadContacts}
              className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 transition-all cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant">
            <Users className="mx-auto mb-3 opacity-30" size={44} />
            <p className="text-sm font-bold">No Google Contacts found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredContacts.map(contact => {
              const isSelected = selectedContactIds.has(contact.resourceName);
              return (
                <div
                  key={contact.resourceName}
                  onClick={() => toggleSelect(contact.resourceName)}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex items-center space-x-3 ${
                    isSelected
                      ? 'bg-primary/15 border-primary shadow-sm ring-1 ring-primary'
                      : 'bg-surface-container-low border-outline-variant/60 hover:bg-surface-container-high/60'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-black flex items-center justify-center flex-shrink-0 text-xs">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-on-surface truncate">{contact.name}</p>
                    <div className="flex items-center space-x-1.5 text-[11px] text-on-surface-variant mt-0.5">
                      <Mail size={11} className="flex-shrink-0 opacity-70" />
                      <span className="truncate">{contact.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[11px] text-on-surface-variant mt-0.5">
                      <Phone size={11} className="flex-shrink-0 text-emerald-400" />
                      <span className="truncate font-mono">{contact.phone || 'No phone'}</span>
                      {contact.phone && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                          WhatsApp
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant bg-surface-container'
                  }`}>
                    {isSelected && <Check size={12} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 sm:px-6 py-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low flex-shrink-0">
        <div className="text-xs text-on-surface-variant text-center sm:text-left">
          <strong className="text-primary font-black">{selectedContactIds.size}</strong> contacts selected for CRM sync
        </div>
        <div className="flex space-x-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 border border-outline-variant/60 rounded-xl text-xs sm:text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={selectedContactIds.size === 0}
            onClick={handleImport}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-primary text-on-primary font-bold text-xs sm:text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-40 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Check size={14} />
            <span>Import & Sync ({selectedContactIds.size})</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
