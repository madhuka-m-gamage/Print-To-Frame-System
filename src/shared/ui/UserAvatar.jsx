import React, { useState } from 'react';
import { User, Shield, Hammer, Palette, Briefcase, Layers, Sparkles } from 'lucide-react';

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px] rounded-lg',
  sm: 'w-8 h-8 text-xs rounded-xl',
  md: 'w-10 h-10 text-sm rounded-xl',
  lg: 'w-14 h-14 text-lg rounded-2xl',
  xl: 'w-20 h-20 text-2xl rounded-3xl',
};

const ICON_SIZES = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 36,
};

const PRESET_ICONS = {
  craftsman: Hammer,
  artist: Palette,
  executive: Briefcase,
  logistics: Layers,
  consultant: Sparkles,
  security: Shield,
};

export default function UserAvatar({
  user = {},
  photoURL: directPhotoURL,
  avatar: directAvatar,
  name: directName,
  role: directRole,
  size = 'md',
  className = '',
  showStatus = false,
  status = null,
  onClick = null,
  alt = '',
}) {
  const [imageError, setImageError] = useState(false);

  // Normalize user data (supports direct object, string, or individual props)
  const userData = typeof user === 'string' 
    ? { name: user, photoURL: user.startsWith('http') || user.startsWith('data:') ? user : null } 
    : user || {};

  const name = directName || userData.name || userData.clientName || userData.company || userData.identifier || 'User';
  const role = (directRole || userData.role || '').toLowerCase();
  
  // Extract photo from direct props or user data object with extensive property aliasing
  const rawPhoto = (
    directPhotoURL || 
    directAvatar || 
    userData.photoURL || 
    userData.photoUrl || 
    userData.avatar || 
    userData.photo || 
    userData.profilePicture || 
    userData.profileImage || 
    userData.image || 
    userData.picture || 
    (typeof user === 'string' && (user.startsWith('http') || user.startsWith('data:') || user.startsWith('/')) ? user : null)
  );

  const cleanPhoto = typeof rawPhoto === 'string' ? rawPhoto.trim() : null;
  const photoURL = !imageError && cleanPhoto && cleanPhoto.length > 5 ? cleanPhoto : null;
  const selectedPreset = userData.selectedPreset || null;
  const PresetIcon = selectedPreset ? PRESET_ICONS[selectedPreset] : null;

  // Reset image error state whenever the photo source changes
  React.useEffect(() => {
    setImageError(false);
  }, [rawPhoto]);

  // Role-based styling when displaying initials
  const getRoleStyle = (r) => {
    if (r === 'admin') return 'bg-primary/20 text-primary border-primary/40';
    if (r === 'partner') return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    if (r === 'customer' || r === 'business client') return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
    if (r === 'operations' || r === 'craftsman') return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
    if (r === 'logistics') return 'bg-pink-500/20 text-pink-400 border-pink-500/40';
    return 'bg-surface-container-high text-on-surface border-outline-variant/60';
  };

  const initial = (name.replace(/^[^a-zA-Z0-9]+/, '') || 'U').charAt(0).toUpperCase() || 'U';
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;
  const userStatus = status || userData.status || (userData.isApproved ? 'active' : null);

  return (
    <div 
      onClick={onClick}
      className={`relative inline-flex flex-shrink-0 items-center justify-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {photoURL ? (
        <img
          src={photoURL}
          alt={alt || name}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setImageError(true)}
          className={`${sizeClass} object-cover border border-primary/30 shadow-[0_0_12px_rgba(0,218,243,0.15)] bg-surface-container`}
        />
      ) : PresetIcon ? (
        <div className={`${sizeClass} flex items-center justify-center font-bold border ${getRoleStyle(role)} shadow-sm`}>
          <PresetIcon size={iconSize} />
        </div>
      ) : (
        <div className={`${sizeClass} flex items-center justify-center font-extrabold uppercase border ${getRoleStyle(role)} shadow-sm font-display`}>
          {initial || <User size={iconSize} />}
        </div>
      )}

      {/* Online / Active status indicator dot */}
      {showStatus && (
        <span 
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-surface ${
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
          } ${
            userStatus === 'deactivated' || userStatus === 'Deactivated'
              ? 'bg-rose-500'
              : userStatus === 'pending' || userStatus === 'Pending'
              ? 'bg-amber-400'
              : 'bg-emerald-400'
          }`}
          title={`Status: ${userStatus || 'Active'}`}
        />
      )}
    </div>
  );
}
