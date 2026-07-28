export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  response: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    type: string;
  }>;
}

/**
 * Send a list of messages (chat history) to the backend agent graph
 */
export async function chatWithAgent(messages: ChatMessage[]): Promise<ChatResponse> {
  const response = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // ignore json parse error, fall back to HTTP status
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export interface SiteVisit {
  id: string;
  status: string;
  scheduled_date_time: string | null;
  notes: string | null;
  venue_name: string;
  venue_address: string | null;
}

/**
 * Fetch active site visits from the backend
 */
export async function getSiteVisits(): Promise<SiteVisit[]> {
  const response = await fetch('/api/venue/site-visits');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export interface Venue {
  id: string;
  name: string;
  address_one: string | null;
  address_two: string | null;
  suburb: string | null;
  city: string | null;
  capacity: string | null;
  has_power: boolean;
  power_type: string | null;
  power_outage_rate?: string | null;
  power_socket_type?: string | null;
  power_backup: string | null;
  power_distance_from_livestream_desk?: string | null;
  internet_service_provider: string | null;
  internet_upload_speed?: number | string | null;
  router_accessibility?: boolean | string | null;
  router_distance_from_livestream?: string | null;
  has_pa_system?: boolean;
  pa_system_provider?: string | null;
  pa_system_distance_from_livestream?: string | null;
  other_pa_system_providers?: string | null;
  pa_system_contact_phone?: string | null;
  pa_system_contact_email?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  completeness_score: number;
  is_private_residence: boolean;
  venue_type: string | null;
  media_urls: any;
  notes?: string | null;
  wifi_name?: string | null;
  wifi_password?: string | null;
  contacts?: Array<{
    contact_id?: number | string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    role?: string;
  }>;
  layouts?: Array<{
    layout_type: string;
    capacity?: string;
  }>;
}

/**
 * Fetch all venues from the backend
 */
export async function getVenues(): Promise<Venue[]> {
  const response = await fetch('/api/venues');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Create a new venue in the backend database
 */
export async function createVenue(venue: Partial<Venue>): Promise<{ status: string; id: string }> {
  const response = await fetch('/api/venues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(venue),
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export interface CreateSiteVisitPayload {
  venue_id: number;
  scheduled_date_time?: string | null;
  notes?: string | null;
  status?: string;
  contact_id?: number | null;
  assigned_crew?: Array<{
    id?: string | null;
    name: string;
    phone?: string | null;
    role?: string | null;
  }> | null;
}

/**
 * Create a new site visit booking in the backend database (triggers AI venue check)
 */
export async function createSiteVisit(payload: CreateSiteVisitPayload): Promise<{ status: string; id: string }> {
  const response = await fetch('/api/venue/site-visits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export interface VenueContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  contact_type: string | null;
  contact_image: string | null;
}

export interface VenueLayout {
  id: string;
  layout_type: string;
  capacity: string | null;
}

export interface VenueDocument {
  id: string;
  file: string;
  file_type: string;
  is_cover: boolean;
}

export interface VenueBooking {
  id: string;
  site_visit_date: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
}

export async function fetchVenueContacts(venueId: string | number): Promise<VenueContact[]> {
  const response = await fetch(`/api/venues/${venueId}/contacts`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function fetchVenueLayouts(venueId: string | number): Promise<VenueLayout[]> {
  const response = await fetch(`/api/venues/${venueId}/layouts`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function fetchVenueDocuments(venueId: string | number): Promise<VenueDocument[]> {
  const response = await fetch(`/api/venues/${venueId}/documents`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function fetchVenueBookings(venueId: string | number): Promise<VenueBooking[]> {
  const response = await fetch(`/api/venues/${venueId}/bookings`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function createVenueContact(venueId: string | number, payload: {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
}): Promise<VenueContact> {
  const response = await fetch(`/api/venues/${venueId}/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getAllContacts(query?: string): Promise<VenueContact[]> {
  const url = query ? `/api/contacts?q=${encodeURIComponent(query)}` : '/api/contacts';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}




