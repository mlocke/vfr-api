import { Pool } from 'pg';

async function checkModels() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Get table schema
    const schema = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ml_models'
      ORDER BY ordinal_position
    `);

    console.log('ML Models Table Schema:');
    console.log(JSON.stringify(schema.rows, null, 2));

    const result = await pool.query(
      'SELECT * FROM ml_models ORDER BY created_at DESC LIMIT 1'
    );

    console.log('\nSample Model Record:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkModels();
