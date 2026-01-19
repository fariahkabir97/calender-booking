import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncCalendars } from '@/lib/google-calendar';
import { calendarSelectionSchema } from '@/lib/validations';

// GET /api/calendars - List all calendars for the current user
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const calendars = await prisma.calendar.findMany({
      where: { userId: session.user.id },
      include: {
        connectedAccount: {
          select: { email: true, isValid: true },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ calendars });
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    );
  }
}

// POST /api/calendars - Update calendar selection
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = calendarSelectionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { calendarIds } = validation.data;

    // First, deselect all calendars
    await prisma.calendar.updateMany({
      where: { userId: session.user.id },
      data: { isSelected: false },
    });

    // Then, select the specified calendars
    if (calendarIds.length > 0) {
      await prisma.calendar.updateMany({
        where: {
          userId: session.user.id,
          id: { in: calendarIds },
        },
        data: { isSelected: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating calendar selection:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar selection' },
      { status: 500 }
    );
  }
}

// PUT /api/calendars - Sync calendars from all connected accounts
export async function PUT() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all connected accounts
    const connectedAccounts = await prisma.connectedAccount.findMany({
      where: {
        userId: session.user.id,
        isValid: true,
      },
    });

    // Sync calendars from each account
    for (const account of connectedAccounts) {
      try {
        await syncCalendars(session.user.id, account.id);
      } catch (error) {
        console.error(`Error syncing calendars for account ${account.id}:`, error);
        // Continue with other accounts even if one fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error syncing calendars:', error);
    return NextResponse.json(
      { error: 'Failed to sync calendars' },
      { status: 500 }
    );
  }
}
