require('dotenv').config({ path: './.env' });
console.log("DB_USER =", process.env.DB_USER);
console.log("DB_NAME =", process.env.DB_NAME);

const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

// ===== Pool配置 =====
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD
});

pool.on('error', (err) => {
  console.error('Pool idle error:', err);
});

// 启动时测试数据库连通性
pool.query('SELECT NOW()')
.then(res => {
  console.log('✅ DB Connected, timestamp:', res.rows[0].now);
})
.catch(err => {
  console.error('❌ DB Connection Error:', err);
});
// =====================

app.get('/api/test', (req, res) => {
  res.json({message: "server alive"});
});

app.get('/api/schools', async (req, res) => {
  const scenario = req.query.scenario || 'Q200';
  const floodTable = scenario === 'QBHF' ? '"public"."flood_extent_QBHF"' : '"public"."flood_extent_Q200"';
  try {
    const result = await pool.query(`
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(ST_Transform(s.geom,4326))::jsonb,
            'properties', jsonb_build_object(
              'id', s.id,
              'skola', s.skola,
              'adress', s.adress,
              'postort', s.postort,
              'is_flooded', EXISTS(
                SELECT 1 FROM ${floodTable} f
                WHERE ST_Intersects(s.geom, f.geom)
              )
            )
          )
        ), '[]'::jsonb)
      ) AS geojson
      FROM public.schools s
      GROUP BY s.id, s.skola, s.adress, s.postort, s.geom;
    `);
    res.json(result.rows[0].geojson);
  } catch (err) {
    console.error('schools api error:', err);
    res.status(500).json({error:"Failed to fetch schools"});
  }
});

// Flood 洪水图层（修复：JS层选择表名）
app.get('/api/flood', async (req, res) => {
  const scenario = req.query.scenario || 'Q200';
  const tableName = scenario === 'QBHF' ? '"public"."flood_extent_QBHF"' : '"public"."flood_extent_Q200"';
  try {
    const result = await pool.query(`
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(ST_Transform(geom,4326))::jsonb
          )
        ), '[]'::jsonb)
      ) AS geojson
      FROM ${tableName};
    `);
    res.json(result.rows[0].geojson);
  } catch (err) {
    console.error('flood api error:', err);
    res.status(500).json({error:"Failed to fetch flood zone"});
  }
});

// Stats 统计接口（修复：JS层选择表名）
app.get('/api/stats', async (req, res) => {
  const scenario = req.query.scenario || 'Q200';
  const tableName = scenario === 'QBHF' ? '"public"."flood_extent_QBHF"' : '"public"."flood_extent_Q200"';
  try {
    const result = await pool.query(`
      SELECT COUNT(DISTINCT s.id) as flooded_school_count
      FROM public.schools s
      JOIN ${tableName} f
      ON ST_Intersects(s.geom, f.geom);
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('stats api error:', err);
    res.status(500).json({error:"Failed to calculate statistics"});
  }
});

app.get('/api/floodedSchools', async (req, res) => {
  const scenario = req.query.scenario || 'Q200';
  const tableName = scenario === 'QBHF' ? '"public"."flood_extent_QBHF"' : '"public"."flood_extent_Q200"';
  try {
    const result = await pool.query(`
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(ST_Transform(s.geom,4326))::jsonb,
            'properties', jsonb_build_object(
              'id', s.id,
              'skola', s.skola,
              'adress', s.adress,
              'postort', s.postort
            )
          )
        ), '[]'::jsonb)
      ) AS geojson
      FROM public.schools s
      JOIN ${tableName} f
      ON ST_Intersects(s.geom, f.geom);
    `);
    res.json(result.rows[0].geojson);
  } catch (err) {
    console.error('flooded schools api error:', err);
    res.status(500).json({error:"Failed to fetch flooded schools"});
  }
});

// Buildings
app.get('/api/buildings', async (req, res)=>{
  try{
    const result = await pool.query(`
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature',
            'geometry', ST_AsGeoJSON(ST_Transform(geom,4326))::jsonb,
            'properties', jsonb_build_object('id',id)
          )
        ),'[]'::jsonb)
      ) AS geojson FROM buildings;
    `);
    res.json(result.rows[0].geojson);
  }catch(e){
    res.status(500).json({error:e.message})
  }
})

/// ---------------- /api/roads （表名 roads） ----------------
app.get('/api/roads', async (req, res)=>{
  try{
    const result = await pool.query(`
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature',
            'geometry', ST_AsGeoJSON(ST_Transform(geom,4326))::jsonb,
            'properties', jsonb_build_object()
          )
        ),'[]'::jsonb)
      ) AS geojson FROM roads;
    `);
    res.json(result.rows[0].geojson);
  }catch(e){
    res.status(500).json({error:e.message})
  }
})

// ---------------- /api/bus （bus_stops） ----------------
// ---------------- /api/bus_stops ----------------
app.get('/api/bus_stops', async (req, res)=>{
  try{
    const result = await pool.query(`
      SELECT jsonb_build_object(
        'type','FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type','Feature',
            'geometry', ST_AsGeoJSON(ST_Transform(geom,4326))::jsonb,
            'properties', jsonb_build_object()
          )
        ),'[]'::jsonb)
      ) AS geojson FROM bus_stops;
    `);
    res.json(result.rows[0].geojson);
  }catch(e){
    res.status(500).json({error:e.message})
  }
})

app.get('/api/stats', async (req, res) => {
  const scenario = req.query.scenario || 'Q200';
  const floodTable = scenario === 'QBHF' ? '"public"."flood_extent_QBHF"' : '"public"."flood_extent_Q200"';
  try {
    const sql = `
    SELECT
        (SELECT COUNT(*) FROM public.schools s
         WHERE EXISTS (SELECT 1 FROM ${floodTable} f WHERE ST_Intersects(s.geom, f.geom))) AS flooded_schools,
        (SELECT COUNT(*) FROM public.bus_stops b
         WHERE EXISTS (SELECT 1 FROM ${floodTable} f WHERE ST_Intersects(b.geom, f.geom))) AS affected_bus,
        (SELECT COUNT(*) FROM public.buildings b
         WHERE EXISTS (SELECT 1 FROM ${floodTable} f WHERE ST_Intersects(b.geom, f.geom))) AS affected_buildings
    `;
    const result = await pool.query(sql);
    const row = result.rows[0];
    res.json({
      floodedSchools: Number(row.flooded_schools),
      affectedBus: Number(row.affected_bus),
      affectedBuildings: Number(row.affected_buildings)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({error: 'query failed'});
  }
});


// ---------------- /api/water （你表里没有 natural_water_clean，先注释掉，后面再加） ----------------
// app.get('/api/water', async (req, res)=>{
//   try{
//     const result = await pool.query(`
//       SELECT jsonb_build_object(
//         'type','FeatureCollection',
//         'features', COALESCE(jsonb_agg(
//           jsonb_build_object(
//             'type','Feature',
//             'geometry', ST_AsGeoJSON(ST_Transform(geom,4326))::jsonb,
//             'properties', jsonb_build_object()
//           )
//         ),'[]'::jsonb)
//       ) AS geojson FROM natural_water_clean;
//     `);
//     res.json(result.rows[0].geojson);
//   }catch(e){
//     res.status(500).json({error:e.message})
//   }
// })


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
