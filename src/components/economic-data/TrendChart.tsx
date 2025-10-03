import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { TrendChartProps, ChartDataPoint } from "../../types/economic-data";
import "../../styles/cyberpunk.css";

const TrendChart: React.FC<TrendChartProps> = ({
	data,
	title,
	color = "#00FFFF",
	height = 200,
	animated = true,
	showGrid = true,
	showTooltip = true,
}) => {
	const svgRef = useRef<SVGSVGElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!data || data.length === 0) return;

		const svg = d3.select(svgRef.current);
		const tooltip = d3.select(tooltipRef.current);

		// Clear previous content
		svg.selectAll("*").remove();

		// Set up dimensions
		const margin = { top: 20, right: 30, bottom: 40, left: 50 };
		const containerWidth = svgRef.current?.parentElement?.clientWidth || 400;
		const width = containerWidth - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		svg.attr("width", containerWidth).attr("height", height);

		const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

		// Parse dates and prepare data
		const parsedData = data
			.map(d => ({
				...d,
				date: new Date(d.date),
				value: Number(d.value),
			}))
			.sort((a, b) => a.date.getTime() - b.date.getTime());

		// Set up scales
		const xScale = d3
			.scaleTime()
			.domain(d3.extent(parsedData, d => d.date) as [Date, Date])
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain(d3.extent(parsedData, d => d.value) as [number, number])
			.nice()
			.range([chartHeight, 0]);

		// Create line generator
		const line = d3
			.line<any>()
			.x(d => xScale(d.date))
			.y(d => yScale(d.value))
			.curve(d3.curveMonotoneX);

		// Add grid lines if enabled
		if (showGrid) {
			// Horizontal grid lines
			const yTicks = yScale.ticks(5);
			g.selectAll(".grid-line-y")
				.data(yTicks)
				.enter()
				.append("line")
				.attr("class", "grid-line-y")
				.attr("x1", 0)
				.attr("x2", width)
				.attr("y1", d => yScale(d))
				.attr("y2", d => yScale(d))
				.style("stroke", "rgba(0, 255, 255, 0.1)")
				.style("stroke-width", 1)
				.style("stroke-dasharray", "2,2");

			// Vertical grid lines
			const xTicks = xScale.ticks(5);
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

		// Create gradient for the line
		const gradient = svg
			.append("defs")
			.append("linearGradient")
			.attr("id", `line-gradient-${title.replace(/\s+/g, "")}`)
			.attr("gradientUnits", "userSpaceOnUse")
			.attr("x1", 0)
			.attr("y1", 0)
			.attr("x2", width)
			.attr("y2", 0);

		gradient
			.append("stop")
			.attr("offset", "0%")
			.attr("stop-color", color)
			.attr("stop-opacity", 0.8);

		gradient
			.append("stop")
			.attr("offset", "50%")
			.attr("stop-color", color)
			.attr("stop-opacity", 1);

		gradient
			.append("stop")
			.attr("offset", "100%")
			.attr("stop-color", color)
			.attr("stop-opacity", 0.8);

		// Add area fill
		const area = d3
			.area<any>()
			.x(d => xScale(d.date))
			.y0(chartHeight)
			.y1(d => yScale(d.value))
			.curve(d3.curveMonotoneX);

		const areaPath = g
			.append("path")
			.datum(parsedData)
			.attr("fill", `url(#area-gradient-${title.replace(/\s+/g, "")})`)
			.attr("d", area);

		// Create area gradient
		const areaGradient = svg
			.select("defs")
			.append("linearGradient")
			.attr("id", `area-gradient-${title.replace(/\s+/g, "")}`)
			.attr("gradientUnits", "userSpaceOnUse")
			.attr("x1", 0)
			.attr("y1", 0)
			.attr("x2", 0)
			.attr("y2", chartHeight);

		areaGradient
			.append("stop")
			.attr("offset", "0%")
			.attr("stop-color", color)
			.attr("stop-opacity", 0.3);

		areaGradient
			.append("stop")
			.attr("offset", "100%")
			.attr("stop-color", color)
			.attr("stop-opacity", 0.05);

		// Add the main line
		const path = g
			.append("path")
			.datum(parsedData)
			.attr("fill", "none")
			.attr("stroke", `url(#line-gradient-${title.replace(/\s+/g, "")})`)
			.attr("stroke-width", 2)
			.attr("d", line)
			.style("filter", `drop-shadow(0 0 8px ${color})`);

		// Animate line drawing if enabled
		if (animated) {
			const totalLength = path.node()?.getTotalLength() || 0;

			path.attr("stroke-dasharray", `${totalLength} ${totalLength}`)
				.attr("stroke-dashoffset", totalLength)
				.transition()
				.duration(1500)
				.ease(d3.easeQuadInOut)
				.attr("stroke-dashoffset", 0)
				.on("end", () => setIsLoading(false));

			// Animate area fill
			areaPath.style("opacity", 0).transition().delay(500).duration(1000).style("opacity", 1);
		} else {
			setIsLoading(false);
		}

		// Add data points
		const circles = g
			.selectAll(".data-point")
			.data(parsedData)
			.enter()
			.append("circle")
			.attr("class", "data-point")
			.attr("cx", d => xScale(d.date))
			.attr("cy", d => yScale(d.value))
			.attr("r", 0)
			.style("fill", color)
			.style("filter", `drop-shadow(0 0 6px ${color})`);

		if (animated) {
			circles
				.transition()
				.delay((d, i) => i * 50 + 1000)
				.duration(300)
				.attr("r", 3)
				.style("opacity", 0.8);
		} else {
			circles.attr("r", 3).style("opacity", 0.8);
		}

		// Add tooltip interactions if enabled
		if (showTooltip) {
			circles
				.on("mouseover", (event, d) => {
					// Highlight point
					d3.select(event.currentTarget)
						.transition()
						.duration(100)
						.attr("r", 6)
						.style("opacity", 1);

					// Show tooltip
					tooltip
						.style("opacity", 1)
						.style("left", `${event.pageX + 10}px`)
						.style("top", `${event.pageY - 10}px`).html(`
              <div class="cyber-card cyber-card--cyan p-2 text-sm">
                <div class="cyber-text font-semibold">${d.label || d3.timeFormat("%b %Y")(d.date)}</div>
                <div class="cyber-text--glow-cyan font-mono">${d.value.toFixed(2)}</div>
              </div>
            `);
				})
				.on("mouseout", (event, d) => {
					// Restore point
					d3.select(event.currentTarget)
						.transition()
						.duration(100)
						.attr("r", 3)
						.style("opacity", 0.8);

					// Hide tooltip
					tooltip.style("opacity", 0);
				});
		}

		// Add axes
		const xAxis = d3
			.axisBottom(xScale)
			.tickFormat(d => d3.timeFormat("%b %y")(d as Date))
			.ticks(5);

		const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".2f"));

		g.append("g")
			.attr("transform", `translate(0,${chartHeight})`)
			.call(xAxis)
			.selectAll("text")
			.style("fill", "rgba(255, 255, 255, 0.7)")
			.style("font-size", "12px");

		g.append("g")
			.call(yAxis)
			.selectAll("text")
			.style("fill", "rgba(255, 255, 255, 0.7)")
			.style("font-size", "12px");

		// Style axis lines
		g.selectAll(".domain").style("stroke", "rgba(0, 255, 255, 0.3)").style("stroke-width", 1);

		g.selectAll(".tick line")
			.style("stroke", "rgba(0, 255, 255, 0.2)")
			.style("stroke-width", 1);
	}, [data, title, color, height, animated, showGrid, showTooltip]);

	return (
		<div className="trend-chart-container relative w-full">
			{/* Chart Title */}
			<h3 className="cyber-text cyber-text--glow text-lg font-semibold mb-4 text-center">
				{title}
			</h3>

			{/* Loading indicator */}
			{isLoading && animated && (
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="cyber-text cyber-text--glow-cyan animate-pulse">
						Loading data stream...
					</div>
				</div>
			)}

			{/* SVG Chart */}
			<div className="chart-wrapper relative">
				<svg ref={svgRef} className="w-full" style={{ background: "transparent" }} />

				{/* Tooltip */}
				{showTooltip && (
					<div
						ref={tooltipRef}
						className="tooltip fixed pointer-events-none z-10"
						style={{ opacity: 0 }}
					/>
				)}
			</div>

			{/* Scanning beam effect */}
			{animated && !isLoading && (
				<div className="absolute inset-0 scanning-beam pointer-events-none" />
			)}
		</div>
	);
};

export default TrendChart;
