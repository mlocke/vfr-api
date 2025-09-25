# Analysis Results Directory

This directory stores JSON output files from stock analysis operations performed by the VFR API's frontend-backend wiring system.

## File Structure

- `analysis-{timestamp}-{mode}-{hash}.json` - Individual analysis result files
- `latest-analysis.json` - Symlink to the most recent analysis file

## File Format

Each analysis file contains:

```json
{
  "metadata": {
    "analysisType": "stock-analysis",
    "mode": "single|sector|multiple",
    "symbols": ["AAPL", "TSLA"],
    "sector": "Technology",
    "timestamp": 1699123456789,
    "processingTime": 2500,
    "dataSourcesUsed": ["Polygon", "Alpha Vantage"],
    "serviceHealthSnapshot": {
      "technical": true,
      "sentiment": true,
      "macroeconomic": false
    },
    "resultCount": 2,
    "fileVersion": "1.0",
    "apiVersion": "1.0.0"
  },
  "analysis": {
    "stocks": [...],
    "metadata": {...}
  }
}
```

## Automatic Cleanup

Files are automatically cleaned up by the FileCleanupService based on:

- **Maximum File Count**: Configurable via `ANALYSIS_FILE_MAX_COUNT` (default: 100)
- **Maximum Age**: Configurable via `ANALYSIS_FILE_MAX_AGE_DAYS` (default: 30 days)
- **Latest File Retention**: Always retains the most recent file
- **Cleanup Interval**: Runs every `ANALYSIS_FILE_CLEANUP_INTERVAL_HOURS` (default: 24)

## Environment Configuration

```env
# File management settings
ANALYSIS_FILE_MAX_COUNT=100
ANALYSIS_FILE_MAX_AGE_DAYS=30
ANALYSIS_FILE_RETAIN_LATEST=true
ANALYSIS_FILE_CLEANUP_INTERVAL_HOURS=24
```

## Security Features

- Atomic file writing to prevent corruption
- JSON validation before writing
- Path traversal protection
- Malicious content detection
- File size limits (10MB max)
- Secure file permissions (644)

## Usage

Files are generated automatically when calling the `/api/stocks/analysis-frontend` endpoint with `writeToFile: true` in the request configuration.