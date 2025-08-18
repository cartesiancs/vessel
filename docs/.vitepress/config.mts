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
      { text: "Installation", link: "/docs/installation" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/docs/introduction" },
          { text: "Installation", link: "/docs/installation" },
          { text: "Concept", link: "/docs/concepts" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/cartesiancs/vessel" },
    ],
  },
});
