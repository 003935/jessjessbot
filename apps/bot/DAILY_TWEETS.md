# Daily tweets

The bot follows timeline pages without a page cap for @kadeem1111, excluding replies
and reposts. IDs deduplicate the saved text, publication date, and posting history.
It refreshes on startup and once per London calendar day, and can post cached tweets
when X is unavailable. Pagination stops at an empty page, missing/repeated cursor,
or an API error. X may limit accessible history, so this is not a guaranteed complete archive.
Both fetchers pause a random 15–30 seconds between pages and still stop on rate limits.

For a resumable local archive while the database is offline, run:
`bun --env-file=apps/bot/.env run apps/bot/src/modules/tweet-archive.ts`.
It checkpoints tweets and the next cursor in `skill-output` after each page.

Set these privately in `apps/bot/.env`:

```dotenv
X_AUTH_TOKEN=<X auth_token cookie>
DAILY_TWEETS_ENABLED=true
GUILD_ID=<server ID>
GENERAL_CHANNEL_ID=<general channel ID>
```

The channel ID is optional if there is exactly one text channel named `general`
in the configured guild. The bot needs View Channel and Send Messages permissions.

Apply migrations with the configured database credentials, then fetch:

```powershell
bun --env-file=apps/bot/.env run --cwd packages/database prisma migrate deploy
bun --env-file=apps/bot/.env run apps/bot/src/modules/tweet-fetch.ts
```

Restart/deploy the bot to enable posting. Docker startup applies migrations automatically.
Keep the bot running; no desktop automation is required. To disable, set
`DAILY_TWEETS_ENABLED=false` and restart.

One random saved tweet link is posted at a randomly chosen minute each day
(Europe/London). Unposted tweets are preferred until all have been used. The first
day picks a minute from the remaining day. Restarts preserve the schedule; missed
days are not backfilled. Multiple workers claim the same daily database row atomically.
To avoid duplicate messages after ambiguous Discord failures, a claimed send is not
retried, so an outage or crash during sending can mean a missed day. Successful
messages and claimed tweet IDs are recorded in `daily_tweet_posts`.

X failures are logged without tokens/raw responses and retried on the next daily
refresh (or restart). Fix rejected/expired credentials before restarting. Never
commit the session cookie.
