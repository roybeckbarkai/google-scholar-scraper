# Google Scholar Publication Scraper

A small full-stack app for collecting publications from a Google Scholar profile, editing the result in the browser, enriching entries with DOI metadata from Crossref, and exporting the cleaned list in several formats.

The frontend is a React + Vite app. In production, the backend runs as Vercel serverless functions under `api/`. The repository also includes an older Express server in `server.js`, but the deployed app uses the Vercel API routes.

## What it does

- Scrapes a public Google Scholar profile from a pasted profile URL
- Pulls all visible publications across paginated result pages
- Detects likely lead-author papers based on the profile name
- Detects likely preprints based on venue text such as `arXiv`, `bioRxiv`, or `preprint`
- Lets you edit publications inline in the browser
- Lets you add manual publications that are missing from Google Scholar
- Looks up DOIs through the Crossref API
- Saves and reloads datasets as JSON files in the browser
- Exports publication lists as:
  - printable view / PDF via the browser print dialog
  - LaTeX
  - BibTeX-like `.bib`

## Stack

- React 18
- Vite 4
- Tailwind CSS
- Vercel Functions
- Axios
- Cheerio
- Crossref API

## Project structure

```text
.
├── api/
│   ├── doi.js            # Vercel serverless function for DOI lookup
│   └── scrape.js         # Vercel serverless function for Google Scholar scraping
├── data/
│   └── publications.json # Example dataset
├── scripts/
│   ├── install-local.bat # Windows installer helper
│   ├── install-local.sh  # macOS/Linux installer helper
│   ├── run-local.bat     # Windows local run helper
│   └── run-local.sh      # macOS/Linux local run helper
├── src/
│   ├── App.jsx           # Main UI and export logic
│   ├── index.css         # Tailwind styles
│   └── main.jsx          # React entry point
├── index.html
├── package.json
├── server.js             # Optional legacy Express server
├── vercel.json
└── vite.config.js
```

## Requirements

- Node.js 18+ recommended
- npm 10+ recommended
- A public Google Scholar profile URL
- Internet access for Google Scholar and Crossref

No environment variables are required for local use.

Optional for production or blocked serverless environments:

- `SCHOLAR_FETCH_URL_TEMPLATE` for routing Scholar requests through a proxy when Vercel gets blocked

## Why run it locally

Running locally is the most user-friendly option if your deployed Vercel app is returning `403` while scraping Google Scholar.

Benefits:

- Google Scholar is less likely to block requests coming from your own machine than from a shared serverless datacenter IP
- you can use the full app, including `/api/scrape` and `/api/doi`, without deploying changes first
- debugging is easier because you can test immediately after editing code
- local use avoids unnecessary redeploys when you only want to fetch or export data

## Local installation and run

This is the recommended way to use the app if scraping fails on Vercel.

### Step 1: download the project

You need a local copy of the project before you can install or run it.

Options:

- If the project is hosted on GitHub, open the repository page, click `Code`, then click `Download ZIP`
- If you use Git, clone the repository with `git clone https://github.com/roybeckbarkai/google-scholar-scraper.git`
- If someone shared the project as a ZIP file, extract it to a folder on your computer

This app lives inside the repository subfolder `google-scholar-scraper`.

After downloading or cloning, open that inner `google-scholar-scraper` folder before running any commands.

### Windows quick start

