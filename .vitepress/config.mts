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
        text: 'Documentation',
        items: [
          { text: 'Project Report', link: '/Project_Report' },
          { text: 'Presentation Content', link: '/PPT_Content' },
          { text: 'Presentation Slides', link: '/Presentation' },
          { text: 'Q&A', link: '/Question_answers' }
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
