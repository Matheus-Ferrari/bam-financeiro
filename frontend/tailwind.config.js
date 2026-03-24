/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bam: {
          green:       '#12F0C6',
          'green-dim': '#0CC9A8',
          'green-glow':'rgba(18,240,198,0.15)',
          graphite:    '#272C30',
          surface:     '#1A1E21',
          'surface-2': '#12151A',
          black:       '#000000',
          border:      'rgba(255,255,255,0.07)',
          'border-hi': 'rgba(18,240,198,0.35)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'bam':     '0 0 24px rgba(18,240,198,0.12)',
        'bam-lg':  '0 0 48px rgba(18,240,198,0.18)',
        'card':    '0 4px 24px rgba(0,0,0,0.40)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 },                        to: { opacity: 1 } },
        slideDown: { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
