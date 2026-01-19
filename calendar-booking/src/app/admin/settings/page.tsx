'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Calendar as CalendarIcon,
} from 'lucide-react';

interface Calendar {
  id: string;
  name: string;
  color?: string;
  isSelected: boolean;
  isWritable: boolean;
  isPrimary: boolean;
  connectedAccount: {
    email: string;
    isValid: boolean;
  };
}

interface ConnectedAccount {
  id: string;
  email: string;
  isValid: boolean;
  calendars: Calendar[];
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    // Check for OAuth callback messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'google_connected') {
      setMessage({ type: 'success', text: 'Google account connected successfully!' });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: 'Google authorization was denied.',
        missing_params: 'Missing authorization parameters.',
        invalid_state: 'Invalid authorization state.',
        state_expired: 'Authorization expired. Please try again.',
        unauthorized: 'You are not authorized to complete this action.',
        token_exchange_failed: 'Failed to exchange authorization code.',
        callback_failed: 'Authorization callback failed.',
      };
      setMessage({
        type: 'error',
        text: errorMessages[error] || 'An error occurred during authorization.',
      });
    }

    fetchCalendars();
  }, [searchParams]);

  const fetchCalendars = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/calendars');
      const data = await response.json();
      setCalendars(data.calendars || []);
    } catch (error) {
      console.error('Error fetching calendars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectGoogleAccount = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/google/connect');
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setMessage({ type: 'error', text: 'Failed to generate authorization URL' });
      }
    } catch (error) {
      console.error('Error connecting Google account:', error);
      setMessage({ type: 'error', text: 'Failed to connect Google account' });
    } finally {
      setIsConnecting(false);
    }
  };

  const syncCalendars = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/calendars', { method: 'PUT' });
      if (response.ok) {
        await fetchCalendars();
        setMessage({ type: 'success', text: 'Calendars synced successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to sync calendars' });
      }
    } catch (error) {
      console.error('Error syncing calendars:', error);
      setMessage({ type: 'error', text: 'Failed to sync calendars' });
    } finally {
      setIsSyncing(false);
    }
  };

  const updateCalendarSelection = async (calendarId: string, isSelected: boolean) => {
    const updatedCalendars = calendars.map((cal) =>
      cal.id === calendarId ? { ...cal, isSelected } : cal
    );
    setCalendars(updatedCalendars);

    try {
      const selectedIds = updatedCalendars.filter((cal) => cal.isSelected).map((cal) => cal.id);
      await fetch('/api/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarIds: selectedIds }),
      });
    } catch (error) {
      console.error('Error updating calendar selection:', error);
      // Revert on error
      fetchCalendars();
    }
  };

  // Group calendars by connected account
  const calendarsByAccount = calendars.reduce(
    (acc, cal) => {
      const email = cal.connectedAccount.email;
      if (!acc[email]) {
        acc[email] = {
          email,
          isValid: cal.connectedAccount.isValid,
          calendars: [],
        };
      }
      acc[email].calendars.push(cal);
      return acc;
    },
    {} as Record<string, { email: string; isValid: boolean; calendars: Calendar[] }>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500">Manage your connected accounts and calendars</p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-current opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>
                Connect your Google accounts to sync calendars
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={syncCalendars} disabled={isSyncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button size="sm" onClick={connectGoogleAccount} disabled={isConnecting}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Account
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : Object.keys(calendarsByAccount).length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No accounts connected
              </h3>
              <p className="text-gray-500 mb-4">
                Connect your Google account to start syncing calendars
              </p>
              <Button onClick={connectGoogleAccount} disabled={isConnecting}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Google Account
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.values(calendarsByAccount).map((account) => (
                <div key={account.email} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        account.isValid ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="font-medium">{account.email}</span>
                    {!account.isValid && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                        Reconnect required
                      </span>
                    )}
                  </div>
                  <div className="pl-4 space-y-2">
                    {account.calendars.map((calendar) => (
                      <div
                        key={calendar.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: calendar.color || '#3b82f6' }}
                          />
                          <div>
                            <span className="font-medium">{calendar.name}</span>
                            {calendar.isPrimary && (
                              <span className="ml-2 text-xs text-gray-500">Primary</span>
                            )}
                            {!calendar.isWritable && (
                              <span className="ml-2 text-xs text-yellow-600">Read-only</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`cal-${calendar.id}`} className="text-sm text-gray-500">
                            Include in availability
                          </Label>
                          <Switch
                            id={`cal-${calendar.id}`}
                            checked={calendar.isSelected}
                            onCheckedChange={(checked) =>
                              updateCalendarSelection(calendar.id, checked)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How calendar selection works</p>
              <p>
                When you select calendars to include in availability, your free/busy status
                from all selected calendars will be combined. A time slot is only shown as
                available if you're free across ALL selected calendars.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
