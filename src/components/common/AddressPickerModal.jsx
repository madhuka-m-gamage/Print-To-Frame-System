import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Search, X, Check, Globe } from 'lucide-react';
import { loadGoogleMapsScript, geocodeAddress } from '../../services/googleMapsService';
import { ModalWrapper } from './ui';
import { toast } from '../../utils/toast';

export default function AddressPickerModal({ isOpen, onClose, onSelect, initialAddress = '' }) {
  const [addressInput, setAddressInput] = useState(initialAddress);
  const [selectedLocation, setSelectedLocation] = useState({
    address: initialAddress || 'Colombo, Sri Lanka',
    lat: 6.9271,
    lng: 79.8612
  });
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  // Guards against re-instantiating the Google map over the same node.
  const mapInitializedRef = useRef(false);
  // Read inside reverseGeocode without making it depend on addressInput,
  // which would otherwise re-create initMap on every keystroke.
  const addressInputRef = useRef(addressInput);

  useEffect(() => {
    addressInputRef.current = addressInput;
  }, [addressInput]);

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const maps = window.google?.maps;
      if (maps && maps.Geocoder) {
        const geocoder = new maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const addr = results[0].formatted_address;
            setAddressInput(addr);
            setSelectedLocation({ address: addr, lat, lng });
          } else {
            const addr = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            setAddressInput(addr);
            setSelectedLocation({ address: addr, lat, lng });
          }
        });
      } else {
        const addr = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        setAddressInput(addr);
        setSelectedLocation({ address: addr, lat, lng });
      }
    } catch {
      setSelectedLocation({ address: addressInputRef.current, lat, lng });
    }
  }, []);

  const initMap = useCallback(async () => {
    try {
      const maps = await loadGoogleMapsScript();
      if (!maps || !mapRef.current) return;

      const initialPos = { lat: 6.9271, lng: 79.8612 }; // Colombo default

      const map = new maps.Map(mapRef.current, {
        center: initialPos,
        zoom: 13,
        mapId: 'PRINT_TO_FRAME_ERP_MAP',
        disableDefaultUI: false,
      });

      mapInstanceRef.current = map;

      const marker = new maps.Marker({
        position: initialPos,
        map,
        draggable: true,
        title: 'Selected Delivery Location'
      });

      markerRef.current = marker;

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        const lat = pos.lat();
        const lng = pos.lng();
        reverseGeocode(lat, lng);
      });

      map.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        marker.setPosition({ lat, lng });
        reverseGeocode(lat, lng);
      });

    } catch (err) {
      console.warn('Map initialization error:', err);
    }
  }, [reverseGeocode]);

  useEffect(() => {
    if (isOpen) {
      setAddressInput(initialAddress);
      if (!mapInitializedRef.current) {
        mapInitializedRef.current = true;
        initMap();
      }
    } else {
      // Modal unmounts its content, so the next open needs a fresh map.
      mapInitializedRef.current = false;
    }
  }, [isOpen, initialAddress, initMap]);

  const handleSearch = async () => {
    if (!addressInput.trim()) return;
    setIsSearching(true);
    try {
      const result = await geocodeAddress(addressInput);
      setSelectedLocation(result);
      setAddressInput(result.formattedAddress);

      if (mapInstanceRef.current && markerRef.current && window.google?.maps) {
        const pos = { lat: result.lat, lng: result.lng };
        mapInstanceRef.current.setCenter(pos);
        markerRef.current.setPosition(pos);
      }
      toast.success('Location found on map');
    } catch (err) {
      toast.error('Could not locate address.');
    } finally {
      setIsSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      height="h-[95dvh] sm:h-[88vh] max-h-[860px]"
      ariaLabel="Google Maps Location Pinpoint Picker"
    >
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 flex-shrink-0">
            <MapPin size={20} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-on-surface">Delivery Location Pinpoint</h3>
            <p className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-0.5">
              Google Maps Interactive Geocoding
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-on-surface-variant hover:text-on-surface bg-surface-container-high rounded-full border border-outline-variant/60 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close delivery location picker"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 sm:p-4 bg-surface-container-low border-b border-outline-variant flex gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-on-surface-variant pointer-events-none" size={16} aria-hidden="true" />
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter delivery address, street, or city in Sri Lanka..."
            aria-label="Enter delivery address or city in Sri Lanka"
            className="w-full bg-surface-container border border-outline-variant/60 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching}
          aria-label={isSearching ? "Locating address..." : "Search address on map"}
          className="px-4 sm:px-5 py-2 bg-primary text-on-primary font-bold text-xs sm:text-sm rounded-xl hover:bg-primary/90 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span>{isSearching ? 'Locating...' : 'Search'}</span>
        </button>
      </div>

      {/* Map Container */}
      <div className="relative w-full flex-1 min-h-[260px] sm:min-h-[340px] bg-surface-container">
        <div ref={mapRef} className="w-full h-full" role="region" aria-label="Interactive Google Map" />
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-surface-container/90 backdrop-blur border border-outline-variant px-3 py-1.5 rounded-xl text-[11px] text-on-surface-variant flex items-center space-x-1.5 shadow-lg pointer-events-none">
          <Globe size={14} className="text-primary flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Drag pin or tap map to adjust coordinates</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 sm:px-6 py-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low flex-shrink-0">
        <div className="text-xs text-on-surface-variant truncate max-w-sm text-center sm:text-left" aria-live="polite">
          <span className="font-bold text-on-surface">Selected:</span> {selectedLocation.address}
        </div>
        <div className="flex space-x-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 border border-outline-variant/60 rounded-xl text-xs sm:text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect(selectedLocation);
              onClose();
            }}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-primary text-on-primary font-bold text-xs sm:text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Check size={14} aria-hidden="true" />
            <span>Confirm Location</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
