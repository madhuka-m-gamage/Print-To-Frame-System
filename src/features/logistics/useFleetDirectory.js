import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { FLEET_VEHICLES, DRIVER_DIRECTORY } from './logisticsEngine';

// settings/fleet is Admin-edited; a missing document, an unreadable one or a list that is
// not an array falls back to the built-in constants so dispatch keeps working.
export function useFleetDirectory() {
  const [fleet, setFleet] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'fleet'),
      (snap) => setFleet(snap.exists() ? snap.data() : null),
      () => setFleet(null)
    );
    return () => unsub();
  }, []);

  return useMemo(() => ({
    vehicles: Array.isArray(fleet?.vehicles) ? fleet.vehicles : FLEET_VEHICLES,
    drivers: Array.isArray(fleet?.drivers) ? fleet.drivers : DRIVER_DIRECTORY,
  }), [fleet]);
}
