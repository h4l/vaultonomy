/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}", "./src/html/**/*.html"],
  theme: {
    extend: {
      zIndex: {
        100: "100",
      },
      backdropGrayscale: {
        85: ".85",
      },
    },
  },
  plugins: [],
};
