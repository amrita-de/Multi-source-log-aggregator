/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      colors: {
        terminal: {
          bg:      '#0d1117',
          card:    '#161b22',
          border:  '#30363d',
          text:    '#c9d1d9',
          muted:   '#8b949e',
          info:    '#58a6ff',
          success: '#3fb950',
          warn:    '#d29922',
          error:   '#f85149',
          debug:   '#6e7681',
        },
      },
    },
  },
  plugins: [],
}
