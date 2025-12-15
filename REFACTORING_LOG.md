# Refactor Report: Codebase Review, Refactor, and Dead Code Removal

## 1. Summary of Codebase Analysis

### Overview of architecture and component relationships

This project is now intentionally structured as a **single-path application**:

- `server.js` serves static assets from the repository root and `public/`.
- `dashboard.html` (root) is the authoritative dashboard listing charts from Firestore `charts`.
- `index.html` + `client.js` (root) is the authoritative chart editor (D3) reading/writing Firestore `charts/{chartId}/nodes`.
- `public/firebase-config.js` is the shared Firebase initialiser, loaded by both `dashboard.html` and `index.html`.

### Key dependencies identified

- `express` (server)
- D3.js (loaded via CDN in `index.html`)
- Firebase client SDK (loaded via CDN in `dashboard.html` and `index.html`)

### Key rationale (source of truth)

The codebase previously contained **multiple parallel UI and persistence paths** (a `boards`-based “modern/refined” UI plus a server-side Firebase Admin API). These were removed to avoid multiple sources of truth and future developer confusion.

## 2. Refactoring Opportunities

### 2.1 `server.js` — simplify to static-only server

- **File name and line number**:
  - `server.js` (pre-refactor: lines 1–132)
  - `server.js` (post-refactor: lines 1–11)

- **Original code snippet** (`server.js` pre-refactor, e.g. lines 1–6 and 15–26):

```js
const express = require("express");
const { dbProvider } = require("./db/utils");

const { addNode, deleteNode, listNodes, updateNode, updateNodeColor } = require(
  `./db/provider_${dbProvider}.js`,
);

// ...

app.get("/api/tree", (req, res) => {
  listNodes((err, nodes) => {
    const tree = buildTree(nodes)[0] || {};
    res.json(tree);
  });
});
```

- **Refactored version** (`server.js` post-refactor, lines 1–11):

```js
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("."));
app.use(express.static("public"));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
```

- **Justification**:
  - The application now persists via **client-side Firestore** exclusively.
  - Keeping `/api/*` and DB-provider indirection implied a second persistence path and increased maintenance overhead.

- **Expected impact**:
  - Improved readability and reduced surface area.
  - Removes risk of stale/unused API endpoints being accidentally revived.

### 2.2 `index.html` — remove duplicated `<head>` and debug-only script

- **File name and line number**:
  - `index.html` pre-refactor: duplicated `<head>` block at lines 12–19
  - `index.html` pre-refactor: debug `<script>` block near the end (removed)

- **Original code snippet** (`index.html` pre-refactor, lines 11–20):

```html
</head>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WBS Organisational Chart</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <link href="./style.css" rel="stylesheet" type="text/css" />
</head>
```

- **Refactored version** (`index.html` post-refactor, lines 1–12):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WBS Organisational Chart</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    <link href="./style.css" rel="stylesheet" type="text/css" />
  </head>
```

- **Justification**:
  - Duplicated `<head>` is invalid HTML and makes the page harder to maintain.
  - Debug logging created noise without functional benefit.

- **Expected impact**:
  - Improved correctness and reduced confusion.

### 2.3 `package.json` — remove unused scripts and `firebase-admin`

- **File name and line number**:
  - `package.json` pre-refactor: scripts (lines 6–10), dependencies (lines 11–14)

- **Original code snippet** (`package.json` pre-refactor):

```json
"scripts": {
  "start": "node server.js",
  "start:firebase": "node server-firebase.js",
  "start:single": "node server.js"
},
"dependencies": {
  "express": "^4.18.2",
  "firebase-admin": "^13.6.0"
}
```

- **Refactored version** (`package.json` post-refactor):

```json
"scripts": {
  "start": "node server.js"
},
"dependencies": {
  "express": "^4.18.2"
}
```

- **Justification**:
  - `server-firebase.js` was deleted; the Admin SDK is no longer used.
  - Multiple start scripts suggested multiple authoritative run modes.

- **Expected impact**:
  - Clear single entry point: `npm start`.

## 3. Dead Code Deletions

### 3.1 Delete `public/*` “boards” dashboard/editor (duplicate UI path)

- **File name and line number**:
  - `public/dashboard.js` (deleted; evidence at lines 53–60)

- **Deleted code snippet** (`public/dashboard.js` pre-deletion, lines 53–60):

```js
// Load charts from Firestore
async function loadCharts() {
  const snapshot = await db.collection('boards').orderBy('updatedAt', 'desc').get();
  charts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

- **Evidence of dead code status**:
  - The `boards` collection is no longer part of the authoritative data model.
  - These files were an alternate UI flow and are now removed from disk.

- **Reason it is safe to delete**:
  - Root `dashboard.html` + root `index.html` fully cover listing/creating/editing charts via `charts`.

### 3.2 Delete server-side Firebase Admin API (`server-firebase.js`)

- **File name and line number**:
  - `server-firebase.js` (deleted; evidence at lines 1–15 and 270–276)

- **Deleted code snippet** (`server-firebase.js` pre-deletion, lines 1–12):

```js
const express = require("express");
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'wbs-orgflow',
    credential: admin.credential.applicationDefault()
  });
}
```

- **Evidence of dead code status**:
  - The editor/dashboard perform reads/writes via Firebase client SDK.
  - `server.js` is now static-only; no server API is required.

- **Reason it is safe to delete**:
  - Retaining a second persistence layer would reintroduce competing sources of truth.

## 4. Change Log

- **2025-12-15** — Simplified `server.js` to static-only server.
- **2025-12-15** — Cleaned `index.html` (removed duplicate `<head>` and debug logging).
- **2025-12-15** — Deleted duplicate “boards/refined” UI under `public/`.
- **2025-12-15** — Deleted `server-firebase.js`, DB providers, and seed scripts.
- **2025-12-15** — Simplified `package.json` to a single `start` script and removed `firebase-admin`.

## 5. Fallback Guidance

### Steps to trace and isolate issues

1. If charts do not load in `dashboard.html`:
   - Confirm Firestore rules allow reads of `charts` for the current pseudo-user.
   - Check browser console for Firestore permission errors.
2. If `index.html` fails to load chart data:
   - Ensure `/firebase-config.js` loads (served from `public/firebase-config.js`).
   - Verify URL includes `?chart=<chartId>`.

### Recommended tests post-refactor

1. Start server: `npm start`
2. Open: `http://localhost:3000/dashboard.html`
3. Create chart; open chart; add/edit/delete/reparent nodes.
4. Import WBS; refresh; verify persistence.
