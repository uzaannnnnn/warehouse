/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        heading: ["Poppins", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      colors: {
        "brand-red": "#dc2626",
        "brand-dark": "#b91c1c",
        destructive: "#ef4444",
        "muted-foreground": "#6b7280",
      },
    },
  },
  plugins: [],
}

