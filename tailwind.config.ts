import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 40px rgba(136, 255, 168, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
