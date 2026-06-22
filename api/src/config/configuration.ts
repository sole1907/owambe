export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d',
  },
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
  platformFeePct: 4, // 4% of each bucket payment
  platformFeeCapNaira: 40000, // ₦40,000 total cap across all bucket payments
  cronSecret: process.env.CRON_SECRET,
  posthogKey: process.env.POSTHOG_KEY,
  testEmailIntercept: process.env.TEST_EMAIL_INTERCEPT,
})
