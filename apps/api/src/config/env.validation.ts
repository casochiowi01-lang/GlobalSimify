import { z } from 'zod';

/**
 * Single source of truth for environment configuration.
 * Anything the app reads from the environment is declared, typed, and
 * validated here. Boot fails fast with a readable error if something is wrong.
 */
export const envSchema = z.object({
  // Defaults to production so a missing variable can never expose dev-only
  // behaviour such as returning login codes in API responses.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Public base URL of this API (used for building webhook callback URLs).
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  // Comma-separated list of allowed CORS origins (the web app).
  CORS_ORIGINS: z.string().default('http://localhost:3001'),

  // Database / cache. Optional so the app can boot in a degraded mode for
  // early development before infra is provisioned.
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  BACKGROUND_MODE: z.enum(['in-process', 'cloud-tasks']).default('in-process'),
  BACKGROUND_ROLE: z.enum(['api', 'worker']).default('api'),
  TASKS_QUEUE_PATH: z
    .string()
    .regex(/^projects\/[a-z0-9-]+\/locations\/[a-z0-9-]+\/queues\/[a-z0-9-]+$/)
    .optional(),
  WORKER_URL: z.string().url().optional(),
  TASKS_INVOKER_EMAIL: z.string().email().optional(),

  // Provider adapters. When keys are absent we fall back to MOCK mode so
  // development is never blocked on real accounts (and no billable purchases).
  CELITECH_MODE: z.enum(['mock', 'live']).default('mock'),
  CELITECH_CLIENT_ID: z.string().optional(),
  CELITECH_CLIENT_SECRET: z.string().optional(),
  // SDK environment. Only PRODUCTION exists today; set to a sandbox/test value
  // here the moment Celitech offers one (no code change needed).
  CELITECH_ENVIRONMENT: z.literal('PRODUCTION').default('PRODUCTION'),
  CELITECH_ALLOW_RESTRICTED: z.enum(['true', 'false']).default('false'),
  CELITECH_WEBHOOK_SECRET: z.string().optional(),
  LIVE_SALES_ENABLED: z.enum(['true', 'false']).default('false'),
  // Controlled acceptance test: only authenticated active database admins can pay.
  LIVE_SALES_ADMIN_ONLY: z.enum(['true', 'false']).default('false'),

  // Paystack (payments). `mock` = no real account, no billable charges; `live`
  // = real secret/public keys. Charges are in KES (Paystack Kenya), supporting
  // M-Pesa (mobile_money) and cards. Webhooks are verified by HMAC-SHA512
  // signature (x-paystack-signature) over the raw body using the secret key.
  PAYSTACK_MODE: z.enum(['mock', 'live']).default('mock'),
  PAYSTACK_SECRET_KEY: z.string().trim().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().trim().optional(),

  // Pricing engine knobs (overridable at runtime via Settings later).
  // Platform currency is USD: prices are computed/displayed in USD. The USD→KES
  // rate only converts the charge for Paystack (which collects in KES) and is
  // snapshotted onto each order.
  PRICING_FX_BUFFER_PCT: z.coerce.number().min(0).max(1).default(0.03),
  PRICING_MARGIN_PCT: z.coerce.number().min(0).max(5).default(0.35),
  PRICING_PROCESSOR_FEE_PCT: z.coerce.number().min(0).lt(1).default(0.035),
  PRICING_ROUND_TO: z.coerce.number().nonnegative().default(0.5),
  FX_USD_KES_FALLBACK: z.coerce.number().positive().default(129),

  // SMS (OTP + eSIM delivery). `mock` logs to the server; `africastalking` sends
  // real SMS. AT sandbox is used automatically when USERNAME = "sandbox".
  SMS_PROVIDER: z.enum(['mock', 'africastalking']).default('mock'),
  AFRICASTALKING_USERNAME: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_SENDER_ID: z.string().optional(), // approved sender id / short code

  // Email (login OTP + eSIM delivery). SMTP works with any provider.
  EMAIL_PROVIDER: z.enum(['mock', 'smtp']).default('mock'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('GlobalSimify <support@globalsimify.com>'),

  // WhatsApp (eSIM delivery) via Meta Cloud API.
  WHATSAPP_PROVIDER: z.enum(['mock', 'meta']).default('mock'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v20.0'),

  // Google Sign-In: OAuth client id used to verify Google ID tokens server-side
  // (same value the frontend uses). Sign-in is disabled if unset.
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Apple Sign-In: the Services ID (audience of Apple's id_token). Disabled if unset.
  APPLE_CLIENT_ID: z.string().optional(),

  // Phone-OTP login is on hold (email OTP is active). Flip to true to re-enable.
  AUTH_PHONE_OTP_ENABLED: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(false),

  // Web Push (VAPID). Optional — push is disabled if keys are absent.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:support@globalsimify.com'),

  // Website assistant is explicitly opt-in. Keys stay server-side.
  OPENAI_API_KEY: z.string().trim().optional(),
  ASSISTANT_ENABLED: z.enum(['true', 'false']).default('false'),
  ASSISTANT_MODEL: z.string().default('gpt-5-mini'),
  ASSISTANT_DAILY_REQUEST_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(200),

  // Bootstrap admin allowlist — comma-separated emails that are auto-granted
  // the ADMIN role on login (so the first admin can exist without a DB write).
  ADMIN_EMAILS: z.string().default(''),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default('dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (
    env.BACKGROUND_MODE === 'cloud-tasks' &&
    (!env.TASKS_QUEUE_PATH ||
      !env.WORKER_URL?.startsWith('https://') ||
      !env.TASKS_INVOKER_EMAIL)
  ) {
    throw new Error(
      'Cloud Tasks requires a queue path, private HTTPS worker URL and invoker service account.',
    );
  }
  if (
    env.NODE_ENV === 'production' &&
    (env.JWT_ACCESS_SECRET.startsWith('dev-') ||
      env.JWT_REFRESH_SECRET.startsWith('dev-'))
  ) {
    throw new Error('Production requires private JWT secrets.');
  }
  if (
    env.CELITECH_MODE === 'live' &&
    (!env.CELITECH_CLIENT_ID || !env.CELITECH_CLIENT_SECRET)
  ) {
    throw new Error(
      'CELITECH live catalogue requires both client credentials.',
    );
  }
  if (
    env.LIVE_SALES_ENABLED === 'true' &&
    (env.CELITECH_MODE !== 'live' ||
      env.PAYSTACK_MODE !== 'live' ||
      !env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_') ||
      !env.PAYSTACK_PUBLIC_KEY?.startsWith('pk_live_') ||
      env.EMAIL_PROVIDER !== 'smtp')
  ) {
    throw new Error(
      'Live sales require live CELITECH, matching live Paystack keys, and SMTP delivery.',
    );
  }
  return env;
}
