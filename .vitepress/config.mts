import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "AI Viva System",
  description: "Official documentation for the AI Viva System project.",
  srcExclude: ['README.md'], // Exclude repo readme from site build
  themeConfig: {
    // Search Configuration
    search: {
      provider: 'local'
    },

    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Report', link: '/Project_Report' },
      { text: 'Presentation', link: '/Presentation' }
    ],

    // Sidebar
    sidebar: [
      {
        text: 'Project Overview',
        collapsed: false,
        items: [
          { text: 'Project Report', link: '/Project_Report' },
          { text: 'Presentation Slides', link: '/Presentation' },
          { text: 'Presentation Content', link: '/PPT_Content' },
          { text: 'Q&A', link: '/Question_answers' }
        ]
      },
      {
        text: 'System Architecture',
        collapsed: false,
        items: [
          { text: 'System Design', link: '/SYSTEM_DESIGN' },
          { text: 'Database Models', link: '/DATABASE_MODELS' },
          { text: 'Payment System', link: '/PAYMENT_SYSTEM' },
          { text: 'Quota Enforcement', link: '/QUOTA_ENFORCEMENT' },
          { text: 'SSO Setup', link: '/SSO_SETUP_GUIDE' }
        ]
      },
      {
        text: 'Frontend Docs',
        collapsed: false,
        items: [
          { text: 'Architecture', link: '/FRONTEND_ARCHITECTURE' },
          { text: 'Workflow', link: '/FRONTEND_WORKFLOW' }
        ]
      },
      {
        text: 'Deployment & Ops',
        collapsed: false,
        items: [
          { text: 'Deployment Guide', link: '/deploy' },
          { text: 'Railway & Celery', link: '/RAILWAY_CELERY_DEPLOYMENT' },
          { text: 'Monitoring (Site24x7)', link: '/site24x7_guide' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/anand-mukul/scira-md' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 AI Viva Team'
    }
  }
})
