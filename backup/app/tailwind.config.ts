import type { Config } from 'tailwindcss'

// This is a minimal config for Tailwind v4. 
// The main theme is now defined in `app/globals.css`.
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
}

export default config