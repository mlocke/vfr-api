/**
 * Accessibility utilities for financial data visualization
 */

export interface A11yConfig {
	announceDataChanges: boolean;
	highContrast: boolean;
	reducedMotion: boolean;
	screenReader: boolean;
}

/**
 * Generate descriptive text for screen readers
 */
export const generateAriaDescription = (
	title: string,
	value: string | number,
	trend?: "Rising" | "Falling" | "Stable",
	change?: number
): string => {
	let description = `${title}: ${value}`;

	if (trend) {
		description += `. Trend is ${trend.toLowerCase()}`;

		if (change !== undefined) {
			const changeText =
				change > 0 ? "increased" : change < 0 ? "decreased" : "remained stable";
			description += `. ${changeText} by ${Math.abs(change).toFixed(2)} percent`;
		}
	}

	return description;
};

/**
 * Generate chart description for screen readers
 */
export const generateChartDescription = (
	title: string,
	dataPoints: { date: string; value: number }[],
	trend?: "Rising" | "Falling" | "Stable"
): string => {
	if (dataPoints.length === 0) return `${title}: No data available`;

	const firstPoint = dataPoints[0];
	const lastPoint = dataPoints[dataPoints.length - 1];
	const minValue = Math.min(...dataPoints.map(d => d.value));
	const maxValue = Math.max(...dataPoints.map(d => d.value));

	let description = `${title} chart spanning from ${firstPoint.date} to ${lastPoint.date}. `;
	description += `Values range from ${minValue.toFixed(2)} to ${maxValue.toFixed(2)}. `;
	description += `Current value is ${lastPoint.value.toFixed(2)}. `;

	if (trend) {
		description += `Overall trend is ${trend.toLowerCase()}. `;
	}

	description += `Chart contains ${dataPoints.length} data points.`;

	return description;
};

/**
 * Generate color contrast-safe alternatives
 */
export const getAccessibleColors = (
	baseColor: string
): {
	primary: string;
	background: string;
	text: string;
} => {
	const colorMap: Record<string, { primary: string; background: string; text: string }> = {
		"#00FFFF": {
			// Cyan
			primary: "#00E6E6",
			background: "rgba(0, 255, 255, 0.1)",
			text: "#FFFFFF",
		},
		"#00FF7F": {
			// Green
			primary: "#00E670",
			background: "rgba(0, 255, 127, 0.1)",
			text: "#FFFFFF",
		},
		"#FF00FF": {
			// Pink
			primary: "#E600E6",
			background: "rgba(255, 0, 255, 0.1)",
			text: "#FFFFFF",
		},
		"#0080FF": {
			// Blue
			primary: "#0073E6",
			background: "rgba(0, 128, 255, 0.1)",
			text: "#FFFFFF",
		},
		"#FFFF00": {
			// Yellow
			primary: "#E6E600",
			background: "rgba(255, 255, 0, 0.1)",
			text: "#000000",
		},
		"#FF0080": {
			// Red
			primary: "#E60070",
			background: "rgba(255, 0, 128, 0.1)",
			text: "#FFFFFF",
		},
	};

	return (
		colorMap[baseColor] || {
			primary: baseColor,
			background: `${baseColor}1A`,
			text: "#FFFFFF",
		}
	);
};

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * Check if user prefers high contrast
 */
export const prefersHighContrast = (): boolean => {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-contrast: high)").matches;
};

/**
 * Announce changes to screen readers
 */
export const announceToScreenReader = (
	message: string,
	priority: "polite" | "assertive" = "polite"
) => {
	if (typeof document === "undefined") return;

	const announcement = document.createElement("div");
	announcement.setAttribute("aria-live", priority);
	announcement.setAttribute("aria-atomic", "true");
	announcement.style.position = "absolute";
	announcement.style.left = "-10000px";
	announcement.style.width = "1px";
	announcement.style.height = "1px";
	announcement.style.overflow = "hidden";

	document.body.appendChild(announcement);
	announcement.textContent = message;

	setTimeout(() => {
		document.body.removeChild(announcement);
	}, 1000);
};

/**
 * Generate keyboard navigation instructions
 */
export const getKeyboardInstructions = (componentType: "chart" | "dashboard" | "card"): string => {
	const instructions: Record<string, string> = {
		chart: "Use Tab to navigate chart elements, Enter to select, Arrow keys to explore data points",
		dashboard:
			"Use Tab to navigate between sectors, Enter to expand/collapse sections, Arrow keys to navigate within sections",
		card: "Use Tab to focus on metric cards, Enter to view details, Escape to close expanded views",
	};

	return instructions[componentType] || "Use Tab to navigate, Enter to select, Escape to close";
};

/**
 * Focus management utilities
 */
export class FocusManager {
	private previousFocus: HTMLElement | null = null;

	/**
	 * Store current focus and move to new element
	 */
	public moveFocus(newElement: HTMLElement | string) {
		this.previousFocus = document.activeElement as HTMLElement;

		const element =
			typeof newElement === "string"
				? document.getElementById(newElement) || document.querySelector(newElement)
				: newElement;

		if (element && typeof element.focus === "function") {
			element.focus();
		}
	}

	/**
	 * Return focus to previous element
	 */
	public returnFocus() {
		if (this.previousFocus && typeof this.previousFocus.focus === "function") {
			this.previousFocus.focus();
			this.previousFocus = null;
		}
	}

	/**
	 * Trap focus within container
	 */
	public trapFocus(container: HTMLElement) {
		const focusableElements = container.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);

		const firstElement = focusableElements[0] as HTMLElement;
		const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

		const handleTabKey = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;

			if (e.shiftKey) {
				if (document.activeElement === firstElement) {
					e.preventDefault();
					lastElement.focus();
				}
			} else {
				if (document.activeElement === lastElement) {
					e.preventDefault();
					firstElement.focus();
				}
			}
		};

		container.addEventListener("keydown", handleTabKey);

		return () => {
			container.removeEventListener("keydown", handleTabKey);
		};
	}
}

/**
 * Color blind friendly palette
 */
export const getColorBlindFriendlyPalette = (): string[] => [
	"#1f77b4", // Blue
	"#ff7f0e", // Orange
	"#2ca02c", // Green
	"#d62728", // Red
	"#9467bd", // Purple
	"#8c564b", // Brown
	"#e377c2", // Pink
	"#7f7f7f", // Gray
	"#bcbd22", // Olive
	"#17becf", // Cyan
];

/**
 * Generate table description for complex data
 */
export const generateTableDescription = (
	headers: string[],
	data: (string | number)[][],
	title: string
): string => {
	let description = `${title} data table with ${headers.length} columns and ${data.length} rows. `;
	description += `Column headers are: ${headers.join(", ")}. `;

	if (data.length > 0) {
		description += `Sample data: ${data[0].join(", ")}.`;
	}

	return description;
};
