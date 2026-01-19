import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteCalendarEvent, updateCalendarEvent } from '@/lib/google-calendar';
import { sendCancellationEmail } from '@/lib/email';
import { cancelBookingSchema, rescheduleBookingSchema } from '@/lib/validations';
import { isSlotAvailable } from '@/lib/availability';
import { addMinutes } from 'date-fns';

interface RouteParams {
  params: Promise<{ uid: string }>;
}

// GET /api/bookings/[uid] - Get a single booking
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { uid } = await params;

    const booking = await prisma.booking.findUnique({
      where: { uid },
      include: {
        eventType: {
          select: {
            name: true,
            duration: true,
            locationType: true,
            locationValue: true,
            description: true,
          },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Don't expose sensitive information to public
    return NextResponse.json({
      booking: {
        uid: booking.uid,
        status: booking.status,
        startTime: booking.startTime,
        endTime: booking.endTime,
        timezone: booking.timezone,
        attendeeName: booking.attendeeName,
        attendeeEmail: booking.attendeeEmail,
        meetingUrl: booking.meetingUrl,
        eventType: booking.eventType,
        hostName: booking.user.name,
      },
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}

// DELETE /api/bookings/[uid] - Cancel a booking
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { uid } = await params;
    const body = await request.json().catch(() => ({}));
    const validation = cancelBookingSchema.safeParse(body);

    const booking = await prisma.booking.findUnique({
      where: { uid },
      include: {
        eventType: {
          select: { name: true },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 });
    }

    // Check authorization - either the booker (by email in body) or the admin
    const session = await getSession();
    const isAdmin = session?.user?.id === booking.userId;
    const bookerEmail = body.email?.toLowerCase();
    const isBooker = bookerEmail === booking.attendeeEmail.toLowerCase();

    if (!isAdmin && !isBooker) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update booking status
    await prisma.booking.update({
      where: { uid },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: validation.success ? validation.data.reason : undefined,
      },
    });

    // Delete Google Calendar event if exists
    if (booking.googleEventId && booking.googleCalendarId) {
      try {
        const calendar = await prisma.calendar.findFirst({
          where: {
            userId: booking.userId,
            googleCalendarId: booking.googleCalendarId,
          },
          include: { connectedAccount: true },
        });

        if (calendar) {
          await deleteCalendarEvent(
            calendar.connectedAccountId,
            booking.googleCalendarId,
            booking.googleEventId
          );
        }
      } catch (calendarError) {
        console.error('Error deleting calendar event:', calendarError);
        // Continue even if calendar deletion fails
      }
    }

    // Send cancellation email
    try {
      await sendCancellationEmail({
        attendeeName: booking.attendeeName,
        attendeeEmail: booking.attendeeEmail,
        hostName: booking.user.name || 'Host',
        hostEmail: booking.user.email!,
        eventTypeName: booking.eventType.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        timezone: booking.timezone,
        bookingUid: booking.uid,
        cancelReason: validation.success ? validation.data.reason : undefined,
      });
    } catch (emailError) {
      console.error('Error sending cancellation email:', emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}

// PATCH /api/bookings/[uid] - Reschedule a booking
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { uid } = await params;
    const body = await request.json();
    const validation = rescheduleBookingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { newStartTime: newStartTimeStr, timezone } = validation.data;
    const newStartTime = new Date(newStartTimeStr);

    const booking = await prisma.booking.findUnique({
      where: { uid },
      include: {
        eventType: {
          select: { id: true, name: true, duration: true },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot reschedule a cancelled or completed booking' },
        { status: 400 }
      );
    }

    // Check authorization
    const session = await getSession();
    const isAdmin = session?.user?.id === booking.userId;
    const bookerEmail = body.email?.toLowerCase();
    const isBooker = bookerEmail === booking.attendeeEmail.toLowerCase();

    if (!isAdmin && !isBooker) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newEndTime = addMinutes(newStartTime, booking.eventType.duration);

    // Check if new slot is available
    const available = await isSlotAvailable(booking.eventTypeId, newStartTime, newEndTime);
    if (!available) {
      return NextResponse.json(
        { error: 'The selected time slot is not available' },
        { status: 409 }
      );
    }

    // Update booking
    await prisma.booking.update({
      where: { uid },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
        timezone,
        rescheduledFrom: booking.uid,
      },
    });

    // Update Google Calendar event if exists
    if (booking.googleEventId && booking.googleCalendarId) {
      try {
        const calendar = await prisma.calendar.findFirst({
          where: {
            userId: booking.userId,
            googleCalendarId: booking.googleCalendarId,
          },
          include: { connectedAccount: true },
        });

        if (calendar) {
          await updateCalendarEvent(
            calendar.connectedAccountId,
            booking.googleCalendarId,
            booking.googleEventId,
            {
              start: newStartTime,
              end: newEndTime,
              timezone,
            }
          );
        }
      } catch (calendarError) {
        console.error('Error updating calendar event:', calendarError);
      }
    }

    return NextResponse.json({
      success: true,
      booking: {
        uid: booking.uid,
        startTime: newStartTime,
        endTime: newEndTime,
      },
    });
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    return NextResponse.json(
      { error: 'Failed to reschedule booking' },
      { status: 500 }
    );
  }
}
