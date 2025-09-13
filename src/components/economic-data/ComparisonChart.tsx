import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { ChartDataPoint } from "../../types/economic-data";
import "../../styles/cyberpunk.css";

interface ComparisonDataSeries {
	name: string;
	data: ChartDataPoint[];
	color: string;
	yAxis?: "left" | "right"; // For dual-axis charts
}

interface ComparisonChartProps {
	series: ComparisonDataSeries[];
	title: string;
	height?: number;
	animated?: boolean;
	chartType?: "line" | "area" | "bar";
	showLegend?: boolean;
	showGrid?: boolean;
	dualAxis?: boolean;
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({
	series,
	title,
	height = 300,
	animated = true,
	chartType = "line",
	showLegend = true,
	showGrid = true,
	dualAxis = false,
}) => {
	const svgRef = useRef<SVGSVGElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [activeSeries, setActiveSeries] = useState<string[]>(series.map(s => s.name));
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!series || series.length === 0) return;

		const svg = d3.select(svgRef.current);
		const tooltip = d3.select(tooltipRef.current);

		// Clear previous content
		svg.selectAll("*").remove();

		// Set up dimensions
		const margin = { top: 20, right: dualAxis ? 80 : 30, bottom: 60, left: 60 };
		const containerWidth = svgRef.current?.parentElement?.clientWidth || 600;
		const width = containerWidth - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		svg.attr("width", containerWidth).attr("height", height);

		const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

		// Filter active series
		const activeSer = series.filter(s => activeSeries.includes(s.name));
		if (activeSer.length === 0) return;

		// Parse and normalize data
		const allData = activeSer.flatMap(s =>
			s.data.map(d => ({
				...d,
				date: new Date(d.date),
				value: Number(d.value),
				series: s.name,
			}))
		);

		// Get date range
		const dateExtent = d3.extent(allData, d => d.date) as [Date, Date];
		const xScale = d3.scaleTime().domain(dateExtent).range([0, width]);

		// Set up Y scales
		const leftSeries = activeSer.filter(s => !s.yAxis || s.yAxis === "left");
		const rightSeries = dualAxis ? activeSer.filter(s => s.yAxis === "right") : [];

		const leftExtent = d3.extent(
			allData.filter(d => leftSeries.some(s => s.name === d.series)),
			d => d.value
		) as [number, number];

		const yScaleLeft = d3.scaleLinear().domain(leftExtent).nice().range([chartHeight, 0]);

		let yScaleRight: d3.ScaleLinear<number, number> | undefined;
		if (dualAxis && rightSeries.length > 0) {
			const rightExtent = d3.extent(
				allData.filter(d => rightSeries.some(s => s.name === d.series)),
				d => d.value
			) as [number, number];

			yScaleRight = d3.scaleLinear().domain(rightExtent).nice().range([chartHeight, 0]);
		}

		// Add grid lines
		if (showGrid) {
			// Horizontal grid lines
			const yTicks = yScaleLeft.ticks(6);
			g.selectAll(".grid-line-y")
				.data(yTicks)
				.enter()
				.append("line")
				.attr("class", "grid-line-y")
				.attr("x1", 0)
				.attr("x2", width)
				.attr("y1", d => yScaleLeft(d))
				.attr("y2", d => yScaleLeft(d))
				.style("stroke", "rgba(0, 255, 255, 0.1)")
				.style("stroke-width", 1)
				.style("stroke-dasharray", "2,2");

			// Vertical grid lines
			const xTicks = xScale.ticks(6);
			g.selectAll(".grid-line-x")
				.data(xTicks)
				.enter()
				.append("line")
				.attr("class", "grid-line-x")
				.attr("x1", d => xScale(d))
				.attr("x2", d => xScale(d))
				.attr("y1", 0)
				.attr("y2", chartHeight)
				.style("stroke", "rgba(0, 255, 255, 0.1)")
				.style("stroke-width", 1)
				.style("stroke-dasharray", "2,2");
		}

		// Create gradients for each series
		const defs = svg.append("defs");
		activeSer.forEach((s, i) => {
			const gradient = defs
				.append("linearGradient")
				.attr("id", `gradient-${i}`)
				.attr("gradientUnits", "userSpaceOnUse")
				.attr("x1", 0)
				.attr("y1", 0)
				.attr("x2", 0)
				.attr("y2", chartHeight);

			gradient
				.append("stop")
				.attr("offset", "0%")
				.attr("stop-color", s.color)
				.attr("stop-opacity", 0.4);

			gradient
				.append("stop")
				.attr("offset", "100%")
				.attr("stop-color", s.color)
				.attr("stop-opacity", 0.05);
		});

