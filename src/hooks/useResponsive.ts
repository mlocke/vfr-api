import { useState, useEffect } from "react";

interface BreakpointConfig {
	mobile: number;
	tablet: number;
	desktop: number;
	wide: number;
}

interface ResponsiveState {
	isMobile: boolean;
	isTablet: boolean;
	isDesktop: boolean;
	isWide: boolean;
	screenWidth: number;
	screenHeight: number;
}

const defaultBreakpoints: BreakpointConfig = {
	mobile: 480,
	tablet: 768,
	desktop: 1024,
	wide: 1440,
};

export const useResponsive = (customBreakpoints?: Partial<BreakpointConfig>): ResponsiveState => {
	const breakpoints = { ...defaultBreakpoints, ...customBreakpoints };

	const [responsiveState, setResponsiveState] = useState<ResponsiveState>(() => {
		// Initialize with default values for SSR
		const initialWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
		const initialHeight = typeof window !== "undefined" ? window.innerHeight : 768;

		return {
			isMobile: initialWidth < breakpoints.tablet,
			isTablet: initialWidth >= breakpoints.tablet && initialWidth < breakpoints.desktop,
			isDesktop: initialWidth >= breakpoints.desktop && initialWidth < breakpoints.wide,
			isWide: initialWidth >= breakpoints.wide,
			screenWidth: initialWidth,
			screenHeight: initialHeight,
		};
	});

	useEffect(() => {
		const handleResize = () => {
			const width = window.innerWidth;
			const height = window.innerHeight;

			setResponsiveState({
				isMobile: width < breakpoints.tablet,
				isTablet: width >= breakpoints.tablet && width < breakpoints.desktop,
				isDesktop: width >= breakpoints.desktop && width < breakpoints.wide,
				isWide: width >= breakpoints.wide,
				screenWidth: width,
				screenHeight: height,
			});
		};

		// Set initial state
		handleResize();

		// Add event listener
		window.addEventListener("resize", handleResize);

		// Cleanup
		return () => window.removeEventListener("resize", handleResize);
	}, [breakpoints]);

	return responsiveState;
};

export const useGridColumns = (): { mobile: number; tablet: number; desktop: number } => {
	const { isMobile, isTablet } = useResponsive();

	return {
		mobile: 1,
		tablet: isMobile ? 1 : isTablet ? 2 : 3,
		desktop: isMobile ? 1 : isTablet ? 2 : 4,
	};
};

export const useChartDimensions = (baseHeight: number = 200): { width: string; height: number } => {
	const { isMobile, isTablet, screenWidth } = useResponsive();

	const height = isMobile ? baseHeight * 0.8 : isTablet ? baseHeight * 0.9 : baseHeight;
	const width = "100%";

	return { width, height };
};
