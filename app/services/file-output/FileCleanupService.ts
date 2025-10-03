/**
 * File Cleanup Service
 * Manages automatic cleanup of analysis result files
 * Implements scheduled cleanup with configurable retention policies
 */

import { promises as fs } from "fs";
import { join } from "path";
import { AnalysisFileWriter } from "./AnalysisFileWriter";
import type { FileCleanupConfig } from "../types/frontend-types";

interface CleanupStats {
	totalFiles: number;
	deletedFiles: number;
	retainedFiles: number;
	errors: string[];
	lastCleanup: Date;
}

export class FileCleanupService {
	private readonly fileWriter: AnalysisFileWriter;
	private cleanupTimer?: NodeJS.Timeout;
	private isRunning: boolean = false;
	private stats: CleanupStats = {
		totalFiles: 0,
		deletedFiles: 0,
		retainedFiles: 0,
		errors: [],
		lastCleanup: new Date(0),
	};

	private readonly defaultConfig: FileCleanupConfig = {
		maxFiles: 100,
		maxAgeDays: 30,
		retainLatest: true,
		cleanupIntervalHours: 24,
	};

	constructor(outputDir?: string) {
		this.fileWriter = new AnalysisFileWriter(outputDir);
	}

	/**
	 * Start automatic cleanup service
	 */
	start(config: Partial<FileCleanupConfig> = {}): void {
		if (this.isRunning) {
			console.warn("FileCleanupService is already running");
			return;
		}

		const finalConfig = { ...this.defaultConfig, ...config };

		// Validate configuration
		this.validateConfig(finalConfig);

		this.isRunning = true;

		// Run initial cleanup
		this.performCleanup(finalConfig).catch(error => {
			console.error("Initial cleanup failed:", error);
		});

		// Schedule periodic cleanup
		const intervalMs = finalConfig.cleanupIntervalHours * 60 * 60 * 1000;

		this.cleanupTimer = setInterval(() => {
			this.performCleanup(finalConfig).catch(error => {
				console.error("Scheduled cleanup failed:", error);
			});
		}, intervalMs);

		console.log(
			`FileCleanupService started with cleanup interval: ${finalConfig.cleanupIntervalHours} hours`
		);
		console.log(
			`Configuration: maxFiles=${finalConfig.maxFiles}, maxAge=${finalConfig.maxAgeDays} days, retainLatest=${finalConfig.retainLatest}`
		);
	}

	/**
	 * Stop automatic cleanup service
	 */
	stop(): void {
		if (!this.isRunning) {
			console.warn("FileCleanupService is not running");
			return;
		}

		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = undefined;
		}

