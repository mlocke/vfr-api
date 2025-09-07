import React from "react";
import EconomicDataVisualization from "../components/economic-data/EconomicDataVisualization";
import { FredDataResponse } from "../types/economic-data";

/**
 * Example implementation showing how to integrate the economic data visualizations
 * with real FRED data from your test outputs
 */

// Sample data structure matching your test_output files
const sampleFredData: FredDataResponse = {
	description: "Comprehensive economic dashboard with key indicators by sector",
	timestamp: "2025-09-06T16:28:26.734509",
	sample_data: {
		Employment: {
			UNRATE: {
				description: "Unemployment Rate",
				latest_value: "4.3",
				latest_date: "2025-08-01",
				recent_observations: [
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-08-01",
						value: "4.3",
					},
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-07-01",
						value: "4.2",
					},
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-06-01",
						value: "4.1",
					},
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-05-01",
						value: "4.2",
					},
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-04-01",
						value: "4.2",
					},
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-03-01",
						value: "4.2",
					},
				],
				units: "lin",
				frequency: "Monthly",
			},
			PAYEMS: {
				description: "Total Nonfarm Payrolls",
				latest_value: "159540",
				latest_date: "2025-08-01",
				units: "Thousands of Persons",
				frequency: "Monthly",
			},
			CIVPART: {
				description: "Labor Force Participation Rate",
				latest_value: "62.3",
				latest_date: "2025-08-01",
				units: "Percent",
				frequency: "Monthly",
			},
		},
		Inflation: {
			CPIAUCSL: {
				description: "Consumer Price Index",
				latest_value: "322.132",
				latest_date: "2025-07-01",
				recent_observations: [
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-07-01",
						value: "322.132",
					},
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-06-01",
						value: "321.500",
					},
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-05-01",
						value: "320.580",
					},
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-04-01",
						value: "320.321",
					},
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-03-01",
						value: "319.615",
					},
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-02-01",
						value: "319.775",
					},
				],
				units: "Index 1982-1984=100",
				frequency: "Monthly",
			},
			CPILFESL: {
				description: "Core CPI (Less Food & Energy)",
				latest_value: "328.656",
				latest_date: "2025-07-01",
				units: "Index 1982-1984=100",
				frequency: "Monthly",
			},
			PPIFIS: {
				description: "Producer Price Index",
				latest_value: "149.671",
				latest_date: "2025-07-01",
				units: "Index Nov 2009=100",
				frequency: "Monthly",
			},
		},
		Interest_Rates: {
			FEDFUNDS: {
				description: "Federal Funds Rate",
				latest_value: "4.33",
				latest_date: "2025-08-01",
				recent_observations: [
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-08-01",
						value: "4.33",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-07-01",
						value: "4.33",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-06-01",
						value: "4.33",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-05-01",
						value: "4.33",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-04-01",
						value: "4.33",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-03-01",
						value: "4.33",
					},
				],
				units: "Percent",
				frequency: "Monthly",
			},
			DGS10: {
				description: "10-Year Treasury Constant Maturity Rate",
				latest_value: "4.17",
				latest_date: "2025-09-04",
				recent_observations: [
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-09-04",
						value: "4.17",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-09-03",
						value: "4.22",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-09-02",
						value: "4.28",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-08-29",
						value: "4.23",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-08-28",
						value: "4.22",
					},
				],
				units: "Percent",
				frequency: "Daily",
			},
			DGS30: {
				description: "30-Year Treasury Constant Maturity Rate",
				latest_value: "4.86",
				latest_date: "2025-09-04",
				units: "Percent",
				frequency: "Daily",
			},
		},
		Economic_Growth: {
			GDP: {
				description: "Gross Domestic Product",
				latest_value: "30353.902",
				latest_date: "2025-04-01",
				recent_observations: [
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-04-01",
						value: "30353.902",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-01-01",
						value: "29962.047",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2024-10-01",
						value: "29723.864",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2024-07-01",
						value: "29374.914",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2024-04-01",
						value: "29016.714",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2024-01-01",
						value: "28624.069",
					},
				],
				units: "Billions of Chained 2017 Dollars",
				frequency: "Quarterly",
			},
			INDPRO: {
				description: "Industrial Production Index",
				latest_value: "103.9867",
				latest_date: "2025-07-01",
				units: "Index 2017=100",
				frequency: "Monthly",
			},
			RSAFS: {
				description: "Advance Retail Sales",
				latest_value: "726283.0",
				latest_date: "2025-07-01",
				units: "Millions of Dollars",
				frequency: "Monthly",
			},
		},
		Housing: {
			HOUST: {
				description: "Housing Starts",
				latest_value: "1428.0",
				latest_date: "2025-07-01",
				units: "Thousands of Units",
				frequency: "Monthly",
			},
			MORTGAGE30US: {
				description: "30-Year Fixed Rate Mortgage Average",
				latest_value: "6.5",
				latest_date: "2025-09-04",
				units: "Percent",
				frequency: "Weekly",
			},
		},
		International: {
			DEXUSEU: {
				description: "US / Euro Foreign Exchange Rate",
				latest_value: "1.1695",
				latest_date: "2025-08-29",
				units: "US Dollars to One Euro",
				frequency: "Daily",
			},
			DEXJPUS: {
				description: "Japan / US Foreign Exchange Rate",
				latest_value: "146.9",
				latest_date: "2025-08-29",
				units: "Japanese Yen to One US Dollar",
				frequency: "Daily",
			},
			DEXCHUS: {
				description: "China / US Foreign Exchange Rate",
				latest_value: "7.1304",
				latest_date: "2025-08-29",
				units: "Chinese Yuan to One US Dollar",
				frequency: "Daily",
			},
		},
	},
	data_type: "FRED Economic Data",
	source: "Federal Reserve Bank of St. Louis",
};

