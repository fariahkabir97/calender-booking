import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventTypeSchema } from '@/lib/validations';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/event-types/[id] - Get a single event type
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventType = await prisma.eventType.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        calendars: {
          include: {
            calendar: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    });

    if (!eventType) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }

    return NextResponse.json({ eventType });
  } catch (error) {
    console.error('Error fetching event type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event type' },
      { status: 500 }
    );
  }
}

// PUT /api/event-types/[id] - Update an event type
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify event type belongs to user
    const existingEventType = await prisma.eventType.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingEventType) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = eventTypeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { calendarIds, destinationCalendarId, ...eventTypeData } = validation.data;

    // Verify calendars belong to the user
    const calendars = await prisma.calendar.findMany({
      where: {
        userId: session.user.id,
        id: { in: [...calendarIds, destinationCalendarId] },
      },
    });

    if (calendars.length !== new Set([...calendarIds, destinationCalendarId]).size) {
      return NextResponse.json(
        { error: 'One or more calendars not found' },
        { status: 400 }
      );
    }

    // Check if destination calendar is writable
    const destCalendar = calendars.find((c) => c.id === destinationCalendarId);
    if (!destCalendar?.isWritable) {
      return NextResponse.json(
        { error: 'Destination calendar must be writable' },
        { status: 400 }
      );
    }

    // Update event type and calendar associations in a transaction
    const eventType = await prisma.$transaction(async (tx) => {
      // Delete existing calendar associations
      await tx.eventTypeCalendar.deleteMany({
        where: { eventTypeId: id },
      });

      // Update event type and create new associations
      return tx.eventType.update({
        where: { id },
        data: {
          ...eventTypeData,
          calendars: {
            create: calendarIds.map((calendarId) => ({
              calendarId,
              isDestination: calendarId === destinationCalendarId,
            })),
          },
        },
        include: {
          calendars: {
            include: {
              calendar: {
                select: { id: true, name: true, color: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({ eventType });
  } catch (error) {
    console.error('Error updating event type:', error);

    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'An event type with this URL already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update event type' },
      { status: 500 }
    );
  }
}

// DELETE /api/event-types/[id] - Delete an event type
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify event type belongs to user
    const eventType = await prisma.eventType.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!eventType) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }

    // Delete event type (cascades to bookings and calendar associations)
    await prisma.eventType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event type:', error);
    return NextResponse.json(
      { error: 'Failed to delete event type' },
      { status: 500 }
    );
  }
}
