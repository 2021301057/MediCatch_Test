#!/usr/bin/env node
/**
 * 병원 좌표 재지오코딩 스크립트 (일회성 배치)
 *
 * 공공데이터의 cxVl/cyVl은 주소 대표점 기준이라 카카오지도의 건물 위치와
 * 수십 m 어긋날 수 있다. 카카오 Local API로 주소(실패 시 병원명 키워드)를
 * 다시 지오코딩해서 hospitals 테이블의 cxVl/cyVl만 덮어쓴다.
 *
 * 사용법:
 *   cd tools && npm install mysql2
 *   KAKAO_REST_KEY=발급받은_REST_API_키 node regeocode.js
 *
 * 선택 환경변수 (기본값은 로컬 개발 DB 기준):
 *   DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=1234 DB_NAME=medicatch_health
 *   DRY_RUN=1  → DB를 갱신하지 않고 변환 결과만 출력
 */
const mysql = require('mysql2/promise');

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';
const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'medicatch_health',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function kakaoGet(path, query, extra = '') {
  const url = `https://dapi.kakao.com/v2/local/search/${path}.json?query=${encodeURIComponent(query)}&size=1${extra}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } });
  if (res.status === 429) { // 쿼터 초과 시 잠시 대기 후 1회 재시도
    await sleep(1000);
    return kakaoGet(path, query, extra);
  }
  if (!res.ok) throw new Error(`카카오 API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const doc = data.documents?.[0];
  return doc ? { x: Number(doc.x), y: Number(doc.y) } : null;
}

/** "의료법인 ○○재단", "학교법인)" 같은 접두어를 떼고 핵심 병원명만 남긴다 */
function cleanName(name) {
  return name
    .replace(/^[^)]*\)\s*/, '')                       // "학교법인)동의병원" → "동의병원"
    .replace(/^(의료법인|학교법인|재단법인|사회복지법인)\s*\S*?(의료재단|학원|재단|복지재단)\s*/g, '')
    .replace(/\(.*?\)/g, ' ')
    .trim();
}

/**
 * 1) 주소를 좌표로 변환해 기준점 확보
 * 2) 기준점 반경 2km 안에서 병원명 키워드(장소) 검색 → 건물 POI 좌표 (가장 정확)
 * 3) 장소가 안 잡히면 주소 좌표라도 사용
 * 반경 제한을 두는 이유: 동명 병원(분원 등)이 다른 지역에 매칭되는 사고 방지
 */
async function geocode(hospital) {
  const name = cleanName(hospital.hmcNm);
  let base = null;
  if (hospital.locAddr) {
    base = await kakaoGet('address', hospital.locAddr);
  }
  if (base) {
    // 정확도순(기본) + 병원 카테고리(HP8) 필터: 거리순으로 하면 병원 이름이 들어간
    // 주차장·충전소·장례식장 같은 부속 POI가 본관보다 가까워서 잘못 잡힌다
    const nearby = await kakaoGet('keyword', name, `&x=${base.x}&y=${base.y}&radius=2000&category_group_code=HP8`);
    if (nearby) return { ...nearby, method: '장소' };
    return { ...base, method: '주소' };
  }
  // 주소 변환 자체가 실패한 경우: 전국 키워드 검색 (지역 한정 불가하니 최후 수단)
  const byKeyword = await kakaoGet('keyword', name, '&category_group_code=HP8');
  if (byKeyword) return { ...byKeyword, method: '키워드(전국)' };
  return null;
}

async function main() {
  if (!KAKAO_REST_KEY) {
    console.error('KAKAO_REST_KEY 환경변수가 필요합니다. (카카오 콘솔의 REST API 키)');
    process.exit(1);
  }

  const conn = await mysql.createConnection(DB);
  const [rows] = await conn.execute(
    'SELECT id, `hmcNm`, `locAddr`, `cxVl`, `cyVl` FROM hospitals'
  );
  console.log(`대상 병원 ${rows.length}곳${DRY_RUN ? ' (DRY RUN — DB 갱신 안 함)' : ''}\n`);

  let updated = 0, failed = 0;
  for (const h of rows) {
    try {
      const result = await geocode(h);
      if (!result) {
        failed++;
        console.log(`  [실패] #${h.id} ${h.hmcNm} — 주소/키워드 모두 매칭 안 됨`);
        continue;
      }
      const moved = (h.cxVl != null && h.cyVl != null)
        ? `(기존 대비 Δx=${(result.x - h.cxVl).toFixed(6)}, Δy=${(result.y - h.cyVl).toFixed(6)})`
        : '(기존 좌표 없음)';
      if (!DRY_RUN) {
        await conn.execute(
          'UPDATE hospitals SET `cxVl` = ?, `cyVl` = ? WHERE id = ?',
          [result.x, result.y, h.id]
        );
      }
      updated++;
      console.log(`  [${result.method}] #${h.id} ${h.hmcNm} → ${result.x}, ${result.y} ${moved}`);
      await sleep(50); // 초당 호출 제한 여유
    } catch (e) {
      failed++;
      console.log(`  [에러] #${h.id} ${h.hmcNm} — ${e.message}`);
    }
  }

  await conn.end();
  console.log(`\n완료: 갱신 ${updated}곳 / 실패 ${failed}곳`);
}

main().catch((e) => { console.error(e); process.exit(1); });
