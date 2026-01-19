import { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      timezone?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    timezone?: string;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // Fetch timezone from database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { timezone: true },
        });
        token.timezone = dbUser?.timezone || 'America/New_York';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.timezone = token.timezone;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Default timezone for new users
      await prisma.user.update({
        where: { id: user.id },
        data: { timezone: 'America/New_York' },
      });
    },
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      connectedAccounts: {
        where: { isValid: true },
        include: {
          calendars: true,
        },
      },
      eventTypes: true,
    },
  });
}
