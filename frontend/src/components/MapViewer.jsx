import React, { useEffect, useRef } from 'react';

const MapViewer = ({ complaints = [], selectedComplaint = null, onSelectComplaint = null }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  // Initialize Map
  useEffect(() => {
    if (!window.L) {
      console.error("Leaflet (L) is not loaded on the window object. Please verify the CDN in index.html.");
      return;
    }

    if (!mapInstanceRef.current && mapContainerRef.current) {
      // Coordinates centered on Hyderabad
      const hyderabadCenter = [17.385044,78.486671];
      const initialZoom = 12;

      // Create Leaflet map instance
      mapInstanceRef.current = window.L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView(hyderabadCenter, initialZoom);

      // Add Mapbox Streets tile layer if a public token is available; fallback to open Voyager tiles
      const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
      const useMapbox = mapboxToken.trim().startsWith('pk.');
      
      const tileUrl = useMapbox
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}{r}?access_token=${mapboxToken}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        
      const tileOptions = useMapbox
        ? {
            maxZoom: 20,
            tileSize: 512,
            zoomOffset: -1,
            attribution: '&copy; Mapbox &copy; OpenStreetMap'
          }
        : {
            maxZoom: 20,
            attribution: '&copy; OpenStreetMap &copy; CARTO'
          };

      window.L.tileLayer(tileUrl, tileOptions).addTo(mapInstanceRef.current);
    }

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers when complaints list changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      map.removeLayer(marker);
    });
    markersRef.current = {};

    // Group complaints by rounded coordinates to detect exact/near overlaps
    const coordGroups = {};
    complaints.forEach(complaint => {
      const { location } = complaint;
      const { latitude, longitude } = location || {};
      if (latitude === undefined || longitude === undefined) return;
      
      const key = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      if (!coordGroups[key]) {
        coordGroups[key] = [];
      }
      coordGroups[key].push(complaint);
    });

    // Render new markers with layout adjustments for overlapping pins
    Object.keys(coordGroups).forEach(key => {
      const group = coordGroups[key];
      const count = group.length;

      group.forEach((complaint, index) => {
        const { id, location, wasteType, aiAnalysis, status } = complaint;
        const { latitude, longitude } = location || {};
        
        let finalLat = latitude;
        let finalLng = longitude;

        // If there are multiple complaints at the exact/near same coordinates,
        // spread them in a circle around the center point.
        if (count > 1) {
          const radius = 0.00018; // approx. 15-20 meters offset
          const angle = (2 * Math.PI * index) / count;
          finalLat = latitude + radius * Math.cos(angle);
          finalLng = longitude + radius * Math.sin(angle);
        }

        const severity = aiAnalysis?.severity || 'Medium';

        // Define color code class name by Category
        let pulseColorClass = 'pulse-other';
        if (wasteType === 'Overflowing Garbage Bin') pulseColorClass = 'pulse-overflowing';
        else if (wasteType === 'Illegal Dumping') pulseColorClass = 'pulse-dumping';
        else if (wasteType === 'Plastic Waste') pulseColorClass = 'pulse-plastic';
        else if (wasteType === 'Construction Waste') pulseColorClass = 'pulse-construction';
        else if (wasteType === 'E-Waste') pulseColorClass = 'pulse-ewaste';

        // Custom pulsing HTML marker
        const customIcon = window.L.divIcon({
          className: 'custom-leaflet-icon',
          html: `<div class="pulse-marker ${pulseColorClass}"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        // Create marker instance with final offset coordinates
        const marker = window.L.marker([finalLat, finalLng], { icon: customIcon });

        // Build Premium Popup Content
        const statusColorMap = {
          'Pending': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          'In Progress': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
          'Resolved': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        };
        
        const statusStyle = statusColorMap[status] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';

        const popupHtml = `
          <div class="p-2 font-sans max-w-[200px] text-slate-100">
            <div class="flex items-center justify-between mb-1 gap-2">
              <span class="text-xs font-semibold px-2 py-0.5 rounded border ${statusStyle}">${status}</span>
              <span class="text-[10px] uppercase font-bold text-slate-400">${severity} Severity</span>
            </div>
            <h4 class="text-sm font-bold text-white mb-0.5 truncate">${wasteType}</h4>
            <p class="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mb-2">${aiAnalysis?.description || ''}</p>
            <button 
              id="popup-btn-${id}" 
              class="w-full text-center py-1 rounded bg-brand-500 text-white font-semibold text-xs transition hover:bg-brand-600 block shadow-sm cursor-pointer"
            >
              View Details
            </button>
          </div>
        `;

        marker.bindPopup(popupHtml);

        // Add popup events
        marker.on('popupopen', () => {
          const btn = document.getElementById(`popup-btn-${id}`);
          if (btn && onSelectComplaint) {
            btn.onclick = (e) => {
              e.stopPropagation();
              onSelectComplaint(complaint);
            };
          }
        });

        marker.addTo(map);
        markersRef.current[id] = marker;
      });
    });

  }, [complaints, onSelectComplaint]);

  // Center Map on Selected Complaint when selected externally
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedComplaint || !window.L) return;

    const { id, location } = selectedComplaint;
    const { latitude, longitude } = location || {};
    if (latitude === undefined || longitude === undefined) return;

    // Pan map to marker location and zoom
    map.setView([latitude, longitude], 15, { animate: true, duration: 0.8 });

    // Open popup for that marker if it exists
    const targetMarker = markersRef.current[id];
    if (targetMarker) {
      targetMarker.openPopup();
    }
  }, [selectedComplaint]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" style={{ zIndex: 1 }} />
      
      {/* Tiny Map overlay key */}
      <div className="absolute bottom-4 left-4 z-[999] bg-dark-900/90 backdrop-blur-md px-3 py-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5 text-[10px] sm:text-xs text-slate-300 pointer-events-auto max-w-[210px] sm:max-w-none">
        <span className="font-semibold text-slate-200 mb-0.5 border-b border-slate-800 pb-1">Waste Categories</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
            <span className="truncate">Illegal Dumping</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="truncate">Overflowing Bin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
            <span className="truncate">Plastic Waste</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-400 shrink-0" />
            <span className="truncate">Construction</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shrink-0" />
            <span className="truncate">E-Waste</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">Other</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapViewer;
