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
  search: (<><circle cx="7" cy="7" r="4"/><path d="m10 10 3 3"/></>),
  chart:  (<><path d="M3 13V7M8 13V3M13 13V9"/></>),
  doc:    (<><path d="M4 2h6l2 2v10H4z"/><path d="M6 6h4M6 9h4M6 12h3"/></>),
};

const QUICK_QUESTIONS = [
  '내 보장에 부족한 부분이 있어?',
  '최근 검진 결과 요약해줘',
  '도수치료 보장 어떻게 돼?',
  '내 건강 위험도가 어때?',
];

export default function HealthChat({ variant = 'page', initialQuery = '' }) {
  const [messages, setMessages] = useState([
    { role: 'assistant',
      content: '안녕하세요! MediCatch AI 어시스턴트입니다.\n\n건강보험에 대해 궁금한 것을 자유롭게 물어보세요.\n- "도수치료 보험 돼?"\n- "MRI 보장 얼마나 돼?"\n- "내 보장에 뭐가 부족해?" 등\n\n내 건강·보험 데이터를 바탕으로 맞춤 답변을 드립니다.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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
      })
      .catch(() => {});
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
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '죄송해요. 잠시 후 다시 시도해주세요.',
      }]);
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
            <button className="mc-btn" onClick={clearHistory}>
              <Ic d={P.trash} size={12}/> 대화 초기화
            </button>
          </div>
        </div>
      )}

      <div className="mc-chat-shell">
        {isPopup && (
          <div className="mc-chat-popup-toolbar">
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
