const { callEmuseum, MUSEUM_CODE } = require('./_shared');

module.exports = async function handler(req, res) {
  const name = String(req.query.name || '').trim();
  if (!name || name.length > 100) {
    res.status(400).json({ message: '검색어를 1~100자로 입력해 주세요.' });
    return;
  }
  return callEmuseum(req, res, 'list', {
    name,
    museumCode: MUSEUM_CODE,
    numOfRows: '20',
    pageNo: '1'
  });
};
