/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        // Status palette — designed for accessible contrast on light bg
        status: {
          new: { bg: "#EFF6FF", text: "#1D4ED8", ring: "#BFDBFE" },
          contacted: { bg: "#FEF3C7", text: "#92400E", ring: "#FDE68A" },
          qualified: { bg: "#EDE9FE", text: "#5B21B6", ring: "#DDD6FE" },
          converted: { bg: "#DCFCE7", text: "#166534", ring: "#BBF7D0" },
          lost: { bg: "#FEE2E2", text: "#991B1B", ring: "#FECACA" },
        },
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "scale-in": "scale-in 150ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
      },
    },
  },
  plugins: [],
};
