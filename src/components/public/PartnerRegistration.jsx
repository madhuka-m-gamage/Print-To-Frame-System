import React, { useState } from 'react';
import { db, storage } from '../../services/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLLECTIONS } from '../../services/firestoreSync';
import { validatePhone, validateEmail, formatPhone } from '../../utils/validation';
import { 
  Building, User, Phone, Mail, MapPin, CreditCard, 
  Upload, Check, AlertCircle, FileText, Sparkles, Handshake, 
  ArrowRight, ShieldCheck, CheckCircle2 
} from 'lucide-react';

const SPECIALTIES = [
  'Custom Steel Box Iron Framing',
  'Canvas Gallery Wrap & Stretching',
  'Fine Art Wood & Acrylic Framing',
  'Large Format Digital Printing',
  'Interior Architecture & Commercial Art',
  'Art Conservation & Restoration'
];

export default function PartnerRegistration() {
  const [formData, setFormData] = useState({
    businessName: '',
    brNumber: '',
    yearEstablished: new Date().getFullYear(),
    specialties: ['Custom Steel Box Iron Framing'],
    contactName: '',
    designation: 'Studio Owner / Director',
    phone: '',
    email: '',
    address: '',
    city: 'Colombo',
    bankName: '',
    branchName: '',
    accountNumber: '',
    accountName: '',
    notes: '',
  });

  const [files, setFiles] = useState({
    brCert: null,
    nicCopy: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAppId, setSubmittedAppId] = useState(null);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError('');
  };

  const handleSpecialtyToggle = (spec) => {
    setFormData(prev => {
      const exists = prev.specialties.includes(spec);
      return {
        ...prev,
        specialties: exists 
          ? prev.specialties.filter(s => s !== spec)
          : [...prev.specialties, spec]
      };
    });
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`File ${file.name} is too large. Max file size is 5MB.`);
        return;
      }
      setFiles(prev => ({ ...prev, [field]: file }));
      setError('');
    }
  };

  const uploadFileToStorage = async (file, path) => {
    if (!file || !storage) return null;
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (err) {
      console.warn("Storage upload fallback:", err);
      return `local_${file.name}_${Date.now()}`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.businessName.trim()) {
      setError('Business / Studio Name is required.');
      return;
    }
    if (!formData.contactName.trim()) {
      setError('Primary Contact Person Name is required.');
      return;
    }
    if (!formData.phone.trim() || !validatePhone(formData.phone)) {
      setError('Please provide a valid contact number (e.g. +94 77 123 4567).');
      return;
    }
    if (!formData.email.trim() || !validateEmail(formData.email)) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!formData.bankName.trim() || !formData.accountNumber.trim() || !formData.accountName.trim()) {
      setError('Complete bank account details are required for commission payouts.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const appId = `APP-${String(Date.now()).slice(-6)}`;
      
      let brCertUrl = '';
      let nicCopyUrl = '';

      if (files.brCert) {
        brCertUrl = await uploadFileToStorage(files.brCert, `partners/applications/${appId}/br_${files.brCert.name}`);
      }
      if (files.nicCopy) {
        nicCopyUrl = await uploadFileToStorage(files.nicCopy, `partners/applications/${appId}/nic_${files.nicCopy.name}`);
      }

      const applicationData = {
        applicationId: appId,
        businessName: formData.businessName,
        brNumber: formData.brNumber || 'Pending / Sole Proprietor',
        yearEstablished: Number(formData.yearEstablished) || new Date().getFullYear(),
        specialties: formData.specialties,
        contactName: formData.contactName,
        designation: formData.designation,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        bankDetails: {
          bankName: formData.bankName,
          branchName: formData.branchName,
          accountNumber: formData.accountNumber,
          accountName: formData.accountName,
        },
        documents: {
          brCertUrl: brCertUrl || '',
          nicCopyUrl: nicCopyUrl || '',
        },
        notes: formData.notes,
        status: 'Pending',
        defaultCommissionRate: 53.5, // 53.50 LKR per SqFt
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, COLLECTIONS.PARTNER_APPLICATIONS, appId), applicationData);
      setSubmittedAppId(appId);
    } catch (err) {
      console.error("Error submitting partner application:", err);
      setError('Failed to submit application: ' + (err.message || 'Please check your connection and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedAppId) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-6 text-on-surface">
        <div className="max-w-xl w-full bg-surface-container-high p-8 sm:p-10 rounded-3xl border border-outline shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto border-2 border-primary/40 shadow-[0_0_30px_rgba(0,218,243,0.3)]">
            <CheckCircle2 size={44} />
          </div>

          <div>
            <span className="text-[10px] uppercase font-black text-primary tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/30">
              Application Staged for Vetting
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-on-surface mt-3">Partner Application Submitted!</h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-2 leading-relaxed">
              Thank you, <span className="font-bold text-on-surface">{formData.contactName}</span>. Your application for <span className="font-bold text-on-surface">{formData.businessName}</span> has been securely registered in our vetting queue.
            </p>
          </div>

          <div className="p-4 bg-surface-container-highest rounded-2xl border border-outline text-left space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-on-surface-variant">Application Reference ID:</span>
              <span className="font-bold text-primary">{submittedAppId}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-on-surface-variant">Review Status:</span>
              <span className="font-bold text-amber-400">Under Executive Review (24–48h)</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-on-surface-variant">Payout Bank Account:</span>
              <span className="font-bold text-on-surface">{formData.bankName} (Ending {formData.accountNumber.slice(-4)})</span>
            </div>
          </div>

          <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-xs text-on-surface text-left space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-primary">
              <Sparkles size={14} /> What happens next?
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Upon approval, you will receive an invitation email to activate your Partner Portal credentials and receive your **Unique Partner Referral Link & Printable Counter QR Code**.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.open(`https://wa.me/94711419027?text=Hello%20Print%20To%20Frame,%20I%20have%20submitted%20Partner%20Application%20${submittedAppId}`, '_blank')}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Phone size={14} /> Contact Partner Desk on WhatsApp (+94 71 141 9027)
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-surface-container hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl border border-outline transition-colors cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface py-10 px-4 sm:px-6 lg:px-8 text-on-surface flex justify-center">
      <div className="max-w-3xl w-full space-y-8">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold mb-1">
            <Handshake size={14} /> Print To Frame Partner Network
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-on-surface">
            Partner Registration & Onboarding
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Join Sri Lanka's leading specialty steel & gallery framing network. Bring framing referrals, track deal progress, and earn automated monthly commission payouts.
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="bg-surface-container-high rounded-3xl border border-outline p-6 sm:p-10 shadow-2xl space-y-8">
          
          {error && (
            <div className="p-4 bg-error/15 border border-error/30 rounded-2xl flex items-center gap-3 text-error text-xs font-bold animate-in fade-in">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Business & Studio Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-outline">
              <Building size={16} className="text-primary" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-on-surface">
                1. Studio & Business Profile
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Studio / Business Name *
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  placeholder="e.g. Colombo Art & Framing Co."
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Business Reg (BR) Number
                </label>
                <input
                  type="text"
                  name="brNumber"
                  value={formData.brNumber}
                  onChange={handleChange}
                  placeholder="e.g. PV-129481 or Sole Proprietor"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Specialties Selector */}
            <div>
              <label className="block text-xs uppercase font-bold text-on-surface mb-2 tracking-wider">
                Artisan Specialties & Services
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SPECIALTIES.map(spec => {
                  const selected = formData.specialties.includes(spec);
                  return (
                    <button
                      type="button"
                      key={spec}
                      onClick={() => handleSpecialtyToggle(spec)}
                      className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all flex items-center justify-between cursor-pointer ${
                        selected
                          ? 'bg-primary/15 border-primary/50 text-primary shadow-sm'
                          : 'bg-surface-container-highest/40 border-outline text-on-surface-variant hover:border-primary/30'
                      }`}
                    >
                      <span className="truncate">{spec}</span>
                      {selected && <Check size={14} className="text-primary flex-shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Contact Person */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-outline">
              <User size={16} className="text-primary" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-on-surface">
                2. Primary Contact & Location
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Contact Person Name *
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="e.g. Rohan Jayawardene"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Designation / Role
                </label>
                <input
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="e.g. Managing Partner / Lead Artisan"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Mobile Number (+94) *
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+94 7X XXX XXXX"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-mono font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Official Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="partner@yourstudio.com"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Studio Street Address & City
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="e.g. No. 45 Gallery Lane, Colombo 07"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Payout Bank Account Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-outline">
              <CreditCard size={16} className="text-primary" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-on-surface">
                3. Commission Payout Bank Details
              </h2>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Commissions are automatically settled via direct bank transfer at the end of each billing cycle.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Bank Name *
                </label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  placeholder="e.g. Commercial Bank of Ceylon"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Branch Name
                </label>
                <input
                  type="text"
                  name="branchName"
                  value={formData.branchName}
                  onChange={handleChange}
                  placeholder="e.g. Kollupitiya Branch"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Account Number *
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  placeholder="e.g. 1000293841"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-mono font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  placeholder="Exact name registered with bank"
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-xs sm:text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 4: Document Verification Uploads */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-outline">
              <Upload size={16} className="text-primary" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-on-surface">
                4. Document Attachments (Optional / Fast-Track Vetting)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-container-highest/40 rounded-2xl border-2 border-dashed border-outline hover:border-primary/50 transition-colors text-center">
                <FileText size={24} className="mx-auto text-primary/70 mb-2" />
                <div className="text-xs font-bold text-on-surface">Business Reg (BR) Certificate</div>
                <div className="text-[10px] text-on-surface-variant mt-0.5">PDF or JPG (Max 5MB)</div>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileChange(e, 'brCert')}
                  className="mt-3 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-on-primary cursor-pointer"
                />
              </div>

              <div className="p-4 bg-surface-container-highest/40 rounded-2xl border-2 border-dashed border-outline hover:border-primary/50 transition-colors text-center">
                <ShieldCheck size={24} className="mx-auto text-primary/70 mb-2" />
                <div className="text-xs font-bold text-on-surface">NIC / Passport Copy</div>
                <div className="text-[10px] text-on-surface-variant mt-0.5">Identity Verification (Max 5MB)</div>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileChange(e, 'nicCopy')}
                  className="mt-3 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-on-primary cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-outline">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 bg-primary text-on-primary hover:bg-primary/90 font-black text-sm rounded-2xl shadow-[0_0_25px_rgba(0,218,243,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] ${
                isSubmitting ? 'opacity-50 cursor-wait' : ''
              }`}
            >
              {isSubmitting ? (
                <span>Registering Application & Uploading Documents...</span>
              ) : (
                <>
                  <span>Submit Partner Registration for Review</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-on-surface-variant mt-3">
              By submitting this form, you agree to Print To Frame's framing quality standards and partner referral commission agreement.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
