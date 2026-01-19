import {
  addMinutes,
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  isAfter,
  isBefore,
  areIntervalsOverlapping,
  addDays,
  getDay,
  format,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { prisma } from './prisma';
import { getCompositeBusy } from './google-calendar';
import type { TimeSlot, BusyBlock, WorkingHours } from '@/types';

interface GenerateSlotsOptions {
  eventTypeId: string;
  startDate: Date;
  endDate: Date;
  requestTimezone: string;
}

interface EventTypeConfig {
  userId: string;
  duration: number;
  bufferBefore: number;
  bufferAfter: number;
  minimumNotice: number;
  schedulingWindow: number;
  slotInterval: number;
  workingHours: WorkingHours[];
  treatTentativeAsBusy: boolean;
  includeAllDayEvents: boolean;
  timezone: string; // Admin's timezone
}

// Parse working hours from JSON
function parseWorkingHours(workingHours: unknown): WorkingHours[] {
  if (typeof workingHours === 'string') {
    return JSON.parse(workingHours);
  }
  return workingHours as WorkingHours[];
}

// Get event type configuration
async function getEventTypeConfig(eventTypeId: string): Promise<EventTypeConfig | null> {
  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
    include: {
      user: {
        select: { timezone: true },
      },
    },
  });

  if (!eventType) return null;

  return {
    userId: eventType.userId,
    duration: eventType.duration,
    bufferBefore: eventType.bufferBefore,
    bufferAfter: eventType.bufferAfter,
    minimumNotice: eventType.minimumNotice,
    schedulingWindow: eventType.schedulingWindow,
    slotInterval: eventType.slotInterval,
    workingHours: parseWorkingHours(eventType.workingHours),
    treatTentativeAsBusy: eventType.treatTentativeAsBusy,
    includeAllDayEvents: eventType.includeAllDayEvents,
    timezone: eventType.user.timezone,
  };
}

