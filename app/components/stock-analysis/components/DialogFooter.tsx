"use client";

import React from "react";

interface DialogFooterProps {
	lastUpdated: number;
	onAction?: (action: "BUY" | "SELL" | "HOLD") => void;
	symbol: string;
	recommendation: "BUY" | "SELL" | "HOLD";
	onClose: () => void;
}

const ActionButton: React.FC<{
	action: "BUY" | "SELL" | "HOLD";
	isRecommended: boolean;
	onClick: () => void;
	disabled?: boolean;
	symbol: string;
}> = ({ action, isRecommended, onClick, disabled = false, symbol }) => {
	const getActionStyles = () => {
		const baseStyles = {
			padding: "0.75rem 1.25rem",
			borderRadius: "10px",
			fontSize: "0.95rem",
			fontWeight: "600",
			cursor: disabled ? "not-allowed" : "pointer",
			transition: "all 0.2s ease",
			border: "2px solid transparent",
			position: "relative" as const,
			overflow: "hidden" as const,
			minWidth: "80px",
			textAlign: "center" as const,
		};

		if (disabled) {
			return {
				...baseStyles,
				background: "rgba(100, 100, 100, 0.3)",
				color: "rgba(255, 255, 255, 0.4)",
				cursor: "not-allowed",
			};
		}

		if (isRecommended) {
			const recommendedStyles = {
				BUY: {
					...baseStyles,
					background:
						"linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))",
					color: "white",
					border: "2px solid rgba(0, 200, 83, 0.5)",
					boxShadow: "0 4px 12px rgba(0, 200, 83, 0.3)",
				},
				SELL: {
					...baseStyles,
					background:
						"linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(200, 40, 40, 0.9))",
					color: "white",
					border: "2px solid rgba(239, 68, 68, 0.5)",
					boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
				},
				HOLD: {
					...baseStyles,
					background:
						"linear-gradient(135deg, rgba(255, 193, 7, 0.9), rgba(200, 150, 0, 0.9))",
					color: "white",
					border: "2px solid rgba(255, 193, 7, 0.5)",
					boxShadow: "0 4px 12px rgba(255, 193, 7, 0.3)",
				},
			};
			return recommendedStyles[action];
		}

		return {
			...baseStyles,
			background: "rgba(255, 255, 255, 0.1)",
			color: "rgba(255, 255, 255, 0.8)",
			border: "2px solid rgba(255, 255, 255, 0.2)",
			backdropFilter: "blur(10px)",
		};
	};

	const styles = getActionStyles();

	return (
		<button
			style={styles}
			onClick={onClick}
			disabled={disabled}
			onMouseEnter={e => {
				if (disabled) return;

				if (isRecommended) {
					e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
					if (action === "BUY") {
						e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 200, 83, 0.4)";
					} else if (action === "SELL") {
						e.currentTarget.style.boxShadow = "0 6px 16px rgba(239, 68, 68, 0.4)";
					} else {
						e.currentTarget.style.boxShadow = "0 6px 16px rgba(255, 193, 7, 0.4)";
					}
				} else {
					e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
					e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
					e.currentTarget.style.transform = "translateY(-1px)";
				}
			}}
			onMouseLeave={e => {
				if (disabled) return;

				if (isRecommended) {
					e.currentTarget.style.transform = "translateY(0) scale(1)";
					if (action === "BUY") {
						e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 200, 83, 0.3)";
					} else if (action === "SELL") {
						e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
					} else {
						e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 193, 7, 0.3)";
					}
				} else {
					e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
					e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
					e.currentTarget.style.transform = "translateY(0)";
				}
			}}
			aria-label={`${action} ${symbol} ${isRecommended ? "(recommended)" : ""}`}
		>
			{/* Shimmer effect for recommended actions */}
			{isRecommended && (
				<div
					style={{
						position: "absolute",
						top: 0,
						left: "-100%",
						width: "100%",
						height: "100%",
						background:
							"linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)",
						animation: "shimmer 2s infinite",
					}}
				/>
			)}

			<span style={{ position: "relative", zIndex: 1 }}>
				{action}
				{isRecommended && (
					<span
						style={{
							fontSize: "0.7rem",
							display: "block",
							opacity: 0.9,
							marginTop: "2px",
						}}
					>
						Recommended
					</span>
				)}
			</span>
		</button>
	);
};

