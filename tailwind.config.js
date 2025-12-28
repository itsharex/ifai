/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VS Code Dark+ Theme Colors
        vscode: {
          bg: '#1e1e1e',
          sidebar: '#252526',
          hover: '#2a2d2e',
          selection: '#094771',
          border: '#3c3c3c',
          separator: '#2d2d2d',
          text: '#cccccc',
          'text-active': '#ffffff',
          'text-muted': '#858585',
          link: '#3794ff',
          'link-hover': '#1e8eff',
          success: '#4ec9b0',
          info: '#569cd6',
          warning: '#dcdcaa',
          error: '#f14c4c',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
        ui: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'vscode-xs': ['11px', { lineHeight: '1.4' }],
        'vscode-sm': ['12px', { lineHeight: '1.4' }],
        'vscode-base': ['13px', { lineHeight: '1.4' }],
        'vscode-lg': ['14px', { lineHeight: '1.4' }],
      },
      spacing: {
        'vscode-compact': '4px',
        'vscode-normal': '8px',
        'vscode-relaxed': '12px',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
    },
  },
  plugins: [],
}
