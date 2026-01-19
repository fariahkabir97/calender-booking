'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Calendar {
  id: string;
  name: string;
  color?: string;
  isWritable: boolean;
  connectedAccount: {
    email: string;
  };
}

const DURATIONS = [15, 30, 45, 60, 90, 120];
const LOCATION_TYPES = [
  { value: 'GOOGLE_MEET', label: 'Google Meet' },
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'IN_PERSON', label: 'In person' },
  { value: 'CUSTOM', label: 'Custom location' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const DEFAULT_WORKING_HOURS = [
  { day: 1, start: '09:00', end: '17:00' },
  { day: 2, start: '09:00', end: '17:00' },
  { day: 3, start: '09:00', end: '17:00' },
  { day: 4, start: '09:00', end: '17:00' },
  { day: 5, start: '09:00', end: '17:00' },
];

export default function NewEventTypePage() {
  const router = useRouter();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [locationType, setLocationType] = useState('GOOGLE_MEET');
  const [locationValue, setLocationValue] = useState('');
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [minimumNotice, setMinimumNotice] = useState(240);
  const [schedulingWindow, setSchedulingWindow] = useState(30);
  const [slotInterval, setSlotInterval] = useState(15);
  const [workingHours, setWorkingHours] = useState(DEFAULT_WORKING_HOURS);
  const [collectPhone, setCollectPhone] = useState(false);
  const [collectCompany, setCollectCompany] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [destinationCalendarId, setDestinationCalendarId] = useState('');

  useEffect(() => {
    fetchCalendars();
  }, []);

  useEffect(() => {
    // Auto-generate slug from name
    const generatedSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  }, [name]);

  const fetchCalendars = async () => {
    try {
      const response = await fetch('/api/calendars');
      const data = await response.json();
      const cals = data.calendars || [];
      setCalendars(cals);

      // Auto-select all calendars and set destination to primary writable
      const allIds = cals.map((c: Calendar) => c.id);
      setSelectedCalendarIds(allIds);

      const primaryWritable = cals.find((c: Calendar) => c.isWritable);
      if (primaryWritable) {
        setDestinationCalendarId(primaryWritable.id);
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWorkingDay = (day: number) => {
    const exists = workingHours.find((wh) => wh.day === day);
    if (exists) {
      setWorkingHours(workingHours.filter((wh) => wh.day !== day));
    } else {
      setWorkingHours([...workingHours, { day, start: '09:00', end: '17:00' }]);
    }
  };

  const updateWorkingHours = (day: number, field: 'start' | 'end', value: string) => {
    setWorkingHours(
      workingHours.map((wh) => (wh.day === day ? { ...wh, [field]: value } : wh))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!slug.trim()) newErrors.slug = 'URL slug is required';
    if (selectedCalendarIds.length === 0) newErrors.calendars = 'Select at least one calendar';
    if (!destinationCalendarId) newErrors.destination = 'Select a destination calendar';
    if (workingHours.length === 0) newErrors.workingHours = 'Set at least one working day';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/event-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          duration,
          locationType,
          locationValue: locationValue.trim() || undefined,
          bufferBefore,
          bufferAfter,
          minimumNotice,
          schedulingWindow,
          slotInterval,
          workingHours,
          collectPhone,
          collectCompany,
          requiresConfirmation,
          calendarIds: selectedCalendarIds,
          destinationCalendarId,
        }),
      });

      if (response.ok) {
        router.push('/admin/event-types');
      } else {
        const data = await response.json();
        if (response.status === 409) {
          setErrors({ slug: 'This URL is already in use' });
        } else {
          setErrors({ submit: data.error || 'Failed to create event type' });
        }
      }
    } catch (error) {
      console.error('Error creating event type:', error);
      setErrors({ submit: 'Failed to create event type' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const writableCalendars = calendars.filter((c) => c.isWritable);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/event-types">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Create Event Type</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="30 Minute Meeting"
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL slug *</Label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">/book/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="30-minute-meeting"
                />
              </div>
              {errors.slug && <p className="text-sm text-red-500">{errors.slug}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of this meeting type..."
                className="w-full min-h-[100px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Duration *</Label>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={duration === d ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDuration(d)}
                  >
                    {d} min
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Meeting type</Label>
              <div className="grid grid-cols-2 gap-2">
                {LOCATION_TYPES.map((loc) => (
                  <Button
                    key={loc.value}
                    type="button"
                    variant={locationType === loc.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLocationType(loc.value)}
                    className="justify-start"
                  >
                    {loc.label}
                  </Button>
                ))}
              </div>
            </div>

            {(locationType === 'PHONE' ||
              locationType === 'IN_PERSON' ||
              locationType === 'CUSTOM') && (
              <div className="space-y-2">
                <Label htmlFor="locationValue">
                  {locationType === 'PHONE'
                    ? 'Phone number'
                    : locationType === 'IN_PERSON'
                      ? 'Address'
                      : 'Location details'}
                </Label>
                <Input
                  id="locationValue"
                  value={locationValue}
                  onChange={(e) => setLocationValue(e.target.value)}
                  placeholder={
                    locationType === 'PHONE'
                      ? '+1 (555) 123-4567'
                      : locationType === 'IN_PERSON'
                        ? '123 Main St, City, State'
                        : 'Enter location details...'
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Availability */}
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Working hours</Label>
              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day) => {
                  const hours = workingHours.find((wh) => wh.day === day.value);
                  const isEnabled = !!hours;

                  return (
                    <div key={day.value} className="flex items-center gap-4">
                      <div className="w-24">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => toggleWorkingDay(day.value)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{day.label}</span>
                        </label>
                      </div>
                      {isEnabled && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={hours.start}
                            onChange={(e) =>
                              updateWorkingHours(day.value, 'start', e.target.value)
                            }
                            className="w-32"
                          />
                          <span>to</span>
                          <Input
                            type="time"
                            value={hours.end}
                            onChange={(e) =>
                              updateWorkingHours(day.value, 'end', e.target.value)
                            }
                            className="w-32"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {errors.workingHours && (
                <p className="text-sm text-red-500">{errors.workingHours}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bufferBefore">Buffer before (minutes)</Label>
                <Input
                  id="bufferBefore"
                  type="number"
                  min="0"
                  max="120"
                  value={bufferBefore}
                  onChange={(e) => setBufferBefore(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bufferAfter">Buffer after (minutes)</Label>
                <Input
                  id="bufferAfter"
                  type="number"
                  min="0"
                  max="120"
                  value={bufferAfter}
                  onChange={(e) => setBufferAfter(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minimumNotice">Minimum notice (hours)</Label>
                <Input
                  id="minimumNotice"
                  type="number"
                  min="0"
                  value={minimumNotice / 60}
                  onChange={(e) => setMinimumNotice((parseInt(e.target.value) || 0) * 60)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedulingWindow">Scheduling window (days)</Label>
                <Input
                  id="schedulingWindow"
                  type="number"
                  min="1"
                  max="365"
                  value={schedulingWindow}
                  onChange={(e) => setSchedulingWindow(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendars */}
        <Card>
          <CardHeader>
            <CardTitle>Calendars</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Check availability on</Label>
              <p className="text-sm text-gray-500">
                Your availability will be calculated across all selected calendars
              </p>
              <div className="space-y-2 mt-2">
                {calendars.map((calendar) => (
                  <label key={calendar.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCalendarIds.includes(calendar.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCalendarIds([...selectedCalendarIds, calendar.id]);
                        } else {
                          setSelectedCalendarIds(
                            selectedCalendarIds.filter((id) => id !== calendar.id)
                          );
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: calendar.color || '#3b82f6' }}
                    />
                    <span className="text-sm">{calendar.name}</span>
                    <span className="text-xs text-gray-400">
                      ({calendar.connectedAccount.email})
                    </span>
                  </label>
                ))}
              </div>
              {errors.calendars && <p className="text-sm text-red-500">{errors.calendars}</p>}
            </div>

            <div className="space-y-2">
              <Label>Create events on</Label>
              <p className="text-sm text-gray-500">
                New bookings will be added to this calendar
              </p>
              <select
                value={destinationCalendarId}
                onChange={(e) => setDestinationCalendarId(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="">Select a calendar...</option>
                {writableCalendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name} ({calendar.connectedAccount.email})
                  </option>
                ))}
              </select>
              {errors.destination && (
                <p className="text-sm text-red-500">{errors.destination}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Additional Options */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Collect phone number</Label>
                <p className="text-sm text-gray-500">Ask for the attendee's phone number</p>
              </div>
              <Switch checked={collectPhone} onCheckedChange={setCollectPhone} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Collect company name</Label>
                <p className="text-sm text-gray-500">Ask for the attendee's company</p>
              </div>
              <Switch checked={collectCompany} onCheckedChange={setCollectCompany} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require confirmation</Label>
                <p className="text-sm text-gray-500">
                  Bookings will be pending until you confirm them
                </p>
              </div>
              <Switch
                checked={requiresConfirmation}
                onCheckedChange={setRequiresConfirmation}
              />
            </div>
          </CardContent>
        </Card>

        {errors.submit && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md">{errors.submit}</div>
        )}

        <div className="flex gap-4">
          <Link href="/admin/event-types">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Event Type'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
