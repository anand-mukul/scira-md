# AI Viva System Documentation

This repository contains the source code for the **AI Viva System** official documentation site, built with [VitePress](https://vitepress.dev/).

## Project Structure

- `docs/` (or root): Markdown content files.
- `.vitepress/`: Theme configuration and build settings.
- `public/`: Static assets (images, etc.).

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Local Development

Start the development server with hot-reload:

```bash
npm run docs:dev
```

Visit `http://localhost:5173` to view the site.

### Building for Production

To build the static HTML files:

```bash
npm run docs:build
```

The output will be in `.vitepress/dist`.

## Deployment

This project is configured for deployment on **GitHub Pages**.
See `deploy.md` for detailed instructions.

## License

[MIT](LICENSE)
