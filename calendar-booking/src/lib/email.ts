import { Resend } from 'resend';
import { createEvents, EventAttributes } from 'ics';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const resend = new Resend(process.env.RESEND_API_KEY);

interface BookingEmailData {
  attendeeName: string;
  attendeeEmail: string;
  hostName: string;
  hostEmail: string;
  eventTypeName: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  meetingUrl?: string;
  location?: string;
  description?: string;
  bookingUid: string;
}

// Generate ICS file content
function generateICSContent(data: BookingEmailData): Promise<string> {
  return new Promise((resolve, reject) => {
    const startInTz = toZonedTime(data.startTime, data.timezone);
    const endInTz = toZonedTime(data.endTime, data.timezone);

    const event: EventAttributes = {
      start: [
        startInTz.getFullYear(),
        startInTz.getMonth() + 1,
        startInTz.getDate(),
        startInTz.getHours(),
        startInTz.getMinutes(),
      ],
      end: [
        endInTz.getFullYear(),
        endInTz.getMonth() + 1,
        endInTz.getDate(),
        endInTz.getHours(),
        endInTz.getMinutes(),
      ],
      title: data.eventTypeName,
      description: data.description || `Meeting with ${data.hostName}`,
      location: data.meetingUrl || data.location,
      organizer: { name: data.hostName, email: data.hostEmail },
      attendees: [
        {
          name: data.attendeeName,
          email: data.attendeeEmail,
          rsvp: true,
          partstat: 'ACCEPTED',
          role: 'REQ-PARTICIPANT',
        },
      ],
      uid: data.bookingUid,
      status: 'CONFIRMED',
    };

    createEvents([event], (error, value) => {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
}

// Send booking confirmation email to attendee
export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  const icsContent = await generateICSContent(data);
  const startFormatted = format(toZonedTime(data.startTime, data.timezone), 'EEEE, MMMM d, yyyy');
  const timeFormatted = `${format(toZonedTime(data.startTime, data.timezone), 'h:mm a')} - ${format(toZonedTime(data.endTime, data.timezone), 'h:mm a')}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const cancelUrl = `${appUrl}/booking/${data.bookingUid}/cancel`;
  const rescheduleUrl = `${appUrl}/booking/${data.bookingUid}/reschedule`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .detail-row { display: flex; margin-bottom: 8px; }
        .detail-label { font-weight: 600; width: 120px; }
        .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-right: 8px; }
        .button-secondary { background: #6b7280; }
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Booking Confirmed</h1>
        </div>
        <div class="content">
          <p>Hi ${data.attendeeName},</p>
          <p>Your meeting has been scheduled with ${data.hostName}.</p>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Event:</span>
              <span>${data.eventTypeName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span>${startFormatted}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span>${timeFormatted} (${data.timezone})</span>
            </div>
            ${data.meetingUrl ? `
            <div class="detail-row">
              <span class="detail-label">Meeting Link:</span>
              <span><a href="${data.meetingUrl}">${data.meetingUrl}</a></span>
            </div>
            ` : ''}
            ${data.location && !data.meetingUrl ? `
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span>${data.location}</span>
            </div>
            ` : ''}
          </div>

          <p>
            <a href="${rescheduleUrl}" class="button">Reschedule</a>
            <a href="${cancelUrl}" class="button button-secondary">Cancel</a>
          </p>

          <div class="footer">
            <p>A calendar invitation is attached to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Calendar Booking <bookings@example.com>',
    to: data.attendeeEmail,
    subject: `Confirmed: ${data.eventTypeName} with ${data.hostName}`,
    html,
    attachments: [
      {
        filename: 'invite.ics',
        content: Buffer.from(icsContent).toString('base64'),
      },
    ],
  });
}

// Send notification email to host
export async function sendHostNotificationEmail(data: BookingEmailData): Promise<void> {
  const startFormatted = format(toZonedTime(data.startTime, data.timezone), 'EEEE, MMMM d, yyyy');
  const timeFormatted = `${format(toZonedTime(data.startTime, data.timezone), 'h:mm a')} - ${format(toZonedTime(data.endTime, data.timezone), 'h:mm a')}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .detail-row { display: flex; margin-bottom: 8px; }
        .detail-label { font-weight: 600; width: 120px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">New Booking</h1>
        </div>
        <div class="content">
          <p>Hi ${data.hostName},</p>
          <p>You have a new booking!</p>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Event:</span>
              <span>${data.eventTypeName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Attendee:</span>
              <span>${data.attendeeName} (${data.attendeeEmail})</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span>${startFormatted}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span>${timeFormatted} (${data.timezone})</span>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Calendar Booking <bookings@example.com>',
    to: data.hostEmail,
    subject: `New Booking: ${data.eventTypeName} with ${data.attendeeName}`,
    html,
  });
}

// Send cancellation email
export async function sendCancellationEmail(
  data: BookingEmailData & { cancelReason?: string }
): Promise<void> {
  const startFormatted = format(toZonedTime(data.startTime, data.timezone), 'EEEE, MMMM d, yyyy');
  const timeFormatted = `${format(toZonedTime(data.startTime, data.timezone), 'h:mm a')} - ${format(toZonedTime(data.endTime, data.timezone), 'h:mm a')}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .detail-row { display: flex; margin-bottom: 8px; }
        .detail-label { font-weight: 600; width: 120px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Booking Cancelled</h1>
        </div>
        <div class="content">
          <p>Hi ${data.attendeeName},</p>
          <p>Your meeting with ${data.hostName} has been cancelled.</p>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Event:</span>
              <span>${data.eventTypeName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span>${startFormatted}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span>${timeFormatted} (${data.timezone})</span>
            </div>
            ${data.cancelReason ? `
            <div class="detail-row">
              <span class="detail-label">Reason:</span>
              <span>${data.cancelReason}</span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Calendar Booking <bookings@example.com>',
    to: data.attendeeEmail,
    subject: `Cancelled: ${data.eventTypeName} with ${data.hostName}`,
    html,
  });
}