		this.isRunning = false;
		console.log("FileCleanupService stopped");
	}

	/**
	 * Perform manual cleanup with custom configuration
	 */
	async runCleanup(config: Partial<FileCleanupConfig> = {}): Promise<CleanupStats> {
		const finalConfig = { ...this.defaultConfig, ...config };
		this.validateConfig(finalConfig);

		return this.performCleanup(finalConfig);
	}

	/**
	 * Get cleanup statistics
	 */
	getStats(): CleanupStats {
		return { ...this.stats };
	}

	/**
	 * Get service status
	 */
	getStatus(): { isRunning: boolean; nextCleanup?: Date } {
		return {
			isRunning: this.isRunning,
			nextCleanup: this.cleanupTimer
				? new Date(Date.now() + this.defaultConfig.cleanupIntervalHours * 60 * 60 * 1000)
				: undefined,
		};
	}

	/**
	 * Perform the actual cleanup operation
	 */
	private async performCleanup(config: FileCleanupConfig): Promise<CleanupStats> {
		console.log("Starting file cleanup operation...");
		const startTime = Date.now();

		try {
			// Get list of analysis files
			const files = await this.fileWriter.listAnalysisFiles();
			this.stats.totalFiles = files.length;

			if (files.length === 0) {
				console.log("No analysis files found for cleanup");
				this.stats.lastCleanup = new Date();
				return this.stats;
			}

			console.log(`Found ${files.length} analysis files`);

			// Determine files to delete based on configuration
			const filesToDelete = this.selectFilesForDeletion(files, config);

			if (filesToDelete.length === 0) {
				console.log("No files meet cleanup criteria");
				this.stats.retainedFiles = files.length;
				this.stats.deletedFiles = 0;
				this.stats.lastCleanup = new Date();
				return this.stats;
			}

			console.log(`Deleting ${filesToDelete.length} files based on cleanup policy`);

			// Delete files and track results
			const deleteResults = await this.deleteFiles(filesToDelete);

			// Update statistics
			this.stats.deletedFiles = deleteResults.deleted;
			this.stats.retainedFiles = files.length - deleteResults.deleted;
			this.stats.errors = deleteResults.errors;
			this.stats.lastCleanup = new Date();

			const duration = Date.now() - startTime;
			console.log(
				`Cleanup completed in ${duration}ms: ${deleteResults.deleted} deleted, ${this.stats.retainedFiles} retained`
			);

			if (deleteResults.errors.length > 0) {
				console.warn(`Cleanup encountered ${deleteResults.errors.length} errors:`);
				deleteResults.errors.forEach(error => console.warn(`  - ${error}`));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown cleanup error";
			console.error("Cleanup operation failed:", errorMessage);
			this.stats.errors = [errorMessage];
		}

		return this.stats;
	}

	/**
	 * Select files for deletion based on cleanup policy
	 */
	private selectFilesForDeletion(
		files: { filename: string; size: number; created: Date }[],
		config: FileCleanupConfig
	): string[] {
		const now = new Date();
		const maxAge = config.maxAgeDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
		let filesToDelete: string[] = [];

		// Step 1: Mark files older than maxAge for deletion
		const oldFiles = files
			.filter(file => {
				const age = now.getTime() - file.created.getTime();
				return age > maxAge;
			})
			.map(f => f.filename);

		filesToDelete = [...oldFiles];

		// Step 2: If we still have too many files, delete oldest ones
		if (files.length > config.maxFiles) {
			const excess = files.length - config.maxFiles;

			// Sort files by creation time (oldest first for deletion)
			const sortedFiles = [...files].sort(
				(a, b) => a.created.getTime() - b.created.getTime()
			);

			// Take the oldest files for deletion
			const oldestFiles = sortedFiles.slice(0, excess).map(f => f.filename);

			// Combine with age-based deletions (use Set to avoid duplicates)
			filesToDelete = [...new Set([...filesToDelete, ...oldestFiles])];
		}

		// Step 3: Always retain the latest file if configured
		if (config.retainLatest && filesToDelete.length > 0 && files.length > 0) {
			// Sort files by creation time (newest first)
			const sortedFiles = [...files].sort(
				(a, b) => b.created.getTime() - a.created.getTime()
			);
			const latestFile = sortedFiles[0].filename;

			// Remove latest file from deletion list
			filesToDelete = filesToDelete.filter(filename => filename !== latestFile);
		}

		return filesToDelete;
	}

	/**
	 * Delete specified files and track results
	 */
	private async deleteFiles(filenames: string[]): Promise<{ deleted: number; errors: string[] }> {
		const outputDir = this.fileWriter.getOutputDirectory();
		let deleted = 0;
		const errors: string[] = [];

		for (const filename of filenames) {
			try {
				const filepath = join(outputDir, filename);
				await fs.unlink(filepath);
				deleted++;
				console.log(`Deleted: ${filename}`);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown delete error";
				const fullError = `Failed to delete ${filename}: ${errorMessage}`;
				errors.push(fullError);
				console.error(fullError);
			}
		}

		return { deleted, errors };
	}

	/**
	 * Validate cleanup configuration
	 */
	private validateConfig(config: FileCleanupConfig): void {
		if (config.maxFiles < 1) {
			throw new Error("maxFiles must be at least 1");
		}

		if (config.maxAgeDays < 1) {
			throw new Error("maxAgeDays must be at least 1");
		}

		if (config.cleanupIntervalHours < 1) {
			throw new Error("cleanupIntervalHours must be at least 1");
		}

		// Warn if config might be too aggressive
		if (config.maxFiles < 10 && config.retainLatest) {
			console.warn(
				"Warning: Very low maxFiles setting with retainLatest=true may cause frequent deletions"
			);
		}

		if (config.maxAgeDays < 7) {
			console.warn("Warning: Very low maxAgeDays setting may delete recent analysis files");
		}
	}

	/**
	 * Estimate cleanup impact without performing deletion
	 */
	async estimateCleanup(config: Partial<FileCleanupConfig> = {}): Promise<{
		totalFiles: number;
		filesToDelete: number;
		filesToRetain: number;
		estimatedSpaceFreed: number;
	}> {
		const finalConfig = { ...this.defaultConfig, ...config };
		this.validateConfig(finalConfig);

		const files = await this.fileWriter.listAnalysisFiles();
		const filesToDelete = this.selectFilesForDeletion(files, finalConfig);

		// Calculate estimated space to be freed
		const deleteFileObjects = files.filter(f => filesToDelete.includes(f.filename));
		const estimatedSpaceFreed = deleteFileObjects.reduce((total, file) => total + file.size, 0);

		return {
			totalFiles: files.length,
			filesToDelete: filesToDelete.length,
			filesToRetain: files.length - filesToDelete.length,
			estimatedSpaceFreed,
		};
	}
}

// Singleton instance for global use
export const fileCleanupService = new FileCleanupService();

// Auto-start cleanup service in production with default config
if (process.env.NODE_ENV === "production") {
	fileCleanupService.start({
		maxFiles: parseInt(process.env.ANALYSIS_FILE_MAX_COUNT || "100"),
		maxAgeDays: parseInt(process.env.ANALYSIS_FILE_MAX_AGE_DAYS || "30"),
		retainLatest: process.env.ANALYSIS_FILE_RETAIN_LATEST !== "false",
		cleanupIntervalHours: parseInt(process.env.ANALYSIS_FILE_CLEANUP_INTERVAL_HOURS || "24"),
	});

	// Graceful shutdown
	process.on("SIGTERM", () => {
		console.log("Stopping FileCleanupService due to SIGTERM");
		fileCleanupService.stop();
	});

	process.on("SIGINT", () => {
		console.log("Stopping FileCleanupService due to SIGINT");
		fileCleanupService.stop();
	});
}
