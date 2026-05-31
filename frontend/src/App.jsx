import React, { useState } from 'react';
import { Shield, Smartphone, AlertCircle, BarChart2 } from 'lucide-react';
import CitizenReport from './pages/CitizenReport';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [view, setView] = useState('citizen'); // 'citizen' or 'admin'

  return (
    <div className="min-h-screen flex flex-col bg-dark-950 text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Dynamic Ambient Background Glows (Premium Aesthetics) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Bar */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-slate-800/80 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="text-xl">♻️</span>
            </div>
            <div>
              <span className="font-sans font-extrabold text-sm tracking-wide text-white uppercase block leading-none">SmartWaste</span>
              <span className="font-sans font-bold text-[10px] text-brand-400 tracking-widest uppercase block mt-0.5">Hyderabad</span>
            </div>
          </div>

          {/* Toggle Switches */}
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setView('citizen')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                view === 'citizen'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Citizen Portal
            </button>
            <button
              onClick={() => setView('admin')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                view === 'admin'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Command
            </button>
          </nav>
        </div>
      </header>

      {/* Main Core View Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 z-10">
        {view === 'citizen' ? (
          <CitizenReport />
        ) : (
          <AdminDashboard />
        )}
      </main>

      {/* Footer layout */}
      <footer className="w-full border-t border-slate-900 bg-dark-950/60 py-6 text-center text-[10px] text-slate-500 z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>&copy; 2026 Greater Hyderabad Municipal Corporation (GHMC). All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="/docs" target="_blank" className="hover:text-brand-400 transition">API Documentation</a>
            <span>•</span>
            <span className="flex items-center gap-1">
              Powered by <strong className="text-slate-400">Gemini Vision AI</strong> & <strong className="text-slate-400">Firebase</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
