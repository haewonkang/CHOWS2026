const ENDPOINT = 'https://apis.data.go.kr/1371027/openapi';
const MUSEUM_CODE = 'PS01001001';

const cache = new Map();
let nextCallAt = 0;

function send(res, status, data) {
  res.status(status);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.json(data);
}

function cleanKey() {
  let key = (process.env.EMUSEUM_SERVICE_KEY || 'tO6A5Foq99Ups0%2FufDEOL5pSFIo%2FaLaSdTf5JhhTh3hk0a56OYz7f62ZWhKM8iacVeMeCco6MxPwRdueXQw2iQ%3D%3D').trim();
  if (!key) return '';
  try {
    return key.includes('%') ? decodeURIComponent(key) : key;
  } catch {
    throw new Error('EMUSEUM_SERVICE_KEY encoding is invalid');
  }
}

function responseCode(xml) {
  return xml.match(/<(?:returnReasonCode|resultCode)>\s*([^<]+)\s*</i)?.[1]?.trim() || '';
}

function redact(xml, key) {
  let value = xml.replace(/<params\b[^>]*>[\s\S]*?<\/params>/gi, '<params/>');
  if (key) value = value.replaceAll(key, 'REDACTED').replaceAll(encodeURIComponent(key), 'REDACTED');
  return value;
}

async function callEmuseum(req, res, method, params) {
  if (req.method !== 'GET') return send(res, 405, { message: 'GET 요청만 지원합니다.' });

  let key;
  try {
    key = cleanKey();
  } catch (error) {
    return send(res, 500, { message: error.message });
  }
  if (!key) return send(res, 503, { message: 'Vercel 환경변수 EMUSEUM_SERVICE_KEY를 설정해 주세요.' });

  const cacheKey = method + '?' + new URLSearchParams(params).toString();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return send(res, 200, { xml: cached.xml, cached: true });

  if (Date.now() < nextCallAt) return send(res, 429, { message: '잠시 뒤 다시 검색해 주세요. API 호출 간격은 최소 1초입니다.' });
  nextCallAt = Date.now() + 1000;

  const url = new URL(`${ENDPOINT}/${method}`);
  url.search = new URLSearchParams({ serviceKey: key, ...params }).toString();

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(20000) });
    const raw = await upstream.text();
    const code = responseCode(raw);
    if (upstream.status === 429 || code === '22') {
      return send(res, 429, { code: code || '22', message: '공공 API 일일 요청 한도를 초과했습니다. data.go.kr 활용신청의 트래픽 상태를 확인해 주세요.' });
    }
    if (!upstream.ok || (code && !['0', '00', '0000'].includes(code))) {
      return send(res, 502, { code: code || String(upstream.status), message: `공공 API가 오류를 반환했습니다. 코드 ${code || upstream.status}` });
    }
    const xml = redact(raw, key);
    cache.set(cacheKey, { xml, expires: Date.now() + 86400000 });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return send(res, 200, { xml, cached: false });
  } catch {
    return send(res, 502, { message: 'API 연결에 실패했습니다. Vercel 환경변수와 공공 API 상태를 확인해 주세요.' });
  }
}

module.exports = { callEmuseum, MUSEUM_CODE };
