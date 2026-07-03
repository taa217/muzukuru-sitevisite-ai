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
  power_backup: string | null;
  internet_service_provider: string | null;
  completeness_score: number;
  is_private_residence: boolean;
  venue_type: string | null;
  media_urls: any;
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


