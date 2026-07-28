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
  Settings,
  LogOut,
  Bell,
  Moon,
  Plus,
  Info,
  Calendar,
  Wifi,
  Zap,
  Users,
  ChevronDown,
  Edit,
  Trash,
  Image as ImageIcon,
  MessageSquare,
  Phone,
  Mail,
  ChevronRight,
  Upload,
  Eye,
  Volume2
} from 'lucide-react';
import {
  chatWithAgent,
  getSiteVisits,
  getVenues,
  createVenue,
  createSiteVisit,
  fetchVenueContacts,
  fetchVenueLayouts,
  fetchVenueDocuments,
  fetchVenueBookings,
  createVenueContact,
  getAllContacts
} from './api';
import type {
  ChatMessage,
  SiteVisit,
  Venue,
  VenueContact,
  VenueLayout,
  VenueDocument,
  VenueBooking
} from './api';

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
  const [activeTab, setActiveTab] = useState<'chat' | 'venues' | 'add_venue' | 'add_booking' | 'venue_details'>('chat');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [venueDetailsTab, setVenueDetailsTab] = useState<'general' | 'rooms' | 'floor_plans' | 'gallery' | 'bookings' | 'contacts'>('general');

  // Form State for Adding a Booking
  const [bookingVenueId, setBookingVenueId] = useState<string>('');
  const [bookingVenueSearchQuery, setBookingVenueSearchQuery] = useState<string>('');
  const [isBookingVenueDropdownOpen, setIsBookingVenueDropdownOpen] = useState<boolean>(false);
  const [focusedVenueIndex, setFocusedVenueIndex] = useState<number>(-1);
  const [bookingVenueContacts, setBookingVenueContacts] = useState<VenueContact[]>([]);
  const [selectedBookingContactId, setSelectedBookingContactId] = useState<string>('');
  const [isLoadingBookingContacts, setIsLoadingBookingContacts] = useState<boolean>(false);
  const [bookingDateTime, setBookingDateTime] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [bookingStatus, setBookingStatus] = useState<string>('scheduled');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState<boolean>(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingFormError, setBookingFormError] = useState<string | null>(null);

  // Mobile Chat sub-tab toggle (Chat vs Active Schedule)
  const [mobileChatSubTab, setMobileChatSubTab] = useState<'chat' | 'visits'>('chat');

  // Venues State
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isVenuesLoading, setIsVenuesLoading] = useState(false);

  // Venues Filter State
  const [venuesSearchQuery, setVenuesSearchQuery] = useState('');
  const [showPrivateResidences, setShowPrivateResidences] = useState(false);
  const [showLowCompleteness, setShowLowCompleteness] = useState(false);
  const [selectedVenueType, setSelectedVenueType] = useState('All');

  // Form Wizard State for Adding a Venue
  const [allDbContacts, setAllDbContacts] = useState<VenueContact[]>([]);
  const [formStep, setFormStep] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingVenue, setIsSubmittingVenue] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const [newVenue, setNewVenue] = useState({
    name: '',
    venue_type: '',
    capacity: '',
    address_one: '',
    address_two: '',
    suburb: '',
    city: 'Harare',
    notes: '',
    website: '',
    facebook: '',
    instagram: '',
    has_power: true,
    power_type: '',
    power_outage_rate: '',
    power_backup: '',
    power_socket_type: 'Square',
    power_distance_from_livestream_desk: '0',
    internet_service_provider: '',
    wifi_name: '',
    wifi_password: '',
    internet_upload_speed: '',
    router_accessibility: true,
    router_distance_from_livestream: '0',
    has_pa_system: true,
    pa_system_distance_from_livestream: '0',
    pa_system_provider: '',
    other_pa_system_providers: '',
    pa_system_contact_phone: '',
    pa_system_contact_email: '',
    is_private_residence: false,
    contacts: [
      { contact_id: '', mode: 'search' as 'search' | 'selected' | 'manual', searchQuery: '', isOpen: false, first_name: '', last_name: '', email: '', phone: '', role: 'Venue Coordinator' }
    ],
    layouts: [] as Array<{ layout_type: string; capacity: string }>
  });

  const loadDbContacts = async () => {
    try {
      const data = await getAllContacts();
      setAllDbContacts(data);
    } catch (err) {
      console.error("Failed to load DB contacts:", err);
    }
  };

  useEffect(() => {
    loadDbContacts();
  }, []);

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

    const validContact = newVenue.contacts.some(c => c.contact_id || c.first_name.trim() || c.phone.trim());
    if (validContact) score += 10;

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

  // Fetch contacts for the venue selected in the booking form
  useEffect(() => {
    if (bookingVenueId) {
      setIsLoadingBookingContacts(true);
      fetchVenueContacts(bookingVenueId)
        .then(contacts => {
          setBookingVenueContacts(contacts);
          if (contacts.length > 0) {
            setSelectedBookingContactId(String(contacts[0].id));
          } else {
            setSelectedBookingContactId('');
          }
        })
        .catch(err => {
          console.error("Failed to load booking venue contacts:", err);
          setBookingVenueContacts([]);
          setSelectedBookingContactId('');
        })
        .finally(() => {
          setIsLoadingBookingContacts(false);
        });
    } else {
      setBookingVenueContacts([]);
      setSelectedBookingContactId('');
    }
  }, [bookingVenueId]);

  // Venue child data states from Neon DB
  const [venueContacts, setVenueContacts] = useState<VenueContact[]>([]);
  const [venueLayouts, setVenueLayouts] = useState<VenueLayout[]>([]);
  const [venueDocuments, setVenueDocuments] = useState<VenueDocument[]>([]);
  const [venueBookings, setVenueBookings] = useState<VenueBooking[]>([]);
  const [isLoadingChildData, setIsLoadingChildData] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactData, setNewContactData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'Venue Coordinator'
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  // Fetch venue details child data from Neon DB when selected venue changes
  useEffect(() => {
    if (selectedVenueId) {
      setIsLoadingChildData(true);
      Promise.all([
        fetchVenueContacts(selectedVenueId).catch(() => []),
        fetchVenueLayouts(selectedVenueId).catch(() => []),
        fetchVenueDocuments(selectedVenueId).catch(() => []),
        fetchVenueBookings(selectedVenueId).catch(() => [])
      ]).then(([contacts, layouts, docs, bookings]) => {
        setVenueContacts(contacts);
        setVenueLayouts(layouts);
        setVenueDocuments(docs);
        setVenueBookings(bookings);
      }).finally(() => {
        setIsLoadingChildData(false);
      });
    }
  }, [selectedVenueId]);

  const handleAddContact = async () => {
    const venueIdToUse = activeTab === 'add_booking' ? bookingVenueId : selectedVenueId;
    if (!venueIdToUse || !newContactData.first_name.trim()) return;
    setIsSubmittingContact(true);
    try {
      const created = await createVenueContact(venueIdToUse, newContactData);
      if (activeTab === 'add_booking') {
        setBookingVenueContacts(prev => {
          const updated = [...prev, created];
          // Auto select this contact if it was the only one
          if (updated.length === 1) {
            setSelectedBookingContactId(String(created.id));
          }
          return updated;
        });
      } else {
        setVenueContacts(prev => [...prev, created]);
      }
      setShowAddContactModal(false);
      setNewContactData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: 'Venue Coordinator'
      });
    } catch (err: any) {
      alert(`Failed to add contact to DB: ${err.message || err.toString()}`);
    } finally {
      setIsSubmittingContact(false);
    }
  };


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
      const validContacts = newVenue.contacts
        .filter(c => c.contact_id || c.first_name.trim() || c.phone.trim())
        .map(c => ({
          contact_id: c.contact_id ? parseInt(String(c.contact_id), 10) : undefined,
          first_name: c.first_name.trim() || undefined,
          last_name: c.last_name.trim() || undefined,
          phone: c.phone.trim() || undefined,
          email: c.email.trim() || undefined,
          role: c.role.trim() || 'Venue Contact'
        }));

      const validLayouts = newVenue.layouts
        .filter(l => l.layout_type.trim())
        .map(l => ({
          layout_type: l.layout_type.trim(),
          capacity: l.capacity.trim() || undefined
        }));

      const payload = {
        name: newVenue.name.trim(),
        venue_type: newVenue.venue_type || null,
        capacity: newVenue.capacity || null,
        address_one: newVenue.address_one.trim() || null,
        address_two: newVenue.address_two.trim() || null,
        suburb: newVenue.suburb.trim() || null,
        city: newVenue.city || null,
        notes: newVenue.notes.trim() || null,
        website: newVenue.website.trim() || null,
        facebook: newVenue.facebook.trim() || null,
        instagram: newVenue.instagram.trim() || null,
        has_power: newVenue.has_power,
        power_type: newVenue.power_type || null,
        power_outage_rate: newVenue.power_outage_rate || null,
        power_socket_type: newVenue.power_socket_type || null,
        power_backup: newVenue.power_backup || null,
        power_distance_from_livestream_desk: newVenue.power_distance_from_livestream_desk || null,
        internet_service_provider: newVenue.internet_service_provider || null,
        wifi_name: newVenue.wifi_name.trim() || null,
        wifi_password: newVenue.wifi_password.trim() || null,
        internet_upload_speed: newVenue.internet_upload_speed ? parseFloat(newVenue.internet_upload_speed) : null,
        router_accessibility: newVenue.router_accessibility ? 'true' : 'false',
        router_distance_from_livestream: newVenue.router_distance_from_livestream || null,
        has_pa_system: newVenue.has_pa_system,
        pa_system_provider: newVenue.pa_system_provider.trim() || null,
        pa_system_distance_from_livestream: newVenue.pa_system_distance_from_livestream || null,
        other_pa_system_providers: newVenue.other_pa_system_providers.trim() || null,
        pa_system_contact_phone: newVenue.pa_system_contact_phone.trim() || null,
        pa_system_contact_email: newVenue.pa_system_contact_email.trim() || null,
        is_private_residence: newVenue.is_private_residence,
        completeness_score: completeness,
        contacts: validContacts,
        layouts: validLayouts
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
        website: '',
        facebook: '',
        instagram: '',
        has_power: true,
        power_type: '',
        power_outage_rate: '',
        power_backup: '',
        power_socket_type: 'Square',
        power_distance_from_livestream_desk: '0',
        internet_service_provider: '',
        wifi_name: '',
        wifi_password: '',
        internet_upload_speed: '',
        router_accessibility: true,
        router_distance_from_livestream: '0',
        has_pa_system: true,
        pa_system_distance_from_livestream: '0',
        pa_system_provider: '',
        other_pa_system_providers: '',
        pa_system_contact_phone: '',
        pa_system_contact_email: '',
        is_private_residence: false,
        contacts: [
          { contact_id: '', mode: 'search', searchQuery: '', isOpen: false, first_name: '', last_name: '', email: '', phone: '', role: 'Venue Coordinator' }
        ],
        layouts: []
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

  const handleSaveBooking = async () => {
    if (!bookingVenueId) {
      setBookingFormError("Please select a venue from the database.");
      return;
    }

    setBookingFormError(null);
    setIsSubmittingBooking(true);
    setBookingSuccessMsg(null);

    try {
      const isoDateTime = bookingDateTime ? new Date(bookingDateTime).toISOString() : null;

      const activeContact = bookingVenueContacts.find(c => String(c.id) === String(selectedBookingContactId)) || bookingVenueContacts[0];

      await createSiteVisit({
        venue_id: parseInt(bookingVenueId, 10),
        scheduled_date_time: isoDateTime,
        notes: bookingNotes.trim() || null,
        status: bookingStatus,
        contact_id: activeContact ? parseInt(String(activeContact.id), 10) : null
      });

      const selectedVenueObj = venues.find(v => v.id === bookingVenueId);
      const venueName = selectedVenueObj ? selectedVenueObj.name : 'Selected Venue';
      const contactInfo = activeContact 
        ? `${activeContact.name} (${activeContact.phone || 'No phone recorded'})` 
        : 'Mr Muza (+263788918512)';

      setBookingSuccessMsg(
        `Booking successfully saved to DB for "${venueName}"! Nyasha (AI Assistant) is now triggered to inspect the venue in DB and contact venue coordinator ${contactInfo} via WhatsApp.`
      );

      // Reset form fields
      setBookingVenueId('');
      setBookingVenueSearchQuery('');
      setBookingDateTime('');
      setBookingNotes('');
      setBookingStatus('scheduled');
      setBookingVenueContacts([]);
      setSelectedBookingContactId('');

      // Refresh data
      await loadSiteVisits();
      await loadVenues();
    } catch (err: any) {
      console.error("Failed to save booking:", err);
      setBookingFormError(`Error saving booking: ${err.message || err.toString()}`);
    } finally {
      setIsSubmittingBooking(false);
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

  // Helper to highlight matching text in search results
  const highlightText = (text: string | null, search: string) => {
    if (!text) return '';
    if (!search.trim()) return <span>{text}</span>;
    
    const terms = search.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return <span>{text}</span>;
    
    // We escape regex characters to avoid breaking the query
    const escapedTerms = terms.map(term => term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} style={{ backgroundColor: '#ffe082', color: '#2d231e', padding: '0 2px', borderRadius: '2px', fontWeight: 600 }}>{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  // Venues client-side filtering logic
  const filteredVenues = venues.filter(venue => {
    // 1. Text search (name, address, type) - multi-term matching
    const text = venuesSearchQuery.toLowerCase().trim();
    if (text) {
      const terms = text.split(/\s+/).filter(t => t.length > 0);
      const matchAllTerms = terms.every(term => {
        const matchName = (venue.name || '').toLowerCase().includes(term);
        const matchAddress = (venue.address_one || '').toLowerCase().includes(term) || 
                             (venue.address_two || '').toLowerCase().includes(term) || 
                             (venue.suburb || '').toLowerCase().includes(term) || 
                             (venue.city || '').toLowerCase().includes(term);
        const matchType = (venue.venue_type || '').toLowerCase().includes(term);
        return matchName || matchAddress || matchType;
      });
      if (!matchAllTerms) return false;
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
            className={`sidebar-btn ${activeTab === 'venues' || activeTab === 'add_venue' || activeTab === 'venue_details' ? 'active' : ''}`}
            title="Venues Dashboard"
          >
            <LayoutGrid size={20} />
          </button>

          <button
            onClick={() => setActiveTab('add_booking')}
            className={`sidebar-btn ${activeTab === 'add_booking' ? 'active' : ''}`}
            title="Book Site Visit (Venue in DB)"
          >
            <CalendarClock size={20} />
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
        {activeTab === 'chat' && (
          <div className={`app-container ${mobileChatSubTab === 'chat' ? 'show-chat-view' : 'show-visits-view'}`}>
            {/* Mobile Sub-Navigation Toggle Bar */}
            <div className="mobile-chat-toggle-bar">
              <button
                type="button"
                className={`toggle-bar-btn ${mobileChatSubTab === 'chat' ? 'active' : ''}`}
                onClick={() => setMobileChatSubTab('chat')}
              >
                Chat Assistant
              </button>
              <button
                type="button"
                className={`toggle-bar-btn ${mobileChatSubTab === 'visits' ? 'active' : ''}`}
                onClick={() => setMobileChatSubTab('visits')}
              >
                Active Schedule ({filteredVisits.length})
              </button>
            </div>
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
        )}

        {activeTab === 'venues' && (
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

                <div className="header-search-wrapper" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="header-search-input"
                    placeholder="Search bookings, stream setups..."
                    value={venuesSearchQuery}
                    onChange={(e) => setVenuesSearchQuery(e.target.value)}
                    style={{ paddingRight: venuesSearchQuery ? '2rem' : '1.75rem' }}
                  />
                  <Search size={14} className="header-search-icon" />
                  {venuesSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setVenuesSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.2rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 2
                      }}
                    >
                      ✕
                    </button>
                  )}
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

              <div className="filter-search-wrapper" style={{ position: 'relative' }}>
                <Search size={14} className="filter-search-icon" />
                <input
                  type="text"
                  className="filter-search-input"
                  placeholder="Search by venue name, type, or address..."
                  value={venuesSearchQuery}
                  onChange={(e) => setVenuesSearchQuery(e.target.value)}
                  style={{ paddingRight: venuesSearchQuery ? '2rem' : '1rem' }}
                />
                {venuesSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setVenuesSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.2rem'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="filter-actions">
                <button
                  className="btn-allocate"
                  onClick={() => {
                    setBookingSuccessMsg(null);
                    setBookingFormError(null);
                    setActiveTab('add_booking');
                  }}
                >
                  <CalendarClock size={14} style={{ marginRight: '0.35rem' }} />
                  <span>CREATE BOOKING</span>
                </button>
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
                      <div 
                        className="venue-card-new" 
                        key={venue.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedVenueId(venue.id);
                          setActiveTab('venue_details');
                        }}
                      >
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
                            <button className="media-action-circle-btn" onClick={(e) => e.stopPropagation()}><Edit size={12} /></button>
                            <button className="media-action-circle-btn" onClick={(e) => e.stopPropagation()}><Trash size={12} /></button>
                            <button className="media-action-circle-btn" onClick={(e) => e.stopPropagation()}><ImageIcon size={12} /></button>
                          </div>
                        </div>

                        {/* Details Section */}
                        <div className="venue-card-body">
                          <h2 className="venue-card-title-new">{highlightText(venue.name, venuesSearchQuery)}</h2>
                          <div className="venue-card-address-new">
                            <MapPin size={12} />
                            <span>
                              {venue.address_one 
                                ? highlightText(venue.address_one, venuesSearchQuery) 
                                : venue.city 
                                  ? highlightText(venue.city, venuesSearchQuery) 
                                  : 'Address not specified'}
                            </span>
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
                            <button 
                              className="btn-card-plan"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBookingVenueId(venue.id);
                                setActiveTab('add_booking');
                              }}
                            >
                              <Calendar size={12} />
                              <span>Plan</span>
                            </button>
                            <button className="btn-card-map-pin" onClick={(e) => e.stopPropagation()}>
                              <MapPin size={14} />
                            </button>
                            <button 
                              className="btn-card-details"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVenueId(venue.id);
                                setActiveTab('venue_details');
                              }}
                            >
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

        {activeTab === 'venue_details' && (
          (() => {
            const selectedVenue = venues.find(v => v.id === selectedVenueId) || venues[0];
            if (!selectedVenue) {
              return (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No venue selected. <button onClick={() => setActiveTab('venues')}>Back to Venues</button>
                </div>
              );
            }

            const heroImg = getVenueImage(selectedVenue) || '/all_souls.png';

            return (
              <div className="venues-dashboard" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
                {/* HEADER */}
                <header className="venues-header">
                  <div className="venues-title-section">
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedVenue.id || '51'}</h1>
                    <span 
                      className="venues-breadcrumb" 
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActiveTab('venues')}
                    >
                      Venues / {selectedVenue.id || '51'}
                    </span>
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
                        <option value="All">All</option>
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
                    <button className="header-icon-btn" onClick={() => setActiveTab('venues')} title="Grid View">
                      <LayoutGrid size={16} />
                    </button>
                    <button className="header-icon-btn">
                      <Bell size={16} />
                      <span className="notification-badge">4</span>
                    </button>
                    <button className="header-icon-btn">
                      <MessageSquare size={16} />
                    </button>
                    <button className="header-icon-btn">
                      <Moon size={16} />
                    </button>
                    <div className="profile-capsule">
                      <div className="profile-avatar-circle">C</div>
                      <span>Clyde Tadiwa</span>
                    </div>
                  </div>
                </header>

                {/* MAIN DETAIL SCROLL AREA */}
                <div className="venue-detail-scroll-area">
                  <div className="venue-detail-main-layout">
                    
                    {/* LEFT MAIN COLUMN (Hero, Stats, Tabs, Content) */}
                    <div className="venue-detail-left-column">
                      
                      {/* 1. TOP HERO BANNER */}
                      <div className="venue-hero-banner">
                        <img src={heroImg} alt={selectedVenue.name} className="hero-banner-img" />
                        <div className="hero-overlay-content">
                          {/* Top Left Edit Icon */}
                          <button className="hero-edit-btn" title="Edit Cover Photo">
                            <Edit size={14} />
                          </button>

                          {/* Bottom Left Info */}
                          <div className="hero-left-info">
                            <span className="hero-type-badge">
                              {selectedVenue.venue_type || 'church'}
                            </span>
                            <h1 className="hero-title">{selectedVenue.name}</h1>
                            <p className="hero-address">
                              {selectedVenue.address_one 
                                ? `${selectedVenue.address_one}, ${selectedVenue.suburb || ''}, ${selectedVenue.city || 'Harare'}, ZW`
                                : (selectedVenue.city ? `${selectedVenue.city}, ZW` : '12 Westcott Road, Mount Pleasant, Harare, ZW')}
                            </p>
                          </div>

                          {/* Bottom Right Venue Health Glass Card & Percentage Ring */}
                          <div className="hero-right-health">
                            <div className="hero-health-score-ring">
                              <span>{selectedVenue.completeness_score || 68}%</span>
                            </div>
                            <div className="hero-health-glass-card">
                              <div className="health-card-header">
                                <span className="health-card-title">Venue Health</span>
                                <span className="health-card-completeness">Data Completeness <strong>{selectedVenue.completeness_score || 68}%</strong></span>
                              </div>
                              <div className="health-bar-track">
                                <div 
                                  className="health-bar-fill"
                                  style={{ width: `${selectedVenue.completeness_score || 68}%` }}
                                />
                              </div>
                              <div className="health-card-meta">
                                <span>Last updated: 23-01-2026</span>
                                <span>Past Events <strong>1</strong></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. KEY STATS ATTRIBUTES STRIP */}
                      <div className="venue-stats-strip">
                        <div className="stat-strip-box">
                          <div className="stat-icon-circle"><Wifi size={16} /></div>
                          <div className="stat-text-meta">
                            <span className="stat-tag">INTERNET</span>
                            <span className="stat-val">{selectedVenue.internet_service_provider || 'Zol (Liquid Home)'}</span>
                          </div>
                        </div>

                        <div className="stat-strip-box">
                          <div className="stat-icon-circle"><Zap size={16} /></div>
                          <div className="stat-text-meta">
                            <span className="stat-tag">POWER</span>
                            <span className="stat-val">{selectedVenue.power_type || selectedVenue.power_backup || 'zesa'}</span>
                          </div>
                        </div>

                        <div className="stat-strip-box">
                          <div className="stat-icon-circle"><Users size={16} /></div>
                          <div className="stat-text-meta">
                            <span className="stat-tag">CAPACITY</span>
                            <span className="stat-val">{selectedVenue.capacity || '300'}</span>
                          </div>
                        </div>

                        <div className="stat-strip-box">
                          <div className="stat-icon-circle"><LayoutGrid size={16} /></div>
                          <div className="stat-text-meta">
                            <span className="stat-tag">ROOMS</span>
                            <span className="stat-val">{venueLayouts.length}</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. DETAIL TABS NAVIGATION */}
                      <div className="venue-details-tabs-bar">
                        {[
                          { id: 'general', label: 'General' },
                          { id: 'rooms', label: `Rooms (${venueLayouts.length})` },
                          { id: 'floor_plans', label: `Floor Plans (${venueDocuments.length})` },
                          { id: 'gallery', label: 'Gallery' },
                          { id: 'bookings', label: `Bookings (${venueBookings.length})` },
                          { id: 'contacts', label: `Contacts (${venueContacts.length})` }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            className={`venue-tab-item ${venueDetailsTab === tab.id ? 'active' : ''}`}
                            onClick={() => setVenueDetailsTab(tab.id as any)}
                          >
                            {tab.label}
                          </button>
                        ))}
                        {isLoadingChildData && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--primary-color)', marginLeft: 'auto', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={12} className="spin" /> Syncing Neon DB...
                          </span>
                        )}
                      </div>

                      {/* 4. TAB CONTENT AREA */}
                      <div className="venue-details-tab-content-area">
                        {venueDetailsTab === 'general' && (
                          <div className="general-tab-grid">
                            {/* General Information Card */}
                            <div className="detail-white-card general-info-card">
                              <div className="card-header-with-action">
                                <h3>General Information</h3>
                                <button className="icon-edit-btn" title="Edit General Info">
                                  <Edit size={14} />
                                </button>
                              </div>
                              
                              <div className="detail-props-table">
                                <div className="prop-row">
                                  <span className="prop-label">Venue Name</span>
                                  <span className="prop-value-bold">{selectedVenue.name}</span>
                                </div>
                                <div className="prop-row">
                                  <span className="prop-label">Venue Type</span>
                                  <span className="prop-value">{selectedVenue.venue_type || 'church'}</span>
                                </div>
                                <div className="prop-row">
                                  <span className="prop-label">Capacity</span>
                                  <span className="prop-value">{selectedVenue.capacity || '300'}</span>
                                </div>
                                <div className="prop-row">
                                  <span className="prop-label">Rooms</span>
                                  <span className="prop-value">{venueLayouts.length}</span>
                                </div>
                                <div className="prop-row">
                                  <span className="prop-label">Website</span>
                                  <span className="prop-value-dash">—</span>
                                </div>
                                <div className="prop-row">
                                  <span className="prop-label">Instagram</span>
                                  <span className="prop-value-dash">—</span>
                                </div>
                                <div className="prop-row">
                                  <span className="prop-label">Facebook</span>
                                  <span className="prop-value-dash">—</span>
                                </div>
                                <div className="prop-row">
                                  <span className="prop-label">Address</span>
                                  <span className="prop-value">
                                    {selectedVenue.address_one 
                                      ? `${selectedVenue.address_one}, ${selectedVenue.suburb || ''}, ${selectedVenue.city || 'Harare'}, ZW`
                                      : '12 Westcott Road, Mount Pleasant, Harare, ZW'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Venue Image Card next to General Info */}
                            <div className="general-tab-image-container">
                              <img src={heroImg} alt={selectedVenue.name} className="tab-preview-img" />
                            </div>
                          </div>
                        )}

                        {venueDetailsTab === 'rooms' && (
                          <div className="detail-white-card">
                            <div className="card-header-with-action">
                              <h3>Rooms & Spaces</h3>
                            </div>
                            {venueLayouts.length === 0 ? (
                              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Building size={44} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-dark)' }}>Main Hall Setup</h4>
                                <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                                  Dedicated capacity: {selectedVenue.capacity || '300'} seats. No additional sub-room layouts saved in database.
                                </p>
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                {venueLayouts.map(layout => (
                                  <div key={layout.id} style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                                    <Building size={20} style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }} />
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize' }}>{layout.layout_type} Layout</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Capacity: {layout.capacity || 'Not specified'}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {venueDetailsTab === 'floor_plans' && (
                          <div className="detail-white-card">
                            <div className="card-header-with-action">
                              <h3>Floor Plans & Diagrams</h3>
                            </div>
                            {venueDocuments.length === 0 ? (
                              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <ImageIcon size={44} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-dark)' }}>No Floor Plan Uploaded</h4>
                                <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                                  No blueprint documents or camera setup diagrams recorded in database for this venue.
                                </p>
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                {venueDocuments.map(doc => (
                                  <div key={doc.id} style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <ImageIcon size={24} style={{ color: 'var(--primary-color)' }} />
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file.split('/').pop()}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{doc.file_type || 'Document'}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {venueDetailsTab === 'gallery' && (
                          <div className="detail-white-card">
                            <div className="card-header-with-action">
                              <h3>Gallery</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                              <img src={heroImg} alt="Gallery 1" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '12px' }} />
                              <img src="/alo_alo.png" alt="Gallery 2" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '12px' }} />
                              <img src="/abiding_hope.png" alt="Gallery 3" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '12px' }} />
                            </div>
                          </div>
                        )}

                        {venueDetailsTab === 'bookings' && (
                          <div className="detail-white-card">
                            <div className="card-header-with-action">
                              <h3>Bookings for {selectedVenue.name}</h3>
                              <button 
                                className="btn-add-venue"
                                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                                onClick={() => {
                                  setBookingVenueId(selectedVenue.id);
                                  setActiveTab('add_booking');
                                }}
                              >
                                <CalendarClock size={14} />
                                <span>Schedule Visit</span>
                              </button>
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                              {venueBookings.length === 0 ? (
                                <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                  No site visit bookings currently recorded in database for this venue.
                                </div>
                              ) : (
                                venueBookings.map(b => (
                                  <div key={b.id} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-dark)' }}>{b.notes || 'Site Visit Booking'}</div>
                                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        {b.site_visit_date ? new Date(b.site_visit_date).toLocaleString() : 'Date TBD'}
                                      </div>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', padding: '0.25rem 0.65rem', borderRadius: '12px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 700, textTransform: 'capitalize' }}>
                                      {b.status || 'Scheduled'}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {venueDetailsTab === 'contacts' && (
                          <div className="detail-white-card">
                            <div className="card-header-with-action">
                              <h3>Contacts ({venueContacts.length})</h3>
                              <button className="btn-add-venue" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }} onClick={() => setShowAddContactModal(true)}>
                                <Plus size={14} />
                                <span>Add Contact</span>
                              </button>
                            </div>
                            {venueContacts.length === 0 ? (
                              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No contacts associated with this venue in database yet.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                                {venueContacts.map((c, idx) => {
                                  const initials = c.name ? c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'VC';
                                  return (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: idx === 0 ? '#5c3e30' : '#8c6239', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                                          {initials}
                                        </div>
                                        <div>
                                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-dark)' }}>{c.name}</div>
                                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            {idx === 0 ? 'Primary Contact' : 'Secondary Contact'} • {c.role || 'Coordinator'} • {c.email || 'No Email'} • {c.phone || 'No Phone'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* RIGHT SIDEBAR PANEL (Spans full height next to left column) */}
                    <div className="venue-details-right-sidebar">
                      
                      {/* Primary Contact Card */}
                      {venueContacts.length > 0 ? (
                        <div className="sidebar-detail-card contact-card-panel">
                          <div className="card-top-icon-actions">
                            <button className="small-icon-btn" title="Delete Contact"><Trash size={13} /></button>
                            <button className="small-icon-btn" title="Edit Contact"><Edit size={13} /></button>
                          </div>

                          <div className="primary-contact-avatar">
                            <div className="avatar-circle-inner">
                              <span>{venueContacts[0].name ? venueContacts[0].name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'JC'}</span>
                            </div>
                          </div>

                          <h3 className="primary-contact-name">{venueContacts[0].name}</h3>
                          {venueContacts[0].email && (
                            <a href={`mailto:${venueContacts[0].email}`} className="primary-contact-email">{venueContacts[0].email}</a>
                          )}
                          <p className="primary-contact-phone">{venueContacts[0].phone || 'No phone recorded'}</p>

                          <div className="contact-actions-row">
                            <button className="action-circle-btn whatsapp" title="Send WhatsApp" onClick={() => venueContacts[0].phone && window.open(`https://wa.me/${venueContacts[0].phone.replace(/[^0-9]/g, '')}`, '_blank')}>
                              <MessageSquare size={14} />
                            </button>
                            {venueContacts[0].email && (
                              <a className="action-circle-btn email" title="Send Email" href={`mailto:${venueContacts[0].email}`}>
                                <Mail size={14} />
                              </a>
                            )}
                            {venueContacts[0].phone && (
                              <a className="action-circle-btn call" title="Call Contact" href={`tel:${venueContacts[0].phone}`}>
                                <Phone size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="sidebar-detail-card contact-card-panel" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                          <Users size={32} style={{ opacity: 0.4, margin: '0 auto 0.5rem auto' }} />
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>No Primary Contact</h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.4rem 0 1rem 0' }}>No contact associated in database for this venue yet.</p>
                          <button className="btn-add-venue" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', margin: '0 auto' }} onClick={() => setShowAddContactModal(true)}>
                            <Plus size={13} />
                            <span>Add Contact</span>
                          </button>
                        </div>
                      )}

                      {/* Other Contacts Card */}
                      <div className="sidebar-detail-card other-contacts-panel">
                        <div className="card-header-row">
                          <span className="card-title">Other Contacts ({Math.max(0, venueContacts.length - 1)})</span>
                          <button className="green-plus-circle-btn" title="Add Contact" onClick={() => setShowAddContactModal(true)}>
                            <Plus size={13} />
                          </button>
                        </div>

                        {venueContacts.length <= 1 ? (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                            No secondary contacts saved in DB.
                          </div>
                        ) : (
                          venueContacts.slice(1).map(c => {
                            const initials = c.name ? c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'OC';
                            return (
                              <div key={c.id} className="other-contact-row">
                                <div className="other-avatar-circle">{initials}</div>
                                <span className="other-contact-name">{c.name}</span>
                                <ChevronRight size={14} className="other-chevron" />
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Site Visit Scheduled Card */}
                      <div className="sidebar-detail-card site-visit-panel">
                        {venueBookings.length > 0 ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-dark)' }}>Scheduled Site Visit</div>
                            <p className="visit-status-msg" style={{ marginTop: '0.2rem' }}>
                              {venueBookings[0].site_visit_date ? new Date(venueBookings[0].site_visit_date).toLocaleDateString() : 'Date TBD'} • Status: <strong style={{ textTransform: 'capitalize' }}>{venueBookings[0].status}</strong>
                            </p>
                          </div>
                        ) : (
                          <p className="visit-status-msg">No site visit scheduled yet</p>
                        )}
                        <button 
                          className="btn-schedule-site-visit"
                          onClick={() => {
                            setBookingVenueId(selectedVenue.id);
                            setActiveTab('add_booking');
                          }}
                        >
                          Schedule Site Visit

                        </button>
                      </div>

                      {/* Notes Card */}
                      <div className="sidebar-detail-card notes-panel">
                        <div className="card-header-row">
                          <span className="card-title">Notes</span>
                          <button className="small-icon-btn" title="Edit Notes">
                            <Edit size={13} />
                          </button>
                        </div>
                        <p className="notes-content-text">
                          {selectedVenue.notes || "No notes added yet."}
                        </p>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            );
          })()
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
                  <span>Clyde Tadiwa</span>
                </div>
              </div>
            </header>

            {/* TWO COLUMN CONTENT */}
            <div className="add-venue-layout">
              {/* LEFT COLUMN: WIZARD FORM (2/3 width) */}
              <div className="add-venue-form-col">
                {/* Stepper Card */}
                <div className="form-wizard-card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 4px 15px rgba(92,62,48,0.08)' }}>
                  
                  {/* Stepper Header Banner */}
                  <div className="wizard-pattern-banner" style={{ padding: '1.5rem 1.75rem' }}>
                    <div className="wizard-banner-content">
                      {/* Top Action Link: Save Venue */}
                      <div className="stepper-top-action">
                        <button
                          type="button"
                          onClick={handleSaveVenue}
                          disabled={isSubmittingVenue}
                          className="btn-save-venue-link"
                        >
                          {isSubmittingVenue ? 'Saving Venue...' : 'Save Venue'}
                        </button>
                      </div>

                      {/* Step Progress Circles */}
                      <div className="stepper-steps-container">
                        <div className="stepper-line"></div>
                        
                        {[
                          { step: 1, label: 'Venue Essentials' },
                          { step: 2, label: 'Power' },
                          { step: 3, label: 'Internet Details' },
                          { step: 4, label: 'PA Systems' },
                          { step: 5, label: 'Rooms' },
                          { step: 6, label: 'Contacts' }
                        ].map((item) => {
                          const isActive = formStep === item.step;
                          const isCompleted = formStep > item.step;
                          return (
                            <div
                              key={item.step}
                              onClick={() => setFormStep(item.step)}
                              className={`stepper-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                            >
                              <div className="stepper-circle">
                                {item.step}
                              </div>
                              <span className="stepper-text-label">
                                {item.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Form Step Content Body */}
                  <div style={{ padding: '2rem 2.25rem' }}>
                    
                    {/* STEP 1: Venue Essentials */}
                    {formStep === 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Row 1: Name, Type, Capacity */}
                        <div className="form-grid-3">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                              Venue Name <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="Clyde"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: formErrors.name ? '1px solid #ef4444' : '1px solid var(--border-light)' }}
                              value={newVenue.name}
                              onChange={(e) => {
                                setNewVenue(prev => ({ ...prev, name: e.target.value }));
                                if (e.target.value.trim() && formErrors.name) {
                                  setFormErrors(prev => {
                                    const updated = { ...prev };
                                    delete updated.name;
                                    return updated;
                                  });
                                }
                              }}
                            />
                            {formErrors.name && (
                              <span style={{ color: '#ef4444', fontSize: '0.725rem', fontWeight: 500, marginTop: '0.1rem' }}>
                                {formErrors.name}
                              </span>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Venue Type</label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', height: '42px' }}
                              value={newVenue.venue_type}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, venue_type: e.target.value }))}
                            >
                              <option value="">Select type...</option>
                              <option value="Church">Church</option>
                              <option value="Hall">Hall</option>
                              <option value="Funeral Parlour">Funeral Parlour</option>
                              <option value="Tent">Tent</option>
                              <option value="Hotel">Hotel</option>
                              <option value="Conference Center">Conference Center</option>
                              <option value="Private Residence">Private Residence</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Venue Capacity</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g. 250"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                              value={newVenue.capacity}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, capacity: e.target.value }))}
                            />
                          </div>
                        </div>

                        {/* Row 2: Address One, Address Two, Suburb */}
                        <div className="form-grid-3">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Address One</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g address one"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                              value={newVenue.address_one}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, address_one: e.target.value }))}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Address Two</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g address two"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                              value={newVenue.address_two}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, address_two: e.target.value }))}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Suburb</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g Mount Pleasant"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                              value={newVenue.suburb}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, suburb: e.target.value }))}
                            />
                          </div>
                        </div>

                        {/* Row 3: City */}
                        <div className="form-grid-3">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>City</label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', height: '42px' }}
                              value={newVenue.city}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, city: e.target.value }))}
                            >
                              <option value="Harare">Harare</option>
                              <option value="Bulawayo">Bulawayo</option>
                              <option value="Gweru">Gweru</option>
                              <option value="Mutare">Mutare</option>
                              <option value="Masvingo">Masvingo</option>
                              <option value="Kwekwe">Kwekwe</option>
                              <option value="Kadoma">Kadoma</option>
                              <option value="Victoria Falls">Victoria Falls</option>
                            </select>
                          </div>
                        </div>

                        {/* Row 4: Notes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Notes</label>
                          <textarea
                            placeholder="Any additional notes about the venue..."
                            rows={3}
                            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none' }}
                            value={newVenue.notes}
                            onChange={(e) => setNewVenue(prev => ({ ...prev, notes: e.target.value }))}
                          ></textarea>
                        </div>

                        {/* Sub-section: Social Media & Web */}
                        <div style={{ marginTop: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.85rem' }}>
                            Social Media & Web
                          </h4>
                          <div className="form-grid-3">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Website</label>
                              <input
                                type="text"
                                className="filter-search-input"
                                placeholder="https://www.example.com"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                                value={newVenue.website}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, website: e.target.value }))}
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Facebook</label>
                              <input
                                type="text"
                                className="filter-search-input"
                                placeholder="https://facebook.com/page"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                                value={newVenue.facebook}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, facebook: e.target.value }))}
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Instagram</label>
                              <input
                                type="text"
                                className="filter-search-input"
                                placeholder="https://instagram.com/handle"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                                value={newVenue.instagram}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, instagram: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Sub-section: Media Upload Dropzones */}
                        <div className="form-grid-2" style={{ marginTop: '0.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dark)' }}>Venue Photos</label>
                            <div className="upload-dropzone-box">
                              <div className="upload-icon-circle">
                                <Upload size={18} />
                              </div>
                              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                                Click or drag & drop to upload
                              </span>
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                Max size: 10 MB
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dark)' }}>Floor Plans</label>
                            <div className="upload-dropzone-box">
                              <div className="upload-icon-circle">
                                <Upload size={18} />
                              </div>
                              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                                Click or drag & drop to upload
                              </span>
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                Max size: 30 MB
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Power */}
                    {formStep === 2 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Row 1: Power Type & Power Outage Rate */}
                        <div className="form-grid-2">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Power Type</label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', height: '42px' }}
                              value={newVenue.power_type}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, power_type: e.target.value }))}
                            >
                              <option value="">Select type...</option>
                              <option value="Grid (ZESA)">Grid (ZESA)</option>
                              <option value="Generator">Generator</option>
                              <option value="Solar">Solar</option>
                              <option value="Mixed / Hybrid">Mixed / Hybrid</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Power Outage Rate</label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', height: '42px' }}
                              value={newVenue.power_outage_rate}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, power_outage_rate: e.target.value }))}
                            >
                              <option value="">Select outage rate...</option>
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                              <option value="Frequent">Frequent</option>
                            </select>
                          </div>
                        </div>

                        {/* Row 2: Back Up Power */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            Back Up Power <Plus size={14} style={{ cursor: 'pointer' }} />
                          </label>
                          <select
                            className="header-dropdown"
                            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', height: '42px' }}
                            value={newVenue.power_backup}
                            onChange={(e) => setNewVenue(prev => ({ ...prev, power_backup: e.target.value }))}
                          >
                            <option value="">Select backup power...</option>
                            <option value="Generator">Generator</option>
                            <option value="Solar">Solar</option>
                            <option value="UPS / Battery">UPS / Battery</option>
                            <option value="None">None</option>
                          </select>
                        </div>

                        {/* Row 3: Power Socket Type */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Power Socket Type</label>
                          <div className="socket-pill-group">
                            <button
                              type="button"
                              className={`socket-pill-btn ${newVenue.power_socket_type === 'Round' ? 'active' : ''}`}
                              onClick={() => setNewVenue(prev => ({ ...prev, power_socket_type: 'Round' }))}
                            >
                              Round
                            </button>
                            <button
                              type="button"
                              className={`socket-pill-btn ${newVenue.power_socket_type === 'Square' ? 'active' : ''}`}
                              onClick={() => setNewVenue(prev => ({ ...prev, power_socket_type: 'Square' }))}
                            >
                              Square
                            </button>
                          </div>
                        </div>

                        {/* Row 4: Distance from Livedesk */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Distance from Livedesk</label>
                          <div className="slider-control-row">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              className="distance-range-slider"
                              value={newVenue.power_distance_from_livestream_desk || '0'}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, power_distance_from_livestream_desk: e.target.value }))}
                            />
                            <div className="meter-unit-box">
                              {newVenue.power_distance_from_livestream_desk || '0'} m
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Internet Details */}
                    {formStep === 3 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Row 1: ISP, Wifi Name, Password */}
                        <div className="form-grid-3">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              Internet Service Provider <Plus size={14} style={{ cursor: 'pointer' }} />
                            </label>
                            <select
                              className="header-dropdown"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)', height: '42px' }}
                              value={newVenue.internet_service_provider}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, internet_service_provider: e.target.value }))}
                            >
                              <option value="">Select provider...</option>
                              <option value="Starlink">Starlink</option>
                              <option value="Zol (Liquid Home)">Zol (Liquid Home)</option>
                              <option value="Econet">Econet</option>
                              <option value="TelOne">TelOne</option>
                              <option value="Telco">Telco</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Wifi Name</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="clyde@muzukuru.com"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                              value={newVenue.wifi_name}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, wifi_name: e.target.value }))}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Password</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <input
                                type="password"
                                className="filter-search-input"
                                placeholder="••••••••"
                                style={{ width: '100%', padding: '0.65rem 2.25rem 0.65rem 0.85rem', borderRadius: '8px' }}
                                value={newVenue.wifi_password}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, wifi_password: e.target.value }))}
                              />
                              <Eye size={16} style={{ position: 'absolute', right: '10px', color: 'var(--text-muted)', cursor: 'pointer' }} />
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Upload Speed */}
                        <div className="form-grid-3">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Upload Speed</label>
                            <div className="input-with-suffix-wrapper">
                              <input
                                type="text"
                                className="filter-search-input"
                                placeholder=""
                                style={{ width: '100%', padding: '0.65rem 3rem 0.65rem 0.85rem', borderRadius: '8px' }}
                                value={newVenue.internet_upload_speed}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, internet_upload_speed: e.target.value }))}
                              />
                              <span className="input-suffix-tag">Mbps</span>
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Is router accessible Feature Card */}
                        <div className="feature-toggle-card">
                          <div className="feature-toggle-left">
                            <div className="feature-toggle-icon">
                              <Wifi size={20} />
                            </div>
                            <div>
                              <h5 className="feature-toggle-title">Is router accessible</h5>
                              <p className="feature-toggle-sub">Whether the router is physically accessible from the livestream desk.</p>
                            </div>
                          </div>

                          <label className="custom-switch">
                            <input
                              type="checkbox"
                              checked={newVenue.router_accessibility}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, router_accessibility: e.target.checked }))}
                            />
                            <span className="switch-slider"></span>
                          </label>
                        </div>

                        {/* Row 4: Router Distance from Livedesk */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Router Distance from Livedesk</label>
                          <div className="slider-control-row">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              className="distance-range-slider"
                              value={newVenue.router_distance_from_livestream || '0'}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, router_distance_from_livestream: e.target.value }))}
                            />
                            <div className="meter-unit-box">
                              {newVenue.router_distance_from_livestream || '0'} m
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: PA Systems */}
                    {formStep === 4 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Row 1: Does venue have PA System Feature Card */}
                        <div className="feature-toggle-card">
                          <div className="feature-toggle-left">
                            <div className="feature-toggle-icon">
                              <Volume2 size={20} />
                            </div>
                            <div>
                              <h5 className="feature-toggle-title">Does venue have PA System?</h5>
                              <p className="feature-toggle-sub">A PA system helps with audio distribution across the venue.</p>
                            </div>
                          </div>

                          <label className="custom-switch">
                            <input
                              type="checkbox"
                              checked={newVenue.has_pa_system}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, has_pa_system: e.target.checked }))}
                            />
                            <span className="switch-slider"></span>
                          </label>
                        </div>

                        {/* Row 2: Distance from Livedesk */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Distance from Livedesk</label>
                          <div className="slider-control-row">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              className="distance-range-slider"
                              value={newVenue.pa_system_distance_from_livestream || '0'}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, pa_system_distance_from_livestream: e.target.value }))}
                            />
                            <div className="meter-unit-box">
                              {newVenue.pa_system_distance_from_livestream || '0'} m
                            </div>
                          </div>
                        </div>

                        {/* Row 3: PA System Provider */}
                        <div className="form-grid-2">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>PA System Provider</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g. Sound Systems Ltd"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                              value={newVenue.pa_system_provider}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, pa_system_provider: e.target.value }))}
                            />
                          </div>
                        </div>

                        {/* Row 4: Other P.A System Provider, Phone, Email */}
                        <div className="form-grid-3">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Other P.A System Provider</label>
                            <input
                              type="text"
                              className="filter-search-input"
                              placeholder="e.g. Sound Guy Audio Visuals"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                              value={newVenue.other_pa_system_providers}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, other_pa_system_providers: e.target.value }))}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Phone</label>
                            <div className="phone-flag-input-group">
                              <div className="country-flag-prefix">
                                <span>🇿🇼</span>
                                <span>+263</span>
                              </div>
                              <input
                                type="text"
                                className="filter-search-input phone-flag-input"
                                placeholder=""
                                style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                                value={newVenue.pa_system_contact_phone}
                                onChange={(e) => setNewVenue(prev => ({ ...prev, pa_system_contact_phone: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-dark)' }}>Email</label>
                            <input
                              type="email"
                              className="filter-search-input"
                              placeholder="e.g. provider@example.com"
                              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px' }}
                              value={newVenue.pa_system_contact_email}
                              onChange={(e) => setNewVenue(prev => ({ ...prev, pa_system_contact_email: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 5: Rooms & Layouts */}
                    {formStep === 5 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)' }}>Rooms & Layout Configurations</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Specify seating or room setups available at this venue (e.g. Banquet, Theater, Chapel).</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewVenue(prev => ({ ...prev, layouts: [...prev.layouts, { layout_type: '', capacity: '' }] }))}
                            className="btn-add-venue"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <Plus size={14} /> Add Layout
                          </button>
                        </div>

                        {newVenue.layouts.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-light)' }}>
                            <Building size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.6 }} />
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No custom layouts added yet. Click "Add Layout" above to configure room seating types.</p>
                          </div>
                        ) : (
                          newVenue.layouts.map((layout, idx) => (
                            <div key={idx} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Layout Type</label>
                                <select
                                  className="header-dropdown"
                                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                                  value={layout.layout_type}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewVenue(prev => {
                                      const updated = [...prev.layouts];
                                      updated[idx].layout_type = val;
                                      return { ...prev, layouts: updated };
                                    });
                                  }}
                                >
                                  <option value="">Select layout type...</option>
                                  <option value="Banquet">Banquet</option>
                                  <option value="Theater">Theater</option>
                                  <option value="Classroom">Classroom</option>
                                  <option value="Cocktail / Standing">Cocktail / Standing</option>
                                  <option value="Boardroom">Boardroom</option>
                                  <option value="U-Shape">U-Shape</option>
                                  <option value="Main Chapel">Main Chapel</option>
                                  <option value="Outdoor Lawn">Outdoor Lawn</option>
                                </select>
                              </div>

                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Layout Capacity</label>
                                <input
                                  type="text"
                                  className="filter-search-input"
                                  placeholder="e.g. 150"
                                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                                  value={layout.capacity}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewVenue(prev => {
                                      const updated = [...prev.layouts];
                                      updated[idx].capacity = val;
                                      return { ...prev, layouts: updated };
                                    });
                                  }}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setNewVenue(prev => ({
                                    ...prev,
                                    layouts: prev.layouts.filter((_, i) => i !== idx)
                                  }));
                                }}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginTop: '1.25rem', padding: '0.4rem' }}
                                title="Remove Layout"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* STEP 6: Contacts */}
                    {formStep === 6 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)' }}>Venue Contact Details</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Search and select contacts from database or create new ones.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewVenue(prev => ({
                              ...prev,
                              contacts: [...prev.contacts, { contact_id: '', mode: 'search', searchQuery: '', isOpen: false, first_name: '', last_name: '', email: '', phone: '', role: 'Venue Coordinator' }]
                            }))}
                            className="btn-add-venue"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <Plus size={14} /> Add Another Contact
                          </button>
                        </div>

                        {newVenue.contacts.map((contact, idx) => {
                          const selectedDbContact = allDbContacts.find(c => String(c.id) === String(contact.contact_id));

                          const filteredDbContacts = allDbContacts.filter(c => {
                            if (!contact.searchQuery.trim()) return true;
                            const q = contact.searchQuery.toLowerCase();
                            return (
                              (c.name && c.name.toLowerCase().includes(q)) ||
                              (c.phone && c.phone.toLowerCase().includes(q)) ||
                              (c.email && c.email.toLowerCase().includes(q)) ||
                              (c.role && c.role.toLowerCase().includes(q))
                            );
                          }).slice(0, 8);

                          return (
                            <div key={idx} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <Users size={16} /> Contact #{idx + 1}
                                </span>

                                {newVenue.contacts.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setNewVenue(prev => ({
                                      ...prev,
                                      contacts: prev.contacts.filter((_, i) => i !== idx)
                                    }))}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                  >
                                    <Trash2 size={14} /> Remove
                                  </button>
                                )}
                              </div>

                              {(contact.mode === 'selected' || contact.contact_id) && selectedDbContact ? (
                                <div className="selected-contact-card">
                                  <div className="selected-card-header">
                                    <div className="selected-card-avatar">
                                      {getInitials(selectedDbContact.name)}
                                    </div>
                                    <div className="selected-card-title-group">
                                      <h4 className="selected-card-title">{selectedDbContact.name}</h4>
                                      <div className="selected-card-subtitle">
                                        {selectedDbContact.role || 'Coordinator / Staff'} • {selectedDbContact.phone || selectedDbContact.email || 'No phone'}
                                      </div>
                                      <span className="combobox-badge-db" style={{ display: 'inline-block', marginTop: '0.35rem' }}>
                                        ✓ Linked Database Contact (#{selectedDbContact.id})
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn-change-contact"
                                      onClick={() => {
                                        setNewVenue(prev => {
                                          const updated = [...prev.contacts];
                                          updated[idx].contact_id = '';
                                          updated[idx].mode = 'search';
                                          updated[idx].searchQuery = '';
                                          return { ...prev, contacts: updated };
                                        });
                                      }}
                                    >
                                      Change / Unlink
                                    </button>
                                  </div>
                                </div>
                              ) : contact.mode === 'manual' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.6rem 0.85rem', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '0.775rem', color: '#1e40af', fontWeight: 600 }}>
                                      + Creating New Contact (Will be saved to database)
                                    </span>
                                    <button
                                      type="button"
                                      className="btn-change-contact"
                                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                                      onClick={() => {
                                        setNewVenue(prev => {
                                          const updated = [...prev.contacts];
                                          updated[idx].mode = 'search';
                                          return { ...prev, contacts: updated };
                                        });
                                      }}
                                    >
                                      Search DB Contacts instead
                                    </button>
                                  </div>

                                  <div className="form-grid-2">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>First Name <span style={{ color: 'red' }}>*</span></label>
                                      <input
                                        type="text"
                                        className="filter-search-input"
                                        placeholder="e.g. John"
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                                        value={contact.first_name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setNewVenue(prev => {
                                            const updated = [...prev.contacts];
                                            updated[idx].first_name = val;
                                            return { ...prev, contacts: updated };
                                          });
                                        }}
                                      />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Last Name</label>
                                      <input
                                        type="text"
                                        className="filter-search-input"
                                        placeholder="e.g. Muza"
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                                        value={contact.last_name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setNewVenue(prev => {
                                            const updated = [...prev.contacts];
                                            updated[idx].last_name = val;
                                            return { ...prev, contacts: updated };
                                          });
                                        }}
                                      />
                                    </div>
                                  </div>

                                  <div className="form-grid-3">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Phone Number</label>
                                      <input
                                        type="text"
                                        className="filter-search-input"
                                        placeholder="e.g. +263 78 891 8512"
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                                        value={contact.phone}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setNewVenue(prev => {
                                            const updated = [...prev.contacts];
                                            updated[idx].phone = val;
                                            return { ...prev, contacts: updated };
                                          });
                                        }}
                                      />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Email Address</label>
                                      <input
                                        type="email"
                                        className="filter-search-input"
                                        placeholder="e.g. contact@venue.com"
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                                        value={contact.email}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setNewVenue(prev => {
                                            const updated = [...prev.contacts];
                                            updated[idx].email = val;
                                            return { ...prev, contacts: updated };
                                          });
                                        }}
                                      />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Role / Designation</label>
                                      <input
                                        type="text"
                                        className="filter-search-input"
                                        placeholder="e.g. Venue Coordinator / Manager"
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px' }}
                                        value={contact.role}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setNewVenue(prev => {
                                            const updated = [...prev.contacts];
                                            updated[idx].role = val;
                                            return { ...prev, contacts: updated };
                                          });
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="combobox-container">
                                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'block' }}>
                                    Search or Add Contact
                                  </label>

                                  <div className="combobox-input-wrapper">
                                    <Search className="combobox-input-icon" size={16} />
                                    <input
                                      type="text"
                                      className="combobox-input"
                                      placeholder="Type name, phone, or email to search database contacts..."
                                      value={contact.searchQuery}
                                      onFocus={() => {
                                        setNewVenue(prev => {
                                          const updated = [...prev.contacts];
                                          updated[idx].isOpen = true;
                                          return { ...prev, contacts: updated };
                                        });
                                      }}
                                      onChange={(e) => {
                                        const q = e.target.value;
                                        setNewVenue(prev => {
                                          const updated = [...prev.contacts];
                                          updated[idx].searchQuery = q;
                                          updated[idx].isOpen = true;
                                          return { ...prev, contacts: updated };
                                        });
                                      }}
                                    />
                                    {contact.searchQuery && (
                                      <button
                                        type="button"
                                        className="combobox-clear-btn"
                                        onClick={() => {
                                          setNewVenue(prev => {
                                            const updated = [...prev.contacts];
                                            updated[idx].searchQuery = '';
                                            return { ...prev, contacts: updated };
                                          });
                                        }}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>

                                  {contact.isOpen && (
                                    <div className="combobox-dropdown">
                                      {filteredDbContacts.length > 0 ? (
                                        filteredDbContacts.map(c => (
                                          <div
                                            key={c.id}
                                            className="combobox-item"
                                            onClick={() => {
                                              setNewVenue(prev => {
                                                const updated = [...prev.contacts];
                                                updated[idx].contact_id = c.id;
                                                updated[idx].first_name = c.first_name || c.name || '';
                                                updated[idx].last_name = c.last_name || '';
                                                updated[idx].phone = c.phone || '';
                                                updated[idx].email = c.email || '';
                                                updated[idx].role = c.role || 'Venue Contact';
                                                updated[idx].mode = 'selected';
                                                updated[idx].isOpen = false;
                                                return { ...prev, contacts: updated };
                                              });
                                            }}
                                          >
                                            <div className="combobox-avatar">{getInitials(c.name)}</div>
                                            <div className="combobox-item-info">
                                              <div className="combobox-item-title">
                                                {c.name} <span className="combobox-item-role">• {c.role || 'Staff'}</span>
                                              </div>
                                              <div className="combobox-item-sub">
                                                {c.phone ? `📞 ${c.phone}` : ''} {c.email ? `✉️ ${c.email}` : ''}
                                              </div>
                                            </div>
                                            <span className="combobox-badge-db">DB Contact</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                          No contacts found matching "{contact.searchQuery}"
                                        </div>
                                      )}

                                      <div
                                        className="combobox-create-option"
                                        onClick={() => {
                                          setNewVenue(prev => {
                                            const updated = [...prev.contacts];
                                            updated[idx].mode = 'manual';
                                            updated[idx].contact_id = '';
                                            updated[idx].first_name = contact.searchQuery.trim();
                                            updated[idx].isOpen = false;
                                            return { ...prev, contacts: updated };
                                          });
                                        }}
                                      >
                                        <Plus size={14} /> Create "{contact.searchQuery.trim() || 'New Contact'}" as a new contact entry
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Navigation Bar inside Form Card */}
                    <div className="wizard-footer-nav">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <button
                          type="button"
                          onClick={() => setFormStep(prev => Math.max(1, prev - 1))}
                          disabled={formStep === 1}
                          style={{
                            background: 'transparent',
                            color: formStep === 1 ? '#cbd5e1' : 'var(--text-dark)',
                            border: 'none',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: formStep === 1 ? 'not-allowed' : 'pointer',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px'
                          }}
                        >
                          Previous
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveVenue}
                          disabled={isSubmittingVenue}
                          style={{
                            background: 'transparent',
                            color: 'var(--text-dark)',
                            border: 'none',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px'
                          }}
                        >
                          Save Venue
                        </button>
                      </div>

                      {formStep < 6 ? (
                        <button
                          type="button"
                          onClick={() => setFormStep(prev => Math.min(6, prev + 1))}
                          className="btn-wizard-next"
                        >
                          Next
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSaveVenue}
                          disabled={isSubmittingVenue}
                          className="btn-wizard-next"
                        >
                          {isSubmittingVenue ? 'Saving...' : 'Save Venue'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: COMPLETENESS SIDEBAR CARD (1/3 width) */}
              <div className="add-venue-summary-col">
                <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(92,62,48,0.06)' }}>
                  
                  {/* Brown Pattern Header for Completeness Score */}
                  <div className="wizard-pattern-banner" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="wizard-banner-content">
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                        Completeness score
                      </h3>
                    </div>

                    {/* Circular Score Arc */}
                    <div className="wizard-banner-content" style={{ position: 'relative', width: '48px', height: '48px' }}>
                      <svg width="48" height="48" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="20" cy="20" r="16" fill="transparent" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="transparent"
                          stroke="#ef4444"
                          strokeWidth="3.5"
                          strokeDasharray={2 * Math.PI * 16}
                          strokeDashoffset={2 * Math.PI * 16 - (calculateCompleteness() / 100) * (2 * Math.PI * 16)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#ffffff' }}>
                        {calculateCompleteness()}%
                      </div>
                    </div>
                  </div>

                  {/* Summary Live Sections */}
                  <div style={{ padding: '1.5rem 1.5rem' }}>
                    
                    {/* PA SYSTEM Section */}
                    {formStep >= 4 && (
                      <div className="side-summary-block">
                        <div className="side-summary-title">PA SYSTEM</div>
                        <div className="side-summary-row">
                          <span className="side-summary-key">Has PA System:</span>
                          <span className="side-summary-val">{newVenue.has_pa_system ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    )}

                    {/* INTERNET Section */}
                    {formStep >= 3 && (
                      <div className="side-summary-block">
                        <div className="side-summary-title">INTERNET</div>
                        <div className="side-summary-row">
                          <span className="side-summary-key">Wi-Fi Name:</span>
                          <span className="side-summary-val">{newVenue.wifi_name || 'clyde@muzukuru.com'}</span>
                        </div>
                        <div className="side-summary-row">
                          <span className="side-summary-key">Router Accessible:</span>
                          <span className="side-summary-val">{newVenue.router_accessibility ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    )}

                    {/* POWER Section */}
                    {formStep >= 2 && (
                      <div className="side-summary-block">
                        <div className="side-summary-title">POWER</div>
                        <div className="side-summary-row">
                          <span className="side-summary-key">Has Power:</span>
                          <span className="side-summary-val">{newVenue.has_power ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    )}

                    {/* VENUE ESSENTIALS Section */}
                    <div className="side-summary-block">
                      <div className="side-summary-title">VENUE ESSENTIALS</div>
                      <div className="side-summary-row">
                        <span className="side-summary-key">Venue Name:</span>
                        <span className="side-summary-val">{newVenue.name || 'Clyde'}</span>
                      </div>
                      <div className="side-summary-row">
                        <span className="side-summary-key">Address:</span>
                        <span className="side-summary-val">{newVenue.city || 'Harare'}</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'add_booking' && (
          <div className="venues-dashboard" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
            {/* HEADER */}
            <header className="venues-header">
              <div className="venues-title-section">
                <h1>Bookings</h1>
                <span className="venues-breadcrumb">Venues / Bookings / Create Booking</span>
              </div>

              <div className="venues-header-center">
                <button className="header-home-btn" onClick={() => setActiveTab('chat')} title="Go to Chat">
                  <Home size={16} />
                </button>
                <button className="header-home-btn" onClick={() => setActiveTab('venues')} title="Go to Venues">
                  <LayoutGrid size={16} />
                </button>
              </div>

              <div className="venues-header-right">
                <div className="profile-capsule">
                  <div className="profile-avatar-circle">C</div>
                  <span>clyde@muzukuru.com</span>
                </div>
              </div>
            </header>

            {/* TWO COLUMN BOOKINGS CONTENT */}
            <div className="add-venue-layout" style={{ overflowY: 'auto', padding: '1.5rem' }}>
              {/* LEFT COLUMN: BOOKING FORM */}
              <div className="add-venue-form-col" style={{ flex: 2 }}>
                {bookingSuccessMsg && (
                  <div style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(46, 125, 50, 0.08)',
                    border: '1px solid var(--color-success)',
                    color: 'var(--color-success)',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    fontSize: '0.88rem',
                    lineHeight: '1.4'
                  }}>
                    <Check size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Booking Saved & AI Triggered</div>
                      <span>{bookingSuccessMsg}</span>
                    </div>
                  </div>
                )}

                {bookingFormError && (
                  <div style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid var(--color-error)',
                    color: 'var(--color-error)',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.88rem'
                  }}>
                    <AlertCircle size={20} />
                    <span>{bookingFormError}</span>
                  </div>
                )}

                <div style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid var(--border-light)',
                  padding: '2rem',
                  boxShadow: '0 4px 15px rgba(92,62,48,0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                    <CalendarClock size={22} style={{ color: 'var(--color-primary)' }} />
                    <div>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>Schedule Site Visit Booking</h2>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Select a venue already stored in the database. Saving the booking will automatically trigger Nyasha (AI Assistant) to contact the venue coordinator for missing info.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); handleSaveBooking(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* VENUE SELECTOR FROM DB */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Select Venue from Database <span style={{ color: 'red' }}>*</span>
                      </label>
                      
                      {bookingVenueId ? (
                        // Render selected venue card/capsule
                        (() => {
                          const selectedVenue = venues.find(v => v.id === bookingVenueId);
                          if (!selectedVenue) return null;
                          const completeness = getCompletenessDetails(selectedVenue.completeness_score);
                          return (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.75rem 1rem',
                              borderRadius: '10px',
                              border: '1px solid var(--border-light)',
                              backgroundColor: '#ffffff',
                              boxShadow: '0 2px 6px rgba(92,62,48,0.04)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Building size={18} style={{ color: 'var(--color-primary)' }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{selectedVenue.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedVenue.address_one || selectedVenue.city || 'Harare'}</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '20px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: completeness.bg,
                                  color: completeness.color
                                }}>
                                  {selectedVenue.completeness_score}% Score
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBookingVenueId('');
                                    setBookingVenueSearchQuery('');
                                    setBookingVenueContacts([]);
                                    setSelectedBookingContactId('');
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--color-error)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0.25rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    gap: '0.2rem'
                                  }}
                                  title="Change Venue"
                                >
                                  Change
                                </button>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        // Render Search input & drop-down
                        <div style={{ position: 'relative' }}>
                          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input
                            type="text"
                            placeholder="Search 200+ venues by name, city, address..."
                            value={bookingVenueSearchQuery}
                            onFocus={() => {
                              setIsBookingVenueDropdownOpen(true);
                              setFocusedVenueIndex(0);
                            }}
                            onChange={(e) => {
                              setBookingVenueSearchQuery(e.target.value);
                              setIsBookingVenueDropdownOpen(true);
                              setFocusedVenueIndex(0);
                            }}
                            onKeyDown={(e) => {
                              if (!isBookingVenueDropdownOpen) return;
                              
                              // Filter inside keydown for correct length
                              const filtered = venues.filter(v => {
                                if (!bookingVenueSearchQuery.trim()) return true;
                                const q = bookingVenueSearchQuery.toLowerCase().trim();
                                const terms = q.split(/\s+/).filter(t => t.length > 0);
                                return terms.every(term => 
                                  (v.name || '').toLowerCase().includes(term) ||
                                  (v.city || '').toLowerCase().includes(term) ||
                                  (v.venue_type || '').toLowerCase().includes(term) ||
                                  (v.address_one || '').toLowerCase().includes(term)
                                );
                              }).slice(0, 50);

                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setFocusedVenueIndex(prev => (prev + 1) % filtered.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setFocusedVenueIndex(prev => (prev - 1 + filtered.length) % filtered.length);
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filtered[focusedVenueIndex]) {
                                  setBookingVenueId(filtered[focusedVenueIndex].id);
                                  setBookingVenueSearchQuery('');
                                  setIsBookingVenueDropdownOpen(false);
                                }
                              } else if (e.key === 'Escape') {
                                setIsBookingVenueDropdownOpen(false);
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem 1rem 0.75rem 2.5rem',
                              borderRadius: '10px',
                              border: '1px solid var(--border-light)',
                              fontSize: '0.9rem',
                              outline: 'none',
                              backgroundColor: '#faf8f5',
                              fontWeight: 500
                            }}
                          />
                          
                          {/* Close Interceptor */}
                          {isBookingVenueDropdownOpen && (
                            <div 
                              onClick={() => setIsBookingVenueDropdownOpen(false)}
                              style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex: 90 }}
                            />
                          )}

                          {/* Autocomplete Dropdown List */}
                          {isBookingVenueDropdownOpen && (() => {
                            const filtered = venues.filter(v => {
                              if (!bookingVenueSearchQuery.trim()) return true;
                              const q = bookingVenueSearchQuery.toLowerCase().trim();
                              const terms = q.split(/\s+/).filter(t => t.length > 0);
                              return terms.every(term => 
                                (v.name || '').toLowerCase().includes(term) ||
                                (v.city || '').toLowerCase().includes(term) ||
                                (v.venue_type || '').toLowerCase().includes(term) ||
                                (v.address_one || '').toLowerCase().includes(term)
                              );
                            }).slice(0, 50);

                            return (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 100,
                                backgroundColor: '#ffffff',
                                border: '1px solid var(--border-light)',
                                borderRadius: '10px',
                                boxShadow: 'var(--shadow-premium)',
                                marginTop: '0.35rem',
                                maxHeight: '250px',
                                overflowY: 'auto'
                              }}>
                                {filtered.length === 0 ? (
                                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    No venues match your search.
                                  </div>
                                ) : (
                                  filtered.map((v, index) => {
                                    const isFocused = index === focusedVenueIndex;
                                    const completeness = getCompletenessDetails(v.completeness_score);
                                    return (
                                      <div
                                        key={v.id}
                                        onClick={() => {
                                          setBookingVenueId(v.id);
                                          setBookingVenueSearchQuery('');
                                          setIsBookingVenueDropdownOpen(false);
                                        }}
                                        onMouseEnter={() => setFocusedVenueIndex(index)}
                                        style={{
                                          padding: '0.7rem 1rem',
                                          cursor: 'pointer',
                                          backgroundColor: isFocused ? 'rgba(92, 62, 48, 0.05)' : '#ffffff',
                                          borderBottom: '1px solid rgba(92, 62, 48, 0.04)',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          transition: 'background-color 0.15s ease'
                                        }}
                                      >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                                            {highlightText(v.name, bookingVenueSearchQuery)}
                                          </span>
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {v.address_one ? highlightText(v.address_one, bookingVenueSearchQuery) : v.city ? highlightText(v.city, bookingVenueSearchQuery) : 'Harare'} • {v.venue_type || 'General'}
                                          </span>
                                        </div>
                                        <span style={{
                                          padding: '0.15rem 0.45rem',
                                          borderRadius: '12px',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          backgroundColor: completeness.bg,
                                          color: completeness.color
                                        }}>
                                          {v.completeness_score}%
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {venues.length} venue(s) currently available in database.
                      </span>
                    </div>

                    {/* SCHEDULE DATE & TIME */}
                    <div className="form-grid-2">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          Scheduled Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={bookingDateTime}
                          onChange={(e) => setBookingDateTime(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.7rem 0.9rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.88rem',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          Booking Status
                        </label>
                        <select
                          value={bookingStatus}
                          onChange={(e) => setBookingStatus(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.7rem 0.9rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.88rem',
                            outline: 'none'
                          }}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                        </select>
                      </div>
                    </div>

                    {/* NOTES & LOGISTICS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Booking Notes & Requirements
                      </label>
                      <textarea
                        rows={4}
                        placeholder="e.g. Service logistics setup, stream audio & camera positioning, checking venue power switches..."
                        value={bookingNotes}
                        onChange={(e) => setBookingNotes(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem 0.9rem',
                          borderRadius: '10px',
                          border: '1px solid var(--border-light)',
                          fontSize: '0.88rem',
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      ></textarea>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setActiveTab('venues')}
                        style={{
                          padding: '0.7rem 1.25rem',
                          borderRadius: '10px',
                          border: '1px solid var(--border-light)',
                          background: 'transparent',
                          color: 'var(--text-main)',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingBooking}
                        className="btn-add-venue"
                        style={{
                          padding: '0.7rem 1.5rem',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.88rem'
                        }}
                      >
                        <Sparkles size={16} />
                        <span>{isSubmittingBooking ? 'Saving & Triggering AI...' : 'Save Booking & Trigger AI Outreach'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* RIGHT COLUMN: SELECTED VENUE PREVIEW & AI TRIGGER GAP ANALYSIS */}
              <div className="add-venue-summary-col" style={{ flex: 1 }}>
                {bookingVenueId ? (
                  (() => {
                    const selectedVenue = venues.find(v => v.id === bookingVenueId);
                    if (!selectedVenue) return null;
                    const completeness = getCompletenessDetails(selectedVenue.completeness_score);

                    const missingItems: string[] = [];
                    if (!selectedVenue.has_power || !selectedVenue.power_backup) {
                      missingItems.push("Backup Power (Generator/Solar info)");
                    }
                    if (!selectedVenue.internet_service_provider) {
                      missingItems.push("Wi-Fi & Internet Service Provider");
                    }
                    if (!selectedVenue.capacity) {
                      missingItems.push("Venue Guest Capacity");
                    }
                    if (!selectedVenue.has_pa_system) {
                      missingItems.push("PA Sound System Details");
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Venue Summary Card */}
                        <div style={{
                          background: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid var(--border-light)',
                          padding: '1.5rem',
                          boxShadow: '0 4px 12px rgba(92,62,48,0.06)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-dark)' }}>{selectedVenue.name}</h3>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                                <MapPin size={12} />
                                {selectedVenue.address_one || selectedVenue.city || 'Harare'}
                              </p>
                            </div>
                            <span style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: '20px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: completeness.bg,
                              color: completeness.color
                            }}>
                              {selectedVenue.completeness_score}% DB Score
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Type:</span>
                              <span style={{ fontWeight: 600 }}>{selectedVenue.venue_type || 'General'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Power:</span>
                              <span style={{ fontWeight: 600 }}>{selectedVenue.power_backup || (selectedVenue.has_power ? 'Grid Active' : 'Unspecified')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Wi-Fi:</span>
                              <span style={{ fontWeight: 600 }}>{selectedVenue.internet_service_provider || 'Unspecified'}</span>
                            </div>
                          </div>
                        </div>

                        {/* AI Trigger Note & Gap Analysis */}
                        <div style={{
                          background: 'linear-gradient(135deg, #fef8f3, #fbf0e4)',
                          borderRadius: '16px',
                          border: '1px solid #ebd5c1',
                          padding: '1.25rem',
                          boxShadow: '0 4px 12px rgba(92,62,48,0.06)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#8c4b18', fontWeight: 700, fontSize: '0.88rem' }}>
                            <Sparkles size={16} />
                            <span>AI Coordinator Action Plan</span>
                          </div>
                          
                          {isLoadingBookingContacts ? (
                            <p style={{ fontSize: '0.8rem', color: '#7a685e', padding: '0.5rem 0' }}>
                              Loading coordinator contacts...
                            </p>
                          ) : bookingVenueContacts.length > 0 ? (
                            <>
                              {(() => {
                                const selectedContact = bookingVenueContacts.find(c => String(c.id) === String(selectedBookingContactId)) || bookingVenueContacts[0];
                                return (
                                  <p style={{ fontSize: '0.8rem', color: '#5c3e30', lineHeight: '1.45', marginBottom: '0.85rem' }}>
                                    When you save this booking, <strong>Nyasha (AI)</strong> will be triggered to check this venue in the DB and contact <strong>{selectedContact.name} ({selectedContact.phone || 'No phone'})</strong> via WhatsApp.
                                  </p>
                                );
                              })()}

                              {bookingVenueContacts.length > 1 && (
                                <div style={{ marginBottom: '1rem', borderTop: '1px solid #ebd5c1', paddingTop: '0.75rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c4b18', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.5rem' }}>
                                    Select Outreach Contact:
                                  </span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {bookingVenueContacts.map((c) => {
                                      const isSelected = String(c.id) === String(selectedBookingContactId);
                                      return (
                                        <label
                                          key={c.id}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.4rem 0.6rem',
                                            borderRadius: '8px',
                                            border: isSelected ? '1px solid #8c4b18' : '1px solid #ebd5c1',
                                            backgroundColor: isSelected ? '#ffffff' : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                          }}
                                        >
                                          <input
                                            type="radio"
                                            name="bookingContact"
                                            checked={isSelected}
                                            onChange={() => setSelectedBookingContactId(String(c.id))}
                                            style={{ accentColor: '#8c4b18' }}
                                          />
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#5c3e30' }}>{c.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: '#7a685e' }}>{c.role || 'Coordinator'}</span>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{
                              padding: '0.85rem',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(183, 28, 28, 0.05)',
                              border: '1px dashed var(--color-error)',
                              color: 'var(--color-error)',
                              fontSize: '0.78rem',
                              lineHeight: '1.4',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              marginBottom: '0.85rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                                <AlertCircle size={14} />
                                <span>No Contacts Saved for Venue!</span>
                              </div>
                              <span>Nyasha (AI Assistant) requires a venue contact name and WhatsApp phone number to perform automated outreach.</span>
                              <button
                                type="button"
                                onClick={() => setShowAddContactModal(true)}
                                className="btn-add-venue"
                                style={{
                                  alignSelf: 'flex-start',
                                  fontSize: '0.72rem',
                                  padding: '0.3rem 0.6rem',
                                  backgroundColor: 'var(--color-error)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                + Add Coordinator Contact
                              </button>
                            </div>
                          )}

                          {missingItems.length > 0 ? (
                            <div style={{ borderTop: '1px solid #ebd5c1', paddingTop: '0.75rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c4b18', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                                Missing DB Details to Request:
                              </div>
                              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#6e462d', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {missingItems.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.78rem', color: '#2e7d32', fontWeight: 600, borderTop: '1px solid #ebd5c1', paddingTop: '0.75rem' }}>
                              ✓ Venue DB records are already highly complete!
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px dashed var(--border-light)',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    <Building size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>No Venue Selected</h4>
                    <p style={{ fontSize: '0.78rem' }}>
                      Select a venue from the dropdown on the left to see its DB completeness score and missing details before booking.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            width: '90%',
            maxWidth: '450px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-dark)' }}>Add New Contact to Database</h3>
              <button 
                onClick={() => setShowAddContactModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>First Name *</label>
                <input 
                  type="text" 
                  className="form-input"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                  placeholder="e.g. Jonathan"
                  value={newContactData.first_name}
                  onChange={(e) => setNewContactData({ ...newContactData, first_name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Last Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                  placeholder="e.g. Chikoro"
                  value={newContactData.last_name}
                  onChange={(e) => setNewContactData({ ...newContactData, last_name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Email Address</label>
                <input 
                  type="email" 
                  className="form-input"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                  placeholder="e.g. contact@domain.com"
                  value={newContactData.email}
                  onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Phone Number</label>
                <input 
                  type="text" 
                  className="form-input"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                  placeholder="e.g. +263 77 123 4567"
                  value={newContactData.phone}
                  onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Role</label>
                <input 
                  type="text" 
                  className="form-input"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                  placeholder="e.g. Venue Coordinator / Manager"
                  value={newContactData.role}
                  onChange={(e) => setNewContactData({ ...newContactData, role: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                onClick={() => setShowAddContactModal(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAddContact}
                disabled={isSubmittingContact || !newContactData.first_name.trim()}
                className="btn-add-venue"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                {isSubmittingContact ? 'Saving to DB...' : 'Save Contact to DB'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
