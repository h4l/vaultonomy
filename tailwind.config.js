import typography from "@tailwindcss/typography";

const tailwindDefaultSansFontFamily =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}", "./src/html/**/*.html"],
  plugins: [typography],
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
          925: "hsl(0 0% 6%)",
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
        light: "335",
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
      animation: {
        "indeterminate-progress-1":
          "indeterminate-progress-1 1.5s linear infinite",
        "indeterminate-progress-2":
          "indeterminate-progress-2 1.5s linear infinite",
        beat: [
          "beat-expand 0.5s ease-in infinite",
          "beat-expand 0.5s reverse ease-out infinite",
        ].join(", "),
      },
      keyframes: {
        "indeterminate-progress-1": {
          "0%": {
            transform: "translateX(0) scaleX(0)",
          },
          "30%": {
            transform: "translateX(0) scaleX(0.6)",
          },
          "60%": {
            transform: "translateX(80%) scaleX(0.3)",
          },
          "75%": {
            transform: "translateX(100%) scaleX(0.3)",
          },
          "100%": {
            transform: "translateX(100%) scaleX(0.3)",
          },
        },
        "indeterminate-progress-2": {
          "0%": {
            transform: "translateX(0) scaleX(0)",
          },
          "15%": {
            transform: "translateX(0) scaleX(0.1)",
          },
          "75%": {
            transform: "translateX(100%) scaleX(0.8)",
          },
          "100%": {
            transform: "translateX(100%) scaleX(0.8)",
          },
        },
        "beat-expand": {
          "75%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.075)" },
        },
        // "beat-expand": {
        //   "75%": { transform: "scale(1)" },
        //   "100%": { transform: "scale(1.2)" },
        // },
      },
      transitionProperty: {
        backgroundColor: "background-color, border-color",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

/*
@keyframes ping {
    75%, 100% {
        transform: scale(2);
        opacity: 0;
    }
}
.animate-ping {
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
*/
