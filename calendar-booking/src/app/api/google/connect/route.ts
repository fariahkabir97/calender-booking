import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAuthorizationUrl } from '@/lib/google-calendar';
import { rateLimit, RATE_LIMITS, getClientIP } from '@/lib/rate-limit';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const ip = getClientIP(request);
    const rateLimitResult = rateLimit(`oauth:${session.user.id}`, RATE_LIMITS.oauth);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // In production, store state in a secure session or signed cookie
    // For now, we'll encode the user ID in the state
    const stateData = Buffer.from(
      JSON.stringify({
        userId: session.user.id,
        nonce: state,
        timestamp: Date.now(),
      })
    ).toString('base64url');

    const authUrl = getAuthorizationUrl(stateData);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
