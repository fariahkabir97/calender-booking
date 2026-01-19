import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventTypeSchema } from '@/lib/validations';

// GET /api/event-types - List all event types for the current user
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventTypes = await prisma.eventType.findMany({
      where: { userId: session.user.id },
      include: {
        calendars: {
          include: {
            calendar: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ eventTypes });
  } catch (error) {
    console.error('Error fetching event types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event types' },
      { status: 500 }
    );
  }
}

// POST /api/event-types - Create a new event type
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = eventTypeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const {
      calendarIds,
      destinationCalendarId,
      ...eventTypeData
    } = validation.data;

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

    // Create event type with calendar associations
    const eventType = await prisma.eventType.create({
      data: {
        ...eventTypeData,
        userId: session.user.id,
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

    return NextResponse.json({ eventType }, { status: 201 });
  } catch (error) {
    console.error('Error creating event type:', error);

    // Handle unique constraint violation (duplicate slug)
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'An event type with this URL already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create event type' },
      { status: 500 }
    );
  }
}
