import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  exchangeCodeForTokens,
  saveConnectedAccount,
  syncCalendars,
  getUserInfo,
} from '@/lib/google-calendar';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=oauth_denied`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=missing_params`
      );
    }

    // Decode and validate state
    let stateData: { userId: string; nonce: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=invalid_state`
      );
    }

    // Check state timestamp (5 minute expiry)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=state_expired`
      );
    }

    // Verify user is logged in and matches state
    const session = await getSession();
    if (!session?.user?.id || session.user.id !== stateData.userId) {
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=unauthorized`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${appUrl}/admin/settings?error=token_exchange_failed`
      );
    }

    // Get user info from Google to get email
    const userInfo = await getUserInfo(tokens.access_token);

    // Save connected account
    const connectedAccount = await saveConnectedAccount(
      session.user.id,
      userInfo.email,
      tokens
    );

    // Sync calendars from this account
    await syncCalendars(session.user.id, connectedAccount.id);

    return NextResponse.redirect(
      `${appUrl}/admin/settings?success=google_connected`
    );
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Provide more specific error codes
    let errorCode = 'callback_failed';
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('invalid_grant')) {
      errorCode = 'invalid_grant';
    } else if (errorMessage.includes('redirect_uri_mismatch')) {
      errorCode = 'redirect_uri_mismatch';
    } else if (errorMessage.includes('Missing required tokens')) {
      errorCode = 'missing_tokens';
    } else if (errorMessage.includes('Token refresh failed')) {
      errorCode = 'token_refresh_failed';
    }

    return NextResponse.redirect(
      `${appUrl}/admin/settings?error=${errorCode}`
    );
  }
}
