import React, { useState } from 'react';
import { CircleAlert, CircleCheckBig, User, Briefcase, Mail, Lock, Phone, Building, Sparkles } from 'lucide-react';
import { googleSignIn } from '../../services/firebase';
import { PUBLIC_REGISTRATION_ROLES } from '../../constants/roles';

export default function Login({ onLogin, onRegister, errorMsg, successMsg }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [localError, setLocalError] = useState("");
  
  const [form, setForm] = useState({
    identifier: "",
    password: "",
    name: "",
    mobile: "",
    company: "",
    specialty: "",
    role: "Partner",
  });

  const roles = PUBLIC_REGISTRATION_ROLES;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLocalError("");
    try {
      if (isLoginView) {
        await onLogin(form.identifier, form.password);
      } else {
        await onRegister(form);
      }
    } catch (error) {
      setLocalError(error.message || "An error occurred");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setLocalError("");
    try {
      await googleSignIn();
      setLocalError("");
    } catch (error) {
      const errMsg = error?.message || "";
      const rawDetail = error?.code ? `${error.code}${errMsg ? ` — ${errMsg}` : ''}` : errMsg;
      if (errMsg.includes("unauthorized-domain")) {
        setLocalError(`User credential not registered / permission denied. First please request registration to log in for the system. (Admin notice: Please add 'portal.print2frame.xyz' to the Authorized Domains list in your Firebase Console -> Authentication -> Settings) [${rawDetail}]`);
      } else {
        // This used to show a fixed "not registered" message for ANY sign-in failure —
        // popup blocked, popup closed, network error, scope/consent issues, whatever —
        // which hid the real cause behind identical, misleading text every time.
        // Show the actual Firebase error so a real problem is diagnosable from the
        // screen instead of requiring a guess-and-check round every time.
        setLocalError(`Google sign-in failed: ${rawDetail || 'Unknown error'}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="font-sans antialiased fixed inset-0 overflow-y-auto overflow-x-hidden bg-surface text-on-surface z-50">
      {/* Grid background */}
      <div className="fixed inset-0 technical-grid opacity-15 pointer-events-none z-0"></div>
      
      <div className="min-h-full flex flex-col items-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-[440px] relative z-10 text-center flex flex-col items-center m-auto py-8">
        {/* Logo Header */}
        <div className="mb-12 inline-block text-center">
            <div className="flex justify-center mb-6">
                <img src="/logo-dark.png" alt="Print To Frame Logo" className="h-20 sm:h-24 w-auto object-contain transition-transform duration-300 hover:scale-105" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">Print To Frame</h1>
            <p className="font-mono text-xs text-primary tracking-[0.2em] uppercase mt-1">Fabrication Portal</p>
        </div>

        {/* Main Form Container */}
        <div className="w-full bg-surface-container/60 backdrop-blur-md border border-outline-variant/50 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
          
          <h2 className="text-xl font-display font-semibold text-on-surface mb-2">
            {isLoginView ? "Print To Frame" : "Request Access"}
          </h2>
          <p className="text-on-surface-variant text-sm mb-8">
            {isLoginView ? "Sign in to the portal" : "Request access to specialized framing services"}
          </p>

          {(errorMsg || localError) && (
            <div role="alert" aria-live="polite" className="bg-error-container/30 border border-error-container text-error text-sm p-3 rounded-lg mb-4 flex items-center">
              <CircleAlert size={16} className="mr-2 flex-shrink-0" aria-hidden="true" />
              <span>{errorMsg || localError}</span>
            </div>
          )}

          {successMsg && (
            <div role="status" aria-live="polite" className="bg-secondary/20 border border-secondary/40 text-secondary text-sm p-3 rounded-lg mb-4 flex items-center">
              <CircleCheckBig size={16} className="mr-2 flex-shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          <form className="space-y-4 text-left" onSubmit={handleSubmit}>
            {/* Signup fields hidden by default */}
            {!isLoginView && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <label htmlFor="login-name" className="font-sans text-xs text-on-surface-variant block mb-1.5 ml-1 font-medium">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/60 pointer-events-none" aria-hidden="true" />
                    <input
                      id="login-name"
                      type="text"
                      placeholder="Your Name"
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary transition-all"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="login-mobile" className="font-sans text-xs text-on-surface-variant block mb-1.5 ml-1 font-medium">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/60 pointer-events-none" aria-hidden="true" />
                    <input
                      id="login-mobile"
                      type="tel"
                      placeholder="+94 7X XXX XXXX"
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary transition-all"
                      value={form.mobile}
                      onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-role" className="font-sans text-xs text-on-surface-variant block mb-1.5 ml-1 font-medium">Requested Access Role</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/60 pointer-events-none" aria-hidden="true" />
                    <select
                      id="login-role"
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary transition-all"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="Partner">Art & Framing Partner</option>
                      <option value="Business Client">Corporate Client (B2B)</option>
                    </select>
                  </div>
                </div>

                {form.role === 'Business Client' && (
                  <div>
                    <label htmlFor="login-company" className="font-sans text-xs text-on-surface-variant block mb-1.5 ml-1 font-medium">Company / Enterprise Name *</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/60 pointer-events-none" aria-hidden="true" />
                      <input
                        id="login-company"
                        type="text"
                        placeholder="e.g. Apex Architects Pvt Ltd"
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary transition-all"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                )}

                {form.role === 'Partner' && (
                  <div>
                    <label htmlFor="login-specialty" className="font-sans text-xs text-on-surface-variant block mb-1.5 ml-1 font-medium">Specialization / Workshop Focus</label>
                    <div className="relative">
                      <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/60 pointer-events-none" aria-hidden="true" />
                      <input
                        id="login-specialty"
                        type="text"
                        placeholder="e.g. Canvas Framing, Gold Leafing, Acrylic"
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary transition-all"
                        value={form.specialty}
                        onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Always visible fields */}
            <div>
              <label htmlFor="login-identifier" className="font-sans text-xs text-on-surface-variant block mb-1.5 ml-1 font-medium">Email or Mobile</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/60 pointer-events-none" aria-hidden="true" />
                <input
                  id="login-identifier"
                  type="text"
                  placeholder="admin or email..."
                  autoComplete="username"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary transition-all"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="font-sans text-xs text-on-surface-variant block mb-1.5 ml-1 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline/60 pointer-events-none" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  placeholder="********"
                  autoComplete={isLoginView ? "current-password" : "new-password"}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary transition-all"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-primary-fixed/20 border border-primary-fixed/40 text-primary-container hover:bg-primary-fixed/30 py-2.5 rounded-lg text-sm font-semibold transition-all mt-6 shadow-[0_0_15px_rgba(0,218,243,0.1)] hover:shadow-[0_0_20px_rgba(0,218,243,0.25)] focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? "Please wait..." : isLoginView ? "Login" : "Request Access"}
            </button>
          </form>

          {/* Google Login Section */}
          {isLoginView && (
            <div className="mt-8 pt-6 border-t border-outline-variant/20">
              <p className="font-sans text-xs text-on-surface-variant mb-4">
                Or securely authenticate with ERP credentials:
              </p>
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-600 font-sans text-[15px] font-medium py-2.5 px-4 rounded shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.24)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.15),0_2px_3px_rgba(0,0,0,0.2)] transition-all disabled:opacity-50"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-[22px] h-[22px]">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                <span>{isLoggingIn ? "Signing in..." : "Login with Google"}</span>
              </button>
            </div>
          )}

          {/* Toggle Mode */}
          <div className="mt-8 font-sans text-sm">
            <p className="text-on-surface-variant">
              {isLoginView ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setIsLoginView(!isLoginView);
                  setForm({
                    identifier: "",
                    password: "",
                    name: "",
                    mobile: "",
                    role: "Customer",
                  });
                  setLocalError("");
                }}
                className="text-primary hover:underline font-medium"
              >
                {isLoginView ? "Register" : "Login"}
              </button>
            </p>
          </div>

        </div>
        
        <div className="mt-8 flex flex-col items-center gap-2 font-sans text-xs text-on-surface-variant/60">
          <div className="flex items-center gap-3">
            <a 
              href="https://www.print2frame.xyz/privacy-policy" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-primary transition-colors underline"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a 
              href="https://www.print2frame.xyz/terms-of-service" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-primary transition-colors underline"
            >
              Terms of Service
            </a>
          </div>
          <p>© 2026 Print To Frame Pvt Ltd. All rights reserved.</p>
        </div>
        </div>
      </div>
    </div>
  );
}

