import type { WidgetConfig } from './config';
import { sendMessage, identify, uploadAttachment, MessageResponse, SiteConfigResponse, AttachmentSummary } from './api';
import { connectVisitorSocket, LivechatEvent } from './socket';
import { WIDGET_STYLES } from './styles';
import type { Socket } from 'socket.io-client';

const DEFAULT_SITE_CONFIG: SiteConfigResponse = {
  siteKey: '',
  botName: 'Hi there',
  botSubtitle: 'We typically reply in a few seconds.',
  welcomeMessage: null,
  brandColor: '#2563eb',
  position: 'bottom-right',
};

interface VisitorMessage {
  id: string;
  role: 'visitor' | 'agent' | 'operator' | 'system';
  content: string;
  createdAt: string;
  attachments?: AttachmentSummary[];
  operatorName?: string;
}

const MESSAGES_KEY = 'livechat_messages_cache';
const SESSION_KEY = 'livechat_session_id';
const IDENTIFY_DISMISSED_KEY = 'livechat_identify_dismissed';
const RATE_LIMIT_KEY = 'livechat_send_log';
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function mountWidget(cfg: WidgetConfig, siteConfig: SiteConfigResponse = DEFAULT_SITE_CONFIG) {
  const host = document.createElement('div');
  host.id = 'livechat-widget-root';
  host.style.cssText = 'position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  // Apply per-site brand color via CSS custom properties on the host element.
  const brand = sanitizeColor(siteConfig.brandColor) ?? '#2563eb';
  const rgba = hexToRgba(brand, 0.35);
  const rgbaHover = hexToRgba(brand, 0.45);
  host.style.setProperty('--lc-brand', brand);
  host.style.setProperty('--lc-brand-shadow', rgba);
  host.style.setProperty('--lc-brand-shadow-hover', rgbaHover);
  if (siteConfig.position === 'bottom-left') host.classList.add('lc-position-left');

  const styleEl = document.createElement('style');
  styleEl.textContent = WIDGET_STYLES;
  shadow.appendChild(styleEl);

  const state = {
    open: false,
    sessionId: readSessionId(),
    messages: readCachedMessages(),
    socket: null as Socket | null,
    panel: null as HTMLDivElement | null,
    askedForEmail: false,
    unread: 0,
    host,
  };

  const bubbleBtn = document.createElement('button');
  bubbleBtn.className = 'lc-bubble';
  bubbleBtn.innerHTML = chatIcon();
  shadow.appendChild(bubbleBtn);

  const unreadBadge = document.createElement('span');
  unreadBadge.className = 'lc-unread';
  unreadBadge.style.display = 'none';
  bubbleBtn.appendChild(unreadBadge);

  // Seed the welcome message as a system-style agent line if no prior conversation exists.
  if (state.messages.length === 0 && siteConfig.welcomeMessage) {
    state.messages.push({
      id: 'welcome',
      role: 'agent',
      content: siteConfig.welcomeMessage,
      createdAt: new Date().toISOString(),
    });
    cacheMessages(state.messages);
  }

  const panel = buildPanel(shadow, cfg, state, render, siteConfig);
  panel.style.display = 'none';
  state.panel = panel;

  const isMobile = () => window.innerWidth <= 480;
  const DESKTOP_HOST_STYLE = `position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;`;

  // On mobile we pin the host to the Visual Viewport so it tracks the
  // visible area exactly — accounting for the browser URL bar (which slides
  // in/out on scroll) and the software keyboard. Without this the header
  // ends up hidden behind the URL bar on Chrome, Firefox, and Safari.
  function applyMobileHostStyle() {
    const vv = window.visualViewport;
    if (vv) {
      host.style.cssText = `position: fixed; top: ${vv.offsetTop}px; left: ${vv.offsetLeft}px; width: ${vv.width}px; height: ${vv.height}px; z-index: 2147483646;`;
    } else {
      host.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;`;
    }
  }

  let vvListenerInstalled = false;
  function ensureVvListener() {
    if (vvListenerInstalled || !window.visualViewport) return;
    vvListenerInstalled = true;
    const onChange = () => { if (state.open && isMobile()) applyMobileHostStyle(); };
    window.visualViewport!.addEventListener('resize', onChange);
    window.visualViewport!.addEventListener('scroll', onChange);
  }

  bubbleBtn.addEventListener('click', () => {
    state.open = !state.open;
    if (state.open) {
      if (isMobile()) { applyMobileHostStyle(); ensureVvListener(); }
      panel.classList.remove('lc-panel--closing');
      panel.style.display = 'flex';
      state.unread = 0;
      unreadBadge.style.display = 'none';
      const composer = panel.querySelector<HTMLTextAreaElement>('textarea');
      composer?.focus();
      scrollMessagesToEnd(panel);
    } else {
      panel.classList.add('lc-panel--closing');
      setTimeout(() => {
        if (!state.open) {
          panel.style.display = 'none';
          if (isMobile()) host.style.cssText = DESKTOP_HOST_STYLE;
        }
        panel.classList.remove('lc-panel--closing');
      }, 180);
    }
  });

  // If we already had a session from a previous page load, reconnect socket.
  if (state.sessionId) connectAndListen(cfg, state, render, siteConfig);

  function render() {
    renderMessages(panel, state);
    if (!state.open && state.unread > 0) {
      unreadBadge.textContent = String(Math.min(state.unread, 99));
      unreadBadge.style.display = 'flex';
    } else {
      unreadBadge.style.display = 'none';
    }
  }

  render();
}

function buildPanel(shadow: ShadowRoot, cfg: WidgetConfig, state: any, render: () => void, siteConfig: SiteConfigResponse): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'lc-panel';
  panel.innerHTML = `
    <div class="lc-header">
      <div class="lc-header-inner">
        <div class="lc-header-avatar">${botAvatarIcon()}</div>
        <div class="lc-header-text">
          <div class="lc-header-title">${escapeHtml(siteConfig.operatorName || siteConfig.botName)}</div>
          <div class="lc-header-sub"><span class="lc-online-dot"></span>${escapeHtml(siteConfig.botSubtitle)}</div>
        </div>
      </div>
      <button class="lc-close" aria-label="Close">${chevronDownIcon()}</button>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${chevronDownIcon()} New messages</button>
    </div>
    <div class="lc-quick-replies" style="display:none;"></div>
    <div class="lc-toast" role="alert" style="display:none;"></div>
    <div class="lc-identify" style="display:none;">
      <div class="lc-identify-label">Share your details so we can follow up if needed.</div>
      <div class="lc-identify-row">
        <input class="lc-identify-name" type="text" placeholder="Your name" />
      </div>
      <div class="lc-identify-row">
        <input type="email" placeholder="your@email.com" />
        <button>Save</button>
      </div>
      <button class="lc-identify-skip">Skip</button>
    </div>
    <div class="lc-pending" style="display:none;"></div>
    <form class="lc-composer" autocomplete="off">
      <input class="lc-hp" name="website" tabindex="-1" autocomplete="off" />
      <input class="lc-file-input" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none;" />
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${attachIcon()}</button>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${sendIcon()}</button>
    </form>
  `;
  shadow.appendChild(panel);

  const DESKTOP_HOST_STYLE_BP = `position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;`;
  const closeBtn = panel.querySelector<HTMLButtonElement>('.lc-close')!;
  closeBtn.addEventListener('click', () => {
    state.open = false;
    panel.classList.add('lc-panel--closing');
    setTimeout(() => {
      if (!state.open) {
        panel.style.display = 'none';
        if (window.innerWidth <= 480) state.host.style.cssText = DESKTOP_HOST_STYLE_BP;
      }
      panel.classList.remove('lc-panel--closing');
    }, 180);
  });

  const msgsEl = panel.querySelector<HTMLDivElement>('.lc-messages')!;
  const scrollBtn = panel.querySelector<HTMLButtonElement>('.lc-scroll-btn')!;
  msgsEl.addEventListener('scroll', () => {
    const dist = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight;
    scrollBtn.style.display = dist > 120 ? 'flex' : 'none';
  });
  scrollBtn.addEventListener('click', () => {
    msgsEl.scrollTop = msgsEl.scrollHeight;
    scrollBtn.style.display = 'none';
  });

  const form = panel.querySelector<HTMLFormElement>('.lc-composer')!;
  const textarea = panel.querySelector<HTMLTextAreaElement>('textarea')!;
  const honeypot = panel.querySelector<HTMLInputElement>('.lc-hp')!;
  const sendBtn = panel.querySelector<HTMLButtonElement>('.lc-composer button[type="submit"]')!;
  const attachBtn = panel.querySelector<HTMLButtonElement>('.lc-attach-btn')!;
  const fileInput = panel.querySelector<HTMLInputElement>('.lc-file-input')!;
  const pendingEl = panel.querySelector<HTMLDivElement>('.lc-pending')!;
  const quickRepliesEl = panel.querySelector<HTMLDivElement>('.lc-quick-replies')!;
  const pendingAttachments: AttachmentSummary[] = [];

  // Bot signals — sent with each message. Server uses these to silently
  // drop traffic without alerting attackers. Real users always pass.
  const panelMountedAt = Date.now();
  let hadInteraction = false;
  textarea.addEventListener('keydown', () => { hadInteraction = true; });
  textarea.addEventListener('input', () => { hadInteraction = true; });

  // Show quick reply chips below the welcome bubble while no visitor message has
  // been sent yet. Tap = send that label as the visitor's first message.
  const renderQuickReplies = () => {
    const visitorHasSpoken = state.messages.some((m: VisitorMessage) => m.role === 'visitor');
    const chips = (siteConfig.welcomeQuickReplies ?? []).filter(Boolean);
    if (visitorHasSpoken || chips.length === 0) {
      quickRepliesEl.style.display = 'none';
      quickRepliesEl.innerHTML = '';
      return;
    }
    quickRepliesEl.style.display = 'flex';
    quickRepliesEl.innerHTML = chips
      .map((label, i) => `<button data-i="${i}" type="button">${escapeHtml(label)}</button>`)
      .join('');
    quickRepliesEl.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        const label = chips[i];
        if (!label) return;
        textarea.value = label;
        form.requestSubmit();
      });
    });
  };

  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast(panel, `File too large: ${file.name} (max 10 MB)`);
      return;
    }
    if (pendingAttachments.length >= 5) {
      showToast(panel, 'You can attach up to 5 files per message.');
      return;
    }
    if (!state.sessionId) {
      showToast(panel, 'Send a message first, then attach files.');
      return;
    }
    const placeholder: AttachmentSummary = {
      id: 'pending-' + Date.now(),
      mimeType: file.type,
      sizeBytes: file.size,
      originalFilename: file.name,
      url: '',
    };
    pendingAttachments.push(placeholder);
    renderPending();
    try {
      const att = await uploadAttachment(cfg, state.sessionId, file);
      const idx = pendingAttachments.indexOf(placeholder);
      if (idx >= 0) pendingAttachments[idx] = att;
      renderPending();
    } catch (err) {
      const idx = pendingAttachments.indexOf(placeholder);
      if (idx >= 0) pendingAttachments.splice(idx, 1);
      showToast(panel, `Upload failed: ${(err as Error).message}`);
      renderPending();
    }
  });

  function renderPending() {
    if (!pendingAttachments.length) {
      pendingEl.style.display = 'none';
      pendingEl.innerHTML = '';
      return;
    }
    pendingEl.style.display = 'flex';
    pendingEl.innerHTML = pendingAttachments
      .map((a, i) => `<span class="lc-chip"><span>${escapeHtml(a.originalFilename)}</span><button data-i="${i}" aria-label="Remove">×</button></span>`)
      .join('');
    pendingEl.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        pendingAttachments.splice(i, 1);
        renderPending();
      });
    });
  }

  let typingOffTimer: ReturnType<typeof setTimeout> | null = null;
  let typingOn = false;
  const sendTypingState = (on: boolean) => {
    if (typingOn === on) return;
    typingOn = on;
    state.socket?.emit('livechat:typing', { on });
  };
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(120, textarea.scrollHeight) + 'px';
    if (textarea.value.trim()) {
      sendTypingState(true);
      if (typingOffTimer) clearTimeout(typingOffTimer);
      typingOffTimer = setTimeout(() => sendTypingState(false), 1500);
    } else {
      sendTypingState(false);
    }
  });
  textarea.addEventListener('blur', () => sendTypingState(false));
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  // Paste-to-upload: any image in the clipboard becomes an attachment.
  textarea.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (!files.length) return;
    e.preventDefault();
    if (!state.sessionId) {
      showToast(panel, 'Send a message first, then paste images.');
      return;
    }
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        showToast(panel, `Pasted image too large: ${file.name || 'image'} (max 10 MB)`);
        continue;
      }
      if (pendingAttachments.length >= 5) break;
      const namedFile = file.name ? file : new File([file], `pasted-${Date.now()}.png`, { type: file.type });
      const placeholder: AttachmentSummary = {
        id: 'pending-' + Math.random().toString(36).slice(2),
        mimeType: file.type,
        sizeBytes: file.size,
        originalFilename: namedFile.name,
        url: '',
      };
      pendingAttachments.push(placeholder);
      renderPending();
      try {
        const att = await uploadAttachment(cfg, state.sessionId, namedFile);
        const idx = pendingAttachments.indexOf(placeholder);
        if (idx >= 0) pendingAttachments[idx] = att;
        renderPending();
      } catch (err) {
        const idx = pendingAttachments.indexOf(placeholder);
        if (idx >= 0) pendingAttachments.splice(idx, 1);
        showToast(panel, `Upload failed: ${(err as Error).message}`);
        renderPending();
      }
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (honeypot.value) return; // bot — silently drop
    const content = textarea.value.trim();
    const readyAttachments = pendingAttachments.filter((a) => a.url && !a.id.startsWith('pending-'));
    if (!content && !readyAttachments.length) return;
    if (!checkRateLimit()) {
      showToast(panel, 'Slow down — too many messages in the last minute.');
      return;
    }
    sendBtn.disabled = true;
    textarea.value = '';
    textarea.style.height = 'auto';
    sendTypingState(false);

    pushVisitor(state, content, readyAttachments);
    pendingAttachments.length = 0;
    renderPending();
    renderQuickReplies();
    render();
    showTyping(panel);

    try {
      const res: MessageResponse = await sendMessage(
        cfg,
        content,
        readyAttachments.map((a) => a.id),
        {
          hp: honeypot.value || undefined,
          elapsedMs: Date.now() - panelMountedAt,
          hadInteraction,
        },
      );
      hideTyping(panel);
      state.sessionId = res.sessionId;
      writeSessionId(res.sessionId);
      if ('content' in res.agent && res.agent.content) {
        const agentId = res.agent.id ?? '';
        if (!state.messages.some((m: VisitorMessage) => m.id === agentId && agentId)) {
          pushAgent(state, res.agent.content, agentId);
        }
      }
      if (!state.socket) connectAndListen(cfg, state, render, siteConfig);
      maybePromptEmail(panel, state);
    } catch (err) {
      hideTyping(panel);
      showToast(panel, 'Could not send — please try again.');
    }
    sendBtn.disabled = false;
    render();
  });

  // Email + name capture handlers
  const ident = panel.querySelector<HTMLDivElement>('.lc-identify')!;
  const identNameInput = ident.querySelector<HTMLInputElement>('.lc-identify-name')!;
  const identEmailInput = ident.querySelector<HTMLInputElement>('input[type="email"]')!;
  const identSave = ident.querySelectorAll<HTMLButtonElement>('button')[0];
  const identSkip = ident.querySelectorAll<HTMLButtonElement>('button')[1];
  identSave.addEventListener('click', async () => {
    const email = identEmailInput.value.trim();
    const name = identNameInput.value.trim() || undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    try {
      await identify(cfg, { email, name });
      ident.style.display = 'none';
      try { localStorage.setItem(IDENTIFY_DISMISSED_KEY, 'saved'); } catch {}
    } catch {
      // ignore
    }
  });
  identSkip.addEventListener('click', () => {
    ident.style.display = 'none';
    try { localStorage.setItem(IDENTIFY_DISMISSED_KEY, 'skipped'); } catch {}
  });

  // Initial quick-reply render — runs before the user has typed anything.
  renderQuickReplies();

  return panel;
}

function connectAndListen(cfg: WidgetConfig, state: any, render: () => void, siteConfig?: SiteConfigResponse) {
  if (!state.sessionId || state.socket) return;
  state.socket = connectVisitorSocket(cfg, state.sessionId, (event: LivechatEvent) => {
    if (event.type === 'typing') {
      const panel = state.panel as HTMLDivElement | undefined;
      if (!panel) return;
      if (event.on) showTyping(panel);
      else hideTyping(panel);
      return;
    }

    if (event.type === 'session_status' && event.status === 'closed') {
      state.socket?.disconnect();
      state.socket = null;
      state.sessionId = null;
      state.messages = [];
      state.askedForEmail = false;
      state.unread = 0;
      try { localStorage.removeItem(SESSION_KEY); } catch {}
      try { localStorage.removeItem(MESSAGES_KEY); } catch {}
      try { localStorage.removeItem(IDENTIFY_DISMISSED_KEY); } catch {}
      if (siteConfig?.welcomeMessage) {
        state.messages.push({ id: 'welcome', role: 'agent', content: siteConfig.welcomeMessage, createdAt: new Date().toISOString() });
        cacheMessages(state.messages);
      }
      render();
      return;
    }

    if (event.type !== 'message' || !event.messageId) return;
    if (event.role === 'visitor') return;
    if (state.messages.some((m: VisitorMessage) => m.id === event.messageId)) return;
    pushAgent(state, event.content ?? '', event.messageId, event.role === 'operator', (event as any).attachments, (event as any).operatorName ?? undefined);
    const panel = state.panel as HTMLDivElement | undefined;
    if (panel) hideTyping(panel);
    if (!state.open) state.unread = (state.unread ?? 0) + 1;
    render();
  });
}

function renderMessages(panel: HTMLDivElement, state: any) {
  const list = panel.querySelector<HTMLDivElement>('.lc-messages');
  if (!list) return;
  if (state.messages.length === 0) {
    list.innerHTML = `<div class="lc-empty">Send us a message — we will get right back to you.</div>`;
    return;
  }
  list.innerHTML = state.messages
    .map((m: VisitorMessage) => {
      const text = m.content ? linkifyHtml(m.content) : '';
      const atts = (m.attachments ?? []).map(renderAttachment).join('');
      const attWrapper = atts ? `<div class="lc-attachments">${atts}</div>` : '';
      const time = formatTime(m.createdAt);
      const timeEl = time ? `<div class="lc-msg-time">${time}</div>` : '';

      if (m.role === 'system') {
        return `<div class="lc-msg lc-msg-system">${text}</div>`;
      }
      if (m.role === 'visitor') {
        return `<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${text}${attWrapper}</div>
            ${timeEl}
          </div>
        </div>`;
      }
      if (m.role === 'operator' && m.operatorName) {
        const initials = getInitials(m.operatorName);
        return `<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-op" title="${escapeHtml(m.operatorName)}">${escapeHtml(initials)}</div>
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${escapeHtml(m.operatorName)}</div>
            <div class="lc-msg lc-msg-agent">${text}${attWrapper}</div>
            ${timeEl}
          </div>
        </div>`;
      }
      return `<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar">${msgBotIcon()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent">${text}${attWrapper}</div>
          ${timeEl}
        </div>
      </div>`;
    })
    .join('');
  scrollMessagesToEnd(panel);
}

function scrollMessagesToEnd(panel: HTMLDivElement) {
  const list = panel.querySelector<HTMLDivElement>('.lc-messages');
  if (list) list.scrollTop = list.scrollHeight;
}

function showTyping(panel: HTMLDivElement) {
  const list = panel.querySelector<HTMLDivElement>('.lc-messages');
  if (!list || list.querySelector('.lc-typing')) return;
  const typing = document.createElement('div');
  typing.className = 'lc-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  list.appendChild(typing);
  list.scrollTop = list.scrollHeight;
}

function hideTyping(panel: HTMLDivElement) {
  panel.querySelectorAll('.lc-typing').forEach((n) => n.remove());
}

function maybePromptEmail(panel: HTMLDivElement, state: any) {
  if (state.askedForEmail) return;
  try {
    if (localStorage.getItem(IDENTIFY_DISMISSED_KEY)) return;
  } catch {}
  if (state.messages.filter((m: VisitorMessage) => m.role === 'agent').length < 1) return;
  state.askedForEmail = true;
  const ident = panel.querySelector<HTMLDivElement>('.lc-identify');
  if (ident) ident.style.display = 'block';
}

function pushVisitor(state: any, content: string, attachments?: AttachmentSummary[]) {
  state.messages.push({
    id: 'local-' + Date.now(),
    role: 'visitor',
    content,
    createdAt: new Date().toISOString(),
    attachments,
  });
  cacheMessages(state.messages);
}
function pushAgent(state: any, content: string, id: string, asOperator = false, attachments?: AttachmentSummary[], operatorName?: string) {
  state.messages.push({
    id: id || 'srv-' + Date.now(),
    role: asOperator ? 'operator' : 'agent',
    content,
    createdAt: new Date().toISOString(),
    attachments,
    operatorName,
  });
  cacheMessages(state.messages);
}
function pushSystem(state: any, content: string) {
  state.messages.push({ id: 'sys-' + Date.now(), role: 'system', content, createdAt: new Date().toISOString() });
  cacheMessages(state.messages);
}

function checkRateLimit(): boolean {
  try {
    const now = Date.now();
    const log: number[] = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) ?? '[]').filter((t: number) => now - t < RATE_LIMIT_WINDOW_MS);
    if (log.length >= RATE_LIMIT_MAX) return false;
    log.push(now);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(log));
    return true;
  } catch {
    return true;
  }
}

function readSessionId(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
function writeSessionId(id: string) {
  try { localStorage.setItem(SESSION_KEY, id); } catch {}
}
function readCachedMessages(): VisitorMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function cacheMessages(messages: VisitorMessage[]) {
  try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-50))); } catch {}
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function sanitizeColor(c: string | null | undefined): string | null {
  if (!c) return null;
  const trimmed = c.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  return trimmed;
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderAttachment(a: AttachmentSummary): string {
  const isImage = a.mimeType.startsWith('image/');
  if (isImage && a.url) {
    return `<a href="${escapeAttr(a.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${escapeAttr(a.url)}" alt="${escapeAttr(a.originalFilename)}" /></a>`;
  }
  const size = formatBytes(a.sizeBytes);
  const href = a.url ? escapeAttr(a.url) : '#';
  return `<a class="lc-attach-file" href="${href}" target="_blank" rel="noopener noreferrer">${fileIcon()}<span>${escapeHtml(a.originalFilename)}</span><span class="lc-attach-size">${size}</span></a>`;
}

/** Escape text and convert any http(s) URLs into rel-safe links opening in a new tab. */
function linkifyHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    // Strip a trailing punctuation that's likely sentence-ending, not part of the URL.
    const m = url.match(/[.,;:!?)]+$/);
    const tail = m ? m[0] : '';
    const clean = tail ? url.slice(0, -tail.length) : url;
    return `<a href="${escapeAttr(clean)}" target="_blank" rel="noopener noreferrer nofollow">${clean}</a>${tail}`;
  });
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function showToast(panel: HTMLDivElement, message: string, duration = 3500) {
  const toast = panel.querySelector<HTMLDivElement>('.lc-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout((toast as any)._timer);
  (toast as any)._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function attachIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>`;
}

function fileIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
}

function chatIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
}

function botAvatarIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
}

function msgBotIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
}

function chevronDownIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
}

function sendIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
}
