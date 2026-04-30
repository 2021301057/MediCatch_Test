import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  search: (<><circle cx="7" cy="7" r="4"/><path d="m10 10 3 3"/></>),
  arrow:  (<path d="M3 8h10M9 4l4 4-4 4"/>),
  chat:   (<><path d="M2 2h12v9H9l-3 3v-3H2V2z"/><path d="M5 6h6M5 8.5h4"/></>),
  close:  (<path d="M4 4l8 8M12 4l-8 8"/>),
};

const TREATMENTS = [
  { id: 1, name: '도수치료',    category: '재활치료', avgCost: 80000,   isBigeup: true,
    coverage: { gen1: '70% 보장 (연 180일)', gen2: '50만원 한도', gen3: '비급여 제외', gen4: '비급여 제외' } },
  { id: 2, name: 'MRI',         category: '영상검사', avgCost: 500000,  isBigeup: false,
    coverage: { gen1: '80% 보장', gen2: '80% 보장', gen3: '80% 보장', gen4: '80% 보장' } },
  { id: 3, name: '백내장수술',  category: '안과',     avgCost: 1500000, isBigeup: true,
    coverage: { gen1: '70% 보장', gen2: '70% 보장', gen3: '비급여 제외', gen4: '비급여 제외' } },
  { id: 4, name: '체외충격파',  category: '재활치료', avgCost: 50000,   isBigeup: true,
    coverage: { gen1: '70% 보장', gen2: '50만원 한도', gen3: '비급여 제외', gen4: '비급여 제외' } },
  { id: 5, name: '비급여주사',  category: '주사치료', avgCost: 30000,   isBigeup: true,
    coverage: { gen1: '70% 보장', gen2: '50만원 한도', gen3: '비급여 제외', gen4: '비급여 제외' } },
  { id: 6, name: '내시경',      category: '검사',     avgCost: 150000,  isBigeup: false,
    coverage: { gen1: '80% 보장', gen2: '80% 보장', gen3: '80% 보장', gen4: '80% 보장' } },
  { id: 7, name: '고혈압약',    category: '약물',     avgCost: 15000,   isBigeup: false,
    coverage: { gen1: '처방전 80%', gen2: '처방전 80%', gen3: '처방전 80%', gen4: '처방전 80%' } },
  { id: 8, name: '물리치료',    category: '재활치료', avgCost: 20000,   isBigeup: false,
    coverage: { gen1: '80% 보장', gen2: '80% 보장', gen3: '80% 보장', gen4: '80% 보장' } },
];

const QUICK_SEARCHES = ['도수치료', 'MRI', '백내장', '체외충격파', '내시경'];

const formatCost = (n) => new Intl.NumberFormat('ko-KR').format(n);

