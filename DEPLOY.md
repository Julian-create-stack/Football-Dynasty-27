# Putting the game online for free (no credit card)

The game is a Node/Express server with a SQLite database, so it needs a host that
runs a process and keeps files between visits.

**GitHub Pages cannot run this app.** Pages only serves static files: it cannot
build the React frontend, run the API, or keep a database, which is why
`https://julian-create-stack.github.io/Football-Dynasty-27/` shows a blank page.

## Option A (recommended): alwaysdata Free

alwaysdata's Free plan is €0 forever, needs **no credit card** (email + password
only), and gives 1 GB of **persistent** disk, 256 MB RAM and a public
`https://<account>.alwaysdata.net` address. Careers live in `data/game.db` on that
disk, so they survive restarts.

Its 256 MB of RAM is enough to *run* the game (~55 MB) but not to *build* the
React bundle (~490 MB), so the build happens once per push in GitHub Actions and
is published to a `deploy` branch. The host only downloads and starts it.

### 1. Create the account

1. Go to <https://www.alwaysdata.com/en/register/> and sign up (email + password).
2. Pick the **Free** plan (0 €/month). No payment details are asked for.
3. In the admin panel open **Environment → Node.js** and set the default version
   to **22**.

### 2. Publish the build branch

1. Merge the pull request into `main` (the deployment files must be on `main`).
2. Open the repository's **Actions** tab and wait for **Publish playable build**
   to finish green. It creates/updates a branch called `deploy` containing the
   source plus the compiled `dist/` folder.
3. `deploy` is rebuilt automatically on every later push to `main`.

### 3. Put the code on alwaysdata

Connect over SSH (the address is shown under **Remote access → SSH**):

```sh
ssh <account>@ssh-<account>.alwaysdata.net
git clone -b deploy https://github.com/Julian-create-stack/Football-Dynasty-27.git ufm
cd ufm
npm ci --omit=dev
```

### 4. Create the site

In the admin panel: **Web → Sites → Add a site**, type **Node.js**, and use:

```text
Command:   node /home/<account>/ufm/server/index.js
```

Save. The site shows its address (`https://<account>.alwaysdata.net`). The app
reads the port alwaysdata gives it, so no port needs configuring. Open the
address, pick a club and start a career.

### 5. Updating the game later

```sh
# after merging a change into main and the Action has finished
ssh <account>@ssh-<account>.alwaysdata.net
cd ufm && git pull && npm ci --omit=dev
```

Then press **Restart** on the site in the admin panel.

### Good to know

- Careers are stored in `~/ufm/data/game.db` and alwaysdata keeps 3 days of
  backups on the Free plan.
- 256 MB RAM is the only tight limit; the running game uses about 55 MB.
- No Docker, no object storage and no card are involved on this path.

## Option B (optional): Render + Cloudflare R2

Only needed if you prefer a container host and already have a Cloudflare account
(R2 asks for payment details even on its free tier).

| Piece | Free allowance | Role |
| --- | --- | --- |
| Render Web Service (Docker) | 750 instance hours/month | Runs the app |
| Cloudflare R2 | 10 GB storage, free egress | Stores the database file |
| Litestream (in the image) | open source | Streams SQLite changes to R2, restores on boot |

1. **R2**: create a bucket `ufm-db`, create an API token with *Object Read &
   Write* on it, note the endpoint `https://<account-id>.r2.cloudflarestorage.com`.
2. **Render**: New → Web Service → this repository, branch `main`, Language
   **Docker**, Instance Type **Free**, Health Check Path `/api/health`.
3. Add environment variables:

   ```text
   LITESTREAM_BUCKET=ufm-db
   LITESTREAM_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   LITESTREAM_ACCESS_KEY_ID=<from the API token>
   LITESTREAM_SECRET_ACCESS_KEY=<from the API token>
   ```

4. Deploy, then check `/api/health` and create a career. Use **Manual Deploy →
   Restart** and reload: the career is restored from R2.

Without the `LITESTREAM_*` variables the container still starts, but careers live
only on the container filesystem and are lost on every restart or redeploy.
