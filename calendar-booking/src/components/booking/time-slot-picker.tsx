'use client';

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';

interface TimeSlot {
  start: string;
  end: string;
}

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: string | null;
  onSelectSlot: (startTime: string) => void;
  timezone: string;
  isLoading?: boolean;
}

export function TimeSlotPicker({
  slots,
  selectedSlot,
  onSelectSlot,
  timezone,
  isLoading,
}: TimeSlotPickerProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No available times for this date
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
      {slots.map((slot) => {
        const startTime = new Date(slot.start);
        const isSelected = selectedSlot === slot.start;
        const timeDisplay = format(toZonedTime(startTime, timezone), 'h:mm a');

        return (
          <button
            key={slot.start}
            onClick={() => onSelectSlot(slot.start)}
            className={cn(
              'w-full py-3 px-4 text-center rounded-md border transition-colors',
              'hover:border-blue-500 hover:bg-blue-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              isSelected
                ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                : 'border-gray-200 bg-white text-gray-900'
            )}
          >
            {timeDisplay}
          </button>
        );
      })}
    </div>
  );
}
