import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Phone, MessageSquare, RefreshCw, Send, CheckCircle, Search, Clock, Play } from 'lucide-react';
import apiService from '../services/api';

const CitizenReport = () => {
  // Form States
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  
  // Status & UI States
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle, uploading, success, error
  const [submitProgress, setSubmitProgress] = useState('');
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccessDetails, setShowSuccessDetails] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [bypassAI, setBypassAI] = useState(false);

  // Lookup States
  const [searchPhone, setSearchPhone] = useState('');
  const [userComplaints, setUserComplaints] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('report'); // report, lookup

  // Map Picker Reference
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Initialize browser GPS on component mount
  useEffect(() => {
    detectLocation(true); // silent detection
  }, []);

  // Update/Initialize Leaflet Map Picker when coords change
  useEffect(() => {
    if (activeSubTab !== 'report' || !latitude || !longitude || !window.L) return;

    if (!mapInstanceRef.current && mapContainerRef.current) {
      mapInstanceRef.current = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([latitude, longitude], 15);

      const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
      const useMapbox = mapboxToken.trim().startsWith('pk.');
      
      const tileUrl = useMapbox
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}{r}?access_token=${mapboxToken}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        
      const tileOptions = useMapbox
        ? {
            maxZoom: 18,
            tileSize: 512,
            zoomOffset: -1,
            attribution: '&copy; Mapbox &copy; OpenStreetMap'
          }
        : {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap &copy; CARTO'
          };

      window.L.tileLayer(tileUrl, tileOptions).addTo(mapInstanceRef.current);

      const customIcon = window.L.divIcon({
        className: 'custom-picker-icon-svg',
        html: `
          <svg class="w-8 h-8 text-rose-500 drop-shadow-[0_4px_6px_rgba(244,63,94,0.45)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      markerRef.current = window.L.marker([latitude, longitude], {
        icon: customIcon,
        draggable: true
      }).addTo(mapInstanceRef.current);

      // Map drag updates coords
      markerRef.current.on('dragend', (e) => {
        const position = markerRef.current.getLatLng();
        setLatitude(position.lat.toFixed(6));
        setLongitude(position.lng.toFixed(6));
      });

      mapInstanceRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        markerRef.current.setLatLng(e.latlng);
      });
    } else if (mapInstanceRef.current && markerRef.current) {
      const newPos = [parseFloat(latitude), parseFloat(longitude)];
      mapInstanceRef.current.setView(newPos, 15);
      markerRef.current.setLatLng(newPos);
    }
  }, [latitude, longitude, activeSubTab]);

  // Geolocation trigger
  const detectLocation = (silent = false) => {
    if (!silent) setIsDetectingLocation(true);
    
    if (!navigator.geolocation) {
      if (!silent) alert('Geolocation is not supported by your browser.');
      setIsDetectingLocation(false);
      // Default to Hyderabad central
      setLatitude('17.385044');
      setLongitude('78.486671');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsDetectingLocation(false);
      },
      (error) => {
        console.warn('Geolocation access denied. Using fallback center coordinates.', error);
        setLatitude('17.385044');
        setLongitude('78.486671');
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Image Selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setImageFile(file);
    setAnalysisData(null);
    setAnalysisCompleted(false);
    setAnalysisError('');
    setBypassAI(false);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Submit Complaint
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      alert('Please snap or upload a waste image first.');
      return;
    }
    if (!latitude || !longitude) {
      alert('GPS location coordinates are required.');
      return;
    }
    // Normalize and validate phone: allow optional + and digits (7-15 digits)
    const normalizedPhone = (phone || '').toString().replace(/\s+/g, '');
    if (!normalizedPhone || !/^\+?\d{7,15}$/.test(normalizedPhone)) {
      alert('Please enter a valid reporter phone number (digits only, optional leading +).');
      return;
    }

    setSubmitStatus('uploading');
    setSubmitProgress('Uploading report photo to cloud storage...');
    setErrorMsg('');

    try {
      // Simulate progress updates for premium UX
      setTimeout(() => setSubmitProgress('Sending payload to Gemini Vision AI for analysis...'), 1200);
      setTimeout(() => setSubmitProgress('Saving classified records to Firestore Database...'), 2800);

      const result = await apiService.submitComplaint(
        imageFile,
        parseFloat(latitude),
        parseFloat(longitude),
        phone,
        notes
      );

      setTimeout(() => {
        setResultData(result);
        setSubmitStatus('success');
        resetForm();
      }, 3500);

    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to submit report. Ensure backend is running.');
      setSubmitStatus('error');
    }
  };

  const resetForm = () => {
    setImageFile(null);
    setImagePreview('');
    setNotes('');
    setShowSuccessDetails(false);
    setAnalysisData(null);
    setAnalysisCompleted(false);
    setAnalysisError('');
    setBypassAI(false);
    detectLocation(true); // reset coordinates
  };

  const handleAnalyzeImage = async () => {
    if (!imageFile) {
      alert('Please snap or upload a waste image first.');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError('');
    setAnalysisData(null);
    setAnalysisCompleted(false);

    try {
      const result = await apiService.analyzeImage(imageFile, latitude, longitude);
      setAnalysisData(result);
      setAnalysisCompleted(true);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalysisError(err.response?.data?.detail || 'Failed to analyze image. Ensure backend is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Search User complaints
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!searchPhone) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Get all complaints, then filter by phone
      const data = await apiService.getComplaints({ phone: searchPhone });
      // Since complaints API filters by phone number or provides all, let's safeguard filtering
      const filtered = data.filter(c => c.reporterPhone && c.reporterPhone.replace(/\s+/g, '') === searchPhone.replace(/\s+/g, ''));
      setUserComplaints(filtered);
    } catch (err) {
      console.error('Error loading complaints: ', err);
      alert('Could not retrieve complaints database.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 mb-8 max-w-sm mx-auto bg-dark-900 p-1 rounded-xl">
        <button
          onClick={() => setActiveSubTab('report')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'report'
              ? 'bg-brand-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-4 h-4 inline mr-1.5" />
          Report Waste
        </button>
        <button
          onClick={() => setActiveSubTab('lookup')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'lookup'
              ? 'bg-brand-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Search className="w-4 h-4 inline mr-1.5" />
          Track Status
        </button>
      </div>

      {activeSubTab === 'report' ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Form Side */}
          <div className="md:col-span-7 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2 font-sans">Report Garbage Accrual</h2>
            <p className="text-xs text-slate-400 mb-6">Upload a photo. Gemini AI will instantly identify waste type and severity.</p>

            {submitStatus === 'uploading' ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <RefreshCw className="w-10 h-10 text-brand-500 animate-spin mb-4" />
                <h4 className="text-sm font-semibold text-slate-200">Processing Submission</h4>
                <p className="text-xs text-slate-400 mt-2 text-center max-w-[280px] leading-relaxed">{submitProgress}</p>
              </div>
            ) : submitStatus === 'success' ? (
              <div className="py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-white">Report Logged Successfully!</h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">ID: <code className="text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">{resultData?.id}</code></p>
                
                {/* View Details Button */}
                <button
                  type="button"
                  onClick={() => setShowSuccessDetails(!showSuccessDetails)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-800 hover:border-brand-500/30 bg-slate-950/40 hover:bg-slate-950/60 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all duration-200 cursor-pointer mb-2"
                >
                  <span>{showSuccessDetails ? 'Hide Garbage Details' : 'View Garbage Details'}</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${showSuccessDetails ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Collapsible Details Panel */}
                {showSuccessDetails && resultData && (
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 text-left space-y-4 animate-fadeIn transition-all duration-350">
                    {/* Thumbnail & Classification */}
                    <div className="flex gap-4 items-center border-b border-slate-800/60 pb-3">
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="Submitted waste"
                          className="w-14 h-14 object-cover rounded-lg border border-slate-800"
                        />
                      )}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Classification</span>
                        <h5 className="text-sm font-bold text-white leading-tight">{resultData.wasteType}</h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">Status: <strong className="text-amber-400 font-semibold">{resultData.status}</strong></p>
                      </div>
                    </div>

                    {/* AI Diagnostics details */}
                    {resultData.aiAnalysis && (
                      <div className="space-y-1.5 border-b border-slate-800/60 pb-3">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Waste Analysis</span>
                        <p className="text-xs text-slate-300 italic">"{resultData.aiAnalysis.description}"</p>
                        <div className="flex gap-4 text-[11px] text-slate-400 mt-1">
                          <div>Severity: <strong className="text-amber-400">{resultData.aiAnalysis.severity}</strong></div>
                          <div>Confidence: <strong className="text-slate-200">{Math.round(resultData.aiAnalysis.confidence * 100)}%</strong></div>
                          <div>Is Garbage: <strong className={resultData.aiAnalysis.is_waste ? 'text-rose-400' : 'text-emerald-400'}>{resultData.aiAnalysis.is_waste ? 'Yes' : 'No'}</strong></div>
                        </div>
                      </div>
                    )}

                    {/* Location detail */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Location Details</span>
                      <p className="text-xs text-slate-300 leading-normal">{resultData.address}</p>
                      <p className="text-[10px] text-slate-500">Coordinates: {resultData.location?.latitude.toFixed(6)}, {resultData.location?.longitude.toFixed(6)}</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSubmitStatus('idle')}
                  className="mt-4 w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition cursor-pointer"
                >
                  Report Another Incident
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Image Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Snap or Upload Image</label>
                  {imagePreview ? (
                    <div className="space-y-3">
                      <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                        <img src={imagePreview} alt="Waste preview" className="object-contain w-full h-full max-h-[220px]" />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview('');
                            setAnalysisData(null);
                            setAnalysisCompleted(false);
                            setAnalysisError('');
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition text-xs cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Pre-submission AI analysis toggle/action */}
                      <div className="space-y-3">
                        {!analysisCompleted && !isAnalyzing && (
                          <button
                            type="button"
                            onClick={handleAnalyzeImage}
                            className="w-full flex items-center justify-center py-2.5 px-4 bg-brand-500 hover:bg-brand-600 border border-brand-600 rounded-xl text-xs font-bold text-white transition shadow-md shadow-brand-500/10 cursor-pointer"
                          >
                            Detect Garbage & View Details
                          </button>
                        )}

                        {isAnalyzing && (
                          <div className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-slate-800 bg-slate-950/40 rounded-xl text-xs text-slate-400 animate-pulse">
                            <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                            <span>Analyzing image with local YOLO model...</span>
                          </div>
                        )}

                        {analysisCompleted && analysisData && (
                          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-4 animate-fadeIn">
                            {/* AI Diagnostics details */}
                            {analysisData.aiAnalysis && (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Waste Analysis</span>
                                  <span className="text-xs font-bold text-brand-400 px-2.5 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
                                    {analysisData.wasteType}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300 italic">"{analysisData.aiAnalysis.description}"</p>
                                <div className="flex gap-4 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                                  <div>Severity: <strong className="text-amber-400">{analysisData.aiAnalysis.severity}</strong></div>
                                  <div>Confidence: <strong className="text-slate-200">{Math.round(analysisData.aiAnalysis.confidence * 100)}%</strong></div>
                                  <div>Is Garbage: <strong className={analysisData.aiAnalysis.is_waste ? 'text-rose-400' : 'text-emerald-400'}>{analysisData.aiAnalysis.is_waste ? 'Yes' : 'No'}</strong></div>
                                </div>
                              </div>
                            )}

                            {/* Blocking banners */}
                            {analysisData.is_duplicate ? (
                              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-medium flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1 animate-ping" />
                                <span>⚠ Duplicate complaint detected. A similar report (ID: <code className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">{analysisData.duplicate_id}</code>) is already active in this area.</span>
                              </div>
                            ) : bypassAI ? (
                              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-lg font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-ping" />
                                <span>AI bypass activated. Submission unlocked.</span>
                              </div>
                            ) : analysisData.aiAnalysis?.is_waste ? (
                              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span>Garbage detected! Submission unlocked.</span>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-medium flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1 animate-ping" />
                                  <span>{analysisData.aiAnalysis?.description || 'No garbage detected in this image. Submission is disabled.'}</span>
                                </div>
                                {analysisData.show_bypass && (
                                  <button
                                    type="button"
                                    onClick={() => setBypassAI(true)}
                                    className="text-left text-[11px] text-brand-400 hover:text-brand-300 font-semibold underline mt-1 cursor-pointer"
                                  >
                                    AI made a mistake? Click here to report anyway
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {analysisError && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                            {analysisError}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-brand-500/50 rounded-xl p-8 cursor-pointer bg-slate-950/40 hover:bg-slate-950/60 transition group aspect-video">
                      <Camera className="w-8 h-8 text-slate-500 group-hover:text-brand-500 transition mb-2" />
                      <span className="text-xs font-semibold text-slate-300">Tap to Camera / Browse File</span>
                      <span className="text-[10px] text-slate-500 mt-1">Accepts JPG, PNG, WEBP files</span>
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                  )}
                </div>

                {/* Coordinates Picker */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Latitude</label>
                    <input
                      type="text"
                      readOnly
                      value={latitude}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-none"
                      placeholder="Latitude coordinate"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Longitude</label>
                    <input
                      type="text"
                      readOnly
                      value={longitude}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-xs focus:outline-none"
                      placeholder="Longitude coordinate"
                    />
                  </div>
                </div>

                {/* Location Detection Buttons */}
                <button
                  type="button"
                  onClick={() => detectLocation()}
                  disabled={isDetectingLocation}
                  className="w-full flex items-center justify-center py-2.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 transition"
                >
                  <MapPin className={`w-4 h-4 mr-2 ${isDetectingLocation ? 'animate-bounce text-brand-500' : 'text-slate-400'}`} />
                  {isDetectingLocation ? 'Pinging GPS Satellite...' : 'Detect Coordinates (GPS)'}
                </button>

                {/* Phone input */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Reporter Phone <span className="text-rose-500 font-extrabold">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="\+?[0-9\s()-]{7,20}"
                      maxLength={20}
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s()-]/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-lg text-xs focus:outline-none focus:border-brand-500"
                      placeholder="e.g. +91 9876543210 (required to track status)"
                    />
                  </div>
                </div>

                {/* Reporter notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Notes / Comments (Optional)</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows="2"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-lg text-xs focus:outline-none focus:border-brand-500 resize-none"
                      placeholder="e.g. Garbage accumulation has been increasing since Tuesday..."
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                    {errorMsg}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!analysisCompleted || (!analysisData?.aiAnalysis?.is_waste && !bypassAI) || analysisData?.is_duplicate}
                  className={`w-full flex items-center justify-center py-3 font-bold text-xs text-white rounded-lg transition-all duration-200 ${
                    (analysisCompleted && (analysisData?.aiAnalysis?.is_waste || bypassAI) && !analysisData?.is_duplicate)
                      ? 'bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/10 cursor-pointer'
                      : 'bg-slate-800/80 text-slate-500 border border-slate-800/65 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Report to GHMC
                </button>
              </form>
            )}
          </div>

          {/* Mini Interactive map selection side */}
          <div className="md:col-span-5 flex flex-col h-full self-stretch">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col h-full">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Map Location Fine-Tune</span>
              <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">If GPS detects coordinates with variance, drag the marker or click on the map to set the exact waste location.</p>
              <div className="flex-1 min-h-[300px] md:h-[400px] relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Status lookup Side */
        <div className="max-w-2xl mx-auto bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2">Track Submitted Reports</h2>
          <p className="text-xs text-slate-400 mb-6">Enter the reporter phone number submitted during reporting to track active resolution statuses.</p>

          <form onSubmit={handleLookup} className="flex gap-2 mb-8">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="number"
                required
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-lg text-xs focus:outline-none focus:border-brand-500"
                placeholder="e.g. +919876543210"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-xs font-bold text-white rounded-lg transition flex items-center justify-center cursor-pointer"
            >
              {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </form>

          {/* Results List */}
          <div className="space-y-4">
            {isSearching ? (
              <div className="text-center py-12">
                <RefreshCw className="w-6 h-6 text-brand-500 animate-spin mx-auto mb-2" />
                <span className="text-xs text-slate-400">Loading databases...</span>
              </div>
            ) : userComplaints.length > 0 ? (
              userComplaints.map((complaint) => {
                const statusColorMap = {
                  'Pending': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                  'In Progress': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                  'Resolved': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                };
                const statusStyle = statusColorMap[complaint.status] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';

                return (
                  <div key={complaint.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex gap-3 items-center">
                      <img 
                        src={apiService.getImageUrl(complaint.imageUrl)} 
                        alt={complaint.wasteType} 
                        className="w-14 h-14 object-cover rounded-lg border border-slate-800"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{complaint.wasteType}</h4>
                          <span className="text-[10px] text-slate-500">ID: {complaint.id}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal mt-0.5 line-clamp-1">{complaint.address}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Reported: {new Date(complaint.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyle}`}>
                        {complaint.status}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : hasSearched ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No reports found matching phone: <strong className="text-slate-300">{searchPhone}</strong>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                Search reports to view their real-time resolution status.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenReport;
