import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSlotAvailable } from '@/lib/availability';
import { createCalendarEvent } from '@/lib/google-calendar';
import { sendBookingConfirmationEmail, sendHostNotificationEmail } from '@/lib/email';
import { bookingSchema } from '@/lib/validations';
import { rateLimit, RATE_LIMITS, getClientIP } from '@/lib/rate-limit';
import { hashString } from '@/lib/encryption';
import { addMinutes } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

// GET /api/bookings - List bookings (admin only)
export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        eventType: {
          select: { name: true, duration: true, locationType: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

// POST /api/bookings - Create a new booking (public)
export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip = getClientIP(request);
    const rateLimitResult = rateLimit(`booking:${ip}`, RATE_LIMITS.booking);
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

    const body = await request.json();
    const validation = bookingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const {
      eventTypeId,
      startTime: startTimeStr,
      timezone,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      attendeeCompany,
      attendeeNotes,
      customResponses,
      idempotencyKey: providedIdempotencyKey,
    } = validation.data;

    const startTime = new Date(startTimeStr);

    // Generate idempotency key if not provided
    const idempotencyKey =
      providedIdempotencyKey ||
      hashString(`${eventTypeId}:${startTimeStr}:${attendeeEmail}:${Date.now()}`);

    // Check for existing booking with same idempotency key
    const existingBooking = await prisma.booking.findUnique({
      where: { idempotencyKey },
    });

    if (existingBooking) {
      // Return existing booking (idempotent response)
      return NextResponse.json({
        success: true,
        booking: {
          uid: existingBooking.uid,
          startTime: existingBooking.startTime,
          endTime: existingBooking.endTime,
          meetingUrl: existingBooking.meetingUrl,
        },
      });
    }

    // Get event type with calendars
    const eventType = await prisma.eventType.findUnique({
      where: { id: eventTypeId },
      include: {
        user: {
          select: { id: true, name: true, email: true, timezone: true },
        },
        calendars: {
          where: { isDestination: true },
          include: {
            calendar: {
              include: { connectedAccount: true },
            },
          },
        },
      },
    });

    if (!eventType || !eventType.isActive) {
      return NextResponse.json(
        { error: 'Event type not found or not active' },
        { status: 404 }
      );
    }

    const endTime = addMinutes(startTime, eventType.duration);

    // Check slot availability (server-side validation)
    const available = await isSlotAvailable(eventTypeId, startTime, endTime);
    if (!available) {
      return NextResponse.json(
        { error: 'This time slot is no longer available' },
        { status: 409 }
      );
    }

    // Get destination calendar
    const destinationCalendarAssoc = eventType.calendars[0];
    if (!destinationCalendarAssoc) {
      return NextResponse.json(
        { error: 'No destination calendar configured' },
        { status: 500 }
      );
    }

    const destinationCalendar = destinationCalendarAssoc.calendar;
    const connectedAccount = destinationCalendar.connectedAccount;

    // Create booking in a transaction with unique constraint
    const booking = await prisma.$transaction(async (tx) => {
      // Try to create the booking (unique constraint prevents double-booking)
      const newBooking = await tx.booking.create({
        data: {
          uid: uuidv4(),
          userId: eventType.userId,
          eventTypeId,
          startTime,
          endTime,
          timezone,
          attendeeName,
          attendeeEmail,
          attendeePhone,
          attendeeCompany,
          attendeeNotes,
          customResponses: customResponses as Record<string, string> | undefined,
          idempotencyKey,
          status: eventType.requiresConfirmation ? 'PENDING' : 'CONFIRMED',
        },
      });

      return newBooking;
    });

    // Create Google Calendar event
    let meetingUrl: string | undefined;
    let googleEventId: string | undefined;

    try {
      const shouldCreateMeet = eventType.locationType === 'GOOGLE_MEET';

      const calendarResult = await createCalendarEvent(
        connectedAccount.id,
        destinationCalendar.googleCalendarId,
        {
          summary: `${eventType.name} with ${attendeeName}`,
          description: `Booked via Calendar Booking\n\nAttendee: ${attendeeName}\nEmail: ${attendeeEmail}${attendeeNotes ? `\n\nNotes: ${attendeeNotes}` : ''}`,
          start: startTime,
          end: endTime,
          timezone,
          attendees: [
            { email: attendeeEmail, displayName: attendeeName },
            { email: eventType.user.email!, displayName: eventType.user.name || undefined },
          ],
          location: eventType.locationValue || undefined,
          conferenceData: shouldCreateMeet,
        }
      );

      googleEventId = calendarResult.eventId;
      meetingUrl = calendarResult.meetingUrl;

      // Update booking with Google Calendar info
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          googleEventId,
          googleCalendarId: destinationCalendar.googleCalendarId,
          meetingUrl,
        },
      });
    } catch (calendarError) {
      console.error('Error creating calendar event:', calendarError);
      // Booking is still valid even if calendar event creation fails
    }

    // Send confirmation emails
    try {
      const emailData = {
        attendeeName,
        attendeeEmail,
        hostName: eventType.user.name || 'Host',
        hostEmail: eventType.user.email!,
        eventTypeName: eventType.name,
        startTime,
        endTime,
        timezone,
        meetingUrl,
        location: eventType.locationValue || undefined,
        bookingUid: booking.uid,
      };

      await Promise.all([
        sendBookingConfirmationEmail(emailData),
        sendHostNotificationEmail(emailData),
      ]);
    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      // Booking is still valid even if email fails
    }

    return NextResponse.json(
      {
        success: true,
        booking: {
          uid: booking.uid,
          startTime: booking.startTime,
          endTime: booking.endTime,
          meetingUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating booking:', error);

    // Handle unique constraint violation (race condition - slot taken)
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'This time slot is no longer available' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
