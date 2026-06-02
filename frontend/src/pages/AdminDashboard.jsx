import React, { useState, useEffect } from 'react';
import { RefreshCw, Filter, Trash2, CheckCircle2, Play, AlertCircle, Calendar, Phone, MessageSquare, MapPin, Shield } from 'lucide-react';
import apiService from '../services/api';
import StatsCard from '../components/StatsCard';
import MapViewer from '../components/MapViewer';
import { supabase } from '../services/supabaseClient';

const AdminDashboard = () => {
  // Auth States
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Data States
  const [complaints, setComplaints] = useState([]);
  const [analytics, setAnalytics] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0, types: {}, severity: {} });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  
  // Filter States
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState('map'); // 'map' or 'list' on mobile

  // Monitor Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load dashboard data on mount or filter change, only if session is active
  useEffect(() => {
    if (session) {
      loadDashboardData();
    }
  }, [filterStatus, filterType, session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setAuthError(error.message);
      }
    } catch (err) {
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const filters = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterType) filters.waste_type = filterType;

      const [complaintsData, analyticsData] = await Promise.all([
        apiService.getComplaints(filters),
        apiService.getAnalyticsSummary()
      ]);

      const safeComplaints = Array.isArray(complaintsData) ? complaintsData : [];
      const safeAnalytics = (analyticsData && typeof analyticsData === 'object' && !Array.isArray(analyticsData))
        ? analyticsData
        : { total: 0, pending: 0, in_progress: 0, resolved: 0, types: {}, severity: {} };

      setComplaints(safeComplaints);
      setAnalytics(safeAnalytics);
      
      // Keep selected complaint references updated if it still exists in the dataset
      if (selectedComplaint) {
        const updatedSelected = safeComplaints.find(c => c.id === selectedComplaint.id);
        if (updatedSelected) {
          setSelectedComplaint(updatedSelected);
        } else {
          setSelectedComplaint(null);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Update Status Action
  const handleUpdateStatus = async (id, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      const updated = await apiService.updateComplaintStatus(id, newStatus);
      // Reload lists and updates active panels
      await loadDashboardData();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Could not update status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Delete Complaint Action
  const handleDeleteComplaint = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this report?')) return;
    
    setIsDeleting(true);
    try {
      await apiService.deleteComplaint(id);
      setSelectedComplaint(null);
      await loadDashboardData();
    } catch (err) {
      console.error('Error deleting complaint:', err);
      alert('Failed to delete complaint.');
    } finally {
      setIsDeleting(false);
    }
  };

  // List of waste categories for filters
  const wasteCategories = [
    'Overflowing Garbage Bin',
    'Illegal Dumping',
    'Plastic Waste',
    'Construction Waste',
    'E-Waste',
    'Other'
  ];

  if (!session) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 p-6 sm:p-8 rounded-2xl backdrop-blur-md shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-500/5">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">GHMC Command Center</h2>
            <p className="text-xs text-slate-400 mt-1">Restricted Access - Authorized Personnel Only</p>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. officer@ghmc.gov.in"
                autoComplete="username"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2.5 rounded-lg text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2.5 rounded-lg text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 disabled:cursor-not-allowed font-bold text-xs text-white rounded-lg transition shadow-lg shadow-brand-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                'Access Control Panel'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight leading-none mb-1">GHMC Command Center</h1>
          <p className="text-xs text-slate-400">Hyderabad Waste Management Control and AI Hotspot Monitoring System.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-500' : ''}`} />
            Refresh Database
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 hover:border-transparent text-rose-400 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <StatsCard summary={analytics} />

      {/* Control bar / Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 p-4 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-400">Filters:</span>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">All Waste Types</option>
            {wasteCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {(filterStatus || filterType) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterType(''); }}
              className="text-xs font-semibold text-brand-400 hover:text-brand-500 underline underline-offset-4 cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Mobile view selector */}
      <div className="lg:hidden flex border border-slate-800 bg-slate-950/80 p-1 rounded-xl mb-4 max-w-sm mx-auto w-full">
        <button
          onClick={() => setActiveAdminTab('map')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
            activeAdminTab === 'map'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Map View
        </button>
        <button
          onClick={() => setActiveAdminTab('list')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
            activeAdminTab === 'list'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {selectedComplaint ? 'Incident Detail' : 'Incidents List'}
        </button>
      </div>

      {/* Dual Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Map Panel */}
        <div className={`lg:col-span-7 h-[500px] lg:h-[620px] flex flex-col ${activeAdminTab === 'map' ? 'flex' : 'hidden lg:flex'}`}>
          <MapViewer
            complaints={complaints}
            selectedComplaint={selectedComplaint}
            onSelectComplaint={(complaint) => {
              setSelectedComplaint(complaint);
              setActiveAdminTab('list');
            }}
          />
        </div>

        {/* Complaints Directory / Details Section */}
        <div className={`lg:col-span-5 flex flex-col h-[500px] lg:h-[620px] self-stretch gap-4 ${activeAdminTab === 'list' ? 'flex' : 'hidden lg:flex'}`}>
          {selectedComplaint ? (
            /* Detailed view of selected complaint */
            <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-2xl flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <span className="text-[10px] uppercase font-bold text-slate-400">Incident Details</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveAdminTab('map')}
                    className="lg:hidden text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    View on Map
                  </button>
                  <button
                    onClick={() => setSelectedComplaint(null)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Close Detail
                  </button>
                </div>
              </div>

              {/* Snapshot image */}
              <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-950 border border-slate-800 mb-4 flex items-center justify-center">
                <img
                  src={apiService.getImageUrl(selectedComplaint.imageUrl)}
                  alt={selectedComplaint.wasteType}
                  className="object-cover w-full h-full"
                />
                
                {/* Status tag */}
                <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                  selectedComplaint.status === 'Pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  selectedComplaint.status === 'In Progress' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {selectedComplaint.status}
                </span>
              </div>

              {/* Waste summary details */}
              <div className="space-y-4 flex-1">
                <div>
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white leading-tight">{selectedComplaint.wasteType}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      selectedComplaint.aiAnalysis?.severity === 'High' ? 'text-red-400 bg-red-500/10' :
                      selectedComplaint.aiAnalysis?.severity === 'Medium' ? 'text-amber-400 bg-amber-500/10' :
                      'text-emerald-400 bg-emerald-500/10'
                    }`}>
                      {selectedComplaint.aiAnalysis?.severity} Severity
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">ID: <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">{selectedComplaint.id}</code></p>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Gemini AI Analysis Description</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium italic">"{selectedComplaint.aiAnalysis?.description || 'N/A'}"</p>
                  <p className="text-[10px] text-slate-500 mt-2">AI Confidence Match: {Math.round((selectedComplaint.aiAnalysis?.confidence || 0.85) * 100)}%</p>
                </div>

                {/* Metadata details */}
                <div className="grid grid-cols-1 gap-2.5 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>{selectedComplaint.address}</span>
                  </div>
                  {selectedComplaint.reporterPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{selectedComplaint.reporterPhone}</span>
                    </div>
                  )}
                  {selectedComplaint.reporterNotes && (
                    <div className="flex items-start gap-2">
                      <MessageSquare className="absolute w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="pl-6 text-slate-400 font-sans leading-relaxed">
                        <strong className="text-slate-300 block text-[10px] uppercase font-bold mb-0.5">Reporter Notes:</strong>
                        "{selectedComplaint.reporterNotes}"
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Reported: {new Date(selectedComplaint.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Panel */}
              <div className="border-t border-slate-800/80 pt-4 mt-4 grid grid-cols-3 gap-2">
                <button
                  disabled={isUpdatingStatus || selectedComplaint.status === 'In Progress'}
                  onClick={() => handleUpdateStatus(selectedComplaint.id, 'In Progress')}
                  className="py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-slate-800 disabled:opacity-40 font-bold text-xs text-white transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  In Progress
                </button>
                
                <button
                  disabled={isUpdatingStatus || selectedComplaint.status === 'Resolved'}
                  onClick={() => handleUpdateStatus(selectedComplaint.id, 'Resolved')}
                  className="py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:opacity-40 font-bold text-xs text-white transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Resolve
                </button>

                <button
                  disabled={isDeleting}
                  onClick={() => handleDeleteComplaint(selectedComplaint.id)}
                  className="py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-transparent font-bold text-xs text-red-400 hover:text-white transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Case
                </button>
              </div>
            </div>
          ) : (
            /* Directory List panel */
            <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reports Directory ({complaints.length})</span>
                <span className="text-[10px] text-slate-500">Click card to inspect</span>
              </div>

              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-brand-500 animate-spin mb-2" />
                  <span className="text-xs text-slate-400">Loading cases directory...</span>
                </div>
              ) : complaints.length > 0 ? (
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {complaints.map(complaint => {
                    const statusColors = {
                      'Pending': 'border-amber-500/20 bg-amber-500/5 text-amber-400',
                      'In Progress': 'border-sky-500/20 bg-sky-500/5 text-sky-400',
                      'Resolved': 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                    };
                    const statusClass = statusColors[complaint.status] || 'border-slate-800 bg-slate-900 text-slate-400';

                    return (
                      <div
                        key={complaint.id}
                        onClick={() => setSelectedComplaint(complaint)}
                        className="p-3 bg-slate-950/40 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-3 transition cursor-pointer hover:bg-slate-950"
                      >
                        <img
                          src={apiService.getImageUrl(complaint.imageUrl)}
                          alt={complaint.wasteType}
                          className="w-11 h-11 object-cover rounded-lg border border-slate-800 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-200 truncate">{complaint.wasteType}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${statusClass}`}>
                              {complaint.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate block mt-0.5">{complaint.address}</span>
                          <span className="text-[9px] text-slate-500 block mt-1">{new Date(complaint.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
                  No reports logged matching the active filters.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
