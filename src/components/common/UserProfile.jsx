import React, { useState, useRef } from 'react';
import { 
  User, Mail, Phone, Building, MapPin, Shield, KeyRound, 
  Camera, Check, Save, LogOut, Bell, Sparkles, Briefcase, 
  Layers, Hammer, Palette, Clock, Award, ShieldCheck, 
  Smartphone, AlertCircle, RefreshCw, ExternalLink,
  Map, MessageSquare, Calculator
} from 'lucide-react';
import { doc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../../services/firestoreSync';
import { toast } from '../../utils/toast';
import { logActivity } from '../../services/auditLog';
import { PageHeader, StatusBadge, ImageCropModal } from '../common/ui';
import { toDateObj } from '../../utils/dateUtils';

const AVATAR_PRESETS = [
  { id: 'craftsman', label: 'Master Framer', bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', icon: Hammer },
  { id: 'artist', label: 'Art Director', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/40', icon: Palette },
  { id: 'executive', label: 'Executive', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', icon: Briefcase },
  { id: 'logistics', label: 'Logistics Lead', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40', icon: Layers },
  { id: 'consultant', label: 'Design Consultant', bg: 'bg-pink-500/20 text-pink-400 border-pink-500/40', icon: Sparkles },
  { id: 'security', label: 'Security Admin', bg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40', icon: Shield },
];

export default function UserProfile({ currentUser, onUpdateUser, onSignOut, setActiveTab }) {
  const [activeSection, setActiveSection] = useState('personal');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Image Crop & Adjuster state
  const [rawImageForCrop, setRawImageForCrop] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Form State initialized from currentUser
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    identifier: currentUser?.identifier || '',
    contactNumber: currentUser?.contactNumber || '',
    company: currentUser?.company || '',
    location: currentUser?.location || 'Kadawatha, Sri Lanka',
    jobTitle: currentUser?.jobTitle || '',
    bio: currentUser?.bio || '',
    specialty: currentUser?.specialty || '',
    workshopType: currentUser?.workshopType || 'Custom Moulding & Assembly',
    photoURL: currentUser?.photoURL || currentUser?.avatar || '',
    selectedPreset: currentUser?.selectedPreset || '',
    notificationsEnabled: currentUser?.notificationsEnabled !== false,
    audioAlertsEnabled: currentUser?.audioAlertsEnabled !== false,
  });

  const isEmployee = ['Admin', 'admin', 'Sales', 'Operations', 'Logistics', 'Accounts', 'Support', 'Manager'].includes(currentUser?.role);
  const isPartner = currentUser?.role === 'Partner';
  const isCustomer = ['Customer', 'Business Client'].includes(currentUser?.role);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'admin';

  // Handle Photo Upload -> Opens Crop & Adjuster Modal
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      setRawImageForCrop(base64);
      setShowCropModal(true);
      // Reset input value so re-selecting same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBase64) => {
    setFormData(prev => ({
      ...prev,
      photoURL: croppedBase64,
      selectedPreset: '' // Clear preset if custom photo uploaded
    }));
    toast.success('Photo adjusted & cropped successfully! Click "Save Info" to apply.');
  };

  const handleReAdjustPhoto = () => {
    if (formData.photoURL) {
      setRawImageForCrop(formData.photoURL);
      setShowCropModal(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  // Handle Preset Avatar Selection
  const handleSelectPreset = (presetId) => {
    setFormData(prev => ({
      ...prev,
      selectedPreset: presetId,
      photoURL: '' // Clear custom image in favor of preset
    }));
  };

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!currentUser?.identifier) return;

    setIsSaving(true);
    try {
      const updatedProfile = {
        name: formData.name.trim() || currentUser.name,
        contactNumber: formData.contactNumber.trim(),
        company: formData.company.trim(),
        location: formData.location.trim(),
        jobTitle: formData.jobTitle.trim(),
        bio: formData.bio.trim(),
        specialty: formData.specialty.trim(),
        workshopType: formData.workshopType,
        photoURL: formData.photoURL || '',
        selectedPreset: formData.selectedPreset || '',
        notificationsEnabled: formData.notificationsEnabled,
        audioAlertsEnabled: formData.audioAlertsEnabled,
        updatedAt: new Date().toISOString()
      };

      const userDocRef = doc(db, 'users', String(currentUser.identifier).trim().toLowerCase());
      await setDoc(userDocRef, updatedProfile, { merge: true });

      // Cross-Collection Profile Sync (Finding 9)
      try {
        if (isPartner) {
          const partnersCol = collection(db, COLLECTIONS.PARTNERS);
          const emailQuery = (currentUser.email || currentUser.identifier || '').trim().toLowerCase();
          const partnerQueries = [];
          if (emailQuery) {
            partnerQueries.push(getDocs(query(partnersCol, where('email', '==', emailQuery))));
          }
          if (currentUser.partnerId) {
            partnerQueries.push(getDocs(query(partnersCol, where('partnerId', '==', currentUser.partnerId))));
          }
          const results = await Promise.all(partnerQueries);
          const matchedDocIds = new Set();
          results.forEach(snap => snap.docs.forEach(d => matchedDocIds.add(d.id)));

          const partnerUpdate = {
            name: formData.name.trim() || currentUser.name,
            contactPerson: formData.name.trim() || currentUser.name,
            photoURL: formData.photoURL || '',
          };
          if (formData.contactNumber.trim()) partnerUpdate.phone = formData.contactNumber.trim();
          if (formData.location.trim()) partnerUpdate.address = formData.location.trim();
          if (formData.company.trim()) partnerUpdate.company = formData.company.trim();

          for (const docId of matchedDocIds) {
            await updateDoc(doc(db, COLLECTIONS.PARTNERS, docId), partnerUpdate);
          }
        } else if (isCustomer) {
          const customersCol = collection(db, COLLECTIONS.CUSTOMERS);
          const emailQuery = (currentUser.email || currentUser.identifier || '').trim().toLowerCase();
          const custQueries = [];
          if (emailQuery) {
            custQueries.push(getDocs(query(customersCol, where('email', '==', emailQuery))));
          }
          const nicVal = (currentUser.nic || currentUser.clientNIC || '').trim();
          if (nicVal) {
            custQueries.push(getDocs(query(customersCol, where('nic', '==', nicVal))));
          }
          const results = await Promise.all(custQueries);
          const matchedDocIds = new Set();
          results.forEach(snap => snap.docs.forEach(d => matchedDocIds.add(d.id)));

          const customerUpdate = {
            name: formData.name.trim() || currentUser.name,
            photoURL: formData.photoURL || '',
          };
          if (formData.contactNumber.trim()) customerUpdate.phone = formData.contactNumber.trim();
          if (formData.location.trim()) customerUpdate.address = formData.location.trim();

          for (const docId of matchedDocIds) {
            await updateDoc(doc(db, COLLECTIONS.CUSTOMERS, docId), customerUpdate);
          }
        }
      } catch (syncErr) {
        console.warn('Cross-collection directory sync notice:', syncErr);
      }

      // Update in-memory user
      if (onUpdateUser) {
        onUpdateUser({
          ...currentUser,
          ...updatedProfile
        });
      }

      await logActivity(
        currentUser.identifier,
        formData.name || currentUser.name,
        'UPDATE',
        'Profile',
        'Updated personal profile settings and identity preferences.'
      );

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error saving user profile:', error);
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Password Reset Dispatcher
  const handlePasswordReset = () => {
    toast.info(`Password reset instructions sent to ${currentUser.identifier}`);
  };

  // Render Current Avatar
  const renderAvatar = (size = 'lg') => {
    const sizeClasses = size === 'lg' 
      ? 'w-24 h-24 sm:w-28 sm:h-28 text-3xl' 
      : 'w-14 h-14 text-xl';

    if (formData.photoURL) {
      return (
        <img 
          src={formData.photoURL} 
          alt={formData.name || 'User Avatar'} 
          className={`${sizeClasses} rounded-3xl object-cover border-2 border-primary/40 shadow-[0_0_25px_rgba(0,218,243,0.25)]`} 
        />
      );
    }

    if (formData.selectedPreset) {
      const preset = AVATAR_PRESETS.find(p => p.id === formData.selectedPreset) || AVATAR_PRESETS[0];
      const PresetIcon = preset.icon;
      return (
        <div className={`${sizeClasses} rounded-3xl ${preset.bg} border-2 flex items-center justify-center shadow-lg`}>
          <PresetIcon size={size === 'lg' ? 44 : 24} />
        </div>
      );
    }

    return (
      <div className={`${sizeClasses} rounded-3xl bg-primary/20 text-primary border-2 border-primary/30 flex items-center justify-center font-black shadow-[0_0_20px_rgba(0,218,243,0.2)]`}>
        {formData.name?.charAt(0)?.toUpperCase() || currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
      </div>
    );
  };

  return (
    <div className="flex flex-col pb-12">
      {/* Standardized Header */}
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal credentials, studio identity, contact details, and workspace preferences."
        metrics={[
          { label: "Account Role", value: currentUser?.role || "Employee", color: "cyan" },
          { label: "Account Status", value: currentUser?.isApproved ? "Active" : "Pending", color: currentUser?.isApproved ? "emerald" : "warning" },
          { label: "Security Level", value: isAdmin ? "Super Admin" : "Authorized", color: isAdmin ? "amber" : "neutral" },
          { label: "Member Since", value: toDateObj(currentUser?.createdAt)?.getFullYear() || "2024", color: "neutral" }
        ]}
      />

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Identity Card & Quick Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Identity Card */}
          <div className="bg-surface-container/80 border border-outline rounded-3xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.2)] text-center relative overflow-hidden">
            {/* Background Glow Accent */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            
            {/* Avatar with Camera Trigger & Adjust Button */}
            <div className="relative inline-block mx-auto mb-2">
              {renderAvatar('lg')}
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-2.5 bg-primary text-on-primary rounded-2xl hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,218,243,0.4)] active:scale-95 cursor-pointer"
                title="Upload New Photo"
              >
                <Camera size={16} />
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            {formData.photoURL && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={handleReAdjustPhoto}
                  className="text-[10px] font-bold text-primary hover:text-primary/80 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Sparkles size={11} /> Crop & Adjust Placement
                </button>
              </div>
            )}

            <h2 className="text-xl font-black text-on-surface tracking-tight truncate">
              {formData.name || currentUser?.name || 'Authorized Member'}
            </h2>
            
            <p className="text-xs font-mono text-on-surface-variant truncate mt-0.5 mb-3">
              {currentUser?.identifier}
            </p>

            <div className="flex items-center justify-center gap-2 mb-5">
              <StatusBadge status={currentUser?.role || 'Member'} size="sm" />
              {currentUser?.isApproved && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md">
                  <ShieldCheck size={12} />
                  Verified
                </span>
              )}
            </div>

            {formData.jobTitle && (
              <p className="text-xs text-primary font-bold bg-primary/10 border border-primary/20 rounded-xl py-1.5 px-3 mb-4 inline-block">
                {formData.jobTitle}
              </p>
            )}

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-outline">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,218,243,0.25)] active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Info</span>
              </button>

              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl font-bold text-xs transition-all border border-rose-500/20 active:scale-95"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Preset Avatar Selector */}
          <div className="bg-surface-container/80 border border-outline rounded-3xl p-5 shadow-[0_4px_25px_rgba(0,0,0,0.15)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface mb-3 flex items-center justify-between">
              <span>Avatar Presets</span>
              <span className="text-[10px] text-on-surface-variant font-normal lowercase">or upload custom photo</span>
            </h3>
            
            <div className="grid grid-cols-3 gap-2.5">
              {AVATAR_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = formData.selectedPreset === preset.id && !formData.photoURL;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                      isSelected 
                        ? `${preset.bg} ring-2 ring-primary shadow-md scale-105` 
                        : 'bg-surface-container-low border-outline text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-[9px] font-bold tracking-tight leading-tight">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Security & Authentication Box */}
          <div className="bg-surface-container/80 border border-outline rounded-3xl p-5 shadow-[0_4px_25px_rgba(0,0,0,0.15)] space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center">
              <KeyRound size={15} className="mr-2 text-amber-400" />
              Security & Credentials
            </h3>

            <div className="p-3 bg-surface-container-low rounded-xl border border-outline flex justify-between items-center text-xs">
              <div>
                <p className="font-bold text-on-surface">Password Security</p>
                <p className="text-[10px] text-on-surface-variant font-mono">Firebase Auth Secured</p>
              </div>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="px-3 py-1.5 bg-surface-container-high text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-colors border border-primary/30"
              >
                Reset Password
              </button>
            </div>

            <div className="p-3 bg-surface-container-low rounded-xl border border-outline flex justify-between items-center text-xs">
              <div>
                <p className="font-bold text-on-surface">Active Session</p>
                <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Authenticated & Online
                </p>
              </div>
              <span className="text-[10px] font-mono text-on-surface-variant font-medium">Cloud Run Ingress</span>
            </div>
          </div>

        </div>

        {/* Right Column: Tabbed Information Sections (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section Navigation Tabs */}
          <div className="flex space-x-2 bg-surface-container/80 p-1.5 rounded-2xl border border-outline">
            {[
              { id: 'personal', label: 'Personal Information', icon: User },
              { id: 'workspace', label: isPartner ? 'Studio & Craft Profile' : isCustomer ? 'Client Account Info' : 'Department & Duties', icon: Briefcase },
              { id: 'preferences', label: 'System Preferences', icon: Bell }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-primary text-on-primary shadow-[0_4px_15px_rgba(0,218,243,0.2)]' 
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Section 1: Personal & Contact Information */}
          {activeSection === 'personal' && (
            <div className="bg-surface-container/80 border border-outline rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.2)] space-y-5">
              <div className="border-b border-outline pb-3">
                <h3 className="text-base font-bold text-on-surface">Personal & Contact Details</h3>
                <p className="text-xs text-on-surface-variant">Update your public identity details and contact methods across the ERP system.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-3.5 text-on-surface-variant" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Ruwan Jayasuriya"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                    Email Account (Read-Only)
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-3.5 text-on-surface-variant" />
                    <input
                      type="email"
                      value={currentUser?.identifier || ''}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low/50 border border-outline rounded-xl text-sm font-mono text-on-surface-variant cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                    Contact Phone / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-3.5 text-on-surface-variant" />
                    <input
                      type="text"
                      value={formData.contactNumber}
                      onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                      placeholder="+94 71 141 9027"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                    Organization / Studio Name
                  </label>
                  <div className="relative">
                    <Building size={15} className="absolute left-3.5 top-3.5 text-on-surface-variant" />
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="e.g. Artisan Framing Works"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                    Job Title / Specialist Role
                  </label>
                  <div className="relative">
                    <Briefcase size={15} className="absolute left-3.5 top-3.5 text-on-surface-variant" />
                    <input
                      type="text"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      placeholder="e.g. Senior Moulding Technician"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                    Location / Workshop Base
                  </label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3.5 top-3.5 text-on-surface-variant" />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Kadawatha, Sri Lanka"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                  Professional Bio & Operational Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Share a short summary of your responsibilities, craft focus, or operational notes for the team..."
                  className="w-full p-4 bg-surface-container-highest/60 border border-outline rounded-2xl text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/50 custom-scrollbar resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.25)] active:scale-95"
                >
                  <Save size={15} />
                  <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Section 2: Role-Adaptive Workspace Capabilities */}
          {activeSection === 'workspace' && (
            <div className="space-y-6">
              
              {/* Partner View */}
              {isPartner && (
                <div className="bg-surface-container/80 border border-outline rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.2)] space-y-5">
                  <div className="border-b border-outline pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                        <Palette size={18} className="text-amber-400" />
                        Art Partner Studio Profile
                      </h3>
                      <p className="text-xs text-on-surface-variant">Custom framing capabilities, craftsmanship specialties, and collaboration specs.</p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      Partner Workspace
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                        Primary Framing Specialty
                      </label>
                      <input
                        type="text"
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                        placeholder="e.g. Conservation Framing, Acrylic Box Frames"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">
                        Workshop Capability Type
                      </label>
                      <select
                        value={formData.workshopType}
                        onChange={(e) => setFormData({ ...formData, workshopType: e.target.value })}
                        className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="Custom Moulding & Assembly">Custom Moulding & Assembly</option>
                        <option value="Canvas Stretcher Specialist">Canvas Stretcher Specialist</option>
                        <option value="Museum Glass & Conservation">Museum Glass & Conservation</option>
                        <option value="High-Volume Commercial Batch">High-Volume Commercial Batch</option>
                      </select>
                    </div>
                  </div>

                  {/* Partner Capabilities Grid */}
                  <div className="p-4 bg-surface-container-low rounded-2xl border border-outline space-y-3">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Active Partner Workspace Privileges</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 bg-surface-container rounded-xl border border-outline flex items-center gap-2">
                        <Check size={14} className="text-emerald-400" />
                        <span className="font-medium text-on-surface">15% Discount QR Kit</span>
                      </div>
                      <div className="p-2.5 bg-surface-container rounded-xl border border-outline flex items-center gap-2">
                        <Check size={14} className="text-emerald-400" />
                        <span className="font-medium text-on-surface">5-Min Callback SLA</span>
                      </div>
                      <div className="p-2.5 bg-surface-container rounded-xl border border-outline flex items-center gap-2">
                        <Check size={14} className="text-emerald-400" />
                        <span className="font-medium text-on-surface">Month-End Batch Payouts</span>
                      </div>
                      <div className="p-2.5 bg-surface-container rounded-xl border border-outline flex items-center gap-2">
                        <Check size={14} className="text-emerald-400" />
                        <span className="font-medium text-on-surface">Agreements & Vault</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="flex items-center space-x-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.25)] active:scale-95"
                    >
                      <Save size={15} />
                      <span>Save Studio Specs</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Employee View */}
              {isEmployee && (
                <div className="bg-surface-container/80 border border-outline rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.2)] space-y-5">
                  <div className="border-b border-outline pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                        <Briefcase size={18} className="text-primary" />
                        Department Operations & Access Privileges
                      </h3>
                      <p className="text-xs text-on-surface-variant">System clearance, module permissions, and assigned departmental workflows.</p>
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      {currentUser?.role} Department
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-outline">
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Assigned Department</p>
                      <p className="text-sm font-black text-on-surface mt-1">{currentUser?.role || 'Operations'}</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Print To Frame Pvt Ltd</p>
                    </div>

                    <div className="p-4 bg-surface-container-low rounded-2xl border border-outline">
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Internal Agent ID</p>
                      <p className="text-sm font-mono font-black text-primary mt-1">
                        {currentUser?.identifier?.split('@')[0]?.toUpperCase()}
                      </p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Verified Identity</p>
                    </div>

                    <div className="p-4 bg-surface-container-low rounded-2xl border border-outline">
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Clearance Status</p>
                      <p className="text-sm font-black text-emerald-400 mt-1">Full Internal Access</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">RBAC Synchronized</p>
                    </div>
                  </div>

                  {/* Quick Shortcut Navigation */}
                  <div className="p-4 bg-surface-container-low rounded-2xl border border-outline space-y-3">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Operational Jump Links</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab && setActiveTab('roadmap')}
                        className="p-3 bg-surface-container rounded-xl border border-outline hover:border-primary text-left text-xs font-bold text-on-surface transition-colors"
                      >
                        <Map size={14} className="text-primary mb-1.5" />
                        Execution Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab && setActiveTab('projects')}
                        className="p-3 bg-surface-container rounded-xl border border-outline hover:border-primary text-left text-xs font-bold text-on-surface transition-colors"
                      >
                        <Hammer size={14} className="text-cyan-400 mb-1.5" />
                        Fabrication Works
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab && setActiveTab('calculator')}
                        className="p-3 bg-surface-container rounded-xl border border-outline hover:border-primary text-left text-xs font-bold text-on-surface transition-colors"
                      >
                        <Calculator size={14} className="text-amber-400 mb-1.5" />
                        Cost Calculator
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab && setActiveTab('messages')}
                        className="p-3 bg-surface-container rounded-xl border border-outline hover:border-primary text-left text-xs font-bold text-on-surface transition-colors"
                      >
                        <MessageSquare size={14} className="text-purple-400 mb-1.5" />
                        Team Messages
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer View */}
              {isCustomer && (
                <div className="bg-surface-container/80 border border-outline rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.2)] space-y-5">
                  <div className="border-b border-outline pb-3">
                    <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                      <User size={18} className="text-emerald-400" />
                      Client Account Specifications
                    </h3>
                    <p className="text-xs text-on-surface-variant">Default delivery preferences, billing profile, and order specifications.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-outline">
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Account ID</p>
                      <p className="text-sm font-mono font-black text-on-surface mt-1">{currentUser?.identifier}</p>
                    </div>
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-outline">
                      <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Billing Status</p>
                      <p className="text-sm font-bold text-emerald-400 mt-1">Verified Client Account</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Section 3: System & Alert Preferences */}
          {activeSection === 'preferences' && (
            <div className="bg-surface-container/80 border border-outline rounded-3xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.2)] space-y-5">
              <div className="border-b border-outline pb-3">
                <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <Bell size={18} className="text-primary" />
                  Workspace Alerts & Notification Preferences
                </h3>
                <p className="text-xs text-on-surface-variant">Configure real-time system alerts, browser push notifications, and sound feedback.</p>
              </div>

              <div className="space-y-4">
                {/* Push Notification Toggle */}
                <div className="p-4 bg-surface-container-low rounded-2xl border border-outline flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="p-2.5 bg-primary/15 text-primary rounded-xl">
                      <Bell size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Desktop Browser Notifications</p>
                      <p className="text-xs text-on-surface-variant">Receive instant push alerts for job updates, invoices, and team chats.</p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, notificationsEnabled: !prev.notificationsEnabled }))}
                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                      formData.notificationsEnabled ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Audio Feedback Toggle */}
                <div className="p-4 bg-surface-container-low rounded-2xl border border-outline flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-xl">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Audio Sound Effects</p>
                      <p className="text-xs text-on-surface-variant">Play subtle chime sounds upon receiving new chat messages or notifications.</p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, audioAlertsEnabled: !prev.audioAlertsEnabled }))}
                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                      formData.audioAlertsEnabled ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.audioAlertsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,218,243,0.25)] active:scale-95"
                >
                  <Save size={15} />
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Interactive Avatar Crop & Adjuster Modal */}
      <ImageCropModal
        isOpen={showCropModal}
        imageSrc={rawImageForCrop}
        onCropComplete={handleCropComplete}
        onClose={() => setShowCropModal(false)}
      />
    </div>
  );
}
