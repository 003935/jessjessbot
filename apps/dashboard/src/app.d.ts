import type { auth } from '$lib/server/auth';
import type { User, Session } from 'better-auth';

type AuthOptions = typeof auth.options;
type AuthPlugins = typeof auth.options.plugins;

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	type Awaitable<T> = T | PromiseLike<T>;
	namespace App {
		interface Locals {
			idk: number;
			user?: Omit<User<AuthOptions, AuthPlugins>, 'role'> & { role: 'user' | 'admin' };
			session?: Session<AuthOptions, AuthPlugins>;
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
