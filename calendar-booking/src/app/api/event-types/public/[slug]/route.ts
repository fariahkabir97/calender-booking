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

    if (!username) {
      return NextResponse.json(
        { error: 'Username parameter is required' },
        { status: 400 }
      );
    }

    // Find user by email prefix (username)
    const user = await prisma.user.findFirst({
      where: {
        email: { startsWith: username },
      },
      select: {
        id: true,
        name: true,
        image: true,
        timezone: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const eventType = await prisma.eventType.findFirst({
      where: {
        userId: user.id,
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
      },
    });

    if (!eventType) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }

    return NextResponse.json({
      eventType: {
        ...eventType,
        user: {
          name: user.name,
          image: user.image,
          timezone: user.timezone,
        },
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
