// Pin verified against the owner's KINGS CAFE Google Maps listing, 18 Nov 2026.
export const KINGS = { lat: -27.9539, lng: 153.4075448 };
export const ADDRESS = '10A Frank Street, Labrador QLD 4215';
export const OVERVIEW = { north: -27.935, south: -28.009, east: 153.439, west: 153.383 };
export const MAP_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const EMBED = 'https://maps.google.com/maps?q=KINGS+CAFE+10A+Frank+Street+Labrador+QLD+4215&z=13&output=embed';
let loading;
export function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (!MAP_KEY) return Promise.reject(new Error('Map connection is not configured.'));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => fail(), 18000);
    function fail() { clearTimeout(timeout); loading = null; script.remove(); delete window.kingsMapsReady; reject(new Error('The map could not connect.')); }
    window.kingsMapsReady = () => { clearTimeout(timeout); delete window.kingsMapsReady; resolve(window.google.maps); };
    script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({key: MAP_KEY, v: 'weekly', loading: 'async', callback: 'kingsMapsReady', language: 'en', region: 'AU'});
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
export const mapStyles = [
  {elementType:'geometry',stylers:[{color:'#262c28'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#262c28'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#c9c9bb'}]},
  {featureType:'poi',stylers:[{visibility:'off'}]},
  {featureType:'transit',stylers:[{visibility:'off'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#454c43'}]},
  {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#75725a'}]},
  {featureType:'road',elementType:'labels.text.fill',stylers:[{color:'#e3dfd1'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#172a30'}]},
  {featureType:'water',elementType:'labels.text.fill',stylers:[{color:'#95b8ba'}]},
  {featureType:'landscape.natural',elementType:'geometry',stylers:[{color:'#303b30'}]}
];
export function addPin(maps, map, position, name, destination = false) {
  class LabelPin extends maps.OverlayView {
    onAdd() { this.node = document.createElement('div'); this.node.className = 'k-map-pin' + (destination ? ' k-map-pin-destination' : ''); this.node.textContent = name; this.node.setAttribute('role','img'); this.node.setAttribute('aria-label',name); this.getPanes().floatPane.appendChild(this.node); }
    draw() { const p = this.getProjection().fromLatLngToDivPixel(new maps.LatLng(position)); if (p && this.node) { this.node.style.left = p.x+'px'; this.node.style.top = p.y+'px'; } }
    onRemove() { this.node?.remove(); }
  }
  const marker = new LabelPin(); marker.setMap(map); return marker;
}
export function routeSummary(route) {
  if (!route?.path?.length || !Number.isFinite(route.distanceMeters) || !Number.isFinite(route.durationMillis) || route.distanceMeters < 0 || route.durationMillis < 0) throw new Error('No driving route was returned.');
  const minutes = Math.max(1, Math.ceil(route.durationMillis / 60000));
  return { duration: minutes < 60 ? `${minutes} min` : `${Math.floor(minutes/60)} hr${minutes%60 ? ` ${minutes%60} min` : ''}`, distance: route.distanceMeters < 1000 ? `${Math.round(route.distanceMeters)} m` : `${(route.distanceMeters/1000).toFixed(1)} km` };
}
export function navigationLink(origin) {
  const params = new URLSearchParams({api:'1',destination:'KINGS CAFE, '+ADDRESS,travelmode:'driving'});
  if (origin) params.set('origin', typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`);
  return 'https://www.google.com/maps/dir/?'+params;
}
