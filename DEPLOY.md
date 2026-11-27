# Deploying for free (Render + Cloudflare R2)

The game is a Node/Express server with a SQLite database, so it needs a host that
runs a process — not a static file host.

**GitHub Pages cannot run this app.** Pages only serves static files: it cannot
build the React frontend, run the API, or keep a database, which is why
`https://julian-create-stack.github.io/Football-Dynasty-27/` shows a blank page.

The setup here keeps everything on free tiers and needs no persistent disk:

| Piece | Free allowance | Role |
| --- | --- | --- |
| Render Web Service (Docker) | 750 instance hours/month | Runs the app |
| Cloudflare R2 | 10 GB storage, free egress | Stores the database file |
| Litestream (in the image) | open source | Streams SQLite changes to R2, restores on boot |

Saves survive restarts, redeploys and the free instance spinning down, because
the database lives in R2 and is restored into the fresh container at startup.

## 1. Create the R2 bucket

1. Sign up at <https://dash.cloudflare.com> (free).
2. **R2 Object Storage → Create bucket**, name it `ufm-db`.
3. **R2 → Manage R2 API Tokens → Create API token**, permission **Object Read & Write**,
   scoped to `ufm-db`. Copy the **Access Key ID** and **Secret Access Key**.
4. Note your endpoint: `https://<account-id>.r2.cloudflarestorage.com`
   (the account ID is shown on the R2 overview page).

## 2. Create the Render service

1. Sign up at <https://render.com> (free) and connect the GitHub account that owns
   `Julian-create-stack/Football-Dynasty-27`.
2. **New → Web Service**, pick the repository, branch `main`.
3. Set **Language: Docker** (Render builds the `Dockerfile` in this repo).
4. Set **Instance Type: Free**.
5. Set **Health Check Path** to `/api/health`.
6. Add these environment variables:

   ```text
   LITESTREAM_BUCKET=ufm-db
   LITESTREAM_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   LITESTREAM_ACCESS_KEY_ID=<from the API token>
   LITESTREAM_SECRET_ACCESS_KEY=<from the API token>
   ```

   `PORT`, `NODE_ENV` and `DATA_DIR` are already set inside the image.
7. **Create Web Service** and wait for the deploy to finish, then open the
   `https://<service>.onrender.com` URL Render gives you.

## 3. Check it works

- `https://<service>.onrender.com/api/health` returns `{"ok":true,...}`.
- The start screen renders and a new career can be created.
- In the Render dashboard use **Manual Deploy → Restart**, then reload the page:
  the career is still there, restored from R2.

## 4. Everyday workflow

Push to `main` (merge a pull request) and Render rebuilds and redeploys
automatically. That is the whole loop: the Base44 preview for editing, GitHub for
the code, Render for the public game.

## Limits to know

- A free instance **spins down after 15 minutes without traffic**; the next visit
  takes about a minute to come back. The database is not affected.
- 750 free instance hours per month, single instance only (which is what SQLite
  needs — never scale this service above one instance).
- Free instances have no shell access.
- Free Render Postgres expires after 30 days, which is why this uses R2 instead.

## Without R2

If the `LITESTREAM_*` variables are absent the container still starts and serves
the game, but the database lives only on the container filesystem, so careers are
lost on every restart or redeploy.
