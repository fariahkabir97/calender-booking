'use client';

import { useEffect, useState, use } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  User,
  Video,
  MapPin,
  Loader2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface Booking {
  uid: string;
  status: string;
  startTime: string;
  endTime: string;
  timezone: string;
  attendeeName: string;
  attendeeEmail: string;
  meetingUrl?: string;
  eventType: {
    name: string;
    duration: number;
    locationType: string;
    locationValue?: string;
    description?: string;
  };
  hostName?: string;
}

export default function BookingDetailsPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await fetch(`/api/bookings/${uid}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Booking not found');
          } else {
            setError('Failed to load booking');
          }
          return;
        }

        const data = await response.json();
        setBooking(data.booking);
      } catch (err) {
        setError('Failed to load booking');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [uid]);

  const handleCancel = async () => {
    if (!email.trim()) {
      alert('Please enter your email to confirm cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/bookings/${uid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          reason: cancelReason || undefined,
        }),
      });

      if (response.ok) {
        // Refresh booking data
        const refreshResponse = await fetch(`/api/bookings/${uid}`);
        const data = await refreshResponse.json();
        setBooking(data.booking);
        setShowCancelForm(false);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to cancel booking');
      }
    } catch (err) {
      alert('Failed to cancel booking');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-gray-500">
              {error || 'This booking link is not valid or has expired.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCancelled = booking.status === 'CANCELLED';
  const isPast = new Date(booking.endTime) < new Date();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{booking.eventType.name}</CardTitle>
                <p className="text-gray-500 mt-1">with {booking.hostName}</p>
              </div>
              {isCancelled ? (
                <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
                  Cancelled
                </span>
              ) : isPast ? (
                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                  Completed
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                  Confirmed
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Booking details */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span>
                  {format(
                    toZonedTime(new Date(booking.startTime), booking.timezone),
                    'EEEE, MMMM d, yyyy'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <span>
                  {format(
                    toZonedTime(new Date(booking.startTime), booking.timezone),
                    'h:mm a'
                  )}{' '}
                  -{' '}
                  {format(
                    toZonedTime(new Date(booking.endTime), booking.timezone),
                    'h:mm a'
                  )}{' '}
                  ({booking.timezone})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <span>
                  {booking.attendeeName} ({booking.attendeeEmail})
                </span>
              </div>
              {booking.meetingUrl && !isCancelled && !isPast && (
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-blue-500" />
                  <a
                    href={booking.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Join meeting
                  </a>
                </div>
              )}
            </div>

            {/* Cancel section */}
            {!isCancelled && !isPast && (
              <div className="border-t pt-6">
                {showCancelForm ? (
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      Cancel Booking
                    </h3>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-600">
                        Confirm your email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-600">
                        Reason for cancellation (optional)
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Let us know why you're cancelling..."
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowCancelForm(false)}
                        disabled={isCancelling}
                      >
                        Keep booking
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          'Cancel booking'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelForm(true)}
                    className="w-full"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel booking
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-400 mt-6">
          Powered by CalBook
        </p>
      </div>
    </div>
  );
}