1. Download the repository ZIP from [GitHub](https://github.com/roybeckbarkai/google-scholar-scraper/archive/refs/heads/main.zip)
2. Extract the ZIP
3. Open the inner `google-scholar-scraper` folder
4. Install Node.js LTS from [nodejs.org](https://nodejs.org/)
5. Open `scripts`
6. Double-click `start-local.bat`

### macOS quick start

1. Download the repository ZIP from [GitHub](https://github.com/roybeckbarkai/google-scholar-scraper/archive/refs/heads/main.zip)
2. Extract the ZIP
3. Open the inner `google-scholar-scraper` folder
4. Install Node.js LTS from [nodejs.org](https://nodejs.org/)
5. Open `scripts`
6. Double-click `start-local.command`

### Linux quick start

1. Download the repository ZIP from [GitHub](https://github.com/roybeckbarkai/google-scholar-scraper/archive/refs/heads/main.zip)
2. Extract the ZIP
3. Open the inner `google-scholar-scraper` folder
4. Install Node.js 18+ and `npm`
5. Open `scripts`
6. Double-click `start-local.desktop`

Some Linux desktops may ask you to allow launching the file the first time.

### Manual install on any platform

If you prefer not to use the helper scripts, use:

```bash
npm install
npm run run-local
```

`npm run run-local` starts the full local app through Vercel's local runtime, which is the correct mode for scraping and DOI lookup.

## Running locally

There are two local development modes in this repo.

### Recommended: full app with API routes

Use the full local runtime so both the frontend and `api/` functions are available.

```bash
npm run run-local
```

Equivalent helper scripts:

- Windows: `scripts\run-local.bat`
- macOS/Linux: `./scripts/run-local.sh`

This is the correct mode if you want scraping and DOI lookup to work locally. It is also the best option when your deployed Vercel app is being blocked by Google Scholar.

### Frontend-only mode

```bash
npm run dev
```

This starts the Vite frontend only. The UI will load, but requests to `/api/scrape` and `/api/doi` will not work unless you separately provide those routes through a proxy or another local backend.

## Build

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deployment

The repository is configured for Vercel.

Current Vercel settings are defined in `vercel.json`:

- `framework`: `vite`
- `installCommand`: `npm install`
- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`

### Deploy to Vercel

1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Keep the project root at the repository root.
4. Do not override the install or build commands unless you have a specific reason.
5. Deploy.

If you deploy through the CLI:

```bash
vercel
```

## How to use

1. Open the app.
2. Paste a Google Scholar profile URL such as:

```text
https://scholar.google.com/citations?user=XXXXXXXXXXX&hl=en
```

3. Click `Fetch List`.
4. Review and edit the imported publications.
5. Toggle `Lead Author` and `Preprint` where needed.
6. Use DOI lookup for missing DOIs.
7. Save or export the final result.

## Main UI features

### Scraping

The scraper extracts:

- `title`
- `authors`
- `venue`
- `year`
- `citations`
- `link`

The Vercel scraper paginates through the profile in batches of 100 publications until no more rows are found or a safety cap is reached.

### Automatic classification

After scraping:

- `Lead Author` is inferred by matching the profile surname against the first listed author
- `Preprint` is inferred from venue text heuristics

These are heuristics only. The UI is built to let you correct them manually.

### DOI enrichment

For publications without a DOI, the app queries Crossref using the title and venue.

Behavior:

- enrichment starts automatically after scraping
- you can manually trigger DOI lookup for an individual row
- if Crossref returns a match, the DOI is added to the row
- author text may also be replaced with Crossref author metadata when available

### Editing

Each publication can be edited inline:

- title
- authors
- venue
- DOI
- year
- citations
- lead-author flag
- preprint flag

Rows can also be deleted, and missing publications can be added manually through the modal form.

### Export options

- `Save`: download the current dataset as JSON
- `Print`: open a print-friendly grouped publication list
- `Save as PDF`: same print flow, intended for browser PDF export
- `Export LaTeX`: generate a standalone LaTeX document
- `Export .bib`: generate BibTeX-like entries for the current list

## API reference

### `POST /api/scrape`

Scrapes a Google Scholar profile.

Request body:

```json
{
  "url": "https://scholar.google.com/citations?user=XXXXXXXXXXX&hl=en"
}
```

Successful response shape:

```json
{
  "profileName": "Example Researcher",
  "publications": [
    {
      "id": "pub-0-1710000000000",
      "title": "Paper title",
      "authors": "Author A, Author B",
      "venue": "Journal name",
      "year": "2024",
      "citations": "12",
      "link": "https://scholar.google.com/...",
      "doi": ""
    }
  ]
}
```

Notes:

- method must be `POST`
- the `user` query parameter must exist in the Scholar URL
- failures usually come from invalid URLs, upstream blocking, or Google Scholar markup changes
- on Vercel, Google Scholar may block the datacenter IP with `403`; if that happens, set `SCHOLAR_FETCH_URL_TEMPLATE` to a proxy endpoint template such as `https://your-provider.example/?url={url}`

### `POST /api/doi`

Finds a DOI through Crossref.

Request body:

```json
{
  "title": "Paper title",
  "venue": "Journal name"
}
```

Successful response shape:

```json
{
  "doi": "10.1234/example-doi",
  "authors": "Doe, Jane; Smith, John"
}
```

Notes:

- method must be `POST`
- `title` is required
- if no reasonable match is found, the route returns `404`

## Dataset format

Saved datasets are JSON objects with this shape:

```json
{
  "profileName": "Example Researcher",
  "publications": [
    {
      "id": "pub-1",
      "title": "Paper title",
      "authors": "Author A, Author B",
      "venue": "Journal name",
      "year": "2024",
      "citations": "12",
      "link": "https://scholar.google.com/...",
      "doi": "10.1234/example",
      "isLead": true,
      "isPreprint": false
    }
  ],
  "lastUpdated": "2026-03-23T10:00:00.000Z"
}
```

The example file at `data/publications.json` uses the same general structure and can be used as a reference.

## Known limitations

- Google Scholar does not provide an official public scraping API for this use case
- Google Scholar can rate-limit, block, or change markup at any time
- Crossref matching is heuristic and may miss papers or return an imperfect match
- lead-author detection is based on surname matching and can be wrong
- preprint detection is based on venue text heuristics and can be wrong
- local `npm run dev` does not include the backend routes
- `server.js` is a legacy local server path and is not the primary runtime used by the deployed app

## Troubleshooting

### `vite: command not found` on Vercel

This usually means Vercel did not install project dependencies before running the build, or the project had stale build settings. This repo now defines the build behavior explicitly in `vercel.json`.

If the issue returns:

1. Make sure the latest `vercel.json` is deployed.
2. Ensure Vercel is using `npm install` and `npm run build`.
3. Remove any conflicting build overrides in the Vercel dashboard.
4. Redeploy.

### Scraping fails

Check:

1. the Scholar URL is a valid profile URL
2. the profile is public
3. Google Scholar is not throttling the request

If the error includes `403` on Vercel, the most likely cause is Google Scholar blocking the Vercel egress IP rather than a parser bug. The app now supports `SCHOLAR_FETCH_URL_TEMPLATE`, which should be a full URL template containing `{url}`. The scraper replaces `{url}` with the encoded Scholar page URL before fetching.

Example:

```bash
SCHOLAR_FETCH_URL_TEMPLATE="https://your-proxy.example/fetch?url={url}"
```

Add that variable in the Vercel project settings and redeploy. Without a proxy, direct Scholar scraping from serverless infrastructure is unreliable.

### DOI lookup fails

Possible reasons:

- Crossref has no matching DOI
- the publication title is incomplete
- the venue text is noisy or inconsistent

## Scripts

```bash
npm run dev         # Vite frontend only
npm run vercel-dev  # Full local app through Vercel
npm run run-local   # Same as above, named for end users
npm run install-local # Install dependencies
npm run build       # Production build
npm run preview     # Preview production build
npm run server      # Start legacy Express server
```

## License and attribution

This repository currently does not define a license file.

The UI footer attributes the project to Roy Beck, Tel Aviv University.
