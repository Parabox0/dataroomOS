# Dataroom OS

An open-source data room for founders raising money or selling a company. You upload PDFs, choose who can see which folders, and share a link. It also does three things most data rooms don't:

- **Check the room.** It reads every file and lists what an investor would notice: missing documents, numbers that don't match across files, and personal details (emails, phone numbers, ID numbers) that people can see.
- **Ask.** Owners and viewers can ask a question in plain words. The answer cites the exact page it came from.
- **People.** Instead of charts, you get one sentence per viewer, built from active reading time on each page.

It also has a checklist of what investors expect, "Sort for me" (new files go to the right folder and tick off the checklist item they answer), per-person links with folder switches, short room addresses like `yourdomain.com/acme`, watermarks drawn into each page image, NDAs, passwords, expiring links, file versions, and questions and file requests from viewers.

This is the app only: no landing page, no pricing, no keys. You bring your own database, storage and (optionally) sign-in and AI.

## Run it on your computer

You need Node.js 22 or newer.

```
npm install
npx next dev
```

Open http://localhost:3000. With no settings at all, the app uses a built-in Postgres (PGlite) saved in `./.data`, keeps uploaded files in `./.data/files`, and adds a sample room for a made-up company called Brightloaf so you can click around. Create an account on the sign-up page, or press "Open the sample room" on the sign-in page.

## Settings

Copy `.env.example` to `.env.local` and fill in only what you need. Every setting is optional for local use. The ones that matter when you host it:

| Setting | What it does |
| --- | --- |
| `DATABASE_URL` | Any Postgres, for example Supabase (Connect, then "Session pooler"). Leave empty to use the built-in database. Tables are created on start from the `drizzle` folder. |
| `DATAROOM_SECRET` | A long random string that signs cookies. Make one with `openssl rand -hex 32`. If empty, the app makes one and saves it next to the database. |
| `FILES_DIR`, `PGLITE_DIR` | Where uploaded files and the built-in database live. Point both at a persistent disk when hosted. |
| `DATAROOM_DEMO_DATA` | Set to `0` to skip the sample room and hide its button. Do this before real people use it. |
| `NEXT_PUBLIC_APP_NAME` | Your product's name, shown in the app and on viewer pages. |
| `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` | Optional. With a key, Ask, file summaries, reply drafts and Check the room use Claude. Without one, the app uses its built-in search and rule-based checks, and answers still show sources. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Optional. Set both to use Clerk for sign-in. With either missing, the app uses its own email and password sign-in. |

Keep secret keys in your host's settings or in `.env.local`. Never commit them.

## Host it

The `Dockerfile` builds a production image that runs anywhere Docker runs. It expects a disk mounted at `/data` for files, the built-in database and the cookie secret.

On Railway, for example: create a service from your fork, add a volume at `/data`, set the settings above in Variables, and deploy. `railway.json` already points Railway at the Dockerfile and a health check.

If you use an outside Postgres such as Supabase, set `DATABASE_URL`. Uploaded files still go to `FILES_DIR`, so keep the volume.

## How it is built

- Next.js and React, with plain CSS in `src/app/globals.css`.
- Drizzle ORM on PGlite locally or postgres.js against any Postgres. Schema in `src/lib/db/schema.ts`, migrations in `drizzle/`.
- PDF.js reads PDFs and draws page images on the server, so watermarks and hidden details are part of the image a viewer sees.
- `src/lib/checks.ts` and `src/lib/check-room.ts`: Check the room. `src/lib/search.ts` and `src/lib/answer.ts`: Ask. `src/lib/insights.ts`: the one-sentence reading summaries. `src/lib/ingest.ts`: adding files, Sort for me and checklist matching.
- Viewer pages live under `src/app/r/[slug]` (a person's private link) and `src/app/[handle]` (the short room address).

## Tests

```
npx tsc --noEmit
npx vitest run
```

For an end-to-end pass with no browser, start a production server and run the script:

```
npx next build && DATAROOM_INSECURE_COOKIE=1 npx next start -p 3456 &
CLICK_BASE=http://localhost:3456 python3 scripts/e2e.py
```

`scripts/make-sample-pdfs.py` rebuilds the sample room's PDFs (needs `pip install weasyprint`).

## License

MIT. See `LICENSE`. Third-party parts and their licenses are listed in `THIRD_PARTY_NOTICES.md`. The sample company and everyone in it are made up.
