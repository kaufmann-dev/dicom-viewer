# Scans

A private web viewer for your own medical imaging. The owner signs in as admin through OIDC,
uploads DICOM folders, STL models, photos and PDFs into projects, and creates expiring
passcodes. Each passcode opens only the items selected for it. The people you give a passcode to,
such as your doctors, get a read-only viewer:

- **CT/MR volumes:** 3D MPR (axial, sagittal, coronal) with crosshairs, plus a 3D volume
  rendering with presets and, for CT, an adjustable HU threshold. Browsers without WebGL get the
  2D stack viewer instead
- **Other images:** 2D stack viewer, e.g. for X-rays, topograms and secondary captures, that also
  draws DICOM overlay planes such as the text of CT protocol pages
- **Structured reports:** DICOM SR text reports and radiation dose reports, rendered as readable
  text
- **STL models:** 3D viewer with orbit, pan and zoom
- **Photos:** JPEG, PNG, GIF, WebP and AVIF, fitted to the screen, with wheel or pinch zoom and
  drag pan
- **PDF documents:** PDF files and DICOM Encapsulated PDFs, rendered inside the page with PDF.js
  (scrolling pages, zoom, page indicator) on desktop and mobile

All three image viewers provide window/level, pan, zoom and length measurement.

The admin, and viewers whose passcode allows it, can download a series, a study or a whole
project. DICOM downloads are ZIP files organized as `Project/Study/Series/IM00001.dcm` in slice
order, with STL models under `Project/3D models/` and photos and PDF files under
`Project/Photos & documents/`. A single STL model, photo or PDF file downloads as the file itself.
A DICOM Encapsulated PDF downloads as DICOM, like any other series.

DICOM files are recognized by content, so folders without file extensions or a DICOMDIR work.
Photos and PDFs are imported only when chosen or dropped as individual files. Inside an uploaded
folder they are skipped, so the viewer icons and manuals on patient CDs do not become items.
JPEG Lossless, JPEG, JPEG-LS, JPEG 2000, HTJ2K, RLE and uncompressed transfer syntaxes are
decoded in the browser by Cornerstone3D.

## Run locally

Prerequisites: Node.js 24, pnpm and Podman.

1. Install dependencies and create your local environment file:

   ```sh
   pnpm install
   cp .env.example .env
   ```

   Set `BETTER_AUTH_SECRET` in `.env` (for example with `openssl rand -base64 32`), and set the
   OIDC variables if you want to use admin sign-in locally.

2. Start PostgreSQL and create the database:

   ```sh
   podman run --name postgres-sveltekit \
     --env POSTGRES_PASSWORD=postgres \
     --publish 5432:5432 \
     --volume postgres-sveltekit-data:/var/lib/postgresql/data \
     --detach postgres:18-alpine
   podman exec postgres-sveltekit psql -U postgres -c "create database dicom_viewer"
   ```

   If the `postgres-sveltekit` container already exists, run `podman start postgres-sveltekit`
   and only the `create database` command.

3. Start the app:

   ```sh
   pnpm dev
   ```

   Open <http://localhost:5173>. Database migrations run automatically when the server starts.
   If you use a different port, update `ORIGIN` and `BETTER_AUTH_URL` in `.env` to match.

Uploaded files and their stored preview images are kept under `DATA_DIR` (`./data` locally). The
database only stores metadata.

## Using the app

1. Sign in with **Admin sign in**.
2. Under **Projects**, create a project and choose a folder or files, or drag them onto the
   upload area. Uploading a folder twice, or overlapping folders, skips instances that are
   already stored.
3. Under **Passcodes**, create a passcode. Give it a label, a code of your choice (at least six
   letters or digits; case, spaces and dashes are ignored), an expiry and whether downloads are
   allowed, then select the items it may open. Checking a project selects all of its items.
4. Share the site link and the code. The code works until it expires. Editing a passcode's items
   or download setting, or deleting the passcode, takes effect immediately, including for viewers
   who are already signed in. A viewer session lasts at most seven days.

