/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Last Updated: 2026-04-29T12:43:00Z
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Search, 
  RefreshCw, 
  Settings, 
  FileText, 
  Code, 
  ShieldCheck, 
  Zap,
  Terminal,
  ChevronRight,
  ExternalLink,
  Cpu,
  Layers,
  Copy,
  Check,
  X,
  Link2,
  Share2,
  Moon,
  Sun,
  Github
} from 'lucide-react';
import { GraphView } from './components/GraphView';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Types ---
interface SearchResult {
  id: string;
  file: string;
  content: string;
  score: number;
}

const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview', icon: Database },
  { id: 'search', label: 'Search Demo', icon: Search },
  { id: 'graph', label: 'Knowledge Graph', icon: Share2 },
  { id: 'setup', label: 'Installation', icon: ShieldCheck },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All Tags');
  const [searchMode, setSearchMode] = useState<'semantic' | 'keyword' | 'note_name'>('semantic');
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingNote, setIsFetchingNote] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [maxResults, setMaxResults] = useState(25);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showSettings, setShowSettings] = useState(false);

  // Toggle theme
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'light') {
      html.classList.add('light');
    } else {
      html.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState({ notes: 0, chunks: 0, status: 'unconfigured' });
  const [activeNote, setActiveNote] = useState<{ fileName: string, content: string } | null>(null);

  const [availableTags, setAvailableTags] = useState<string[]>([]);

  React.useEffect(() => {
    const fetchStats = () => {
      fetch('/api/stats')
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.notes === 'number') {
            setStats(data);
          }
        })
        .catch(err => console.warn("Stats error:", err.message));
    };

    const fetchTags = () => {
      fetch('/api/tags')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAvailableTags(data);
          }
        })
        .catch(err => console.warn("Tags error:", err.message));
    };

    fetchStats();
    fetchTags();
    const interval = setInterval(() => {
      fetchStats();
      fetchTags();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Trigger search on mount or filter change
  React.useEffect(() => {
    if (activeTab === 'search') {
      handleRealSearch();
    }
  }, [selectedTag, activeTab, searchMode, maxResults]);

  // Handle empty search to enter Browse Mode
  React.useEffect(() => {
    if (activeTab === 'search' && !searchQuery) {
      handleRealSearch();
    }
  }, [searchQuery]);

  const [isLocked, setIsLocked] = useState(false);

  const handleRealSearch = async () => {
    setIsSearching(true);
    setIsLocked(false);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&tag=${encodeURIComponent(selectedTag)}&mode=${searchMode}&limit=${maxResults}`);
      
      if (response.status === 401) {
        setIsLocked(true);
        setSearchResults([]);
        return;
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        setSearchResults(data.map((item: any, idx: number) => ({
          id: idx.toString(),
          file: item.file_name,
          content: item.content,
          score: item.distance || 0
        })));
      } else {
        console.warn("Search API returned non-array data:", data);
        setSearchResults([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    // useEffect will trigger handleRealSearch for Browse Mode
  };

  const openInObsidian = (fileName: string) => {
    const cleanName = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
    const uri = `obsidian://open?file=${encodeURIComponent(cleanName)}`;
    window.location.href = uri;
  };

  const handleFetchAndCopy = async (e: React.MouseEvent, fileName: string, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/note/${encodeURIComponent(fileName)}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data && data.content) {
        copyToClipboard(data.content, id);
      }
    } catch (err) {
      console.error("Failed to copy note:", err);
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const words = query.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return text;
    
    // Simple highlight
    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <span key={i} className="bg-sleek-accent/30 text-white font-bold px-0.5 rounded">{part}</span> : part
    );
  };

  const fetchFullNote = async (fileName: string) => {
    setIsFetchingNote(true);
    setActiveNote({ fileName, content: "" }); // Open modal with empty content/loading state
    try {
      const res = await fetch(`/api/note/${encodeURIComponent(fileName)}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Note not found (${res.status})`);
      }
      const data = await res.json();
      setActiveNote(data);
    } catch (err: any) {
      console.error(err);
      setActiveNote({ fileName: "Error", content: `Failed to load note: ${err.message}` });
    } finally {
      setIsFetchingNote(false);
    }
  };

  const fetchDoc = async (docName: string) => {
    setIsFetchingNote(true);
    setActiveNote({ fileName: docName, content: "" });
    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(docName)}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Document not found (${res.status})`);
      }
      const data = await res.json();
      setActiveNote(data);
    } catch (err: any) {
      console.error(err);
      setActiveNote({ fileName: "Error", content: `Failed to load documentation: ${err.message}` });
    } finally {
      setIsFetchingNote(false);
    }
  };

  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  return (
    <div className="min-h-screen bg-sleek-bg text-sleek-text selection:bg-sleek-accent/20">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 bg-sleek-header/50 backdrop-blur-lg sticky top-0 z-50 border-b border-sleek-border">
        {/* Left: Brand */}
        <div className="flex items-center space-x-4 cursor-pointer w-1/4" onClick={() => setActiveTab('overview')}>
          <div className="w-8 h-8 bg-sleek-accent rounded-lg flex items-center justify-center shadow-lg shadow-sleek-accent/20 shrink-0">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <span className="text-sm font-black tracking-tighter text-sleek-text uppercase leading-none hidden md:block">
            Vector<span className="text-sleek-accent">SYNC</span>
          </span>
        </div>
        
        {/* Center: Navigation */}
        <nav className="flex items-center gap-8 justify-center flex-1">
          {DASHBOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:text-sleek-accent relative py-2 ${
                activeTab === tab.id ? 'text-sleek-accent' : 'text-sleek-muted'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-sleek-accent rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </nav>
        
        {/* Right: Actions */}
        <div className="flex items-center space-x-4 justify-end w-1/4">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-sleek-card border border-sleek-border rounded-full">
            <div className="w-1.5 h-1.5 bg-sleek-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(124,99,255,0.8)]"></div>
            <span className="text-[8px] font-bold uppercase tracking-widest text-sleek-accent">Neural Online</span>
          </div>
          
          <div className="flex items-center gap-1 border-l border-sleek-border ml-2 pl-3">
            <button 
              onClick={toggleTheme}
              className="p-2 text-sleek-muted hover:text-sleek-accent transition-all rounded-xl hover:bg-white/5"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-sleek-muted hover:text-sleek-accent transition-all rounded-xl hover:bg-white/5"
              title="Application Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-16">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-16"
            >
              <div className="space-y-12 text-center max-w-4xl mx-auto">
                <div className="space-y-6">
                  <div className="flex justify-center items-center gap-8 mb-4">
                    <a href="https://obsidian.md" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
                      <img src="/assets/obsidian-logo-gradient.svg" alt="Obsidian" className="h-12 w-12 drop-shadow-xl" referrerPolicy="no-referrer" />
                    </a>
                    <div className="h-px w-12 bg-gradient-to-r from-transparent via-sleek-accent/30 to-transparent"></div>
                    <a href="https://mariadb.org" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
                      <img 
                        src={theme === 'dark' ? "/assets/MariaDB-Logo-White.svg" : "/assets/MariaDB-Logo-Black.svg"} 
                        alt="MariaDB" 
                        className="h-10 opacity-70" 
                        referrerPolicy="no-referrer"
                      />
                    </a>
                  </div>
                  <h1 className="text-8xl font-bold tracking-tighter leading-[0.9]">
                    Seamlessly search your <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-sleek-accent to-[#A78BFF]">local vault.</span>
                  </h1>
                  <p className="text-xl text-sleek-muted max-w-2xl mx-auto font-medium">
                    A minimal engine that turns your Obsidian vault into a semantic database using MariaDB Vector.
                  </p>
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={() => {
                      if ((stats as any).status === 'connected') {
                        setActiveTab('search');
                      } else {
                        setActiveTab('setup');
                        // Optional: scroll to the command boxes
                        window.scrollTo({ top: 1000, behavior: 'smooth' });
                      }
                    }}
                    className="px-12 py-5 bg-sleek-accent text-white font-bold rounded-2xl text-lg hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-sleek-accent/30"
                  >
                    {(stats as any).status === 'connected' ? 'Start Searching' : 'Connect Vault Engine'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto pt-8">
                  {[
                    { 
                      label: 'NEURAL VAULT SIZE', 
                      value: stats.notes.toString(),
                      sub: 'Total Notes Indexed',
                      color: stats.notes > 0 ? 'text-sleek-accent' : 'text-slate-600'
                    },
                    { 
                      label: 'MEMORY CHUNKS', 
                      value: stats.chunks.toString(),
                      sub: 'Vectorized Segments',
                      color: stats.chunks > 0 ? 'text-[#8B7CFF]' : 'text-slate-600'
                    },
                    { 
                      label: 'ENGINE STATUS', 
                      value: (stats as any).status === 'connected' ? 'ONLINE' : 'OFFLINE',
                      sub: 'MariaDB Cluster Connection',
                      color: (stats as any).status === 'connected' ? 'text-green-400' : 'text-red-500'
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center space-y-2 p-6 rounded-3xl bg-sleek-card border border-sleek-border relative overflow-hidden">
                      {stat.label === 'ENGINE STATUS' && (stats as any).status === 'error' && (stats as any).message?.includes('auth_gssapi_client') && (
                        <div className="absolute inset-0 bg-red-500/10 backdrop-blur-sm flex items-center justify-center p-4">
                          <div className="space-y-2">
                             <p className="text-[8px] font-bold text-red-400">AUTH_PROTOCOL_ERROR</p>
                             <button 
                               onClick={() => fetchDoc('GUIDE.md')}
                               className="px-3 py-1 bg-red-500 text-white text-[8px] font-bold rounded-lg hover:bg-red-600 transition-colors"
                             >
                               VIEW FIX
                             </button>
                          </div>
                        </div>
                      )}
                      <p className="text-[9px] font-bold uppercase tracking-widest text-sleek-muted">{stat.label}</p>
                      <p className={`text-4xl font-extrabold tracking-tighter ${stat.color}`}>{stat.value}</p>
                      <p className="text-[10px] text-slate-600 font-medium">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                <AnimatePresence>
                  {(stats as any).status === 'error' && (stats as any).message?.includes('auth_gssapi_client') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="max-w-3xl mx-auto overflow-hidden"
                    >
                      <div className="bg-red-500/5 border border-red-500/20 rounded-[32px] p-8 text-left space-y-6">
                        <div className="flex items-start gap-6">
                          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                            <ShieldCheck className="w-6 h-6" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-bold text-red-400 tracking-tight">MariaDB Authentication Protocol Mismatch</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                              Your database server is requesting <code className="text-red-300">auth_gssapi_client</code> (Kerberos), but this client only supports <code className="text-sleek-accent">mysql_native_password</code>. This often happens after a system update or if the 'root' account is protected by system-level auth.
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-4 pt-4 border-t border-red-500/10">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Step 1: Open your MariaDB Console (MySQL Terminal)</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-sleek-accent">Step 2: Run this SQL Fix command:</p>
                          <div className="bg-black/40 rounded-2xl p-6 border border-white/5 flex items-center justify-between group">
                            <code className="text-sleek-accent font-mono text-sm leading-relaxed max-w-[70%]">
                              ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('your_password');
                            </code>
                            <button 
                              onClick={() => copyToClipboard("ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('your_password'); FLUSH PRIVILEGES;", "auth-fix")}
                              className="p-3 bg-sleek-accent text-white rounded-xl hover:scale-105 transition-all flex items-center gap-2 text-[10px] font-bold uppercase shrink-0 shadow-lg shadow-sleek-accent/20"
                            >
                              {copyStatus === 'auth-fix' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              Copy & Use Fix
                            </button>
                          </div>
                          <p className="text-[11px] text-red-400/80 italic font-medium">⚠️ Important: Replace 'your_password' with your actual MariaDB password before pressing Enter in your terminal.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="space-y-6">
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder="Describe what you're looking for..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRealSearch()}
                    className="w-full h-16 pl-0 pr-20 bg-transparent border-b-2 border-white/10 focus:border-sleek-accent focus:outline-none text-2xl font-medium placeholder:text-slate-700 transition-colors"
                  />
                  <div className="absolute right-0 top-4 flex items-center gap-3">
                    {searchQuery && (
                      <button 
                        onClick={handleClearSearch}
                        className="h-8 w-8 flex items-center justify-center text-slate-600 hover:text-white transition-colors"
                        title="Clear search"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    <button 
                      onClick={handleRealSearch}
                      className="h-8 w-8 flex items-center justify-center text-sleek-muted hover:text-sleek-accent transition-colors"
                    >
                      {isSearching ? <RefreshCw className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-sleek-muted">Search Strategy:</span>
                    <div className="flex bg-sleek-card p-1 rounded-xl border border-sleek-border">
                      {[
                        { id: 'semantic', label: 'Semantic' },
                        { id: 'keyword', label: 'Keyword' },
                        { id: 'note_name', label: 'Note Name' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => setSearchMode(mode.id as any)}
                          className={`text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${
                            searchMode === mode.id 
                            ? 'bg-sleek-accent text-black' 
                            : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c63ff] flex items-center gap-2">
                      <div className="w-1 h-1 bg-[#7c63ff] rounded-full animate-ping"></div>
                      Neural Filter:
                    </span>
                    <div className="relative group">
                      <select
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        className="appearance-none bg-[#7c63ff]/10 border border-[#7c63ff]/30 text-[#A78BFF] text-[10px] font-bold uppercase tracking-[0.15em] px-8 py-3 pr-14 rounded-2xl focus:outline-none focus:border-[#7c63ff] transition-all cursor-pointer hover:bg-[#7c63ff]/20 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <option value="All Tags" className="bg-[#1e1e1e] text-slate-300"># ALL_VAULT</option>
                        {availableTags.map(tag => (
                          <option key={tag} value={tag} className="bg-[#1e1e1e] text-slate-300">
                            {tag.toUpperCase().replace('#', '# ')}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-sleek-accent">
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 min-h-[400px]">
                {isLocked ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-6 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-red-400">Vault Access Restricted</h3>
                      <p className="text-xs text-slate-600 font-mono">CONNECTION_TERMINATED // PASSWORD_REQUIRED</p>
                    </div>
                    <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                      The neural sync process has been disconnected. Please run <code className="text-slate-300">engine/main.py</code> and authenticate to unlock search.
                    </p>
                  </div>
                ) : isSearching ? (
                  <div className="py-20 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-sleek-muted animate-pulse">
                    Scanning neural space...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                    {searchResults.map((res) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={res.id} 
                        className="group flex gap-6 p-6 rounded-3xl bg-sleek-card hover:bg-sleek-accent/5 transition-all border border-sleek-border hover:border-sleek-accent/30 cursor-pointer"
                        onClick={() => fetchFullNote(res.file)}
                      >
                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-sleek-accent/10 flex items-center justify-center text-sleek-accent group-hover:scale-110 transition-transform">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <h3 className="text-sm font-bold text-sleek-accent uppercase tracking-wider truncate">{res.file}</h3>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => handleFetchAndCopy(e, res.file, `copy-${res.id}`)}
                                  className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
                                    copyStatus === `copy-${res.id}` 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-white/5 text-slate-500 hover:text-sleek-accent hover:bg-white/10'
                                  }`}
                                  title="Copy full note"
                                >
                                  {copyStatus === `copy-${res.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openInObsidian(res.file); }}
                                  className="flex-shrink-0 p-1.5 bg-white/5 rounded-lg text-slate-500 hover:text-[#8B7CFF] hover:bg-white/10 transition-all"
                                  title="Open in Obsidian"
                                >
                                  <Link2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[9px] font-mono text-slate-600 uppercase">Match Score</span>
                              <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max(5, (1 - res.score) * 100)}%` }}
                                  className={`h-full ${res.score < 0.2 ? 'bg-green-400' : res.score < 0.4 ? 'bg-sleek-accent' : 'bg-slate-600'}`}
                                />
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-200 transition-colors">
                            {highlightText(res.content, searchQuery)}
                          </p>
                          <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-3 h-3 text-sleek-accent" />
                            Read full note from vault
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="py-20 text-center text-slate-700 uppercase tracking-widest text-xs font-bold font-mono">
                    No spectral matches found for "{searchQuery}"
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-700 uppercase tracking-widest text-xs font-bold font-mono">
                    Enter a query or select a tag to browse vault
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-6xl mx-auto"
            >
               <GraphView onNodeClick={(name) => fetchFullNote(name)} />
            </motion.div>
          )}

          {activeTab === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-12"
            >
              <div className="space-y-4 text-center">
                <h2 className="text-3xl font-bold">Local Setup</h2>
                <p className="text-sm text-sleek-muted max-w-md mx-auto leading-relaxed">
                  To index your local Obsidian vault, run the following commands in your machine's terminal.
                </p>
              </div>

              <div className="space-y-6">
                <div className="grid gap-6">
                  {[
                    { label: "1. Install Dependencies", cmd: "pip install -r requirements.txt", id: 'pip' },
                    { label: "2. Launch Sync Engine", cmd: "python engine/main.py", id: 'run' }
                  ].map((step) => (
                    <div key={step.id} className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{step.label}</p>
                      <div className="bg-sleek-card rounded-2xl p-4 flex items-center justify-between group border border-sleek-border hover:border-sleek-accent/30 transition-colors">
                        <code className="text-sleek-accent font-mono text-sm">{step.cmd}</code>
                        <button 
                          onClick={() => copyToClipboard(step.cmd, step.id)}
                          className="p-2 hover:bg-sleek-accent/10 rounded-lg transition-colors text-sleek-muted hover:text-sleek-accent"
                        >
                          {copyStatus === step.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-sleek-border">
                  <div className="bg-sleek-card rounded-3xl p-8 border border-sleek-border space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-widest">Connectivity Status</h3>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stats.notes > 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-yellow-500 animate-pulse'}`}></span>
                        <span className="text-[10px] font-bold text-sleek-muted">
                          {(stats as any).status === 'connected' ? 'CONNECTED' : 'WAITING FOR LOCAL AGENT'}
                        </span>
                      </div>
                    </div>
                    
                    {(stats as any).status === 'connected' ? (
                      <p className="text-xs text-sleek-muted leading-relaxed">
                        The engine is active. <span className="text-sleek-accent font-bold">{stats.notes}</span> files are currently indexed in MariaDB. Changes to your local vault will sync automatically via the Python watcher.
                      </p>
                    ) : (
                      <p className="text-xs text-sleek-muted leading-relaxed">
                        Once you run <code className="text-slate-300">engine/main.py</code> locally and point it to your vault, this dashboard will awaken automatically.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>



      {/* Full Note Overlay */}
      <AnimatePresence>
        {activeNote && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-sleek-bg border border-white/10 w-full max-w-4xl max-h-[85vh] rounded-[40px] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-sleek-accent/10 flex items-center justify-center text-sleek-accent">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="text-sm font-bold text-sleek-accent uppercase tracking-[0.2em]">{activeNote.fileName}</h2>
                </div>
                <button 
                  onClick={() => setActiveNote(null)}
                  className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 md:p-12 font-sans text-sm leading-relaxed text-slate-300 selection:bg-sleek-accent/20">
                {isFetchingNote ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-4 bg-white/5 rounded w-3/4"></div>
                    <div className="h-4 bg-white/5 rounded w-1/2"></div>
                    <div className="h-4 bg-white/5 rounded w-5/6"></div>
                    <div className="h-4 bg-white/5 rounded w-2/3"></div>
                    <div className="h-4 bg-white/5 rounded w-3/4"></div>
                  </div>
                ) : (
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeNote.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-sleek-header border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Application Preferences</h2>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-sleek-muted mt-1">Neural Bridge Config</p>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Theme Section */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-sleek-muted flex items-center gap-2">
                     <Zap className="w-3 h-3 text-sleek-accent" /> Interface Theme
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setTheme('dark')}
                      className={`p-6 rounded-2xl border text-left transition-all group ${
                        theme === 'dark' 
                        ? 'bg-sleek-accent border-sleek-accent text-white' 
                        : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-widest mb-1">Dark Mode</div>
                      <div className="text-[10px] opacity-60">Deep obsidian aesthetics</div>
                    </button>
                    <button 
                      onClick={() => setTheme('light')}
                      className={`p-6 rounded-2xl border text-left transition-all group ${
                        theme === 'light' 
                        ? 'bg-sleek-accent border-sleek-accent text-white' 
                        : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-widest mb-1">Light Mode</div>
                      <div className="text-[10px] opacity-60">High contrast clarity</div>
                    </button>
                  </div>
                </div>

                {/* Search Depth Section */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-sleek-muted flex items-center gap-2">
                     <Search className="w-3 h-3 text-sleek-accent" /> Neural Depth
                  </h3>
                  <div className="flex gap-3">
                    {[25, 50, 100, 200].map(num => (
                      <button 
                        key={num}
                        onClick={() => setMaxResults(num)}
                        className={`flex-1 py-4 rounded-xl border text-[11px] font-bold transition-all ${
                          maxResults === num 
                          ? 'bg-white/10 border-sleek-accent text-sleek-accent' 
                          : 'border-white/5 bg-white/5 text-slate-500 hover:bg-white/10'
                        }`}
                      >
                        {num} Results
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vault Section */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-sleek-muted flex items-center gap-2">
                     <Database className="w-3 h-3 text-sleek-accent" /> Active Vault
                  </h3>
                  <div className="p-6 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between">
                    <div className="overflow-hidden">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">File System Path</div>
                      <code className="text-xs text-slate-400 truncate block">{(stats as any).vault || "RESOLVING_PATH..."}</code>
                    </div>
                    <div className="px-3 py-1 bg-white/5 rounded-full text-[8px] font-bold text-slate-500 uppercase">Live</div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-white/[0.01] flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic">Changes apply instantly</span>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-8 py-3 bg-sleek-accent text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(124,99,255,0.3)] transition-all"
                >
                  Close Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <footer className="py-20 border-t border-sleek-border bg-sleek-bg transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-sleek-accent rounded-lg flex items-center justify-center shadow-lg shadow-sleek-accent/20">
                  <Zap className="w-5 h-5 text-white fill-current" />
                </div>
                <span className="text-lg font-black tracking-tighter uppercase">
                  Vector<span className="text-sleek-accent">Sync</span>
                </span>
              </div>
              <p className="text-xs text-sleek-muted max-w-xs leading-relaxed font-medium">
                Bridging local knowledge with infinite intelligence via MariaDB Vector. Built for the MariaDB Hackathon 2026.
              </p>
              <div className="flex gap-4 items-center pt-2">
                <a href="https://github.com/MariaDB-Hackathon-MY-2026/obsidian-mariadb-bridge" target="_blank" rel="noopener noreferrer" className="p-2 bg-sleek-card border border-sleek-border rounded-xl text-sleek-muted hover:text-sleek-accent hover:border-sleek-accent/30 transition-all">
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 md:gap-24">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-sleek-accent">Resources</h4>
                <nav className="flex flex-col gap-2">
                  <button onClick={() => fetchDoc('GUIDE.md')} className="text-xs text-sleek-muted hover:text-sleek-accent transition-colors text-left">Documentation</button>
                  <button onClick={() => setActiveTab('setup')} className="text-xs text-sleek-muted hover:text-sleek-accent transition-colors text-left">Installation Guide</button>
                  <button onClick={() => fetchDoc('README.md')} className="text-xs text-sleek-muted hover:text-sleek-accent transition-colors text-left">Read Me</button>
                </nav>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-sleek-accent">Technology</h4>
                <div className="flex flex-col gap-6">
                  <a href="https://mariadb.org" target="_blank" rel="noopener noreferrer" className="space-y-2 group block">
                    <img 
                      src={theme === 'dark' ? "/assets/MariaDB-Logo-White.svg" : "/assets/MariaDB-Logo-Black.svg"} 
                      alt="MariaDB" 
                      className="h-5 opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" 
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-[9px] text-sleek-muted/60 leading-none group-hover:text-sleek-accent transition-colors">Trademark of MariaDB Foundation</p>
                  </a>
                  <a href="https://obsidian.md" target="_blank" rel="noopener noreferrer" className="space-y-2 group block">
                    <img 
                      src={theme === 'dark' ? "/assets/obsidian-logo-text-white-purple.svg" : "/assets/obsidian-logo-text-black.svg"} 
                      alt="Obsidian" 
                      className="h-3 opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all" 
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-[9px] text-sleek-muted/60 leading-none group-hover:text-sleek-accent transition-colors">Trademark of Dynalist Inc.</p>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-sleek-border flex justify-center items-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-sleek-muted/30">
              VectorSYNC Neural Bridge &bull; TEAM DOPAMINE &bull; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
