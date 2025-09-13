# FRED Economic Data Visualization System 🚀

A stunning cyberpunk-themed visualization system for Federal Reserve Economic Data (FRED) built with React, TypeScript, D3.js, and Tailwind CSS. Features real-time animations, interactive charts, and comprehensive accessibility support.

## 🎯 Features

### 📊 Visualization Components

- **MetricCard**: Cyberpunk-styled cards displaying key economic indicators with glowing effects
- **TrendChart**: Interactive D3.js line/area charts with smooth animations
- **ComparisonChart**: Multi-series charts with dual-axis support for comparing different metrics
- **EconomicDashboard**: Comprehensive dashboard organizing data by economic sectors
- **EconomicDataVisualization**: Main component integrating all visualization features

### 🎨 Cyberpunk Design System

- **Neon Color Palette**: Electric blues, cyans, magentas, and greens
- **Glass Morphism**: Semi-transparent cards with backdrop blur effects
- **Glowing Animations**: Pulsing, scanning, and text glow effects
- **Responsive Design**: Mobile-first approach with breakpoint-specific optimizations

### ♿ Accessibility Features

- **Full Keyboard Navigation**: Tab, arrow keys, and shortcut support
- **Screen Reader Support**: Comprehensive ARIA labels and descriptions
- **High Contrast Mode**: Automatic detection and styling adjustments
- **Reduced Motion**: Respects user motion preferences
- **Color Blind Friendly**: Alternative color palettes available

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install react react-dom typescript
npm install d3 @types/d3
npm install next tailwindcss autoprefixer postcss
npm install @tailwindcss/forms @tailwindcss/typography @tailwindcss/aspect-ratio
```

### Basic Usage

```tsx
import React from "react";
import { EconomicDataVisualization } from "./src/components/economic-data";

const App = () => {
	return (
		<EconomicDataVisualization
			title="FRED Economic Dashboard"
			viewMode="dashboard"
			animated={true}
		/>
	);
};
```

### With Real FRED Data

```tsx
import { EconomicDataVisualization, FredDataResponse } from "./src/components/economic-data";

const Dashboard = ({ fredData }: { fredData: FredDataResponse }) => {
	return (
		<EconomicDataVisualization
			fredData={fredData}
			title="Live Economic Analysis"
			animated={true}
			viewMode="dashboard"
			theme={{
				primaryColor: "#00FFFF",
				reducedMotion: false,
				highContrast: false,
			}}
		/>
	);
};
```

## 📁 Project Structure

```
src/
├── components/economic-data/
│   ├── EconomicDataVisualization.tsx  # Main component
│   ├── EconomicDashboard.tsx          # Sector-based dashboard
│   ├── MetricCard.tsx                 # Individual metric display
│   ├── TrendChart.tsx                 # D3.js line/area charts
│   ├── ComparisonChart.tsx            # Multi-series charts
│   └── index.ts                       # Component exports
├── types/
│   └── economic-data.ts               # TypeScript interfaces
├── utils/
│   ├── data-formatters.ts             # Data processing utilities
│   └── accessibility.ts               # Accessibility helpers
├── hooks/
│   └── useResponsive.ts               # Responsive design hooks
├── styles/
│   ├── cyberpunk.css                  # Cyberpunk theme styles
│   └── responsive.css                 # Mobile-first responsive design
└── examples/
    └── EconomicDataExample.tsx        # Usage examples
```

## 🎛️ Component API

### EconomicDataVisualization

Main component providing the complete visualization experience.

```tsx
interface Props {
	fredData?: FredDataResponse; // FRED API data
	title?: string; // Dashboard title
	animated?: boolean; // Enable animations
	viewMode?: "dashboard" | "comparison" | "overview";
	theme?: {
		primaryColor?: string;
		accentColors?: string[];
		reducedMotion?: boolean;
		highContrast?: boolean;
	};
}
```

### MetricCard

Individual metric display with cyberpunk styling.

```tsx
interface Props {
	title: string; // Metric name
	value: string | number; // Current value
	change?: number; // Percentage change
	trend?: "Rising" | "Falling" | "Stable";
	unit?: string; // Value unit
	description?: string; // Additional context
	animated?: boolean; // Enable animations
	glowColor?: "cyan" | "green" | "pink" | "blue" | "yellow" | "red";
	size?: "small" | "medium" | "large";
}
```

### TrendChart

Interactive D3.js charts for time series data.

```tsx
interface Props {
	data: ChartDataPoint[]; // Time series data
	title: string; // Chart title
	color?: string; // Line color
	height?: number; // Chart height
	animated?: boolean; // Enable animations
	showGrid?: boolean; // Show grid lines
	showTooltip?: boolean; // Interactive tooltips
}
```

### ComparisonChart

Multi-series comparison charts with dual-axis support.

```tsx
interface Props {
	series: ComparisonDataSeries[]; // Multiple data series
	title: string; // Chart title
	height?: number; // Chart height
	animated?: boolean; // Enable animations
	chartType?: "line" | "area" | "bar";
	showLegend?: boolean; // Show series legend
	showGrid?: boolean; // Show grid lines
	dualAxis?: boolean; // Dual Y-axis support
}
```

## 🎨 Theming & Customization

### Color Palette

```css
:root {
	--neon-cyan: #00ffff; /* Primary data elements */
	--neon-green: #00ff7f; /* Positive metrics */
	--electric-pink: #ff00ff; /* AI/ML features */
	--electric-blue: #0080ff; /* Technical indicators */
	--neon-yellow: #ffff00; /* Warnings */
	--hot-pink: #ff0080; /* Negative metrics */
}
```

### Glow Effects

```css
.cyber-card--cyan {
	border-color: rgba(0, 255, 255, 0.4);
	box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
}

