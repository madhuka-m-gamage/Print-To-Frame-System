import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, Shield, User, Mail, Briefcase, Plus, Check, X, Trash2, 
  KeyRound, Clock, Edit2, Save, ChevronRight, Phone, ShieldCheck,
  UserCheck, AlertCircle, Camera, Sparkles, ArrowLeft, Send, Eye,
  Building, CheckCircle2, Copy, PhoneCall, Lock, RefreshCw, Layers
} from 'lucide-react';
import DeleteModal from '../common/DeleteModal';
import { doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { toast } from '../../utils/toast';
import { subscribeToCollection, addDocument, updateDocument, COLLECTIONS } from '../../services/firestoreSync';
import { 
  PageHeader, FilterBar, StatusBadge, ModalWrapper, UserAvatar, 
  ImageCropModal, EmailTemplateModal 
} from '../common/ui';
import { SYSTEM_ROLES, ROLE_METADATA, getRoleCategory } from '../../constants/roles';
import { formatPhone } from '../../utils/validation';
import { usePermissions } from '../../context/PermissionsContext';
import { logActivity } from '../../services/auditLog';
import { createUserAccount, deleteUserAccount, resetUserPassword } from '../../services/adminUsers';
import { sendTemplatedEmail } from '../../services/mailer';

export default function AgentDatabase({ 
  users = [], 
  setUsers, 
  pendingUsers = [],
  setPendingUsers,
  partnerApplications = [],
  currentUser,
  onApprove,
  onReject,
  partners = [],
  setPartners,
  customers = [],
  setCustomers,
  dataStore
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'employees' | 'clients'
  const [workspaceTab, setWorkspaceTab] = useState('rbac'); // 'rbac' | 'profile' | 'audit' | 'security'
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail'
  const [deleteId, setDeleteId] = useState(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const photoInputRef = useRef(null);

  // Image Crop Modal state
  const [rawImageForCrop, setRawImageForCrop] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Direct User Creation Modal State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    name: '',
    identifier: '',
    password: '',
    contactNumber: '',
    role: 'Sales',
    company: '',
    specialty: '',
  });

  // Review Registration Modal State
  const [reviewingApplicant, setReviewingApplicant] = useState(null);
  const [selectedReviewRole, setSelectedReviewRole] = useState('Sales');
  // Only used for _source === 'partner_application' items, which have no Firebase
  // Auth account yet and need one created at approval time.
  const [reviewPassword, setReviewPassword] = useState('');
  const [isApprovingReview, setIsApprovingReview] = useState(false);

  // Email Template Modal State
  const [emailModalConfig, setEmailModalConfig] = useState({
    isOpen: false,
    recipient: null,
    initialTemplateId: null,
  });

  React.useEffect(() => {
    const unsub = subscribeToCollection(COLLECTIONS.AUDIT_LOG, setAuditLogs);
    return () => unsub();
  }, []);

  const { canAccess } = usePermissions();
  // Drives every user-management control on this page (enroll, edit, delete,
  // role/status change) — was previously a hardcoded role==='Admin' check that
  // ignored the configurable Permissions Manager (see 'agents' module).
  const isAdmin = canAccess(currentUser?.role, 'agents', 'edit');

  // 1. DECOUPLE PARTNERS: Filter out users with role 'Partner' (since partners are managed in Partners tab)
  const nonPartnerUsers = useMemo(() => {
    return users.filter(u => u.role !== 'Partner');
  }, [users]);

  // Every registration request reviewed in one place: self-registered pendingUsers
  // (Partner requests included — those used to be filtered out here entirely, with
  // no review surface at all once the Partners tab's own vetting queue was removed)
  // plus public "Apply as a Partner" submissions, normalized to the same shape.
  // Applications carry no Firebase Auth account yet (unlike self-registration, which
  // creates one at signup) — `_source` is how the approval/rejection handlers below
  // know to create that account first, and which collection to update.
  const pendingReviewItems = useMemo(() => {
    const normalizedApplications = partnerApplications
      .filter(app => !app.status || app.status === 'Pending Review')
      .map(app => ({
        identifier: (app.email || '').trim().toLowerCase(),
        name: app.contactPerson || app.studioName || app.name || app.email,
        role: 'Partner',
        mobile: app.phone || app.contactNumber || '',
        company: app.studioName || app.name || '',
        specialty: app.specialty || '',
        _source: 'partner_application',
        _appDocId: app._firestoreId || app.id,
      }));
    return [...pendingUsers, ...normalizedApplications];
  }, [pendingUsers, partnerApplications]);

  const employeeCount = useMemo(() => {
    return nonPartnerUsers.filter(u => getRoleCategory(u.role) !== 'Clients').length;
  }, [nonPartnerUsers]);

  const clientCount = useMemo(() => {
    return nonPartnerUsers.filter(u => u.role === 'Business Client' || u.role === 'Customer').length;
  }, [nonPartnerUsers]);

  const filteredUsers = useMemo(() => {
    return nonPartnerUsers.filter(u => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || (
        u.name?.toLowerCase().includes(query) ||
        u.identifier?.toLowerCase().includes(query) ||
        u.role?.toLowerCase().includes(query) ||
        u.company?.toLowerCase().includes(query) ||
        u.contactNumber?.toLowerCase().includes(query)
      );

      if (!matchesSearch) return false;

      if (activeTab === 'employees') return getRoleCategory(u.role) !== 'Clients';
      if (activeTab === 'clients') return u.role === 'Business Client' || u.role === 'Customer';
      return true;
    });
  }, [nonPartnerUsers, searchQuery, activeTab]);

  // Auto-select first member if none selected
  React.useEffect(() => {
    if (!selectedAgent && filteredUsers.length > 0) {
      setSelectedAgent(filteredUsers[0]);
      setEditForm({ ...filteredUsers[0] });
    }
  }, [selectedAgent, filteredUsers]);

  const handleAgentPhotoUpload = (e) => {
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

  const handleAgentCropComplete = async (croppedBase64) => {
    if (!selectedAgent) return;
    try {
      await updateDoc(doc(db, "users", selectedAgent.identifier), { photoURL: croppedBase64 });
      setUsers(prev => prev.map(u => u.identifier === selectedAgent.identifier ? { ...u, photoURL: croppedBase64 } : u));
      setSelectedAgent(prev => ({ ...prev, photoURL: croppedBase64 }));
      toast.success("Profile photo updated successfully!");
    } catch (err) {
      toast.error("Failed to update photo: " + err.message);
    }
  };

  // Deleting a user previously only removed their Firestore profile — the
  // Firebase Auth account (and therefore their ability to sign in) was left
  // completely untouched, and re-enrolling the same email later would fail
  // with auth/email-already-exists since the "deleted" account still existed.
  const handleDeleteAgent = async () => {
    if (deleteId) {
      try {
        await deleteDoc(doc(db, "users", deleteId));
        setUsers(prev => prev.filter(u => u.identifier !== deleteId));
        await deleteUserAccount(deleteId);
        if (selectedAgent?.identifier === deleteId) {
          setSelectedAgent(null);
        }
        setDeleteId(null);
        toast.success("User access revoked and login permanently deleted");
        logActivity(currentUser?.identifier, currentUser?.name, 'DELETE', 'Admin', `Revoked access and deleted login for ${deleteId}`);
      } catch (err) {
        toast.error("Error removing user: " + err.message);
      }
    }
  };

  const handleRoleChange = async (newRole) => {
    if (!selectedAgent) return;
    try {
      const previousRole = selectedAgent.role;
      await updateDoc(doc(db, "users", selectedAgent.identifier), { role: newRole });
      setUsers(prev => prev.map(u => u.identifier === selectedAgent.identifier ? { ...u, role: newRole } : u));
      setSelectedAgent(prev => ({ ...prev, role: newRole }));
      toast.success(`Role updated to ${newRole}`);
      logActivity(currentUser?.identifier, currentUser?.name, 'ROLE_CHANGE', 'Admin', `Changed role for ${selectedAgent.identifier} from ${previousRole} to ${newRole}`);
    } catch (err) {
      toast.error("Error updating role: " + err.message);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedAgent) return;
    const newStatus = selectedAgent.status === 'Deactivated' ? 'Active' : 'Deactivated';
    try {
      await updateDoc(doc(db, "users", selectedAgent.identifier), { status: newStatus });
      setUsers(prev => prev.map(u => u.identifier === selectedAgent.identifier ? { ...u, status: newStatus } : u));
      setSelectedAgent(prev => ({ ...prev, status: newStatus }));
      toast.success(`User account ${newStatus === 'Active' ? 'Reactivated' : 'Deactivated'}`);
      logActivity(currentUser?.identifier, currentUser?.name, 'STATUS_CHANGE', 'Admin', `Set ${selectedAgent.identifier}'s account status to ${newStatus}`);
    } catch (err) {
      toast.error("Failed to change account status: " + err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedAgent) return;
    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsResettingPassword(true);
    try {
      await resetUserPassword(selectedAgent.identifier, resetPasswordValue);
      toast.success(`Password reset for ${selectedAgent.identifier}`);
      logActivity(currentUser?.identifier, currentUser?.name, 'PASSWORD_RESET', 'Admin', `Reset the password for ${selectedAgent.identifier}`);
      try {
        await sendTemplatedEmail(selectedAgent.identifier, 'password_reset', {
          recipientName: selectedAgent.name,
          loginEmail: selectedAgent.identifier,
          tempPassword: resetPasswordValue,
          senderName: currentUser?.name,
        });
      } catch (mailErr) {
        toast.error(`Password was reset, but the notification email failed to send: ${mailErr.message}`);
      }
      setShowResetPasswordForm(false);
      setResetPasswordValue('');
    } catch (err) {
      toast.error("Failed to reset password: " + err.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedAgent) return;
    try {
      const updates = {
        name: editForm.name || selectedAgent.name,
        contactNumber: editForm.contactNumber || selectedAgent.contactNumber || "",
        company: editForm.company || selectedAgent.company || "",
        location: editForm.location || selectedAgent.location || "",
        jobTitle: editForm.jobTitle || selectedAgent.jobTitle || "",
        bio: editForm.bio || selectedAgent.bio || "",
      };
      await updateDoc(doc(db, "users", selectedAgent.identifier), updates);
      setUsers(prev => prev.map(u => u.identifier === selectedAgent.identifier ? { ...u, ...updates } : u));
      setSelectedAgent(prev => ({ ...prev, ...updates }));
      setIsEditing(false);
      toast.success("Member details updated successfully");
    } catch (err) {
      toast.error("Failed to save changes: " + err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createUserForm.name || !createUserForm.identifier) {
      toast.error("Please fill in required fields");
      return;
    }
    if (!createUserForm.password || createUserForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const emailKey = createUserForm.identifier.trim().toLowerCase();

      // Create the real Firebase Auth account FIRST — this is what was missing
      // entirely before. Without it, the Firestore profile below is the only
      // thing that exists, and email/password login is impossible no matter
      // what else is fixed. If this fails (e.g. the email is already taken),
      // stop here rather than writing a Firestore profile with no matching
      // Auth account.
      await createUserAccount(emailKey, createUserForm.password, createUserForm.name);

      const newUser = {
        name: createUserForm.name,
        identifier: emailKey,
        role: createUserForm.role,
        contactNumber: createUserForm.contactNumber,
        company: createUserForm.company,
        specialty: createUserForm.specialty,
        status: 'Active',
        isApproved: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", emailKey), newUser);
      setUsers(prev => [...prev.filter(u => u.identifier !== emailKey), newUser]);
      setShowCreateUserModal(false);
      const enrolledPassword = createUserForm.password;
      setCreateUserForm({
        name: '',
        identifier: '',
        password: '',
        contactNumber: '',
        role: 'Sales',
        company: '',
        specialty: '',
      });
      logActivity(currentUser?.identifier, currentUser?.name, 'ENROLL', 'Admin', `Enrolled ${newUser.name} (${emailKey}) as ${newUser.role}`);

      // Fire the invite email automatically — this is the other half of the
      // original bug (a toast claiming an email was sent when nothing was
      // ever dispatched). A failure here doesn't roll back the account: the
      // user was genuinely created and can already log in, so tell the admin
      // exactly what happened instead of hiding a partial failure.
      try {
        await sendTemplatedEmail(emailKey, 'employee_invite', {
          recipientName: newUser.name,
          assignedRole: newUser.role,
          loginEmail: emailKey,
          tempPassword: enrolledPassword,
          senderName: currentUser?.name,
        });
        toast.success(`User ${newUser.name} enrolled as ${newUser.role} and invited by email.`);
      } catch (mailErr) {
        toast.error(`User ${newUser.name} was enrolled, but the invite email failed to send: ${mailErr.message}`);
      }
    } catch (err) {
      toast.error("Failed to create user: " + err.message);
    }
  };

  const handleOpenReview = (user) => {
    setReviewingApplicant(user);
    setSelectedReviewRole(user.role || 'Sales');
    setReviewPassword('');
  };

  // Takes the user/role explicitly rather than always reading them off state —
  // the Quick Approve button used to call setSelectedReviewRole() then invoke
  // this in the same click handler, but a state setter doesn't take effect
  // until the next render, so it was always approving with whatever role
  // selectedReviewRole happened to already hold, not the one just "set".
  //
  // A `partner_application` item has no Firebase Auth account yet — unlike a
  // self-registered pendingUser, which already created one at signup — so
  // approving it here has to create that account first, using a password the
  // admin sets in the review modal, then send the invite email that relays it.
  const handleExecuteApproval = async (user, role) => {
    const targetUser = user || reviewingApplicant;
    const finalRole = role || selectedReviewRole;
    if (!targetUser) return;

    const fromApplication = targetUser._source === 'partner_application';
    if (fromApplication && (!reviewPassword || reviewPassword.length < 6)) {
      toast.error('Set an initial password (at least 6 characters) to approve this application.');
      return;
    }

    setIsApprovingReview(true);
    try {
      if (fromApplication) {
        await createUserAccount(targetUser.identifier, reviewPassword, targetUser.name);
      }

      // Strip the internal bookkeeping fields before this becomes part of the
      // stored users/{email} document — onApprove spreads regData as-is.
      const { _source, _appDocId, ...regData } = targetUser;
      if (onApprove) {
        // The welcome/activation email fires from Partners.jsx/Customers.jsx once
        // the admin completes the handed-off Register Partner/Client form, not
        // here — the real partnerId/customerId isn't known yet at this point, and
        // an email referencing a placeholder id is worse than a slightly later one.
        await onApprove(regData, finalRole, { tempPassword: fromApplication ? reviewPassword : undefined });
      }

      if (fromApplication && _appDocId) {
        await updateDocument(COLLECTIONS.PARTNER_APPLICATIONS, _appDocId, { status: 'Approved' });
      }

      setReviewingApplicant(null);
      setReviewPassword('');
      toast.success(`Approved ${targetUser.name} as ${finalRole}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve: ' + err.message);
    } finally {
      setIsApprovingReview(false);
    }
  };

  const handleExecuteRejection = async (user) => {
    const fromApplication = user._source === 'partner_application';
    if (fromApplication) {
      if (user._appDocId) {
        await updateDocument(COLLECTIONS.PARTNER_APPLICATIONS, user._appDocId, { status: 'Rejected' });
      }
    } else {
      setPendingUsers(prev => prev.filter(u => u.identifier !== user.identifier));
      if (onReject) await onReject(user.identifier);
    }
    if (reviewingApplicant?.identifier === user.identifier) setReviewingApplicant(null);
    try {
      await sendTemplatedEmail(user.identifier, 'registration_declined', {
        recipientName: user.name,
        senderName: currentUser?.name,
      });
    } catch (mailErr) {
      console.error('Failed to send decline notification:', mailErr);
    }
    toast.info("Registration request dismissed");
  };

  const userAuditLogs = useMemo(() => {
    if (!selectedAgent) return [];
    return auditLogs.filter(log => log.userId === selectedAgent.identifier || log.user === selectedAgent.name)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }, [auditLogs, selectedAgent]);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-6">
      {/* Standardized Header matching Leads, Customers, and Partners */}
      <PageHeader
        title="User Management"
        subtitle="Manage authenticated internal identities, dynamic RBAC role assignments, and client accounts."
        metrics={[
          { label: "Total Members", value: nonPartnerUsers.length, color: "cyan" },
          { label: "Internal Team", value: employeeCount, color: "emerald" },
          { label: "Client Accounts", value: clientCount, color: "purple" },
          { label: "Pending Approvals", value: pendingReviewItems.length, color: pendingReviewItems.length > 0 ? "warning" : "neutral" }
        ]}
        actions={
          isAdmin && (
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.25)] active:scale-95 flex-shrink-0 cursor-pointer"
            >
              <Plus size={16} />
              <span>Enroll New Member</span>
            </button>
          )
        }
      />

      {/* Standardized Filter & Search Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search members by name, email, company, phone, or role..."
        activeFilter={activeTab}
        onFilterChange={setActiveTab}
        filterOptions={[
          { id: 'all', label: 'All Members', count: nonPartnerUsers.length },
          { id: 'employees', label: 'Internal Team', count: employeeCount },
          { id: 'clients', label: 'Corporate & Retail Clients', count: clientCount }
        ]}
        totalCount={nonPartnerUsers.length}
        filteredCount={filteredUsers.length}
      />

      {/* Pending Registrations Callout (Admin Only) */}
      {isAdmin && pendingReviewItems.length > 0 && (
        <div className="mb-6 p-4 sm:p-5 bg-surface-container/90 border-2 border-primary/40 rounded-3xl shadow-[0_8px_30px_rgba(0,218,243,0.12)] flex-shrink-0 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/20 text-primary rounded-lg">
                <Shield size={16} />
              </div>
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider">
                Registration Applications Awaiting Review
              </h3>
            </div>
            <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full font-black uppercase tracking-wider">
              {pendingReviewItems.length} Requests Pending
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingReviewItems.map(user => (
              <div 
                key={user.identifier} 
                className="p-4 bg-surface-container-low/90 rounded-2xl border border-outline-variant/60 hover:border-primary/50 transition-all flex items-center justify-between shadow-sm"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-extrabold text-on-surface truncate">{user.name}</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md border bg-rose-500/15 text-rose-400 border-rose-500/30">
                      {user.role || 'Member'}
                    </span>
                    {user._source === 'partner_application' && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md border bg-amber-500/15 text-amber-400 border-amber-500/30">
                        Applied via Portal
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-mono truncate mt-0.5">{user.identifier}</p>
                  {user.company && (
                    <p className="text-[10px] text-primary font-semibold truncate mt-0.5">🏢 {user.company}</p>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleOpenReview(user)}
                    className="p-2 bg-primary/15 text-primary border border-primary/30 rounded-xl hover:bg-primary/25 transition-colors cursor-pointer"
                    title="Review Full Dossier"
                  >
                    <Eye size={14} />
                  </button>
                  {user._source !== 'partner_application' && (
                    <button
                      onClick={() => handleExecuteApproval(user, user.role || 'Sales')}
                      className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
                      title="Quick Approve (keeps their requested role as-is)"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleExecuteRejection(user)}
                    className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-colors cursor-pointer"
                    title="Decline"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Master-Detail 2-Panel View (Compact & Robust Showcase Style) */}
      <div className="flex-1 flex lg:flex-row flex-col gap-6 overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: User Registry (1/3 Width) */}
        <div className={`w-full lg:w-1/3 ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'} flex-col border border-outline-variant/60 bg-surface-container/60 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full`}>
          <div className="bg-surface-container-low/80 p-3.5 px-4 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider flex-shrink-0">
            <span className="flex items-center gap-2">
              <UserCheck size={14} className="text-primary" />
              Enrolled Members ({filteredUsers.length})
            </span>
            <span className="text-[10px] text-on-surface-variant/70 lowercase font-medium">
              click to inspect
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-sm font-medium">
                <User size={36} className="mx-auto mb-3 opacity-25 text-on-surface-variant" />
                <p className="font-bold text-on-surface">No members found</p>
                <p className="text-xs text-on-surface-variant mt-1">Try adjusting your search criteria or category filter.</p>
              </div>
            ) : (
              filteredUsers.map(u => {
                const isSelected = selectedAgent?.identifier === u.identifier;
                const roleMeta = ROLE_METADATA[u.role] || { badge: 'bg-surface-container-high text-on-surface-variant' };

                return (
                  <div
                    key={u.identifier}
                    onClick={() => {
                      setSelectedAgent(u);
                      setEditForm({ ...u });
                      setIsEditing(false);
                      setShowResetPasswordForm(false);
                      setResetPasswordValue('');
                      setMobileView('detail');
                    }}
                    className={`p-4 transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isSelected
                        ? 'bg-primary/10 border-l-4 border-primary shadow-[inset_0_0_15px_rgba(0,218,243,0.08)]'
                        : 'hover:bg-surface-container-high/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        photoURL={u.photoURL}
                        name={u.name}
                        role={u.role}
                        size="md"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-xs truncate ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                            {u.name}
                          </p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border flex-shrink-0 ${roleMeta.badge}`}>
                            {u.role}
                          </span>
                        </div>

                        <p className="text-[10px] text-on-surface-variant truncate mt-0.5 font-mono">
                          {u.identifier}
                        </p>

                        <div className="flex items-center gap-2 mt-1">
                          {u.contactNumber && (
                            <span className="text-[9px] text-on-surface-variant font-mono flex items-center gap-1">
                              <Phone size={9} className="text-primary" /> {u.contactNumber}
                            </span>
                          )}
                          {u.company && (
                            <span className="text-[9px] text-primary/80 truncate">
                              🏢 {u.company}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ChevronRight size={14} className={`text-on-surface-variant/40 transition-transform group-hover:translate-x-0.5 ${isSelected ? 'text-primary' : ''}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Member Workspace Showcase (2/3 Width) */}
        <div className={`flex-1 ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col border border-outline-variant/60 bg-surface-container/40 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full`}>
          {!selectedAgent ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <User size={48} className="mx-auto mb-3 opacity-25 text-on-surface-variant" />
              <h3 className="font-bold text-on-surface text-base">No Member Selected</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mt-1">
                Select an internal employee or client account from the registry on the left to inspect permissions, edit contact profile, and review activity audit trail.
              </p>
            </div>
          ) : (
            /* Full Compact & Robust Member Workspace */
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Top Member Profile Banner */}
              <div className="p-5 sm:p-6 bg-surface-container-low/90 border-b border-outline-variant/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Mobile back button */}
                  <button 
                    onClick={() => setMobileView('list')}
                    className="lg:hidden p-1.5 bg-surface-container hover:bg-surface-container-high rounded-lg text-on-surface-variant"
                  >
                    <X size={16} />
                  </button>

                  {/* Large Avatar with change trigger */}
                  <div className="relative group flex-shrink-0">
                    <UserAvatar
                      photoURL={selectedAgent.photoURL}
                      name={selectedAgent.name}
                      role={selectedAgent.role}
                      size="lg"
                    />
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center text-white transition-opacity cursor-pointer shadow-lg"
                          title="Change Profile Photo"
                        >
                          <Camera size={18} />
                        </button>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAgentPhotoUpload}
                        />
                      </>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black text-on-surface truncate">{selectedAgent.name}</h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ROLE_METADATA[selectedAgent.role]?.badge || 'bg-surface-container text-on-surface-variant'}`}>
                        {selectedAgent.role}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        selectedAgent.status === 'Deactivated' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {selectedAgent.status || 'Active'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-1">
                      <span className="font-mono flex items-center gap-1">
                        <Mail size={11} className="text-primary" /> {selectedAgent.identifier}
                      </span>
                      {selectedAgent.contactNumber && (
                        <span className="font-mono flex items-center gap-1">
                          <Phone size={11} className="text-primary" /> {selectedAgent.contactNumber}
                        </span>
                      )}
                      {selectedAgent.company && (
                        <span className="flex items-center gap-1">
                          <Building size={11} className="text-primary" /> {selectedAgent.company}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  {selectedAgent.contactNumber && (
                    <a
                      href={`tel:${selectedAgent.contactNumber.replace(/[^0-9+]/g, '')}`}
                      className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Call via Phone Link"
                    >
                      <PhoneCall size={12} /> Call
                    </a>
                  )}
                  <button
                    onClick={() => setEmailModalConfig({
                      isOpen: true,
                      recipient: selectedAgent,
                      initialTemplateId: selectedAgent.role === 'Business Client' ? 'client_approval' : 'employee_invite',
                    })}
                    className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold border border-outline-variant flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Mail size={12} /> Email
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => {
                          setEditForm({ ...selectedAgent });
                          setIsEditing(!isEditing);
                        }}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold border border-primary/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 size={12} /> {isEditing ? 'Cancel Edit' : 'Edit'}
                      </button>
                      {currentUser?.identifier !== selectedAgent.identifier && (
                        <button
                          onClick={() => setDeleteId(selectedAgent.identifier)}
                          className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 transition-colors cursor-pointer"
                          title="Revoke Access"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Sub-Workspace Navigation Tabs */}
              <div className="flex items-center gap-2 px-5 pt-3 border-b border-outline-variant/60 bg-surface-container-low/40">
                <button
                  onClick={() => setWorkspaceTab('rbac')}
                  className={'px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ' + (
                    workspaceTab === 'rbac'
                      ? 'border-primary text-primary bg-surface-container/60 font-black'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  <Shield size={13} /> Role & Permissions
                </button>
                <button
                  onClick={() => setWorkspaceTab('profile')}
                  className={'px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ' + (
                    workspaceTab === 'profile'
                      ? 'border-primary text-primary bg-surface-container/60 font-black'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  <User size={13} /> Profile Details
                </button>
                <button
                  onClick={() => setWorkspaceTab('audit')}
                  className={'px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ' + (
                    workspaceTab === 'audit'
                      ? 'border-primary text-primary bg-surface-container/60 font-black'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  <Clock size={13} /> Activity Trail ({userAuditLogs.length})
                </button>
                <button
                  onClick={() => setWorkspaceTab('security')}
                  className={'px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ' + (
                    workspaceTab === 'security'
                      ? 'border-primary text-primary bg-surface-container/60 font-black'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  <Lock size={13} /> Security & Access
                </button>
              </div>

              {/* Sub-Workspace Active Content */}
              <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                
                {/* TAB 1: Role & RBAC Permissions */}
                {workspaceTab === 'rbac' && (
                  <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                          <Shield size={14} className="text-primary" /> Dynamic Role Assignment (RBAC)
                        </h4>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Assigned role dictates module visibility, operational actions, and data access policies.
                        </p>
                      </div>
                      <span className={`text-xs font-black px-3 py-1 rounded-lg border ${ROLE_METADATA[selectedAgent.role]?.badge}`}>
                        {selectedAgent.role}
                      </span>
                    </div>

                    {isAdmin ? (
                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-3">
                        <label className="block text-[10px] uppercase font-bold text-on-surface-variant">Change Access Level</label>
                        <select 
                          value={selectedAgent.role}
                          onChange={(e) => handleRoleChange(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant rounded-xl p-2.5 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/50 outline-none cursor-pointer"
                        >
                          {SYSTEM_ROLES.filter(r => r !== 'Partner').map(roleName => (
                            <option key={roleName} value={roleName}>
                              {roleName} — {ROLE_METADATA[roleName]?.label || roleName}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-on-surface-variant">
                          Department: <strong className="text-primary">{getRoleCategory(selectedAgent.role)}</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60">
                        <p className="text-xs font-bold text-on-surface">Role: {selectedAgent.role}</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">Department: {getRoleCategory(selectedAgent.role)}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-outline-variant/40">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Granted Capabilities</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/40 flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>CRM & Lead Intake Access</span>
                        </div>
                        <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/40 flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>Quotation & Invoice Inspection</span>
                        </div>
                        <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/40 flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>Customer Registry Management</span>
                        </div>
                        <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/40 flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>Production & Logistics Overview</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Profile & Identity Details */}
                {workspaceTab === 'profile' && (
                  <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                      <User size={14} className="text-primary" /> Profile & Contact Dossier
                    </h4>

                    {isEditing ? (
                      <div className="space-y-3.5 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Full Name</label>
                            <input
                              type="text"
                              value={editForm.name || ""}
                              onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                              className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Contact Number (+94)</label>
                            <input
                              type="text"
                              value={editForm.contactNumber || ""}
                              onChange={(e) => setEditForm(p => ({ ...p, contactNumber: formatPhone(e.target.value) }))}
                              className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Company / Organization</label>
                            <input
                              type="text"
                              value={editForm.company || ""}
                              onChange={(e) => setEditForm(p => ({ ...p, company: e.target.value }))}
                              className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1">Workshop Base / Location</label>
                            <input
                              type="text"
                              value={editForm.location || ""}
                              onChange={(e) => setEditForm(p => ({ ...p, location: e.target.value }))}
                              className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface"
                            />
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 bg-surface-container text-on-surface-variant rounded-xl font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDetails}
                            className="px-5 py-2 bg-primary text-on-primary rounded-xl font-bold shadow-md flex items-center gap-1.5"
                          >
                            <Save size={13} /> Save Profile
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Full Name</span>
                          <p className="font-bold text-on-surface text-sm mt-0.5">{selectedAgent.name}</p>
                        </div>
                        <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Email Address</span>
                          <p className="font-bold text-on-surface text-sm font-mono mt-0.5 truncate">{selectedAgent.identifier}</p>
                        </div>
                        <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Contact Number</span>
                          <p className="font-bold text-on-surface text-sm font-mono mt-0.5">{selectedAgent.contactNumber || 'Not specified'}</p>
                        </div>
                        <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Organization</span>
                          <p className="font-bold text-on-surface text-sm mt-0.5">{selectedAgent.company || 'Print To Frame Pvt Ltd'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Activity & Audit Trail */}
                {workspaceTab === 'audit' && (
                  <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                      <Clock size={14} className="text-primary" /> Member Activity Stream
                    </h4>
                    <div className="divide-y divide-outline-variant/30 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                      {userAuditLogs.length > 0 ? (
                        userAuditLogs.map((log, idx) => (
                          <div key={log._firestoreId || idx} className="py-3 flex justify-between items-start gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-on-surface">{log.action || 'ACTIVITY'}</span>
                                <span className="text-[9px] font-bold px-2 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                                  {log.module || 'ERP'}
                                </span>
                              </div>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">{log.details || log.description || 'User action logged'}</p>
                            </div>
                            <span className="text-[10px] text-on-surface-variant font-mono flex-shrink-0">
                              {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="py-10 text-center text-on-surface-variant text-xs">
                          No recent logged activity found for this user account.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: Security & Access */}
                {workspaceTab === 'security' && (
                  <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                      <Lock size={14} className="text-primary" /> Security & Account Lifecycle
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase">Account Status</span>
                        <p className={`font-bold text-sm mt-0.5 ${selectedAgent.status === 'Deactivated' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {selectedAgent.status || 'Active'}
                        </p>
                      </div>
                      <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase">Auth Provider</span>
                        <p className="font-bold text-on-surface text-sm mt-0.5">Firebase / Google Workspace</p>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="pt-2 flex items-center gap-3">
                        <button
                          onClick={handleToggleStatus}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            selectedAgent.status === 'Deactivated'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'text-rose-400 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20'
                          }`}
                        >
                          {selectedAgent.status === 'Deactivated' ? 'Reactivate Member Account' : 'Deactivate Member Account'}
                        </button>
                        <button
                          onClick={() => setShowResetPasswordForm(prev => !prev)}
                          className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold border border-outline-variant transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <KeyRound size={13} /> Reset Password
                        </button>
                      </div>
                    )}

                    {isAdmin && showResetPasswordForm && (
                      <form onSubmit={handleResetPassword} className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={resetPasswordValue}
                          onChange={(e) => setResetPasswordValue(e.target.value)}
                          placeholder="New password (min. 6 characters)"
                          className="flex-1 px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary/60"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={isResettingPassword}
                          className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isResettingPassword ? 'Resetting...' : 'Confirm Reset'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowResetPasswordForm(false); setResetPasswordValue(''); }}
                          className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-bold border border-outline-variant transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── REVIEW REGISTRATION MODAL (the "Review Full Dossier" eye icon) ── */}
      {/* This state was already wired up (handleOpenReview/handleExecuteApproval/
          handleExecuteRejection) but nothing ever rendered based on it — the eye
          icon set state with no visible effect. This is what makes it do
          something, and the reason "Quick Approve" existed at all: it was a
          workaround for this modal never having been built. */}
      <ModalWrapper
        isOpen={!!reviewingApplicant}
        onClose={() => setReviewingApplicant(null)}
        maxWidth="max-w-lg"
        height="h-auto"
        ariaLabel="Review Registration Request"
      >
        {reviewingApplicant && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Eye size={18} className="text-primary" /> Review Registration Request
              </h3>
              <button onClick={() => setReviewingApplicant(null)} className="text-on-surface-variant hover:text-on-surface p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">Full Name</span>
                <span className="text-on-surface font-bold">{reviewingApplicant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">Email / Identifier</span>
                <span className="text-on-surface font-mono">{reviewingApplicant.identifier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">Requested Role</span>
                <span className="text-on-surface font-bold">{reviewingApplicant.role || 'Not specified'}</span>
              </div>
              {reviewingApplicant.mobile && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">Mobile</span>
                  <span className="text-on-surface font-mono">{reviewingApplicant.mobile}</span>
                </div>
              )}
              {reviewingApplicant.company && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">Company</span>
                  <span className="text-on-surface">{reviewingApplicant.company}</span>
                </div>
              )}
              {reviewingApplicant.specialty && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-bold uppercase tracking-wider text-[10px]">Specialty</span>
                  <span className="text-on-surface">{reviewingApplicant.specialty}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-outline-variant/60">
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">
                Assign Role On Approval
              </label>
              <select
                value={selectedReviewRole}
                onChange={(e) => setSelectedReviewRole(e.target.value)}
                className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-bold text-xs"
              >
                {SYSTEM_ROLES.map(roleName => (
                  <option key={roleName} value={roleName}>
                    {roleName} — {ROLE_METADATA[roleName]?.label || roleName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-on-surface-variant">
                Defaults to what they requested — correct it here if a self-provisioned
                sign-in landed as the wrong role (e.g. a Partner or Business Client
                applicant who signed in with Google before registering was auto-created
                as a pending Customer).
              </p>
            </div>

            {reviewingApplicant._source === 'partner_application' && (
              <div className="pt-2 border-t border-outline-variant/60">
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={reviewPassword}
                  onChange={(e) => setReviewPassword(e.target.value)}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono text-xs"
                />
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  This application came from the public portal, not self-registration —
                  there's no Firebase Auth account for them yet. Approving creates one
                  with this password and emails it to them automatically. Once approved,
                  you'll land in Partners → Register Partner to complete their profile
                  (banking details, commission rate, studio type).
                </p>
              </div>
            )}

            <div className="pt-3 flex justify-end gap-2 border-t border-outline-variant/60">
              <button
                type="button"
                disabled={isApprovingReview}
                onClick={() => handleExecuteRejection(reviewingApplicant)}
                className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={isApprovingReview}
                onClick={() => handleExecuteApproval(reviewingApplicant, selectedReviewRole)}
                className="px-6 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md disabled:opacity-60"
              >
                {isApprovingReview ? 'Approving...' : `Approve as ${selectedReviewRole}`}
              </button>
            </div>
          </div>
        )}
      </ModalWrapper>

      {/* ── CREATE USER MODAL ─────────────────────────────────────────── */}
      <ModalWrapper
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        maxWidth="max-w-xl"
        height="h-auto"
        ariaLabel="Enroll New Member"
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <UserCheck size={18} className="text-primary" /> Enroll New Internal Member
            </h3>
            <button onClick={() => setShowCreateUserModal(false)} className="text-on-surface-variant hover:text-on-surface p-1">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kasun Perera"
                  value={createUserForm.name}
                  onChange={(e) => setCreateUserForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Email / Identifier *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. kasun@print2frame.xyz"
                  value={createUserForm.identifier}
                  onChange={(e) => setCreateUserForm(p => ({ ...p, identifier: e.target.value }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Access Role</label>
                <select
                  value={createUserForm.role}
                  onChange={(e) => setCreateUserForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-bold"
                >
                  {SYSTEM_ROLES.filter(r => r !== 'Partner').map(roleName => (
                    <option key={roleName} value={roleName}>
                      {roleName} ({ROLE_METADATA[roleName]?.label || roleName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Mobile (+94)</label>
                <input
                  type="text"
                  placeholder="+94 77 123 4567"
                  value={createUserForm.contactNumber}
                  onChange={(e) => setCreateUserForm(p => ({ ...p, contactNumber: formatPhone(e.target.value) }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono"
                />
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  Sent to the new member automatically by email along with their login details.
                </p>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-outline-variant/60">
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="px-4 py-2 bg-surface-container text-on-surface-variant text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md"
              >
                Enroll Member
              </button>
            </div>
          </form>
        </div>
      </ModalWrapper>

      {/* ── IMAGE CROP MODAL ─────────────────────────────────────────── */}
      {showCropModal && rawImageForCrop && (
        <ImageCropModal
          isOpen={showCropModal}
          onClose={() => {
            setShowCropModal(false);
            setRawImageForCrop(null);
          }}
          imageSrc={rawImageForCrop}
          onCropComplete={handleAgentCropComplete}
        />
      )}

      {/* ── EMAIL TEMPLATE MODAL ─────────────────────────────────────────── */}
      {emailModalConfig.isOpen && (
        <EmailTemplateModal
          isOpen={emailModalConfig.isOpen}
          onClose={() => setEmailModalConfig({ isOpen: false, recipient: null, initialTemplateId: null })}
          recipient={emailModalConfig.recipient}
          initialTemplateId={emailModalConfig.initialTemplateId}
        />
      )}

      {/* ── DELETE MODAL ─────────────────────────────────────────── */}
      <DeleteModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteAgent}
        title="Revoke Member Access"
        message="Are you sure you want to revoke this user? This permanently deletes their portal login (Firebase account included) — they will not be able to sign in afterward, and this cannot be undone. Their past audit events will be preserved."
      />
    </div>
  );
}
