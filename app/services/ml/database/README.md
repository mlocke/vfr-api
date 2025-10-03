# ML Enhancement Store Database Service

Simple TypeScript service for CRUD operations on the `ml_enhancement_store` table, following KISS principles.

## Features

- **Store Enhancement**: Save ML enhancement data to database
- **Get Latest Enhancement**: Retrieve most recent enhancement for a ticker
- **Get Enhancements**: Retrieve enhancements within date ranges
- **Update with Actuals**: Update enhancement records when actual values are known
- **Cleanup**: Remove old enhancement records
- **Statistics**: Get performance statistics for enhancements

## Usage

```typescript
import { mlEnhancementStore, MLEnhancement } from "./MLEnhancementStore";

// Initialize the service
await mlEnhancementStore.initialize();

// Store an enhancement
const enhancement: MLEnhancement = {
	ticker: "AAPL",
	timestamp: new Date(),
	enhancement_id: "technical_1d_enhancement",
	base_vfr_value: 0.75,
	enhanced_value: 0.82,
	enhanced_composite_value: 0.785,
	confidence_score: 0.87,
	data_quality_score: 0.92,
	vfr_factor_name: "technical",
	enhancement_weight: 0.1,
	enhancement_latency_ms: 150,
	models_used: ["xgboost_v1", "lstm_v2"],
	fallback_mode: false,
	validation_status: "pending",
};

await mlEnhancementStore.storeEnhancement(enhancement);

// Get latest enhancement
const latest = await mlEnhancementStore.getLatestEnhancement("AAPL");

// Get enhancement statistics
const stats = await mlEnhancementStore.getEnhancementStats("AAPL", 30);
```

## Database Schema

Uses the existing `ml_enhancement_store` table from `database/migrations/ml_phase1_schema.sql`.

## Database Connection

Follows the same patterns as other database services in the VFR platform:

- Uses PostgreSQL with connection pooling
- Environment-based configuration
- Error handling and logging
- Health checks

## Integration

This service integrates with:

- Existing VFR analysis engine
- ML prediction services
- Performance monitoring
- Cache layer (when needed)

Keep it simple - focus on essential CRUD operations only.
