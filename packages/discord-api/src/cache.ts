export class AsyncCache<T> {
	private data: T | null = null;
	private lastUpdate: number = 0;
	private fetchPromise: Promise<T> | null = null;
	private fetcher: () => Promise<T>;
	private readonly refreshInterval: number;

	constructor(refreshInterval: number, fetcher: () => Promise<T>) {
		this.refreshInterval = refreshInterval;
		this.fetcher = fetcher;
	}

	async get() {
		if (Date.now() - this.lastUpdate > this.refreshInterval) {
			this.fetchPromise ??= this.fetcher()
				.then((result) => {
					this.data = result;
					this.lastUpdate = Date.now();
					this.fetchPromise = null;
					return result;
				})
				.catch((err) => {
					this.fetchPromise = null;
					throw err;
				});

			await this.fetchPromise;
		}
		return this.data!;
	}
}

class MapAsyncCacheItem<T> {
	private data: T | null = null;
	private lastUpdate: number = 0;
	private fetchPromise: Promise<T> | null = null;

	constructor() {}

	isCacheExpired(refreshInterval: number) {
		return Date.now() - this.lastUpdate > refreshInterval;
	}

	isFetching() {
		return this.fetchPromise !== null;
	}

	async get(refreshInterval: number, fetcher: () => Promise<T>) {
		if (this.isCacheExpired(refreshInterval)) {
			this.fetchPromise ??= fetcher()
				.then((result) => {
					this.data = result;
					this.lastUpdate = Date.now();
					this.fetchPromise = null;
					return result;
				})
				.catch((err) => {
					this.fetchPromise = null;
					throw err;
				});

			await this.fetchPromise;
		}
		return this.data!;
	}
}

export class MapAsyncCache<K, V> {
	private cache: Map<string, MapAsyncCacheItem<V>>;
	private readonly refreshInterval: number;
	private fetcher: (composite_key: K) => Promise<V>;
	private keyBuilder: (composite_key: K) => string;
	private cleanupInterval: ReturnType<typeof setInterval>;

	constructor(
		refreshInterval: number,
		fetcher: (composite_key: K) => Promise<V>,
		keyBuilder: (composite_key: K) => string,
		cleanupIntervalMs?: number
	) {
		this.cache = new Map<string, MapAsyncCacheItem<V>>();
		this.refreshInterval = refreshInterval;
		this.fetcher = fetcher;
		this.keyBuilder = keyBuilder;

		const interval = cleanupIntervalMs ?? Math.max(refreshInterval, 1000 * 60);
		this.cleanupInterval = setInterval(() => this.cleanup(), interval);
		if (this.cleanupInterval.unref) {
			this.cleanupInterval.unref();
		}
	}

	private cleanup() {
		for (const [key, item] of this.cache.entries()) {
			if (item.isCacheExpired(this.refreshInterval) && !item.isFetching()) {
				this.cache.delete(key);
			}
		}
	}

	async get(composite_key: K) {
		const key = this.keyBuilder(composite_key);
		let item = this.cache.get(key);
		if (!item) {
			item = new MapAsyncCacheItem<V>();
			this.cache.set(key, item);
		}
		return await item.get(this.refreshInterval, () => this.fetcher(composite_key));
	}
}
