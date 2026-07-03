import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Clock,
  Sparkles,
  Building,
  MapPin,
  AlertCircle,
  Search,
  Trash2,
  Copy,
  Check,
  CalendarClock,
  Database,
  Home,
  LayoutGrid,
  LineChart,
  Settings,
  LogOut,
  Bell,
  Moon,
  Sun,
  Plus,
  Info,
  Calendar,
  Wifi,
  Zap,
  Users,
  Heart,
  ChevronDown,
  Edit,
  Trash,
  Image as ImageIcon
} from 'lucide-react';
import { chatWithAgent, getSiteVisits, getVenues, createVenue } from './api';
import type { ChatMessage, SiteVisit, Venue } from './api';

interface ContentBlock {
  type: 'text' | 'code' | 'table';
  content: string;
  language?: string;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your Muzukuru AI assistant. I can help you schedule site visits, query dates and times, or check property availability. How can I assist you today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [isVisitsLoading, setIsVisitsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'chat' | 'venues' | 'add_venue'>('chat');

  // Venues State
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isVenuesLoading, setIsVenuesLoading] = useState(false);

  // Venues Filter State
  const [venuesSearchQuery, setVenuesSearchQuery] = useState('');
  const [showPrivateResidences, setShowPrivateResidences] = useState(false);
  const [showLowCompleteness, setShowLowCompleteness] = useState(false);
  const [selectedVenueType, setSelectedVenueType] = useState('All');