		// Render each series
		activeSer.forEach((s, seriesIndex) => {
			const seriesData = s.data
				.map(d => ({ ...d, date: new Date(d.date), value: Number(d.value) }))
				.sort((a, b) => a.date.getTime() - b.date.getTime());

			const yScale = dualAxis && s.yAxis === "right" ? yScaleRight! : yScaleLeft;

			if (chartType === "area" || chartType === "line") {
				// Area chart
				if (chartType === "area") {
					const area = d3
						.area<any>()
						.x(d => xScale(d.date))
						.y0(chartHeight)
						.y1(d => yScale(d.value))
						.curve(d3.curveMonotoneX);

					const areaPath = g
						.append("path")
						.datum(seriesData)
						.attr("fill", `url(#gradient-${seriesIndex})`)
						.attr("d", area)
						.style("opacity", 0);

					if (animated) {
						areaPath
							.transition()
							.delay(seriesIndex * 200)
							.duration(1000)
							.style("opacity", 1);
					} else {
						areaPath.style("opacity", 1);
					}
				}

				// Line
				const line = d3
					.line<any>()
					.x(d => xScale(d.date))
					.y(d => yScale(d.value))
					.curve(d3.curveMonotoneX);

				const path = g
					.append("path")
					.datum(seriesData)
					.attr("fill", "none")
					.attr("stroke", s.color)
					.attr("stroke-width", 2)
					.attr("d", line)
					.style("filter", `drop-shadow(0 0 8px ${s.color})`);

				// Animate line drawing
				if (animated) {
					const totalLength = path.node()?.getTotalLength() || 0;

					path.attr("stroke-dasharray", `${totalLength} ${totalLength}`)
						.attr("stroke-dashoffset", totalLength)
						.transition()
						.delay(seriesIndex * 200)
						.duration(1500)
						.ease(d3.easeQuadInOut)
						.attr("stroke-dashoffset", 0);
				}

				// Add data points
				const circles = g
					.selectAll(`.data-point-${seriesIndex}`)
					.data(seriesData)
					.enter()
					.append("circle")
					.attr("class", `data-point-${seriesIndex}`)
					.attr("cx", d => xScale(d.date))
					.attr("cy", d => yScale(d.value))
					.attr("r", 0)
					.style("fill", s.color)
					.style("filter", `drop-shadow(0 0 6px ${s.color})`)
					.style("opacity", 0.8);

				if (animated) {
					circles
						.transition()
						.delay((d, i) => i * 20 + seriesIndex * 200 + 800)
						.duration(200)
						.attr("r", 3);
				} else {
					circles.attr("r", 3);
				}

				// Tooltip interactions
				circles
					.on("mouseover", (event, d) => {
						// Highlight all points at this date
						g.selectAll("circle")
							.filter(
								(circleData: any) => circleData.date.getTime() === d.date.getTime()
							)
							.transition()
							.duration(100)
							.attr("r", 6)
							.style("opacity", 1);

						// Show tooltip
						const allPointsAtDate = activeSer
							.map(series => {
								const point = series.data.find(
									p => new Date(p.date).getTime() === d.date.getTime()
								);
								return {
									series: series.name,
									value: point?.value,
									color: series.color,
								};
							})
							.filter(p => p.value !== undefined);

						tooltip
							.style("opacity", 1)
							.style("left", `${event.pageX + 10}px`)
							.style("top", `${event.pageY - 10}px`).html(`
                <div class="cyber-card cyber-card--cyan p-3 text-sm min-w-48">
                  <div class="cyber-text font-semibold mb-2">${d3.timeFormat("%b %d, %Y")(d.date)}</div>
                  ${allPointsAtDate
						.map(
							p => `
                    <div class="flex justify-between items-center gap-4 mb-1">
                      <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${p.color}"></div>
                        <span class="cyber-text">${p.series}</span>
                      </div>
                      <span class="cyber-text--data cyber-text--glow-cyan">${Number(p.value).toFixed(2)}</span>
                    </div>
                  `
						)
						.join("")}
                </div>
              `);
					})
					.on("mouseout", () => {
						g.selectAll("circle")
							.transition()
							.duration(100)
							.attr("r", 3)
							.style("opacity", 0.8);

						tooltip.style("opacity", 0);
					});
			} else if (chartType === "bar") {
				// Bar chart implementation
				const barWidth = Math.max(2, (width / seriesData.length / activeSer.length) * 0.8);
				const barOffset = seriesIndex * barWidth;

				g.selectAll(`.bar-${seriesIndex}`)
					.data(seriesData)
					.enter()
					.append("rect")
					.attr("class", `bar-${seriesIndex}`)
					.attr("x", d => xScale(d.date) - (activeSer.length * barWidth) / 2 + barOffset)
					.attr("y", chartHeight)
					.attr("width", barWidth)
					.attr("height", 0)
					.style("fill", s.color)
					.style("filter", `drop-shadow(0 0 6px ${s.color})`)
					.transition()
					.delay(seriesIndex * 100)
					.duration(800)
					.attr("y", d => yScaleLeft(d.value))
					.attr("height", d => chartHeight - yScaleLeft(d.value));
			}
		});

