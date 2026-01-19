import { google, calendar_v3 } from 'googleapis';
import { prisma } from './prisma';
import { encrypt, decrypt } from './encryption';
import type {
  GoogleCalendarInfo,
  GoogleFreeBusyResponse,
  BusyBlock,
  CalendarEventData,
} from '@/types';

// OAuth2 scopes required for calendar access
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
];

// Create OAuth2 client
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
  );
}

// Generate OAuth authorization URL
export function getAuthorizationUrl(state: string): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_CALENDAR_SCOPES,
    prompt: 'consent', // Force consent to get refresh token
    state,
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Get authenticated OAuth2 client for a connected account
export async function getAuthenticatedClient(connectedAccountId: string) {
  const account = await prisma.connectedAccount.findUnique({
    where: { id: connectedAccountId },
  });

  if (!account) {
    throw new Error('Connected account not found');
  }

  const oauth2Client = createOAuth2Client();

  // Decrypt tokens
  const accessToken = decrypt(account.accessToken);
  const refreshToken = decrypt(account.refreshToken);

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.expiresAt.getTime(),
  });

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.connectedAccount.update({
        where: { id: connectedAccountId },
        data: {
          accessToken: encrypt(tokens.access_token),
          expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
        },
      });
    }
  });

  // Check if token needs refresh
  if (account.expiresAt.getTime() < Date.now() + 60000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      if (credentials.access_token) {
        await prisma.connectedAccount.update({
          where: { id: connectedAccountId },
          data: {
            accessToken: encrypt(credentials.access_token),
            expiresAt: new Date(credentials.expiry_date || Date.now() + 3600000),
          },
        });
      }
    } catch (error) {
      // Mark account as invalid on refresh failure
      await prisma.connectedAccount.update({
        where: { id: connectedAccountId },
        data: { isValid: false },
      });
      throw new Error('Token refresh failed. Please reconnect your Google account.');
    }
  }

  return oauth2Client;
}

// Save connected account with encrypted tokens
export async function saveConnectedAccount(
  userId: string,
  email: string,
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
    scope?: string;
  }
) {
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Missing required tokens');
  }

  const scopes = tokens.scope?.split(' ') || GOOGLE_CALENDAR_SCOPES;
  const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600000);

  const connectedAccount = await prisma.connectedAccount.upsert({
    where: {
      userId_email: { userId, email },
    },
    create: {
      userId,
      email,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt,
      scopes,
      isValid: true,
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt,
      scopes,
      isValid: true,
    },
  });

  return connectedAccount;
}

// List all calendars for a connected account
export async function listCalendars(
  connectedAccountId: string
): Promise<GoogleCalendarInfo[]> {
  const oauth2Client = await getAuthenticatedClient(connectedAccountId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.calendarList.list({
    minAccessRole: 'freeBusyReader',
  });

  if (!response.data.items) {
    return [];
  }

  return response.data.items.map((cal) => ({
    id: cal.id!,
    summary: cal.summary || 'Untitled Calendar',
    description: cal.description || undefined,
    timeZone: cal.timeZone || undefined,
    backgroundColor: cal.backgroundColor || undefined,
    accessRole: cal.accessRole || 'freeBusyReader',
    primary: cal.primary || false,
  }));
}

// Sync calendars from Google to database
export async function syncCalendars(
  userId: string,
  connectedAccountId: string
): Promise<void> {
  const calendars = await listCalendars(connectedAccountId);

  for (const cal of calendars) {
    const isWritable = ['owner', 'writer'].includes(cal.accessRole);

    await prisma.calendar.upsert({
      where: {
        connectedAccountId_googleCalendarId: {
          connectedAccountId,
          googleCalendarId: cal.id,
        },
      },
      create: {
        userId,
        connectedAccountId,
        googleCalendarId: cal.id,
        name: cal.summary,
        description: cal.description,
        color: cal.backgroundColor,
        timezone: cal.timeZone,
        accessRole: cal.accessRole,
        isPrimary: cal.primary || false,
        isWritable,
      },
      update: {
        name: cal.summary,
        description: cal.description,
        color: cal.backgroundColor,
        timezone: cal.timeZone,
        accessRole: cal.accessRole,
        isPrimary: cal.primary || false,
        isWritable,
      },
    });
  }

  // Update last sync timestamp
  await prisma.connectedAccount.update({
    where: { id: connectedAccountId },
    data: { lastSyncAt: new Date() },
  });
}

// Get free/busy information for multiple calendars
export async function getFreeBusy(
  connectedAccountId: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<BusyBlock[]> {
  const oauth2Client = await getAuthenticatedClient(connectedAccountId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: calendarIds.map((id) => ({ id })),
    },
  });

  const busyBlocks: BusyBlock[] = [];
  const calendars = response.data.calendars as GoogleFreeBusyResponse['calendars'];

  if (calendars) {
    for (const [calendarId, data] of Object.entries(calendars)) {
      if (data.busy) {
        for (const block of data.busy) {
          busyBlocks.push({
            start: new Date(block.start),
            end: new Date(block.end),
            calendarId,
          });
        }
      }
    }
  }

  return busyBlocks;
}