export default function PreTreatmentSearch() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return TREATMENTS;
    return TREATMENTS.filter((t) => t.name.includes(searchQuery) || t.category.includes(searchQuery));
  }, [searchQuery]);

  return (
    <div className="mc-page fade-in">
      <div className="mc-page-top">
        <div>
          <div className="mc-page-title">진료 전 검색</div>
          <div className="mc-page-subtitle">병원 가기 전, 내 보험으로 어디까지 보장되는지 미리 확인하세요.</div>
        </div>
        <div className="mc-page-top-right">
          <button className="mc-btn" onClick={() => navigate('/chat')}>
            <Ic d={P.chat} size={12}/> AI에게 물어보기
          </button>
        </div>
      </div>

      {/* 검색 카드 */}
      <div className="mc-card mc-card-body mc-section-tight">
        <div className="mc-input-with-icon">
          <span className="mc-input-icon"><Ic d={P.search} size={14}/></span>
          <input
            className="mc-input"
            placeholder="치료명을 검색해주세요 (예: 도수치료, MRI)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mc-row-wrap" style={{ marginTop: 14 }}>
          <span className="mc-chat-quick-label">자주 찾는 치료</span>
          {QUICK_SEARCHES.map((name) => (
            <button key={name} className="mc-chip" onClick={() => setSearchQuery(name)}>
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 + 상세 */}
      <div className="mc-two-col" style={{ gridTemplateColumns: selected ? '1fr 360px' : '1fr' }}>
        <div>
          <div className="mc-sec-head">
            <span className="mc-sec-title">검색 결과 · {filtered.length}건</span>
          </div>
          <div className="mc-list">
            {filtered.map((t) => (
              <div
                key={t.id}
                className={`mc-list-row clickable${selected?.id === t.id ? ' active' : ''}`}
                onClick={() => setSelected(t)}
                style={selected?.id === t.id ? { background: 'var(--blue-soft)' } : undefined}
              >
                <div className="mc-list-icon" style={{
                  background: t.isBigeup ? '#F4EFDE' : '#E4F0EA',
                  borderColor: t.isBigeup ? '#E6DCB6' : '#BED4C7',
                  color: t.isBigeup ? '#8A7040' : '#3A7A62',
                  fontSize: 10, fontWeight: 800, letterSpacing: '-0.2px',
                }}>{t.isBigeup ? '비급여' : '급여'}</div>
                <div className="mc-list-info">
                  <div className="mc-list-name">{t.name}</div>
                  <div className="mc-list-sub">{t.category} · 평균 비용 {formatCost(t.avgCost)}원</div>
                </div>
                <Ic d={P.arrow} size={12}/>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="mc-list-row" style={{ color: 'var(--text-3)', justifyContent: 'center' }}>
                검색 결과가 없어요.
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div>
            <div className="mc-sec-head">
              <span className="mc-sec-title">{selected.name} 보장 정보</span>
              <button className="mc-sec-link" onClick={() => setSelected(null)}>
                닫기 <Ic d={P.close} size={10}/>
              </button>
            </div>

            <div className="mc-card">
              <div className="mc-card-head">
                <div>
                  <div className="mc-card-title">{selected.name}</div>
                  <div className="mc-card-sub">{selected.category} · 평균 {formatCost(selected.avgCost)}원</div>
                </div>
                <span className={`mc-tag ${selected.isBigeup ? 'mc-tag-warning' : 'mc-tag-success'}`}>
                  {selected.isBigeup ? '비급여' : '급여'}
                </span>
              </div>
              <div className="mc-card-body">
                <div className="mc-field-label" style={{ marginBottom: 10 }}>세대별 실손보험 보장 현황</div>
                <div className="mc-stack-xs" style={{ marginBottom: 18 }}>
                  {['gen1','gen2','gen3','gen4'].map((g, i) => (
                    <div key={g} className="mc-kv">
                      <span className="mc-kv-key">{i+1}세대</span>
                      <span className="mc-kv-val">{selected.coverage[g]}</span>
                    </div>
                  ))}
                </div>

                <div className="mc-alert mc-alert-blue">
                  <div>
                    <div className="mc-alert-title">현재 보험: 1세대 실손</div>
                    <div className="mc-alert-body">{selected.coverage.gen1}</div>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="mc-field-label" style={{ marginBottom: 8 }}>예상 환자부담금</div>
                  <div className="mc-row-between" style={{
                    padding: '12px 14px', background: '#FAFBFD',
                    border: '1px solid var(--border)', borderRadius: 4,
                  }}>
                    <span className="mc-kv-key">평균 비용</span>
                    <span className="mc-kv-val">{formatCost(selected.avgCost)}원</span>
                  </div>
                  <div className="mc-row-between" style={{
                    padding: '12px 14px', background: 'var(--blue-soft)',
                    border: '1px solid #D8E4FB', borderRadius: 4, marginTop: 6,
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>예상 본인 부담</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--blue)', letterSpacing: '-0.3px' }}>
                      {formatCost(Math.floor(selected.avgCost * 0.3))}원
                    </span>
                  </div>
                </div>

                <button
                  className="mc-btn mc-btn-primary mc-btn-block mc-btn-lg"
                  style={{ marginTop: 16 }}
                  onClick={() => navigate(`/chat?q=${encodeURIComponent(selected.name)}`)}
                >
                  <Ic d={P.chat} size={12}/> AI에게 보장 질문하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
