# Changelog

All notable changes to `@x-mesh/ai-spinner` are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-10-30

### Added

- npm version and license badges in the README.
- A demo GIF of the gallery in the README. `npm run demo` records it again with reel-mesh.

## [0.1.0] - 2026-10-30

First release.

### Added

- 68 canvas spinner styles, each with nine states: `working`, `searching`, `solving`, `listening`, `connecting`, `weaving`, `composing`, `breathing` and `shaping`.
- `Spinner` React component. React 18 or later is an optional peer dependency.
- `mountSpinner` in `@x-mesh/ai-spinner/vanilla`, for use without React.
- One entry point per style set, `@x-mesh/ai-spinner/sets/<name>`, and `SPINNER_SETS` in `@x-mesh/ai-spinner/sets`.
- A compact design for each set below 32 px, `theme` that follows the page color, and a still frame under `prefers-reduced-motion`.
- The gallery page at https://x-mesh.github.io/ai-spinner/, with code for the selected set and state.

[Unreleased]: https://github.com/x-mesh/ai-spinner/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/x-mesh/ai-spinner/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/@x-mesh/ai-spinner/v/0.1.0
