declare module 'bun:sqlite' {
	export class Database {
		constructor(path: string, options?: { create?: boolean });
		exec(sql: string): void;
		query(sql: string): {
			all(...params: unknown[]): unknown[];
			get(...params: unknown[]): unknown;
			run(...params: unknown[]): unknown;
		};
		transaction<T>(callback: () => T): () => T;
	}
}
