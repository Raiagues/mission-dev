# Architecture

Mission Dev is currently implemented as a client-side React application with a domain layer that is independent from the interface.

## Layers

### Presentation

React pages and reusable components render the home screen, navigation, technical drawings, language controls and the conception board.

### Mission domain model

`src/lib/missionModel.ts` contains deterministic rules for the current Problem phase. It calculates definition progress, checks mandatory evidence, detects inconsistencies, controls phase validation and determines which nodes belong to a focused project page.

### Localization

`src/lib/i18n.ts` owns all platform-controlled Portuguese and English strings. User-created content is stored separately and is never rewritten when the interface language changes.

### Deployment

Vite produces the static production bundle in `dist`. GitHub Actions validates the repository before uploading that directory to GitHub Pages.

## Evolution

The domain boundary is intentional. Future persistence, collaboration and model-assisted engineering services can be introduced behind an API while preserving the conception model and UI contracts.
