export const keysBasedOnEnv = () => {
  if (import.meta.env.MODE.toLowerCase() === "production") {
    // PRODUCTION
    return {
      // Supabase
      supabase: {
        url: import.meta.env.VITE_SUPABASE_URL_PROD,
        apiKey: import.meta.env.VITE_SUPABASE_API_KEY_PROD,
      },
      // Cloudinary
      cloudinary: {
        name: import.meta.env.VITE_CLOUDINARY_NAME,
        preset: import.meta.env.VITE_CLOUDINARY_PRESET_PROD,
      },
      // Stripe
      stripe: {
        publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_PROD,
      },
    };
  } else {
    // Non-Prod
    return {
      // Supabase
      supabase: {
        url: import.meta.env.VITE_SUPABASE_URL,
        apiKey: import.meta.env.VITE_SUPABASE_API_KEY,
      },
      // Cloudinary
      cloudinary: {
        name: import.meta.env.VITE_CLOUDINARY_NAME,
        preset: import.meta.env.VITE_CLOUDINARY_PRESET_TEST,
      },
      // Stripe
      stripe: {
        publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST,
      },
    };
  }
};