.cyber-text--glow {
	text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
}
```

### Responsive Breakpoints

```css
/* Mobile: < 768px */
/* Tablet: 768px - 1024px */
/* Desktop: 1024px - 1440px */
/* Wide: > 1440px */
```

## 📊 Data Integration

### FRED API Data Structure

The system expects FRED data in this format:

```typescript
interface FredDataResponse {
	description: string;
	timestamp: string;
	sample_data: EconomicDashboardData;
	data_type: string;
	source: string;
}

interface EconomicDashboardData {
	Employment: EconomicSector;
	Inflation: EconomicSector;
	Interest_Rates: EconomicSector;
	Economic_Growth: EconomicSector;
	Housing: EconomicSector;
	International: EconomicSector;
}
```

### Loading Data from Your Backend

```typescript
const loadEconomicData = async (): Promise<FredDataResponse | null> => {
	try {
		const response = await fetch("/api/fred/dashboard");
		if (!response.ok) throw new Error("Failed to fetch");
		return await response.json();
	} catch (error) {
		console.error("Error loading FRED data:", error);
		return null;
	}
};
```

### Using Test Data

```typescript
import dashboardData from './docs/project/test_output/economic_dashboard.json';
import historicalData from './docs/project/test_output/historical_analysis.json';

// Use your existing test data
<EconomicDataVisualization fredData={dashboardData} />
```

## ♿ Accessibility

### Keyboard Navigation

- **Tab**: Navigate between elements
- **Enter/Space**: Activate buttons and controls
- **Arrow Keys**: Navigate within charts and data points
- **Escape**: Close expanded views
- **1, 2, 3**: Quick view switching

### Screen Reader Support

- Comprehensive ARIA labels for all interactive elements
- Live regions for dynamic content updates
- Descriptive text for charts and data visualizations
- Table alternatives for complex data structures

### Motion & Contrast

```typescript
// Automatic detection and handling
const reducedMotion = prefersReducedMotion();
const highContrast = prefersHighContrast();

<EconomicDataVisualization
  theme={{
    reducedMotion,
    highContrast
  }}
/>
```

## 🚀 Performance Optimization

### Chart Performance

- **Canvas Rendering**: For high-frequency data updates
- **Virtual Scrolling**: For large datasets
- **Data Throttling**: Prevents UI blocking
- **Efficient Updates**: Minimal re-renders

### Bundle Size

- **Tree Shaking**: Import only needed components
- **Code Splitting**: Lazy load heavy visualizations
- **CSS Optimization**: Purge unused styles

```typescript
// Tree-shakable imports
import { MetricCard, TrendChart } from "./components/economic-data";

// Lazy loading
const EconomicDashboard = lazy(() => import("./components/economic-data/EconomicDashboard"));
```

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

### Accessibility Testing

```bash
npm run test:a11y
```

### Visual Regression Tests

```bash
npm run test:visual
```

## 📦 Deployment

### Build for Production

```bash
npm run build
```

### Next.js Integration

```typescript
// pages/_app.tsx
import '../src/styles/cyberpunk.css';
import '../src/styles/responsive.css';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_FRED_API_KEY=your_fred_api_key
NEXT_PUBLIC_FRED_API_URL=https://api.stlouisfed.org/fred
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Federal Reserve Bank of St. Louis** for providing the FRED API
- **D3.js community** for the incredible visualization library
- **Tailwind CSS** for the utility-first CSS framework
- **React community** for the robust component ecosystem

## 📞 Support

For questions and support:

- Create an issue in the repository
- Check the examples in `/src/examples/`
- Review the integration guide in `EconomicDataExample.tsx`

---

**Built with ⚡ by Claude Code for the VFR Financial Platform**