		// Add axes
		const xAxis = d3.axisBottom(xScale).tickFormat((d) => d3.timeFormat("%b %y")(d as Date)).ticks(6);

		const yAxisLeft = d3.axisLeft(yScaleLeft).ticks(6).tickFormat(d3.format(".2f"));

		g.append("g")
			.attr("transform", `translate(0,${chartHeight})`)
			.call(xAxis)
			.selectAll("text")
			.style("fill", "rgba(255, 255, 255, 0.7)")
			.style("font-size", "12px");

		g.append("g")
			.call(yAxisLeft)
			.selectAll("text")
			.style("fill", "rgba(255, 255, 255, 0.7)")
			.style("font-size", "12px");

		// Right axis for dual-axis charts
		if (dualAxis && yScaleRight) {
			const yAxisRight = d3.axisRight(yScaleRight).ticks(6).tickFormat(d3.format(".2f"));

			g.append("g")
				.attr("transform", `translate(${width},0)`)
				.call(yAxisRight)
				.selectAll("text")
				.style("fill", "rgba(255, 255, 255, 0.7)")
				.style("font-size", "12px");
		}

		// Style axes
		g.selectAll(".domain").style("stroke", "rgba(0, 255, 255, 0.3)").style("stroke-width", 1);

		g.selectAll(".tick line")
			.style("stroke", "rgba(0, 255, 255, 0.2)")
			.style("stroke-width", 1);

		setTimeout(() => setIsLoading(false), animated ? 2000 : 100);
	}, [series, activeSeries, chartType, height, animated, showGrid, dualAxis]);

	const toggleSeries = (seriesName: string) => {
		setActiveSeries(prev =>
			prev.includes(seriesName)
				? prev.filter(name => name !== seriesName)
				: [...prev, seriesName]
		);
	};

	return (
		<div className="comparison-chart-container cyber-card cyber-card--cyan p-6">
			{/* Chart Title */}
			<h3 className="cyber-text cyber-text--glow text-xl font-bold mb-6 text-center">
				{title}
			</h3>

			{/* Legend */}
			{showLegend && (
				<div className="legend flex flex-wrap justify-center gap-4 mb-6">
					{series.map((s, index) => (
						<button
							key={s.name}
							className={`legend-item flex items-center gap-2 px-3 py-1 rounded-lg transition-all duration-300 ${
								activeSeries.includes(s.name)
									? "bg-white bg-opacity-10"
									: "opacity-50 hover:opacity-75"
							}`}
							onClick={() => toggleSeries(s.name)}
							aria-label={`Toggle ${s.name} series visibility`}
						>
							<div
								className="w-3 h-3 rounded-full"
								style={{
									backgroundColor: s.color,
									boxShadow: `0 0 8px ${s.color}`,
								}}
							/>
							<span className="cyber-text text-sm">{s.name}</span>
							{dualAxis && s.yAxis === "right" && (
								<span className="cyber-text text-xs opacity-60">(R)</span>
							)}
						</button>
					))}
				</div>
			)}

			{/* Chart */}
			<div className="chart-wrapper relative">
				{isLoading && animated && (
					<div className="absolute inset-0 flex items-center justify-center">
						<div className="cyber-text cyber-text--glow-cyan animate-pulse">
							Rendering comparison analysis...
						</div>
					</div>
				)}

				<svg ref={svgRef} className="w-full" style={{ background: "transparent" }} />

				{/* Tooltip */}
				<div
					ref={tooltipRef}
					className="tooltip fixed pointer-events-none z-20"
					style={{ opacity: 0 }}
				/>
			</div>

			{/* Chart controls */}
			<div className="chart-controls flex justify-center gap-2 mt-4">
				{["line", "area", "bar"].map(type => (
					<button
						key={type}
						className={`control-btn cyber-card cyber-card--blue px-3 py-1 text-xs transition-all ${
							chartType === type ? "bg-blue-900/30" : "opacity-60 hover:opacity-100"
						}`}
						onClick={() => {
							/* Chart type switching would require prop callback */
						}}
						aria-label={`Switch to ${type} chart`}
					>
						<span className="cyber-text capitalize">{type}</span>
					</button>
				))}
			</div>

			{/* Scanning beam effect */}
			{animated && !isLoading && (
				<div className="absolute inset-0 scanning-beam pointer-events-none" />
			)}
		</div>
	);
};

export default ComparisonChart;
