# Shared AggieTrack UI

The existing UI components and theme now live here. Import components with `@aggietrack/ui/button`, `@aggietrack/ui/dialog`, etc. AggieTrack's existing `components/ui/*` paths re-export this package for compatibility.

Apps should depend on `@aggietrack/ui: workspace:*`, add it to `transpilePackages`, import Tailwind, `tw-animate-css`, and `shadcn/tailwind.css` before `@aggietrack/ui/styles.css`, and add a Tailwind `@source` directive targeting this package's `src` directory. The package ships source TypeScript and needs no separate build step.