/**
 * Main example component demonstrating different configurations
 */
const EconomicDataExample: React.FC = () => {
	return (
		<div className="min-h-screen bg-black">
			{/* Full Featured Dashboard */}
			<EconomicDataVisualization
				fredData={sampleFredData}
				title="FRED Economic Data Command Center"
				animated={true}
				viewMode="dashboard"
				theme={{
					primaryColor: "#00FFFF",
					accentColors: ["#00FF7F", "#FF00FF", "#0080FF", "#FFFF00", "#FF0080"],
					reducedMotion: false,
					highContrast: false,
				}}
			/>
		</div>
	);
};

/**
 * Minimal configuration example
 */
const MinimalExample: React.FC = () => {
	return (
		<EconomicDataVisualization title="Economic Overview" animated={false} viewMode="overview" />
	);
};

/**
 * Accessibility-focused example
 */
const AccessibleExample: React.FC = () => {
	return (
		<EconomicDataVisualization
			fredData={sampleFredData}
			title="Accessible Economic Dashboard"
			animated={false}
			viewMode="dashboard"
			theme={{
				reducedMotion: true,
				highContrast: true,
			}}
		/>
	);
};

/**
 * Integration instructions and usage examples
 */
const IntegrationGuide: React.FC = () => {
	return (
		<div className="p-8 bg-gray-900 text-white">
			<h1 className="text-3xl font-bold mb-6">
				FRED Economic Data Visualization Integration Guide
			</h1>

			<section className="mb-8">
				<h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
				<div className="bg-gray-800 p-4 rounded-lg">
					<pre className="text-green-400">
						{`import EconomicDataVisualization from './components/economic-data/EconomicDataVisualization';

// Basic usage
<EconomicDataVisualization 
  title="My Economic Dashboard"
  viewMode="dashboard"
/>

// With FRED data
<EconomicDataVisualization 
  fredData={yourFredApiResponse}
  title="Real-time Economic Analysis"
  animated={true}
/>`}
					</pre>
				</div>
			</section>

			<section className="mb-8">
				<h2 className="text-2xl font-semibold mb-4">Loading Real FRED Data</h2>
				<div className="bg-gray-800 p-4 rounded-lg">
					<pre className="text-blue-400">
						{`// Example API integration
const loadEconomicData = async () => {
  try {
    // Replace with your actual FRED API endpoint
    const response = await fetch('/api/fred/economic-dashboard');
    const fredData = await response.json();
    
    return fredData;
  } catch (error) {
    console.error('Failed to load economic data:', error);
    return null;
  }
};

const MyDashboard = () => {
  const [fredData, setFredData] = useState(null);
  
  useEffect(() => {
    loadEconomicData().then(setFredData);
  }, []);
  
  return (
    <EconomicDataVisualization 
      fredData={fredData}
      title="Live Economic Dashboard"
    />
  );
};`}
					</pre>
				</div>
			</section>

			<section className="mb-8">
				<h2 className="text-2xl font-semibold mb-4">Customization Options</h2>
				<ul className="list-disc list-inside space-y-2">
					<li>
						<strong>viewMode:</strong> 'dashboard' | 'comparison' | 'overview'
					</li>
					<li>
						<strong>animated:</strong> Enable/disable cyberpunk animations
					</li>
					<li>
						<strong>theme:</strong> Customize colors and accessibility settings
					</li>
					<li>
						<strong>fredData:</strong> Your FRED API response data
					</li>
				</ul>
			</section>

			<section className="mb-8">
				<h2 className="text-2xl font-semibold mb-4">Accessibility Features</h2>
				<ul className="list-disc list-inside space-y-2">
					<li>Full keyboard navigation support</li>
					<li>Screen reader compatibility with ARIA labels</li>
					<li>High contrast mode support</li>
					<li>Reduced motion preferences</li>
					<li>Color blind friendly palettes</li>
				</ul>
			</section>

			<section className="mb-8">
				<h2 className="text-2xl font-semibold mb-4">Required Dependencies</h2>
				<div className="bg-gray-800 p-4 rounded-lg">
					<pre className="text-yellow-400">
						{`npm install react react-dom typescript
npm install d3 @types/d3
npm install tailwindcss autoprefixer postcss`}
					</pre>
				</div>
			</section>
		</div>
	);
};

export default EconomicDataExample;
export { MinimalExample, AccessibleExample, IntegrationGuide };
