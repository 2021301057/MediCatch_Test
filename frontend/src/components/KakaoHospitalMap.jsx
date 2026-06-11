import { useEffect, useRef } from 'react';
import useKakaoMap from '../hooks/useKakaoMap';

const DEFAULT_CENTER = { lat: 36.5, lng: 127.8 }; // 한반도 중심 근처

/**
 * 병원 목록을 카카오지도에 숫자 마커로 표시하는 컴포넌트.
 * - hospitals: cxVl(경도)/cyVl(위도)를 포함한 병원 배열 (목록 순서 = 마커 번호)
 * - selectedId: 외부(목록)에서 선택된 병원 id → 해당 마커 강조 + 이동 + 정보창
 * - onSelect: 마커 클릭 시 호출 (병원 id 전달)
 * 밀집 구역은 MarkerClusterer(libraries=clusterer)로 묶어서 표시한다.
 */
export default function KakaoHospitalMap({ hospitals, selectedId, onSelect }) {
  const { loaded, error } = useKakaoMap();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clustererRef = useRef(null);
  const overlaysRef = useRef(new Map()); // hospital.id -> { overlay, el, position, hospital }
  const infoRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 지도 생성
  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current) return;
    const { kakao } = window;
    mapRef.current = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: 12,
    });
    if (kakao.maps.MarkerClusterer) {
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map: mapRef.current,
        averageCenter: true,
        minLevel: 7,
        minClusterSize: 3,
        styles: [{
          width: '40px', height: '40px',
          background: 'rgba(37, 99, 235, .85)',
          border: '3px solid rgba(255, 255, 255, .75)',
          borderRadius: '50%',
          color: '#fff',
          fontWeight: '800', fontSize: '13px',
          textAlign: 'center', lineHeight: '35px',
        }],
      });
    }
  }, [loaded]);

  // 병원 목록 변경 시 숫자 마커 갱신 + bounds 맞춤
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const { kakao } = window;
    const map = mapRef.current;

    infoRef.current?.setMap(null);
    infoRef.current = null;
    clustererRef.current?.clear();
    overlaysRef.current.forEach(({ overlay }) => overlay.setMap(null));
    overlaysRef.current.clear();

    const located = (hospitals || [])
      .map((h, i) => ({ hospital: h, num: i + 1 }))
      .filter(({ hospital: h }) => h.cxVl != null && h.cyVl != null);
    if (located.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    const overlays = located.map(({ hospital: h, num }) => {
      const position = new kakao.maps.LatLng(h.cyVl, h.cxVl);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mc-kmarker';
      el.textContent = String(num);
      el.title = h.hmcNm;
      el.addEventListener('click', () => onSelectRef.current?.(h.id));
      const overlay = new kakao.maps.CustomOverlay({ position, content: el, yAnchor: 1, zIndex: 2 });
      overlaysRef.current.set(h.id, { overlay, el, position, hospital: h });
      bounds.extend(position);
      return overlay;
    });

    if (clustererRef.current) clustererRef.current.addMarkers(overlays);
    else overlays.forEach((o) => o.setMap(map));
    map.setBounds(bounds, 24);
  }, [loaded, hospitals]);

  // 선택된 병원: 마커 강조 + 이동 + 정보창
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const { kakao } = window;
    const map = mapRef.current;

    overlaysRef.current.forEach(({ el }, id) => el.classList.toggle('active', id === selectedId));
    infoRef.current?.setMap(null);
    infoRef.current = null;
    if (selectedId == null) return;

    const entry = overlaysRef.current.get(selectedId);
    if (!entry) return;
    const { position, hospital } = entry;

    // 클러스터에 묶여 안 보이는 레벨이면 마커가 보이도록 확대
    if (clustererRef.current && map.getLevel() >= 7) map.setLevel(6, { anchor: position });
    map.panTo(position);

    const info = document.createElement('div');
    info.className = 'mc-kinfo';
    const name = document.createElement('strong');
    name.textContent = hospital.hmcNm;
    info.appendChild(name);
    if (hospital.locAddr) {
      const addr = document.createElement('div');
      addr.textContent = hospital.locAddr;
      info.appendChild(addr);
    }
    if (hospital.hmcTelNo) {
      const tel = document.createElement('div');
      tel.textContent = `☎ ${hospital.hmcTelNo}`;
      info.appendChild(tel);
    }
    infoRef.current = new kakao.maps.CustomOverlay({ position, content: info, yAnchor: 1.45, zIndex: 5 });
    infoRef.current.setMap(map);
  }, [loaded, selectedId, hospitals]);

  if (error) return <div className="mc-kakao-map mc-kakao-map-error">{error}</div>;
  return (
    <div ref={containerRef} className="mc-kakao-map">
      {!loaded && <div className="mc-kakao-map-loading">지도를 불러오는 중...</div>}
    </div>
  );
}
