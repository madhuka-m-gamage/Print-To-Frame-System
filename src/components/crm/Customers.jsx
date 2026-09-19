import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, User, Users, Building, Phone, Mail, Clock, FileText, Trash2, 
  Sparkles, MessageSquare, Check, X, DollarSign, MapPin, Plus, 
  ChevronRight, Calendar, ExternalLink, Copy, ShieldCheck, Download, AlertTriangle, Camera, ArrowLeft
} from 'lucide-react';
import { toast } from '../../utils/toast';
import { generateText } from '../../services/gemini';
import DeleteModal from '../common/DeleteModal';
import { PageHeader, FilterBar, StatusBadge, ModalWrapper, UserAvatar, ImageCropModal } from '../common/ui';
import ActivityTimeline from '../common/ui/ActivityTimeline';
import { addDocument, deleteDocument, COLLECTIONS } from '../../services/firestoreSync';
import { exportToCsv } from '../../utils/csvExport';
import { findCustomerDuplicates } from '../../utils/stringMatch';
import ContactSyncModal from './ContactSyncModal';
import AddressPickerModal from '../common/AddressPickerModal';
import { usePermissions } from '../../context/PermissionsContext';
import { sendTemplatedEmail } from '../../services/mailer';
import { deleteUserAccount } from '../../services/adminUsers';
import { logActivity } from '../../services/auditLog';

