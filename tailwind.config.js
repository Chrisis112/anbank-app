/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // можно переключать темы

  theme: {
    extend: {
      colors: {

        crypto: {
          dark: '#0d0d0d',
          panel: 'rgba(20, 20, 30, 0.8)',
          primary: '#4f46e5',
          primaryLight: '#818cf8',
          accent: '#00f0ff',
          error: '#ff4d4d',
          dark: '#121212',
    darkAlt: '#0d0d0d',
    panel: 'rgba(20, 20, 30, 0.8)',
    input: '#1e1e1e',
    primary: '#4f46e5',
    primaryLight: '#818cf8',
    accent: '#7f5af0',
    accentDark: '#633bbc',
    neonAccent: '#00f0ff',
    error: '#ff4d4d',
          
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'fade-out': 'fade-out 0.5s ease-in forwards',
        'slide-up': 'slide-up 0.4s ease-out forwards',
        'slide-down': 'slide-down 0.4s ease-out forwards',
        'pulse-slow': 'pulse 2s infinite',
        'neon-pulse': 'neon-glow 1.5s infinite alternate',
        'float': 'float 8s infinite linear',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'fade-out': {
          '0%': { opacity: 1 },
          '100%': { opacity: 0 },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: 1 },
          '50%': { transform: 'scale(1.05)', opacity: 0.85 },
        },
        'neon-glow': {
          '0%, 100%': {
            textShadow: '0 0 5px #00f0ff, 0 0 10px #00f0ff, 0 0 20px #00f0ff',
          },
          '50%': {
            textShadow: '0 0 10px #4f46e5, 0 0 20px #4f46e5, 0 0 40px #4f46e5',
          },
        },
        'float': {
          '0%': { transform: 'translateY(0) rotate(0)' },
          '50%': { transform: 'translateY(-10px) rotate(180deg)' },
          '100%': { transform: 'translateY(0) rotate(360deg)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};

