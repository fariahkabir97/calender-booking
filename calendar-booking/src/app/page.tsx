import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Shield, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-bold">CalBook</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/login">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-20 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Scheduling made
            <span className="text-blue-600"> simple</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            Connect your Google Calendars, set your availability, and let people
            book time with you. No more back-and-forth emails.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8">
                Start for free
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Learn more
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="py-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need for effortless scheduling
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Calendar className="h-8 w-8" />}
              title="Multi-Calendar Support"
              description="Connect multiple Google accounts and calendars. Your availability is automatically calculated across all of them."
            />
            <FeatureCard
              icon={<Clock className="h-8 w-8" />}
              title="Smart Scheduling"
              description="Set working hours, buffer times, and minimum notice. Prevent back-to-back meetings and last-minute bookings."
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8" />}
              title="Double-Booking Prevention"
              description="Real-time availability checks ensure no overlapping bookings, even with concurrent requests."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="Automatic Invites"
              description="Calendar events are created automatically with Google Meet links. Both you and your guest receive invitations."
            />
          </div>
        </div>

        {/* How it works */}
        <div className="py-20 border-t">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <StepCard
              number="1"
              title="Connect your calendars"
              description="Sign in with Google and connect your calendars. Select which ones to include in your availability."
            />
            <StepCard
              number="2"
              title="Create event types"
              description="Set up different meeting types with custom durations, locations, and booking rules."
            />
            <StepCard
              number="3"
              title="Share your link"
              description="Send your booking page link to anyone. They pick a time, and it's on both calendars instantly."
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">CalBook</span>
            </div>
            <p className="text-sm text-gray-500">
              Built with Next.js, Prisma, and Google Calendar API
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="text-blue-600 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
