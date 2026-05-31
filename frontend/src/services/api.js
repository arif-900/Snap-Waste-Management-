import axios from 'axios';

// Resolve the API base URL dynamically based on environment
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // If running locally on Vite dev server (e.g. port 5173), point to local FastAPI server
  if (typeof window !== 'undefined' && window.location.port !== '8000' && window.location.port !== '') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '[::1]') {
      return 'http://localhost:8000';
    }
  }
  // Otherwise, use relative path (works for both local unified server on 8000 and Vercel root-mounted server)
  return '';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  /**
   * Analyze an image for waste classification without saving it.
   * Uses multipart/form-data.
   */
  analyzeImage: async (imageFile, latitude, longitude) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);

    const response = await api.post('/complaints/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Submit a new waste complaint.
   * Uses multipart/form-data for image upload.
   */
  submitComplaint: async (imageFile, latitude, longitude, phone, notes) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    if (phone) formData.append('phone', phone);
    if (notes) formData.append('notes', notes);

    const response = await api.post('/complaints/report', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get all complaints with optional status or waste_type filters.
   */
  getComplaints: async (filters = {}) => {
    const response = await api.get('/complaints', { params: filters });
    return response.data;
  },

  /**
   * Get a specific complaint details by its ID.
   */
  getComplaintById: async (id) => {
    const response = await api.get(`/complaints/${id}`);
    return response.data;
  },

  /**
   * Update the status of a complaint (Pending, In Progress, Resolved).
   */
  updateComplaintStatus: async (id, status) => {
    const response = await api.patch(`/complaints/${id}/status`, { status });
    return response.data;
  },

  /**
   * Delete a complaint by its ID.
   */
  deleteComplaint: async (id) => {
    const response = await api.delete(`/complaints/${id}`);
    return response.data;
  },

  /**
   * Get analytics dashboard metrics summary.
   */
  getAnalyticsSummary: async () => {
    const response = await api.get('/analytics/summary');
    return response.data;
  },

  /**
   * Get proximity cluster coordinates for map hotspots.
   */
  getHotspots: async () => {
    const response = await api.get('/analytics/hotspots');
    return response.data;
  },

  /**
   * Helper to format image URLs from backend (deals with relative local uploads vs Firebase links).
   */
  getImageUrl: (path) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${API_BASE_URL}${path}`;
  }
};

export default apiService;
