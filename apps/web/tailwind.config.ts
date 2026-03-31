import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#b9dffe",
          300: "#7cc5fd",
          400: "#36a9fa",
          500: "#0c8eeb",
          600: "#0070c9",
          700: "#0159a3",
          800: "#064b86",
          900: "#0b3f6f",
          950: "#07284a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      animation: {
        'breathe': 'breathe 5s ease-in-out infinite',
        'fade-in': 'fadeIn 1.5s ease-in forwards',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'bounce-slow': 'bounceSlow 2.5s ease-in-out infinite',
        'ripple-1': 'rippleOut 2.8s ease-out infinite',
        'ripple-2': 'rippleOut 2.8s ease-out infinite 0.93s',
        'ripple-3': 'rippleOut 2.8s ease-out infinite 1.86s',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(6px)' },
        },
        rippleOut: {
          '0%': { transform: 'scale(0.5)', opacity: '0.6' },
          '100%': { transform: 'scale(1)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
