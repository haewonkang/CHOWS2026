const { callEmuseum } = require('./_shared');

module.exports = async function handler(req, res) {
  const id = String(req.query.id || '').trim();
  if (!/^PS01001001\d{5,20}$/.test(id)) {
    res.status(400).json({ message: '목록 결과의 실제 국립중앙박물관 API ID를 사용해 주세요.' });
    return;
  }
  return callEmuseum(req, res, 'detail', { id });
};
