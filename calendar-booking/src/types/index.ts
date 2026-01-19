// Location types for event types
export type LocationType = 'GOOGLE_MEET' | 'ZOOM' | 'PHONE' | 'IN_PERSON' | 'CUSTOM';

// Booking status
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

// Working hours configuration
export interface WorkingHours {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  start: string; // HH:mm format
  end: string; // HH:mm format
}

// Custom question for booking form
export interface CustomQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[]; // For select type
}

// Time slot for availability display
export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

// Busy block from calendar
export interface BusyBlock {
  start: Date;
  end: Date;
  calendarId: string;
}

// Availability request parameters
export interface AvailabilityRequest {
  eventTypeId: string;
  startDate: Date;
  endDate: Date;
  timezone: string;
}

// Availability response
export interface AvailabilityResponse {
  slots: TimeSlot[];
  timezone: string;
}

// Booking request
export interface BookingRequest {
  eventTypeId: string;
  startTime: Date;
  timezone: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  attendeeCompany?: string;
  attendeeNotes?: string;
  customResponses?: Record<string, string>;
  idempotencyKey?: string;
}

// Booking response
export interface BookingResponse {
  success: boolean;
  booking?: {
    uid: string;
    startTime: Date;
    endTime: Date;
    meetingUrl?: string;
  };
  error?: string;
}

// Google Calendar types
export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  backgroundColor?: string;
  accessRole: string;
  primary?: boolean;
}

export interface GoogleFreeBusyResponse {
  calendars: {
    [calendarId: string]: {
      busy: Array<{
        start: string;
        end: string;
      }>;
      errors?: Array<{
        domain: string;
        reason: string;
      }>;
    };
  };
}

// Event type for creating Google Calendar events
export interface CalendarEventData {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timezone: string;
  attendees: Array<{ email: string; displayName?: string }>;
  location?: string;
  conferenceData?: boolean; // Auto-create Google Meet
}

// Calendar event fetched from Google Calendar (for display)
export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
  accountEmail: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location?: string;
  meetingUrl?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
}

// Calendar info for filtering
export interface CalendarInfo {
  id: string;
  name: string;
  color?: string;
  accountEmail: string;
}

