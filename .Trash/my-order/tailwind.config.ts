import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      rotate: {
        '45': '45deg',
        '90': '90deg',
        '135': '135deg',
        '180': '180deg',
        '225': '225deg',
        '270': '270deg',
        '315': '315deg',
      }

    },
  },
  plugins: [],
};
export default config;


// module.exports = {
//   theme: {
//     extend: {
//       rotate: {
//         '45': '45deg',
//         '90': '90deg',
//         '135': '135deg',
//         '180': '180deg',
//         '225': '225deg',
//         '270': '270deg',
//         '315': '315deg',
//       }
//     },
//   },
//   plugins: [],
// };