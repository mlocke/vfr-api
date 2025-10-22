/**
 * Register Sentiment-Fusion Model in PostgreSQL Database
 *
 * This script registers the sentiment-fusion model in the ml_models table
 * so it can be used by the RealTimePredictionEngine.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const MODEL_DIR = path.join(process.cwd(), 'models/sentiment-fusion/v1.5.0');
const METADATA_FILE = path.join(MODEL_DIR, 'metadata.json');
const TEST_EVAL_FILE = path.join(MODEL_DIR, 'test_evaluation.json');

async function registerModel() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Load metadata
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    const testEval = JSON.parse(fs.readFileSync(TEST_EVAL_FILE, 'utf-8'));

    console.log('📦 Registering sentiment-fusion model v1.5.0...');
    console.log(`📁 Model directory: ${MODEL_DIR}`);
    console.log(`✓ Validation accuracy: ${metadata.performance.validation_accuracy}`);
    console.log(`✓ Test accuracy: ${testEval.accuracy}`);

    // Check if model already exists
    const existing = await pool.query(
      'SELECT * FROM ml_models WHERE model_name = $1 AND model_version = $2',
      ['sentiment-fusion', '1.5.0']
    );

    if (existing.rows.length > 0) {
      console.log('⚠️  Model already exists. Updating...');

      const result = await pool.query(`
        UPDATE ml_models
        SET
          validation_score = $1,
          test_score = $2,
          status = $3,
          updated_at = NOW()
        WHERE model_name = $4 AND model_version = $5
        RETURNING *
      `, [
        testEval.accuracy,
        testEval.accuracy,
        'deployed',
        'sentiment-fusion',
        '1.5.0'
      ]);

      console.log('✅ Model updated successfully!');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('Creating new model registration...');

      const result = await pool.query(`
        INSERT INTO ml_models (
          model_name,
          model_version,
          model_type,
          objective,
          target_variable,
          prediction_horizon,
          validation_score,
          test_score,
          tier_requirement,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        'sentiment-fusion',
        '1.5.0',
        'lightgbm',
        'direction_classification',
        'price_direction',
        '3d',
        testEval.accuracy,
        testEval.accuracy,
        'premium',
        'deployed'
      ]);

      console.log('✅ Model registered successfully!');
      console.log(JSON.stringify(result.rows[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Registration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

registerModel().catch(console.error);