  // Form Wizard State for Adding a Venue
  const [formStep, setFormStep] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingVenue, setIsSubmittingVenue] = useState(false);
  const [newVenue, setNewVenue] = useState({
    name: '',
    venue_type: '',
    capacity: '',
    address_one: '',
    address_two: '',
    suburb: '',
    city: 'Harare',
    notes: '',
    has_power: false,
    power_type: 'zesa',
    power_backup: '',
    internet_service_provider: '',
    wifi_name: '',
    wifi_password: '',
    has_pa_system: false,
    pa_system_provider: '',
    is_private_residence: false
  });

  const calculateCompleteness = () => {
    let score = 20; // base score
    if (newVenue.name.trim()) score += 15;
    if (newVenue.venue_type) score += 10;
    if (newVenue.capacity) score += 5;
    if (newVenue.address_one.trim()) score += 10;
    if (newVenue.suburb.trim()) score += 5;
    if (newVenue.city) score += 5;

    if (newVenue.has_power) score += 10;
    if (newVenue.power_backup) score += 5;

    if (newVenue.internet_service_provider) score += 10;

    if (newVenue.has_pa_system) score += 5;

    return Math.min(100, score);
  };


  const loadSiteVisits = async () => {
    setIsVisitsLoading(true);
    try {
      const data = await getSiteVisits();
      setVisits(data);
    } catch (err) {
      console.error("Failed to load site visits:", err);
    } finally {
      setIsVisitsLoading(false);
    }
  };

  const loadVenues = async () => {
    setIsVenuesLoading(true);
    try {
      const data = await getVenues();
      setVenues(data);
    } catch (err) {
      console.error("Failed to load venues:", err);
    } finally {
      setIsVenuesLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadSiteVisits();
    loadVenues();
  }, []);

  const handleSaveVenue = async () => {
    // Validate
    const errors: Record<string, string> = {};
    if (!newVenue.name.trim()) {
      errors.name = "Venue Title is required";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFormStep(1); // switch to first step where Name is located
      return;
    }

    setFormErrors({});
    setIsSubmittingVenue(true);

    try {
      const completeness = calculateCompleteness();
      const payload = {
        name: newVenue.name.trim(),
        venue_type: newVenue.venue_type || null,
        capacity: newVenue.capacity || null,
        address_one: newVenue.address_one.trim() || null,
        address_two: newVenue.address_two.trim() || null,
        suburb: newVenue.suburb.trim() || null,
        city: newVenue.city || null,
        notes: newVenue.notes.trim() || null,
        has_power: newVenue.has_power,
        power_type: newVenue.power_type || null,
        power_backup: newVenue.power_backup || null,
        internet_service_provider: newVenue.internet_service_provider || null,
        wifi_name: newVenue.wifi_name.trim() || null,
        wifi_password: newVenue.wifi_password.trim() || null,
        has_pa_system: newVenue.has_pa_system,
        pa_system_provider: newVenue.pa_system_provider.trim() || null,
        is_private_residence: newVenue.is_private_residence,
        completeness_score: completeness
      };

      await createVenue(payload);
      
      // Reset form
      setNewVenue({
        name: '',
        venue_type: '',
        capacity: '',
        address_one: '',
        address_two: '',
        suburb: '',
        city: 'Harare',
        notes: '',
        has_power: false,
        power_type: 'zesa',
        power_backup: '',
        internet_service_provider: '',
        wifi_name: '',
        wifi_password: '',
        has_pa_system: false,
        pa_system_provider: '',
        is_private_residence: false
      });
      setFormStep(1);
      
      // Reload venues and return to list
      await loadVenues();
      setActiveTab('venues');
    } catch (err: any) {
      console.error("Failed to save venue:", err);
      alert(`Error saving venue: ${err.message || err.toString()}`);
    } finally {
      setIsSubmittingVenue(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not Scheduled';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const getFriendlyErrorMessage = (rawError: string): string => {
    const errorStr = rawError.toString();

    // Log the original detailed error to console for developers
    console.error("[Developer System Error Detail]:", rawError);

    if (errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("429")) {
      return "The assistant is temporarily busy due to rate limits. Please wait a moment and click 'Retry Connection'.";
    }
    if (errorStr.includes("GEMINI_API_KEY") || errorStr.includes("API key")) {
      return "The Gemini API configuration appears to be missing or invalid. Please check your backend .env settings.";
    }
    if (errorStr.includes("Failed to fetch") || errorStr.includes("NetworkError")) {
      return "Could not connect to the backend server. Please verify the backend API is running and try again.";
    }

    return "An unexpected error occurred while coordinating with the agent. Please try again.";
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: textToSend
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Send message history (matching ChatRequest model of fastapi)
      const data = await chatWithAgent(updatedMessages);

      // Update with the final response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response
      }]);

      // Reload site visits in case the agent scheduled/modified anything
      loadSiteVisits();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.message || err.toString()));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Hello! I'm your Muzukuru AI assistant. I can help you schedule site visits, query dates and times, or check property availability. How can I assist you today?"
      }
    ]);
    setError(null);
  };

  const copyToClipboard = (text: string, blockId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(blockId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to parse message contents into blocks of code, tables, and text
  const parseMessage = (content: string): ContentBlock[] => {
    const parts = content.split('```');
    const blocks: ContentBlock[] = [];

    parts.forEach((part, index) => {
      const isCode = index % 2 === 1;
      if (isCode) {
        // It's a code block
        const lines = part.split('\n');
        const language = lines[0].trim();
        const codeContent = lines.slice(1).join('\n').trim();
        blocks.push({
          type: 'code',
          content: codeContent,
          language: language || 'code'
        });
      } else {
        // Plain text: scan for table rows (lines containing '|')
        const lines = part.split('\n');
        let currentTableLines: string[] = [];
        let inTable = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const hasPipe = line.includes('|');
          const isDashes = line.trim().match(/^[-|\s:+]+$/); // matches dashes or separators like |---|

          if (hasPipe || (inTable && isDashes)) {
            inTable = true;
            currentTableLines.push(line);
          } else {
            if (inTable) {
              if (currentTableLines.length > 0) {
                blocks.push({
                  type: 'table',
                  content: currentTableLines.join('\n')
                });
              }
              currentTableLines = [];
              inTable = false;
            }

            // Append line to current text block if it is consecutive
            if (blocks.length > 0 && blocks[blocks.length - 1].type === 'text') {
              blocks[blocks.length - 1].content += '\n' + line;
            } else {
              blocks.push({
                type: 'text',
                content: line
              });
            }
          }
        }

        if (inTable && currentTableLines.length > 0) {
          blocks.push({
            type: 'table',
            content: currentTableLines.join('\n')
          });
        }
      }
    });

    return blocks;
  };

  const renderTable = (tableText: string) => {
    const lines = tableText.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) return <pre>{tableText}</pre>;

    // Check if second line is a table separator
    const hasSeparator = lines[1].trim().match(/^[-|\s:+]+$/);
    const headerLine = lines[0];
    const dataLines = hasSeparator ? lines.slice(2) : lines.slice(1);

    const parseCells = (line: string) => {
      const cells = line.split('|');
      // Remove empty cells resulting from outer pipes (e.g. | a | b |)
      if (line.trim().startsWith('|')) cells.shift();
      if (line.trim().endsWith('|')) cells.pop();
      return cells.map(c => c.trim());
    };

    const headers = parseCells(headerLine);
    const rows = dataLines.map(line => parseCells(line));

    return (
      <div className="table-container">
        <table className="message-table">
          <thead>
            <tr>
              {headers.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTextLine = (line: string, lineIdx: number) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={lineIdx} style={{ height: '0.5rem' }} />;

    const isListItem = trimmed.startsWith('-') || trimmed.startsWith('*') || !!trimmed.match(/^\d+\./);

    let displayLine = line;
    let listIcon = null;

    if (isListItem) {
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        displayLine = trimmed.substring(1).trim();
      } else {
        const match = trimmed.match(/^(\d+\.)\s*(.*)/);
        if (match) {
          displayLine = match[2];
          listIcon = <span style={{ fontWeight: 600, color: 'var(--color-primary)', marginRight: '0.4rem' }}>{match[1]}</span>;
        }
      }
    }

    const parseInline = (text: string): React.ReactNode[] => {
      const boldParts = text.split('**');
      return boldParts.flatMap((boldPart, bIdx) => {
        const isBold = bIdx % 2 === 1;
        const codeParts = boldPart.split('`');
        const nodes = codeParts.map((codePart, cIdx) => {
          const isCode = cIdx % 2 === 1;
          if (isCode) {
            return <code key={`${bIdx}-${cIdx}`}>{codePart}</code>;
          }
          return codePart;
        });

        if (isBold) {
          return <strong key={bIdx}>{nodes}</strong>;
        }
        return nodes;
      });
    };

    if (isListItem) {
      return (
        <li key={lineIdx} style={{ listStyleType: 'none', display: 'flex', alignItems: 'flex-start', marginLeft: '0.5rem', marginBottom: '0.4rem' }}>
          {!listIcon && <span style={{ color: 'var(--color-primary)', marginRight: '0.5rem', userSelect: 'none' }}>•</span>}
          {listIcon}
          <span style={{ flex: 1 }}>{parseInline(displayLine)}</span>
        </li>
      );
    }

    return (
      <p key={lineIdx} style={{ marginBottom: '0.6rem' }}>
        {parseInline(line)}
      </p>
    );
  };

  const renderMessageContent = (content: string, msgIndex: number) => {
    const blocks = parseMessage(content);
    return blocks.map((block, idx) => {
      const uniqueId = `msg-${msgIndex}-block-${idx}`;
      if (block.type === 'code') {
        const isCopied = copiedId === uniqueId;
        return (
          <div key={uniqueId} className="code-block-wrapper">
            <div className="code-block-header">
              <span>{block.language || 'code'}</span>
              <button
                onClick={() => copyToClipboard(block.content, uniqueId)}
                className="copy-code-btn"
              >
                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre><code>{block.content}</code></pre>
          </div>
        );
      } else if (block.type === 'table') {
        return <div key={uniqueId}>{renderTable(block.content)}</div>;
      } else {
        const lines = block.content.split('\n');
        return (
          <div key={uniqueId}>
            {lines.map((line, lIdx) => renderTextLine(line, lIdx))}
          </div>
        );
      }
    });
  };

  // Venue UI Helper functions
  const getVenueImage = (venue: Venue) => {
    const name = venue.name.toLowerCase();
    if (name.includes('abiding hope')) {
      return '/abiding_hope.png';
    }
    if (name.includes('all souls')) {
      return '/all_souls.png';
    }
    if (name.includes('alo alo')) {
      return '/alo_alo.png';
    }
    
    // Default mock images based on type or ID
    const type = (venue.venue_type || '').toLowerCase();
    if (type.includes('church')) return '/all_souls.png';
    if (type.includes('hall') || type.includes('restaurant')) return '/alo_alo.png';
    
    // Fallback/No Image
    return null; 
  };

  const getCompletenessDetails = (score: number) => {
    if (score >= 70) {
      return { color: '#2e7d32', label: 'Good', bg: '#e8f5e9' }; // Green
    }
    if (score >= 60) {
      return { color: '#ef6c00', label: 'Good', bg: '#fff3e0' }; // Orange
    }
    return { color: '#c62828', label: 'Fair', bg: '#ffebee' }; // Red
  };

  // Venues client-side filtering logic
  const filteredVenues = venues.filter(venue => {
    // 1. Text search (name, address, type)
    const text = venuesSearchQuery.toLowerCase().trim();
    if (text) {
      const matchName = (venue.name || '').toLowerCase().includes(text);
      const matchAddress = (venue.address_one || '').toLowerCase().includes(text) || (venue.address_two || '').toLowerCase().includes(text) || (venue.suburb || '').toLowerCase().includes(text) || (venue.city || '').toLowerCase().includes(text);
      const matchType = (venue.venue_type || '').toLowerCase().includes(text);
      if (!matchName && !matchAddress && !matchType) return false;
    }

    // 2. Private residence filter
    // If showPrivateResidences is true, we show ONLY private residences.
    // If showPrivateResidences is false, we show ONLY non-private residences.
    if (showPrivateResidences !== venue.is_private_residence) {
      return false;
    }

    // 3. Completeness score filter
    if (showLowCompleteness && venue.completeness_score >= 50) {
      return false;
    }

    // 4. Dropdown venue type filter
    if (selectedVenueType !== 'All') {
      if ((venue.venue_type || '').toLowerCase() !== selectedVenueType.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  // Real-time visit filter logic
  const filteredVisits = visits.filter(visit => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (visit.notes?.toLowerCase() || '').includes(q) ||
      (visit.venue_name?.toLowerCase() || '').includes(q) ||
      (visit.venue_address?.toLowerCase() || '').includes(q) ||
      (visit.status?.toLowerCase() || '').includes(q)
    );
  });

  const getStatusColors = (status: string = '') => {
    const lower = status.toLowerCase();
    if (lower === 'scheduled' || lower === 'active') {
      return {
        color: 'var(--color-success)',
        bg: 'var(--color-success-glow)'
      };
    }
    if (lower === 'completed') {
      return {
        color: 'var(--color-primary)',
        bg: 'var(--color-primary-glow)'
      };
    }
    return {
      color: 'var(--color-warning)',
      bg: 'rgba(245, 158, 11, 0.1)'
    };
  };

  return (
    <div className="app-layout">
      {/* NARROW SIDEBAR */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <Building size={20} />
        </div>

        <div className="sidebar-nav">
          <button
            onClick={() => setActiveTab('chat')}
            className={`sidebar-btn ${activeTab === 'chat' ? 'active' : ''}`}
            title="Chat & Site Visits"
          >
            <Home size={20} />
          </button>

          <button
            onClick={() => setActiveTab('venues')}
            className={`sidebar-btn ${activeTab === 'venues' || activeTab === 'add_venue' ? 'active' : ''}`}
            title="Venues Dashboard"
          >
            <LayoutGrid size={20} />
          </button>

          <button className="sidebar-btn" disabled title="Metrics (Disabled)">
            <LineChart size={20} />
          </button>

          <button className="sidebar-btn" disabled title="Properties (Disabled)">
            <Building size={20} />
          </button>
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-btn" disabled title="Settings (Disabled)">
            <Settings size={20} />
          </button>
          <button className="sidebar-btn" disabled title="Logout (Disabled)">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'chat' ? (
          <div className="app-container" style={{ display: 'flex', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
            {/* LEFT PANEL: Overview Dashboard */}
            <aside className="dashboard-panel">
              <div className="brand-section">
                <div className="brand-logo">
                  <Building size={20} />
                </div>
                <h1 className="brand-title">Muzukuru AI</h1>
                <div className="connection-status">
                  <span className="status-dot-small"></span>
                  <span>Online</span>
                </div>
              </div>

              {/* Dynamic Search Bar */}
              <div className="search-wrapper">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search visits by property, note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Scheduled Visits */}
              <div className="schedule-section">
                <div className="schedule-header">
                  <div className="schedule-title">
                    <CalendarClock size={15} />
                    <span>Active Schedule</span>
                  </div>
                  <span className="schedule-count">
                    {filteredVisits.length} {searchQuery && `of ${visits.length}`}
                  </span>
                </div>

                <div className="visits-list">
                  {isVisitsLoading && visits.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Loading site visits...
                    </div>
                  ) : filteredVisits.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {searchQuery ? 'No matching visits found.' : 'No active site visits found.'}
                    </div>
                  ) : (
                    filteredVisits.map(visit => {
                      const colors = getStatusColors(visit.status);
                      return (
                        <div
                          key={visit.id}
                          className="visit-card"
                          style={{
                            '--status-color': colors.color,
                            '--status-bg-glow': colors.bg
                          } as React.CSSProperties}
                        >
                          <div className="visit-card-header">
                            <div className="visit-card-title">
                              {visit.notes || `Visit at ${visit.venue_name}`}
                            </div>
                            <span className="visit-status-badge">
                              {visit.status}
                            </span>
                          </div>

                          <div className="visit-details">
                            <div className="visit-detail-item">
                              <Building size={12} />
                              <span>{visit.venue_name}</span>
                            </div>
                            <div className="visit-detail-item">
                              <Clock size={12} />
                              <span>{formatDate(visit.scheduled_date_time)}</span>
                            </div>
                            {visit.venue_address && (
                              <div className="visit-detail-item">
                                <MapPin size={12} />
                                <span>{visit.venue_address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>

            {/* RIGHT PANEL: Chat Workspace */}
            <main className="chat-panel">
              <header className="chat-header">
                <div className="agent-identity">
                  <div className="agent-avatar">
                    <Sparkles size={18} />
                    <span className="agent-status-ring"></span>
                  </div>
                  <div>
                    <div className="agent-title">Muzukuru AI Assistant</div>
                    <div className="agent-subtitle">
                      <Database size={11} />
                      <span>Connected to muzukurudb</span>
                    </div>
                  </div>
                </div>

                <button onClick={handleClearChat} className="clear-btn">
                  <Trash2 size={13} />
                  <span>Clear Chat</span>
                </button>
              </header>

              {/* Message scroll list */}
              <div className="messages-container">
                {messages.map((msg, index) => (
                  <div key={index} className={`message-row ${msg.role}`}>
                    <div className="message-bubble">
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.72rem',
                        color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                        marginBottom: '0.5rem',
                        fontWeight: 600
                      }}>
                        {msg.role === 'user' ? <User size={11} /> : <Bot size={11} />}
                        <span>{msg.role === 'user' ? 'You' : 'Muzukuru AI'}</span>
                      </div>

                      <div className="message-body">
                        {renderMessageContent(msg.content, index)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                  <div className="message-row assistant">
                    <div className="message-bubble typing-bubble">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="message-row assistant">
                    <div className="message-bubble" style={{ border: '1px solid var(--color-error)', background: 'rgba(239, 68, 68, 0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-error)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <AlertCircle size={14} />
                        <span>Connection Error</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{error}</p>
                      <button
                        onClick={() => {
                          if (messages.length > 0) {
                            const userMsgs = messages.filter(m => m.role === 'user');
                            if (userMsgs.length > 0) {
                              handleSend(userMsgs[userMsgs.length - 1].content);
                            }
                          }
                        }}
                        style={{
                          marginTop: '0.5rem',
                          background: 'var(--color-error)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggestion Chips */}
              <div className="suggestions-container">
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Show me all the data in site visits")}
                  disabled={isLoading}
                >
                  Show all site visits
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("List the venues in our database")}
                  disabled={isLoading}
                >
                  List all venues
                </button>
                <button
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick("Schedule a new site visit for venue 3 on July 10 at 2:00 PM")}
                  disabled={isLoading}
                >
                  Schedule a visit
                </button>
              </div>

              {/* Chat input box */}
              <div className="chat-input-area">
                <form onSubmit={handleSubmit} className="input-wrapper">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask the AI coordinator about property visits..."
                    className="chat-input"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    className="send-button"
                    disabled={isLoading || !input.trim()}
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </main>
          </div>
        ) : (
          <div className="venues-dashboard">
            {/* VENUES HEADER */}
            <header className="venues-header">
              <div className="venues-title-section">
                <h1>Venues</h1>
                <span className="venues-breadcrumb">Venues</span>
              </div>

              <div className="venues-header-center">
                <button className="header-home-btn" onClick={() => setActiveTab('chat')} title="Go to Chat">
                  <Home size={16} />
                </button>

                <div className="header-dropdown-wrapper">
                  <select
                    className="header-dropdown"
                    value={selectedVenueType}
                    onChange={(e) => setSelectedVenueType(e.target.value)}
                  >
                    <option value="All">All Types</option>
                    <option value="church">Church</option>
                    <option value="hall">Hall</option>
                    <option value="Funeral Parlour">Funeral Parlour</option>
                    <option value="tent">Tent</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown size={14} className="header-dropdown-icon" />
                </div>

                <div className="header-search-wrapper">
                  <input
                    type="text"
                    className="header-search-input"
                    placeholder="Search bookings, stream setups..."
                    value={venuesSearchQuery}
                    onChange={(e) => setVenuesSearchQuery(e.target.value)}
                  />
                  <Search size={14} className="header-search-icon" />
                </div>
              </div>

              <div className="venues-header-right">
                <button className="header-icon-btn" disabled>
                  <LayoutGrid size={16} />
                </button>
                <button className="header-icon-btn">
                  <Bell size={16} />
                  <span className="notification-badge">4</span>
                </button>
                <button className="header-icon-btn">
                  <Moon size={16} />
                </button>
                <div className="profile-capsule">
                  <div className="profile-avatar-circle">C</div>
                  <span>clyde@muzukuru.com</span>
                </div>
              </div>
            </header>

            {/* SUBHEADER FILTER BAR */}
            <div className="venues-filter-bar">
              <div className="filter-checkbox-group">
                <label className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={showPrivateResidences}
                    onChange={(e) => setShowPrivateResidences(e.target.checked)}
                  />
                  <span>Private Residences</span>
                </label>
                <label className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={showLowCompleteness}
                    onChange={(e) => setShowLowCompleteness(e.target.checked)}
                  />
                  <span>Completeness score &lt; 50</span>
                </label>
              </div>

              <div className="filter-search-wrapper">
                <Search size={14} className="filter-search-icon" />
                <input
                  type="text"
                  className="filter-search-input"
                  placeholder="Search by venue name, type, or address..."
                  value={venuesSearchQuery}
                  onChange={(e) => setVenuesSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-actions">
                <button className="btn-allocate" disabled>ALLOCATE SITE VISIT</button>
                <button className="btn-add-venue" onClick={() => {
                  setFormStep(1);
                  setFormErrors({});
                  setActiveTab('add_venue');
                }}>
                  <Plus size={14} />
                  <span>ADD VENUE</span>
                </button>
              </div>
            </div>

            {/* VENUES GRID SCROLL AREA */}
            <div className="venues-scroll-area">
              {isVenuesLoading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading venues from database...
                </div>
              ) : filteredVenues.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No matching venues found in the database.
                </div>
              ) : (
                <div className="venues-grid">
                  {filteredVenues.map(venue => {
                    const completeness = getCompletenessDetails(venue.completeness_score);
                    const imageSrc = getVenueImage(venue);
                    const strokeWidth = 3;
                    const radius = 18;
                    const circumference = radius * 2 * Math.PI;
                    const strokeDashoffset = circumference - (venue.completeness_score / 100) * circumference;

                    return (
                      <div className="venue-card-new" key={venue.id}>
                        {/* Media Section */}
                        <div className="venue-card-media">
                          {imageSrc ? (
                            <img src={imageSrc} alt={venue.name} className="venue-card-img" />
                          ) : (
                            <div style={{
                              height: '100%',
                              backgroundColor: '#eae3db',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#7a685e',
                              fontSize: '0.85rem',
                              gap: '0.5rem'
                            }}>
                              <ImageIcon size={32} strokeWidth={1.2} />
                              <span>No Image</span>
                            </div>
                          )}

                          {/* Completeness Badge Overlay */}
                          <div className="completeness-badge-overlay">
                            <svg width="24" height="24" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                              <circle
                                cx="20"
                                cy="20"
                                r={radius}
                                fill="transparent"
                                stroke="#e0e0e0"
                                strokeWidth={strokeWidth}
                              />
                              <circle
                                cx="20"
                                cy="20"
                                r={radius}
                                fill="transparent"
                                stroke={completeness.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="completeness-text-group">
                              <span className="completeness-percent">{venue.completeness_score}%</span>
                              <span className="completeness-label">{completeness.label}</span>
                            </div>
                          </div>

                          {/* Media Actions Overlay */}
                          <div className="media-actions-overlay">
                            <button className="media-action-circle-btn"><Edit size={12} /></button>
                            <button className="media-action-circle-btn"><Trash size={12} /></button>
                            <button className="media-action-circle-btn"><ImageIcon size={12} /></button>
                          </div>
                        </div>

                        {/* Details Section */}
                        <div className="venue-card-body">
                          <h2 className="venue-card-title-new">{venue.name}</h2>
                          <div className="venue-card-address-new">
                            <MapPin size={12} />
                            <span>{venue.address_one || venue.city || 'Address not specified'}</span>
                          </div>

                          <div className="venue-card-specs">
                            <div className="spec-item">
                              <Home size={12} />
                              <span>{venue.venue_type || 'Type not specified'}</span>
                            </div>
                            <div className="spec-item">
                              <Users size={12} />
                              <span>{venue.capacity ? `${venue.capacity}` : 'Not Available'}</span>
                            </div>
                            <div className="spec-item">
                              <Zap size={12} />
                              <span>{venue.has_power ? (venue.power_backup || venue.power_type || 'Power Active') : 'No power'}</span>
                            </div>
                            <div className="spec-item">
                              <Wifi size={12} />
                              <span>{venue.internet_service_provider || 'No internet'}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="venue-card-foot-btns">
                            <button className="btn-card-plan">
                              <Calendar size={12} />
                              <span>Plan</span>
                            </button>
                            <button className="btn-card-map-pin">
                              <MapPin size={14} />
                            </button>
                            <button className="btn-card-details">
                              <Info size={12} />
                              <span>Details</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'add_venue' && (
          <div className="venues-dashboard" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
            {/* HEADER */}
            <header className="venues-header">
              <div className="venues-title-section">
                <h1>Add</h1>
                <span className="venues-breadcrumb">Venues / Add</span>
              </div>

              <div className="venues-header-center">
                <button className="header-home-btn" onClick={() => setActiveTab('chat')} title="Go to Chat">
                  <Home size={16} />
                </button>

                <div className="header-dropdown-wrapper">
                  <select className="header-dropdown" disabled>
                    <option>All</option>
                  </select>
                  <ChevronDown size={14} className="header-dropdown-icon" />
                </div>

                <div className="header-search-wrapper">
                  <input type="text" className="header-search-input" placeholder="Search bookings, stream setups..." disabled />
                  <Search size={14} className="header-search-icon" />
                </div>
              </div>

              <div className="venues-header-right">
                <button className="header-icon-btn" disabled><LayoutGrid size={16} /></button>
                <button className="header-icon-btn" disabled><Bell size={16} /><span className="notification-badge">4</span></button>
                <button className="header-icon-btn" disabled><Moon size={16} /></button>
                <div className="profile-capsule">
                  <div className="profile-avatar-circle">C</div>
                  <span>clyde@muzukuru.com</span>
                </div>
              </div>
            </header>

            {/* TWO COLUMN CONTENT */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* LEFT COLUMN: WIZARD FORM (2/3 width) */}
              <div style={{ flex: 2, padding: '2rem', overflowY: 'auto', borderRight: '1px solid var(--border-light)' }}>
                {/* Stepper Card */}
                <div className="form-wizard-card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 4px 15px rgba(92,62,48,0.08)' }}>
                  {/* Stepper Header Banner */}
                  <div className="stepper-header-banner" style={{
                    background: 'linear-gradient(135deg, #5c3e30, #8c6239)',
                    padding: '1.5rem',
                    position: 'relative'
                  }}>
                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <button
                        onClick={handleSaveVenue}
                        disabled={isSubmittingVenue}
                        className="btn-add-venue"
                        style={{ background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-light)' }}
                      >
                        {isSubmittingVenue ? 'Saving...' : 'Save Venue'}
                      </button>
                      
                      <button
                        onClick={() => setActiveTab('venues')}
                        style={{
                          background: 'transparent',
                          color: '#faf8f5',
                          border: '1px solid rgba(250, 248, 245, 0.3)',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Step Indicators */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                      {/* Connecting Line */}
                      <div style={{ position: 'absolute', top: '15px', left: '5%', right: '5%', height: '2px', background: 'rgba(250, 248, 245, 0.2)', zIndex: -1 }}></div>
                      
                      {[
                        { step: 1, label: 'Venue Essentials' },
                        { step: 2, label: 'Power' },
                        { step: 3, label: 'Internet & Network' },
                        { step: 4, label: 'PA Systems' },
                        { step: 5, label: 'Rooms' },
                        { step: 6, label: 'Contacts' }
                      ].map((item) => (
                        <div
                          key={item.step}
                          onClick={() => setFormStep(item.step)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flex: 1,
                            cursor: 'pointer',
                            opacity: formStep === item.step ? 1 : 0.6
                          }}
                        >
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: formStep === item.step ? 'var(--color-secondary)' : '#faf8f5',
                            color: formStep === item.step ? '#ffffff' : 'var(--text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            border: '2px solid rgba(250, 248, 245, 0.8)',
                            boxShadow: formStep === item.step ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                            transition: 'all 0.2s ease'
                          }}>
                            {item.step}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#faf8f5', marginTop: '0.4rem', fontWeight: 600, textAlign: 'center' }}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Form Step Content */}
                  <div style={{ padding: '2rem' }}>
                    {/* STEP 1: Venue Essentials */}
                    {formStep === 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Venue Name <span style={{ color: 'red' }}>*</span></label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g. Arundel School Chapel"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: formErrors.name ? '1px solid red' : '1px solid var(--border-light)' }}
                              value={newVenue.name}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, name: e.target.value }))}
                            />
                            {formErrors.name && <span style={{ color: 'red', fontSize: '0.7rem', fontWeight: 500 }}>{formErrors.name}</span>}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Venue Type</label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                              value={newVenue.venue_type}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, venue_type: e.target.value }))}
                            >
                              <option value="">Select type...</option>
                              <option value="church">Church</option>
                              <option value="hall">Hall</option>
                              <option value="Funeral Parlour">Funeral Parlour</option>
                              <option value="tent">Tent</option>
                              <option value="other">Other</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Venue Capacity</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g. 250"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
                              value={newVenue.capacity}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, capacity: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Address One</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g address one"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
                              value={newVenue.address_one}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, address_one: e.target.value }))}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Address Two</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g address two"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
                              value={newVenue.address_two}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, address_two: e.target.value }))}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Suburb</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g Mount Pleasant"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
                              value={newVenue.suburb}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, suburb: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>City</label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                              value={newVenue.city}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, city: e.target.value }))}
                            >
                              <option value="Harare">Harare</option>
                              <option value="Bulawayo">Bulawayo</option>
                              <option value="Gweru">Gweru</option>
                              <option value="Mutare">Mutare</option>
                              <option value="Masvingo">Masvingo</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.5rem' }}>
                            <label className="filter-checkbox-label">
                              <input
                                type="checkbox"
                                checked={newVenue.is_private_residence}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, is_private_residence: e.target.checked }))}
                              />
                              <span>This venue is a Private Residence</span>
                            </label>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Notes</label>
                          <textarea
                            placeholder="Any additional notes about the venue..."
                            rows={4}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontFamily: 'var(--font-sans)', outline: 'none', fontSize: '0.85rem' }}
                            value={newVenue.notes}
                            onChange={(e) => setNewVenue(prev => ({ ...prev, notes: e.target.value }))}
                          ></textarea>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Power */}
                    {formStep === 2 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <label className="filter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={newVenue.has_power}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, has_power: e.target.checked }))}
                            />
                            <span>Venue has Grid Power active</span>
                          </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Power Connection Type</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g. zesa / grid / single-phase"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
                              value={newVenue.power_type}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, power_type: e.target.value }))}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Power Backup Option</label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                              value={newVenue.power_backup}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, power_backup: e.target.value }))}
                            >
                              <option value="">No backup power</option>
                              <option value="Generator">Generator</option>
                              <option value="Solar">Solar</option>
                              <option value="UPS">UPS</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Internet & Network */}
                    {formStep === 3 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Internet Service Provider (ISP)</label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                              value={newVenue.internet_service_provider}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, internet_service_provider: e.target.value }))}
                            >
                              <option value="">None / No Internet Available</option>
                              <option value="Starlink">Starlink</option>
                              <option value="Zol (Liquid Home)">Zol (Liquid Home)</option>
                              <option value="Econet">Econet</option>
                              <option value="TelOne">TelOne</option>
                              <option value="Telco">Telco</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Wifi Network Name (SSID)</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g. Venue_Guest_Wifi"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
                              value={newVenue.wifi_name}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, wifi_name: e.target.value }))}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Wifi Password</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="Password"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
                              value={newVenue.wifi_password}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, wifi_password: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: PA Systems */}
                    {formStep === 4 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <label className="filter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={newVenue.has_pa_system}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, has_pa_system: e.target.checked }))}
                            />
                            <span>Venue has built-in PA System</span>
                          </label>
                        </div>

                        {newVenue.has_pa_system && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>PA System Brand / Provider Details</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g. Yamaha, JBL, Custom provider"
                              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
                              value={newVenue.pa_system_provider}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, pa_system_provider: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 5: Rooms */}
                    {formStep === 5 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '2rem 0' }}>
                        <Building size={48} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }}>Rooms & Layout Options</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '300px' }}>
                          Specify room setup details or floor plans. This can also be handled via general notes on Step 1.
                        </p>
                      </div>
                    )}

                    {/* STEP 6: Contacts */}
                    {formStep === 6 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '2rem 0' }}>
                        <Users size={48} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }}>Venue Contact Details</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '300px' }}>
                          Add primary contacts, phone numbers, or email addresses in the essentials notes for reference.
                        </p>
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
                      <button
                        onClick={() => setFormStep(prev => Math.max(1, prev - 1))}
                        disabled={formStep === 1}
                        style={{
                          background: 'transparent',
                          color: formStep === 1 ? 'rgba(0,0,0,0.2)' : 'var(--text-main)',
                          border: '1px solid var(--border-light)',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: formStep === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Back
                      </button>

                      {formStep < 6 ? (
                        <button
                          onClick={() => setFormStep(prev => Math.min(6, prev + 1))}
                          className="btn-add-venue"
                          style={{ padding: '0.5rem 1.25rem' }}
                        >
                          Next
                        </button>
                      ) : (
                        <button
                          onClick={handleSaveVenue}
                          disabled={isSubmittingVenue}
                          className="btn-add-venue"
                          style={{ padding: '0.5rem 1.25rem' }}
                        >
                          {isSubmittingVenue ? 'Saving...' : 'Save Venue'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: SUMMARY SIDEBAR (1/3 width) */}
              <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(250,248,245,0.4)', overflowY: 'auto' }}>
                {/* Completeness Card */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(92,62,48,0.06)' }}>
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>Completeness score</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quality check status</span>
                  </div>
                  <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                    <svg width="56" height="56" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="20" cy="20" r="16" fill="transparent" stroke="#e0e0e0" strokeWidth="3" />
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        fill="transparent"
                        stroke={getCompletenessDetails(calculateCompleteness()).color}
                        strokeWidth="3"
                        strokeDasharray={2 * Math.PI * 16}
                        strokeDashoffset={2 * Math.PI * 16 - (calculateCompleteness() / 100) * (2 * Math.PI * 16)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                      {calculateCompleteness()}%
                    </div>
                  </div>
                </div>

                {/* Form Progress Summary Details */}
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '1.5rem', flex: 1, boxShadow: '0 4px 12px rgba(92,62,48,0.06)' }}>
                  <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                    VENUE ESSENTIALS
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Name:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' }}>{newVenue.name || <i style={{ opacity: 0.5 }}>Not specified</i>}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Type:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{newVenue.venue_type || 'Type not selected'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Capacity:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{newVenue.capacity || 'Not specified'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Address:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' }}>
                        {newVenue.address_one ? `${newVenue.address_one}, ${newVenue.city}` : `${newVenue.city}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Power status:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        {newVenue.has_power ? `${newVenue.power_backup || 'Grid'}` : 'No power backup info'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Internet status:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        {newVenue.internet_service_provider || 'No internet info'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>PA System:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        {newVenue.has_pa_system ? `${newVenue.pa_system_provider || 'Built-in'}` : 'No PA Info'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
