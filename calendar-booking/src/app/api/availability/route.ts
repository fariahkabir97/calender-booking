import { NextResponse } from 'next/server';
import { getSlotsGroupedByDate } from '@/lib/availability';
import { availabilitySchema } from '@/lib/validations';
import { rateLimit, RATE_LIMITS, getClientIP } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';

// GET /api/availability - Get available slots for an event type
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventTypeId = url.searchParams.get('eventTypeId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const timezone = url.searchParams.get('timezone');

    // Rate limit by IP
    const ip = getClientIP(request);
    const rateLimitResult = rateLimit(`availability:${ip}`, RATE_LIMITS.availability);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
          },
        }
      );
    }

    // Validate parameters
    const validation = availabilitySchema.safeParse({
      eventTypeId,
      startDate,
      endDate,
      timezone,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verify event type exists and is active
    const eventType = await prisma.eventType.findUnique({
      where: { id: validation.data.eventTypeId },
      select: { id: true, isActive: true, userId: true },
    });

    if (!eventType || !eventType.isActive) {
      return NextResponse.json(
        { error: 'Event type not found or not active' },
        { status: 404 }
      );
    }

    // Get available slots grouped by date
    const slotsByDate = await getSlotsGroupedByDate(
      validation.data.eventTypeId,
      new Date(validation.data.startDate),
      new Date(validation.data.endDate),
      validation.data.timezone
    );

    return NextResponse.json({
      slots: slotsByDate,
      timezone: validation.data.timezone,
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
