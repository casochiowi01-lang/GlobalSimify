import { MessageCircle } from 'lucide-react';

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '254710204662';

export function WhatsAppFab() {
  const href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    'Hi GlobalSimify, I need help with my eSIM.',
  )}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition hover:scale-105 hover:bg-green-600"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
