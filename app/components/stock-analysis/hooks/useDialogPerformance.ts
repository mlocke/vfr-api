"use client";

import { useCallback, useRef, useState } from "react";

interface PerformanceMetrics {
	renderTime: number;
	dataFetchTime: number;
	memoryUsage: number;
	frameRate: number;
	interactions: number;
}

interface PerformanceBudget {
	maxRenderTime: number;
	maxDataFetchTime: number;
	maxMemoryUsage: number;
	minFrameRate: number;
}

interface PerformanceBudgetCheck {
	passed: boolean;
	violations: string[];
}

const DEFAULT_BUDGET: PerformanceBudget = {
	maxRenderTime: 200, // 200ms
	maxDataFetchTime: 3000, // 3s
	maxMemoryUsage: 50, // 50MB
	minFrameRate: 30, // 30fps
};

export const useDialogPerformance = (budget: PerformanceBudget = DEFAULT_BUDGET) => {
	const [metrics, setMetrics] = useState<PerformanceMetrics>({
		renderTime: 0,
		dataFetchTime: 0,
		memoryUsage: 0,
		frameRate: 0,
		interactions: 0,
	});

	const performanceMarks = useRef<Map<string, number>>(new Map());
	const frameRateCounter = useRef({ frames: 0, lastTime: performance.now() });

	const startTracking = useCallback((label: string) => {
		performanceMarks.current.set(`${label}-start`, performance.now());
	}, []);

	const stopTracking = useCallback((label: string) => {
		const startTime = performanceMarks.current.get(`${label}-start`);
		if (startTime) {
			const duration = performance.now() - startTime;

			setMetrics(prev => {
				const newMetrics = { ...prev };

				switch (label) {
					case "dialog-render":
						newMetrics.renderTime = duration;
						break;
					case "dialog-data-fetch":
						newMetrics.dataFetchTime = duration;
						break;
					default:
						break;
				}

				return newMetrics;
			});

			performanceMarks.current.delete(`${label}-start`);
		}
	}, []);

	const measureRender = useCallback(
		(renderFn: () => void) => {
			startTracking("dialog-render");

			// Use requestAnimationFrame to measure actual render time
			requestAnimationFrame(() => {
				renderFn();

				requestAnimationFrame(() => {
					stopTracking("dialog-render");
				});
			});
		},
		[startTracking, stopTracking]
	);

	const updateMemoryUsage = useCallback(() => {
		// Use performance.memory if available (Chrome only)
		if ("memory" in performance) {
			const memory = (performance as any).memory;
			const usedMB = memory.usedJSHeapSize / 1024 / 1024;

			setMetrics(prev => ({
				...prev,
				memoryUsage: usedMB,
			}));
		}
	}, []);

	const trackFrameRate = useCallback(() => {
		const now = performance.now();
		const { frames, lastTime } = frameRateCounter.current;

		frameRateCounter.current.frames++;

		if (now - lastTime >= 1000) {
			// Calculate FPS every second
			const fps = Math.round((frames * 1000) / (now - lastTime));

			setMetrics(prev => ({
				...prev,
				frameRate: fps,
			}));

			frameRateCounter.current = { frames: 0, lastTime: now };
		}
	}, []);

	const trackInteraction = useCallback(() => {
		setMetrics(prev => ({
			...prev,
			interactions: prev.interactions + 1,
		}));
	}, []);

	const validatePerformanceBudget = useCallback((): PerformanceBudgetCheck => {
		const violations: string[] = [];

		if (metrics.renderTime > budget.maxRenderTime) {
			violations.push(
				`Render time ${metrics.renderTime}ms exceeds budget ${budget.maxRenderTime}ms`
			);
		}

		if (metrics.dataFetchTime > budget.maxDataFetchTime) {
			violations.push(
				`Data fetch time ${metrics.dataFetchTime}ms exceeds budget ${budget.maxDataFetchTime}ms`
			);
		}

		if (metrics.memoryUsage > budget.maxMemoryUsage) {
			violations.push(
				`Memory usage ${metrics.memoryUsage}MB exceeds budget ${budget.maxMemoryUsage}MB`
			);
		}

		if (metrics.frameRate > 0 && metrics.frameRate < budget.minFrameRate) {
			violations.push(
				`Frame rate ${metrics.frameRate}fps below budget ${budget.minFrameRate}fps`
			);
		}

		return {
			passed: violations.length === 0,
			violations,
		};
	}, [metrics, budget]);

	const getMetrics = useCallback(() => metrics, [metrics]);

	const resetMetrics = useCallback(() => {
		setMetrics({
			renderTime: 0,
			dataFetchTime: 0,
			memoryUsage: 0,
			frameRate: 0,
			interactions: 0,
		});
		performanceMarks.current.clear();
	}, []);

	return {
		startTracking,
		stopTracking,
		measureRender,
		updateMemoryUsage,
		trackFrameRate,
		trackInteraction,
		validatePerformanceBudget,
		getMetrics,
		resetMetrics,
		metrics,
	};
};
