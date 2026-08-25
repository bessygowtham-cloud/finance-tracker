---
name: finance-tracker-workflow
description: Working conventions and hard-won guardrails for the finance-tracker project (a single-file index.html PWA with Firebase/Firestore cloud sync, deployed via GitHub Pages). Load this whenever editing index.html, sw.js, or firestore.rules in this repo, or whenever the request touches deployment, cloud sync, Firestore data shape, or the Firebase console for this project — even a small-sounding UI tweak here can quietly break sync if the cloud-sync rules below aren't followed. Use this proactively at the start of any finance-tracker task, not just when the user mentions "sync" or "deploy" by name.
---

# Finance Tracker: Project Conventions

## What this project is

A personal finance tracker: **one giant `index.html`** (~7000+ lines, all HTML/CSS/JS inline, no build step), plus `sw.js` (service worker) and `firestore.rules` (a *reference* copy — see below). It deploys automatically via `.github/workflows/deploy.yml` on every push to `main`: GitHub Actions stamps a build timestamp and publishes to GitHub Pages, live in roughly 30–90 seconds. The user is non-technical, drives Firebase console changes by following your instructions and sharing screenshots, and often writes prompts through garbled speech-to-text — read for intent, not literal wording, and act rather than stall on unclear phrasing unless a decision is genuinely ambiguous or destructive.

## Ship every change the same way

1. **Edit** `index.html` (or `sw.js`).
2. **Verify locally before pushing** — every time, not just for risky changes:
   - `python3 -m http.server 3001` in the repo directory, then open it in the Browser pane tool.
   - Seed realistic test data directly into `localStorage` (key `financeState`, a JSON blob) via the JS console tool, rather than clicking through the UI by hand — much faster for setting up edge cases.
   - Exercise the actual change: call the real handler functions and inspect computed values/DOM state, not just a visual glance. Screenshot for layout changes; resize to the mobile preset since this is a phone-first PWA.
   - If a change doesn't seem to take effect on reload, suspect **stale caching** (the service worker or the browser) before suspecting your code — force it with a changed query string (`?cb=<anything>`) rather than assuming the edit was wrong.
3. **Commit and push straight to `main` without asking first.** This is a standing, explicit instruction from the user for this repo — don't reintroduce a confirmation step. (Still use real commit messages, and still stop to think if a change is genuinely destructive — the auto-push convention covers routine shipping, not judgment.)
4. Tell the user it'll be live in ~30–90 seconds and, if it's a PWA/installed-app context, that they may need to fully close and reopen the app once to pick up a changed service worker.

## Cloud sync: the part that's easy to quietly break

Personal data syncs to Firestore (project `finance-tracker-fdda4`) under `users/{uid}`. Three properties of this design are load-bearing — a change that violates one of them will *look* fine locally and then silently corrupt or lose data in the wild, which has happened before:

- **The whole state is written as one JSON string** (a `blob` field), not as nested Firestore fields. This isn't a style choice — Firestore rejects the array-of-objects shape this app's data naturally has (`transactions`, `purchases`, etc. are all arrays of objects), and two earlier attempts at narrower fixes both failed before this was diagnosed. **Never** change `saveToCloud()`/`readCloudDoc()` back to writing structured fields.
- **Merging is union-by-id with an `updatedAt` timestamp deciding conflicts**, not "cloud copy wins" or "local copy wins." A wholesale-replace merge previously caused real, reported data loss (a user's transactions vanishing after a second device synced). Any new synced list needs the same union treatment as existing ones (see `unionRecords` / `mergeObj` in the sync code) and needs its records stamped with `updatedAt` wherever they're created or edited.
- **Deletions are tombstoned** (`state.deletedIds`, synced) so a union-merge can't resurrect something the user deleted on one device while another device's stale copy still had it. Every new delete path needs to call `tombstone(id)`.

A separate, smaller collection (`trips/{tripId}`) exists for the Trip Splitter feature with a deliberately public read rule, so a share link needs no login. Keep any similar "share with someone who isn't signed in" feature in its own collection rather than folding it into the personal blob — that keeps the personal data's stricter rules intact and avoids pushing the ~1MB document limit (already hit once, from inline base64 bill photos — images now get downscaled/compressed before upload).

## Firebase console changes need the user's hands

You can edit the local `firestore.rules` file, but you **cannot** publish rule changes yourself — there's no deploy access to the live Firestore project from here. When a change requires new/updated rules:
1. Update `firestore.rules` in the repo (for reference/history).
2. Walk the user through the console step by step: exactly what to click, what the editor should look like before they hit Publish, and reassure them it's additive/reversible (Firestore keeps rule version history) since they tend to be nervous about breaking something.
3. Offer to review a screenshot before they click anything that looks irreversible (Publish, Delete, Regenerate).

## Before assuming one edit is enough

Several past bugs were the same shape: a hardcoded fallback/default value (a bank name, a category label, a default object shape) existed in more than one place, and only one was updated. Before calling a fix done, grep for other occurrences of the value or function you just changed — `load()`, `applySnapshot()`, `buildSnapshot()`, and the cloud-merge block in particular tend to each need the same field added when the data model grows.

Style-wise: minimal diffs, no comments unless they explain a non-obvious *why* (like the JSON-blob note above), and reuse existing CSS classes/UI patterns already in the file rather than inventing new ones.
