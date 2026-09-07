import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#000000",
          raised: "#111111",
          card: "#0a0a0a",
          muted: "#1e1e1e",
        },
        accent: {
          DEFAULT: "#00ffd5",
          titanium: "#a9b4c2",
          /** Public marketing accent */
          ice: "#6EC9F0",
          /** Workbench mid-tone — Lambo electric blue */
          admin: "#2BB4FF",
          /** Icy highlight on body creases — scheduled / upcoming */
          highlight: "#7DEAFF",
          /** Cerulean in vents/shadows — pending / waiting */
          deep: "#0076E6",
          /** Midnight contours — completed / grounded chrome */
          navy: "#0B3D73",
          /** Engagement up / healthy activity */
          signal: "#34D399",
          /** Stale engagement / medium watch — pale yellow */
          caution: "#FFFF84",
          /** High priority — terracotta, not racing red */
          alert: "#E07A5F",
        },
        text: {
          primary: "#ffffff",
          secondary: "#bbbbbb",
          muted: "#777777",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-orbitron)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
