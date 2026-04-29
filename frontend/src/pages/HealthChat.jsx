import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { chatAPI } from '../api/services';
import ReactMarkdown from 'react-markdown';

const QUICK_QUESTIONS = [
  '도수치료 보험 보장이 돼?',
  '내 보험에서 MRI 얼마나 나와?',
  '실손보험 청구 어떻게 해?',
  '당뇨 위험이 높은데 어떤 보험이 필요해?',
  '이번 달 청구 못한 보험금 알려줘',
];

const OPENAI_KEY = process.env.REACT_APP_OPENAI_KEY;

// 백엔드 없을 때 프론트에서 직접 OpenAI 호출 (데모용)
async function callOpenAIDirect(messages, userContext) {
  if (!OPENAI_KEY) throw new Error('NO_KEY');
  const systemPrompt = `당신은 MediCatch의 건강보험 전문 AI 어시스턴트입니다.
사용자 정보:
- 보험: 삼성생명 실손(3세대), 한화생명 종신, 현대해상 치아
- 건강 위험도: 당뇨 중위험, 뇌졸중/심뇌혈관 저위험
- 최근 진료: 서울성모병원(2026-03-15), 연세세브란스(2026-02-28)

규칙:
1. 항상 한국어로 답변하세요
2. 보험 보장 여부를 물어보면 구체적인 금액과 조건을 안내하세요
3. 의학적 진단이나 치료 권고는 하지 마세요
4. 답변은 친근하고 간결하게 작성하세요
5. 보험 전문 용어는 쉽게 풀어서 설명하세요`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-10)],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error('API_ERROR');
  const data = await res.json();
  return data.choices[0].message.content;
}

// 백엔드 없을 때 규칙 기반 응답 (OpenAI 키도 없을 때)
function getRuleBasedResponse(message) {
  const m = message.toLowerCase();
  if (m.includes('도수치료')) return `**도수치료 보험 보장 안내** 🏥\n\n고객님의 **삼성생명 실손보험 (3세대)** 기준으로 안내드립니다.\n\n- 3세대 실손보험은 도수치료를 **비급여 항목으로 제외**합니다\n- 1세대: 70% 보장 (연 180일 한도)\n- 2세대: 50만원 한도 보장\n- 3~4세대: ❌ 비급여 제외\n\n⚠️ 현재 가입하신 3세대 실손으로는 도수치료 보장이 어렵습니다.\n\n💡 **Tip**: 실손보험 외 특약으로 도수치료가 포함된 상품으로 갱신을 고려해보세요.`;
  if (m.includes('mri')) return `**MRI 보험 보장 안내** 📊\n\n- **삼성생명 실손(3세대)**: MRI는 **급여 항목**으로 80% 보장됩니다\n- 예상 본인부담금: 약 10만원 (총 50만원 기준)\n- **처방전 + 영수증** 지참하여 청구하시면 됩니다\n\n✅ MRI는 세대 관계없이 대부분 보장됩니다!`;
  if (m.includes('청구') || m.includes('어떻게')) return `**실손보험 청구 방법** 📋\n\n**온라인 청구 (추천)**\n1. 보험사 앱 실행\n2. '보험금 청구' 메뉴\n3. 진료비 영수증 사진 업로드\n4. 1~3 영업일 내 지급\n\n**필요 서류**\n- 진료비 영수증 (필수)\n- 진료확인서 (입원 시)\n- 처방전 (약제비 청구 시)\n\n💡 **MediCatch 스마트 청구**를 이용하면 서류 자동 분석으로 더 편하게 청구할 수 있어요!`;
  if (m.includes('당뇨')) return `**당뇨 관련 보험 안내** 💊\n\n고객님은 **당뇨 중위험** 등급입니다.\n\n**현재 보장 점검**\n- 당뇨 합병증 보장: ⚠️ 부족\n- 당뇨 관련 입원비: ✅ 한화생명 종신 포함\n\n**추천 보강 사항**\n1. 당뇨 합병증 특약 추가\n2. 혈당 관리 관련 실손 보완\n\n📊 [보험 추천 & 공백 페이지](/insurance-plan)에서 상세 분석을 확인하세요.`;
  return `안녕하세요! MediCatch AI 어시스턴트입니다. 😊\n\n**"${message}"** 에 대해 도움을 드리겠습니다.\n\n현재 고객님의 보험 정보를 분석하고 있습니다. 더 정확한 답변을 위해 왼쪽 메뉴에서:\n- 🔍 **진료 전 검색**: 특정 치료의 보장 여부 확인\n- 🛡️ **내 보험 조회**: 가입한 보험 상세 확인\n- 📊 **보험 추천 & 공백**: AI 분석 결과 확인\n\n구체적인 질문을 해주시면 더 정확히 안내해드릴게요!`;
}

