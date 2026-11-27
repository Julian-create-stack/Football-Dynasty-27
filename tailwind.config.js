export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#05070d',
        navy: '#0a1020',
        panel: '#0e1526',
        electric: '#3d7bff',
        violet: '#8b5cf6',
        lime: '#b6ff3d',
        cyan: '#22d3ee',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Barlow Condensed', 'Inter Variable', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(61,123,255,.28)',
        card: '0 18px 50px rgba(0,0,0,.45)',
      },
    },
  },
  plugins: [],
}
