import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/event-types/public/[slug] - Get public event type info
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const username = url.searchParams.get('username');

    // If username is provided, look up by user
    // Otherwise, find any active event type with this slug
    let userFilter = {};
    if (username && username !== 'demo') {
      const user = await prisma.user.findFirst({
        where: {
          email: { startsWith: username },
        },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      userFilter = { userId: user.id };
    }

    const eventType = await prisma.eventType.findFirst({
      where: {
        ...userFilter,
        slug,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        duration: true,
        locationType: true,
        collectPhone: true,
        collectCompany: true,
        customQuestions: true,
        minimumNotice: true,
        schedulingWindow: true,
        user: {
          select: {
            name: true,
            image: true,
            timezone: true,
          },
        },
      },
    });

    if (!eventType) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }

    return NextResponse.json({
      eventType: {
        ...eventType,
        user: eventType.user,
      },
    });
  } catch (error) {
    console.error('Error fetching public event type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event type' },
      { status: 500 }
    );
  }
}
