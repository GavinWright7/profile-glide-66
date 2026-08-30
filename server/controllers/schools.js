const schoolService = require('../services/schoolService');

async function searchSchools(req, res) {
  const q = req.query.q != null ? String(req.query.q) : '';
  if (q.trim().length < 1) {
    return res.json([]);
  }
  try {
    const schools = await schoolService.searchSchools(q, 15);
    res.json(schools);
  } catch (err) {
    console.error('[schools] search error:', err.message);
    res.status(500).json({ error: 'Failed to search schools' });
  }
}

module.exports = { searchSchools };
