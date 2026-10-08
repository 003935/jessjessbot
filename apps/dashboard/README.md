# JessJessBot Dashboard

![JessJessBot bunny logo](static/bunny-logo.png)

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
bun x sv@0.12.8 create --template minimal --types ts --add eslint prettier tailwindcss="plugins:none" --install bun apps/dashboard
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Demo chat API

The server endpoint `POST /api/demo-chat` accepts `{ "messages": [{ "role": "user" | "assistant", "content": "..." }] }` and returns `{ "reply": "..." }`. Configure these server-side environment variables in the dashboard deployment:

- `DEEPSEEK_API_KEY` — required; keep this secret and never expose it to browser code.
- `DEEPSEEK_MODEL` — optional; defaults to `deepseek-flash`.
- `JESSJESSBOT_DEMO_ALLOWED_ORIGIN` — required exact browser origin, currently `https://jessawg.space`.
- `VALKEY_URL` — enables the endpoint's per-client rate limit when configured.

The endpoint supports CORS preflight and limits request size, message count, and message length. See the repository's `llms.txt` for environment setup.
