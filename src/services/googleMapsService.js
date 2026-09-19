/**
 * Google Maps & Places Service for Print-To-Frame ERP
 */

let mapsLoaded = false;
let mapsLoading = false;
let loadPromise = null;

export const loadGoogleMapsScript = (apiKey = '') => {
  if (mapsLoaded && window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (mapsLoading && loadPromise) {
    return loadPromise;
  }

  mapsLoading = true;
  loadPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      mapsLoaded = true;
      mapsLoading = false;
      resolve(window.google.maps);
      return;
    }

    const key = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      mapsLoaded = true;
      mapsLoading = false;
      resolve(window.google.maps);
    };
    script.onerror = (err) => {
      mapsLoading = false;
      console.warn('Google Maps script failed to load, falling back to simulated picker.', err);
      // Resolve anyway to let interactive simulation take over if needed
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
};

export const geocodeAddress = async (address) => {
  try {
    const maps = await loadGoogleMapsScript();
    if (!maps || !maps.Geocoder) {
      return { lat: 6.9271, lng: 79.8612, formattedAddress: address }; // Default Colombo Sri Lanka
    }
    const geocoder = new maps.Geocoder();
    return new Promise((resolve) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          resolve({
            lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
            lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
            formattedAddress: results[0].formatted_address,
          });
        } else {
          resolve({ lat: 6.9271, lng: 79.8612, formattedAddress: address });
        }
      });
    });
  } catch {
    return { lat: 6.9271, lng: 79.8612, formattedAddress: address };
  }
};
