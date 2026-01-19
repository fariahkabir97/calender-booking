'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Clock,
  Link as LinkIcon,
  Copy,
  Trash2,
  Edit,
  Video,
  Phone,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface EventType {
  id: string;
  slug: string;
  name: string;
  description?: string;
  duration: number;
  color?: string;
  isActive: boolean;
  locationType: string;
  _count: {
    bookings: number;
  };
}

export default function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEventTypes();
  }, []);

  const fetchEventTypes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/event-types');
      const data = await response.json();
      setEventTypes(data.eventTypes || []);
    } catch (error) {
      console.error('Error fetching event types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEventType = async (id: string, isActive: boolean) => {
    // Optimistic update
    setEventTypes((prev) =>
      prev.map((et) => (et.id === id ? { ...et, isActive } : et))
    );

    try {
      // Note: You'd need to implement the full update endpoint
      // For now, we'll just update local state
    } catch (error) {
      console.error('Error toggling event type:', error);
      fetchEventTypes();
    }
  };

  const deleteEventType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event type? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/event-types/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchEventTypes();
      } else {
        alert('Failed to delete event type');
      }
    } catch (error) {
      console.error('Error deleting event type:', error);
      alert('Failed to delete event type');
    }
  };

  const copyBookingLink = async (slug: string, id: string) => {
    // In a real app, you'd get the username from the session
    const link = `${window.location.origin}/book/${slug}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLocationIcon = (locationType: string) => {
    switch (locationType) {
      case 'GOOGLE_MEET':
      case 'ZOOM':
        return <Video className="h-4 w-4" />;
      case 'PHONE':
        return <Phone className="h-4 w-4" />;
      case 'IN_PERSON':
      case 'CUSTOM':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  const getLocationLabel = (locationType: string) => {
    const labels: Record<string, string> = {
      GOOGLE_MEET: 'Google Meet',
      ZOOM: 'Zoom',
      PHONE: 'Phone call',
      IN_PERSON: 'In person',
      CUSTOM: 'Custom location',
    };
    return labels[locationType] || locationType;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Event Types</h1>
          <p className="text-gray-500">Create and manage your booking links</p>
        </div>
        <Link href="/admin/event-types/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Event Type
          </Button>
        </Link>
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
      ) : eventTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LinkIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No event types yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first event type to start accepting bookings
            </p>
            <Link href="/admin/event-types/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Event Type
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {eventTypes.map((eventType) => (
            <Card key={eventType.id} className={!eventType.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-1 h-16 rounded-full"
                      style={{ backgroundColor: eventType.color || '#3b82f6' }}
                    />
                    <div>
                      <h3 className="text-lg font-semibold">{eventType.name}</h3>
                      {eventType.description && (
                        <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                          {eventType.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {eventType.duration} min
                        </div>
                        <div className="flex items-center gap-1">
                          {getLocationIcon(eventType.locationType)}
                          {getLocationLabel(eventType.locationType)}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">
                            {eventType._count.bookings} booking
                            {eventType._count.bookings !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {eventType.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <Switch
                        checked={eventType.isActive}
                        onCheckedChange={(checked) => toggleEventType(eventType.id, checked)}
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyBookingLink(eventType.slug, eventType.id)}
                      >
                        {copiedId === eventType.id ? (
                          <span className="text-green-600 text-sm">Copied!</span>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy link
                          </>
                        )}
                      </Button>
                      <Link href={`/admin/event-types/${eventType.id}`}>
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteEventType(eventType.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
