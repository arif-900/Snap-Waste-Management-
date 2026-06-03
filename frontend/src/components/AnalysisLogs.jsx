import React, { useEffect, useRef } from "react";
import { Terminal, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

export default function AnalysisLogs({ logs = [], percentage = 0, isScanning = false, error = null }) {
  const terminalEndRef = useRef(null);

  // Auto-scroll terminal viewport to bottom when logs are updated
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full glass-card rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-slate-300 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-500" />
          <span>gitlab-analyzer-daemon.log</span>
        </div>
        {isScanning && (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <RefreshCw size={12} className="animate-spin" />
            <span>Scanning...</span>
          </div>
        )}
      </div>

      {/* Logs Viewport */}
      <div className="flex-1 p-4 bg-slate-950 font-mono text-xs text-slate-300 space-y-2 overflow-y-auto min-h-[160px] max-h-[300px]">
        {logs.length === 0 && !isScanning && !error && (
          <div className="text-slate-500 text-center py-6">
            {"Waiting to connect to GitLab... Ready to start repository scan."}
          </div>
        )}
        
        {logs.map((log, index) => {
          const isError = log.message.toLowerCase().includes("fail") || log.message.toLowerCase().includes("error");
          const isSuccess = log.message.toLowerCase().includes("success") || log.message.toLowerCase().includes("complete");
          
          return (
            <div key={index} className="flex gap-2 items-start leading-relaxed">
              <span className="text-slate-500 select-none">[{log.timestamp}]</span>
              <span className={isError ? "text-red-400" : isSuccess ? "text-emerald-400 font-semibold" : "text-slate-300"}>
                {log.message}
              </span>
            </div>
          );
        })}

        {error && (
          <div className="flex gap-2 items-start leading-relaxed text-red-400 bg-red-950/20 p-2 rounded border border-red-900/30">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span><strong>Error:</strong> {error}</span>
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Progress Bar Footer */}
      {isScanning && (
        <div className="bg-slate-900 p-3 border-t border-slate-800">
          <div className="flex justify-between items-center mb-1 text-[10px] text-slate-400 font-mono">
            <span>Scan Progress</span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300 animate-pulse"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