// Parse time string (HH:mm) to hours and minutes
function parseTimeString(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

// Generate candidate slots for a single day based on working hours
function generateDayCandidateSlots(
  date: Date,
  workingHours: WorkingHours[],
  duration: number,
  slotInterval: number,
  adminTimezone: string
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  const dayOfWeek = getDay(date); // 0 = Sunday, 1 = Monday, etc.

  // Find working hours for this day
  const dayConfig = workingHours.find((wh) => wh.day === dayOfWeek);
  if (!dayConfig) return slots;

  // Parse start and end times
  const { hours: startHours, minutes: startMinutes } = parseTimeString(dayConfig.start);
  const { hours: endHours, minutes: endMinutes } = parseTimeString(dayConfig.end);

  // Create start and end times in admin's timezone
  let currentSlotStart = fromZonedTime(
    setMinutes(setHours(startOfDay(date), startHours), startMinutes),
    adminTimezone
  );
  const workingDayEnd = fromZonedTime(
    setMinutes(setHours(startOfDay(date), endHours), endMinutes),
    adminTimezone
  );

  // Generate slots at the configured interval
  while (true) {
    const slotEnd = addMinutes(currentSlotStart, duration);

    // Check if this slot fits within working hours
    if (isAfter(slotEnd, workingDayEnd)) break;

    slots.push({
      start: currentSlotStart,
      end: slotEnd,
    });

    currentSlotStart = addMinutes(currentSlotStart, slotInterval);
  }

  return slots;
}

// Check if a slot overlaps with any busy block (considering buffers)
function isSlotBusy(
  slotStart: Date,
  slotEnd: Date,
  busyBlocks: BusyBlock[],
  bufferBefore: number,
  bufferAfter: number
): boolean {
  // Expand the slot by buffers for collision detection
  const slotWithBufferStart = addMinutes(slotStart, -bufferBefore);
  const slotWithBufferEnd = addMinutes(slotEnd, bufferAfter);

  return busyBlocks.some((block) =>
    areIntervalsOverlapping(
      { start: slotWithBufferStart, end: slotWithBufferEnd },
      { start: block.start, end: block.end }
    )
  );
}

// Main function to generate available time slots
export async function generateAvailableSlots(
  options: GenerateSlotsOptions
): Promise<TimeSlot[]> {
  const { eventTypeId, startDate, endDate, requestTimezone } = options;

  // Get event type configuration
  const config = await getEventTypeConfig(eventTypeId);
  if (!config) {
    throw new Error('Event type not found');
  }

  const now = new Date();

  // Apply minimum notice constraint
  const minBookingTime = addMinutes(now, config.minimumNotice);

  // Apply scheduling window constraint
  const maxBookingDate = addDays(now, config.schedulingWindow);

  // Adjust date range based on constraints
  const effectiveStartDate = isAfter(startDate, minBookingTime) ? startDate : minBookingTime;
  const effectiveEndDate = isBefore(endDate, maxBookingDate) ? endDate : maxBookingDate;

  if (isAfter(effectiveStartDate, effectiveEndDate)) {
    return []; // No valid range
  }

  // Fetch busy blocks from all selected calendars
  const busyBlocks = await getCompositeBusy(
    config.userId,
    effectiveStartDate,
    effectiveEndDate
  );

  // Also fetch existing bookings to prevent double-booking
  const existingBookings = await prisma.booking.findMany({
    where: {
      userId: config.userId,
      status: { in: ['CONFIRMED', 'PENDING'] },
      startTime: { gte: effectiveStartDate },
      endTime: { lte: effectiveEndDate },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  // Add existing bookings to busy blocks
  const allBusyBlocks: BusyBlock[] = [
    ...busyBlocks,
    ...existingBookings.map((b) => ({
      start: b.startTime,
      end: b.endTime,
      calendarId: 'bookings',
    })),
  ];

  // Merge overlapping busy blocks for efficiency
  const mergedBusyBlocks = mergeBusyBlocks(allBusyBlocks);

  // Generate candidate slots for each day
  const slots: TimeSlot[] = [];
  let currentDate = startOfDay(effectiveStartDate);

  while (isBefore(currentDate, endOfDay(effectiveEndDate))) {
    const daySlots = generateDayCandidateSlots(
      toZonedTime(currentDate, config.timezone),
      config.workingHours,
      config.duration,
      config.slotInterval,
      config.timezone
    );

    for (const slot of daySlots) {
      // Skip slots that are before minimum booking time
      if (isBefore(slot.start, minBookingTime)) continue;

      // Skip slots that are after scheduling window
      if (isAfter(slot.start, maxBookingDate)) continue;

      // Check if slot is available
      const isBusy = isSlotBusy(
        slot.start,
        slot.end,
        mergedBusyBlocks,
        config.bufferBefore,
        config.bufferAfter
      );

      if (!isBusy) {
        slots.push({
          start: slot.start,
          end: slot.end,
          available: true,
        });
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return slots;
}

// Merge overlapping busy blocks
function mergeBusyBlocks(blocks: BusyBlock[]): BusyBlock[] {
  if (blocks.length === 0) return [];

  // Sort by start time
  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: BusyBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start.getTime() <= last.end.getTime()) {
      // Overlapping, merge by extending the end time if needed
      if (current.end.getTime() > last.end.getTime()) {
        last.end = current.end;
      }
    } else {
      // Non-overlapping, add as new block
      merged.push(current);
    }
  }

  return merged;
}

// Check if a specific slot is available (for booking validation)
export async function isSlotAvailable(
  eventTypeId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const config = await getEventTypeConfig(eventTypeId);
  if (!config) return false;

  const now = new Date();

  // Check minimum notice
  const minBookingTime = addMinutes(now, config.minimumNotice);
  if (isBefore(startTime, minBookingTime)) return false;

  // Check scheduling window
  const maxBookingDate = addDays(now, config.schedulingWindow);
  if (isAfter(startTime, maxBookingDate)) return false;

  // Check working hours
  const startInAdminTz = toZonedTime(startTime, config.timezone);
  const dayOfWeek = getDay(startInAdminTz);
  const dayConfig = config.workingHours.find((wh) => wh.day === dayOfWeek);

  if (!dayConfig) return false;

  const { hours: startHours, minutes: startMinutes } = parseTimeString(dayConfig.start);
  const { hours: endHours, minutes: endMinutes } = parseTimeString(dayConfig.end);

  const timeOfDay = format(startInAdminTz, 'HH:mm');
  const slotEndTime = format(toZonedTime(endTime, config.timezone), 'HH:mm');

  if (timeOfDay < dayConfig.start || slotEndTime > dayConfig.end) {
    return false;
  }

  // Check for conflicts with busy blocks
  const busyBlocks = await getCompositeBusy(
    config.userId,
    addMinutes(startTime, -config.bufferBefore),
    addMinutes(endTime, config.bufferAfter)
  );

  // Check existing bookings
  const existingBooking = await prisma.booking.findFirst({
    where: {
      userId: config.userId,
      status: { in: ['CONFIRMED', 'PENDING'] },
      OR: [
        {
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gt: startTime } },
          ],
        },
        {
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gte: endTime } },
          ],
        },
        {
          AND: [
            { startTime: { gte: startTime } },
            { endTime: { lte: endTime } },
          ],
        },
      ],
    },
  });

  if (existingBooking) return false;

  // Check calendar busy blocks
  const isBusy = isSlotBusy(
    startTime,
    endTime,
    busyBlocks,
    config.bufferBefore,
    config.bufferAfter
  );

  return !isBusy;
}

// Get slots grouped by date for calendar display
export async function getSlotsGroupedByDate(
  eventTypeId: string,
  startDate: Date,
  endDate: Date,
  timezone: string
): Promise<Record<string, TimeSlot[]>> {
  const slots = await generateAvailableSlots({
    eventTypeId,
    startDate,
    endDate,
    requestTimezone: timezone,
  });

  // Group slots by date in the user's timezone
  const grouped: Record<string, TimeSlot[]> = {};

  for (const slot of slots) {
    const dateKey = format(toZonedTime(slot.start, timezone), 'yyyy-MM-dd');

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }

    grouped[dateKey].push(slot);
  }

  return grouped;
}
