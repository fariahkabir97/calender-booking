'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  format,
  isSameDay,
  isToday,
  eachDayOfInterval,
  isSameMonth,
  getHours,
  getMinutes,
  differenceInMinutes,
  startOfDay,
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  ExternalLink,
  RefreshCw,
  X,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
  accountEmail: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location?: string;
  meetingUrl?: string;
  status: string;
  htmlLink?: string;
}

interface CalendarInfo {
  id: string;
  name: string;
  color?: string;
  accountEmail: string;
}

type ViewMode = 'week' | 'month';

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }
  }, [currentDate, viewMode]);

  // Fetch events when date range changes
  useEffect(() => {
    fetchEvents();
  }, [dateRange]);

  // Initialize visible calendars when calendars load
  useEffect(() => {
    if (calendars.length > 0 && visibleCalendars.size === 0) {
      setVisibleCalendars(new Set(calendars.map((c) => c.id)));
    }
  }, [calendars, visibleCalendars.size]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
      });

      const response = await fetch(`/api/events?${params}`);
      const data = await response.json();

      if (response.ok) {
        setEvents(data.events || []);
        setCalendars(data.calendars || []);
      } else {
        console.error('Error fetching events:', data.error);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter events by visible calendars
  const filteredEvents = useMemo(() => {
    return events.filter((event) => visibleCalendars.has(event.calendarId));
  }, [events, visibleCalendars]);

  // Navigation handlers
  const goToPrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Toggle calendar visibility
  const toggleCalendar = (calendarId: string) => {
    const newVisible = new Set(visibleCalendars);
    if (newVisible.has(calendarId)) {
      newVisible.delete(calendarId);
    } else {
      newVisible.add(calendarId);
    }
    setVisibleCalendars(newVisible);
  };

  // Render helpers
  const renderDateHeader = () => {
    if (viewMode === 'week') {
      return format(dateRange.start, 'MMM d') + ' - ' + format(dateRange.end, 'MMM d, yyyy');
    }
    return format(currentDate, 'MMMM yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-gray-500">View all events across your connected calendars</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEvents} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Calendar Sidebar */}
        <Card className="w-64 flex-shrink-0 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Calendars</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calendars.map((cal) => (
              <label
                key={cal.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={visibleCalendars.has(cal.id)}
                  onChange={() => toggleCalendar(cal.id)}
                  className="rounded border-gray-300"
                />
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cal.color || '#3b82f6' }}
                />
                <span className="text-sm truncate" title={cal.name}>
                  {cal.name}
                </span>
              </label>
            ))}
            {calendars.length === 0 && !isLoading && (
              <p className="text-sm text-gray-500">
                No calendars selected. Go to Settings to select calendars.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Main Calendar Area */}
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              {/* View controls */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" onClick={goToPrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goToNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="font-semibold ml-2">{renderDateHeader()}</span>
              </div>

              {/* View mode toggle */}
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  Week
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                >
                  Month
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <LoadingSkeleton viewMode={viewMode} />
            ) : viewMode === 'week' ? (
              <WeekView
                dateRange={dateRange}
                events={filteredEvents}
                onEventClick={setSelectedEvent}
              />
            ) : (
              <MonthView
                currentDate={currentDate}
                events={filteredEvents}
                onEventClick={setSelectedEvent}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

function LoadingSkeleton({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div className="p-4">
      <div className="animate-pulse space-y-3">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 rounded" />
          ))}
        </div>
        {Array.from({ length: viewMode === 'week' ? 8 : 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekView({
  dateRange,
  events,
  onEventClick,
}: {
  dateRange: { start: Date; end: Date };
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const days = eachDayOfInterval(dateRange);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.start);
      return isSameDay(eventStart, day) && !event.isAllDay;
    });
  };

  // Get all-day events for a specific day
  const getAllDayEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return (
        event.isAllDay &&
        (isSameDay(eventStart, day) ||
          (eventStart < day && eventEnd > day) ||
          isSameDay(eventEnd, day))
      );
    });
  };

  return (
    <div className="overflow-auto max-h-[600px]">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 bg-white z-10">
        <div className="p-2" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-2 text-center border-l ${isToday(day) ? 'bg-blue-50' : ''}`}
          >
            <div className="text-xs text-gray-500">{format(day, 'EEE')}</div>
            <div
              className={`text-lg font-semibold ${
                isToday(day) ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''
              }`}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-gray-50">
        <div className="p-2 text-xs text-gray-500">All day</div>
        {days.map((day) => {
          const allDayEvents = getAllDayEventsForDay(day);
          return (
            <div key={day.toISOString()} className="p-1 border-l min-h-[40px]">
              {allDayEvents.slice(0, 2).map((event) => (
                <div
                  key={event.id}
                  className="text-xs p-1 rounded mb-1 truncate cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: event.calendarColor || '#3b82f6', color: 'white' }}
                  onClick={() => onEventClick(event)}
                  title={event.summary}
                >
                  {event.summary}
                </div>
              ))}
              {allDayEvents.length > 2 && (
                <div className="text-xs text-gray-500">+{allDayEvents.length - 2} more</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      {hours.map((hour) => (
        <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
          <div className="p-2 text-xs text-gray-500 text-right pr-3">
            {format(new Date().setHours(hour, 0), 'h a')}
          </div>
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const hourEvents = dayEvents.filter((event) => {
              const eventHour = getHours(new Date(event.start));
              return eventHour === hour;
            });

            return (
              <div key={day.toISOString()} className="border-l h-12 relative">
                {hourEvents.map((event, idx) => {
                  const startMinutes = getMinutes(new Date(event.start));
                  const duration = differenceInMinutes(new Date(event.end), new Date(event.start));
                  const height = Math.min(duration, 60);
                  const top = (startMinutes / 60) * 48;

                  return (
                    <div
                      key={event.id}
                      className="absolute text-xs p-1 rounded overflow-hidden cursor-pointer hover:opacity-80"
                      style={{
                        backgroundColor: event.calendarColor || '#3b82f6',
                        color: 'white',
                        top: `${top}px`,
                        height: `${(height / 60) * 48}px`,
                        left: `${idx * 4}px`,
                        right: '2px',
                        zIndex: idx + 1,
                      }}
                      onClick={() => onEventClick(event)}
                      title={event.summary}
                    >
                      <div className="font-medium truncate">{event.summary}</div>
                      {height > 30 && (
                        <div className="text-[10px] opacity-80">
                          {format(new Date(event.start), 'h:mm a')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return (
        isSameDay(eventStart, day) ||
        (eventStart < startOfDay(day) && eventEnd > startOfDay(day))
      );
    });
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] p-1 border-b border-r ${
                !isCurrentMonth ? 'bg-gray-50' : ''
              } ${isToday(day) ? 'bg-blue-50' : ''}`}
            >
              <div
                className={`text-sm mb-1 ${
                  isToday(day)
                    ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center'
                    : isCurrentMonth
                    ? 'text-gray-900'
                    : 'text-gray-400'
                }`}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: event.calendarColor || '#3b82f6',
                      color: 'white',
                    }}
                    onClick={() => onEventClick(event)}
                    title={event.summary}
                  >
                    {!event.isAllDay && (
                      <span className="opacity-80">{format(new Date(event.start), 'h:mm ')} </span>
                    )}
                    {event.summary}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 pl-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventDetailModal({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with color bar */}
        <div
          className="h-2 rounded-t-lg"
          style={{ backgroundColor: event.calendarColor || '#3b82f6' }}
        />

        <div className="p-4">
          {/* Close button */}
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Event title */}
          <h2 className="text-xl font-semibold mb-4">{event.summary}</h2>

          {/* Event details */}
          <div className="space-y-3">
            {/* Time */}
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                {event.isAllDay ? (
                  <div>{format(startDate, 'EEEE, MMMM d, yyyy')}</div>
                ) : (
                  <>
                    <div>{format(startDate, 'EEEE, MMMM d, yyyy')}</div>
                    <div className="text-gray-600">
                      {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Calendar */}
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: event.calendarColor || '#3b82f6' }}
                />
                <span>{event.calendarName}</span>
                <span className="text-gray-400 text-sm">({event.accountEmail})</span>
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>{event.location}</div>
              </div>
            )}

            {/* Meeting URL */}
            {event.meetingUrl && (
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-gray-400" />
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  Join video call <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="pt-3 border-t">
                <p className="text-gray-600 whitespace-pre-wrap text-sm">{event.description}</p>
              </div>
            )}
          </div>

          {/* Open in Google Calendar */}
          {event.htmlLink && (
            <div className="mt-4 pt-4 border-t">
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
              >
                Open in Google Calendar <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