const DialogFooter: React.FC<DialogFooterProps> = ({
	lastUpdated,
	onAction,
	symbol,
	recommendation,
	onClose,
}) => {
	const formatTimeAgo = (timestamp: number): string => {
		const now = Date.now();
		const diff = now - timestamp;

		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) return "Just now";
		if (minutes < 60) return `${minutes} min ago`;
		if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
		return `${days}d ${hours % 24}h ago`;
	};

	const handleActionClick = (action: "BUY" | "SELL" | "HOLD") => {
		if (onAction) {
			onAction(action);
		}
	};

	const formatLastUpdated = (timestamp: number): string => {
		const date = new Date(timestamp);
		const time = date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
		return `${formatTimeAgo(timestamp)} at ${time}`;
	};

	return (
		<>
			<style jsx>{`
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        .footer-container {
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          margin-top: 2rem;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .timestamp-section {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }

        .last-updated {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        .refresh-note {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
          font-style: italic;
        }

        .actions-section {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .action-buttons {
          display: flex;
          gap: 0.75rem;
        }

        .close-only-section {
          display: flex;
          justify-content: center;
          width: 100%;
          padding-top: 1rem;
        }

        .close-button {
          background: rgba(255, 255, 255, 0.1);
          backdropFilter: 'blur(10px)',
          color: 'rgba(255, 255, 255, 0.8)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '10px',
          padding: '0.75rem 1.5rem',
          fontSize: '0.95rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.15);
          borderColor: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }

        .close-button:focus {
          outline: 2px solid rgba(255, 255, 255, 0.5);
          outline-offset: 2px;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .footer-content {
            flex-direction: column;
            align-items: stretch;
            gap: 1.5rem;
          }

          .timestamp-section {
            align-items: center;
            text-align: center;
          }

          .actions-section {
            justify-content: center;
          }

          .action-buttons {
            flex-wrap: wrap;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .action-buttons {
            flex-direction: column;
            width: 100%;
            gap: 0.5rem;
          }

          .action-buttons button {
            width: 100%;
          }

          .footer-container {
            padding-top: 1.5rem;
          }
        }
      `}</style>

			<footer className="footer-container">
				{onAction ? (
					// Full footer with actions
					<div className="footer-content">
						{/* Timestamp Section */}
						<div className="timestamp-section">
							<p className="last-updated">
								Last updated: {formatLastUpdated(lastUpdated)}
							</p>
							<p className="refresh-note">
								Data refreshes automatically every 2 minutes
							</p>
						</div>

						{/* Action Buttons Section */}
						<div className="actions-section">
							<div
								className="action-buttons"
								role="group"
								aria-label="Investment actions"
							>
								<ActionButton
									action="BUY"
									isRecommended={recommendation === "BUY"}
									onClick={() => handleActionClick("BUY")}
									symbol={symbol}
								/>
								<ActionButton
									action="HOLD"
									isRecommended={recommendation === "HOLD"}
									onClick={() => handleActionClick("HOLD")}
									symbol={symbol}
								/>
								<ActionButton
									action="SELL"
									isRecommended={recommendation === "SELL"}
									onClick={() => handleActionClick("SELL")}
									symbol={symbol}
								/>
							</div>
						</div>
					</div>
				) : (
					// Simple footer with timestamp and close button
					<div>
						<div style={{ textAlign: "center", marginBottom: "1rem" }}>
							<p className="last-updated">
								Last updated: {formatLastUpdated(lastUpdated)}
							</p>
							<p className="refresh-note">Analysis based on real-time market data</p>
						</div>

						<div className="close-only-section">
							<button
								className="close-button"
								onClick={onClose}
								aria-label="Close dialog"
							>
								Close Analysis
							</button>
						</div>
					</div>
				)}

				{/* Disclaimer */}
				<div
					style={{
						marginTop: "1.5rem",
						padding: "1rem",
						background: "rgba(255, 255, 255, 0.02)",
						borderRadius: "8px",
						border: "1px solid rgba(255, 255, 255, 0.05)",
					}}
				>
					<p
						style={{
							fontSize: "0.75rem",
							color: "rgba(255, 255, 255, 0.5)",
							margin: 0,
							textAlign: "center",
							lineHeight: "1.4",
						}}
					>
						<strong>Disclaimer:</strong> This analysis is for educational and
						informational purposes only. Not financial advice. Past performance does not
						guarantee future results. Always conduct your own research and consult with
						a financial advisor.
					</p>
				</div>
			</footer>
		</>
	);
};

export { DialogFooter };
export default DialogFooter;
