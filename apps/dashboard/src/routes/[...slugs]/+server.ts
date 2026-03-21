import { auth } from '$lib/server/auth';
import { Elysia, type Context } from 'elysia';

const betterAuthView = (context: Context) => {
	const BETTER_AUTH_ACCEPT_METHODS = ['POST', 'GET'];
	// validate request method
	if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
		return auth.handler(context.request);
	} else {
		context.status(405);
	}
};

const app = new Elysia({ prefix: '/api' }).all('/auth/*', betterAuthView);

type RequestHandler = (v: { request: Request }) => Response | Promise<Response>;

export const fallback: RequestHandler = ({ request }) => app.handle(request);
