import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, User, Building, MapPin, Globe, DollarSign, Sparkles, X, 
  Trash2, Check, Clock, Link, QrCode, Copy, Plus, ChevronRight,
  ExternalLink, Layers, ArrowUpRight, ShieldCheck, FileText, CheckCircle2,
  AlertCircle, Download, CreditCard, Send, Handshake, Filter, Phone, Mail,
  Share2, ArrowDownRight, Printer, Edit3, Upload, FileCheck, Save, Eye, PhoneCall, Camera,
  Lock, KeyRound
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';
import { toast } from '../../utils/toast';
import DeleteModal from '../common/DeleteModal';
import { PageHeader, FilterBar, StatusBadge, ModalWrapper, UserAvatar, ImageCropModal, EmailTemplateModal } from '../common/ui';
import PartnerQRModal from './PartnerQRModal';
import { 
  subscribeToCollection, 
  addDocument, 
  updateDocument, 
  deleteDocument,
  COLLECTIONS 
} from '../../services/firestoreSync';
import { formatPhone, validatePhone, validateEmail } from '../../utils/validation';
import { exportToCsv } from '../../utils/csvExport';
import { usePermissions } from '../../context/PermissionsContext';
import { sendTemplatedEmail } from '../../services/mailer';
import { deleteUserAccount, resetUserPassword } from '../../services/adminUsers';
import { logActivity } from '../../services/auditLog';

