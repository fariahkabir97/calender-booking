'use client';

import { useState, useEffect } from 'react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CalendarPickerProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  availableDates: string[]; // Array of date strings in yyyy-MM-dd format
  timezone: string;
  minDate?: Date;
  maxDate?: Date;
}

export function CalendarPicker({
  selectedDate,
  onSelectDate,
  availableDates,
  timezone,
  minDate,
  maxDate,
}: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return startOfMonth(toZonedTime(now, timezone));
  });

  const availableDateSet = new Set(availableDates);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfMonth = startOfMonth(currentMonth).getDay();

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const canGoToPreviousMonth = () => {
    if (!minDate) return true;
    return !isBefore(startOfMonth(subMonths(currentMonth, 1)), startOfMonth(minDate));
  };

  const canGoToNextMonth = () => {
    if (!maxDate) return true;
    return !isBefore(maxDate, startOfMonth(addMonths(currentMonth, 1)));
  };

  const isDateAvailable = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availableDateSet.has(dateStr);
  };

  const isDateDisabled = (date: Date) => {
    const today = startOfDay(toZonedTime(new Date(), timezone));
    if (isBefore(date, today)) return true;
    if (minDate && isBefore(date, startOfDay(minDate))) return true;
    if (maxDate && isBefore(maxDate, date)) return true;
    return !isDateAvailable(date);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={!canGoToPreviousMonth()}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          disabled={!canGoToNextMonth()}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before the first day of the month */}
        {Array.from({ length: firstDayOfMonth }).map((_, index) => (
          <div key={`empty-${index}`} className="p-2" />
        ))}

        {/* Days of the month */}
        {days.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const disabled = isDateDisabled(day);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => !disabled && onSelectDate(day)}
              disabled={disabled}
              className={cn(
                'p-2 text-center text-sm rounded-md transition-colors',
                'hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
                isSelected && 'bg-blue-600 text-white hover:bg-blue-700',
                disabled && 'text-gray-300 cursor-not-allowed hover:bg-transparent',
                !isSelected && !disabled && 'text-gray-900',
                isCurrentDay && !isSelected && 'font-bold',
                !disabled && !isSelected && isDateAvailable(day) && 'bg-blue-50'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
