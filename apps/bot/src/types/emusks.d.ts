// Narrow declaration for the installed emusks 2.3.15 JavaScript API.
declare module 'emusks' {
	export default class Emusks {
		login(token: string): Promise<unknown>;
		static close(): Promise<void>;
		users: {
			getByUsername(username: string): Promise<{ id: string; protected?: boolean }>;
			tweets(
				id: string,
				options: { count: number; cursor?: string }
			): Promise<{
				tweets: Array<{
					id: string;
					text: string;
					created_at: string;
					user?: { id: string };
					retweeting?: unknown;
					in_reply_to_status_id?: string;
				}>;
				nextCursor: string | null;
			raw?: { errors?: unknown[] };
		}>;
		replies(
			id: string,
			options: { count: number; cursor?: string }
		): Promise<{
			tweets: Array<{
				id: string;
				text: string;
				created_at: string;
				user?: { id: string };
				retweeting?: unknown;
				in_reply_to_status_id?: string;
			}>;
			nextCursor: string | null;
			raw?: { errors?: unknown[] };
		}>;
		};
	}
}
