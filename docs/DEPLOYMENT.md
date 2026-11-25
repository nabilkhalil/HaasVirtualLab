# Deployment — GitHub Pages

The app is a static single-page build. The router is hash based (`#/simulator`), the Vite base is relative
(`./`), and there is no backend — so any static host works, and a GitHub Pages *project* site
(`https://<user>.github.io/HaasVirtualLab/`) needs no extra configuration.

## 1. Automated deploy (GitHub Actions)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`, and can also be run manually
(Actions → *Deploy to GitHub Pages* → Run workflow).

One-time repository setup:

1. Create the repository and push `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push again (or run the workflow). The job publishes `dist/` as the Pages artifact.

The deployment URL is printed in the workflow summary and appears under Settings → Pages:
`https://<user>.github.io/<repo>/`.

## 2. Manual deploy (no Actions)

```bash
npm ci
npm run build
npx gh-pages -d dist          # or: git subtree push --prefix dist origin gh-pages
```

Then set **Settings → Pages → Source: Deploy from a branch → `gh-pages` / root**.

## 3. Verify a deployment

```bash
curl -sI https://<user>.github.io/<repo>/ | head -1     # expect HTTP/2 200
```

In the browser, check that:

- the version badge in the header reads `v1.0.0`;
- `#/simulator` loads the 3D machine (a WebGL context is created);
- `#/reference` and `#/cases` render their tables and tiles;
- switching to Bahasa Melayu and reloading keeps the language;
- no request leaves the origin except the static assets themselves (no API, no analytics).

## 4. Local production check

```bash
npm run build
npm run preview        # http://127.0.0.1:4173
```

## 5. Notes

- `dist/` is git-ignored; only the workflow publishes it.
- The build emits a warning about the Simulator chunk (about 1.0 MB, 275 kB gzipped) being larger than the
  500 kB advisory. That is the three.js scene, loaded lazily on first visit to the simulator; the rest of the
  app stays small (index ~381 kB / 122 kB gzipped).
- Deep links are hash routes, so no server rewrite rule is needed.
- Do not deploy a build that still contains unverified machine data presented as fact; the Reference page keeps
  the "unverified" list visible for that reason.
