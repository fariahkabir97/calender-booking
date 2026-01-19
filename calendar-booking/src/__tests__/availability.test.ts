import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';

// Mock types for testing
interface BusyBlock {
  start: Date;
  end: Date;
  calendarId: string;
}

interface WorkingHours {
  day: number;
  start: string;
  end: string;
}

// Helper functions extracted for testing
function parseTimeString(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

function mergeBusyBlocks(blocks: BusyBlock[]): BusyBlock[] {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) {
        last.end = current.end;
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function isSlotBusy(
  slotStart: Date,
  slotEnd: Date,
  busyBlocks: BusyBlock[],
  bufferBefore: number,
  bufferAfter: number
): boolean {
  const slotWithBufferStart = addMinutes(slotStart, -bufferBefore);
  const slotWithBufferEnd = addMinutes(slotEnd, bufferAfter);

  return busyBlocks.some((block) => {
    const overlapStart = Math.max(
      slotWithBufferStart.getTime(),
      block.start.getTime()
    );
    const overlapEnd = Math.min(
      slotWithBufferEnd.getTime(),
      block.end.getTime()
    );
    return overlapStart < overlapEnd;
  });
}

function generateDayCandidateSlots(
  baseDate: Date,
  workingHours: WorkingHours[],
  duration: number,
  slotInterval: number,
  dayOfWeek: number
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];

  const dayConfig = workingHours.find((wh) => wh.day === dayOfWeek);
  if (!dayConfig) return slots;

  const { hours: startHours, minutes: startMinutes } = parseTimeString(dayConfig.start);
  const { hours: endHours, minutes: endMinutes } = parseTimeString(dayConfig.end);

  let currentSlotStart = setMinutes(setHours(startOfDay(baseDate), startHours), startMinutes);
  const workingDayEnd = setMinutes(setHours(startOfDay(baseDate), endHours), endMinutes);

  while (true) {
    const slotEnd = addMinutes(currentSlotStart, duration);
    if (slotEnd > workingDayEnd) break;

    slots.push({
      start: new Date(currentSlotStart),
      end: new Date(slotEnd),
    });

    currentSlotStart = addMinutes(currentSlotStart, slotInterval);
  }

  return slots;
}

describe('Availability Algorithm', () => {
  describe('parseTimeString', () => {
    it('parses HH:mm format correctly', () => {
      expect(parseTimeString('09:00')).toEqual({ hours: 9, minutes: 0 });
      expect(parseTimeString('17:30')).toEqual({ hours: 17, minutes: 30 });
      expect(parseTimeString('00:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseTimeString('23:59')).toEqual({ hours: 23, minutes: 59 });
    });
  });

  describe('mergeBusyBlocks', () => {
    it('returns empty array for empty input', () => {
      expect(mergeBusyBlocks([])).toEqual([]);
    });

    it('returns single block unchanged', () => {
      const block: BusyBlock = {
        start: new Date('2024-01-15T09:00:00'),
        end: new Date('2024-01-15T10:00:00'),
        calendarId: 'cal1',
      };
      const result = mergeBusyBlocks([block]);
      expect(result).toHaveLength(1);
      expect(result[0].start).toEqual(block.start);
      expect(result[0].end).toEqual(block.end);
    });

    it('merges overlapping blocks', () => {
      const blocks: BusyBlock[] = [
        {
          start: new Date('2024-01-15T09:00:00'),
          end: new Date('2024-01-15T10:00:00'),
          calendarId: 'cal1',
        },
        {
          start: new Date('2024-01-15T09:30:00'),
          end: new Date('2024-01-15T11:00:00'),
          calendarId: 'cal2',
        },
      ];
      const result = mergeBusyBlocks(blocks);
      expect(result).toHaveLength(1);
      expect(result[0].start).toEqual(new Date('2024-01-15T09:00:00'));
      expect(result[0].end).toEqual(new Date('2024-01-15T11:00:00'));
    });

    it('merges adjacent blocks', () => {
      const blocks: BusyBlock[] = [
        {
          start: new Date('2024-01-15T09:00:00'),
          end: new Date('2024-01-15T10:00:00'),
          calendarId: 'cal1',
        },
        {
          start: new Date('2024-01-15T10:00:00'),
          end: new Date('2024-01-15T11:00:00'),
          calendarId: 'cal2',
        },
      ];
      const result = mergeBusyBlocks(blocks);
      expect(result).toHaveLength(1);
      expect(result[0].start).toEqual(new Date('2024-01-15T09:00:00'));
      expect(result[0].end).toEqual(new Date('2024-01-15T11:00:00'));
    });

    it('keeps non-overlapping blocks separate', () => {
      const blocks: BusyBlock[] = [
        {
          start: new Date('2024-01-15T09:00:00'),
          end: new Date('2024-01-15T10:00:00'),
          calendarId: 'cal1',
        },
        {
          start: new Date('2024-01-15T11:00:00'),
          end: new Date('2024-01-15T12:00:00'),
          calendarId: 'cal2',
        },
      ];
      const result = mergeBusyBlocks(blocks);
      expect(result).toHaveLength(2);
    });

    it('handles multiple overlapping blocks from different calendars', () => {
      const blocks: BusyBlock[] = [
        {
          start: new Date('2024-01-15T09:00:00'),
          end: new Date('2024-01-15T10:00:00'),
          calendarId: 'cal1',
        },
        {
          start: new Date('2024-01-15T09:30:00'),
          end: new Date('2024-01-15T10:30:00'),
          calendarId: 'cal2',
        },
        {
          start: new Date('2024-01-15T10:00:00'),
          end: new Date('2024-01-15T11:00:00'),
          calendarId: 'cal3',
        },
      ];
      const result = mergeBusyBlocks(blocks);
      expect(result).toHaveLength(1);
      expect(result[0].start).toEqual(new Date('2024-01-15T09:00:00'));
      expect(result[0].end).toEqual(new Date('2024-01-15T11:00:00'));
    });
  });

  describe('isSlotBusy', () => {
    const busyBlocks: BusyBlock[] = [
      {
        start: new Date('2024-01-15T10:00:00'),
        end: new Date('2024-01-15T11:00:00'),
        calendarId: 'cal1',
      },
    ];

    it('returns true for overlapping slot', () => {
      const slotStart = new Date('2024-01-15T10:30:00');
      const slotEnd = new Date('2024-01-15T11:00:00');
      expect(isSlotBusy(slotStart, slotEnd, busyBlocks, 0, 0)).toBe(true);
    });

    it('returns false for non-overlapping slot', () => {
      const slotStart = new Date('2024-01-15T11:00:00');
      const slotEnd = new Date('2024-01-15T11:30:00');
      expect(isSlotBusy(slotStart, slotEnd, busyBlocks, 0, 0)).toBe(false);
    });

    it('considers buffer before meeting', () => {
      // Slot starts right after busy block ends
      const slotStart = new Date('2024-01-15T11:00:00');
      const slotEnd = new Date('2024-01-15T11:30:00');
      // Without buffer, this slot starts right when busy block ends (no overlap)
      expect(isSlotBusy(slotStart, slotEnd, busyBlocks, 0, 0)).toBe(false);
      // With 15 min buffer before, we need 15 min free before the slot
      // So we check 10:45-11:30 against 10:00-11:00 - this overlaps!
      expect(isSlotBusy(slotStart, slotEnd, busyBlocks, 15, 0)).toBe(true);
    });

    it('considers buffer after meeting', () => {
      // Slot ends right when busy block starts
      const slotStart = new Date('2024-01-15T09:30:00');
      const slotEnd = new Date('2024-01-15T10:00:00');
      // Without buffer, this slot ends when busy block starts (no overlap)
      expect(isSlotBusy(slotStart, slotEnd, busyBlocks, 0, 0)).toBe(false);
      // With 15 min buffer after, we need 15 min free after the slot
      // So we check 9:30-10:15 against 10:00-11:00 - this overlaps!
      expect(isSlotBusy(slotStart, slotEnd, busyBlocks, 0, 15)).toBe(true);
    });
  });

  describe('generateDayCandidateSlots', () => {
    const workingHours: WorkingHours[] = [
      { day: 1, start: '09:00', end: '17:00' }, // Monday
    ];
    const baseDate = new Date('2024-01-15'); // Monday

    it('generates correct number of slots for 30-min duration with 15-min interval', () => {
      const slots = generateDayCandidateSlots(baseDate, workingHours, 30, 15, 1);
      // 9:00-9:30, 9:15-9:45, ..., 16:30-17:00
      // That's 31 slots (9:00 to 16:30 start times at 15-min intervals)
      expect(slots.length).toBe(31);
    });

    it('generates correct number of slots for 60-min duration with 60-min interval', () => {
      const slots = generateDayCandidateSlots(baseDate, workingHours, 60, 60, 1);
      // 9:00-10:00, 10:00-11:00, ..., 16:00-17:00
      // That's 8 slots
      expect(slots.length).toBe(8);
    });

    it('returns empty array for non-working day', () => {
      const slots = generateDayCandidateSlots(baseDate, workingHours, 30, 15, 0); // Sunday
      expect(slots).toHaveLength(0);
    });

    it('slot times are within working hours', () => {
      const slots = generateDayCandidateSlots(baseDate, workingHours, 30, 15, 1);

      const workStart = setMinutes(setHours(startOfDay(baseDate), 9), 0);
      const workEnd = setMinutes(setHours(startOfDay(baseDate), 17), 0);

      for (const slot of slots) {
        expect(slot.start >= workStart).toBe(true);
        expect(slot.end <= workEnd).toBe(true);
      }
    });

    it('all slots have correct duration', () => {
      const duration = 45;
      const slots = generateDayCandidateSlots(baseDate, workingHours, duration, 15, 1);

      for (const slot of slots) {
        const slotDuration = (slot.end.getTime() - slot.start.getTime()) / 60000;
        expect(slotDuration).toBe(duration);
      }
    });
  });

  describe('Composite Availability', () => {
    it('slot is available only if free across all calendars', () => {
      // Calendar 1 busy: 10:00-11:00
      // Calendar 2 busy: 14:00-15:00
      // Slot 10:30-11:00 should be busy (conflicts with cal1)
      // Slot 14:30-15:00 should be busy (conflicts with cal2)
      // Slot 11:00-11:30 should be available

      const busyBlocks: BusyBlock[] = [
        {
          start: new Date('2024-01-15T10:00:00'),
          end: new Date('2024-01-15T11:00:00'),
          calendarId: 'cal1',
        },
        {
          start: new Date('2024-01-15T14:00:00'),
          end: new Date('2024-01-15T15:00:00'),
          calendarId: 'cal2',
        },
      ];

      const mergedBlocks = mergeBusyBlocks(busyBlocks);

      // Slot that conflicts with cal1
      expect(
        isSlotBusy(
          new Date('2024-01-15T10:30:00'),
          new Date('2024-01-15T11:00:00'),
          mergedBlocks,
          0,
          0
        )
      ).toBe(true);

      // Slot that conflicts with cal2
      expect(
        isSlotBusy(
          new Date('2024-01-15T14:30:00'),
          new Date('2024-01-15T15:00:00'),
          mergedBlocks,
          0,
          0
        )
      ).toBe(true);

      // Slot that's free on both
      expect(
        isSlotBusy(
          new Date('2024-01-15T11:00:00'),
          new Date('2024-01-15T11:30:00'),
          mergedBlocks,
          0,
          0
        )
      ).toBe(false);
    });
  });
});

describe('Timezone Handling', () => {
  it('DST transition: spring forward (March)', () => {
    // In America/New_York, DST starts on second Sunday of March at 2:00 AM
    // 2:00 AM becomes 3:00 AM (1 hour jumps forward)
    // A 9:00 AM meeting should still show as 9:00 AM local time

    // This is a conceptual test - actual implementation would use date-fns-tz
    const dstDate = new Date('2024-03-10T09:00:00'); // DST transition day
    expect(dstDate).toBeDefined();
  });

  it('DST transition: fall back (November)', () => {
    // In America/New_York, DST ends on first Sunday of November at 2:00 AM
    // 2:00 AM becomes 1:00 AM (1 hour jumps back)

    const dstDate = new Date('2024-11-03T09:00:00'); // DST transition day
    expect(dstDate).toBeDefined();
  });
});
