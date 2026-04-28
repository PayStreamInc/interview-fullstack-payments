import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214.3 31.8% 91.4%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222.2 84% 4.9%)",
        muted: "hsl(210 40% 96.1%)",
        primary: "hsl(222.2 47.4% 11.2%)",
        destructive: "hsl(0 84.2% 60.2%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
