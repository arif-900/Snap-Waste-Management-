import React, { useState, useEffect } from "react";
import { 
  GitBranch, Search, Shield, AlertCircle, Award, 
  BarChart2, List, Trash2, Download, Upload, 
  RefreshCw, ChevronDown, ChevronUp, Check, X, 
  FileText, Sun, Moon, Info, HelpCircle
} from "lucide-react";
import ScoreGauge from "./components/ScoreGauge";
import AnalysisLogs from "./components/AnalysisLogs";
import SuggestionBox from "./components/SuggestionBox";

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState("single"); // "single" | "batch" | "history" | "compare" | "admin"
  
  // Theme State
  const [theme, setTheme] = useState("dark");

  // Single Scanner Inputs & Status
  const [projectUrl, setProjectUrl] = useState("https://gitlab.com/fdroid/fdroidclient");
  const [branch, setBranch] = useState("");
  const [pat, setPat] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState([]);
  const [scanPercentage, setScanPercentage] = useState(0);
  const [scanError, setScanError] = useState(null);
  const [activeReport, setActiveReport] = useState(null);

  // Batch Analyzer Inputs & Status
  const [batchUrlsText, setBatchUrlsText] = useState("https://gitlab.com/fdroid/fdroidclient\nhttps://gitlab.com/gitlab-org/gitlab-runner");
  const [batchBranch, setBatchBranch] = useState("");
  const [batchReports, setBatchReports] = useState([]);
  const [isBatchScanning, setIsBatchScanning] = useState(false);

  // History & Trends
  const [allReports, setAllReports] = useState([]);
  const [historySearchUrl, setHistorySearchUrl] = useState("");
  const [selectedHistoryReport, setSelectedHistoryReport] = useState(null);
  
  // Comparison
  const [comparisonData, setComparisonData] = useState(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  // Accordion Checklist States
  const [expandedCategories, setExpandedCategories] = useState({
    Metadata: true,
    Documentation: false,
    Health: false,
    CodeQuality: false,
    Security: false,
    Testing: false,
    CICD: false,
    SpecKit: false
  });

  // Base API configuration
  const API_URL = import.meta.env.VITE_API_URL || "";

  // Initialize Theme and Load Initial Data
  useEffect(() => {
    // Dark mode is default
    document.body.classList.remove("light-theme");
    fetchLatestReports();
    fetchComparisonData();
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
      document.body.classList.add("light-theme");
    } else {
      setTheme("dark");
      document.body.classList.remove("light-theme");
    }
  };

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // API Call: Retrieve scan history
  const fetchLatestReports = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/compliance/history`);
      if (res.ok) {
        const data = await res.json();
        setAllReports(data);
      }
    } catch (e) {
      console.error("Error fetching history:", e);
    }
  };

  // API Call: Fetch comparison ranking data
  const fetchComparisonData = async () => {
    setIsLoadingCompare(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/compliance/comparison`);
      if (res.ok) {
        const data = await res.json();
        setComparisonData(data);
      }
    } catch (e) {
      console.error("Error fetching comparison:", e);
    } finally {
      setIsLoadingCompare(false);
    }
  };

  // Start Server-Sent Event (SSE) Scan
  const handleSingleScan = () => {
    if (!projectUrl) return;
    
    setIsScanning(true);
    setScanError(null);
    setScanLogs([]);
    setScanPercentage(0);
    setActiveReport(null);
    
    const params = new URLSearchParams({
      project_url: projectUrl
    });
    if (branch) params.append("branch", branch);
    if (pat) params.append("pat", pat);

    const eventSource = new EventSource(`${API_URL}/api/v1/compliance/stream?${params.toString()}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.error) {
        setScanError(data.error);
        setIsScanning(false);
        eventSource.close();
        return;
      }

      if (data.log) {
        setScanLogs(prev => [...prev, { timestamp: data.timestamp, message: data.log }]);
        setScanPercentage(data.percentage);
      }

      if (data.report) {
        setActiveReport(data.report);
        setIsScanning(false);
        eventSource.close();
        fetchLatestReports();
        fetchComparisonData();
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err);
      setScanError("Connection to analysis engine lost. Check server logs.");
      setIsScanning(false);
      eventSource.close();
    };
  };

  // Start Batch Scans
  const handleBatchScan = async () => {
    const urls = batchUrlsText
      .split("\n")
      .map(url => url.trim())
      .filter(url => url !== "");

    if (urls.length === 0) return;

    setIsBatchScanning(true);
    setBatchReports([]);

    try {
      const res = await fetch(`${API_URL}/api/v1/compliance/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_urls: urls,
          branch: batchBranch || null,
          pat: pat || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setBatchReports(data);
        fetchLatestReports();
        fetchComparisonData();
      } else {
        alert("Batch scan failed. See server console.");
      }
    } catch (e) {
      console.error(e);
      alert("Network error running batch scan.");
    } finally {
      setIsBatchScanning(false);
    }
  };

  // CSV File Upload Processing
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      // Get URLs from lines
      const urls = text
        .split(/\r?\n/)
        .map(line => {
          // Grab first column or check commas
          const parts = line.split(",");
          return parts[0].trim();
        })
        .filter(url => url !== "" && !url.toLowerCase().startsWith("url") && !url.toLowerCase().startsWith("project"));
      
      setBatchUrlsText(urls.join("\n"));
    };
    reader.readAsText(file);
  };

  // Export Batch Scan Results to CSV
  const handleExportCSV = () => {
    if (batchReports.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Project Name,Project URL,Branch,Score (%),Risk Level,Passed,Failed,Total\n";

    batchReports.forEach(r => {
      csvContent += `"${r.project_name}","${r.project_url}","${r.branch}",${r.score},"${r.risk_level}",${r.checks_passed},${r.checks_failed},${r.checks_total}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `compliance_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // API Call: Delete scanner history item
  const handleDeleteReport = async (id) => {
    if (!confirm("Are you sure you want to delete this report from history?")) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/compliance/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAllReports(prev => prev.filter(r => r.id !== id));
        if (activeReport && activeReport.id === id) setActiveReport(null);
        if (selectedHistoryReport && selectedHistoryReport.id === id) setSelectedHistoryReport(null);
        fetchComparisonData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Category mapping definitions
  const CATEGORIES = {
    Metadata: {
      title: "Project Metadata Checks",
      description: "Checks project descriptions, topic tags, license configuration, and tag releases.",
      items: ["Metadata: Description", "Metadata: Topics/Tags", "Metadata: License", "Metadata: Release Tags"]
    },
    Documentation: {
      title: "Documentation Validation",
      description: "Verifies the presence of key guides: README, CONTRIBUTING, CHANGELOG, etc.",
      items: ["Documentation: README.md", "Documentation: CONTRIBUTING.md", "Documentation: USER_MANUAL.md", "Documentation: AGENTS.md", "Documentation: CHANGELOG.md"]
    },
    Health: {
      title: "Repository Health",
      description: "Enforces codebase configurations: .gitignore, .editorconfig, env stubs, and Docker setup.",
      items: ["Health: .gitignore", "Health: .editorconfig", "Health: SECURITY.md", "Health: CODE_OF_CONDUCT.md", "Health: .env.example", "Health: Dockerfile", "Health: .dockerignore"]
    },
    CodeQuality: {
      title: "Code Quality Tool Detection",
      description: "Detects configuration setups for Ruff, Mypy, Flake8, Pylint, Bandit, Semgrep, and Pyupgrade.",
      items: ["CodeQuality: Ruff", "CodeQuality: Mypy", "CodeQuality: Flake8", "CodeQuality: Pylint", "CodeQuality: Vulture", "CodeQuality: Bandit", "CodeQuality: Semgrep", "CodeQuality: Pyupgrade"]
    },
    Security: {
      title: "Security Validation",
      description: "Validates secret scanning configuration, dependency auditing scripts, and security policy configs.",
      items: ["Security: Secret Scanning", "Security: Dependency Audit", "Security: Static Security", "Security: Security Policy"]
    },
    Testing: {
      title: "Testing Validation",
      description: "Verifies unit/integration folders, framework configs, and code coverage threshold failures.",
      items: ["Testing: Tests Folder", "Testing: Unit Tests", "Testing: Integration Tests", "Testing: Coverage Config", "Testing: Coverage Threshold"]
    },
    CICD: {
      title: "CI/CD Validation",
      description: "Checks for GitLab pipelines, pre-commit validations, changelog automation, and deployments.",
      items: ["CI/CD: .gitlab-ci.yml", "CI/CD: Pre-commit Hooks", "CI/CD: Automated Changelog", "CI/CD: Deployment Pipelines"]
    },
    SpecKit: {
      title: "Spec-Driven Development Validation",
      description: "Validates the presence of the .specify kit: constitution, spec, plan, and task templates.",
      items: ["SpecKit: .specify Directory", "SpecKit: constitution.md", "SpecKit: Spec Templates", "SpecKit: Plan Templates", "SpecKit: Task Templates", "SpecKit: specs Directory"]
    }
  };

  // Helper: Draw custom SVG line chart for Trend Analysis
  const renderTrendChart = (reports = []) => {
    if (reports.length < 2) {
      return (
        <div className="text-center py-10 text-slate-500 font-medium">
          Add at least 2 analysis runs for this repository to render trend lines.
        </div>
      );
    }

    const width = 600;
    const height = 240;
    const padding = 40;
    
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Sort reports chronologically
    const sorted = [...reports].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const minTime = 0;
    const maxTime = sorted.length - 1;

    const getX = (index) => padding + (index / maxTime) * chartWidth;
    const getY = (score) => padding + chartHeight - (score / 100) * chartHeight;

    // Draw line paths
    let points = "";
    sorted.forEach((r, idx) => {
      points += `${getX(idx)},${getY(r.score)} `;
    });

    // Gradient fill area path
    let areaPoints = `${getX(0)},${padding + chartHeight} `;
    sorted.forEach((r, idx) => {
      areaPoints += `${getX(idx)},${getY(r.score)} `;
    });
    areaPoints += `${getX(sorted.length - 1)},${padding + chartHeight}`;

    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[500px]">
          {/* Gradients definitions */}
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => (
            <g key={val}>
              <line
                x1={padding}
                y1={getY(val)}
                x2={width - padding}
                y2={getY(val)}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding - 10}
                y={getY(val) + 4}
                className="fill-slate-400 text-[10px] font-mono text-right"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Gradient Filled Area */}
          <polygon points={areaPoints} fill="url(#chartGrad)" />

          {/* Connective Line */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            points={points}
            strokeLinecap="round"
          />

          {/* Dot Markers with Scores */}
          {sorted.map((r, idx) => (
            <g key={r.id}>
              <circle
                cx={getX(idx)}
                cy={getY(r.score)}
                r="6"
                className="fill-slate-950 stroke-emerald-500 hover:r-8 transition-all cursor-pointer"
                strokeWidth="3"
              />
              <text
                x={getX(idx)}
                y={getY(r.score) - 10}
                className="fill-slate-800 dark:fill-slate-200 text-[9px] font-bold text-center"
                textAnchor="middle"
              >
                {r.score}%
              </text>
              <text
                x={getX(idx)}
                y={padding + chartHeight + 15}
                className="fill-slate-400 text-[8px] font-mono text-center"
                textAnchor="middle"
              >
                {new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-10">
      
      {/* Top Banner Navigation Header */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-slate-200/80 dark:border-slate-900 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold">
              GP
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide text-slate-800 dark:text-white uppercase block leading-none">GitLab Check</span>
              <span className="font-bold text-[9px] text-emerald-500 tracking-widest uppercase block mt-0.5">Compliance Tool</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="hidden md:flex items-center gap-2">
            {[
              { id: "single", label: "Single Check", icon: Search },
              { id: "batch", label: "Batch Scanner", icon: Upload },
              { id: "history", label: "Scan History", icon: List },
              { id: "compare", label: "Rankings", icon: Award },
              { id: "admin", label: "Console", icon: Shield }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "compare") fetchComparisonData();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/10"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60"
                }`}
              >
                <tab.icon size={13} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Theme toggler and mobile navigation toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation List */}
        <div className="md:hidden flex overflow-x-auto px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 gap-2">
          {[
            { id: "single", label: "Single", icon: Search },
            { id: "batch", label: "Batch", icon: Upload },
            { id: "history", label: "History", icon: List },
            { id: "compare", label: "Ranks", icon: Award },
            { id: "admin", label: "Console", icon: Shield }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "compare") fetchComparisonData();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold shrink-0 ${
                activeTab === tab.id
                  ? "bg-emerald-500 text-white"
                  : "text-slate-500 bg-slate-100 dark:bg-slate-900"
              }`}
            >
              <tab.icon size={11} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Container Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        
        {/* =================================================================== */}
        {/* 1. SINGLE SCAN TAB                                                  */}
        {/* =================================================================== */}
        {activeTab === "single" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Input card */}
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-50 flex items-center gap-2">
                  <Search className="text-emerald-500" />
                  Audit GitLab Repository
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter any public GitLab Project URL, branch name, or project ID to evaluate compliance scores.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">GitLab Project URL or ID</label>
                  <input
                    type="text"
                    value={projectUrl}
                    onChange={(e) => setProjectUrl(e.target.value)}
                    placeholder="https://gitlab.com/group/project"
                    className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Branch (Optional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. main, dev"
                      className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-800 dark:text-white"
                    />
                    <button
                      onClick={handleSingleScan}
                      disabled={isScanning || !projectUrl}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:dark:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-500/10 shrink-0"
                    >
                      {isScanning ? <RefreshCw size={12} className="animate-spin" /> : <GitBranch size={12} />}
                      Scan
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible Advanced Credentials */}
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <details className="group">
                  <summary className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer list-none flex items-center gap-1">
                    <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                    Private Repository Access (Token Verification)
                  </summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Personal Access Token (PAT)
                      </label>
                      <input
                        type="password"
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        placeholder="glpat-..."
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80">
                      <Info size={16} className="text-blue-400 shrink-0" />
                      <span>
                        Your Personal Access Token is only transmitted to GitLab API servers and is never saved locally. Required for private repos or rate limit avoidance.
                      </span>
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Results visualization */}
            {(isScanning || scanLogs.length > 0 || activeReport) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Visual score gauges / terminal logs panel */}
                <div className="lg:col-span-1 space-y-6">
                  {activeReport ? (
                    <ScoreGauge 
                      score={activeReport.score} 
                      riskLevel={activeReport.risk_level} 
                      passed={activeReport.checks_passed}
                      failed={activeReport.checks_failed}
                      total={activeReport.checks_total}
                    />
                  ) : (
                    <div className="glass-card rounded-2xl p-6 text-center text-slate-500 min-h-[160px] flex flex-col justify-center items-center">
                      <RefreshCw size={24} className="animate-spin text-emerald-500 mb-3" />
                      <span className="text-sm font-semibold">Running Repository Scanning Daemon...</span>
                    </div>
                  )}

                  <AnalysisLogs 
                    logs={scanLogs} 
                    percentage={scanPercentage} 
                    isScanning={isScanning}
                    error={scanError}
                  />
                </div>

                {/* Checklist validation & suggestions report */}
                <div className="lg:col-span-2 space-y-6">
                  {activeReport ? (
                    <div className="space-y-6">
                      
                      {/* Checklist accordion */}
                      <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                        <div className="mb-4">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-50">
                            Compliance Category Breakdown
                          </h3>
                          <p className="text-xs text-slate-400">
                            Review detailed rules below. Click categories to expand.
                          </p>
                        </div>

                        <div className="space-y-3">
                          {Object.entries(CATEGORIES).map(([key, cat]) => {
                            const score = activeReport[`${key.toLowerCase()}_score` === "speckit_score" ? "spec_kit_score" : `${key.toLowerCase()}_score`] || 0;
                            const isExpanded = expandedCategories[key];
                            
                            return (
                              <div key={key} className="border border-slate-100 dark:border-slate-800/80 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/10">
                                <button
                                  onClick={() => toggleCategory(key)}
                                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-900/30 text-left transition cursor-pointer"
                                >
                                  <div>
                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{cat.title}</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">{cat.description}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                      score >= 80 ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-500" :
                                      score >= 50 ? "bg-amber-100 dark:bg-amber-950 text-amber-500" :
                                      "bg-red-100 dark:bg-red-950 text-red-500"
                                    }`}>
                                      {score}%
                                    </span>
                                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800/50 pt-3 bg-slate-50/20 dark:bg-slate-950/20 space-y-2">
                                    {cat.items.map(item => {
                                      const passed = activeReport.details[item];
                                      return (
                                        <div key={item} className="flex items-center justify-between text-xs py-1">
                                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                                            {item.split(": ")[1]}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            {passed ? (
                                              <>
                                                <Check size={14} className="text-emerald-500" />
                                                <span className="text-emerald-500 font-bold text-[10px] uppercase">Pass</span>
                                              </>
                                            ) : (
                                              <>
                                                <X size={14} className="text-red-500" />
                                                <span className="text-red-500 font-bold text-[10px] uppercase">Fail</span>
                                              </>
                                            )}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Gemini Suggestions box */}
                      <SuggestionBox suggestions={activeReport.suggestions} />

                    </div>
                  ) : (
                    <div className="glass-card rounded-2xl p-10 text-center text-slate-400 font-medium min-h-[300px] flex flex-col justify-center items-center">
                      <Info size={32} className="text-slate-500 mb-3" />
                      <span>Awaiting scan results data streams. Start the scanner to compile reports.</span>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 2. BATCH SCANNER TAB                                                */}
        {/* =================================================================== */}
        {activeTab === "batch" && (
          <div className="space-y-8 animate-fadeIn">
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-50 flex items-center gap-2">
                  <Upload className="text-emerald-500" />
                  Bulk Audit Mode
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Upload a CSV file containing repository URLs in the first column, or paste a list of URLs (one per line) below.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">GitLab Project URLs (One per line)</label>
                  <textarea
                    rows={6}
                    value={batchUrlsText}
                    onChange={(e) => setBatchUrlsText(e.target.value)}
                    placeholder="https://gitlab.com/group/repo1&#10;https://gitlab.com/group/repo2"
                    className="w-full text-xs font-mono p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:border-emerald-500 dark:focus:border-emerald-500 text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Upload CSV Template</label>
                    <div className="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50/50 dark:bg-slate-900/10 hover:border-emerald-500 cursor-pointer">
                      <label className="cursor-pointer text-center">
                        <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                        <span className="text-xs font-semibold text-slate-500 block">Choose CSV File</span>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleCSVUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleBatchScan}
                      disabled={isBatchScanning || !batchUrlsText}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:dark:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-500/10"
                    >
                      {isBatchScanning ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Run Batch Scans
                    </button>
                    {batchReports.length > 0 && (
                      <button
                        onClick={handleExportCSV}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download size={12} />
                        Export
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Batch scan results list */}
            {batchReports.length > 0 && (
              <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
                <div className="px-6 py-4 bg-slate-100 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800/80 flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Batch Analysis Results</h3>
                  <span className="text-[10px] text-emerald-500 font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 rounded-full">
                    {batchReports.length} Scans Run
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-55 dark:bg-slate-950/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <th className="p-4">Project Name</th>
                        <th className="p-4">Branch</th>
                        <th className="p-4">Compliance Score</th>
                        <th className="p-4">Risk Status</th>
                        <th className="p-4 text-center">Passed Checks</th>
                        <th className="p-4 text-center">Failed Checks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {batchReports.map(r => (
                        <tr key={r.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="p-4 font-bold text-slate-700 dark:text-slate-200">
                            {r.project_name}
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5 truncate max-w-[280px]">
                              {r.project_url}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 font-mono font-medium">{r.branch}</td>
                          <td className="p-4">
                            <span className="font-bold text-sm">{r.score}%</span>
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              r.risk_level === "Low" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-500" :
                              r.risk_level === "Medium" ? "bg-amber-100 dark:bg-amber-950 text-amber-500" :
                              r.risk_level === "High" ? "bg-orange-100 dark:bg-orange-950 text-orange-500" :
                              "bg-red-100 dark:bg-red-950 text-red-500"
                            }`}>
                              {r.risk_level}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold text-emerald-500">{r.checks_passed}</td>
                          <td className="p-4 text-center font-bold text-red-500">{r.checks_failed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 3. TRENDS & HISTORY TAB                                             */}
        {/* =================================================================== */}
        {activeTab === "history" && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* History selection pane */}
              <div className="lg:col-span-1 glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-50">Scan Logs</h3>
                  <p className="text-xs text-slate-400 mt-1">Select a past run to view full breakdown and AI stubs.</p>
                </div>

                <div className="relative mb-4">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={historySearchUrl}
                    onChange={(e) => setHistorySearchUrl(e.target.value)}
                    placeholder="Search by repo URL..."
                    className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[400px]">
                  {allReports.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No records found.</div>
                  ) : (
                    allReports
                      .filter(r => r.project_url.toLowerCase().includes(historySearchUrl.toLowerCase()) || r.project_name.toLowerCase().includes(historySearchUrl.toLowerCase()))
                      .map(report => (
                        <button
                          key={report.id}
                          onClick={() => setSelectedHistoryReport(report)}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                            selectedHistoryReport && selectedHistoryReport.id === report.id
                              ? "border-emerald-500 bg-emerald-50/5 dark:bg-emerald-950/10"
                              : "border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate block max-w-[150px]">
                              {report.project_name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(report.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate font-medium font-mono mb-2">
                            ref: {report.branch}
                          </span>
                          <div className="flex justify-between items-center mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              report.risk_level === "Low" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-500" :
                              report.risk_level === "Medium" ? "bg-amber-100 dark:bg-amber-950 text-amber-500" :
                              "bg-red-100 dark:bg-red-950 text-red-500"
                            }`}>
                              {report.risk_level} Risk
                            </span>
                            <span className="font-extrabold text-xs text-slate-700 dark:text-slate-200">
                              {report.score}%
                            </span>
                          </div>
                        </button>
                      ))
                  )}
                </div>
              </div>

              {/* Visualization trends panel */}
              <div className="lg:col-span-2 space-y-6">
                {selectedHistoryReport ? (
                  <div className="space-y-6">
                    {/* SVG Trend Line */}
                    <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-50">Score Trend Analysis</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Historical compliance progression for <strong>{selectedHistoryReport.project_name}</strong>.
                        </p>
                      </div>
                      {renderTrendChart(allReports.filter(r => r.project_url === selectedHistoryReport.project_url))}
                    </div>

                    {/* Report summary overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        <ScoreGauge 
                          score={selectedHistoryReport.score}
                          riskLevel={selectedHistoryReport.risk_level}
                          passed={selectedHistoryReport.checks_passed}
                          failed={selectedHistoryReport.checks_failed}
                          total={selectedHistoryReport.checks_total}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <SuggestionBox suggestions={selectedHistoryReport.suggestions} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card rounded-2xl p-10 text-center text-slate-400 font-medium min-h-[350px] flex flex-col justify-center items-center">
                    <List size={32} className="text-slate-500 mb-3" />
                    <span>Select an analysis report log from the sidebar to visualize score progress trends.</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 4. LEADERBOARD / COMPARISON TAB                                     */}
        {/* =================================================================== */}
        {activeTab === "compare" && (
          <div className="space-y-8 animate-fadeIn">
            {isLoadingCompare ? (
              <div className="text-center py-10 flex flex-col items-center">
                <RefreshCw size={24} className="animate-spin text-emerald-500 mb-3" />
                <span className="text-sm font-semibold">Querying Rankings Database...</span>
              </div>
            ) : comparisonData && comparisonData.projects.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Ranking Summary Bar */}
                <div className="lg:col-span-1 glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col justify-center items-center text-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Average Project Compliance
                  </h3>
                  <div className="w-32 h-32 rounded-full border-8 border-emerald-500/20 flex items-center justify-center mb-4">
                    <span className="text-3xl font-extrabold text-emerald-500">
                      {comparisonData.average_score}%
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">Team Score Rating</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                    Average score calculated dynamically from the latest scan updates of all unique repositories.
                  </p>
                </div>

                {/* Team Leaderboard table */}
                <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
                  <div className="px-6 py-4 bg-slate-100 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800/80">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Project Leaderboard</h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-55 dark:bg-slate-950/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <th className="p-4 text-center">Rank</th>
                          <th className="p-4">Repository</th>
                          <th className="p-4">Rating</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-center">Checks Passed</th>
                          <th className="p-4 text-center">Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {comparisonData.projects.map((project, index) => (
                          <tr key={project.project_url} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                            <td className="p-4 text-center font-bold text-slate-400">
                              {index === 0 ? "🏆 1" : index + 1}
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[180px]">{project.project_name}</span>
                              <span className="text-[10px] text-slate-400 block truncate max-w-[220px] font-mono mt-0.5">{project.project_url}</span>
                            </td>
                            <td className="p-4">
                              <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{project.score}%</span>
                            </td>
                            <td className="p-4">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                project.risk_level === "Low" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-500" :
                                project.risk_level === "Medium" ? "bg-amber-100 dark:bg-amber-950 text-amber-500" :
                                "bg-red-100 dark:bg-red-950 text-red-500"
                              }`}>
                                {project.risk_level}
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                              {project.checks_passed} / {project.checks_passed + project.checks_failed}
                            </td>
                            <td className="p-4 text-center text-slate-400 font-mono text-[10px]">
                              {new Date(project.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="glass-card rounded-2xl p-10 text-center text-slate-400 font-medium min-h-[350px] flex flex-col justify-center items-center">
                <Award size={32} className="text-slate-500 mb-3" />
                <span>No repositories in leaderboard. Start scanning projects to populate comparison metrics.</span>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* 5. ADMIN CONSOLE TAB                                                */}
        {/* =================================================================== */}
        {activeTab === "admin" && (
          <div className="space-y-8 animate-fadeIn">
            {/* System Status Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 block mb-2 uppercase">Analysis Database</span>
                <span className="text-lg font-bold text-slate-800 dark:text-white">
                  {supabase_service.is_mock ? "Local JSON File Fallback" : "Live Supabase PostgreSQL"}
                </span>
                <p className="text-[10px] text-slate-400 mt-2 font-mono">path: ./compliance_db.json</p>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 block mb-2 uppercase">AI Model Service</span>
                <span className="text-lg font-bold text-slate-800 dark:text-white">Google Gemini 1.5 Flash</span>
                <p className="text-[10px] text-emerald-500 mt-2 font-semibold">Active Status: Running Online</p>
              </div>
              <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 block mb-2 uppercase">Total Checked Audits</span>
                <span className="text-lg font-bold text-slate-800 dark:text-white">{allReports.length} reports</span>
                <p className="text-[10px] text-slate-400 mt-2">Aggregated scan checkpoints in database.</p>
              </div>
            </div>

            {/* Audit log history list */}
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
              <div className="px-6 py-4 bg-slate-100 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800/80">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Audit logs & scans management</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-55 dark:bg-slate-950/40 text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <th className="p-4">Report ID</th>
                      <th className="p-4">Repository Name</th>
                      <th className="p-4">Branch</th>
                      <th className="p-4">Score</th>
                      <th className="p-4 text-center">Scan Date</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allReports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                          No scans logged in database.
                        </td>
                      </tr>
                    ) : (
                      allReports.map(r => (
                        <tr key={r.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="p-4 font-mono text-[10px] text-slate-400">{r.id}</td>
                          <td className="p-4">
                            <span className="font-bold text-slate-700 dark:text-slate-300 block">{r.project_name}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[200px] block mt-0.5">{r.project_url}</span>
                          </td>
                          <td className="p-4 text-slate-500 font-mono">{r.branch}</td>
                          <td className="p-4 font-bold">{r.score}%</td>
                          <td className="p-4 text-center text-slate-400 font-mono">
                            {new Date(r.created_at).toLocaleString()}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeleteReport(r.id)}
                              className="p-1.5 hover:bg-red-500/10 hover:text-red-500 text-slate-400 rounded-lg cursor-pointer transition-colors"
                              title="Delete record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer layout */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-900/60 bg-slate-100/50 dark:bg-slate-950/60 py-6 text-center text-[10px] text-slate-400 mt-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-medium">
          <span>&copy; 2026 GitLab Compliance Repository Checker. Released under the MIT License.</span>
          <div className="flex items-center gap-4">
            <a href="/docs" target="_blank" className="hover:text-emerald-500 transition">API Documentation</a>
            <span>•</span>
            <span className="flex items-center gap-1">
              Powered by <strong className="text-slate-700 dark:text-white font-semibold">Gemini API</strong> & <strong className="text-slate-700 dark:text-white font-semibold">PostgreSQL</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
