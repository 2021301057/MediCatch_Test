import { useEffect, useRef } from 'react';
import useKakaoMap from '../hooks/useKakaoMap';

const DEFAULT_CENTER = { lat: 36.5, lng: 127.8 }; // 한반도 중심 근처

/**
 * 병원 목록을 카카오지도에 마커로 표시하는 컴포넌트.
 * - hospitals: cxVl(경도)/cyVl(위도)를 포함한 병원 배열
 * - selectedId: 외부(목록)에서 선택된 병원 id → 해당 마커로 이동 + 인포윈도우
 * - onSelect: 마커 클릭 시 호출 (병원 id 전달)
 */
export default function KakaoHospitalMap({ hospitals, selectedId, onSelect }) {
  const { loaded, error } = useKakaoMap();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map()); // hospital.id -> marker
  const infoWindowRef = useRef(null);
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
    infoWindowRef.current = new kakao.maps.InfoWindow({ zIndex: 10 });
  }, [loaded]);

  // 병원 목록 변경 시 마커 갱신 + bounds 맞춤
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const { kakao } = window;
    const map = mapRef.current;

    infoWindowRef.current?.close();
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    const located = (hospitals || []).filter((h) => h.cxVl != null && h.cyVl != null);
    if (located.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    located.forEach((h) => {
      const position = new kakao.maps.LatLng(h.cyVl, h.cxVl);
      const marker = new kakao.maps.Marker({ map, position, title: h.hmcNm });
      kakao.maps.event.addListener(marker, 'click', () => onSelectRef.current?.(h.id));
      markersRef.current.set(h.id, marker);
      bounds.extend(position);
    });
    map.setBounds(bounds, 24);
  }, [loaded, hospitals]);

  // 선택된 병원으로 이동 + 인포윈도우
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const infoWindow = infoWindowRef.current;
    if (selectedId == null) { infoWindow?.close(); return; }

    const hospital = (hospitals || []).find((h) => h.id === selectedId);
    const marker = markersRef.current.get(selectedId);
    if (!hospital || !marker) { infoWindow?.close(); return; }

    const map = mapRef.current;
    map.panTo(marker.getPosition());
    infoWindow.setContent(
      `<div style="padding:8px 12px;font-size:12px;max-width:220px;line-height:1.5;">
        <strong>${hospital.hmcNm}</strong><br/>
        ${hospital.locAddr ?? ''}<br/>
        ${hospital.hmcTelNo ? `☎ ${hospital.hmcTelNo}` : ''}
      </div>`
    );
    infoWindow.open(map, marker);
  }, [loaded, selectedId, hospitals]);

  if (error) return <div className="mc-kakao-map mc-kakao-map-error">{error}</div>;
  return (
    <div ref={containerRef} className="mc-kakao-map">
      {!loaded && <div className="mc-kakao-map-loading">지도를 불러오는 중...</div>}
    </div>
  );
}
