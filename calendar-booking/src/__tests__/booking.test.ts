import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Types for testing
interface BookingRequest {
  eventTypeId: string;
  startTime: Date;
  attendeeEmail: string;
  idempotencyKey?: string;
}

interface Booking {
  id: string;
  uid: string;
  startTime: Date;
  endTime: Date;
  status: string;
}

// Simulated database for testing double-booking prevention
class MockDatabase {
  private bookings: Map<string, Booking> = new Map();
  private idempotencyKeys: Map<string, Booking> = new Map();
  private locks: Set<string> = new Set();

  async createBooking(
    request: BookingRequest,
    endTime: Date,
    userId: string
  ): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    // Generate slot key for uniqueness check
    const slotKey = `${userId}:${request.startTime.toISOString()}:${endTime.toISOString()}`;

    // Check idempotency key first
    if (request.idempotencyKey) {
      const existingBooking = this.idempotencyKeys.get(request.idempotencyKey);
      if (existingBooking) {
        return { success: true, booking: existingBooking };
      }
    }

    // Acquire lock (simulate database lock)
    if (this.locks.has(slotKey)) {
      return { success: false, error: 'Slot is being booked' };
    }
    this.locks.add(slotKey);

    try {
      // Check for existing booking at this slot
      for (const booking of this.bookings.values()) {
        if (
          booking.startTime.getTime() === request.startTime.getTime() &&
          booking.endTime.getTime() === endTime.getTime() &&
          booking.status !== 'CANCELLED'
        ) {
          return { success: false, error: 'Slot no longer available' };
        }
      }

      // Create booking
      const booking: Booking = {
        id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uid: `uid_${Date.now()}`,
        startTime: request.startTime,
        endTime,
        status: 'CONFIRMED',
      };

      this.bookings.set(booking.id, booking);

      if (request.idempotencyKey) {
        this.idempotencyKeys.set(request.idempotencyKey, booking);
      }

      return { success: true, booking };
    } finally {
      this.locks.delete(slotKey);
    }
  }

  reset() {
    this.bookings.clear();
    this.idempotencyKeys.clear();
    this.locks.clear();
  }
}

