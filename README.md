<!-- This repo is improved via pingybot. -->
#  <img src="apps/dashboard/static/bunny-logo.png" alt="JessJessBot bunny logo" width="30"> JessJessBot


JessJessBot is a Discord bot and web dashboard for servers. She handles the annoying moderation like adding or removing roles and can join a conversation when someone says “jjb” or mentions her. She can chat, remember details people share, and respond to game and community requests.

## Features

- Conversational replies when summoned by name or mention, with saved preferences and community context
- Remembers things members mention about themselves in chat (jobs, games they main, upcoming plans); anyone can say “stop remembering stuff about me” to turn it off and clear it, or “what do you remember about me” to check
- Web search for current events and facts while chatting (optional, via Tavily)
- Path of Exile 2 loot rolls, inventories, and leaderboards
- Wordle and Riot API powered League of Legends leaderboards
- A Hall of Fame for the server's most reacted-to messages
- Movie requests, custom game events, and signups
- A web dashboard for server settings, game roles, event management, and community statistics

## Use JessJessBot

Don’t want to host it yourself? [Add JessJessBot to your Discord server](https://discord.com/oauth2/authorize?client_id=1465304830011637811&scope=bot). You need to own the server or have the **Manage Server** permission to add it.

## Host it yourself

Requirements:

- Bun 1.3.11 or compatible, and Docker Compose
- A Discord application and bot token, plus the Wordle bot and role IDs; enable **Message Content** and **Server Members** intents in the Discord Developer Portal
- A Riot API key
- Discord OAuth credentials and a Better Auth secret to run the dashboard

PostgreSQL and Valkey are included in the Compose stack. TMDB, OMDb, DeepSeek, and Tavily (web search) keys are optional and only needed for their respective features. See [llms.txt](llms.txt) for environment setup and run instructions.

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
