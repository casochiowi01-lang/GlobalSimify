export interface LegalDoc {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string }[];
}

// NOTE: placeholder copy for development. Have a Kenyan lawyer review before launch.
export const LEGAL: Record<string, LegalDoc> = {
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    updated: '2026-05-29',
    intro:
      'These terms govern your use of GlobalSimify and the purchase of travel eSIM data plans.',
    sections: [
      {
        heading: 'The service',
        body: 'GlobalSimify resells mobile data eSIM plans supplied by third-party connectivity providers for use while travelling abroad. We are a reseller, not a mobile network operator.',
      },
      {
        heading: 'Eligibility & devices',
        body: 'You are responsible for confirming that your device is eSIM-capable and carrier-unlocked before purchase. We provide tools to help you check, and you must confirm compatibility at checkout.',
      },
      {
        heading: 'Pricing & payment',
        body: 'Plan prices are displayed in US dollars. Checkout confirms the price for your selected travel dates, quantity and eligible discount, and shows the exact Kenyan Shilling (KES) amount to be collected by Paystack. Review that amount before paying. Your bank or payment provider may apply separate conversion charges. Catalogue estimates and AI chat quotes do not reserve a price.',
      },
      {
        heading: 'Delivery',
        body: 'eSIM activation details are delivered electronically, usually within minutes of successful payment. It is your responsibility to install the eSIM, ideally before travelling.',
      },
      {
        heading: 'Acceptable use',
        body: 'Plans are for personal travel data use and subject to the fair-use and coverage terms of the underlying network. Reselling or abuse may result in suspension.',
      },
      {
        heading: 'Liability',
        body: 'We are not liable for network outages, coverage gaps, or device incompatibility. Our maximum liability is limited to the amount you paid for the affected plan.',
      },
      {
        heading: 'Contact',
        body: 'Questions? Reach us via the WhatsApp button or support@globalsimify.com.',
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    updated: '2026-09-17',
    intro:
      'How we collect, use, and protect your personal data, in line with Kenya’s Data Protection Act, 2019.',
    sections: [
      {
        heading: 'Data we collect',
        body: 'Your phone number, email (if provided), order and payment metadata, eSIM identifiers (ICCID), and basic device/usage information needed to provide the service.',
      },
      {
        heading: 'How we use it',
        body: 'To create and deliver your eSIM, process payments, provide support, send service notifications (e.g. data alerts), and meet legal obligations.',
      },
      {
        heading: 'Legal basis & consent',
        body: 'We process data to perform our contract with you and with your consent for optional communications. You can withdraw consent at any time.',
      },
      {
        heading: 'Sharing',
        body: 'We share only what is necessary with our connectivity provider (to provision your eSIM) and payment processor (to take payment). We do not sell your data.',
      },
      {
        heading: 'Optional AI support chat',
        body: 'When enabled, AI support chat is optional. Before sending a question, you are asked to agree to sending your messages and relevant store or own-account summaries to OpenAI to generate an answer. Account lookups require you to sign in. The account tools do not send activation codes, QR codes, full ICCIDs, supplier credentials or payment credentials to the AI provider. Do not include these or login codes in your messages. You can use the normal website and contact support without AI chat. Chat history is held in the page session and clears when you reload, clear chat or sign out. We request that API responses are not stored for later retrieval; this is not a promise of zero provider retention, and provider security/abuse-monitoring rules still apply. AI answers may be incorrect; normal checkout confirms prices and processes payments.',
      },
      {
        heading: 'Your rights',
        body: 'Under the Data Protection Act, 2019 you may access, correct, or request deletion of your data, and lodge a complaint with the Office of the Data Protection Commissioner (ODPC).',
      },
      {
        heading: 'Retention & security',
        body: 'We retain data only as long as needed for service and legal purposes, and protect it with encryption in transit and access controls.',
      },
      { heading: 'Contact', body: 'Data requests: privacy@globalsimify.com.' },
    ],
  },
  refunds: {
    slug: 'refunds',
    title: 'Refund Policy',
    updated: '2026-05-29',
    intro: 'When refunds apply, and when they do not.',
    sections: [
      {
        heading: 'Instant digital goods',
        body: 'eSIMs are delivered instantly and tied to your device. Once the activation QR has been issued, a plan generally cannot be refunded.',
      },
      {
        heading: 'Incompatible devices',
        body: 'We ask you to confirm your device is eSIM-capable and unlocked at checkout. Refunds are not available where a plan cannot be used due to an incompatible or locked device.',
      },
      {
        heading: 'Failed delivery',
        body: 'If an eSIM has not been delivered, contact support with your order reference. We first reconcile the payment and supplier outcome to avoid duplicate purchases. Eligible refunds are reviewed and returned through the original payment provider; do not assume an immediate automatic refund while an order is under review.',
      },
      {
        heading: 'Network issues at destination',
        body: 'Coverage depends on local networks. Genuine, verifiable total loss of service may be eligible for partial credit at our discretion — contact support.',
      },
      {
        heading: 'How to request',
        body: 'Contact support via WhatsApp or support@globalsimify.com with your order details.',
      },
    ],
  },
};
