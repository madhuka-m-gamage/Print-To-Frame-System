import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../../services/firestoreSync';
import { validatePhone, validateEmail, formatPhone } from '../../utils/validation';
import { 
  User, Phone, Mail, Sparkles, Clock, CheckCircle2, 
  AlertCircle, ArrowRight, ShieldCheck, Tag 
} from 'lucide-react';

export default function ReferralForm() {
  const [partnerId, setPartnerId] = useState('');
  const [partnerDetails, setPartnerDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedLeadId, setSubmittedLeadId] = useState(null);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('ref') || params.get('partnerId');
    
    if (pid) {
      setPartnerId(pid);
      fetchPartnerDetails(pid);
    } else {
      setIsLoading(false);
      setError('Referral code is missing. Please scan a valid partner QR code.');
    }
  }, []);

  const fetchPartnerDetails = async (pid) => {
    try {
      const partnersRef = collection(db, COLLECTIONS.PARTNERS);
      const q = query(partnersRef, where('partnerId', '==', pid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setPartnerDetails(querySnapshot.docs[0].data());
      } else {
        // Fallback: check by ID or partner_applications
        const q2 = query(partnersRef, where('id', '==', Number(pid) || 0));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          setPartnerDetails(snap2.docs[0].data());
        } else {
          setPartnerDetails({ name: 'Verified Partner Studio', partnerId: pid });
        }
      }
    } catch (err) {
      console.error("Error fetching partner details:", err);
      setPartnerDetails({ name: 'Verified Partner Studio', partnerId: pid });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!formData.phone.trim() || !validatePhone(formData.phone)) {
      setError('Please enter a valid Sri Lankan mobile number (e.g. +94 77 123 4567).');
      return;
    }
    if (formData.email && !validateEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const leadId = `LD-${String(Date.now()).slice(-6)}`;
      const slaDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const leadData = {
        id: leadId,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email?.trim() || '',
        company: '',
        jobScope: `Claimed 15% Partner Referral Discount (Referred by ${partnerDetails?.name || partnerId})`,
        source: 'Referral',
        agentId: partnerId || 'Direct',
        agentName: partnerDetails?.name || partnerId || 'Partner Referral',
        partnerId: partnerId || '',
        partnerName: partnerDetails?.name || partnerId || '',
        commissionRate: Number(partnerDetails?.commissionRate) > 1 ? Number(partnerDetails?.commissionRate) : 53.5,
        stage: 'Intake',
        value: 0,
        totalSqFt: 0,
        date: new Date().toISOString().split('T')[0],
        callbackSlaDeadline: slaDeadline,
        callbackStatus: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, COLLECTIONS.LEADS, leadId), leadData);
      setSubmittedLeadId(leadId);
    } catch (err) {
      console.error("Error creating referral lead:", err);
      setError('Failed to submit inquiry: ' + (err.message || 'Please check your connection and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="font-sans antialiased fixed inset-0 flex items-center justify-center bg-surface text-on-surface">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Verifying Referral Code...</p>
        </div>
      </div>
    );
  }

  // ── Confirmation Screen ───────────────────────────────────────────────────
  if (submittedLeadId) {
    return (
      <div className="font-sans antialiased fixed inset-0 overflow-y-auto overflow-x-hidden bg-surface text-on-surface z-50">
        <div className="fixed inset-0 technical-grid opacity-15 pointer-events-none z-0"></div>
        
        <div className="min-h-full flex flex-col items-center p-4 sm:p-6 md:p-8 relative z-10 m-auto justify-center">
          <div className="w-full max-w-[440px] text-center flex flex-col items-center py-6">
            
            {/* Logo Header */}
            <div className="mb-6 inline-block text-center">
              <div className="flex justify-center mb-4">
                <img src="/logo-dark.png" alt="Print To Frame Logo" className="h-16 sm:h-20 w-auto object-contain" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">Print To Frame</h1>
              <p className="font-mono text-xs text-primary tracking-[0.2em] uppercase mt-1">Specialty Steel Framing</p>
            </div>

            {/* Success Card */}
            <div className="w-full bg-surface-container/60 backdrop-blur-md border border-outline-variant/50 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto border-2 border-primary/40 shadow-[0_0_25px_rgba(0,218,243,0.25)]">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/30">
                  15% Partner Discount Locked
                </span>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-on-surface">Congratulations!</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  Within <span className="font-bold text-primary">5 minutes</span>, Print To Frame support will call you to confirm your framing requirements and apply your discount.
                </p>
              </div>

              <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl text-left text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Inquiry Reference:</span>
                  <span className="font-bold text-primary">{submittedLeadId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Referred Partner:</span>
                  <span className="font-bold text-on-surface">{partnerDetails?.name || partnerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Response SLA:</span>
                  <span className="font-bold text-emerald-400">Under 5 Minutes</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.open(`https://wa.me/94711419027?text=Hi%20Print%20To%20Frame,%20I%20claimed%20the%2015%%20discount%20via%20${partnerDetails?.name || partnerId}%20(Ref:%20${submittedLeadId})`, '_blank')}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Phone size={14} /> Open Direct WhatsApp Chat (+94 71 141 9027)
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Main Client Form ──────────────────────────────────────────────────────
  return (
    <div className="font-sans antialiased fixed inset-0 overflow-y-auto overflow-x-hidden bg-surface text-on-surface z-50">
      {/* Grid background */}
      <div className="fixed inset-0 technical-grid opacity-15 pointer-events-none z-0"></div>
      
      <div className="min-h-full flex flex-col items-center p-4 sm:p-6 md:p-8 relative z-10 m-auto justify-center">
        <div className="w-full max-w-[440px] text-center flex flex-col items-center py-6">
          
          {/* Logo Header */}
          <div className="mb-6 inline-block text-center">
            <div className="flex justify-center mb-4">
              <img src="/logo-dark.png" alt="Print To Frame Logo" className="h-16 sm:h-20 w-auto object-contain transition-transform duration-300 hover:scale-105" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">Print To Frame</h1>
            <p className="font-mono text-xs text-primary tracking-[0.2em] uppercase mt-1">Fabrication Portal</p>
          </div>

          {/* Form Card */}
          <div className="w-full bg-surface-container/60 backdrop-blur-md border border-outline-variant/50 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-left">
            
            {/* Promo Tag */}
            <div className="mb-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
              <Tag size={13} />
              <span>Exclusive 15% Partner Discount</span>
            </div>

            <h2 className="text-xl font-display font-bold text-on-surface mb-1">
              Get Your 15% Discount
            </h2>
            <p className="text-on-surface-variant text-xs mb-6 leading-relaxed">
              Special offer referred by <span className="text-primary font-bold">{partnerDetails?.name || 'Our Partner Studio'}</span>. Submit your contact details below to claim your discount.
            </p>

            {error && (
              <div className="bg-error-container/30 border border-error-container text-error text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              
              {/* Field 1: Full Name */}
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Full Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Kasun Perera"
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>

              {/* Field 2: Mobile Number */}
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Mobile Number (+94) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                    <Phone size={16} />
                  </div>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+94 7X XXX XXXX"
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-mono font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>

              {/* Field 3: Email (Optional) */}
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@domain.com"
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3.5 bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(0,218,243,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] ${
                    isSubmitting ? 'opacity-50 cursor-wait' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <span>Claiming Your Discount...</span>
                  ) : (
                    <>
                      <span>Claim 15% Discount & Request Callback</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-on-surface-variant mt-3 flex items-center justify-center gap-1">
                  <Clock size={11} className="text-primary" />
                  <span>Guaranteed callback within 5 minutes</span>
                </p>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