export default function Partners({ 
  partners = [], 
  setPartners, 
  leads = [], 
  setLeads, 
  invoices = [], 
  projects = [],
  users = [],
  setUsers,
  dataStore,
  currentUser,
  prefillPartner,
  onPrefillConsumed,
}) {
  const { canAccess } = usePermissions();
  const isPartnerUser = currentUser?.role === 'Partner';

  // Navigation & Filter States
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'active' | 'claims' | 'settlements'
  const [workspaceTab, setWorkspaceTab] = useState('referrals'); // 'referrals' | 'documents' | 'financial' | 'marketing' | 'security'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail'
  const [showPartnerResetForm, setShowPartnerResetForm] = useState(false);
  const [partnerResetPasswordValue, setPartnerResetPasswordValue] = useState('');
  const [isResettingPartnerPassword, setIsResettingPartnerPassword] = useState(false);

  // Image Crop & Avatar Upload state
  const [rawImageForCrop, setRawImageForCrop] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const photoInputRef = useRef(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [isSavingPartner, setIsSavingPartner] = useState(false);
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const [qrPartner, setQrPartner] = useState(null);
  const [deletePartnerId, setDeletePartnerId] = useState(null);
  // Same Email Template Dispatcher used in User Management (AgentDatabase.jsx),
  // wired to the selected partner instead of a staff/client user record.
  const [emailModalConfig, setEmailModalConfig] = useState({
    isOpen: false,
    recipient: null,
    initialTemplateId: null,
  });

  // Missing Referral Claims
  const [claims, setClaims] = useState([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({
    clientName: '',
    clientPhone: '',
    referralDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  useEffect(() => {
    const unsubClaims = subscribeToCollection(COLLECTIONS.REFERRAL_CLAIMS, (data) => {
      setClaims(data || []);
    });
    return () => {
      unsubClaims();
    };
  }, []);

  // New Partner Form State (Default commission: 53.50 LKR per sq ft)
  const [newPartner, setNewPartner] = useState({
    name: '',
    partnerId: '',
    type: 'Art & Framing Studio',
    contactPerson: '',
    phone: '',
    email: '',
    address: 'Colombo, Sri Lanka',
    commissionRate: 53.5, // LKR per SqFt
    brNumber: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    branchName: '',
    photoURL: '',
    status: 'Active',
  });

  // A Partner registration request approved in User Management (App.jsx's
  // approvePending) lands here as `prefillPartner` — login access is already
  // granted at that point, this just carries the admin straight into the same
  // Register Partner form used for a manual add, with the known fields filled
  // in, so completing their full profile (banking, commission rate, studio
  // type) is the very next action instead of a separately-built form.
  // onPrefillConsumed is read via a ref, not a dependency: it's a fresh inline
  // function from the parent on every render, and this effect must only ever
  // re-fire when the prefill payload itself changes, not on every re-render.
  const onPrefillConsumedRef = useRef(onPrefillConsumed);
  useEffect(() => {
    onPrefillConsumedRef.current = onPrefillConsumed;
  }, [onPrefillConsumed]);

  // Carries prefillPartner's tempPassword (present only for a partner_application
  // approval, which had no self-registration password to fall back on) through to
  // handleCreatePartner's success — that's the earliest point the real partnerId
  // and commissionRate exist, so that's where the welcome/activation email fires,
  // not at the approval step itself.
  const [pendingApprovalEmail, setPendingApprovalEmail] = useState(null);

  useEffect(() => {
    if (!prefillPartner) return;
    setNewPartner(prev => ({
      ...prev,
      name: prefillPartner.name || prev.name,
      email: prefillPartner.email || prev.email,
      contactPerson: prefillPartner.name || prev.contactPerson,
      phone: prefillPartner.phone || prev.phone,
      type: prefillPartner.type || prev.type,
    }));
    setPendingApprovalEmail({ tempPassword: prefillPartner.tempPassword || null });
    setShowCreateModal(true);
    setActiveFilter('all');
    onPrefillConsumedRef.current?.();
  }, [prefillPartner]);

  // Cancelling out of the form (X, backdrop/Escape, or the footer Cancel button)
  // must also drop any pending approval-email context — otherwise a later,
  // unrelated manual "Register Partner" click could inherit a stale
  // "this came from an approval" flag from a cancelled one.
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setPendingApprovalEmail(null);
  };

  // Dynamic Avatar Resolution (Google Photo, Custom Upload, or Users DB Bridge)
  const getPartnerAvatar = useCallback((partner) => {
    if (!partner) return null;
    if (partner.photoURL && partner.photoURL.length > 5) return partner.photoURL;
    if (partner.avatar && partner.avatar.length > 5) return partner.avatar;
    
    // Cross-reference with authenticated users table
    const matchingUser = users.find(u => 
      (u.email && partner.email && u.email.toLowerCase() === partner.email.toLowerCase()) ||
      (u.identifier && partner.email && u.identifier.toLowerCase() === partner.email.toLowerCase()) ||
      (u.partnerId && partner.partnerId && u.partnerId === partner.partnerId) ||
      (u.name && partner.name && u.name.toLowerCase() === partner.name.toLowerCase())
    );
    if (matchingUser?.photoURL && matchingUser.photoURL.length > 5) return matchingUser.photoURL;
    if (matchingUser?.avatar && matchingUser.avatar.length > 5) return matchingUser.avatar;

    // Check currentUser if this partner matches the logged-in session
    if (
      currentUser && 
      (currentUser.email?.toLowerCase() === partner.email?.toLowerCase() ||
       currentUser.identifier?.toLowerCase() === partner.email?.toLowerCase() ||
       currentUser.name?.toLowerCase() === partner.name?.toLowerCase())
    ) {
      return currentUser.photoURL || currentUser.avatar || null;
    }

    return null;
  }, [users, currentUser]);

  // Partner Identity Resolution for logged-in Partner role
  const currentPartner = useMemo(() => {
    if (!isPartnerUser) return null;
    const found = partners.find(p => 
      p.email?.toLowerCase() === currentUser?.email?.toLowerCase() ||
      p.email?.toLowerCase() === currentUser?.identifier?.toLowerCase() ||
      p.partnerId === currentUser?.partnerId ||
      p.id === currentUser?.partnerId ||
      p.id === currentUser?.id ||
      p.name?.toLowerCase() === currentUser?.name?.toLowerCase()
    );
    if (found) return { ...found, photoURL: getPartnerAvatar(found) || currentUser?.photoURL };
    return {
      name: currentUser?.name || currentUser?.company || 'Partner Studio',
      partnerId: currentUser?.partnerId || (currentUser?.identifier ? 'P-' + String(currentUser.identifier).slice(0, 4).toUpperCase() : 'P-1001'),
      commissionRate: 53.5,
      type: 'Art & Framing Studio',
      phone: currentUser?.contactNumber || currentUser?.phone || '',
      email: currentUser?.email || currentUser?.identifier || '',
      address: currentUser?.location || 'Colombo, Sri Lanka',
      bankName: '',
      accountNumber: '',
      accountName: currentUser?.name || '',
      branchName: '',
      photoURL: currentUser?.photoURL || '',
    };
  }, [isPartnerUser, partners, currentUser, getPartnerAvatar]);

  // Auto-select partner on mount if partner role or single partner
  useEffect(() => {
    if (isPartnerUser && currentPartner) {
      setSelectedPartner(currentPartner);
      setEditFormData({ ...currentPartner });
    } else if (!selectedPartner && partners.length > 0) {
      setSelectedPartner(partners[0]);
      setEditFormData({ ...partners[0] });
    }
  }, [isPartnerUser, currentPartner, partners, selectedPartner]);

  // Helper to calculate partner referral stats with SqFt rate (53.5 LKR/SqFt)
  const getPartnerReferrals = useCallback((partner) => {
    if (!partner) return [];
    const pid = String(partner.partnerId || partner.id || '').toLowerCase();
    const pname = String(partner.name || '').toLowerCase();

    return leads.filter(lead => {
      const lPid = String(lead.partnerId || lead.agentId || '').toLowerCase();
      const lPname = String(lead.partnerName || lead.agentName || '').toLowerCase();
      return lPid === pid || lPname === pname || (lead.source === 'Referral' && (lPid === pid || lPname === pname));
    }).map(lead => {
      const leadInvoices = invoices.filter(inv => inv.leadId === lead.id || inv.customerId === lead.email || inv.customerName === lead.name);
      const totalInvoiced = leadInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
      const totalPaid = leadInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount || 0), 0);
      
      const dealVal = Number(lead.value || totalInvoiced || 0);
      const totalSqFt = Number(lead.totalSqFt || lead.sqFt || (lead.pricingMetadata?.costSalesAmount ? (lead.pricingMetadata.costSalesAmount / 53.5) : 0));
      
      // Commission is always calculated from the partner's CURRENT live rate,
      // never the lead's referral-time snapshot (lead.commissionRate) or the
      // quote-time pricingMetadata.costSalesAmount (baked from pricingEngine's
      // fixed internal cost rate) — either would pay out a stale rate if the
      // partner's rate changed since the lead was referred/quoted.
      let commRate = Number(partner.commissionRate) > 0 ? Number(partner.commissionRate) : 53.5;
      if (commRate > 0 && commRate <= 1) {
        commRate = 53.5;
      }

      let commAmount = 0;
      if (totalSqFt > 0) {
        commAmount = totalSqFt * commRate;
      } else if (dealVal > 0) {
        commAmount = (dealVal / 850) * commRate;
      }

      let paymentStatus = 'Unpaid';
      if (totalPaid > 0 && totalPaid < dealVal) {
        paymentStatus = '75% Advance Paid';
      } else if (totalPaid >= dealVal && dealVal > 0) {
        paymentStatus = '100% Fully Settled';
      }

      let commState = 'Pending Quote';
      if (lead.stage === 'Lost' || lead.stage === 'Rejected') {
        commState = 'Cancelled';
      } else if (lead.payoutStatus === 'Paid' || lead.payoutStatus === 'Settled') {
        commState = 'Paid & Settled';
      } else if (paymentStatus === '100% Fully Settled' || lead.referralStatus === 'Eligible for Payout' || lead.stage === 'Delivered' || lead.stage === 'Completed') {
        commState = 'Eligible for Payout';
      } else if (paymentStatus === '75% Advance Paid' || ['Design / Review', 'Advance Paid', 'Production', 'Fabrication', 'Logistics'].includes(lead.stage)) {
        commState = 'Accrued (In Production)';
      } else if (dealVal > 0) {
        commState = 'Quoted / Pending Acceptance';
      }

      return {
        ...lead,
        calculatedDealVal: dealVal,
        calculatedSqFt: totalSqFt,
        calculatedCommRate: commRate,
        calculatedCommAmount: commAmount,
        paymentStatus,
        commState
      };
    });
  }, [leads, invoices]);

  // Selected Partner's Referrals
  const selectedPartnerLeads = useMemo(() => {
    return getPartnerReferrals(selectedPartner);
  }, [selectedPartner, getPartnerReferrals]);

  // Image Upload & Crop Handlers for Partner Avatar
  const handlePartnerPhotoSelect = (e) => {
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

  const handlePartnerCropComplete = async (croppedBase64) => {
    if (editFormData) {
      setEditFormData(prev => ({ ...prev, photoURL: croppedBase64 }));
    }
    if (selectedPartner) {
      const docId = selectedPartner._firestoreId || selectedPartner.id || selectedPartner.partnerId;
      try {
        await updateDocument(COLLECTIONS.PARTNERS, docId, { photoURL: croppedBase64 });
        if (setPartners) {
          setPartners(prev => prev.map(p => (p.id === docId || p.partnerId === selectedPartner.partnerId) ? { ...p, photoURL: croppedBase64 } : p));
        }
        setSelectedPartner(prev => ({ ...prev, photoURL: croppedBase64 }));
        toast.success('Studio logo / profile photo updated & saved!');
      } catch (err) {
        console.error('Failed to update photo:', err);
        toast.error('Failed to persist photo: ' + err.message);
      }
    }
  };

  // Document Upload Handler (Agreements Vault)
  const handleFileUpload = async (e, docKey, targetPartner) => {
    const file = e.target.files?.[0];
    if (!file || !targetPartner) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingDocKey(docKey);
    try {
      const pid = targetPartner.partnerId || targetPartner.id || 'P-1001';
      const storageRef = ref(storage, `partners/${pid}/${docKey}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const updatedDocs = {
        ...(targetPartner.documents || {}),
        [docKey]: {
          url: downloadUrl,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        }
      };

      const docId = targetPartner._firestoreId || targetPartner.id || pid;
      await updateDocument(COLLECTIONS.PARTNERS, docId, { documents: updatedDocs });

      if (setPartners) {
        setPartners(prev => prev.map(p => (p.partnerId === pid || p.id === pid) ? { ...p, documents: updatedDocs } : p));
      }
      if (selectedPartner && (selectedPartner.partnerId === pid || selectedPartner.id === pid)) {
        setSelectedPartner(prev => ({ ...prev, documents: updatedDocs }));
      }

      toast.success('Document securely uploaded and verified!');
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Document upload failed: ' + (err.message || 'Storage error'));
    } finally {
      setUploadingDocKey(null);
    }
  };

  // Create Partner
  const handleCreatePartner = async (e) => {
    e.preventDefault();
    if (!newPartner.name.trim()) {
      toast.error('Please enter a studio or partner name');
      return;
    }

    const partnerId = newPartner.partnerId.trim() || ('P-' + String(Date.now()).slice(-4));
    const partnerPayload = {
      ...newPartner,
      partnerId,
      commissionRate: Number(newPartner.commissionRate) || 53.5,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDocument(COLLECTIONS.PARTNERS, partnerPayload, partnerId);
      if (setPartners) {
        setPartners(prev => [...prev, { ...partnerPayload, id: partnerId }]);
      }
      setShowCreateModal(false);
      setNewPartner({
        name: '',
        partnerId: '',
        type: 'Art & Framing Studio',
        contactPerson: '',
        phone: '',
        email: '',
        address: 'Colombo, Sri Lanka',
        commissionRate: 53.5,
        brNumber: '',
        bankName: '',
        accountNumber: '',
        accountName: '',
        branchName: '',
        photoURL: '',
        status: 'Active',
      });
      // Manual prompt, not auto-opened — covers both a direct manual add and a
      // just-approved registration request completing its profile here, since
      // both end up going through this same form.
      toast.success(`Partner ${partnerPayload.name} (${partnerId}) created successfully!`, {
        action: {
          label: 'Generate QR Code',
          onClick: () => setQrPartner({ ...partnerPayload, id: partnerId }),
        },
      });

      // This creation completed a User Management approval — send the welcome
      // email now, since this is the first point the real partnerId and
      // commissionRate exist. A password-application approval relays the
      // password it just created; a self-registered approval already has one,
      // so it gets a lighter activation confirmation instead. A plain manual
      // add (no approval behind it) sends nothing — there's no login involved.
      if (pendingApprovalEmail) {
        const { tempPassword } = pendingApprovalEmail;
        setPendingApprovalEmail(null);
        try {
          await sendTemplatedEmail(
            partnerPayload.email,
            tempPassword ? 'partner_approval' : 'partner_activation_confirmed',
            {
              recipientName: partnerPayload.name,
              partnerId,
              commissionRate: partnerPayload.commissionRate,
              loginEmail: partnerPayload.email,
              tempPassword: tempPassword || undefined,
              senderName: currentUser?.name,
            }
          );
        } catch (mailErr) {
          toast.error(`${partnerPayload.name} is active, but the welcome email failed to send: ${mailErr.message}`);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create partner: ' + err.message);
    }
  };

  // Save Partner Details Edit
  const handleSavePartnerDetails = async () => {
    if (!editFormData || !selectedPartner) return;
    setIsSavingPartner(true);
    try {
      const payload = {
        ...editFormData,
        commissionRate: Number(editFormData.commissionRate) || 53.5,
      };
      const docId = selectedPartner._firestoreId || selectedPartner.id || selectedPartner.partnerId;
      await updateDocument(COLLECTIONS.PARTNERS, docId, payload);

      if (setPartners) {
        setPartners(prev => prev.map(p => (p.id === docId || p.partnerId === selectedPartner.partnerId) ? { ...p, ...payload } : p));
      }
      setSelectedPartner(prev => ({ ...prev, ...payload }));
      setShowEditModal(false);
      toast.success('Partner details updated successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update partner: ' + err.message);
    } finally {
      setIsSavingPartner(false);
    }
  };

  // Delete Partner — removes the partners directory record AND, if this partner
  // has a real portal login, their users/{email} profile and Firebase Auth
  // account too. Previously this only ever removed the directory record, so a
  // "deleted" partner could still sign in, and re-approving the same email
  // later failed with auth/email-already-exists since the old account never
  // actually went away.
  const handleDeletePartner = async () => {
    if (!deletePartnerId) return;
    const targetPartner = partners.find(p =>
      p._firestoreId === deletePartnerId || p.id === deletePartnerId || p.partnerId === deletePartnerId
    );
    const email = (targetPartner?.email || '').trim().toLowerCase();
    // Only ever the same partner's own login — never delete a users/{email} doc
    // whose role has since changed to something else (e.g. promoted to staff).
    const matchingUser = email ? users.find(u => u.identifier?.toLowerCase() === email && u.role === 'Partner') : null;

    try {
      await deleteDocument(COLLECTIONS.PARTNERS, deletePartnerId);
      if (setPartners) {
        setPartners(prev => prev.filter(p => (p._firestoreId !== deletePartnerId && p.id !== deletePartnerId && p.partnerId !== deletePartnerId)));
      }

      if (matchingUser) {
        await deleteDocument(COLLECTIONS.USERS, matchingUser.identifier);
        if (setUsers) {
          setUsers(prev => prev.filter(u => u.identifier !== matchingUser.identifier));
        }
        await deleteUserAccount(matchingUser.identifier);
      }

      if (selectedPartner && (selectedPartner._firestoreId === deletePartnerId || selectedPartner.id === deletePartnerId || selectedPartner.partnerId === deletePartnerId)) {
        setSelectedPartner(null);
      }
      setDeletePartnerId(null);
      logActivity(currentUser?.identifier, currentUser?.name, 'DELETE', 'Partners', `Removed partner ${targetPartner?.name || deletePartnerId}${matchingUser ? ' and revoked their login' : ''}`);
      toast.success(matchingUser ? 'Partner removed and their login permanently revoked' : 'Partner profile removed');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete partner: ' + err.message);
    }
  };

  // Submit Referral Claim
  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    if (!claimForm.clientName || !claimForm.clientPhone) {
      toast.error('Please enter client name and contact number');
      return;
    }

    setIsSubmittingClaim(true);
    try {
      const p = selectedPartner || currentPartner || { name: 'Direct Partner', partnerId: 'P-1001' };
      const claimPayload = {
        partnerId: p.partnerId || 'P-1001',
        partnerName: p.name || 'Partner',
        partnerEmail: p.email || '',
        clientName: claimForm.clientName,
        clientPhone: claimForm.clientPhone,
        referralDate: claimForm.referralDate,
        notes: claimForm.notes,
        status: 'Pending Verification',
        createdAt: new Date().toISOString(),
      };

      await addDocument(COLLECTIONS.REFERRAL_CLAIMS, claimPayload);
      setShowClaimModal(false);
      setClaimForm({
        clientName: '',
        clientPhone: '',
        referralDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      toast.success('Referral claim submitted! Operations team will cross-check within 24 hours.');
    } catch (err) {
      console.error(err);
      toast.error('Claim submission failed: ' + err.message);
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  // Verify Claim Handler (Admin)
  const handleVerifyClaim = async (claim) => {
    try {
      await updateDocument(COLLECTIONS.REFERRAL_CLAIMS, claim._firestoreId || claim.id, {
        status: 'Verified & Linked',
        verifiedAt: new Date().toISOString(),
        verifiedBy: currentUser?.email || 'Admin',
      });
      toast.success(`Referral for ${claim.clientName} verified & linked to ${claim.partnerName}!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to verify claim');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    try {
      const columns = [
        { key: 'partnerId', label: 'Partner ID' },
        { key: 'name', label: 'Studio Name' },
        { key: 'type', label: 'Partner Type' },
        { key: 'contactPerson', label: 'Contact Person' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'commissionRate', label: 'Commission Rate (LKR/SqFt)' },
        { key: 'brNumber', label: 'BR Number' },
        { key: 'bankName', label: 'Bank Name' },
        { key: 'accountNumber', label: 'Account Number' },
        { key: 'status', label: 'Status' },
      ];
      exportToCsv(filteredPartners, columns, 'PTF_Partners_Directory');
      toast.success(`Exported ${filteredPartners.length} partner records to CSV`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  // Filtered partners list for admin search (or scoped to self for Partner role)
  const basePartnersList = useMemo(() => {
    if (isPartnerUser && currentPartner) {
      return [currentPartner];
    }
    return partners;
  }, [isPartnerUser, currentPartner, partners]);

  const filteredPartners = useMemo(() => {
    return basePartnersList.filter(p => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        p.name?.toLowerCase().includes(query) ||
        p.contactPerson?.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.phone?.toLowerCase().includes(query) ||
        p.partnerId?.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (activeFilter === 'active') return p.status === 'Active' || !p.status;
      return true;
    });
  }, [basePartnersList, searchQuery, activeFilter]);

  const activePartnersCount = basePartnersList.filter(p => p.status === 'Active' || !p.status).length;
  const pendingClaimsCount = claims.filter(c => c.status === 'Pending Verification').length;

  // Drives the delete-confirmation copy — accurate warning only when this
  // partner actually has a login to lose.
  const deletePartnerHasLogin = useMemo(() => {
    if (!deletePartnerId) return false;
    const target = partners.find(p =>
      p._firestoreId === deletePartnerId || p.id === deletePartnerId || p.partnerId === deletePartnerId
    );
    const email = (target?.email || '').trim().toLowerCase();
    return !!email && users.some(u => u.identifier?.toLowerCase() === email && u.role === 'Partner');
  }, [deletePartnerId, partners, users]);

  // The Security tab's reset-password form only makes sense when this
  // partner actually has a portal login — matches the same email + role
  // lookup used above for the delete-confirmation warning.
  const selectedPartnerUser = useMemo(() => {
    const email = (selectedPartner?.email || '').trim().toLowerCase();
    if (!email) return null;
    return users.find(u => u.identifier?.toLowerCase() === email && u.role === 'Partner') || null;
  }, [selectedPartner, users]);

  useEffect(() => {
    setShowPartnerResetForm(false);
    setPartnerResetPasswordValue('');
  }, [selectedPartner?.partnerId, selectedPartner?.id]);

  const handlePartnerResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedPartnerUser) return;
    if (!partnerResetPasswordValue || partnerResetPasswordValue.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsResettingPartnerPassword(true);
    try {
      await resetUserPassword(selectedPartnerUser.identifier, partnerResetPasswordValue);
      toast.success(`Password reset for ${selectedPartnerUser.identifier}`);
      logActivity(currentUser?.identifier, currentUser?.name, 'PASSWORD_RESET', 'Partners', `Reset the login password for partner ${selectedPartner?.name || selectedPartnerUser.identifier}`);
      try {
        await sendTemplatedEmail(selectedPartnerUser.identifier, 'password_reset', {
          recipientName: selectedPartner?.name,
          loginEmail: selectedPartnerUser.identifier,
          tempPassword: partnerResetPasswordValue,
          senderName: currentUser?.name,
        });
      } catch (mailErr) {
        toast.error(`Password was reset, but the notification email failed to send: ${mailErr.message}`);
      }
      setShowPartnerResetForm(false);
      setPartnerResetPasswordValue('');
    } catch (err) {
      toast.error("Failed to reset password: " + err.message);
    } finally {
      setIsResettingPartnerPassword(false);
    }
  };

  const publicQrUrl = (partner) => {
    const pid = partner?.partnerId || partner?.id || 'P-1001';
    return `https://print2frame.xyz/client-detail-submitting-form?ref=${pid}`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // UNIFIED 2-PANEL MASTER-DETAIL VIEW (100% Consistent Across All Roles)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-6">
      {/* Standardized Header matching Leads, Customers, and User Management */}
      <PageHeader
        title="Partners"
        subtitle="Manage framing partner studios, referral tracking, and monthly commission settlements. New registration requests are reviewed in User Management."
        metrics={[
          { label: "Total Partners", value: basePartnersList.length, color: "cyan" },
          { label: "Active Studios", value: activePartnersCount, color: "emerald" },
          { label: "Missing Claims", value: isPartnerUser ? 0 : pendingClaimsCount, color: "rose" }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-container border border-outline-variant hover:border-primary/40 text-on-surface rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0 cursor-pointer"
              title="Export partner directory to CSV"
            >
              <Download size={15} className="text-primary" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            {(isPartnerUser || canAccess(currentUser?.role, 'partners', 'create')) && (
              <button
                onClick={() => isPartnerUser ? setShowClaimModal(true) : setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.25)] active:scale-95 flex-shrink-0 cursor-pointer"
              >
                {isPartnerUser ? <Handshake size={16} /> : <Plus size={16} />}
                <span>{isPartnerUser ? 'Claim Offline Referral' : 'Register Partner'}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Standardized Filter & Search Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search partners by studio name, partner ID, contact person, phone, email..."
        activeFilter={activeFilter}
        onFilterChange={(filterId) => {
          setActiveFilter(filterId);
          if (filterId === 'claims' || filterId === 'settlements') {
            setSelectedPartner(null);
          }
        }}
        filterOptions={[
          { id: 'all', label: 'All Partners', count: basePartnersList.length },
          { id: 'active', label: 'Active Studios', count: activePartnersCount },
          ...(!isPartnerUser ? [
            { id: 'claims', label: 'Referral Claims', count: pendingClaimsCount },
            { id: 'settlements', label: 'Monthly Settlements', count: basePartnersList.length }
          ] : [])
        ]}
        totalCount={basePartnersList.length}
        filteredCount={filteredPartners.length}
      />

      {/* Main Master-Detail Layout */}
      <div className="flex-1 flex lg:flex-row flex-col gap-6 overflow-hidden min-h-0">
        
        {!isPartnerUser && activeFilter === 'claims' ? (
          /* Referral Claims Desk (Admin Only) */
          <div className="flex-1 bg-surface-container/60 border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-outline-variant/60 bg-surface-container-low/80 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <Link size={14} className="text-primary" />
                  Offline Referral Claims Verification Desk ({claims.length})
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Verify customer referrals reported by partners for phone/walk-in leads.</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
              {claims.length > 0 ? (
                claims.map((claim) => (
                  <div key={claim.id || claim._firestoreId} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-surface-container-high/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface">{claim.clientName}</span>
                        <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                          {claim.clientPhone}
                        </span>
                        <span className={'text-[9px] font-bold px-2 py-0.5 rounded ' + (
                          claim.status === 'Verified & Linked' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        )}>
                          {claim.status}
                        </span>
                      </div>
                      <div className="text-xs text-on-surface-variant mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-bold text-on-surface">Claimed by: {claim.partnerName} ({claim.partnerId})</span>
                        <span>· Date: {claim.referralDate || 'Recent'}</span>
                        {claim.notes && <span>· Notes: {claim.notes}</span>}
                      </div>
                    </div>

                    {claim.status === 'Pending Verification' && (
                      <button
                        onClick={() => handleVerifyClaim(claim)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 size={13} /> Verify & Credit Commission
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-on-surface-variant text-xs">
                  <Link size={36} className="mx-auto mb-2 opacity-25" />
                  <p className="font-bold text-on-surface">No pending referral claims</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Missing referral reports submitted by partners will appear here.</p>
                </div>
              )}
            </div>
          </div>
        ) : !isPartnerUser && activeFilter === 'settlements' ? (
          /* VIEW 3: Monthly Settlements (Admin Only) */
          <div className="flex-1 bg-surface-container/60 border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm flex flex-col p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <DollarSign size={18} className="text-primary" /> Month-End Batch Commission Settlement Ledger
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Disburse accumulated commissions for 100% completed deals via bank transfer in one batch.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
              {basePartnersList.map(p => {
                const partnerLeads = getPartnerReferrals(p);
                const eligiblePayout = partnerLeads.filter(l => l.commState === 'Eligible for Payout').reduce((s, l) => s + (l.calculatedCommAmount || 0), 0);
                const totalSettled = partnerLeads.filter(l => l.commState === 'Paid & Settled').reduce((s, l) => s + (l.calculatedCommAmount || 0), 0);
                const avatarPhoto = getPartnerAvatar(p);

                return (
                  <div key={p.partnerId || p.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={{ ...p, photoURL: avatarPhoto, role: 'partner' }} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-on-surface">{p.name}</p>
                          <span className="font-mono text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{p.partnerId}</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                          Bank: <strong className="text-on-surface">{p.bankName || 'Not Set'}</strong> · A/C: <strong className="text-on-surface">{p.accountNumber || 'Not Set'}</strong> · Branch: {p.branchName || 'N/A'}
                        </p>
                        <div className="flex items-center gap-3 text-xs mt-1">
                          <span className="text-emerald-400 font-mono font-bold">Eligible: LKR {eligiblePayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className="text-on-surface-variant font-mono">Settled: LKR {totalSettled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const txId = 'TXN-' + String(Date.now()).slice(-6);
                        toast.success(`Monthly settlement processed for ${p.name} (Ref: ${txId})`);
                      }}
                      className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl border border-primary/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <CreditCard size={14} /> Disburse Payout
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* VIEW 4: MASTER-DETAIL 2-PANEL VIEW (Unified for both Admin & Partner) */
          <>
            {/* LEFT COLUMN: Partner Directory List (1/3 Width) */}
            <div className={`w-full lg:w-1/3 ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'} flex-col border border-outline-variant/60 bg-surface-container/60 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full`}>
              <div className="bg-surface-container-low/80 p-3.5 px-4 border-b border-outline-variant/60 flex justify-between items-center text-xs font-bold text-on-surface-variant uppercase tracking-wider flex-shrink-0">
                <span className="flex items-center gap-2">
                  <Handshake size={14} className="text-primary" />
                  Partner Directory ({filteredPartners.length})
                </span>
                <span className="text-[10px] text-on-surface-variant/70 lowercase font-medium">
                  click to inspect
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
                {filteredPartners.length === 0 ? (
                  <div className="p-12 text-center text-on-surface-variant text-sm font-medium">
                    <Handshake size={36} className="mx-auto mb-3 opacity-25 text-on-surface-variant" />
                    <p className="font-bold text-on-surface">No partner records found</p>
                    <p className="text-xs text-on-surface-variant mt-1">Try adjusting your search query or filter.</p>
                  </div>
                ) : (
                  filteredPartners.map(partner => {
                    const isSelected = (selectedPartner?.partnerId === partner.partnerId) || (selectedPartner?.id === partner.id);
                    const partnerLeads = getPartnerReferrals(partner);
                    const partnerCommRate = Number(partner.commissionRate) > 1 ? Number(partner.commissionRate) : 53.5;
                    const avatarPhoto = getPartnerAvatar(partner);

                    return (
                      <div
                        key={partner._firestoreId || partner.id || partner.partnerId}
                        onClick={() => {
                          setSelectedPartner({ ...partner, photoURL: avatarPhoto });
                          setEditFormData({ ...partner, photoURL: avatarPhoto, commissionRate: partnerCommRate });
                          setMobileView('detail');
                        }}
                        className={`p-4 transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                          isSelected 
                            ? 'bg-primary/10 border-l-4 border-primary shadow-[inset_0_0_15px_rgba(0,218,243,0.08)]' 
                            : 'hover:bg-surface-container-high/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Rich Profile Avatar supporting Google & Custom Photo */}
                          <UserAvatar
                            user={{ ...partner, photoURL: avatarPhoto, role: 'partner' }}
                            size="md"
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-bold text-xs truncate ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                                {partner.name}
                              </p>
                              <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20 flex-shrink-0">
                                {partner.partnerId || 'P-1001'}
                              </span>
                            </div>

                            <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                              {partner.contactPerson ? `${partner.contactPerson} · ` : ''}{partner.phone || partner.email || 'No contact'}
                            </p>

                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                                LKR {partnerCommRate.toFixed(2)}/SqFt
                              </span>
                              <span className="text-[9px] font-semibold text-on-surface-variant font-mono">
                                {partnerLeads.length} referral{partnerLeads.length === 1 ? '' : 's'}
                              </span>
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

            {/* RIGHT COLUMN: Selected Partner Workspace (2/3 Width) */}
            <div className={`flex-1 ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col border border-outline-variant/60 bg-surface-container/40 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] h-full`}>
              {!selectedPartner ? (
                /* Empty Selection Placeholder */
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <Handshake size={48} className="mx-auto mb-3 opacity-25 text-on-surface-variant" />
                  <h3 className="font-bold text-on-surface text-base">No Partner Selected</h3>
                  <p className="text-xs text-on-surface-variant max-w-sm mt-1">
                    Select a studio partner from the directory on the left to inspect relationship profile, agreement vault, commission ledger, and marketing QR kits.
                  </p>
                </div>
              ) : (
                /* Full Interactive Partner Workspace */
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {/* Top Partner Profile Banner */}
                  <div className="p-5 sm:p-6 bg-surface-container-low/90 border-b border-outline-variant/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Mobile back button */}
                      <button 
                        onClick={() => setMobileView('list')}
                        className="lg:hidden p-1.5 bg-surface-container hover:bg-surface-container-high rounded-lg text-on-surface-variant"
                      >
                        <X size={16} />
                      </button>

                      {/* Large Partner Avatar with Edit Photo trigger */}
                      <div className="relative group">
                        <UserAvatar 
                          user={{ ...selectedPartner, photoURL: getPartnerAvatar(selectedPartner), role: 'partner' }}
                          size="lg"
                        />
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center text-white transition-opacity cursor-pointer shadow-lg"
                          title="Change Studio Profile Photo"
                        >
                          <Camera size={18} />
                        </button>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePartnerPhotoSelect}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-black text-on-surface truncate">{selectedPartner.name}</h2>
                          <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                            {selectedPartner.partnerId}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {selectedPartner.status || 'Active'}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            LKR {Number(selectedPartner.commissionRate > 1 ? selectedPartner.commissionRate : 53.5).toFixed(2)}/SqFt
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-1">
                          {selectedPartner.contactPerson && <span>Contact: <strong className="text-on-surface">{selectedPartner.contactPerson}</strong></span>}
                          {selectedPartner.phone && (
                            <span className="font-mono flex items-center gap-1">
                              <Phone size={11} className="text-primary" /> {selectedPartner.phone}
                            </span>
                          )}
                          {selectedPartner.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={11} className="text-primary" /> {selectedPartner.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                      {selectedPartner.phone && (
                        <a
                          href={`tel:${selectedPartner.phone.replace(/[^0-9+]/g, '')}`}
                          className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Call Studio via Phone Link"
                        >
                          <PhoneCall size={12} /> Call
                        </a>
                      )}
                      <button
                        onClick={() => setQrPartner(selectedPartner)}
                        className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold border border-outline-variant flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <QrCode size={12} /> QR Flyer
                      </button>
                      <button
                        onClick={() => setEmailModalConfig({
                          isOpen: true,
                          recipient: selectedPartner,
                          initialTemplateId: 'commission_disbursement',
                        })}
                        className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold border border-outline-variant flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Mail size={12} /> Email
                      </button>
                      {canAccess(currentUser?.role, 'partners', 'edit') && (
                        <button
                          onClick={() => {
                            setEditFormData({
                              ...selectedPartner,
                              photoURL: getPartnerAvatar(selectedPartner),
                              commissionRate: Number(selectedPartner.commissionRate > 1 ? selectedPartner.commissionRate : 53.5)
                            });
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold border border-primary/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      )}
                      {!isPartnerUser && canAccess(currentUser?.role, 'partners', 'delete') && (
                        <button
                          onClick={() => setDeletePartnerId(selectedPartner._firestoreId || selectedPartner.id || selectedPartner.partnerId)}
                          className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 transition-colors cursor-pointer"
                          title="Delete Partner"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-Workspace Navigation Tabs */}
                  <div className="flex items-center gap-2 px-5 pt-3 border-b border-outline-variant/60 bg-surface-container-low/40">
                    <button
                      onClick={() => setWorkspaceTab('referrals')}
                      className={'px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ' + (
                        workspaceTab === 'referrals'
                          ? 'border-primary text-primary bg-surface-container/60 font-black'
                          : 'border-transparent text-on-surface-variant hover:text-on-surface'
                      )}
                    >
                      <Layers size={13} /> Referrals & Deals ({selectedPartnerLeads.length})
                    </button>
                    <button
                      onClick={() => setWorkspaceTab('documents')}
                      className={'px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ' + (
                        workspaceTab === 'documents'
                          ? 'border-primary text-primary bg-surface-container/60 font-black'
                          : 'border-transparent text-on-surface-variant hover:text-on-surface'
                      )}
                    >
                      <ShieldCheck size={13} /> Agreements Vault (4)
                    </button>
                    <button
                      onClick={() => setWorkspaceTab('financial')}
                      className={'px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ' + (
                        workspaceTab === 'financial'
                          ? 'border-primary text-primary bg-surface-container/60 font-black'
                          : 'border-transparent text-on-surface-variant hover:text-on-surface'
                      )}
                    >
                      <CreditCard size={13} /> Bank & Payouts
                    </button>
                    <button
                      onClick={() => setWorkspaceTab('marketing')}
                      className={'px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ' + (
                        workspaceTab === 'marketing'
                          ? 'border-primary text-primary bg-surface-container/60 font-black'
                          : 'border-transparent text-on-surface-variant hover:text-on-surface'
                      )}
                    >
                      <QrCode size={13} /> Marketing Kit
                    </button>
                    {!isPartnerUser && canAccess(currentUser?.role, 'partners', 'delete') && (
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
                    )}
                  </div>

                  {/* Sub-Workspace Active Content */}
                  <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                    
                    {/* 1. Referrals & Deals Table */}
                    {workspaceTab === 'referrals' && (
                      <div className="bg-surface-container rounded-2xl border border-outline-variant/60 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-surface-container-high/80 text-[10px] font-black uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/60">
                              <tr>
                                <th className="py-3 px-4">Client Name & Contact</th>
                                <th className="py-3 px-4">Date Referred</th>
                                <th className="py-3 px-4 text-right">Deal Value</th>
                                <th className="py-3 px-4 text-right">Commission (LKR/SqFt)</th>
                                <th className="py-3 px-4">Payment</th>
                                <th className="py-3 px-4">Commission Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/30">
                              {selectedPartnerLeads.length > 0 ? (
                                selectedPartnerLeads.map((lead) => (
                                  <tr key={lead.id} className="hover:bg-surface-container-high/40 transition-colors">
                                    <td className="py-3 px-4">
                                      <div className="font-bold text-on-surface">{lead.name || 'Direct Client'}</div>
                                      <div className="text-[10px] text-on-surface-variant flex items-center gap-2 mt-0.5">
                                        <span className="font-mono">{lead.phone || 'No phone'}</span>
                                        {lead.phone && (
                                          <button
                                            type="button"
                                            onClick={() => window.open('https://wa.me/' + lead.phone.replace(/[^0-9]/g, ''), '_blank')}
                                            className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                                            title="WhatsApp Client"
                                          >
                                            <Phone size={10} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-[11px] text-on-surface-variant font-mono">
                                      {lead.date || new Date().toISOString().split('T')[0]}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-on-surface">
                                      LKR {lead.calculatedDealVal > 0 ? lead.calculatedDealVal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'TBD'}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <div className="font-mono font-black text-primary text-xs">
                                        LKR {lead.calculatedCommAmount > 0 ? lead.calculatedCommAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                                      </div>
                                      <div className="text-[9px] text-on-surface-variant font-mono">
                                        (LKR {Number(lead.calculatedCommRate || 53.5).toFixed(2)}/SqFt{lead.calculatedSqFt > 0 ? ` · ${lead.calculatedSqFt} SqFt` : ''})
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className={'text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ' + (
                                        lead.paymentStatus === '100% Fully Settled'
                                          ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                                          : lead.paymentStatus === '75% Advance Paid'
                                          ? 'text-blue-400 bg-blue-500/15 border-blue-500/30'
                                          : 'text-on-surface-variant bg-surface-container-high border-outline-variant/60'
                                      )}>
                                        {lead.paymentStatus}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className={'text-[10px] font-black px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ' + (
                                        lead.commState === 'Paid & Settled'
                                          ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40'
                                          : lead.commState === 'Eligible for Payout'
                                          ? 'text-primary bg-primary/20 border-primary/40 animate-pulse'
                                          : lead.commState === 'Accrued (In Production)'
                                          ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                                          : 'text-on-surface-variant bg-surface-container-high border-outline-variant'
                                      )}>
                                        {lead.commState === 'Eligible for Payout' && <Sparkles size={10} />}
                                        {lead.commState}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={6} className="py-12 text-center text-on-surface-variant text-xs">
                                    <Layers size={36} className="mx-auto mb-2 opacity-25" />
                                    <p className="font-bold text-on-surface">No referrals linked yet</p>
                                    <p className="text-[11px] text-on-surface-variant mt-1">Share your dedicated QR flyer or referral link with clients to start earning LKR 53.50/SqFt commissions!</p>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 2. Agreements Vault */}
                    {workspaceTab === 'documents' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          {
                            key: 'brCert',
                            title: 'Business Registration (BR) Certificate',
                            desc: 'Official BR document proving studio business registration in Sri Lanka.',
                            doc: selectedPartner?.documents?.brCert,
                          },
                          {
                            key: 'frameworkAgreement',
                            title: 'Signed Partner Framework Agreement',
                            desc: 'Bilateral referral terms, commission schedule (LKR 53.50/SqFt), and monthly settlements.',
                            doc: selectedPartner?.documents?.frameworkAgreement,
                          },
                          {
                            key: 'qualityGuidelines',
                            title: 'Signed Operational Quality Guidelines PDF',
                            desc: 'Print To Frame standard manufacturing, glass handling, and framing assembly specs.',
                            doc: selectedPartner?.documents?.qualityGuidelines,
                          },
                          {
                            key: 'nicDoc',
                            title: 'Signatory Identity Verification (NIC/Passport)',
                            desc: 'National identity card or passport scan of the studio owner/director.',
                            doc: selectedPartner?.documents?.nicDoc,
                          },
                        ].map((item) => (
                          <div key={item.key} className="bg-surface-container p-4 rounded-2xl border border-outline-variant/60 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                  <FileText size={14} className="text-primary" /> {item.title}
                                </span>
                                {item.doc?.url ? (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Verified
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-on-surface-variant mt-1">{item.desc}</p>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30">
                              {item.doc?.url && (
                                <a
                                  href={item.doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold rounded-xl border border-outline-variant flex items-center gap-1 transition-colors"
                                >
                                  <Eye size={11} /> View
                                </a>
                              )}
                              <label className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold rounded-xl border border-primary/30 flex items-center gap-1 transition-colors cursor-pointer">
                                <Upload size={11} />
                                <span>{uploadingDocKey === item.key ? 'Uploading...' : item.doc?.url ? 'Re-Upload' : 'Upload'}</span>
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  className="hidden"
                                  disabled={uploadingDocKey === item.key}
                                  onChange={(e) => handleFileUpload(e, item.key, selectedPartner)}
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. Bank & Payouts */}
                    {workspaceTab === 'financial' && (
                      <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                          <CreditCard size={14} className="text-primary" /> Bank Account & Payout Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Bank Name</span>
                            <p className="font-bold text-on-surface text-sm mt-0.5">{selectedPartner.bankName || 'Not Set'}</p>
                          </div>
                          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Account Number</span>
                            <p className="font-bold text-on-surface text-sm font-mono mt-0.5">{selectedPartner.accountNumber || 'Not Set'}</p>
                          </div>
                          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Account Holder Name</span>
                            <p className="font-bold text-on-surface text-sm mt-0.5">{selectedPartner.accountName || selectedPartner.name}</p>
                          </div>
                          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">Branch</span>
                            <p className="font-bold text-on-surface text-sm mt-0.5">{selectedPartner.branchName || 'Colombo Main'}</p>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={() => {
                              setEditFormData({ 
                                ...selectedPartner, 
                                photoURL: getPartnerAvatar(selectedPartner),
                                commissionRate: Number(selectedPartner.commissionRate > 1 ? selectedPartner.commissionRate : 53.5)
                              });
                              setShowEditModal(true);
                            }}
                            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold border border-primary/30 transition-colors cursor-pointer"
                          >
                            Update Bank Details
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. Marketing Kit */}
                    {workspaceTab === 'marketing' && (
                      <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                          <QrCode size={14} className="text-primary" /> Dedicated Counter QR Code & Referral URL
                        </h4>
                        <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase">Public Form URL</p>
                            <p className="font-mono text-xs text-primary truncate mt-0.5">{publicQrUrl(selectedPartner)}</p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(publicQrUrl(selectedPartner));
                              toast.success('Referral link copied!');
                            }}
                            className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/30 cursor-pointer"
                          >
                            <Copy size={13} />
                          </button>
                        </div>

                        <button
                          onClick={() => setQrPartner(selectedPartner)}
                          className="w-full py-3 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Download size={14} /> Download Printable Counter Display Flyer (1200x1600)
                        </button>
                      </div>
                    )}

                    {/* 5. Security & Access */}
                    {workspaceTab === 'security' && !isPartnerUser && canAccess(currentUser?.role, 'partners', 'delete') && (
                      <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                          <Lock size={14} className="text-primary" /> Security & Account Lifecycle
                        </h4>
                        <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Portal Login</span>
                          <p className={`font-bold text-sm mt-0.5 ${selectedPartnerUser ? 'text-emerald-400' : 'text-on-surface-variant'}`}>
                            {selectedPartnerUser ? selectedPartnerUser.identifier : 'No portal login for this partner'}
                          </p>
                        </div>

                        {selectedPartnerUser ? (
                          <>
                            <div className="pt-2 flex items-center gap-3">
                              <button
                                onClick={() => setShowPartnerResetForm(prev => !prev)}
                                className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold border border-outline-variant transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <KeyRound size={13} /> Reset Password
                              </button>
                            </div>

                            {showPartnerResetForm && (
                              <form onSubmit={handlePartnerResetPassword} className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={partnerResetPasswordValue}
                                  onChange={(e) => setPartnerResetPasswordValue(e.target.value)}
                                  placeholder="New password (min. 6 characters)"
                                  className="flex-1 px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary/60"
                                  autoFocus
                                />
                                <button
                                  type="submit"
                                  disabled={isResettingPartnerPassword}
                                  className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {isResettingPartnerPassword ? 'Resetting...' : 'Confirm Reset'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setShowPartnerResetForm(false); setPartnerResetPasswordValue(''); }}
                                  className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-bold border border-outline-variant transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </form>
                            )}
                          </>
                        ) : (
                          <p className="text-[11px] text-on-surface-variant">
                            This partner was created without a portal login (e.g. added manually before an approval flow granted one). There's no password to reset until a login exists for this email.
                          </p>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── CREATE PARTNER MODAL ─────────────────────────────────────────── */}
      <ModalWrapper
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        maxWidth="max-w-xl"
        height="h-auto"
        ariaLabel="Register Partner"
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <Handshake size={18} className="text-primary" /> Register New Framing Partner Studio
            </h3>
            <button onClick={closeCreateModal} className="text-on-surface-variant hover:text-on-surface p-1">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleCreatePartner} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Studio / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Ranga Framing"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner(p => ({ ...p, name: e.target.value }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Partner Code / ID</label>
                <input
                  type="text"
                  placeholder="e.g. P-1002 (auto-generated if empty)"
                  value={newPartner.partnerId}
                  onChange={(e) => setNewPartner(p => ({ ...p, partnerId: e.target.value }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Ranga Madhuka"
                  value={newPartner.contactPerson}
                  onChange={(e) => setNewPartner(p => ({ ...p, contactPerson: e.target.value }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Mobile (+94)</label>
                <input
                  type="text"
                  placeholder="+94 77 123 4567"
                  value={newPartner.phone}
                  onChange={(e) => setNewPartner(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="studio@example.com"
                  value={newPartner.email}
                  onChange={(e) => setNewPartner(p => ({ ...p, email: e.target.value }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Commission Rate (LKR / SqFt)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="1000"
                  value={newPartner.commissionRate}
                  onChange={(e) => setNewPartner(p => ({ ...p, commissionRate: Number(e.target.value) || 53.5 }))}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono font-bold"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-outline-variant/60">
              <button
                type="button"
                onClick={closeCreateModal}
                className="px-4 py-2 bg-surface-container text-on-surface-variant text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md"
              >
                Register Partner
              </button>
            </div>
          </form>
        </div>
      </ModalWrapper>

      {/* ── EDIT PARTNER MODAL ─────────────────────────────────────────── */}
      {showEditModal && editFormData && (
        <ModalWrapper
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          maxWidth="max-w-xl"
          height="h-auto"
          ariaLabel="Edit Partner Details"
        >
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Edit3 size={18} className="text-primary" /> Edit {selectedPartner?.name} Profile
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-on-surface-variant hover:text-on-surface p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Studio / Business Name</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData(p => ({ ...p, name: e.target.value }))}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">BR Number</label>
                  <input
                    type="text"
                    value={editFormData.brNumber || ''}
                    onChange={(e) => setEditFormData(p => ({ ...p, brNumber: e.target.value }))}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={editFormData.contactPerson || ''}
                    onChange={(e) => setEditFormData(p => ({ ...p, contactPerson: e.target.value }))}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Mobile (+94)</label>
                  <input
                    type="text"
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Commission Rate (LKR / SqFt)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="1000"
                    value={editFormData.commissionRate || 53.5}
                    onChange={(e) => setEditFormData(p => ({ ...p, commissionRate: Number(e.target.value) || 53.5 }))}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={editFormData.bankName || ''}
                    onChange={(e) => setEditFormData(p => ({ ...p, bankName: e.target.value }))}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={editFormData.accountNumber || ''}
                    onChange={(e) => setEditFormData(p => ({ ...p, accountNumber: e.target.value }))}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-on-surface font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-outline-variant/60">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-surface-container text-on-surface-variant text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePartnerDetails}
                  disabled={isSavingPartner}
                  className="px-6 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md"
                >
                  {isSavingPartner ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ── CLAIM MODAL (For Partner or Admin) ────────────────────── */}
      <ModalWrapper
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        maxWidth="max-w-md"
        height="h-auto"
        ariaLabel="Claim Missing Referral"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <Handshake size={18} className="text-primary" /> Claim Missing Referral
            </h3>
            <button onClick={() => setShowClaimModal(false)} className="text-on-surface-variant hover:text-on-surface p-1">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmitClaim} className="space-y-3.5">
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Client Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Kasun Jayawardena"
                value={claimForm.clientName}
                onChange={(e) => setClaimForm(p => ({ ...p, clientName: e.target.value }))}
                className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-xs text-on-surface"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Client Mobile (+94) *</label>
              <input
                type="text"
                required
                placeholder="+94 77 123 4567"
                value={claimForm.clientPhone}
                onChange={(e) => setClaimForm(p => ({ ...p, clientPhone: formatPhone(e.target.value) }))}
                className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-xs text-on-surface font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Date of Referral</label>
              <input
                type="date"
                value={claimForm.referralDate}
                onChange={(e) => setClaimForm(p => ({ ...p, referralDate: e.target.value }))}
                className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-xs text-on-surface"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">Notes / Scope (Optional)</label>
              <textarea
                rows={2}
                placeholder="Details of the job discussed..."
                value={claimForm.notes}
                onChange={(e) => setClaimForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full p-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-xs text-on-surface"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2 border-t border-outline-variant/60">
              <button
                type="button"
                onClick={() => setShowClaimModal(false)}
                className="px-4 py-2 bg-surface-container text-on-surface-variant text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingClaim}
                className="px-5 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md"
              >
                {isSubmittingClaim ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </form>
        </div>
      </ModalWrapper>

      {/* ── IMAGE CROP MODAL (For Studio Logo / Profile Photo) ─────── */}
      {showCropModal && rawImageForCrop && (
        <ImageCropModal
          isOpen={showCropModal}
          onClose={() => {
            setShowCropModal(false);
            setRawImageForCrop(null);
          }}
          imageSrc={rawImageForCrop}
          onCropComplete={handlePartnerCropComplete}
        />
      )}

      {/* ── DELETE MODAL ─────────────────────────────────────────── */}
      <DeleteModal
        isOpen={!!deletePartnerId}
        onClose={() => setDeletePartnerId(null)}
        onConfirm={handleDeletePartner}
        title="Remove Partner Studio"
        message={
          deletePartnerHasLogin
            ? "Are you sure you want to remove this partner? This also permanently deletes their portal login (Firebase account included) — they will not be able to sign in afterward, and this cannot be undone. Their past referral deals and invoices will remain intact."
            : "Are you sure you want to remove this partner from the directory? Their past referral deals and invoices will remain intact."
        }
      />

      {/* ── QR FLYER MODAL ─────────────────────────────────────────── */}
      {qrPartner && (
        <PartnerQRModal
          partner={qrPartner}
          isOpen={!!qrPartner}
          onClose={() => setQrPartner(null)}
        />
      )}

      {/* ── EMAIL TEMPLATE MODAL ─────────────────────────────────────────── */}
      {emailModalConfig.isOpen && (
        <EmailTemplateModal
          isOpen={emailModalConfig.isOpen}
          onClose={() => setEmailModalConfig({ isOpen: false, recipient: null, initialTemplateId: null })}
          recipient={emailModalConfig.recipient}
          initialTemplateId={emailModalConfig.initialTemplateId}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
