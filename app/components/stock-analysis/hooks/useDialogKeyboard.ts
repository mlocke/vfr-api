"use client";

import { useEffect, useCallback, RefObject } from "react";

interface KeyboardConfig {
	enableEscapeClose?: boolean;
	enableTabNavigation?: boolean;
	enableArrowNavigation?: boolean;
	trapFocus?: boolean;
	returnFocusOnClose?: boolean;
}

interface KeyboardActions {
	onRefresh?: () => void;
	onToggleInsights?: () => void;
	onToggleRisks?: () => void;
	onClose?: () => void;
}

const DEFAULT_CONFIG: KeyboardConfig = {
	enableEscapeClose: true,
	enableTabNavigation: true,
	enableArrowNavigation: true,
	trapFocus: true,
	returnFocusOnClose: true,
};

export const useDialogKeyboard = (
	isOpen: boolean,
	onClose: () => void,
	dialogRef: RefObject<HTMLDivElement>,
	actions: KeyboardActions = {},
	config: KeyboardConfig = DEFAULT_CONFIG
) => {
	const { onRefresh, onToggleInsights, onToggleRisks } = actions;
	const previousActiveElement = useCallback(() => {
		return document.activeElement as HTMLElement;
	}, []);

	// Handle keyboard events
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (!isOpen) return;

			const { key, ctrlKey, metaKey, shiftKey, altKey } = event;

			switch (key) {
				case "Escape":
					if (config.enableEscapeClose) {
						event.preventDefault();
						onClose();
					}
					break;

				case "Tab":
					if (config.enableTabNavigation && config.trapFocus) {
						handleTabNavigation(event, dialogRef.current);
					}
					break;

				case "F5":
				case "r":
					if ((ctrlKey || metaKey) && onRefresh) {
						event.preventDefault();
						onRefresh();
					}
					break;

				case "i":
					if ((ctrlKey || metaKey) && onToggleInsights) {
						event.preventDefault();
						onToggleInsights();
					}
					break;

				case "o":
					if ((ctrlKey || metaKey) && onToggleRisks) {
						event.preventDefault();
						onToggleRisks();
					}
					break;

				case "ArrowDown":
				case "ArrowUp":
					if (config.enableArrowNavigation) {
						event.preventDefault();
						handleArrowNavigation(event, dialogRef.current);
					}
					break;

				default:
					break;
			}
		},
		[isOpen, onClose, onRefresh, onToggleInsights, onToggleRisks, config, dialogRef]
	);

	// Handle tab navigation with focus trapping
	const handleTabNavigation = (event: KeyboardEvent, container: HTMLElement | null) => {
		if (!container) return;

		const focusableElements = container.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		) as NodeListOf<HTMLElement>;

		const focusableArray = Array.from(focusableElements);
		const firstElement = focusableArray[0];
		const lastElement = focusableArray[focusableArray.length - 1];

		if (focusableArray.length === 0) return;

		if (event.shiftKey) {
			// Shift + Tab (backward)
			if (document.activeElement === firstElement) {
				event.preventDefault();
				lastElement.focus();
			}
		} else {
			// Tab (forward)
			if (document.activeElement === lastElement) {
				event.preventDefault();
				firstElement.focus();
			}
		}
	};

	// Handle arrow key navigation
	const handleArrowNavigation = (event: KeyboardEvent, container: HTMLElement | null) => {
		if (!container) return;

		const interactiveElements = container.querySelectorAll(
			'button, [role="button"], [tabindex]:not([tabindex="-1"])'
		) as NodeListOf<HTMLElement>;

		const elementsArray = Array.from(interactiveElements);
		const currentIndex = elementsArray.indexOf(document.activeElement as HTMLElement);

		if (currentIndex === -1) return;

		let nextIndex: number;

		if (event.key === "ArrowDown") {
			nextIndex = (currentIndex + 1) % elementsArray.length;
		} else {
			nextIndex = currentIndex === 0 ? elementsArray.length - 1 : currentIndex - 1;
		}

		elementsArray[nextIndex].focus();
	};

	// Set up keyboard event listeners
	useEffect(() => {
		if (!isOpen) return;

		let originalActiveElement: HTMLElement | null = null;

		// Store the originally focused element
		if (config.returnFocusOnClose) {
			originalActiveElement = document.activeElement as HTMLElement;
		}

		// Focus the dialog when it opens
		if (dialogRef.current && config.trapFocus) {
			const firstFocusable = dialogRef.current.querySelector(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			) as HTMLElement;

			if (firstFocusable) {
				// Small delay to ensure the dialog is rendered
				setTimeout(() => firstFocusable.focus(), 100);
			} else {
				// Focus the dialog container if no focusable elements
				dialogRef.current.focus();
			}
		}

		// Add keyboard event listener
		document.addEventListener("keydown", handleKeyDown, { passive: false });

		// Prevent scrolling on the body when dialog is open
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		// Cleanup function
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = originalOverflow;

			// Return focus to original element
			if (config.returnFocusOnClose && originalActiveElement) {
				setTimeout(() => {
					if (
						originalActiveElement &&
						typeof originalActiveElement.focus === "function"
					) {
						originalActiveElement.focus();
					}
				}, 100);
			}
		};
	}, [isOpen, handleKeyDown, dialogRef, config]);

	// Keyboard accessibility properties for the dialog
	const keyboardProps = {
		role: "dialog" as const,
		"aria-modal": true,
		tabIndex: -1,
		onKeyDown: (event: React.KeyboardEvent) => {
			// Handle React synthetic events
			const nativeEvent = event.nativeEvent as KeyboardEvent;
			handleKeyDown(nativeEvent);
		},
	};

	// Helper function to focus the first element
	const focusFirstElement = useCallback(() => {
		if (!dialogRef.current) return;

		const firstFocusable = dialogRef.current.querySelector(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		) as HTMLElement;

		if (firstFocusable) {
			firstFocusable.focus();
		}
	}, [dialogRef]);

	// Helper function to focus the last element
	const focusLastElement = useCallback(() => {
		if (!dialogRef.current) return;

		const focusableElements = dialogRef.current.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		) as NodeListOf<HTMLElement>;

		const lastElement = focusableElements[focusableElements.length - 1];
		if (lastElement) {
			lastElement.focus();
		}
	}, [dialogRef]);

	return {
		keyboardProps,
		focusFirstElement,
		focusLastElement,
	};
};