**Allow downloads** is off by default. Turning it off hides the download buttons and blocks the
download endpoint, but it cannot stop a viewer from saving the images that the browser loads to
display them.

After five wrong passcodes, an IP address is blocked for 15 minutes.

## Configuration

| Variable             | Required | Description                                                                                                       |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string                                                                                      |
| `DATA_DIR`           | Yes      | Directory for uploaded DICOM, STL, photo and PDF files; must be persistent                                        |
| `ORIGIN`             | Yes      | Public origin of the app, e.g. `https://scans.kaufmann.dev`; also needed at build time (SvelteKit `paths.origin`) |
| `BETTER_AUTH_URL`    | Yes      | Same value as `ORIGIN`                                                                                            |
| `BETTER_AUTH_SECRET` | Yes      | At least 32 random characters                                                                                     |
| `OIDC_DISCOVERY_URL` | Yes      | The provider's `/.well-known/openid-configuration` URL                                                            |
| `OIDC_CLIENT_ID`     | Yes      | OIDC client ID                                                                                                    |
| `OIDC_CLIENT_SECRET` | Yes      | OIDC client secret                                                                                                |
| `BODY_SIZE_LIMIT`    | Yes      | Maximum request body size; must exceed the largest file, e.g. `1G`                                                |

`BODY_SIZE_LIMIT` is read by the production server (`node build`). Without it, adapter-node
rejects bodies over 512 KB, which blocks most uploads.

## Authentication Setup

The admin signs in from the login screen with an OIDC Authorization Code flow (PKCE,
`client_secret_post`) handled by Better Auth. Admin sessions last seven days and are not extended.
The OIDC provider's access policy is the only admin admission control. Signing out also ends the
provider session.

- Public Client: Off
- Callback URL: `/api/auth/callback/oidc`
- Logout Callback URL: `/`
- Environment variables: `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`,
  `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, all required; see [Configuration](#configuration).

## Coolify Deployment

- **Build Pack:** Nixpacks (`nixpacks.toml` installs and builds with pnpm 11 and starts `node build`)
- **Base Directory:** `/`
- **Domain:** `https://scans.kaufmann.dev`
- **Persistent Storage:** mount a volume at `/data` and set `DATA_DIR=/data`. Include this volume
  in backups together with the PostgreSQL database.
- **Database:** a PostgreSQL resource. Migrations run automatically when the app starts.
- **Environment Variables:** all required; see [Configuration](#configuration).
  - `DATABASE_URL`: connection string of the PostgreSQL resource
  - `DATA_DIR`: `/data`
  - `ORIGIN`: `https://scans.kaufmann.dev`
  - `BETTER_AUTH_URL`: `https://scans.kaufmann.dev`
  - `BETTER_AUTH_SECRET`: at least 32 random characters
  - `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`: from the OIDC provider
  - `BODY_SIZE_LIMIT`: e.g. `1G`

## Development

```sh
pnpm check                      # Svelte and TypeScript checks
pnpm lint                       # Prettier and ESLint
pnpm test                       # Unit tests (Vitest)
pnpm build                      # Production build into build/
pnpm db:generate --name <name>  # Generate a migration after changing src/lib/server/db/schema.ts
```

Main code locations:

- `src/lib/server/ingest.ts` and `src/lib/server/dicom/`: upload parsing, deduplication, series
  ordering, MPR eligibility and SR extraction
- `src/lib/server/viewer-auth.ts` and `src/lib/server/access.ts`: passcode sessions and access
  checks
- `src/lib/server/file-types.ts`: recognizing photos and PDFs by content, and stored file types
- `src/lib/viewer/`: Cornerstone3D, SR, STL, photo (`photo-viewer.svelte`) and PDF
  (`pdf-viewer.svelte`, PDF.js) viewers
- `src/routes/admin/`: project and passcode management
