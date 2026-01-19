import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCompositeEvents } from '@/lib/google-calendar';

// GET /api/events - Get aggregated events from all connected calendars
export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const timeMin = new Date(startDate);
    const timeMax = new Date(endDate);

    // Validate dates
    if (isNaN(timeMin.getTime()) || isNaN(timeMax.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Limit range to prevent excessive API calls (max 90 days)
    const daysDiff = (timeMax.getTime() - timeMin.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 90 days' },
        { status: 400 }
      );
    }

    const { events, calendars } = await getCompositeEvents(
      session.user.id,
      timeMin,
      timeMax
    );

    // Serialize dates for JSON response
    const serializedEvents = events.map((event) => ({
      ...event,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
    }));

    return NextResponse.json({ events: serializedEvents, calendars });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
