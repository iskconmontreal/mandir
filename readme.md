# Mandala

Frontend for ISKCON Montreal temple management — donations, expenses, members, tax receipts. Talks to [Goloka](https://github.com/iskconmontreal/goloka) backend.

## Stack

Jekyll 4.3 static site, [Sprae](https://github.com/dy/sprae) reactivity, vanilla ES modules. No bundler, no build step.

## Setup

Prerequisites: Ruby, Bundler, Node.js.

```sh
bundle install
npm install
```

## Dev server

```sh
npm start          # http://localhost:4000  (HTTP, live reload)
npm run start:https # https://localhost:4000 (HTTPS, optional)
```

## Local backend

Point to a local Goloka instance via browser console:

```js
localStorage.setItem('mandir_api', 'http://localhost:8080')
```

Revert to production:

```js
localStorage.removeItem('mandir_api')
```

## Tests

Playwright, Chromium. Requires dev server running (`npm start`).

```sh
npm test        # headless
npm run test:ui # interactive UI
```

## Deploy

GitHub Pages builds and serves the site automatically on push to `main`.

```sh
git push origin main
```

Live at `https://iskconmontreal.github.io/mandir`. Backend API at `https://api.iskconmontreal.ca` (CORS + Bearer token).

## HTTPS mode (optional)

For local HTTPS testing:

```sh
mkdir -p .ssl
openssl req -x509 -newkey rsa:2048 -keyout .ssl/key.pem -out .ssl/cert.pem -days 365 -nodes -subj '/CN=localhost'
npm run start:https
```

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
