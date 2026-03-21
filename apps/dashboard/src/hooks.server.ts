import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
  if (!building && !event.url.pathname.startsWith('/api/auth/')) {
    try {
      const session = await auth.api.getSession({
        headers: event.request.headers,
      });
      if (session) {
        event.locals.session = session.session;
        event.locals.user = session.user;
      }
    } catch (error) {
      console.error('Session fetch error:', error);
    }
  }

  return resolve(event);
};

export const handle: Handle = handleBetterAuth;
