# Deployment Guide (VitePress)

## GitHub Pages (Recommended)

1.  **Commit your changes**:
    ```bash
    git add .
    git commit -m "Setup VitePress"
    git push origin main
    ```

2.  **Enable GitHub Pages**:
    - Go to Repository Settings -> **Pages**.
    - **Source**: `GitHub Actions`.
    - **Static HTML**: Not needed since we use a workflow.
    - *Wait!* Actually, the easiest way for VitePress is using a workflow.

3.  **Create Workflow File**:
    - Create `.github/workflows/deploy.yml`:

    ```yaml
    name: Deploy VitePress site to Pages

    on:
      push:
        branches: [main]
      workflow_dispatch:

    permissions:
      contents: read
      pages: write
      id-token: write

    concurrency:
      group: pages
      cancel-in-progress: false

    jobs:
      build:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout
            uses: actions/checkout@v3
          - name: Setup Node
            uses: actions/setup-node@v3
            with:
              node-version: 18
              cache: npm
          - name: Install dependencies
            run: npm ci
          - name: Build with VitePress
            run: npm run docs:build
          - name: Upload artifact
            uses: actions/upload-pages-artifact@v2
            with:
              path: .vitepress/dist

      deploy:
        environment:
          name: github-pages
          url: ${{ steps.deployment.outputs.page_url }}
        needs: build
        runs-on: ubuntu-latest
        name: Deploy
        steps:
          - name: Deploy to GitHub Pages
            id: deployment
            uses: actions/deploy-pages@v2
    ```

## Netlify

1.  **Connect Repo**: Link your GitHub repo to Netlify.
2.  **Build Settings**:
    - **Build command**: `npm run docs:build`
    - **Publish directory**: `.vitepress/dist`
3.  **Deploy**: Click "Deploy Site".