describe('Booking Anti-Double-Booking', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
  });

  describe('Sequential Booking', () => {
    it('allows first booking for a slot', async () => {
      const request: BookingRequest = {
        eventTypeId: 'evt1',
        startTime: new Date('2024-01-15T10:00:00Z'),
        attendeeEmail: 'user1@example.com',
      };

      const result = await mockDb.createBooking(
        request,
        new Date('2024-01-15T10:30:00Z'),
        'admin1'
      );

      expect(result.success).toBe(true);
      expect(result.booking).toBeDefined();
    });

    it('rejects second booking for the same slot', async () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T10:30:00Z');

      // First booking
      const result1 = await mockDb.createBooking(
        {
          eventTypeId: 'evt1',
          startTime,
          attendeeEmail: 'user1@example.com',
        },
        endTime,
        'admin1'
      );
      expect(result1.success).toBe(true);

      // Second booking for same slot
      const result2 = await mockDb.createBooking(
        {
          eventTypeId: 'evt1',
          startTime,
          attendeeEmail: 'user2@example.com',
        },
        endTime,
        'admin1'
      );
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Slot no longer available');
    });

    it('allows booking different slots', async () => {
      const endTime1 = new Date('2024-01-15T10:30:00Z');
      const endTime2 = new Date('2024-01-15T11:30:00Z');

      const result1 = await mockDb.createBooking(
        {
          eventTypeId: 'evt1',
          startTime: new Date('2024-01-15T10:00:00Z'),
          attendeeEmail: 'user1@example.com',
        },
        endTime1,
        'admin1'
      );

      const result2 = await mockDb.createBooking(
        {
          eventTypeId: 'evt1',
          startTime: new Date('2024-01-15T11:00:00Z'),
          attendeeEmail: 'user2@example.com',
        },
        endTime2,
        'admin1'
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('Idempotency', () => {
    it('returns same booking for duplicate request with same idempotency key', async () => {
      const request: BookingRequest = {
        eventTypeId: 'evt1',
        startTime: new Date('2024-01-15T10:00:00Z'),
        attendeeEmail: 'user1@example.com',
        idempotencyKey: 'idem_123',
      };
      const endTime = new Date('2024-01-15T10:30:00Z');

      const result1 = await mockDb.createBooking(request, endTime, 'admin1');
      const result2 = await mockDb.createBooking(request, endTime, 'admin1');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.booking?.id).toBe(result2.booking?.id);
    });

    it('creates different bookings for different idempotency keys', async () => {
      const endTime = new Date('2024-01-15T10:30:00Z');

      const result1 = await mockDb.createBooking(
        {
          eventTypeId: 'evt1',
          startTime: new Date('2024-01-15T10:00:00Z'),
          attendeeEmail: 'user1@example.com',
          idempotencyKey: 'idem_1',
        },
        endTime,
        'admin1'
      );

      // Different slot, different idempotency key
      const result2 = await mockDb.createBooking(
        {
          eventTypeId: 'evt1',
          startTime: new Date('2024-01-15T11:00:00Z'),
          attendeeEmail: 'user2@example.com',
          idempotencyKey: 'idem_2',
        },
        new Date('2024-01-15T11:30:00Z'),
        'admin1'
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.booking?.id).not.toBe(result2.booking?.id);
    });
  });

  describe('Concurrent Booking Attempts', () => {
    it('first-write-wins semantics', async () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T10:30:00Z');

      // Simulate concurrent requests by creating both before either completes
      const promise1 = mockDb.createBooking(
        {
          eventTypeId: 'evt1',
          startTime,
          attendeeEmail: 'user1@example.com',
        },
        endTime,
        'admin1'
      );

      const promise2 = mockDb.createBooking(
        {
          eventTypeId: 'evt1',
          startTime,
          attendeeEmail: 'user2@example.com',
        },
        endTime,
        'admin1'
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // One should succeed, one should fail
      const successes = [result1.success, result2.success].filter(Boolean);
      expect(successes.length).toBe(1);
    });
  });
});

describe('Booking Validation', () => {
  describe('Input Validation', () => {
    it('validates required email', () => {
      const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      expect(isValidEmail('valid@example.com')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });

    it('validates time is in the future', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3600000); // 1 hour ago
      const future = new Date(now.getTime() + 3600000); // 1 hour from now

      const isInFuture = (date: Date) => date.getTime() > now.getTime();

      expect(isInFuture(past)).toBe(false);
      expect(isInFuture(future)).toBe(true);
    });

    it('validates minimum notice period', () => {
      const now = new Date();
      const minimumNoticeMinutes = 240; // 4 hours

      const meetMinimumNotice = (startTime: Date) => {
        const minTime = new Date(now.getTime() + minimumNoticeMinutes * 60 * 1000);
        return startTime.getTime() >= minTime.getTime();
      };

      const tooSoon = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const okTime = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5 hours from now

      expect(meetMinimumNotice(tooSoon)).toBe(false);
      expect(meetMinimumNotice(okTime)).toBe(true);
    });

    it('validates within scheduling window', () => {
      const now = new Date();
      const schedulingWindowDays = 30;

      const isWithinWindow = (startTime: Date) => {
        const maxDate = new Date(now.getTime() + schedulingWindowDays * 24 * 60 * 60 * 1000);
        return startTime.getTime() <= maxDate.getTime();
      };

      const withinWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const beyondWindow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

      expect(isWithinWindow(withinWindow)).toBe(true);
      expect(isWithinWindow(beyondWindow)).toBe(false);
    });
  });

  describe('Slot Duration', () => {
    it('calculates correct end time', () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const durationMinutes = 30;

      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      expect(endTime).toEqual(new Date('2024-01-15T10:30:00Z'));
    });

    it('handles slots crossing hour boundaries', () => {
      const startTime = new Date('2024-01-15T10:45:00Z');
      const durationMinutes = 30;

      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      expect(endTime).toEqual(new Date('2024-01-15T11:15:00Z'));
    });
  });
});

describe('Idempotency Key Generation', () => {
  it('generates consistent keys for same input', () => {
    const generateKey = (eventTypeId: string, startTime: string, email: string) => {
      const input = `${eventTypeId}:${startTime}:${email}`;
      // Simple hash for testing
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    };

    const key1 = generateKey('evt1', '2024-01-15T10:00:00Z', 'user@example.com');
    const key2 = generateKey('evt1', '2024-01-15T10:00:00Z', 'user@example.com');

    expect(key1).toBe(key2);
  });

  it('generates different keys for different inputs', () => {
    const generateKey = (eventTypeId: string, startTime: string, email: string) => {
      const input = `${eventTypeId}:${startTime}:${email}`;
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    };

    const key1 = generateKey('evt1', '2024-01-15T10:00:00Z', 'user1@example.com');
    const key2 = generateKey('evt1', '2024-01-15T10:00:00Z', 'user2@example.com');

    expect(key1).not.toBe(key2);
  });
});
