/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./src/**/*.{js,ts,jsx,tsx}",
		"./pages/**/*.{js,ts,jsx,tsx}",
		"./components/**/*.{js,ts,jsx,tsx}",
		"./app/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				// Cyberpunk color palette
				"neon-cyan": "#00FFFF",
				"neon-green": "#00FF7F",
				"electric-pink": "#FF00FF",
				"electric-blue": "#0080FF",
				"neon-yellow": "#FFFF00",
				"hot-pink": "#FF0080",

				// Base colors
				"deep-black": "#000000",
				"dark-navy": "#0a0a0a",
				"space-blue": "#1a1a2e",
				"cyber-gray": "#16213e",
				"matrix-green": "#0f3460",
			},
			boxShadow: {
				"glow-cyan": "0 0 20px rgba(0, 255, 255, 0.5)",
				"glow-green": "0 0 20px rgba(0, 255, 127, 0.5)",
				"glow-pink": "0 0 20px rgba(255, 0, 255, 0.5)",
				"glow-blue": "0 0 20px rgba(0, 128, 255, 0.5)",
				"glow-yellow": "0 0 20px rgba(255, 255, 0, 0.5)",
				"glow-red": "0 0 20px rgba(255, 0, 128, 0.5)",
				"inner-glow": "inset 0 1px 0 rgba(255, 255, 255, 0.1)",
				"cyber-shadow": "0 0 30px rgba(0, 255, 255, 0.3)",
				"multi-glow":
					"0 0 20px rgba(0, 255, 255, 0.3), 0 0 40px rgba(0, 255, 255, 0.2), 0 0 60px rgba(0, 255, 255, 0.1)",
			},
			fontFamily: {
				inter: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
				jetbrains: ["JetBrains Mono", "monospace"],
			},
			animation: {
				"cyber-fadein": "cyberFadeInDown 0.8s ease-out",
				"glow-in": "glowIn 1s ease-out",
				"data-slide": "dataSlideIn 0.6s ease-out",
				"cyber-pulse": "cyberPulse 2s ease-in-out infinite",
				"text-glow": "textGlow 3s ease-in-out infinite",
				"scan-line": "scanLine 3s ease-in-out infinite",
			},
			keyframes: {
				cyberFadeInDown: {
					from: {
						opacity: "0",
						transform: "translateY(-30px)",
						filter: "blur(5px)",
					},
					to: {
						opacity: "1",
						transform: "translateY(0)",
						filter: "blur(0px)",
					},
				},
				glowIn: {
					from: {
						opacity: "0",
						boxShadow: "0 0 0 rgba(0, 255, 255, 0)",
					},
					to: {
						opacity: "1",
						boxShadow: "0 0 20px rgba(0, 255, 255, 0.5)",
					},
				},
				dataSlideIn: {
					from: {
						opacity: "0",
						transform: "translateX(-50px)",
						textShadow: "none",
					},
					to: {
						opacity: "1",
						transform: "translateX(0)",
						textShadow: "0 0 5px rgba(0, 255, 255, 0.8)",
					},
				},
				cyberPulse: {
					"0%, 100%": {
						transform: "scale(1)",
						boxShadow:
							"0 0 0 0 rgba(0, 255, 255, 0.7), 0 0 20px rgba(0, 255, 255, 0.3)",
					},
					"50%": {
						transform: "scale(1.02)",
						boxShadow:
							"0 0 0 10px rgba(0, 255, 255, 0), 0 0 40px rgba(0, 255, 255, 0.8)",
					},
				},
				textGlow: {
					"0%": {
						filter: "brightness(1) contrast(1)",
						textShadow: "0 0 10px rgba(0, 255, 255, 0.8)",
					},
					"50%": {
						filter: "brightness(1.2) contrast(1.1)",
						textShadow: "0 0 20px rgba(0, 255, 255, 1)",
					},
					"100%": {
						filter: "brightness(1) contrast(1)",
						textShadow: "0 0 10px rgba(0, 255, 255, 0.8)",
					},
				},
				scanLine: {
					"0%": {
						left: "-100%",
						opacity: "0",
					},
					"50%": {
						opacity: "1",
					},
					"100%": {
						left: "100%",
						opacity: "0",
					},
				},
			},
			backdropBlur: {
				cyber: "15px",
			},
			screens: {
				xs: "480px",
				"3xl": "1600px",
				"4xl": "1920px",
			},
		},
	},
	plugins: [
		require('@tailwindcss/typography'),
	],
};
