# JessJessBot

JessJessBot is a Discord bot and web dashboard for a gaming community. It includes community commands, server administration, event signups, and statistics.

## Features

- Wordle and League of Legends statistics
- Movie requests and lists
- Custom game event scheduling and signups
- Server configuration, game roles, and community records
- Discord OAuth sign-in for the dashboard

## Tech stack

TypeScript, Bun workspaces, Discord.js, Sapphire, SvelteKit, PostgreSQL, Prisma, PgBouncer, Valkey, Better Auth, and Docker Compose.

## Project structure

```text
apps/bot/          Discord bot
apps/dashboard/    SvelteKit dashboard
packages/database/ Prisma schema, migrations, and database access
packages/discord-api/
packages/valkey/
packages/config-typescript/
```

See [llms.txt](llms.txt) for requirements, configuration, and instructions for running the project locally.
