import React from 'react';
import { 
  Sparkles, Cpu, Info, CheckCircle2, AlertCircle, AlertTriangle, 
  DollarSign, Hammer, Truck, Bell, Shield, ShieldCheck, Activity,
  Package, Database, HardDrive, Clock, FileText, Settings, Layers
} from 'lucide-react';

const ICON_CONFIG = {
  // CRM / Leads / Deals
  lead: { icon: Sparkles, gradient: 'from-cyan-500/25 via-blue-500/10 to-transparent', border: 'border-cyan-500/40', text: 'text-cyan-400', fill: 'fill-cyan-400/20', glow: 'shadow-[0_0_15px_rgba(0,218,243,0.2)]' },
  order: { icon: Sparkles, gradient: 'from-primary/25 via-cyan-500/10 to-transparent', border: 'border-primary/40', text: 'text-primary', fill: 'fill-primary/20', glow: 'shadow-[0_0_15px_rgba(0,218,243,0.2)]' },
  deal: { icon: Layers, gradient: 'from-cyan-500/25 via-sky-500/10 to-transparent', border: 'border-cyan-500/40', text: 'text-cyan-400', fill: 'fill-cyan-400/20', glow: 'shadow-[0_0_15px_rgba(0,218,243,0.18)]' },

  // Finance / Billing / Payments
  payment: { icon: DollarSign, gradient: 'from-emerald-500/25 via-teal-500/10 to-transparent', border: 'border-emerald-500/40', text: 'text-emerald-400', fill: 'fill-emerald-400/20', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.2)]' },
  invoice: { icon: DollarSign, gradient: 'from-emerald-500/25 via-teal-500/10 to-transparent', border: 'border-emerald-500/40', text: 'text-emerald-400', fill: 'fill-emerald-400/20', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.2)]' },

  // Operations / Production
  fabrication: { icon: Hammer, gradient: 'from-purple-500/25 via-pink-500/10 to-transparent', border: 'border-purple-500/40', text: 'text-purple-400', fill: 'fill-purple-400/20', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.2)]' },
  production: { icon: Hammer, gradient: 'from-purple-500/25 via-pink-500/10 to-transparent', border: 'border-purple-500/40', text: 'text-purple-400', fill: 'fill-purple-400/20', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.2)]' },

  // Logistics / Dispatch
  logistics: { icon: Truck, gradient: 'from-amber-500/25 via-orange-500/10 to-transparent', border: 'border-amber-500/40', text: 'text-amber-400', fill: 'fill-amber-400/20', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.2)]' },
  dispatch: { icon: Package, gradient: 'from-amber-500/25 via-orange-500/10 to-transparent', border: 'border-amber-500/40', text: 'text-amber-400', fill: 'fill-amber-400/20', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.2)]' },

  // System / Core
  system: { icon: Cpu, gradient: 'from-cyan-500/25 via-blue-500/10 to-transparent', border: 'border-cyan-500/40', text: 'text-cyan-400', fill: 'fill-cyan-400/20', glow: 'shadow-[0_0_15px_rgba(0,218,243,0.18)]' },
  status: { icon: ShieldCheck, gradient: 'from-emerald-500/25 via-teal-500/10 to-transparent', border: 'border-emerald-500/40', text: 'text-emerald-400', fill: 'fill-emerald-400/20', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.18)]' },
  info: { icon: Info, gradient: 'from-blue-500/25 via-indigo-500/10 to-transparent', border: 'border-blue-500/40', text: 'text-blue-400', fill: 'fill-blue-400/20', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.18)]' },

  // Alerts / Warnings / Errors
  warning: { icon: AlertTriangle, gradient: 'from-amber-500/25 via-orange-500/10 to-transparent', border: 'border-amber-500/40', text: 'text-amber-400', fill: 'fill-amber-400/20', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.22)]' },
  error: { icon: AlertCircle, gradient: 'from-rose-500/25 via-red-500/10 to-transparent', border: 'border-rose-500/40', text: 'text-rose-400', fill: 'fill-rose-400/20', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.22)]' },
  success: { icon: CheckCircle2, gradient: 'from-emerald-500/25 via-teal-500/10 to-transparent', border: 'border-emerald-500/40', text: 'text-emerald-400', fill: 'fill-emerald-400/20', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.2)]' },
};

export default function TwoToneIcon({ type = 'system', size = 'md', icon: CustomIcon, className = '' }) {
  const normType = String(type || 'system').toLowerCase().trim();
  const config = ICON_CONFIG[normType] || ICON_CONFIG.system;
  const IconComponent = CustomIcon || config.icon;

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-2xl',
  }[size] || 'w-10 h-10 rounded-xl';

  const iconSizes = {
    sm: 15,
    md: 18,
    lg: 22,
  }[size] || 18;

  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${config.gradient} border ${config.border} ${config.glow} ${sizeClasses} ${className}`}>
      <IconComponent 
        size={iconSizes} 
        className={`${config.text} ${config.fill} stroke-[1.8] relative z-10 transition-transform duration-200 group-hover:scale-110`} 
      />
    </div>
  );
}
