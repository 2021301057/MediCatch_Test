import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { chatAPI } from '../api/services';
import ReactMarkdown from 'react-markdown';

const Ic = ({ d, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>{d}</svg>
);

const P = {
  chat:   (<><path d="M2 2h12v9H9l-3 3v-3H2V2z"/><path d="M5 6h6M5 8.5h4"/></>),
  trash:  (<><path d="M3 4h10M6 4V2h4v2"/><path d="M4 4l1 10h6l1-10"/></>),
  send:   (<><path d="M2 8l12-6-4 12-3-5-5-1z"/></>),
  spark:  (<><path d="M8 2v4M8 10v4M2 8h4M10 8h4"/></>),
  search: (<><circle cx="7" cy="7" r="4"/><path d="m10 10 3 3"/></>),
  chart:  (<><path d="M3 13V7M8 13V3M13 13V9"/></>),
  doc:    (<><path d="M4 2h6l2 2v10H4z"/><path d="M6 6h4M6 9h4M6 12h3"/></>),
};

const QUICK_QUESTIONS = [
  '도수치료 보험 보장이 돼?',
  '내 보험에서 MRI 얼마나 나와?',
  '당뇨 위험이 높은데 어떤 보험이 필요해?',
  '내 보장에 뭐가 부족해?',
];

function getRuleBasedResponse(message) {
  const m = message.toLowerCase();
  if (m.includes('도수치료')) return `**도수치료 보험 보장 안내**\n\n고객님의 **삼성생명 실손보험 (3세대)** 기준 안내입니다.\n\n- 3세대 실손보험은 도수치료를 **비급여 항목으로 제외**합니다\n- 1세대: 70% 보장 (연 180일 한도)\n- 2세대: 50만원 한도 보장\n- 3~4세대: 비급여 제외\n\n현재 가입하신 3세대 실손으로는 도수치료 보장이 어렵습니다.\n\n**Tip**: 실손보험 외 특약으로 도수치료가 포함된 상품을 검토해보세요.`;
  if (m.includes('mri')) return `**MRI 보험 보장 안내**\n\n- **삼성생명 실손(3세대)**: MRI는 보장 대상에 포함될 수 있습니다\n- 예상 본인부담금: 약 10만원 (총 50만원 기준)\n- 실제 보장 여부는 진료 목적, 약관, 병원 서류에 따라 달라질 수 있어요\n\nMRI는 세대 관계없이 주요 검사 항목으로 자주 확인되는 항목입니다.`;
  if (m.includes('당뇨')) return `**당뇨 관련 보험 안내**\n\n고객님은 **당뇨 중위험** 등급입니다.\n\n**현재 보장 점검**\n- 당뇨 합병증 보장: 부족\n- 당뇨 관련 입원비: 한화생명 종신 포함\n\n**보장 보강 필요 항목**\n1. 당뇨 합병증 특약 추가\n2. 혈당 관리 관련 실손 보완\n\n[보험 공백] 페이지에서 상세 분석을 확인하세요.`;
  return `안녕하세요! MediCatch AI 어시스턴트입니다.\n\n**"${message}"** 에 대해 도움을 드리겠습니다.\n\n현재 고객님의 보험 정보를 분석하고 있어요. 더 정확한 답변을 위해 좌측 메뉴에서:\n- **진료 전 검색**: 특정 치료의 보장 여부 확인\n- **내 보험 조회**: 가입한 보험 상세 확인\n- **보험 공백**: 부족한 보장 항목 확인\n\n구체적인 질문을 해주시면 더 정확히 안내해드릴게요.`;
}

export default function HealthChat({ variant = 'page', initialQuery = '' }) {
  const [messages, setMessages] = useState([
    { role: 'assistant',
      content: '안녕하세요! MediCatch AI 어시스턴트입니다.\n\n건강보험에 대해 궁금한 것을 자유롭게 물어보세요.\n- "도수치료 보험 돼?"\n- "MRI 보장 얼마나 돼?"\n- "내 보장에 뭐가 부족해?" 등\n\n내 건강·보험 데이터를 바탕으로 맞춤 답변을 드립니다.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useMode, setUseMode] = useState('backend');
  const bottomRef = useRef(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPopup = variant === 'popup';

  useEffect(() => {
    const q = initialQuery || searchParams.get('q') || searchParams.get('query');
    if (q) setInput(q);
  }, [initialQuery, searchParams]);

  useEffect(() => {
    chatAPI.getHistory()
      .then((r) => {
        const history = Array.isArray(r?.messages) ? r.messages : [];
        if (history.length > 0) {
          setMessages(history.map((h) => ({
            role: h.role.toLowerCase(), content: h.message,
          })));
        }
        setUseMode('backend');
      })
      .catch(() => setUseMode('backend'));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    const userMsg = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await chatAPI.sendMessage(msg);
      const responseText = res?.message || res?.content || '';
      setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
      setUseMode('backend');
    } catch (err) {
      const serverMessage = err?.response?.data?.message;
      const responseText = serverMessage || getRuleBasedResponse(msg);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: responseText,
      }]);
      if (!serverMessage) setUseMode('rule');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('대화 내역을 초기화할까요?')) return;
    try { await chatAPI.clearHistory(); } catch {}
    setMessages([{
      role: 'assistant',
      content: '대화 내역이 초기화되었습니다. 새로운 질문을 해주세요.',
    }]);
  };

  const modeLabel = {
    backend: { text: '서버 연결', cls: 'mc-tag-success' },
    rule:    { text: '데모 모드', cls: 'mc-tag-neutral' },
  }[useMode];

  return (
    <div className={isPopup ? 'mc-chat-embed' : 'mc-page fade-in'}>
      {!isPopup && (
        <div className="mc-page-top">
          <div>
            <div className="mc-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ic d={P.chat} size={16}/> 건강 AI 채팅
            </div>
            <div className="mc-page-subtitle">내 건강·보험 데이터 기반 AI 어시스턴트</div>
          </div>
          <div className="mc-page-top-right" style={{ gap: 8 }}>
            <span className={`mc-tag ${modeLabel.cls}`}>
              <Ic d={P.spark} size={10}/> {modeLabel.text}
            </span>
            <button className="mc-btn" onClick={clearHistory}>
              <Ic d={P.trash} size={12}/> 대화 초기화
            </button>
          </div>
        </div>
      )}

      <div className="mc-chat-shell">
        {isPopup && (
          <div className="mc-chat-popup-toolbar">
            <span className={`mc-tag ${modeLabel.cls}`}>
              <Ic d={P.spark} size={10}/> {modeLabel.text}
            </span>
            <button className="mc-btn" onClick={clearHistory}>
              <Ic d={P.trash} size={12}/> 초기화
            </button>
          </div>
        )}

        {/* 빠른 질문 */}
        <div className="mc-chat-quick">
          <div className="mc-chat-quick-label">자주 묻는 질문</div>
          <div className="mc-row-wrap">
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} className="mc-chip" onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* 채팅 스트림 */}
        <div className="mc-chat-stream">
          {messages.map((msg, i) => (
            <div key={i} className={`mc-chat-msg ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="mc-chat-avatar bot">
                  <Ic d={P.chat} size={14}/>
                </div>
              )}
              <div className="mc-chat-bubble">
                {msg.role === 'assistant'
                  ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                  : msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="mc-chat-avatar user">나</div>
              )}
            </div>
          ))}

          {loading && (
            <div className="mc-chat-msg bot">
              <div className="mc-chat-avatar bot">
                <Ic d={P.chat} size={14}/>
              </div>
              <div className="mc-chat-bubble">
                <div className="mc-chat-typing">
                  <span/><span/><span/>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        <div className="mc-chat-input-row">
          <div className="mc-input-with-icon" style={{ flex: 1 }}>
            <span className="mc-input-icon"><Ic d={P.chat} size={14}/></span>
            <input
              className="mc-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="보험·건강에 대해 무엇이든 물어보세요"
              disabled={loading}
            />
          </div>
          <button
            className="mc-chat-send"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
          >
            <Ic d={P.send} size={14}/>
          </button>
        </div>

        {/* 관련 링크 */}
        <div className="mc-chat-tips">
          <span className="mc-chat-tip" onClick={() => navigate('/pre-treatment')}>
            <Ic d={P.search} size={11}/> 진료 전 보장 검색
          </span>
          <span className="mc-chat-tip" onClick={() => navigate('/insurance-plan')}>
            <Ic d={P.chart} size={11}/> 보장 공백 분석
          </span>
          <span className="mc-chat-tip" onClick={() => navigate('/medical-records')}>
            <Ic d={P.doc} size={11}/> 진료 기록 보기
          </span>
        </div>
      </div>
    </div>
  );
}
