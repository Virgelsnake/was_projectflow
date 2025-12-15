# OrgFlow (WBS / Org Chart)

Single-path web app:

- **Dashboard**: `dashboard.html`
- **Editor**: `index.html` + `client.js`
- **Persistence**: Firestore **client SDK** (browser) using the `charts` collection
- **Server**: `server.js` (static file server)

## Run locally

```sh
npm install
npm start
```

Then open:

- `http://localhost:3000/dashboard.html`

## Project structure

- **App pages**
  - `dashboard.html` — list/create charts
  - `index.html` — chart editor
- **Static server**
  - `server.js`
- **Static assets**
  - `public/firebase-config.js` — Firebase initialisation exposed as `window.firebaseDb`
  - `style.css`
- **Data**
  - `data/charts.json` — seed charts used by the dashboard when a pseudo-user has no charts
- **Documentation**
  - `docs/` — reference notes and refactor report

## Documentation

- `docs/process/refactoring-log.md`
- `docs/process/code-refactoring.md`
- `docs/reference/d3.md`
- `docs/learning/drag-drop-key-learnings.md`
