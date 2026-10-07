# jessjessbot

A Discord bot I made for my server, with a dashboard for managing it.

It can chat when mentioned, recap conversations with `/tldr`, and help run games and events. The dashboard shows server stats and upcoming events, and lets admins manage game roles and Hall of Fame channels.

Built with Bun, TypeScript, discord.js, Sapphire, SvelteKit, PostgreSQL, and Valkey. It uses the Riot Games API for League data and the DeepSeek API for optional chat and recaps.

## What it does

**Hall of Fame.** `/fame` ranks the server's most reacted messages. Each entry shows the quote, author, reaction count, top emoji, and a link back to the message. You can choose all time or the past month, or filter by channel or user.

![Hall of Fame in Discord](<screenshots/hall of fame.png>)

**League and Wordle leaderboards.** `/lol` shows players' League ranks and LP using the Riot Games API. The bot also tracks posted Wordle results, and `/king` shows who has the most wins.

![League leaderboard in Discord](<screenshots/league leaderboard.png>)

![Wordle leaderboard in Discord](<screenshots/wordle leaderboard.png>)

**Custom games.** Mention the bot with a game and time, check the details it suggests, then confirm to post the event. People can join, leave, or mark themselves as maybe with buttons. `/upcoming` lists scheduled customs and their signups.

![Creating a customs event and signing up in Discord](<screenshots/customs creation.png>)

**Movie requests.** People can request films, and `/movie list` shows the most requested ones with a link to the full list.

![Most requested movies in Discord](<screenshots/movie list.png>)

## Run locally

Install Bun and Docker, then run `bun install`. Copy the example environment files in `apps/bot` and `apps/dashboard` to `.env`, add your Discord credentials, and configure `packages/database/.env` for PostgreSQL. Start everything with `docker compose up --build`. The dashboard runs at `http://localhost:3000`.

Run `bun run check` to check the TypeScript projects. Don't commit your `.env` files.
