import React from 'react';
import HealthChat from '../pages/HealthChat';

const Icon = ({ children, size = 16 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>
    {children}
  </svg>
);

const P = {
  chat: (<><path d="M2 2h12v9H9l-3 3v-3H2V2z" /><path d="M5 6h6M5 8.5h4" /></>),
  close: (<><path d="M4 4l8 8" /><path d="M12 4l-8 8" /></>),
  minus: (<path d="M4 8h8" />),
};

export default function FloatingHealthChat({ open, onOpen, onClose, initialQuery }) {
  return (
    <div className="mc-floating-chat">
      <div className={`mc-floating-chat-panel${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="mc-floating-chat-head">
          <div>
            <div className="mc-floating-chat-title">
              <Icon size={15}>{P.chat}</Icon> AI 채팅
            </div>
            <div className="mc-floating-chat-sub">언제든 보험·건강 질문하기</div>
          </div>
          <button className="mc-floating-chat-icon" onClick={onClose} title="채팅 닫기">
            <Icon size={15}>{P.minus}</Icon>
          </button>
        </div>
        <HealthChat variant="popup" initialQuery={initialQuery} />
      </div>

      <div className={`mc-chat-hippo${open ? ' hidden' : ''}`} aria-hidden="true">
        <span className="mc-chat-hippo-ear left" />
        <span className="mc-chat-hippo-ear right" />
        <span className="mc-chat-hippo-eye left" />
        <span className="mc-chat-hippo-eye right" />
        <span className="mc-chat-hippo-snout">
          <span />
          <span />
        </span>
      </div>
      <button
        className={`mc-floating-chat-button${open ? ' hidden' : ''}`}
        onClick={onOpen}
        type="button"
      >
        <Icon size={16}>{P.chat}</Icon>
        <span>AI 채팅</span>
      </button>
    </div>
  );
}
