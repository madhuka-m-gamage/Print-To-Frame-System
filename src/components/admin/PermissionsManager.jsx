import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePermissions } from '../../context/PermissionsContext';
import Card from '../common/Card';
import { 
  ShieldAlert, Save, Eye, Plus, Edit2, Trash2, Download, 
  Sparkles, Check, X, ChevronDown, Filter, Search, RotateCcw,
  Layers, CheckCircle2, Shield, AlertCircle, Sliders
} from 'lucide-react';
import { toast } from '../../utils/toast';
import { SYSTEM_ROLES } from '../../constants/roles';

// ── Action Definitions with metadata ──────────────────────────────────────────
const ACTION_DEFS = [
  { key: 'view',   label: 'View',   icon: Eye,      desc: 'Browse & view data',       badge: 'bg-status-ready/15 text-status-ready-on border-status-ready/30' },
  { key: 'create', label: 'Create', icon: Plus,     desc: 'Create new entries',        badge: 'bg-status-success/15 text-status-success-on border-status-success/30' },
  { key: 'edit',   label: 'Edit',   icon: Edit2,    desc: 'Update existing records',   badge: 'bg-status-warning/15 text-status-warning-on border-status-warning/30' },
  { key: 'delete', label: 'Delete', icon: Trash2,   desc: 'Permanently remove items',  badge: 'bg-status-danger/15 text-status-danger-on border-status-danger/30' },
  { key: 'export', label: 'Export', icon: Download, desc: 'Export & download CSV data',badge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
];

// ── Standard Presets ────────────────────────────────────────────────────────
const PRESETS = [
  { id: 'full', label: 'Full Access', short: 'Full', color: 'bg-status-success/15 text-status-success-on border-status-success/30 hover:bg-status-success/25', values: { view: true, create: true, edit: true, delete: true, export: true } },
  { id: 'write', label: 'Read & Write', short: 'Write', color: 'bg-status-ready/15 text-status-ready-on border-status-ready/30 hover:bg-status-ready/25', values: { view: true, create: true, edit: true, delete: false, export: false } },
  { id: 'view', label: 'View Only', short: 'View', color: 'bg-status-warning/15 text-status-warning-on border-status-warning/30 hover:bg-status-warning/25', values: { view: true, create: false, edit: false, delete: false, export: false } },
  { id: 'ops', label: 'Operations', short: 'Ops', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/25', values: { view: true, create: true, edit: true, delete: true, export: false } },
  { id: 'none', label: 'No Access', short: 'None', color: 'bg-surface-container-high/50 text-on-surface-variant/40 border-outline-variant/40 hover:text-on-surface-variant', values: { view: false, create: false, edit: false, delete: false, export: false } },
];

// ── Categorized Modules ──────────────────────────────────────────────────────
const MODULE_CATEGORIES = [
  {
    id: 'crm',
    name: 'CRM',
    modules: [
      { id: 'leads', label: 'Leads', desc: 'Client inquiries & quotation intake' },
      { id: 'pipeline', label: 'Deals', desc: 'Committed projects & stage tracking' },
      { id: 'customers', label: 'Customers', desc: 'Centralized client registry & profiles' },
    ]
  },
  {
    id: 'operations',
    name: 'Operations',
    modules: [
      { id: 'projects', label: 'Fabrication Works', desc: 'Factory work orders & manufacturing' },
      { id: 'logistics', label: 'Logistics', desc: 'Dispatch & driver delivery tracking' },
    ]
  },
  {
    id: 'finance',
    name: 'Databases & Tools',
    modules: [
      { id: 'invoices', label: 'Invoices', desc: 'Advance receipts & settlement billing ledger' },
      { id: 'receipts', label: 'Receipts', desc: 'Payment-received records issued against paid invoices' },
      { id: 'partners', label: 'Partners', desc: 'Creative agencies & referral partners' },
      { id: 'calculator', label: 'Cost Calculator', desc: 'Algorithmic steel framing pricing & BOM' },
    ]
  },
  {
    id: 'system',
    name: 'System & Tools',
    modules: [
      { id: 'dashboard', label: 'Dashboard', desc: 'Real-time enterprise overview & metrics' },
      { id: 'notifications', label: 'Notifications', desc: 'System alerts & activity updates' },
      { id: 'messages', label: 'Messages', desc: 'Direct 1-on-1 team messaging' },
      { id: 'agents', label: 'User Management', desc: 'Identities, dynamic RBAC & approvals' },
      { id: 'admin', label: 'System Overview', desc: 'Executive system analytics & audit logs' },
    ]
  }
];

const ROLES = SYSTEM_ROLES.filter(r => r !== 'Admin');

// Detect matching preset
function getMatchingPreset(perms = {}) {
  const v = !!perms.view;
  const c = !!perms.create;
  const e = !!perms.edit;
  const d = !!perms.delete;
  const x = !!perms.export;

  if (v && c && e && d && x) return PRESETS.find(p => p.id === 'full');
  if (v && c && e && !d && !x) return PRESETS.find(p => p.id === 'write');
  if (v && !c && !e && !d && !x) return PRESETS.find(p => p.id === 'view');
  if (v && c && e && d && !x) return PRESETS.find(p => p.id === 'ops');
  if (!v && !c && !e && !d && !x) return PRESETS.find(p => p.id === 'none');

  const activeCount = [v, c, e, d, x].filter(Boolean).length;
  return {
    id: 'custom',
    label: `Custom (${activeCount}/5)`,
    short: `${activeCount}/5`,
    color: 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25',
    values: perms
  };
}

export default function PermissionsManager({ currentUser }) {
  const { permissions, updatePermissions, loading } = usePermissions();
  const [localPerms, setLocalPerms] = useState(permissions || {});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Popover State
  const [activeCell, setActiveCell] = useState(null); // { role, moduleId, modLabel, rect }
  const [roleMenuOpen, setRoleMenuOpen] = useState(null); // role name
  const popoverRef = useRef(null);

  useEffect(() => {
    if (permissions) setLocalPerms(permissions);
  }, [permissions]);

  // Click outside listener to close popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setActiveCell(null);
        setRoleMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter modules based on search and category
  const filteredCategories = useMemo(() => {
    return MODULE_CATEGORIES.map(cat => {
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) return null;
      const matchedMods = cat.modules.filter(m => 
        m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.desc.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (matchedMods.length === 0) return null;
      return { ...cat, modules: matchedMods };
    }).filter(Boolean);
  }, [searchQuery, selectedCategory]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(localPerms) !== JSON.stringify(permissions);
  }, [localPerms, permissions]);

  const getModulePerms = (role, moduleId) => {
    return localPerms[role]?.[moduleId] || { view: false, create: false, edit: false, delete: false, export: false };
  };

  const setModulePerms = (role, moduleId, newValues) => {
    setLocalPerms(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [moduleId]: { ...newValues },
      },
    }));
  };

  const toggleSingleAction = (role, moduleId, actionKey) => {
    const current = getModulePerms(role, moduleId);
    const updated = { ...current, [actionKey]: !current[actionKey] };
    setModulePerms(role, moduleId, updated);
  };

  // Batch Role Actions
  const applyPresetToRole = (role, presetValues) => {
    setLocalPerms(prev => {
      const updatedRole = { ...(prev[role] || {}) };
      MODULE_CATEGORIES.forEach(cat => {
        cat.modules.forEach(m => {
          updatedRole[m.id] = { ...presetValues };
        });
      });
      return { ...prev, [role]: updatedRole };
    });
    setRoleMenuOpen(null);
    toast.success(`Updated all modules for ${role}`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalPerms = { ...localPerms };
      if (permissions.Admin) finalPerms.Admin = permissions.Admin; // Super Admin is always locked to full
      await updatePermissions(finalPerms, currentUser);
      toast.success('Permissions updated & synced across all roles!');
    } catch (err) {
      toast.error('Failed to save permissions: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalPerms(permissions);
    setActiveCell(null);
    toast.info('Changes reverted to last saved configuration.');
  };

  if (loading || !localPerms) {
    return (
      <Card className="p-8 text-center text-on-surface-variant flex items-center justify-center space-x-2">
        <Sparkles className="animate-spin text-primary" size={18} />
        <span>Loading Dynamic Permissions Matrix...</span>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6 space-y-6 relative overflow-visible">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-outline-variant/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-on-surface tracking-tight flex items-center gap-2">
                Dynamic Role Permissions
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Smart Presets Active
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Click any cell badge to switch preset or toggle granular access (View, Create, Edit, Delete, Export).
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 self-end lg:self-center">
          {hasUnsavedChanges && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 border border-outline-variant/60 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,218,243,0.25)] active:scale-95 cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/60 hover:text-on-surface'
            }`}
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Save Config'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low/60 p-2.5 rounded-2xl border border-outline-variant/50">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-2.5 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search module or feature..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface-container border border-outline-variant rounded-xl text-xs text-on-surface outline-none focus:border-primary/60"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface cursor-pointer">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Modules' },
            { id: 'crm', label: 'CRM & Sales' },
            { id: 'operations', label: 'Production' },
            { id: 'finance', label: 'Finance' },
            { id: 'system', label: 'System' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-surface-container border-outline-variant/60 text-on-surface-variant hover:border-primary/30'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="overflow-x-auto rounded-2xl border border-outline-variant/70 shadow-sm">
        <table className="w-full border-collapse text-left" style={{ minWidth: `${ROLES.length * 110 + 200}px` }}>
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="p-3.5 text-xs font-black text-on-surface uppercase tracking-wider sticky left-0 bg-surface-container-low z-20 min-w-[200px] border-r border-outline-variant/40">
                Module / Segment
              </th>
              {ROLES.map(role => (
                <th key={role} className="p-2.5 text-xs font-bold text-on-surface uppercase tracking-tight text-center min-w-[105px] relative">
                  <div className="flex items-center justify-center gap-1 group">
                    <span>{role}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoleMenuOpen(roleMenuOpen === role ? null : role);
                        setActiveCell(null);
                      }}
                      className="opacity-40 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-container-high transition-opacity cursor-pointer"
                      title={`Batch actions for ${role}`}
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>

                  {/* Role Column Batch Dropdown */}
                  {roleMenuOpen === role && (
                    <div
                      ref={popoverRef}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-48 bg-surface-container-high border border-outline-variant rounded-2xl shadow-2xl z-50 p-2 text-left animate-in fade-in zoom-in-95 duration-150"
                    >
                      <p className="text-[9px] font-black text-on-surface-variant uppercase px-2 py-1 tracking-wider border-b border-outline-variant/40 mb-1">
                        Batch Set {role}
                      </p>
                      {PRESETS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => applyPresetToRole(role, p.values)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>{p.label}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${p.color}`}>
                            {p.short}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-outline-variant/30 text-xs">
            {filteredCategories.map(category => (
              <React.Fragment key={category.id}>
                {/* Category Header Row */}
                <tr className="bg-surface-container-highest/40 font-bold">
                  <td colSpan={ROLES.length + 1} className="py-2 px-3.5 text-[10px] font-black uppercase tracking-widest text-primary">
                    {category.name}
                  </td>
                </tr>

                {/* Module Rows */}
                {category.modules.map((mod, idx) => (
                  <tr
                    key={mod.id}
                    className={`hover:bg-surface-container/40 transition-colors ${
                      idx % 2 === 0 ? 'bg-surface-container/10' : 'bg-transparent'
                    }`}
                  >
                    {/* Sticky Left Module Label */}
                    <td className="p-3 sticky left-0 bg-surface-container z-10 border-r border-outline-variant/40">
                      <div className="font-extrabold text-on-surface leading-tight">
                        {mod.label}
                      </div>
                      <div className="text-[10px] text-on-surface-variant font-medium mt-0.5 truncate max-w-[180px]">
                        {mod.desc}
                      </div>
                    </td>

                    {/* Role Permission Badges */}
                    {ROLES.map(role => {
                      const perms = getModulePerms(role, mod.id);
                      const preset = getMatchingPreset(perms);
                      const isCellActive = activeCell?.role === role && activeCell?.moduleId === mod.id;

                      return (
                        <td key={role} className="p-2 text-center align-middle relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setRoleMenuOpen(null);
                              setActiveCell(isCellActive ? null : { role, moduleId: mod.id, modLabel: mod.label, rect });
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border transition-all duration-150 active:scale-95 shadow-sm inline-flex items-center justify-center gap-1 min-w-[76px] cursor-pointer ${
                              preset.color
                            } ${isCellActive ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface' : ''}`}
                            title={`Configure ${role} permissions for ${mod.label}`}
                          >
                            <span>{preset.short}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating Interactive Popover Drawer */}
      {activeCell && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-[92vw] sm:w-72 max-w-sm bg-surface-container-high border-2 border-primary/40 rounded-3xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
          style={typeof window !== 'undefined' && window.innerWidth < 640 ? {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          } : {
            top: Math.min(window.innerHeight - 380, Math.max(20, activeCell.rect.bottom + 8)),
            left: Math.min(window.innerWidth - 300, Math.max(20, activeCell.rect.left - 100)),
          }}
        >
          {/* Popover Header */}
          <div className="flex justify-between items-start pb-3 border-b border-outline-variant/60">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary block">
                {activeCell.role} Role
              </span>
              <h4 className="text-sm font-extrabold text-on-surface leading-tight">
                {activeCell.modLabel}
              </h4>
            </div>
            <button
              onClick={() => setActiveCell(null)}
              className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* 1-Click Quick Presets Bar */}
          <div className="py-3 border-b border-outline-variant/40">
            <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-wider block mb-2">
              Quick Presets
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setModulePerms(activeCell.role, activeCell.moduleId, p.values)}
                  className={`py-1 px-2 rounded-xl text-[10px] font-bold border transition-all text-center cursor-pointer ${p.color}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Granular Action Checkboxes */}
          <div className="py-3 space-y-2">
            <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-wider block mb-1">
              Granular Action Controls
            </span>
            {ACTION_DEFS.map(act => {
              const currentPerms = getModulePerms(activeCell.role, activeCell.moduleId);
              const isChecked = currentPerms[act.key] === true;
              const Icon = act.icon;

              return (
                <button
                  key={act.key}
                  type="button"
                  onClick={() => toggleSingleAction(activeCell.role, activeCell.moduleId, act.key)}
                  className={`w-full p-2 rounded-xl border flex items-center justify-between transition-all text-left cursor-pointer ${
                    isChecked
                      ? 'bg-surface-container border-primary/40 text-on-surface shadow-sm'
                      : 'bg-surface-container-low/40 border-outline-variant/30 text-on-surface-variant/50 hover:text-on-surface-variant'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${isChecked ? act.badge : 'bg-surface-container border-outline-variant'}`}>
                      <Icon size={12} />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{act.label}</p>
                      <p className="text-[9px] text-on-surface-variant leading-none mt-0.5">{act.desc}</p>
                    </div>
                  </div>

                  <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                    isChecked ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant bg-surface-container'
                  }`}>
                    {isChecked && <Check size={12} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Done Button */}
          <div className="pt-2">
            <button
              onClick={() => setActiveCell(null)}
              className="w-full py-2 bg-primary text-on-primary font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_12px_rgba(0,218,243,0.25)] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check size={13} />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}

      {/* Legend & Guide Footer */}
      <div className="pt-4 border-t border-outline-variant/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-on-surface-variant">
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <span className="font-bold uppercase tracking-wider text-[9px]">Legend:</span>
          {PRESETS.map(p => (
            <span key={p.id} className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${p.color}`}>
              {p.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-on-surface-variant/80">
          Super Admin is locked to Full Access for security.
        </p>
      </div>
    </Card>
  );
}
