/**
 * Frontend Analysis Request Types
 * Zod schemas and TypeScript interfaces for frontend-backend API communication
 */

import { z } from "zod";

// Zod schema for request validation
export const FrontendAnalysisRequestSchema = z
	.object({
		mode: z.enum(["single", "sector", "multiple"]),
		symbols: z
			.array(
				z
					.string()
					.min(1)
					.max(5)
					.regex(/^[A-Z0-9]{1,5}$/)
			)
			.optional(),
		sector: z.string().min(1).max(50).optional(),
		limit: z.number().min(1).max(50).default(10),
		config: z
			.object({
				writeToFile: z.boolean().default(true),
				includeMetadata: z.boolean().default(true),
				timeout: z.number().min(1000).max(300000).default(30000), // 30 seconds default
				preferredDataSources: z.array(z.string()).optional(),
			})
			.optional()
			.default({
				writeToFile: true,
				includeMetadata: true,
				timeout: 30000,
			}),
	})
	.refine(
		data => {
			// Validation rules based on mode
			switch (data.mode) {
				case "single":
					return data.symbols && data.symbols.length === 1;
				case "sector":
					return !!data.sector;
				case "multiple":
					return (
						data.symbols &&
						data.symbols.length >= 1 &&
						data.symbols.length <= data.limit
					);
				default:
					return false;
			}
		},
		{
			message:
				"Invalid request: single mode requires one symbol, sector mode requires sector name, multiple mode requires 1-50 symbols",
			path: ["mode"],
		}
	);

// TypeScript interfaces derived from schemas
export type FrontendAnalysisRequest = z.infer<typeof FrontendAnalysisRequestSchema>;

export interface FrontendAnalysisResponse {
	success: boolean;
	data?: {
		analysis: any;
		fileInfo?: {
			filename: string;
			filepath: string;
			size: number;
			timestamp: number;
		};
		metadata: {
			mode: string;
			count: number;
			processingTime: number;
			timestamp: number;
			sources: string[];
			serviceHealth: Record<string, boolean>;
			cacheInfo?: {
				hit: boolean;
				key?: string;
				ttl?: number;
			};
		};
	};
	error?: {
		message: string;
		code: string;
		details?: Record<string, any>;
	};
}

export interface AnalysisFileMetadata {
	analysisType: string;
	mode: "single" | "sector" | "multiple";
	symbols?: string[];
	sector?: string;
	timestamp: number;
	processingTime: number;
	dataSourcesUsed: string[];
	serviceHealthSnapshot: Record<string, boolean>;
	resultCount: number;
	fileVersion: string;
	apiVersion: string;
}

export interface FileCleanupConfig {
	maxFiles: number;
	maxAgeDays: number;
	retainLatest: boolean;
	cleanupIntervalHours: number;
}
