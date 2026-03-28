import { ILogger, LogLevel } from '@sapphire/framework';

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (error && typeof error === 'object' && 'message' in error) {
		return String((error as { message: unknown }).message);
	}
	return String(error);
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
	gray: '\x1b[90m',
};

function colorize(color: string, text: string): string {
	return `${color}${text}${colors.reset}`;
}

export class Logger implements ILogger {
	private prefix: string | null;
	private minLevel: LogLevel;

	constructor(prefix?: string, minLevel: LogLevel = LogLevel.Info) {
		this.prefix = prefix ?? null;
		this.minLevel = minLevel;
	}

	private format(level: LogLevel, message: string): string {
		const prefix = this.prefix ? colorize(colors.cyan, `[${this.prefix}]`) : '';
		const timestamp = colorize(
			colors.dim,
			new Date().toLocaleTimeString(undefined, { hour12: false })
		);

		let coloredLevel: string;
		switch (level) {
			case LogLevel.Error:
				coloredLevel = colorize(colors.red, '[ERROR]');
				break;
			case LogLevel.Warn:
				coloredLevel = colorize(colors.yellow, '[WARN]');
				break;
			case LogLevel.Info:
				coloredLevel = colorize(colors.green, '[INFO]');
				break;
			case LogLevel.Debug:
				coloredLevel = colorize(colors.blue, '[DEBUG]');
				break;
			case LogLevel.Trace:
				coloredLevel = colorize(colors.gray, '[TRACE]');
				break;
			case LogLevel.Fatal:
				coloredLevel = colorize(colors.bright + colors.red, '[FATAL]');
				break;
			case LogLevel.None:
				coloredLevel = colorize(colors.dim + colors.gray, '[NONE]');
				break;
			default:
				const _exhaustive: never = level;
				return _exhaustive;
		}

		return `${timestamp} ${prefix} ${coloredLevel} ${message}`;
	}

	has(level: LogLevel): boolean {
		return level >= this.minLevel;
	}

	error(...values: readonly unknown[]) {
		if (!this.has(LogLevel.Error)) return;
		console.error(this.format(LogLevel.Error, values.join(' ')));
	}

	warn(...values: readonly unknown[]) {
		if (!this.has(LogLevel.Warn)) return;
		console.warn(this.format(LogLevel.Warn, values.join(' ')));
	}

	info(...values: readonly unknown[]) {
		if (!this.has(LogLevel.Info)) return;
		console.info(this.format(LogLevel.Info, values.join(' ')));
	}

	debug(...values: readonly unknown[]) {
		if (!this.has(LogLevel.Debug)) return;
		console.log(this.format(LogLevel.Debug, values.join(' ')));
	}

	trace(...values: readonly unknown[]) {
		if (!this.has(LogLevel.Trace)) return;
		console.log(this.format(LogLevel.Trace, values.join(' ')));
	}

	fatal(...values: readonly unknown[]) {
		if (!this.has(LogLevel.Fatal)) return;
		console.error(this.format(LogLevel.Fatal, values.join(' ')));
	}

	write(level: LogLevel, ...values: readonly unknown[]): void {
		if (!this.has(level)) return;
		switch (level) {
			case LogLevel.Error:
				this.error(values.join(' '));
				break;
			case LogLevel.Warn:
				this.warn(values.join(' '));
				break;
			case LogLevel.Info:
				this.info(values.join(' '));
				break;
			case LogLevel.Debug:
				this.debug(values.join(' '));
				break;
			case LogLevel.Trace:
				this.trace(values.join(' '));
				break;
			case LogLevel.Fatal:
				this.fatal(values.join(' '));
				break;
			case LogLevel.None:
				this.info(values.join(' '));
				break;
			default:
				const _exhaustive: never = level;
				return _exhaustive;
		}
	}
}
