# PnP Trickster

A browser based React app for preparing print and play PDFs, card sheets, and game boards. Files and saved work stay in browser storage.

The board generator is available at `#en-GB/board-generator` or `#it-IT/board-generator` inside the single page app. Its React markup, JavaScript, CSS, translations, and jsPDF asset live in `src/tools/board/`. Wood textures remain in `public/board-generator/images/`, and the PDF preview uses `public/vendor/pdfjs/`.

## Development

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

The production preview uses the same `/pnp-trickster/` path as the GitHub Pages project site.

## GitHub Pages

The `main` branch workflow in `.github/workflows/pages.yml` builds and uploads `dist`. In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source. The site will be served at `https://mephitrpg.github.io/pnp-trickster/` unless a custom domain is configured.

Vite's `base` is set in `vite.config.ts`. If the repository name or hosting path changes, update it before publishing. Keep navigation on the existing hash routes so refreshing a tool page works with static hosting.

## Localization

`src/localization.ts` combines the English and Italian dictionaries with shared labels. Add each new key to the relevant `lang/en.ts` and `lang/it.ts` pair, or to `shared` for app wide text. React components call `useLocalization().t(key, values)`; the card printer's DOM editor uses the same translator through `window.tr`. The URL selects the locale (`#en-GB/...` or `#it-IT/...`), and missing translations fall back to English.

All application source uses TypeScript. UI templates use TSX, including the card printer's editor, cards, backs, dialogs, loading overlay, and PDF preview. The image and PDF workers use `.ts` because they do not render UI. Run `npm run typecheck` to check all application modules before building.
