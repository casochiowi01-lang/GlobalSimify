'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Send, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Card {
  kind: 'plan' | 'quote' | 'account' | 'help';
  title: string;
  lines: string[];
  href: string;
  label: string;
}
interface Msg {
  role: 'user' | 'assistant';
  content: string;
  cards?: Card[];
}
interface Reply {
  reply: string;
  cards: Card[];
  available: boolean;
}
// Navigation comes only from verified server cards, never from generated prose.
function safeHref(href: string) {
  return /^\/(?:destinations(?:\/[^?#]*)?|plan\/[^/?#]+|account(?:\/esims)?(?:#esim-[\w%-]+)?|order\/[^/?#]+|login\?next=%2Faccount%2Fesims|help|how-it-works|compatibility|legal\/(?:privacy|refunds))$/.test(
    href,
  )
    ? href
    : '/help';
}

export function AskAi() {
  const { user, status } = useAuth();
  const path = usePathname();
  if (path.startsWith('/admin') || status === 'loading') return null;
  // Switching accounts or signing out destroys private messages and outstanding requests.
  return <AssistantPanel key={`${status}:${user?.id ?? 'guest'}`} />;
}

function AssistantPanel() {
  const { status, authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    let current = true;
    authFetch<{ enabled: boolean }>('/assistant/status', { cache: 'no-store' })
      .then((r) => {
        if (current) setEnabled(r.enabled);
      })
      .catch(() => {
        if (current) setEnabled(false);
      });
    field.current?.focus();
    return () => {
      current = false;
    };
  }, [open, authFetch]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [messages, busy]);

  function clear() {
    pending.current?.abort();
    pending.current = null;
    setMessages([]);
    setInput('');
    setBusy(false);
  }
  function close() {
    setOpen(false);
    button.current?.focus();
  }
  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !consent || !enabled || status === 'loading') return;
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 70000);
    // Only plain messages, never UI cards or credentials, are submitted as conversation context.
    const history = next
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1600) }));
    while (
      history.length > 1 &&
      history.reduce((n, m) => n + m.content.length, 0) > 10000
    )
      history.shift();
    try {
      const data = await authFetch<Reply>('/assistant/chat', {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({ messages: history }),
      });
      if (mounted.current && pending.current === controller) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: data.reply, cards: data.cards },
        ]);
        setEnabled(data.available);
      }
    } catch (error) {
      if (mounted.current && pending.current === controller)
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: (error as Error).message.startsWith('429')
              ? 'Too many questions in a short time. Please wait a minute.'
              : 'Chat could not finish. Try again, or contact support. No purchase was made.',
          },
        ]);
    } finally {
      clearTimeout(timeout);
      if (mounted.current && pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <>
      <button
        ref={button}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open GlobalSimify support"
        aria-expanded={open}
        aria-controls="store-assistant"
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg hover:bg-teal-800"
      >
        {open ? <X /> : <Sparkles />}
      </button>
      {open && (
        <section
          id="store-assistant"
          role="dialog"
          aria-label="GlobalSimify support assistant"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
          className="fixed bottom-40 right-3 z-40 flex max-h-[calc(100dvh-11rem)] w-[min(25rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:right-5"
        >
          <header className="flex items-center gap-2 bg-teal-700 px-4 py-3 text-white">
            <Sparkles className="h-5 w-5" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold">GlobalSimify assistant</h2>
              <p className="text-xs">Plans, trip quotes &amp; your eSIMs</p>
            </div>
            <button
              onClick={clear}
              aria-label="Clear chat"
              className="rounded p-1 hover:bg-teal-800"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={close}
              aria-label="Close chat"
              className="rounded p-1 hover:bg-teal-800"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div
            ref={scroll}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
            style={{ minHeight: 'min(18rem, 35dvh)' }}
          >
            <div className="flex flex-wrap gap-3 text-xs font-medium text-teal-800">
              <Link href="/destinations">Browse plans</Link>
              <Link
                href={
                  status === 'authed'
                    ? '/account/esims'
                    : '/login?next=%2Faccount%2Fesims'
                }
              >
                My eSIMs / sign in
              </Link>
              <Link href="/help">Contact support</Link>
            </div>
            {enabled === false ? (
              <p className="text-sm text-zinc-600">
                AI chat is not available right now. The website links above
                still work.
              </p>
            ) : (
              <>
                <p className="text-xs text-zinc-500">
                  AI can make mistakes. Verified price cards show store
                  estimates or dated quotes; checkout confirms the final price.
                  Payments and top-ups stay in normal checkout.
                </p>
                {!consent && (
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
                    <p>
                      Using AI chat sends your messages and relevant plan or
                      own-account summaries to OpenAI. Don’t share payment
                      details, login codes or eSIM activation codes. Chat clears
                      when you sign out or reload.
                    </p>
                    <Link
                      href="/legal/privacy"
                      className="mt-1 inline-block underline"
                    >
                      Privacy information
                    </Link>
                    <label className="mt-3 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      I understand and want to use AI chat.
                    </label>
                  </div>
                )}
                {consent && !messages.length && (
                  <div className="flex flex-col gap-2">
                    {[
                      'What plans are available for Dubai?',
                      'Show my eSIMs',
                      'How do I install my eSIM?',
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        disabled={busy || !enabled}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-teal-50 disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="space-y-3"
            >
              {messages.map((m, i) => (
                <div key={i} className="space-y-2">
                  <p
                    className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-7 bg-teal-700 text-white' : 'bg-zinc-100 text-zinc-800'}`}
                  >
                    {m.content}
                  </p>
                  {m.cards?.map((card, c) => (
                    <div
                      key={c}
                      className={`rounded-xl border p-3 text-xs ${card.kind === 'quote' ? 'border-teal-400 bg-teal-50' : 'border-zinc-200'}`}
                    >
                      <p className="font-semibold text-zinc-900">
                        {card.title}
                      </p>
                      {card.lines.map((line, n) => (
                        <p key={n} className="mt-1 text-zinc-600">
                          {line}
                        </p>
                      ))}
                      <Link
                        href={safeHref(card.href)}
                        onClick={close}
                        className="mt-2 inline-block font-semibold text-teal-800 underline"
                      >
                        {card.label}
                      </Link>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {busy && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-zinc-500"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking the store…
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-zinc-100 p-3"
          >
            <input
              ref={field}
              aria-label="Question for the assistant"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a trip or your eSIM…"
              maxLength={1600}
              disabled={!consent || !enabled || status === 'loading'}
              className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
            />
            <button
              type="submit"
              aria-label="Send question"
              disabled={
                busy ||
                !input.trim() ||
                !consent ||
                !enabled ||
                status === 'loading'
              }
              className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
