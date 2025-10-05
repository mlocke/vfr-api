"use client";

import { useState } from "react";
import SectorDropdown, { SectorOption } from "../SectorDropdown";
import StockAutocomplete from "../StockAutocomplete";
import { AnalysisRequest } from "./AnalysisEngineTest";

interface AnalysisControlsProps {
	onRunAnalysis: (request: AnalysisRequest) => void;
	isRunning: boolean;
}

export default function AnalysisControls({ onRunAnalysis, isRunning }: AnalysisControlsProps) {
	const [mode, setMode] = useState<"single" | "sector" | "multiple">("single");
	const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
	const [selectedSector, setSelectedSector] = useState<SectorOption | null>(null);
	const [limit, setLimit] = useState(10);
	const [includeML, setIncludeML] = useState(true); // Enable ML predictions by default
	const [mlHorizon, setMLHorizon] = useState<"1h" | "4h" | "1d" | "1w" | "1m">("1w");

	const handleSubmit = () => {
		if (isRunning) return;

		const request: AnalysisRequest = {
			mode,
			limit,
			include_ml: includeML,
			ml_horizon: mlHorizon,
		};

		if (mode === "single" && selectedSymbols.length > 0) {
			request.symbols = [selectedSymbols[0]];
		} else if (mode === "multiple" && selectedSymbols.length > 0) {
			request.symbols = selectedSymbols;
		} else if (mode === "sector" && selectedSector) {
			request.sector = selectedSector.id;
		} else {
			return; // Invalid state
		}

		onRunAnalysis(request);
	};

	const canSubmit = () => {
		if (isRunning) return false;
		if (mode === "single" || mode === "multiple") {
			return selectedSymbols.length > 0;
		}
		if (mode === "sector") {
			return selectedSector !== null;
		}
		return false;
	};

	return (
		<div
			style={{
				background: "rgba(255, 255, 255, 0.05)",
				backdropFilter: "blur(10px)",
				border: "1px solid rgba(255, 255, 255, 0.1)",
				borderRadius: "16px",
				padding: "1.5rem",
				height: "fit-content",
			}}
		>
			<h3
				style={{
					fontSize: "1.2rem",
					fontWeight: "600",
					color: "white",
					marginBottom: "1.5rem",
					display: "flex",
					alignItems: "center",
					gap: "0.5rem",
				}}
			>
				⚙️ Analysis Configuration
			</h3>

			{/* Mode Selection */}
			<div style={{ marginBottom: "1.5rem" }}>
				<label
					style={{
						fontSize: "1rem",
						fontWeight: "500",
						color: "rgba(255, 255, 255, 0.9)",
						marginBottom: "0.5rem",
						display: "block",
					}}
				>
					Analysis Mode
				</label>
				<select
					value={mode}
					onChange={e => setMode(e.target.value as "single" | "sector" | "multiple")}
					style={{
						width: "100%",
						padding: "0.75rem",
						background: "rgba(255, 255, 255, 0.1)",
						backdropFilter: "blur(10px)",
						border: "1px solid rgba(255, 255, 255, 0.2)",
						borderRadius: "8px",
						color: "white",
						fontSize: "0.9rem",
						fontWeight: "500",
						outline: "none",
						cursor: "pointer",
					}}
				>
					<option value="single" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
						📊 Single Stock Analysis
					</option>
					<option value="sector" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
						🏭 Sector Analysis
					</option>
					<option value="multiple" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
						📈 Multiple Stocks
					</option>
				</select>
			</div>

			{/* Stock Symbol Input - for single and multiple modes */}
			{(mode === "single" || mode === "multiple") && (
				<div style={{ marginBottom: "1.5rem" }}>
					<label
						style={{
							fontSize: "1rem",
							fontWeight: "500",
							color: "rgba(255, 255, 255, 0.9)",
							marginBottom: "0.5rem",
							display: "block",
						}}
					>
						{mode === "single" ? "Stock Symbol" : "Stock Symbols"}
					</label>
					<StockAutocomplete
						onSelectionChange={setSelectedSymbols}
						placeholder={
							mode === "single"
								? "Enter stock symbol (e.g., AAPL)"
								: "Enter multiple symbols"
						}
						maxSelections={mode === "single" ? 1 : 10}
						initialValue={selectedSymbols}
					/>
				</div>
			)}

			{/* Sector Selection - for sector mode */}
			{mode === "sector" && (
				<div style={{ marginBottom: "1.5rem" }}>
					<label
						style={{
							fontSize: "1rem",
							fontWeight: "500",
							color: "rgba(255, 255, 255, 0.9)",
							marginBottom: "0.5rem",
							display: "block",
						}}
					>
						Market Sector
					</label>
					<SectorDropdown
						onSectorChange={setSelectedSector}
						currentSector={selectedSector || undefined}
					/>
				</div>
			)}

			{/* Limit Setting */}
			{mode !== "single" && (
				<div style={{ marginBottom: "1.5rem" }}>
					<label
						style={{
							fontSize: "1rem",
							fontWeight: "500",
							color: "rgba(255, 255, 255, 0.9)",
							marginBottom: "0.5rem",
							display: "block",
						}}
					>
						Result Limit
					</label>
					<input
						type="number"
						value={limit}
						onChange={e => setLimit(parseInt(e.target.value) || 10)}
						min={1}
						max={50}
						style={{
							width: "100%",
							padding: "0.75rem",
							background: "rgba(255, 255, 255, 0.1)",
							border: "1px solid rgba(255, 255, 255, 0.2)",
							borderRadius: "8px",
							color: "white",
							fontSize: "0.9rem",
							outline: "none",
						}}
					/>
				</div>
			)}

			{/* ML Prediction Settings */}
			<div
				style={{
					marginBottom: "1.5rem",
					padding: "1rem",
					background: "rgba(139, 92, 246, 0.1)",
					border: "1px solid rgba(139, 92, 246, 0.3)",
					borderRadius: "12px",
				}}
			>
				<div style={{ marginBottom: "1rem" }}>
					<label
						style={{
							fontSize: "1rem",
							fontWeight: "600",
							color: "rgba(139, 92, 246, 0.9)",
							marginBottom: "0.75rem",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
						}}
					>
						<span style={{ fontSize: "1.2rem" }}>🤖</span>
						ML Predictions
					</label>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							marginBottom: "0.75rem",
						}}
					>
						<input
							type="checkbox"
							checked={includeML}
							onChange={e => setIncludeML(e.target.checked)}
							style={{
								width: "18px",
								height: "18px",
								accentColor: "rgba(139, 92, 246, 0.8)",
								cursor: "pointer",
							}}
						/>
						<span style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.9)" }}>
							Enable ML price predictions
						</span>
					</div>
				</div>

				{includeML && (
					<div>
						<label
							style={{
								fontSize: "0.9rem",
								fontWeight: "500",
								color: "rgba(255, 255, 255, 0.8)",
								marginBottom: "0.5rem",
								display: "block",
							}}
						>
							Prediction Horizon
						</label>
						<select
							value={mlHorizon}
							onChange={e => setMLHorizon(e.target.value as any)}
							style={{
								width: "100%",
								padding: "0.5rem",
								background: "rgba(255, 255, 255, 0.1)",
								border: "1px solid rgba(139, 92, 246, 0.4)",
								borderRadius: "6px",
								color: "white",
								fontSize: "0.9rem",
								outline: "none",
								cursor: "pointer",
							}}
						>
							<option value="1h" style={{ backgroundColor: "#1a1a1a" }}>
								1 Hour
							</option>
							<option value="4h" style={{ backgroundColor: "#1a1a1a" }}>
								4 Hours
							</option>
							<option value="1d" style={{ backgroundColor: "#1a1a1a" }}>
								1 Day
							</option>
							<option value="1w" style={{ backgroundColor: "#1a1a1a" }}>
								1 Week
							</option>
							<option value="1m" style={{ backgroundColor: "#1a1a1a" }}>
								1 Month
							</option>
						</select>
					</div>
				)}
			</div>

			{/* Run Analysis Button */}
			<button
				onClick={handleSubmit}
				disabled={!canSubmit()}
				style={{
					width: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: "0.75rem",
					background: canSubmit()
						? "linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(59, 130, 246, 0.9))"
						: "rgba(100, 100, 100, 0.3)",
					color: "white",
					padding: "1rem 2rem",
					border: "none",
					borderRadius: "12px",
					fontSize: "1.1rem",
					fontWeight: "600",
					cursor: canSubmit() ? "pointer" : "not-allowed",
					transition: "all 0.3s ease",
					boxShadow: canSubmit()
						? "0 8px 25px rgba(99, 102, 241, 0.4)"
						: "0 4px 15px rgba(0, 0, 0, 0.2)",
				}}
			>
				{isRunning ? (
					<>
						<span
							style={{
								animation: "spin 1s linear infinite",
								fontSize: "1.2rem",
							}}
						>
							🔄
						</span>
						Running Analysis...
					</>
				) : (
					<>
						<span style={{ fontSize: "1.2rem" }}>🚀</span>
						Run Deep Analysis
					</>
				)}
			</button>

			<style jsx>{`
				@keyframes spin {
					from {
						transform: rotate(0deg);
					}
					to {
						transform: rotate(360deg);
					}
				}
			`}</style>
		</div>
	);
}
