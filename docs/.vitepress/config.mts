import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Vessel",
  description: "Physical Device Orchestration Platform",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Installation", link: "/installation" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/introduction" },
          { text: "Installation", link: "/installation" },
          { text: "Concept", link: "/concepts" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/cartesiancs/vessel" },
    ],
  },
});
