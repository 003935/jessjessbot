# JessJessBot

JessJessBot is a Discord bot and web dashboard for servers. The bot has a funny personality and can join a conversation when someone says “jjb” or mentions her. She can chat, remember details people share, and respond to game and community requests.

## Features

- Conversational replies when summoned by name or mention, with saved preferences and community context
- Path of Exile 2 loot rolls, inventories, and leaderboards
- Wordle and Riot API powered League of Legends leaderboards
- A Hall of Fame for the server's most reacted-to messages
- Movie requests, custom game events, and signups
- A web dashboard for server settings, game roles, event management, and community statistics

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
