'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarPicker } from '@/components/booking/calendar-picker';
import { TimeSlotPicker } from '@/components/booking/time-slot-picker';
import { BookingForm } from '@/components/booking/booking-form';
import {
  Clock,
  Video,
  Phone,
  MapPin,
  Globe,
  Check,
  Calendar,
  Loader2,
} from 'lucide-react';
import { getUserTimezone, COMMON_TIMEZONES } from '@/lib/utils';

interface EventType {
  id: string;
  name: string;
  slug: string;
  description?: string;
  duration: number;
  locationType: string;
  collectPhone: boolean;
  collectCompany: boolean;
  customQuestions?: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }>;
  user: {
    name: string;
    image?: string;
    timezone: string;
  };
}

interface TimeSlot {
  start: string;
  end: string;
}

type BookingStep = 'calendar' | 'time' | 'form' | 'confirmed';

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<BookingStep>('calendar');
  const [timezone, setTimezone] = useState(getUserTimezone());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Record<string, TimeSlot[]>>({});
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    uid: string;
    startTime: string;
    meetingUrl?: string;
  } | null>(null);

  // Fetch event type info
  useEffect(() => {
    const fetchEventType = async () => {
      try {
        // Get username from first part of slug or use a default approach
        // In a real app, you'd parse the URL differently
        const response = await fetch(`/api/event-types/public/${slug}?username=demo`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Event type not found');
          } else {
            setError('Failed to load booking page');
          }
          return;
        }

        const data = await response.json();
        setEventType(data.eventType);
      } catch (err) {
        setError('Failed to load booking page');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventType();
  }, [slug]);

  // Fetch availability when date range or timezone changes
  useEffect(() => {
    if (!eventType) return;

    const fetchAvailability = async () => {
      setIsFetchingSlots(true);
      try {
        const startDate = startOfDay(new Date());
        const endDate = addDays(startDate, 30);

        const params = new URLSearchParams({
          eventTypeId: eventType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          timezone,
        });

        const response = await fetch(`/api/availability?${params}`);
        const data = await response.json();

        setAvailableSlots(data.slots || {});
      } catch (err) {
        console.error('Error fetching availability:', err);
      } finally {
        setIsFetchingSlots(false);
      }
    };

    fetchAvailability();
  }, [eventType, timezone]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep('time');
  };

  const handleSlotSelect = (startTime: string) => {
    setSelectedSlot(startTime);
    setStep('form');
  };

  const handleBookingSubmit = async (formData: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    notes?: string;
    customResponses?: Record<string, string>;
  }) => {
    if (!selectedSlot || !eventType) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTypeId: eventType.id,
          startTime: selectedSlot,
          timezone,
          attendeeName: formData.name,
          attendeeEmail: formData.email,
          attendeePhone: formData.phone,
          attendeeCompany: formData.company,
          attendeeNotes: formData.notes,
          customResponses: formData.customResponses,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setBookingResult(data.booking);
        setStep('confirmed');
      } else {
        alert(data.error || 'Failed to create booking. Please try again.');
      }
    } catch (err) {
      console.error('Error creating booking:', err);
      alert('Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLocationInfo = () => {
    if (!eventType) return { icon: Video, text: 'Video call' };

    const locationMap: Record<string, { icon: typeof Video; text: string }> = {
      GOOGLE_MEET: { icon: Video, text: 'Google Meet' },
      ZOOM: { icon: Video, text: 'Zoom' },
      PHONE: { icon: Phone, text: 'Phone call' },
      IN_PERSON: { icon: MapPin, text: 'In person' },
      CUSTOM: { icon: MapPin, text: 'See details' },
    };

    return locationMap[eventType.locationType] || { icon: Video, text: 'Video call' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !eventType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-gray-500">
              {error || 'This booking link is not available.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const LocationIcon = getLocationInfo().icon;
  const availableDates = Object.keys(availableSlots);
  const slotsForSelectedDate = selectedDate
    ? availableSlots[format(selectedDate, 'yyyy-MM-dd')] || []
    : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="overflow-hidden">
          <div className="md:flex">
            {/* Left sidebar - Event info */}
            <div className="md:w-80 bg-white border-r p-6">
              {eventType.user.image ? (
                <img
                  src={eventType.user.image}
                  alt=""
                  className="w-16 h-16 rounded-full mb-4"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <span className="text-2xl font-semibold text-blue-600">
                    {eventType.user.name?.[0] || '?'}
                  </span>
                </div>
              )}

              <p className="text-gray-500 mb-1">{eventType.user.name}</p>
              <h1 className="text-2xl font-bold mb-4">{eventType.name}</h1>

              {eventType.description && (
                <p className="text-gray-600 mb-4 text-sm">{eventType.description}</p>
              )}

              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{eventType.duration} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <LocationIcon className="h-4 w-4" />
                  <span>{getLocationInfo().text}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="bg-transparent border-0 p-0 text-sm focus:ring-0 cursor-pointer"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Right content */}
            <div className="flex-1 p-6">
              {step === 'confirmed' && bookingResult ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
                  <p className="text-gray-500 mb-6">
                    A calendar invitation has been sent to your email.
                  </p>

                  <div className="bg-gray-50 rounded-lg p-4 text-left max-w-sm mx-auto">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">When</span>
                        <span className="font-medium">
                          {format(
                            toZonedTime(new Date(bookingResult.startTime), timezone),
                            'EEEE, MMMM d'
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Time</span>
                        <span className="font-medium">
                          {format(
                            toZonedTime(new Date(bookingResult.startTime), timezone),
                            'h:mm a'
                          )}
                        </span>
                      </div>
                      {bookingResult.meetingUrl && (
                        <div className="pt-2 border-t">
                          <a
                            href={bookingResult.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Video className="h-4 w-4" />
                            Join meeting
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : step === 'form' && selectedSlot ? (
                <BookingForm
                  eventTypeName={eventType.name}
                  selectedTime={selectedSlot}
                  formattedDate={format(
                    toZonedTime(new Date(selectedSlot), timezone),
                    'EEEE, MMMM d, yyyy'
                  )}
                  formattedTime={format(
                    toZonedTime(new Date(selectedSlot), timezone),
                    'h:mm a'
                  )}
                  duration={eventType.duration}
                  collectPhone={eventType.collectPhone}
                  collectCompany={eventType.collectCompany}
                  customQuestions={eventType.customQuestions}
                  onSubmit={handleBookingSubmit}
                  onBack={() => setStep('time')}
                  isSubmitting={isSubmitting}
                />
              ) : (
                <div className="md:flex gap-8">
                  {/* Calendar */}
                  <div className="flex-1 mb-6 md:mb-0">
                    <h2 className="text-lg font-semibold mb-4">Select a date</h2>
                    <CalendarPicker
                      selectedDate={selectedDate}
                      onSelectDate={handleDateSelect}
                      availableDates={availableDates}
                      timezone={timezone}
                      minDate={new Date()}
                      maxDate={addDays(new Date(), 30)}
                    />
                  </div>

                  {/* Time slots */}
                  {(step === 'time' || selectedDate) && (
                    <div className="md:w-48">
                      <h2 className="text-lg font-semibold mb-4">
                        {selectedDate
                          ? format(selectedDate, 'EEE, MMM d')
                          : 'Select a time'}
                      </h2>
                      <TimeSlotPicker
                        slots={slotsForSelectedDate}
                        selectedSlot={selectedSlot}
                        onSelectSlot={handleSlotSelect}
                        timezone={timezone}
                        isLoading={isFetchingSlots}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        <p className="text-center text-sm text-gray-400 mt-6">
          Powered by CalBook
        </p>
      </div>
    </div>
  );
}
