import { useEffect, useState } from 'react';

const SDK_ID = 'kakao-map-sdk';
const APP_KEY = process.env.REACT_APP_KAKAO_MAP_KEY;

/**
 * 카카오지도 SDK를 동적으로 로드하는 훅.
 * 모달이 열릴 때 등 필요한 시점에만 호출해서 초기 로딩에 영향이 없도록 한다.
 */
export default function useKakaoMap() {
  const [loaded, setLoaded] = useState(
    () => !!(window.kakao && window.kakao.maps && window.kakao.maps.Map)
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loaded) return;
    if (!APP_KEY) {
      setError('카카오지도 앱키(REACT_APP_KAKAO_MAP_KEY)가 설정되지 않았습니다.');
      return;
    }

    const onSdkReady = () => window.kakao.maps.load(() => setLoaded(true));

    const existing = document.getElementById(SDK_ID);
    if (existing) {
      if (window.kakao && window.kakao.maps) onSdkReady();
      else existing.addEventListener('load', onSdkReady);
      return;
    }

    const script = document.createElement('script');
    script.id = SDK_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&autoload=false`;
    script.async = true;
    script.addEventListener('load', onSdkReady);
    script.addEventListener('error', () => setError('카카오지도 SDK 로드에 실패했습니다.'));
    document.head.appendChild(script);
  }, [loaded]);

  return { loaded, error };
}
