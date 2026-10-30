export interface QA {
  q: string;
  a: string;
}

export const FAQS: QA[] = [
  {
    q: 'What is an eSIM?',
    a: 'An eSIM is a digital SIM card built into your phone. Instead of a physical card, you scan a QR code and a mobile data plan is installed — no shop, no waiting. Your normal SIM stays in the phone, so you keep your home number for calls and WhatsApp.',
  },
  {
    q: 'Will it work on my phone?',
    a: 'Your phone must be eSIM-capable and carrier-unlocked. The quickest check: dial *#06#. If you see an EID number, your phone supports eSIM. Most iPhones from XS (2018) and recent Samsung, Google Pixel, and other flagships are supported.',
  },
  {
    q: 'How do I install it?',
    a: 'After paying, you get a QR code instantly. On Wi-Fi, go to Settings → Mobile/Cellular → Add eSIM, and scan the code. We strongly recommend installing before you fly, while you still have internet at home.',
  },
  {
    q: 'When does my data start counting?',
    a: 'Your data package follows the travel dates chosen at checkout, including both the start and end dates. You can install the eSIM on Wi-Fi before travelling. Check your order for the confirmed package dates.',
  },
  {
    q: 'Can I still use WhatsApp and my home number?',
    a: 'Yes. The eSIM only carries data. Your physical SIM stays active for your number, calls, and SMS — just turn off data roaming on it to avoid charges, and use the eSIM for internet.',
  },
  {
    q: 'How do I pay?',
    a: 'Pay in Kenyan Shillings with mobile money (you get an STK PIN prompt on your phone) or with a Visa/Mastercard. Prices already include all fees — what you see is what you pay.',
  },
  {
    q: 'What if my data runs out?',
    a: 'You can top up or buy a new plan any time from your dashboard. We also alert you at 50%, 80% and 100% usage so you are never caught off guard.',
  },
  {
    q: 'What is your refund policy?',
    a: 'Because eSIMs are delivered instantly and tied to your device, we cannot refund a plan once the QR has been issued and the device is compatible. If we ever fail to deliver a working eSIM, you are refunded automatically.',
  },
];