// Get free/busy for all selected calendars across all connected accounts
export async function getCompositeBusy(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<BusyBlock[]> {
  // Get all selected calendars grouped by connected account
  const calendars = await prisma.calendar.findMany({
    where: {
      userId,
      isSelected: true,
      connectedAccount: { isValid: true },
    },
    include: {
      connectedAccount: true,
    },
  });

  // Group calendars by connected account
  const calendarsByAccount = new Map<string, string[]>();
  for (const cal of calendars) {
    const accountId = cal.connectedAccountId;
    if (!calendarsByAccount.has(accountId)) {
      calendarsByAccount.set(accountId, []);
    }
    calendarsByAccount.get(accountId)!.push(cal.googleCalendarId);
  }

  // Fetch free/busy for each account in parallel
  const busyBlocksPromises: Promise<BusyBlock[]>[] = [];
  for (const [accountId, calIds] of calendarsByAccount) {
    busyBlocksPromises.push(
      getFreeBusy(accountId, calIds, timeMin, timeMax).catch((error) => {
        console.error(`Error fetching free/busy for account ${accountId}:`, error);
        return [];
      })
    );
  }

  const results = await Promise.all(busyBlocksPromises);
  return results.flat();
}

// Create a calendar event
export async function createCalendarEvent(
  connectedAccountId: string,
  calendarId: string,
  eventData: CalendarEventData
): Promise<{ eventId: string; meetingUrl?: string }> {
  const oauth2Client = await getAuthenticatedClient(connectedAccountId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event: calendar_v3.Schema$Event = {
    summary: eventData.summary,
    description: eventData.description,
    start: {
      dateTime: eventData.start.toISOString(),
      timeZone: eventData.timezone,
    },
    end: {
      dateTime: eventData.end.toISOString(),
      timeZone: eventData.timezone,
    },
    attendees: eventData.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName,
    })),
    location: eventData.location,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 30 }, // 30 minutes before
      ],
    },
  };

  // Add Google Meet if requested
  if (eventData.conferenceData) {
    event.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
    conferenceDataVersion: eventData.conferenceData ? 1 : 0,
    sendUpdates: 'all', // Send email invitations to attendees
  });

  const meetingUrl = response.data.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === 'video'
  )?.uri;

  return {
    eventId: response.data.id!,
    meetingUrl: meetingUrl || undefined,
  };
}

// Update a calendar event
export async function updateCalendarEvent(
  connectedAccountId: string,
  calendarId: string,
  eventId: string,
  eventData: Partial<CalendarEventData>
): Promise<void> {
  const oauth2Client = await getAuthenticatedClient(connectedAccountId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event: calendar_v3.Schema$Event = {};

  if (eventData.summary) event.summary = eventData.summary;
  if (eventData.description) event.description = eventData.description;
  if (eventData.start && eventData.timezone) {
    event.start = {
      dateTime: eventData.start.toISOString(),
      timeZone: eventData.timezone,
    };
  }
  if (eventData.end && eventData.timezone) {
    event.end = {
      dateTime: eventData.end.toISOString(),
      timeZone: eventData.timezone,
    };
  }
  if (eventData.attendees) {
    event.attendees = eventData.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName,
    }));
  }
  if (eventData.location) event.location = eventData.location;

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: event,
    sendUpdates: 'all',
  });
}

// Delete/cancel a calendar event
export async function deleteCalendarEvent(
  connectedAccountId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const oauth2Client = await getAuthenticatedClient(connectedAccountId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates: 'all', // Notify attendees of cancellation
  });
}

// Get user info from Google
export async function getUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const response = await oauth2.userinfo.get();

  return {
    email: response.data.email!,
    name: response.data.name || undefined,
  };
}
