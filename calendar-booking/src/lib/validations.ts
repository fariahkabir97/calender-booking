import { z } from 'zod';

// Event type creation/update schema
export const eventTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(1000).optional(),
  duration: z.number().min(5).max(480), // 5 minutes to 8 hours
  color: z.string().optional(),
  locationType: z.enum(['GOOGLE_MEET', 'ZOOM', 'PHONE', 'IN_PERSON', 'CUSTOM']),
  locationValue: z.string().optional(),
  bufferBefore: z.number().min(0).max(120).default(0),
  bufferAfter: z.number().min(0).max(120).default(0),
  minimumNotice: z.number().min(0).max(10080).default(240), // Up to 1 week
  schedulingWindow: z.number().min(1).max(365).default(30), // Up to 1 year
  slotInterval: z.number().min(5).max(60).default(15),
  workingHours: z.array(
    z.object({
      day: z.number().min(0).max(6),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
  ),
  requiresConfirmation: z.boolean().default(false),
  collectPhone: z.boolean().default(false),
  collectCompany: z.boolean().default(false),
  customQuestions: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1).max(200),
        type: z.enum(['text', 'textarea', 'select']),
        required: z.boolean(),
        options: z.array(z.string()).optional(),
      })
    )
    .optional(),
  treatTentativeAsBusy: z.boolean().default(true),
  includeAllDayEvents: z.boolean().default(true),
  calendarIds: z.array(z.string()).min(1, 'At least one calendar must be selected'),
  destinationCalendarId: z.string(),
});

// Booking request schema
export const bookingSchema = z.object({
  eventTypeId: z.string().min(1),
  startTime: z.string().datetime(),
  timezone: z.string().min(1),
  attendeeName: z.string().min(1, 'Name is required').max(100),
  attendeeEmail: z.string().email('Valid email is required'),
  attendeePhone: z.string().max(20).optional(),
  attendeeCompany: z.string().max(100).optional(),
  attendeeNotes: z.string().max(1000).optional(),
  customResponses: z.record(z.string(), z.string()).optional(),
  idempotencyKey: z.string().optional(),
});

// Availability request schema
export const availabilitySchema = z.object({
  eventTypeId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().min(1),
});

// Calendar selection schema
export const calendarSelectionSchema = z.object({
  calendarIds: z.array(z.string()),
});

// User settings schema
export const userSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1),
});

// Cancel booking schema
export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

// Reschedule booking schema
export const rescheduleBookingSchema = z.object({
  newStartTime: z.string().datetime(),
  timezone: z.string().min(1),
});

export type EventTypeInput = z.infer<typeof eventTypeSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
