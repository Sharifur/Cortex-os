export const WIDGET_STYLES = `
:host {
  all: initial;
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483646;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #1f2937;
  --lc-brand: var(--lc-brand);
  --lc-brand-shadow: var(--lc-brand-shadow);
  --lc-brand-shadow-hover: var(--lc-brand-shadow-hover);
}
:host(.lc-position-left) {
  right: auto;
  left: 20px;
}

.lc-bubble {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  cursor: pointer;
  box-shadow: 0 6px 20px var(--lc-brand-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.lc-bubble:hover { transform: translateY(-2px); box-shadow: 0 10px 24px var(--lc-brand-shadow-hover); }
.lc-bubble svg { width: 24px; height: 24px; }

.lc-unread {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.lc-panel {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 360px;
  max-height: 560px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: lc-slide-in 0.2s ease;
}
:host(.lc-position-left) .lc-panel { right: auto; left: 0; }
@keyframes lc-slide-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.lc-header {
  padding: 14px 16px;
  background: var(--lc-brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lc-header-title { font-weight: 600; font-size: 15px; }
.lc-header-sub { font-size: 12px; opacity: 0.85; margin-top: 2px; }
.lc-close {
  background: transparent;
  border: 0;
  color: #fff;
  cursor: pointer;
  opacity: 0.85;
  padding: 4px;
  display: flex;
}
.lc-close:hover { opacity: 1; }
.lc-close svg { width: 18px; height: 18px; }

.lc-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lc-msg { max-width: 78%; padding: 8px 12px; border-radius: 14px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
.lc-msg.lc-msg-visitor { align-self: flex-end; background: var(--lc-brand); color: #fff; border-bottom-right-radius: 4px; }
.lc-msg.lc-msg-agent { align-self: flex-start; background: #fff; color: #1f2937; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
.lc-msg.lc-msg-system { align-self: center; font-size: 11px; color: #9ca3af; background: transparent; }
.lc-msg a { color: inherit; text-decoration: underline; word-break: break-all; }
.lc-msg.lc-msg-agent a { color: #2563eb; }
.lc-empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 24px 12px; }

.lc-typing {
  align-self: flex-start;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  border-bottom-left-radius: 4px;
  padding: 10px 14px;
  display: flex;
  gap: 4px;
}
.lc-typing span { width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: lc-bounce 1.2s infinite ease-in-out; }
.lc-typing span:nth-child(2) { animation-delay: 0.15s; }
.lc-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes lc-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

.lc-identify {
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
}
.lc-identify-row { display: flex; gap: 6px; margin-top: 6px; }
.lc-identify input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}
.lc-identify input:focus { border-color: var(--lc-brand); }
.lc-identify button {
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 13px;
  cursor: pointer;
}
.lc-identify-skip {
  background: transparent !important;
  color: #9ca3af !important;
  font-size: 12px !important;
  padding: 4px 0 0 0 !important;
  cursor: pointer;
  border: 0;
  margin-top: 6px;
}

.lc-composer {
  border-top: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  align-items: flex-end;
}
.lc-composer textarea {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 8px 10px;
  resize: none;
  font: inherit;
  font-size: 14px;
  outline: none;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.4;
  color: inherit;
}
.lc-composer textarea:focus { border-color: var(--lc-brand); }
.lc-composer button {
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.lc-composer button:disabled { opacity: 0.4; cursor: not-allowed; }
.lc-composer button svg { width: 16px; height: 16px; }

/* Honeypot — hidden from real users, bots fill it. */
.lc-hp { position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0; }

.lc-attach-btn {
  background: transparent;
  border: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  cursor: pointer;
  flex-shrink: 0;
}
.lc-attach-btn:hover { background: #f3f4f6; color: #1f2937; }
.lc-attach-btn svg { width: 18px; height: 18px; }
.lc-pending {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 12px 0 12px;
  background: #fff;
}
.lc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 4px 10px;
  font-size: 12px;
  color: #1f2937;
  max-width: 220px;
}
.lc-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-chip button {
  background: transparent;
  border: 0;
  padding: 0 0 0 4px;
  cursor: pointer;
  color: #6b7280;
  font-size: 14px;
  line-height: 1;
}
.lc-chip button:hover { color: #1f2937; }

.lc-attachments {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}
.lc-attach-img {
  display: block;
  max-width: 220px;
  max-height: 200px;
  border-radius: 10px;
  cursor: zoom-in;
}
.lc-attach-file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  color: #1f2937;
  text-decoration: none;
  max-width: 240px;
}
.lc-attach-file:hover { background: #e5e7eb; }
.lc-attach-file svg { width: 16px; height: 16px; flex-shrink: 0; color: #6b7280; }
.lc-attach-file span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.lc-attach-file .lc-attach-size { color: #6b7280; flex-shrink: 0; }

@media (max-width: 480px) {
  .lc-panel { width: calc(100vw - 24px); right: -8px; }
}
`;
