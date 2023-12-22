const tailwindDefaultSansFontFamily =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}", "./src/html/**/*.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: `"Josefin Sans", ${tailwindDefaultSansFontFamily}`,
      },
      zIndex: {
        100: "100",
      },
      backdropGrayscale: {
        85: ".85",
      },
      colors: {
        neutral: {
          // 50 is 98%
          25: "hsl(0 0% 99%)",
          // 700 is 25%, 800 is 15%, 900 is 9%
          750: "hsl(0 0% 19%)",
          850: "hsl(0 0% 12%)",
          875: "hsl(0 0% 11%)",
        },
        "logo-background": "#536979",
      },
      boxShadow: {
        "solid-bottomleft": "-1px 1px 0 black",
      },
      fontWeight: {
        // thin: '100',
        // extralight: '200',
        // light: '300',
        // normal: '400',
        normal: "375",
        // medium: '500',
        medium: "463",
        // semibold: '600',
        semibold: "550",
        // bold: '700',
        // extrabold: '800',
        // black: '900',
      },
    },
  },
  plugins: [],
};
