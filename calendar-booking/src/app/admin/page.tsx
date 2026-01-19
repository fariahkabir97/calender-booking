'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  User,
  Mail,
  Video,
  MapPin,
  MoreVertical,
  XCircle,
} from 'lucide-react';

interface Booking {
  id: string;
  uid: string;
  startTime: string;
  endTime: string;
  timezone: string;
  attendeeName: string;
  attendeeEmail: string;
  meetingUrl?: string;
  status: string;
  eventType: {
    name: string;
    duration: number;
    locationType: string;
  };
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      let startDate: string | undefined;
      let endDate: string | undefined;
      let status: string | undefined;

      if (filter === 'upcoming') {
        startDate = now.toISOString();
        endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (filter === 'past') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        endDate = now.toISOString();
      } else if (filter === 'cancelled') {
        status = 'CANCELLED';
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (status) params.append('status', status);

      const response = await fetch(`/api/bookings?${params}`);
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBooking = async (uid: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const response = await fetch(`/api/bookings/${uid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        fetchBookings();
      } else {
        alert('Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      CONFIRMED: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      CANCELLED: 'bg-red-100 text-red-700',
      COMPLETED: 'bg-gray-100 text-gray-700',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}
      >
        {status.toLowerCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex gap-2">
          <Button
            variant={filter === 'upcoming' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('upcoming')}
          >
            Upcoming
          </Button>
          <Button
            variant={filter === 'past' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('past')}
          >
            Past
          </Button>
          <Button
            variant={filter === 'cancelled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('cancelled')}
          >
            Cancelled
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No {filter} bookings
            </h3>
            <p className="text-gray-500">
              {filter === 'upcoming'
                ? 'Your upcoming bookings will appear here.'
                : filter === 'past'
                  ? 'Your past bookings will appear here.'
                  : 'Cancelled bookings will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">
                        {booking.eventType.name}
                      </h3>
                      {getStatusBadge(booking.status)}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(booking.startTime), 'EEEE, MMMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(booking.startTime), 'h:mm a')} -{' '}
                        {format(new Date(booking.endTime), 'h:mm a')}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {booking.attendeeName}
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {booking.attendeeEmail}
                      </div>
                    </div>

                    {booking.meetingUrl && (
                      <div className="flex items-center gap-1 text-sm">
                        <Video className="h-4 w-4 text-blue-600" />
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

                  {booking.status === 'CONFIRMED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => cancelBooking(booking.uid)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