export default function Customers({ customers = [], setCustomers, users = [], setUsers, dataStore, currentUser, prefillClient, onClientPrefillConsumed }) {
  const { canAccess } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContactSync, setShowContactSync] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const photoInputRef = useRef(null);

  const handleImportContacts = async (importedList) => {
    const newCustomers = [...customers];
    for (const c of importedList) {
      if (!newCustomers.some(existing => existing.email === c.email || existing.phone === c.phone)) {
        const newCust = {
          nic: `NIC-${String(Date.now()).slice(-6)}-${Math.floor(Math.random()*1000)}`,
          name: c.name,
          phone: c.phone,
          email: c.email,
          type: c.company ? 'Business' : 'Individual',
          businessName: c.company || '',
          address: 'Google Contacts Sync',
          dateJoined: new Date().toISOString().split('T')[0],
          orders: 0,
          totalSpent: 0,
        };
        newCustomers.unshift(newCust);
        try {
          await addDocument(COLLECTIONS.CUSTOMERS, newCust, newCust.nic);
        } catch (err) {
          console.error('Failed to save imported customer:', err);
        }
      }
    }
    setCustomers(newCustomers);
  };

  // Image Crop state
  const [rawImageForCrop, setRawImageForCrop] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  
  const [newProfile, setNewProfile] = useState({
    nic: '',
    name: '',
    phone: '',
    email: '',
    type: 'Individual',
    businessName: '',
    address: '',
    photoURL: '',
  });

  // A Business Client registration request approved in User Management (App.jsx's
  // approvePending) lands here as `prefillClient` — login access is already
  // granted at that point, this carries the admin straight into the same
  // Register Client form used for a manual add, pre-filled with what's known
  // (name/email/phone/business name are prefillable; NIC isn't collected by
  // the registration form and still needs the admin to enter it).
  const onClientPrefillConsumedRef = useRef(onClientPrefillConsumed);
  useEffect(() => {
    onClientPrefillConsumedRef.current = onClientPrefillConsumed;
  }, [onClientPrefillConsumed]);

  // Carries prefillClient's tempPassword (present when App.jsx's approvePending
  // just created a brand-new Firebase Auth account for this Business Client —
  // e.g. a partner_application-style admin-side approval, not self-registration)
  // through to handleCreateProfile's success, mirroring Partners.jsx's
  // pendingApprovalEmail. A self-registered approval passes no tempPassword
  // (the person already knows the password they set when they signed up), so
  // it gets client_activation_confirmed instead of a credential relay.
  const [pendingClientApprovalEmail, setPendingClientApprovalEmail] = useState(null);

  useEffect(() => {
    if (!prefillClient) return;
    setNewProfile(prev => ({
      ...prev,
      name: prefillClient.name || prev.name,
      email: prefillClient.email || prev.email,
      phone: prefillClient.phone || prev.phone,
      businessName: prefillClient.businessName || prev.businessName,
      type: 'Business',
    }));
    setPendingClientApprovalEmail({ tempPassword: prefillClient.tempPassword || null });
    setShowCreateModal(true);
    onClientPrefillConsumedRef.current?.();
  }, [prefillClient]);

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setPendingClientApprovalEmail(null);
  };

  // AI WhatsApp draft state
  const [isDraftingMsg, setIsDraftingMsg] = useState(false);
  const [whatsappDraft, setWhatsappDraft] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [deleteNic, setDeleteNic] = useState(null);

  const handleCustomerPhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setRawImageForCrop(event.target?.result);
      setShowCropModal(true);
      if (photoInputRef.current) photoInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCustomerCropComplete = (croppedBase64) => {
    setNewProfile(prev => ({ ...prev, photoURL: croppedBase64 }));
    toast.success('Customer logo / avatar attached!');
  };


  const businessCount = customers.filter(c => c.type === 'Business').length;
  const individualCount = customers.filter(c => c.type === 'Individual' || !c.type).length;

  // Drives the delete-confirmation copy — accurate warning only when this
  // customer actually has a Business Client login to lose.
  const deleteCustomerHasLogin = useMemo(() => {
    if (!deleteNic) return false;
    const target = customers.find(c => c.nic === deleteNic);
    const email = (target?.email || '').trim().toLowerCase();
    return !!email && users.some(u => u.identifier?.toLowerCase() === email && u.role === 'Business Client');
  }, [deleteNic, customers, users]);

  const filteredCustomers = customers.filter(c => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      c.name?.toLowerCase().includes(query) ||
      c.nic?.toLowerCase().includes(query) ||
      c.businessName?.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.address?.toLowerCase().includes(query)
    );

    if (!matchesSearch) return false;

    if (activeFilter === 'business') return c.type === 'Business';
    if (activeFilter === 'individual') return c.type === 'Individual' || !c.type;
    return true;
  });

  const handleExportCsv = () => {
    try {
      const columns = [
        { key: 'nic', label: 'Client ID / NIC' },
        { key: 'name', label: 'Primary Contact' },
        { key: 'businessName', label: 'Business / Company' },
        { key: 'type', label: 'Account Type' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'address', label: 'Address' },
        { key: 'orders', label: 'Total Orders' },
        { key: 'dateJoined', label: 'Date Joined' },
      ];
      exportToCsv(filteredCustomers, columns, 'PTF_Customers');
      toast.success(`Exported ${filteredCustomers.length} customer records to CSV`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const duplicateCandidates = useMemo(() => {
    if (!showCreateModal || (!newProfile.name && !newProfile.phone && !newProfile.email)) return [];
    return findCustomerDuplicates(newProfile, customers, 0.75);
  }, [showCreateModal, newProfile, customers]);

  const handleCreateProfile = async () => {
    if (!newProfile.nic.trim() || !newProfile.name.trim()) {
      toast.error("Please enter both Identification (NIC/BRN) and Client Name");
      return;
    }
    
    // Prevent duplicate NIC
    if (customers.some(c => c.nic === newProfile.nic)) {
      toast.error("Customer NIC/ID already exists.");
      return;
    }

    const newCustomer = {
      ...newProfile,
      orders: 1,
      dateJoined: new Date().toISOString().split('T')[0]
    };

    setCustomers(prev => [...prev, newCustomer]);
    setSelectedCustomer(newCustomer);
    setShowCreateModal(false);
    const approvalEmail = pendingClientApprovalEmail;
    setPendingClientApprovalEmail(null);
    setNewProfile({
      nic: '',
      name: '',
      phone: '',
      email: '',
      type: 'Individual',
      businessName: '',
      address: '',
    });

    try {
      await addDocument(COLLECTIONS.CUSTOMERS, newCustomer, newCustomer.nic);
      toast.success("Customer profile created");
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync customer profile to DB");
    }

    // This completed a User Management approval — a password-application
    // approval relays the temp password it just created (client_approval); a
    // self-registered approval already has one, so it gets a lighter
    // activation confirmation instead (client_activation_confirmed).
    if (approvalEmail && newCustomer.email) {
      const { tempPassword } = approvalEmail;
      try {
        await sendTemplatedEmail(
          newCustomer.email,
          tempPassword ? 'client_approval' : 'client_activation_confirmed',
          {
            recipientName: newCustomer.name,
            companyName: newCustomer.businessName || newCustomer.name,
            loginEmail: newCustomer.email,
            tempPassword: tempPassword || undefined,
            senderName: currentUser?.name,
          }
        );
      } catch (mailErr) {
        toast.error(`${newCustomer.name} is active, but the confirmation email failed to send: ${mailErr.message}`);
      }
    }
  };

  const getCustomerStats = (customer) => {
    if (!dataStore || !customer) return { deals: [], projects: [], invoices: [] };
    
    const custNic = customer.nic ? String(customer.nic).trim().toLowerCase() : null;
    const custEmail = customer.email ? String(customer.email).trim().toLowerCase() : null;
    const custPhone = customer.phone ? String(customer.phone).replace(/\D/g, '') : null;
    const custName = customer.name ? String(customer.name).trim().toLowerCase() : null;
    const custId = customer.id || customer._firestoreId;

    // Match leads/deals: prioritize primary customerId or NIC, then normalized email/phone, finally name
    const matches = (dataStore.leads || []).filter(l => {
      if (custId && (l.customerId === custId || l.clientNIC === customer.nic)) return true;
      if (custNic && l.clientNIC && String(l.clientNIC).trim().toLowerCase() === custNic) return true;
      if (custEmail && l.email && String(l.email).trim().toLowerCase() === custEmail) return true;
      if (custPhone && l.phone && String(l.phone).replace(/\D/g, '') === custPhone) return true;
      return !!(custName && l.name && String(l.name).trim().toLowerCase() === custName);
    });

    const matchIds = new Set(matches.flatMap(m => [m.id, m._firestoreId, m.originalLeadId].filter(Boolean)));

    const invoices = (dataStore.invoices || []).filter(inv => {
      if (custId && inv.customerId === custId) return true;
      if (custNic && inv.clientNIC && String(inv.clientNIC).trim().toLowerCase() === custNic) return true;
      if (inv.leadId && matchIds.has(inv.leadId)) return true;
      return !!(custName && inv.customerName && String(inv.customerName).trim().toLowerCase() === custName);
    });

    const projects = (dataStore.projects || []).filter(proj => {
      if (custNic && proj.clientNIC && String(proj.clientNIC).trim().toLowerCase() === custNic) return true;
      if (custId && (proj.customerId === custId || matchIds.has(proj.leadId))) return true;
      return !!(custName && proj.customerName && String(proj.customerName).trim().toLowerCase() === custName);
    });

    return { deals: matches, projects, invoices };
  };

  const stats = selectedCustomer ? getCustomerStats(selectedCustomer) : null;

  // Unified Interaction Timeline Feed
  const timelineEvents = useMemo(() => {
    if (!selectedCustomer) return [];
    const events = [];

    // Profile registered
    if (selectedCustomer.dateJoined) {
      events.push({
        id: `reg-${selectedCustomer.nic}`,
        type: 'lead',
        timestamp: selectedCustomer.dateJoined,
        title: 'Customer Profile Registered',
        subtitle: `${selectedCustomer.name} (${selectedCustomer.type}) enrolled in CRM`,
        badge: selectedCustomer.nic,
      });
    }

    // Leads & Deals
    (stats?.deals || []).forEach(d => {
      events.push({
        id: `lead-${d.id}`,
        type: 'lead',
        timestamp: d.date || d.stageEnteredAt,
        title: `Pipeline: ${d.jobScope || 'Custom Framing Inquiry'}`,
        subtitle: `Stage: ${d.stage || 'Intake'} · Value: LKR ${Number(d.value || 0).toLocaleString()}`,
        details: d.deliveryLocation ? `Delivery to: ${d.deliveryLocation}` : null,
        badge: d.isDeal ? 'Deal' : 'Lead',
      });
    });

    // Invoices
    (stats?.invoices || []).forEach(inv => {
      events.push({
        id: `inv-${inv.id}`,
        type: inv.status === 'Paid' ? 'payment' : 'invoice',
        timestamp: inv.paidAt || inv.date,
        title: `Invoice ${inv.id} (${inv.type || 'Advance'})`,
        subtitle: `Amount: LKR ${Number(inv.amount || 0).toLocaleString()} · Status: ${inv.status || 'Unpaid'}`,
        details: inv.aiDraft || null,
        badge: inv.status,
      });
    });

    // Fabrication jobs
    (stats?.projects || []).forEach(proj => {
      events.push({
        id: `proj-${proj.jobNo}`,
        type: 'project',
        timestamp: proj.deadline || proj.date,
        title: `Fabrication Work Order ${proj.jobNo}`,
        subtitle: `Status: ${proj.status || 'Ongoing'} · Technician: ${proj.assignee || 'Unassigned'}`,
        details: proj.scope || null,
        badge: proj.status,
      });
    });

    return events;
  }, [selectedCustomer, stats]);

  const handleGenerateWhatsAppMsg = async (customer) => {
    setIsDraftingMsg(true);
    setWhatsappDraft('');
    setShowDraftModal(true);

    try {
      const prompt = `
        Draft a short, highly professional Sri Lankan WhatsApp message check-in for a client named "${customer.name}" from "Print To Frame Pvt Ltd".
        They are a valuable ${customer.type} client ${customer.businessName ? `(${customer.businessName})` : ''}.
        The message should check if they need any new custom steel framing or gallery canvas wraps.
        Keep it warm, polite, and directly actionable.
      `;
      const response = await generateText(prompt);
      setWhatsappDraft(response);
    } catch (err) {
      setWhatsappDraft(`Hello ${customer.name}, how can we help you today with your custom framing needs? Let us know if you need any steel box-bar wraps!`);
    } finally {
      setIsDraftingMsg(false);
    }
  };

  // Most customers (Individual type) never have a portal login at all, but a
  // Business Client does — deleting only ever removed the customers record,
  // leaving their users/{email} profile and Firebase Auth account untouched,
  // so a "deleted" Business Client could still sign in.
  const handleDeleteProfile = async () => {
    if (deleteNic) {
      const targetCustomer = customers.find(c => c.nic === deleteNic);
      const email = (targetCustomer?.email || '').trim().toLowerCase();
      const matchingUser = email ? users.find(u => u.identifier?.toLowerCase() === email && u.role === 'Business Client') : null;

      setCustomers(prev => prev.filter(c => c.nic !== deleteNic));
      if (selectedCustomer?.nic === deleteNic) {
        setSelectedCustomer(null);
      }

      const targetNic = deleteNic;
      setDeleteNic(null);

      try {
        await deleteDocument(COLLECTIONS.CUSTOMERS, targetNic);
        if (matchingUser) {
          await deleteDocument(COLLECTIONS.USERS, matchingUser.identifier);
          if (setUsers) {
            setUsers(prev => prev.filter(u => u.identifier !== matchingUser.identifier));
          }
          await deleteUserAccount(matchingUser.identifier);
        }
        toast.success(matchingUser ? "Customer removed and their login permanently revoked" : "Customer profile deleted");
        logActivity(currentUser?.identifier, currentUser?.name, 'DELETE', 'Customers', `Removed customer ${targetCustomer?.name || targetNic}${matchingUser ? ' and revoked their login' : ''}`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete customer profile from DB");
      }
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-6">
      {/* Standardized Header */}
      <PageHeader
        title="Customers"
        subtitle="Centralized client registry, relationship profiles, order histories, and communications."
        metrics={[
          { label: "Total Clients", value: customers.length, color: "cyan" },
          { label: "Business", value: businessCount, color: "amber" },
          { label: "Individual", value: individualCount, color: "emerald" }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowContactSync(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-container border border-outline-variant hover:border-primary/40 text-on-surface rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0"
              title="Sync Google Contacts & WhatsApp"
            >
              <Users size={15} className="text-primary" />
              <span className="hidden sm:inline">Sync Contacts</span>
            </button>
            {canAccess(currentUser?.role, 'customers', 'export') && (
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-container border border-outline-variant hover:border-primary/40 text-on-surface rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0"
                title="Export filtered customer list to CSV"
              >
                <Download size={15} className="text-primary" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
            {canAccess(currentUser?.role, 'customers', 'create') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.25)] active:scale-95 flex-shrink-0"
              >
                <Plus size={16} />
                <span>Register Client</span>
              </button>
            )}
          </div>
        }
      />

      {/* Standardized Filter & Search Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by client name, NIC/BRN, company, phone, email..."
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        filterOptions={[
          { id: 'all', label: 'All Clients', count: customers.length },
          { id: 'business', label: 'Corporate & Business', count: businessCount },
          { id: 'individual', label: 'Individual', count: individualCount }
        ]}
        totalCount={customers.length}
        filteredCount={filteredCustomers.length}
      />

      {/* Main Grid Content */}
      <div className="flex-1 flex lg:flex-row flex-col gap-6 overflow-hidden min-h-0">
        {/* Left Column: Client List */}
        <div className={`w-full lg:w-1/3 ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'} flex-col border border-outline-variant/60 bg-surface-container/60 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full`}>
          <div className="bg-surface-container-low/80 p-3.5 px-4 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider flex-shrink-0">
            <span className="flex items-center gap-2">
              <User size={14} className="text-primary" />
              Client Registry ({filteredCustomers.length})
            </span>
            <span className="text-[10px] text-on-surface-variant/70 lowercase font-medium">
              click to inspect
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
            {filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-sm font-medium">
                <User size={36} className="mx-auto mb-3 opacity-25 text-on-surface-variant" />
                <p className="font-bold text-on-surface">No client records found</p>
                <p className="text-xs text-on-surface-variant mt-1">Try adjusting your search query or category filter.</p>
              </div>
            ) : (
              filteredCustomers.map(customer => {
                const isSelected = selectedCustomer?.nic === customer.nic;
                const isBiz = customer.type === 'Business';
                return (
                  <div
                    key={customer.nic}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setMobileView('detail');
                    }}
                    className={`p-4 cursor-pointer transition-all flex items-center space-x-3.5 ${
                      isSelected 
                        ? 'bg-primary/10 border-l-4 border-primary shadow-inner' 
                        : 'hover:bg-surface-container-high/40 border-l-4 border-transparent'
                    }`}
                  >
                    <UserAvatar user={customer} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="font-bold text-xs text-on-surface truncate">
                          {isBiz && customer.businessName ? customer.businessName : customer.name}
                        </h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          isBiz ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary'
                        }`}>
                          {customer.type || 'Individual'}
                        </span>
                      </div>
                      
                      {isBiz && customer.businessName && (
                        <p className="text-[11px] text-on-surface-variant font-medium truncate mb-0.5">
                          Attn: {customer.name}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-mono">
                        <span>{customer.nic}</span>
                        {customer.phone && (
                          <>
                            <span>•</span>
                            <span className="truncate">{customer.phone}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={14} className={`text-on-surface-variant/40 transition-transform ${isSelected ? 'text-primary translate-x-0.5' : ''}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Customer Profile Inspector */}
        <div className={`w-full lg:w-2/3 ${mobileView === 'list' ? 'hidden lg:block' : 'block'} h-full overflow-y-auto custom-scrollbar pr-1`}>
          {selectedCustomer ? (
            <div className="space-y-6">
              {/* Mobile Back to List Button */}
              <button 
                onClick={() => setMobileView('list')}
                className="lg:hidden flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3.5 py-2 rounded-xl border border-primary/30 active:scale-95 transition-all w-fit cursor-pointer mb-2"
              >
                <ArrowLeft size={14} /> Back to Client Directory
              </button>

              {/* Profile Master Card */}
              <div className="bg-surface-container/70 border border-outline-variant/60 rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.2)] relative overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                  <div className="flex items-start space-x-5">
                    <UserAvatar user={selectedCustomer} size="xl" className="shadow-md" />
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                          {selectedCustomer.name}
                        </h2>
                        <StatusBadge 
                          status={selectedCustomer.type === 'Business' ? 'Business Client' : 'Individual Client'} 
                          size="xs"
                        />
                      </div>

                      {selectedCustomer.businessName && (
                        <p className="flex items-center text-xs sm:text-sm font-bold text-primary mb-2">
                          <Building size={14} className="mr-1.5 flex-shrink-0" />
                          {selectedCustomer.businessName}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-on-surface-variant font-mono mt-1 flex-wrap">
                        <span className="bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant/60">
                          ID: {selectedCustomer.nic}
                        </span>
                        <span>Joined: {selectedCustomer.dateJoined || 'Active'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl text-center border border-primary/20">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total Orders</p>
                      <p className="text-xl font-extrabold">{selectedCustomer.orders || 1}</p>
                    </div>
                    {canAccess(currentUser?.role, 'customers', 'delete') && (
                      <button
                        onClick={() => setDeleteNic(selectedCustomer.nic)}
                        className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20"
                        title="Delete customer profile"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact Directory Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-surface-container-low/70 rounded-2xl border border-outline-variant/50">
                  <div className="flex items-center text-xs text-on-surface-variant">
                    <Mail size={14} className="mr-2.5 text-primary opacity-75 flex-shrink-0" />
                    <span className="font-medium truncate">{selectedCustomer.email || 'No email registered'}</span>
                  </div>
                  <div className="flex items-center text-xs text-on-surface-variant">
                    <Phone size={14} className="mr-2.5 text-primary opacity-75 flex-shrink-0" />
                    <span className="font-mono font-medium">{selectedCustomer.phone || 'No phone registered'}</span>
                  </div>
                  {selectedCustomer.address && (
                    <div className="flex items-start text-xs text-on-surface-variant sm:col-span-2 pt-1 border-t border-outline-variant/30">
                      <MapPin size={14} className="mr-2.5 mt-0.5 text-primary opacity-75 flex-shrink-0" />
                      <span className="leading-relaxed">{selectedCustomer.address}</span>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="mt-6 pt-5 border-t border-outline-variant/50 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleGenerateWhatsAppMsg(selectedCustomer)}
                    className="px-4 py-2 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 active:scale-95 shadow-sm"
                  >
                    <Sparkles size={14} />
                    <span>Generate AI WhatsApp Draft</span>
                  </button>

                  {selectedCustomer.phone && (
                    <a
                      href={`tel:${selectedCustomer.phone}`}
                      className="px-4 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-outline-variant/60 rounded-xl text-xs font-bold transition-all flex items-center space-x-2"
                    >
                      <Phone size={14} />
                      <span>Call Client</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Stats & History Sub-panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Journey Log: Leads & Deals */}
                <div className="bg-surface-container/70 border border-outline-variant/60 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center">
                      <FileText size={14} className="mr-2 text-primary" />
                      Journey Log (Leads & Deals)
                    </h3>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {stats?.deals.length || 0} linked
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                    {stats?.deals.length === 0 ? (
                      <div className="text-center py-8 text-on-surface-variant/60 text-xs italic">
                        No historical leads or deals recorded for this client.
                      </div>
                    ) : (
                      stats?.deals.map(deal => (
                        <div key={deal.id} className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/50 hover:border-primary/40 transition-colors">
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="font-bold text-xs text-on-surface truncate pr-2">
                              {deal.jobScope || 'Custom Steel Frame Job'}
                            </span>
                            <StatusBadge status={deal.stage || 'Intake'} size="xs" />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-mono pt-1 border-t border-outline-variant/30">
                            <span>LKR {Number(deal.value || 0).toLocaleString()}</span>
                            <span>{deal.date}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Fabrication Floor Records */}
                <div className="bg-surface-container/70 border border-outline-variant/60 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center">
                      <Clock size={14} className="mr-2 text-cyan-400" />
                      Fabrication Floor Records
                    </h3>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {stats?.projects.length || 0} jobs
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                    {stats?.projects.length === 0 ? (
                      <div className="text-center py-8 text-on-surface-variant/60 text-xs italic">
                        No active or historical shop fabrication logs found.
                      </div>
                    ) : (
                      stats?.projects.map(proj => (
                        <div key={proj.jobNo} className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/50 hover:border-primary/40 transition-colors">
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="font-bold text-xs text-on-surface font-mono">{proj.jobNo}</span>
                            <StatusBadge status={proj.status || 'Fabricating'} size="xs" />
                          </div>
                          <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2 mb-1.5">
                            {proj.scope || 'Custom Box-Bar Canvas Framing'}
                          </p>
                          <div className="text-[10px] text-on-surface-variant/70 font-medium">
                            Tech: {proj.assignee || 'Unassigned'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Financial Invoices */}
                <div className="bg-surface-container/70 border border-outline-variant/60 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.15)] md:col-span-2">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center">
                      <DollarSign size={14} className="mr-1.5 text-emerald-400" />
                      Financial Invoices & Settlements
                    </h3>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {stats?.invoices.length || 0} invoices
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {stats?.invoices.length === 0 ? (
                      <div className="text-center py-8 text-on-surface-variant/60 text-xs italic col-span-full">
                        No invoices generated for this client yet.
                      </div>
                    ) : (
                      stats?.invoices.map(inv => (
                        <div key={inv.id} className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 flex justify-between items-center hover:border-primary/40 transition-colors">
                          <div>
                            <p className="text-xs font-bold text-on-surface font-mono mb-0.5">{inv.id}</p>
                            <p className="text-[10px] text-on-surface-variant">{inv.date || 'Recent'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-on-surface font-mono">
                              LKR {Number(inv.amount || 0).toLocaleString()}
                            </p>
                            <StatusBadge status={inv.status || 'Unpaid'} size="xs" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Unified Interaction Timeline (Item 14) */}
                <div className="bg-surface-container/70 border border-outline-variant/60 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.15)] md:col-span-2">
                  <ActivityTimeline events={timelineEvents} title="Unified Client Interaction Timeline" />
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/60 rounded-3xl text-on-surface-variant bg-surface-container/40 p-8 text-center">
              <User size={56} className="mb-3 opacity-20 text-on-surface" />
              <h3 className="font-bold text-base text-on-surface">No Customer Selected</h3>
              <p className="text-xs max-w-sm text-on-surface-variant mt-1.5 leading-relaxed">
                Select a client from the registry on the left to view their complete journey, order metrics, fabrication jobs, and billing records.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Standardized Create Customer Modal */}
      {showCreateModal && (
        <ModalWrapper
          isOpen={showCreateModal}
          onClose={closeCreateModal}
          maxWidth="max-w-lg"
          height="h-auto max-h-[85vh]"
          ariaLabel="Register New Client Profile"
        >
          <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-low flex justify-between items-center flex-shrink-0">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-on-surface">
                Register Client Profile
              </h3>
              <p className="text-[10px] uppercase font-bold text-primary tracking-widest mt-0.5">
                Client Relationship Management
              </p>
            </div>
            <button
              onClick={closeCreateModal}
              className="p-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-variant transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
            {/* Duplicate Candidate Detection Alert (Item 20) */}
            {duplicateCandidates.length > 0 && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <AlertTriangle size={15} />
                  <span>Possible duplicate profile(s) found in database:</span>
                </div>
                <div className="space-y-1.5 max-h-[130px] overflow-y-auto custom-scrollbar">
                  {duplicateCandidates.map(({ customer: c, score, reasons }) => (
                    <div 
                      key={c.nic}
                      onClick={() => {
                        setSelectedCustomer(c);
                        closeCreateModal();
                        toast.info(`Switched to existing profile: ${c.name}`);
                      }}
                      className="p-2.5 bg-surface-container-low/90 hover:bg-surface-container-high rounded-xl border border-outline-variant/50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="font-bold text-on-surface">{c.name}</span>
                        {c.businessName && <span className="text-[10px] text-on-surface-variant ml-1.5">({c.businessName})</span>}
                        <p className="text-[9px] text-on-surface-variant/80 font-mono mt-0.5">{reasons.join(' · ')}</p>
                      </div>
                      <span className="text-[9px] font-bold text-primary bg-primary/15 border border-primary/30 px-2 py-0.5 rounded-lg flex-shrink-0">
                        Use Existing Profile
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Type selector */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-1 rounded-xl border border-outline-variant">
                {['Individual', 'Business'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewProfile(prev => ({ ...prev, type }))}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      newProfile.type === type 
                        ? 'bg-primary text-on-primary shadow-sm' 
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                Identification (NIC / BRN / Passport) *
              </label>
              <input
                type="text"
                placeholder="e.g. 199012345678 or PV123456"
                value={newProfile.nic}
                onChange={(e) => setNewProfile(prev => ({ ...prev, nic: e.target.value }))}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/50 text-on-surface outline-none font-mono"
              />
            </div>

            {newProfile.type === 'Business' && (
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Silva Art Gallery Pvt Ltd"
                  value={newProfile.businessName}
                  onChange={(e) => setNewProfile(prev => ({ ...prev, businessName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/50 text-on-surface outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                Primary Contact Name *
              </label>
              <input
                type="text"
                placeholder="Client Name"
                value={newProfile.name}
                onChange={(e) => setNewProfile(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/50 text-on-surface outline-none"
              />
            </div>

            {/* Customer Avatar Upload Section */}
            <div className="flex items-center gap-4 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/60">
              <UserAvatar 
                user={{ name: newProfile.name || newProfile.businessName || 'Client', photoURL: newProfile.photoURL, role: newProfile.type === 'Business' ? 'business client' : 'customer' }} 
                size="lg" 
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-on-surface">Client Avatar / Business Logo</p>
                <p className="text-[10px] text-on-surface-variant">Upload and crop a brand logo or personal photo</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera size={12} />
                    <span>{newProfile.photoURL ? 'Change & Crop' : 'Upload & Crop'}</span>
                  </button>
                  {newProfile.photoURL && (
                    <button
                      type="button"
                      onClick={() => setNewProfile(prev => ({ ...prev, photoURL: '' }))}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomerPhotoUpload}
                  className="hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                  Phone (LK)
                </label>
                <div className="flex bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
                  <div className="flex items-center px-3 bg-surface-container border-r border-outline-variant text-xs font-bold text-on-surface-variant select-none">
                    +94
                  </div>
                  <input 
                    type="text"
                    value={newProfile.phone ? newProfile.phone.replace('+94', '') : ''}
                    onChange={(e) => {
                       const val = e.target.value.replace(/[^\d]/g, '').substring(0, 9);
                       setNewProfile(prev => ({ ...prev, phone: val ? '+94' + val : '' }));
                    }}
                    className="w-full px-3 py-2.5 bg-transparent text-sm focus:outline-none text-on-surface font-mono"
                    placeholder="7XXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="client@domain.com"
                  value={newProfile.email}
                  onChange={(e) => setNewProfile(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/50 text-on-surface outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">
                  Delivery / Site Address
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddressPicker(true)}
                  className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  <MapPin size={11} /> Select on Google Maps
                </button>
              </div>
              <input
                type="text"
                placeholder="123 Galle Road, Colombo 03"
                value={newProfile.address}
                onChange={(e) => setNewProfile(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/50 text-on-surface outline-none"
              />
            </div>
          </div>

          <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low flex justify-end space-x-3 flex-shrink-0">
            <button
              onClick={closeCreateModal}
              className="px-5 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-colors border border-outline-variant/60"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProfile}
              disabled={!newProfile.nic || !newProfile.name}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,218,243,0.2)] active:scale-95 disabled:opacity-50"
            >
              Save Profile
            </button>
          </div>
        </ModalWrapper>
      )}

      {/* Standardized WhatsApp AI Draft Modal */}
      {showDraftModal && (
        <ModalWrapper
          isOpen={showDraftModal}
          onClose={() => setShowDraftModal(false)}
          maxWidth="max-w-md"
          height="h-auto max-h-[85vh]"
          ariaLabel="WhatsApp Message Draft"
        >
          <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-low flex justify-between items-center flex-shrink-0">
            <h3 className="font-bold text-on-surface flex items-center uppercase tracking-widest text-xs">
              <Sparkles size={16} className="mr-2 text-emerald-400" />
              AI WhatsApp Draft
            </h3>
            <button onClick={() => setShowDraftModal(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4">
            <textarea
              className="w-full h-44 p-4 bg-surface-container-low border border-outline-variant rounded-2xl text-xs text-on-surface leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 font-sans custom-scrollbar"
              value={isDraftingMsg ? "Consulting Gemini AI for the client check-in..." : whatsappDraft}
              onChange={(e) => setWhatsappDraft(e.target.value)}
              placeholder="Message draft text..."
            />
          </div>

          <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low flex space-x-3 flex-shrink-0">
            <button
              onClick={() => {
                navigator.clipboard.writeText(whatsappDraft);
                toast.success("Draft copied to clipboard!");
              }}
              className="flex-1 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded-xl text-xs font-bold hover:border-primary hover:text-primary transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Copy size={13} />
              <span>Copy</span>
            </button>
            <button
              onClick={() => setShowDraftModal(false)}
              className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Check size={13} />
              <span>Done</span>
            </button>
          </div>
        </ModalWrapper>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={!!deleteNic}
        onClose={() => setDeleteNic(null)}
        onConfirm={handleDeleteProfile}
        title="Delete Customer Profile?"
        message={
          deleteCustomerHasLogin
            ? "Are you sure you want to permanently delete this customer? This also permanently deletes their portal login (Firebase account included) — they will not be able to sign in afterward, and this cannot be undone."
            : "Are you sure you want to permanently delete this customer? All historical links and records will be removed from the view."
        }
      />

      {/* Image Crop & Adjuster Modal */}
      <ImageCropModal
        isOpen={showCropModal}
        imageSrc={rawImageForCrop}
        onCropComplete={handleCustomerCropComplete}
        onClose={() => setShowCropModal(false)}
      />

      {/* Google Contacts & WhatsApp Sync Modal */}
      <ContactSyncModal
        isOpen={showContactSync}
        onClose={() => setShowContactSync(false)}
        onImportContacts={handleImportContacts}
      />

      {/* Address Picker Modal */}
      <AddressPickerModal
        isOpen={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        onSelect={(loc) => {
          setNewProfile(prev => ({ ...prev, address: loc.address }));
          toast.success('Address selected from Google Maps!');
        }}
        initialAddress={newProfile.address}
      />
    </div>
  );
}

