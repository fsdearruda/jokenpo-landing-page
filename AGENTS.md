## Repository workflow

Before changing code:

1. Read `README.md` for setup, structure and validation commands.
2. Read `jokenpo-style-guide.md` for visual and editorial rules.
3. Read `docs/brand-content.md` for public business information.
4. Treat `src/data/site.json` as the source of truth for landing-page content.

Keep changes focused. Do not edit generated files in `dist/`, `.vercel/` or
`.astro/`. Run `pnpm check` and `pnpm build` after code changes. Report changed
files, validation results and unresolved placeholders.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
