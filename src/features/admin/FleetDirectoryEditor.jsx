import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '@/services/firebase';
import { toast } from '@/shared/utils/toast';
import { useFleetDirectory } from '@/features/logistics/useFleetDirectory';

const inputClass = 'w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs font-semibold text-on-surface';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function FleetDirectoryEditor() {
  const stored = useFleetDirectory();
  const [vehicles, setVehicles] = useState(stored.vehicles);
  const [drivers, setDrivers] = useState(stored.drivers);
  const [saving, setSaving] = useState(false);
  const edited = useRef(false);

  useEffect(() => {
    if (edited.current) return;
    setVehicles(stored.vehicles);
    setDrivers(stored.drivers);
  }, [stored]);

  const change = (setter) => (index, field, value) => {
    edited.current = true;
    setter((list) => list.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };
  const remove = (setter) => (index) => {
    edited.current = true;
    setter((list) => list.filter((_, i) => i !== index));
  };
  const add = (setter, blank) => () => {
    edited.current = true;
    setter((list) => [...list, blank]);
  };

  const save = async () => {
    const cleanVehicles = vehicles.filter((v) => v.name?.trim()).map((v) => ({ ...v, id: v.id || slug(v.name) }));
    const cleanDrivers = drivers.filter((d) => d.name?.trim());
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'fleet'), { vehicles: cleanVehicles, drivers: cleanDrivers });
      edited.current = false;
      toast.success('Fleet and driver directory saved');
    } catch {
      toast.error('Could not save the fleet directory');
    } finally {
      setSaving(false);
    }
  };

  const changeVehicle = change(setVehicles);
  const changeDriver = change(setDrivers);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-on-surface">Vehicles</h3>
        {vehicles.map((v, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr_auto] gap-2">
            <input className={inputClass} placeholder="Vehicle name" value={v.name || ''} onChange={(e) => changeVehicle(i, 'name', e.target.value)} />
            <input className={inputClass} placeholder="Type" value={v.type || ''} onChange={(e) => changeVehicle(i, 'type', e.target.value)} />
            <input className={inputClass} placeholder="Capacity" value={v.capacity || ''} onChange={(e) => changeVehicle(i, 'capacity', e.target.value)} />
            <button type="button" aria-label="Remove vehicle" onClick={() => remove(setVehicles)(i)} className="p-2 text-error cursor-pointer"><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" onClick={add(setVehicles, { id: '', name: '', type: '', capacity: '' })} className="flex items-center gap-1.5 text-xs font-bold text-primary cursor-pointer">
          <Plus size={14} /> Add vehicle
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-on-surface">Drivers</h3>
        {drivers.map((d, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr_auto] gap-2">
            <input className={inputClass} placeholder="Driver name" value={d.name || ''} onChange={(e) => changeDriver(i, 'name', e.target.value)} />
            <input className={inputClass} placeholder="Phone" value={d.phone || ''} onChange={(e) => changeDriver(i, 'phone', e.target.value)} />
            <input className={inputClass} placeholder="Role" value={d.role || ''} onChange={(e) => changeDriver(i, 'role', e.target.value)} />
            <button type="button" aria-label="Remove driver" onClick={() => remove(setDrivers)(i)} className="p-2 text-error cursor-pointer"><Trash2 size={16} /></button>
          </div>
        ))}
        <button type="button" onClick={add(setDrivers, { name: '', phone: '', role: '' })} className="flex items-center gap-1.5 text-xs font-bold text-primary cursor-pointer">
          <Plus size={14} /> Add driver
        </button>
      </section>

      <button type="button" onClick={save} disabled={saving} className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer">
        Save fleet
      </button>
    </div>
  );
}
