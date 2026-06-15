USE medicatch_health;

-- 추가 검진기관 67건: 대구·울산·경북·경남·제주
-- 병원명+주소가 동일한 기존 행은 건너뛴다. 좌표는 regeocode.js로 후처리한다.
INSERT INTO hospitals (siDoCd, siGunGuCd, hmcNm, locAddr, hmcTelNo, cxVl, cyVl)
SELECT v.siDoCd, v.siGunGuCd, v.hmcNm, v.locAddr, v.hmcTelNo, v.cxVl, v.cyVl
FROM (
SELECT 27 AS siDoCd, 140 AS siGunGuCd, '강남종합병원' AS hmcNm, '대구광역시 동구 동촌로 207 강남병원 (방촌동)' AS locAddr, '053-980-9046' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 110 AS siGunGuCd, '계명대학교대구동산병원' AS hmcNm, '대구광역시 중구 달성로 56 계명대학교대구동산병원 (동산동)' AS locAddr, '053-250-8131' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 290 AS siGunGuCd, '계명대학교동산병원' AS hmcNm, '대구광역시 달서구 달구벌대로 1035 (신당동)' AS locAddr, '053-258-6401' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 110 AS siGunGuCd, '곽병원' AS hmcNm, '대구광역시 중구 국채보상로 531 (수동)' AS locAddr, '053-605-3785' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 290 AS siGunGuCd, '나사렛종합병원' AS hmcNm, '대구광역시 달서구 월배로 97 나사렛병원 (진천동)' AS locAddr, '053-643-3800' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 230 AS siGunGuCd, '대구가톨릭대학교 칠곡가톨릭병원' AS hmcNm, '대구광역시 북구 칠곡중앙대로 440 (읍내동)' AS locAddr, '053-320-2060' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 140 AS siGunGuCd, '대구파티마병원' AS hmcNm, '대구광역시 동구 아양로 99 (신암동)' AS locAddr, '053-940-7024' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 200 AS siGunGuCd, '드림종합병원' AS hmcNm, '대구광역시 남구 대명로 153 (대명동)' AS locAddr, '053-640-8887' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 290 AS siGunGuCd, '삼일병원' AS hmcNm, '대구광역시 달서구 월배로 436 지하1,지상1~11층 (송현동)' AS locAddr, '053-659-3100' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 27 AS siDoCd, 290 AS siGunGuCd, '의료법인구의료재단 구병원' AS hmcNm, '대구광역시 달서구 감삼북길 141 (감삼동)' AS locAddr, '053-560-9108' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 710 AS siGunGuCd, '서울산보람병원' AS hmcNm, '울산광역시 울주군 삼남읍 중평로 53 서울산보람병원' AS locAddr, '052-255-7146' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 140 AS siGunGuCd, '울산병원' AS hmcNm, '울산광역시 남구 월평로171번길 13 (신정동)' AS locAddr, '052-259-5221' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 200 AS siGunGuCd, '울산엘리야병원' AS hmcNm, '울산광역시 북구 호계로 285 (호계동)' AS locAddr, '052-290-2100' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 110 AS siGunGuCd, '의료법인 동강의료재단 동강병원' AS hmcNm, '울산광역시 중구 태화로 239 (태화동)' AS locAddr, '052-241-1489' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 110 AS siGunGuCd, '의료법인 동강의료재단 동천동강병원' AS hmcNm, '울산광역시 중구 외솔큰길 215 (남외동, 동천동강병원)' AS locAddr, '052-702-3551' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 200 AS siGunGuCd, '의료법인 송은의료재단 울산시티병원' AS hmcNm, '울산광역시 북구 산업로 1007 (연암동)' AS locAddr, '052-280-9200' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 140 AS siGunGuCd, '의료법인 은성의료재단 좋은삼정병원' AS hmcNm, '울산광역시 남구 북부순환도로 51 (무거동)' AS locAddr, '052-220-7535' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 140 AS siGunGuCd, '의료법인 정안의료재단 중앙병원' AS hmcNm, '울산광역시 남구 문수로 472 중앙병원 (신정동)' AS locAddr, '052-226-1888' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 31 AS siDoCd, 170 AS siGunGuCd, '학교법인 울산공업학원 울산대학교병원' AS hmcNm, '울산광역시 동구 대학병원로 25 울산대학교병원 (전하동)' AS locAddr, '052-250-8352' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 150 AS siGunGuCd, '경상북도김천의료원' AS hmcNm, '경상북도 김천시 모암길 24 (모암동)' AS locAddr, '054-429-8216' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 170 AS siGunGuCd, '경상북도안동의료원' AS hmcNm, '경상북도 안동시 태사2길 55 (북문동)' AS locAddr, '054-850-6276' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 113 AS siGunGuCd, '경상북도포항의료원' AS hmcNm, '경상북도 포항시 북구 용흥로 36 (용흥동)' AS locAddr, '054-245-0115' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 190 AS siGunGuCd, '구미강동병원' AS hmcNm, '경상북도 구미시 인동20길 46 (진평동)' AS locAddr, '054-453-7575' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 130 AS siGunGuCd, '동국대학교의과대학경주병원' AS hmcNm, '경상북도 경주시 동대로 87 (석장동)' AS locAddr, '054-770-1400' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 250 AS siGunGuCd, '상주적십자병원' AS hmcNm, '경상북도 상주시 상서문로 53 (남성동)' AS locAddr, '054-530-3184' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 190 AS siGunGuCd, '순천향대학교 부속 구미병원' AS hmcNm, '경상북도 구미시 1공단로 179 (공단동)' AS locAddr, '054-468-9114' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 170 AS siGunGuCd, '안동성소병원' AS hmcNm, '경상북도 안동시 서동문로 99 (금곡동)' AS locAddr, '054-850-8168' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 230 AS siGunGuCd, '영남대학교의과대학부속영천병원' AS hmcNm, '경상북도 영천시 오수1길 10 (오수동)' AS locAddr, '054-330-7220' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 210 AS siGunGuCd, '영주적십자병원' AS hmcNm, '경상북도 영주시 대학로 327-0 영주적십자병원' AS locAddr, '054-630-0165' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 290 AS siGunGuCd, '의료법인 근원의료재단 경산중앙병원' AS hmcNm, '경상북도 경산시 경안로 11 (백천동)' AS locAddr, '053-715-0250' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 290 AS siGunGuCd, '의료법인 서명의료재단 세명종합병원' AS hmcNm, '경상북도 경산시 경안로 208 (중방동)' AS locAddr, '053-819-8800' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 150 AS siGunGuCd, '의료법인덕산의료재단김천제일병원' AS hmcNm, '경상북도 김천시 신음1길 12 (신음동)' AS locAddr, '054-420-9478' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 280 AS siGunGuCd, '의료법인동춘의료재단문경제일병원' AS hmcNm, '경상북도 문경시 당교3길 25 (모전동)' AS locAddr, '054-550-7712' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 250 AS siGunGuCd, '의료법인삼백의료재단상주성모병원' AS hmcNm, '경상북도 상주시 냉림서성길 7 (냉림동)' AS locAddr, '054-530-7777' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 170 AS siGunGuCd, '의료법인안동병원' AS hmcNm, '경상북도 안동시 앙실로 11 (수상동)' AS locAddr, '054-840-0551' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 113 AS siGunGuCd, '의료법인은성의료재단좋은선린병원' AS hmcNm, '경상북도 포항시 북구 대신로 43 (대신동)' AS locAddr, '054-245-5011' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 111 AS siGunGuCd, '의료법인한성재단포항세명기독병원' AS hmcNm, '경상북도 포항시 남구 포스코대로 351 (대도동)' AS locAddr, '054-289-1860' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 190 AS siGunGuCd, '차의과학대학교부속구미차병원' AS hmcNm, '경상북도 구미시 신시로10길 12 (형곡동)' AS locAddr, '054-450-9700' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 47 AS siDoCd, 111 AS siGunGuCd, '포항성모병원' AS hmcNm, '경상북도 포항시 남구 대잠동길 17 (대잠동)' AS locAddr, '054-260-8188' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 250 AS siGunGuCd, '강일병원' AS hmcNm, '경상남도 김해시 가락로 359 (구산동)' AS locAddr, '055-822-0176' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 125 AS siGunGuCd, '경상남도마산의료원' AS hmcNm, '경상남도 창원시 마산합포구 3·15대로 231 (중앙동3가)' AS locAddr, '055-249-1234' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 123 AS siGunGuCd, '근로복지공단 창원병원' AS hmcNm, '경상남도 창원시 성산구 창원대로 721 (중앙동)' AS locAddr, '055-280-0397' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 330 AS siGunGuCd, '베데스다복음병원' AS hmcNm, '경상남도 양산시 신기로 28 (신기동)' AS locAddr, '055-384-9901' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 220 AS siGunGuCd, '새통영병원' AS hmcNm, '경상남도 통영시 무전7길 192 (무전동)' AS locAddr, '055-640-4188' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 129 AS siGunGuCd, '연세에스병원' AS hmcNm, '경상남도 창원시 진해구 해원로32번길 13 (이동)' AS locAddr, '055-548-7777' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 310 AS siGunGuCd, '의료법인 거붕 백병원' AS hmcNm, '경상남도 거제시 계룡로5길 14 (상동동)' AS locAddr, '055-733-0777' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 310 AS siGunGuCd, '의료법인 대우의료재단대우병원' AS hmcNm, '경상남도 거제시 두모길 16-16 (두모동)' AS locAddr, '055-680-8570' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 170 AS siGunGuCd, '의료법인 문병욱의료재단 진주고려병원' AS hmcNm, '경상남도 진주시 동진로 2 (칠암동, 진주고려병원)' AS locAddr, '055-751-2500' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 310 AS siGunGuCd, '의료법인 성념의료재단맑은샘병원' AS hmcNm, '경상남도 거제시 연초면 거제대로 4477' AS locAddr, '055-731-1230' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 250 AS siGunGuCd, '의료법인갑을의료재단 갑을장유병원' AS hmcNm, '경상남도 김해시 장유로 167-13 (부곡동)' AS locAddr, '055-310-6025' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 125 AS siGunGuCd, '의료법인석영의료재단창원제일종합병원' AS hmcNm, '경상남도 창원시 마산합포구 3·15대로 238 (중앙동3가)' AS locAddr, '055-249-7783' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 250 AS siGunGuCd, '의료법인숭인의료재단 김해복음병원' AS hmcNm, '경상남도 김해시 활천로 33 (삼정동)' AS locAddr, '055-330-8857' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 127 AS siGunGuCd, '의료법인청아의료재단청아병원' AS hmcNm, '경상남도 창원시 마산회원구 내서읍 광려천서로 67 (청아병원)' AS locAddr, '055-230-1592' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 125 AS siGunGuCd, '의료법인합포의료재단에스엠지연세병원' AS hmcNm, '경상남도 창원시 마산합포구 3·15대로 76 (월남동2가, 합포의료재단)' AS locAddr, '055-240-7471' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 250 AS siGunGuCd, '의료법인환명의료재단 조은금강병원' AS hmcNm, '경상남도 김해시 김해대로 1814-37 (삼계동)' AS locAddr, '055-330-0222' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 170 AS siGunGuCd, '제일병원' AS hmcNm, '경상남도 진주시 진주대로 885 (강남동)' AS locAddr, '055-750-7145' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 123 AS siGunGuCd, '창원경상국립대학교병원' AS hmcNm, '경상남도 창원시 성산구 삼정자로 11 (성주동, 창원경상대학교병원)' AS locAddr, '055-214-2050' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 121 AS siGunGuCd, '창원파티마병원' AS hmcNm, '경상남도 창원시 의창구 창이대로 45-45 (명서동)' AS locAddr, '055-270-1000' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 121 AS siGunGuCd, '창원한마음병원' AS hmcNm, '경상남도 창원시 의창구 용동로57번길 8 (사림동)' AS locAddr, '055-225-1302' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 127 AS siGunGuCd, '학교법인성균관대학삼성창원병원' AS hmcNm, '경상남도 창원시 마산회원구 팔용로 158-158 (합성동, 삼성창원병원)' AS locAddr, '055-233-6010' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 48 AS siDoCd, 170 AS siGunGuCd, '한일병원' AS hmcNm, '경상남도 진주시 범골로 17 한일병원 지하1 1~7층 (충무공동)' AS locAddr, '055-750-1325' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 50 AS siDoCd, 110 AS siGunGuCd, '의료법인 중앙의료재단 중앙병원' AS hmcNm, '제주특별자치도 제주시 월랑로 91-0 중앙병원' AS locAddr, '064-786-7280' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 50 AS siDoCd, 110 AS siGunGuCd, '의료법인 혜인의료재단 한국병원' AS hmcNm, '제주특별자치도 제주시 서광로 193 (삼도일동)' AS locAddr, '064-750-0701' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 50 AS siDoCd, 110 AS siGunGuCd, '제주대학교병원' AS hmcNm, '제주특별자치도 제주시 아란13길 15-0 0동 0층 0호 (아라일동,제주대학교병원)' AS locAddr, '064-717-1580' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 50 AS siDoCd, 130 AS siGunGuCd, '제주특별자치도 서귀포의료원' AS hmcNm, '제주특별자치도 서귀포시 장수로 47 (동홍동)' AS locAddr, '064-730-3460' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 50 AS siDoCd, 110 AS siGunGuCd, '제주한라병원' AS hmcNm, '제주특별자치도 제주시 도령로 65 (연동)' AS locAddr, '064-740-5359' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
UNION ALL
SELECT 50 AS siDoCd, 110 AS siGunGuCd, '한마음병원' AS hmcNm, '제주특별자치도 제주시 연신로 52 (이도이동)' AS locAddr, '064-750-9838' AS hmcTelNo, NULL AS cxVl, NULL AS cyVl
) AS v
WHERE NOT EXISTS (
  SELECT 1
  FROM hospitals h
  WHERE h.siDoCd = v.siDoCd
    AND h.siGunGuCd = v.siGunGuCd
    AND h.hmcNm = v.hmcNm
    AND COALESCE(h.locAddr, '') = COALESCE(v.locAddr, '')
);

SELECT ROW_COUNT() AS inserted_rows;

SELECT siDoCd, COUNT(*) AS hospital_count
FROM hospitals
WHERE siDoCd IN (27, 31, 47, 48, 50)
GROUP BY siDoCd
ORDER BY siDoCd;

COMMIT;