export default function HealthChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! MediCatch AI 어시스턴트입니다. 🏥\n\n건강보험에 대해 궁금한 것을 자유롭게 물어보세요.\n- "도수치료 보험 돼?"\n- "실손 청구 어떻게 해?"\n- "내 보장에 뭐가 부족해?" 등\n\n내 건강·보험 데이터를 바탕으로 맞춤 답변을 드립니다!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useMode, setUseMode] = useState('rule'); // 'backend' | 'openai' | 'rule'
  const bottomRef = useRef(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL 파라미터로 초기 질문 처리
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setInput(q); }
  }, []);

  // 채팅 이력 로드
  useEffect(() => {
    chatAPI.getHistory()
      .then(r => {
        if (r.data?.length > 0) {
          setMessages(r.data.map(h => ({ role: h.role.toLowerCase(), content: h.message })));
          setUseMode('backend');
        }
      })
      .catch(() => setUseMode(OPENAI_KEY ? 'openai' : 'rule'));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      let responseText = '';
      if (useMode === 'backend') {
        const data = await chatAPI.sendMessage(msg);
        responseText = data.message;
      } else if (useMode === 'openai') {
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        responseText = await callOpenAIDirect([...history, { role: 'user', content: msg }]);
      } else {
        await new Promise(r => setTimeout(r, 600)); // 자연스러운 딜레이
        responseText = getRuleBasedResponse(msg);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송합니다. 잠시 후 다시 시도해주세요. 🙏' }]);
    } finally { setLoading(false); }
  };

  const clearHistory = async () => {
    if (!window.confirm('대화 내역을 초기화할까요?')) return;
    try { await chatAPI.clearHistory(); } catch {}
    setMessages([{ role: 'assistant', content: '대화 내역이 초기화되었습니다. 새로운 질문을 해주세요! 😊' }]);
  };

  return (
    <div style={s.page}>
      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>💬 건강 채팅</h2>
          <p style={s.subtitle}>내 건강·보험 데이터 기반 AI 어시스턴트</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...s.modeBadge, background: useMode === 'backend' ? '#dcfce7' : useMode === 'openai' ? '#dbeafe' : '#f3e8ff', color: useMode === 'backend' ? '#16a34a' : useMode === 'openai' ? '#1d4ed8' : '#7c3aed' }}>
            {useMode === 'backend' ? '🟢 서버 연결' : useMode === 'openai' ? '🔵 GPT-4o' : '🟣 데모 모드'}
          </span>
          <button onClick={clearHistory} style={s.clearBtn}>🗑️ 초기화</button>
        </div>
      </div>

      <div style={s.container}>
        {/* 빠른 질문 */}
        <div style={s.quickSection}>
          <p style={s.quickLabel}>💡 자주 묻는 질문</p>
          <div style={s.quickChips}>
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => sendMessage(q)} style={s.chip}>{q}</button>
            ))}
          </div>
        </div>

        {/* 채팅 창 */}
        <div style={s.chatBox}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
              {msg.role === 'assistant' && (
                <div style={s.botAvatar}>🏥</div>
              )}
              <div style={msg.role === 'user' ? s.userBubble : s.botBubble}>
                {msg.role === 'assistant'
                  ? <div style={s.markdownWrapper}><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  : msg.content
                }
              </div>
              {msg.role === 'user' && <div style={s.userAvatar}>나</div>}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={s.botAvatar}>🏥</div>
              <div style={s.botBubble}>
                <div style={s.typing}>
                  <span style={s.dot} /><span style={{ ...s.dot, animationDelay: '.2s' }} /><span style={{ ...s.dot, animationDelay: '.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        <div style={s.inputRow}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="보험, 건강에 대해 무엇이든 물어보세요..."
            style={s.inputBox}
            disabled={loading}
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={s.sendBtn}>
            ➤
          </button>
        </div>

        {/* 링크 안내 */}
        <div style={s.tips}>
          <span style={s.tipItem} onClick={() => navigate('/pre-treatment')}>🔍 진료 전 보장 검색</span>
          <span style={s.tipItem} onClick={() => navigate('/insurance-plan')}>📊 보장 공백 분석</span>
          <span style={s.tipItem} onClick={() => navigate('/medical-records')}>📋 청구 가능 목록</span>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        .markdown-content p { margin-bottom: 8px; line-height: 1.6; }
        .markdown-content ul { padding-left: 20px; margin-bottom: 8px; }
        .markdown-content strong { color: #0f172a; }
        .markdown-content h2,.markdown-content h3 { margin: 12px 0 6px; color: #1e293b; }
      `}</style>
    </div>
  );
}

const s = {
  page: { maxWidth: 860, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b' },
  modeBadge: { fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 600 },
  clearBtn: { padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#64748b' },
  container: { background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  quickSection: { padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafbff' },
  quickLabel: { fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 },
  quickChips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, fontSize: 12, color: '#1d4ed8', cursor: 'pointer', whiteSpace: 'nowrap' },
  chatBox: { flex: 1, padding: '24px 20px', overflowY: 'auto', minHeight: 480, maxHeight: 480, background: '#fafbff' },
  botAvatar: { width: 34, height: 34, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginRight: 8, flexShrink: 0, alignSelf: 'flex-end' },
  userAvatar: { width: 34, height: 34, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, marginLeft: 8, flexShrink: 0, alignSelf: 'flex-end' },
  botBubble: { maxWidth: '75%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', fontSize: 14, lineHeight: 1.6, color: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,.06)' },
  userBubble: { maxWidth: '75%', background: '#1d4ed8', color: '#fff', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', fontSize: 14, lineHeight: 1.6 },
  markdownWrapper: { className: 'markdown-content' },
  typing: { display: 'flex', gap: 4, padding: '4px 0', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: 'bounce 1s infinite' },
  inputRow: { padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 },
  inputBox: { flex: 1, padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 14, outline: 'none', background: '#f8fafc' },
  sendBtn: { width: 46, height: 46, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tips: { padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 16, flexWrap: 'wrap' },
  tipItem: { fontSize: 12, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' },
};
