# cantoche-rose

La Cantoche rose is a very simple web page that shows the weekly school lunch menu in Toulouse, for kindergartens (maternelle)
and primary schools (primaire). The page is in French.

- Switch between maternelle and primaire, browse the weeks, jump from day to day.
- Plain HTML, CSS and JavaScript: no build step, no dependencies. Opening `index.html` in a browser is enough.

## Data

Menus are read live from the [Toulouse Métropole open data portal](https://data.toulouse-metropole.fr/explore/dataset/menus/)
(`menus` dataset), straight from the browser through its public API. Nothing is stored or proxied.

## Development

```sh
node --test                # unit tests for menu.js
python3 -m http.server     # optional local server, then open http://localhost:8000
```

## Deployment

Every push to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml), which runs the tests,
then publishes only `index.html`, `style.css`, `menu.js` and `app.js` to GitHub Pages.
