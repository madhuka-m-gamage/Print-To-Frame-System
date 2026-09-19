import React, { useState } from 'react';
import { QrCode, Copy, Check, Download, ExternalLink, Sparkles, Building, Printer, Share2 } from 'lucide-react';
import { toast } from '../../utils/toast';
import ModalWrapper from '../common/ui/detail-modal/ModalWrapper';

export default function PartnerQRModal({ isOpen, onClose, partner }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !partner) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://portal.print2frame.xyz';
  const referralUrl = `${origin}/referral?ref=${partner.partnerId || partner.id}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(referralUrl)}&color=00dac3&bgcolor=131720&qzone=2`;
  const printableQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(referralUrl)}&color=000000&bgcolor=ffffff&qzone=2`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success("Referral URL copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadCounterFlyer = () => {
    // Create an offscreen printable counter flyer
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1200;
    canvas.height = 1600;

    // Background
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, 1200, 1600);

    // Border Frame
    ctx.strokeStyle = '#00dac3';
    ctx.lineWidth = 12;
    ctx.strokeRect(40, 40, 1120, 1520);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRINT TO FRAME', 600, 160);

    ctx.fillStyle = '#00dac3';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('SPECIALTY STEEL & GALLERY FRAMING', 600, 220);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '28px sans-serif';
    ctx.fillText(`Official Partner Studio: ${partner.name}`, 600, 290);

    // QR Image Load
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Draw white backing for QR
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(350, 400, 500, 500);
      ctx.drawImage(img, 375, 425, 450, 450);

      // Call to action
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText('SCAN TO GET FRAMING QUOTE', 600, 1020);

      ctx.fillStyle = '#00dac3';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Instant 5-Minute Framing Specialist Callback', 600, 1080);

      ctx.fillStyle = '#64748b';
      ctx.font = '24px sans-serif';
      ctx.fillText(`Referral Code: ${partner.partnerId || 'PTF-REF'}`, 600, 1160);
      ctx.fillText('Custom Box Iron Frames • High-Tension Gallery Wraps • Digital Canvas', 600, 1220);
      
      ctx.fillStyle = '#00dac3';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Official Workshop Desk: +94 71 141 9027', 600, 1270);

      // Trigger download
      const link = document.createElement('a');
      link.download = `${partner.name.replace(/\s+/g, '_')}_Counter_Display_Card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success("Printable Counter Display Flyer downloaded!");
    };
    img.src = printableQrUrl;
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      height="h-auto"
      ariaLabel="Partner QR Code & Referral Kit"
    >
      <div className="p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-primary/15 text-primary rounded-xl">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Partner Marketing QR Kit</h3>
              <p className="text-xs text-on-surface-variant">{partner.name} · <span className="font-mono text-primary font-bold">{partner.partnerId}</span></p>
            </div>
          </div>
        </div>

        {/* QR Display Card */}
        <div className="p-6 bg-surface-container-highest/80 rounded-3xl border border-outline text-center space-y-4 shadow-inner">
          <div className="w-56 h-56 mx-auto bg-surface-container-lowest p-3 rounded-2xl border-2 border-primary/40 shadow-[0_0_30px_rgba(0,218,243,0.15)] flex items-center justify-center">
            <img 
              src={qrApiUrl} 
              alt={`QR Code for ${partner.name}`}
              className="w-full h-full object-contain rounded-xl"
            />
          </div>

          <div>
            <span className="text-[9px] uppercase font-mono font-bold text-primary tracking-widest bg-primary/10 px-2.5 py-1 rounded-full border border-primary/30">
              Unique Attribution Token: {partner.partnerId}
            </span>
            <p className="text-xs text-on-surface-variant mt-2">
              Customers scanning this code automatically link their inquiry and quotation commissions to <span className="font-bold text-on-surface">{partner.name}</span>.
            </p>
          </div>
        </div>

        {/* Referral URL & Copy Bar */}
        <div className="space-y-1.5">
          <label className="block text-xs uppercase font-bold text-on-surface tracking-wider">
            Dedicated Referral Intake URL
          </label>
          <div className="flex items-center bg-surface-container-highest/60 border border-outline rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/50">
            <input 
              type="text"
              readOnly
              value={referralUrl}
              className="flex-1 px-3 py-1 bg-transparent text-xs font-mono text-on-surface focus:outline-none truncate"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                copied ? 'bg-emerald-500 text-white' : 'bg-primary text-on-primary hover:bg-primary/90'
              }`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleDownloadCounterFlyer}
            className="py-3 px-4 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl border border-outline transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Download size={14} className="text-primary" />
            <span>Download Counter Flyer</span>
          </button>
          <button
            type="button"
            onClick={() => window.open(referralUrl, '_blank')}
            className="py-3 px-4 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl border border-primary/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <ExternalLink size={14} />
            <span>Test Client Referral Form</span>
          </button>
        </div>

      </div>
    </ModalWrapper>
  );
}
