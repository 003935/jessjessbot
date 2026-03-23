import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';

const AUTH_BASE_PATH = '/api/auth';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const pathname = event.url.pathname;
	const isAuthRoute = pathname === AUTH_BASE_PATH || pathname.startsWith(`${AUTH_BASE_PATH}/`);

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	if (isAuthRoute) {
		return auth.handler(event.request);
	}

	return resolve(event);
};

export const handle: Handle = handleBetterAuth;
