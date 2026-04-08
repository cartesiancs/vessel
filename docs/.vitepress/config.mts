import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Vessel",
  description: "Physical Device Orchestration Platform",
  base: "/docs/",
  outDir: "../apps/landing/dist/docs",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Features", link: "/features" },
      { text: "Installation", link: "/installation" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/introduction" },
          { text: "Installation", link: "/installation" },
          { text: "Concept", link: "/concepts" },
          { text: "Troubleshooting", link: "/troubleshooting" },
        ],
      },
      {
        text: "Core Features",
        items: [
          { text: "Overview", link: "/features" },
          { text: "Flow", link: "/flow" },
          { text: "Map", link: "/map" },
          { text: "Dashboard", link: "/dashboard" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/cartesiancs/vessel" },
    ],
  },
});
