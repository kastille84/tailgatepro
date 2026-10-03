exports.keysBasedOnEnv = () => {
  if ((process.env.NODE_ENV || "").toLowerCase() === "production") {
    console.log("production");
    // PRODUCTION
    return {
      clientUrl: "https://getTailgatePro.com",
      // Mailgun
      mailgun: {
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
      },
      // Supabase
      supabase: {
        url: process.env.SUPABASE_URL_PROD,
        apiKey: process.env.SUPABASE_API_KEY_PROD,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY_PROD,
        deleteUserUrl: process.env.SUPABASE_DB_DELETE_USER_URL_PROD,
      },
      // Cloudinary
      cloudinary: {
        name: process.env.CLOUDINARY_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
      },
      // Stripe
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY_PROD,
        price_trade_pro_monthly:
          process.env.STRIPE_PRICE_TRADE_PRO_MONTHLY_PROD,
        price_trade_pro_annual: process.env.STRIPE_PRICE_TRADE_PRO_ANNUAL_PROD,
        price_trade_enterprise_monthly:
          process.env.STRIPE_PRICE_TRADE_ENTERPRISE_MONTHLY_PROD,
        price_trade_enterprise_annual:
          process.env.STRIPE_PRICE_TRADE_ENTERPRISE_ANNUAL_PROD,
        price_gc_portfolio_10_sites_monthly:
          process.env.STRIPE_PRICE_GC_PORTFOLIO_10_SITES_MONTHLY_PROD,
        price_gc_portfolio_10_sites_annual:
          process.env.STRIPE_PRICE_GC_PORTFOLIO_10_SITES_ANNUAL_PROD,
        price_gc_portfolio_unlimited_sites_monthly:
          process.env.STRIPE_PRICE_GC_PORTFOLIO_UNLIMITED_SITES_MONTHLY_PROD,
        price_gc_portfolio_unlimited_sites_annual:
          process.env.STRIPE_PRICE_GC_PORTFOLIO_UNLIMITED_SITES_ANNUAL_PROD,
        price_gc_site_pro_monthly:
          process.env.STRIPE_PRICE_GC_SITE_PRO_MONTHLY_PROD,
        price_gc_site_pro_annual:
          process.env.STRIPE_PRICE_GC_SITE_PRO_ANNUAL_PROD,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET_PROD,
      },
      // Google Cloud Translation API -- premium/enterprise-tier custom talk
      // translation only (server/services/translation.js). Unset = feature
      // disabled everywhere it's used, never a hard error.
      googleTranslate: {
        apiKey: process.env.GOOGLE_TRANSLATE_API_KEY_PROD,
      },
      // Tamper-evidence content seal (Phase 9e, server/utility/contentSeal.js,
      // docs/tamper-evidence-design.md) -- HMAC-SHA256 key for meeting_logs'
      // content_seal. Never sent to the client. Unlike googleTranslate above,
      // contentSeal.js throws if this is unset rather than silently degrading
      // — an unsealed "completed" meeting would be a silent trust hole.
      meetingLogSeal: {
        secret: process.env.MEETING_LOG_SEAL_SECRET_PROD,
      },
      // Procore/ACC integration credential encryption (Phase 9f,
      // server/utility/secretBox.js). 32-byte key, base64. secretBox.js
      // throws if unset, same fail-loud rule as meetingLogSeal.
      integrations: {
        encryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY_PROD,
      },
      // Twilio SMS (Phase 9e, server/services/sms.js, docs/sms-nudges-design.md)
      // -- Toll-Free Verified number. Unset = nudges silently off, never a
      // hard error (googleTranslate pattern). `webhookUrl` is the public URL
      // of POST /webhook/twilio/sms, needed to verify Twilio's signature.
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID_PROD,
        authToken: process.env.TWILIO_AUTH_TOKEN_PROD,
        fromNumber: process.env.TWILIO_FROM_NUMBER_PROD,
        webhookUrl: process.env.TWILIO_WEBHOOK_URL_PROD,
      },
    };
  } else {
    console.log("not production");
    // Non-Prod
    return {
      clientUrl: "https://localhost:5173",
      // Mailgun
      mailgun: {
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
      },
      // Supabase
      supabase: {
        url: process.env.SUPABASE_URL,
        apiKey: process.env.SUPABASE_API_KEY,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        deleteUserUrl: process.env.SUPABASE_DB_DELETE_USER_URL,
      },
      // Cloudinary
      cloudinary: {
        name: process.env.CLOUDINARY_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
      },
      // Stripe
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY_TEST,
        price_trade_pro_monthly: process.env.STRIPE_PRICE_TRADE_PRO_MONTHLY,
        price_trade_pro_annual: process.env.STRIPE_PRICE_TRADE_PRO_ANNUAL,
        price_trade_enterprise_monthly:
          process.env.STRIPE_PRICE_TRADE_ENTERPRISE_MONTHLY,
        price_trade_enterprise_annual:
          process.env.STRIPE_PRICE_TRADE_ENTERPRISE_ANNUAL,
        price_gc_portfolio_10_sites_monthly:
          process.env.STRIPE_PRICE_GC_PORTFOLIO_10_SITES_MONTHLY,
        price_gc_portfolio_10_sites_annual:
          process.env.STRIPE_PRICE_GC_PORTFOLIO_10_SITES_ANNUAL,
        price_gc_portfolio_unlimited_sites_monthly:
          process.env.STRIPE_PRICE_GC_PORTFOLIO_UNLIMITED_SITES_MONTHLY,
        price_gc_portfolio_unlimited_sites_annual:
          process.env.STRIPE_PRICE_GC_PORTFOLIO_UNLIMITED_SITES_ANNUAL,
        price_gc_site_pro_monthly: process.env.STRIPE_PRICE_GC_SITE_PRO_MONTHLY,
        price_gc_site_pro_annual: process.env.STRIPE_PRICE_GC_SITE_PRO_ANNUAL,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      },
      // Google Cloud Translation API -- see the prod branch's comment.
      googleTranslate: {
        apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
      },
      // Tamper-evidence content seal -- see the prod branch's comment.
      meetingLogSeal: {
        secret: process.env.MEETING_LOG_SEAL_SECRET,
      },
      // Integration credential encryption -- see the prod branch's comment.
      integrations: {
        encryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY,
      },
      // Twilio SMS -- see the prod branch's comment.
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER,
        webhookUrl: process.env.TWILIO_WEBHOOK_URL,
      },
    };
  }
};
