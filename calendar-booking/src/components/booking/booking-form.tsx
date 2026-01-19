'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface BookingFormProps {
  eventTypeName: string;
  selectedTime: string;
  formattedDate: string;
  formattedTime: string;
  duration: number;
  collectPhone: boolean;
  collectCompany: boolean;
  customQuestions?: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }>;
  onSubmit: (data: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    notes?: string;
    customResponses?: Record<string, string>;
  }) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function BookingForm({
  eventTypeName,
  selectedTime,
  formattedDate,
  formattedTime,
  duration,
  collectPhone,
  collectCompany,
  customQuestions,
  onSubmit,
  onBack,
  isSubmitting,
}: BookingFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    // Validate custom questions
    customQuestions?.forEach((q) => {
      if (q.required && !customResponses[q.id]?.trim()) {
        newErrors[`custom_${q.id}`] = `${q.label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      notes: notes.trim() || undefined,
      customResponses: Object.keys(customResponses).length > 0 ? customResponses : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">{eventTypeName}</h2>
          <p className="text-sm text-gray-500">
            {formattedDate} at {formattedTime} ({duration} min)
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            disabled={isSubmitting}
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email address *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            disabled={isSubmitting}
          />
          {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
        </div>

        {collectPhone && (
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              disabled={isSubmitting}
            />
          </div>
        )}

        {collectCompany && (
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              disabled={isSubmitting}
            />
          </div>
        )}

        {/* Custom questions */}
        {customQuestions?.map((question) => (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={`custom_${question.id}`}>
              {question.label} {question.required && '*'}
            </Label>
            {question.type === 'textarea' ? (
              <textarea
                id={`custom_${question.id}`}
                value={customResponses[question.id] || ''}
                onChange={(e) =>
                  setCustomResponses((prev) => ({
                    ...prev,
                    [question.id]: e.target.value,
                  }))
                }
                className="w-full min-h-[100px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                disabled={isSubmitting}
              />
            ) : question.type === 'select' ? (
              <select
                id={`custom_${question.id}`}
                value={customResponses[question.id] || ''}
                onChange={(e) =>
                  setCustomResponses((prev) => ({
                    ...prev,
                    [question.id]: e.target.value,
                  }))
                }
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                disabled={isSubmitting}
              >
                <option value="">Select an option</option>
                {question.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={`custom_${question.id}`}
                value={customResponses[question.id] || ''}
                onChange={(e) =>
                  setCustomResponses((prev) => ({
                    ...prev,
                    [question.id]: e.target.value,
                  }))
                }
                disabled={isSubmitting}
              />
            )}
            {errors[`custom_${question.id}`] && (
              <p className="text-sm text-red-500">{errors[`custom_${question.id}`]}</p>
            )}
          </div>
        ))}

        <div className="space-y-2">
          <Label htmlFor="notes">Additional notes</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Please share anything that will help prepare for our meeting..."
            className="w-full min-h-[100px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            disabled={isSubmitting}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scheduling...
            </>
          ) : (
            'Confirm Booking'
          )}
        </Button>
      </form>
    </div>
  );
}
