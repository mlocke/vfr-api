"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface VirtualizedInsight {
	id: string;
	title: string;
	status: "positive" | "negative" | "neutral";
	expandable: boolean;
	icon: string;
	details?: string[];
}

interface VirtualizedInsightListProps {
	insights: VirtualizedInsight[];
	expandedInsights: Set<string>;
	onToggle: (insightId: string) => void;
	itemHeight: number;
	visibleItemCount: number;
}

const VirtualizedInsightList: React.FC<VirtualizedInsightListProps> = ({
	insights,
	expandedInsights,
	onToggle,
	itemHeight = 70,
	visibleItemCount = 6,
}) => {
	const [scrollTop, setScrollTop] = useState(0);
	const [containerHeight] = useState(visibleItemCount * itemHeight);
	const containerRef = useRef<HTMLDivElement>(null);

	// Calculate which items should be visible
	const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
	const endIndex = Math.min(
		insights.length - 1,
		Math.ceil((scrollTop + containerHeight) / itemHeight) + 1
	);

	const visibleItems = insights.slice(startIndex, endIndex + 1);

	const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		setScrollTop(event.currentTarget.scrollTop);
	}, []);

	const getStatusStyles = (status: "positive" | "negative" | "neutral") => {
		const styles = {
			positive: {
				borderColor: "rgba(0, 200, 83, 0.5)",
				iconColor: "rgba(0, 200, 83, 0.9)",
				icon: "✓",
			},
			negative: {
				borderColor: "rgba(239, 68, 68, 0.5)",
				iconColor: "rgba(239, 68, 68, 0.9)",
				icon: "⚠",
			},
			neutral: {
				borderColor: "rgba(255, 193, 7, 0.5)",
				iconColor: "rgba(255, 193, 7, 0.9)",
				icon: "i",
			},
		};
		return styles[status];
	};

	return (
		<>
			<style jsx>{`
				.virtualized-container {
					height: ${containerHeight}px;
					overflow-y: auto;
					overflow-x: hidden;
					position: relative;
					border: 1px solid rgba(255, 255, 255, 0.1);
					border-radius: 12px;
					background: rgba(255, 255, 255, 0.03);
					-webkit-overflow-scrolling: touch;
					scroll-behavior: smooth;
				}

				.virtualized-content {
					height: ${insights.length * itemHeight}px;
					position: relative;
				}

				.insight-item {
					position: absolute;
					width: 100%;
					height: ${itemHeight}px;
					padding: 1rem;
					display: flex;
					align-items: center;
					gap: 0.75rem;
					background: rgba(255, 255, 255, 0.05);
					border-bottom: 1px solid rgba(255, 255, 255, 0.05);
					cursor: pointer;
					transition: background-color 0.2s ease;
				}

				.insight-item:hover {
					background: rgba(255, 255, 255, 0.08);
				}

				.insight-item.expanded {
					height: auto;
					min-height: ${itemHeight}px;
					flex-direction: column;
					align-items: flex-start;
				}

				.insight-icon {
					width: 24px;
					height: 24px;
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 12px;
					font-weight: bold;
					color: white;
					flex-shrink: 0;
				}

				.insight-content {
					flex: 1;
					display: flex;
					justify-content: space-between;
					align-items: center;
					width: 100%;
				}

				.insight-title {
					font-size: 0.95rem;
					font-weight: 500;
					color: white;
				}

				.expand-icon {
					font-size: 0.875rem;
					color: rgba(255, 255, 255, 0.6);
					transition: transform 0.2s ease;
				}

				.expand-icon.expanded {
					transform: rotate(180deg);
				}

				.insight-details {
					margin-top: 0.75rem;
					padding-left: 2.5rem;
					width: 100%;
				}

				.insight-details ul {
					margin: 0;
					padding-left: 1.5rem;
					font-size: 0.875rem;
					color: rgba(255, 255, 255, 0.8);
					line-height: 1.5;
				}

				.insight-details li {
					margin-bottom: 0.5rem;
				}

				/* Scrollbar styling */
				.virtualized-container::-webkit-scrollbar {
					width: 6px;
				}

				.virtualized-container::-webkit-scrollbar-track {
					background: rgba(255, 255, 255, 0.1);
					border-radius: 3px;
				}

				.virtualized-container::-webkit-scrollbar-thumb {
					background: rgba(255, 255, 255, 0.3);
					border-radius: 3px;
				}

				.virtualized-container::-webkit-scrollbar-thumb:hover {
					background: rgba(255, 255, 255, 0.5);
				}
			`}</style>

			<div
				ref={containerRef}
				className="virtualized-container"
				onScroll={handleScroll}
				role="listbox"
				aria-label="Virtualized insight list"
			>
				<div className="virtualized-content">
					{visibleItems.map((insight, index) => {
						const actualIndex = startIndex + index;
						const isExpanded = expandedInsights.has(insight.id);
						const statusStyles = getStatusStyles(insight.status);
						const topPosition = actualIndex * itemHeight;

						return (
							<div
								key={insight.id}
								className={`insight-item ${isExpanded ? "expanded" : ""}`}
								style={{ top: `${topPosition}px` }}
								onClick={() => insight.expandable && onToggle(insight.id)}
								role="option"
								aria-selected={isExpanded}
								aria-expanded={insight.expandable ? isExpanded : undefined}
								tabIndex={0}
								onKeyDown={e => {
									if (
										insight.expandable &&
										(e.key === "Enter" || e.key === " ")
									) {
										e.preventDefault();
										onToggle(insight.id);
									}
								}}
							>
								{/* Insight Header */}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.75rem",
										width: "100%",
									}}
								>
									<div
										className="insight-icon"
										style={{ background: statusStyles.iconColor }}
									>
										{insight.icon || statusStyles.icon}
									</div>

									<div className="insight-content">
										<span className="insight-title">{insight.title}</span>
										{insight.expandable && (
											<div
												className={`expand-icon ${isExpanded ? "expanded" : ""}`}
											>
												▼
											</div>
										)}
									</div>
								</div>

								{/* Expandable Details */}
								{insight.expandable && isExpanded && insight.details && (
									<div className="insight-details">
										<ul>
											{insight.details.map((detail, detailIndex) => (
												<li key={detailIndex}>{detail}</li>
											))}
										</ul>
									</div>
								)}
							</div>
						);
					})}
				</div>

				{/* Scroll indicator */}
				{insights.length > visibleItemCount && (
					<div
						style={{
							position: "absolute",
							bottom: "0.5rem",
							right: "0.5rem",
							background: "rgba(0, 0, 0, 0.7)",
							color: "white",
							padding: "0.25rem 0.5rem",
							borderRadius: "4px",
							fontSize: "0.75rem",
							pointerEvents: "none",
							zIndex: 10,
						}}
					>
						{Math.floor(scrollTop / itemHeight) + 1}-
						{Math.min(
							Math.ceil((scrollTop + containerHeight) / itemHeight),
							insights.length
						)}{" "}
						of {insights.length}
					</div>
				)}
			</div>
		</>
	);
};

export default VirtualizedInsightList;
