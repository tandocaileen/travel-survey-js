/**
 * EmailJS Configuration
 * ─────────────────────────────────────────────────────────────
 * 1. Sign up at https://www.emailjs.com (free tier = 200 emails/mo)
 * 2. Add an Email Service (Gmail, Outlook, etc.)
 * 3. Create an Email Template — use these template variables:
 *      {{survey_title}}   — survey name
 *      {{respondent_name}} — who filled it out
 *      {{email_body}}     — full formatted answers (HTML)
 * 4. Fill in the values below and save.
 * ─────────────────────────────────────────────────────────────
 */
const EMAILJS_CONFIG = {
    publicKey: 'YOUR_PUBLIC_KEY',    // Account → API Keys → Public Key
    serviceId: 'YOUR_SERVICE_ID',    // Email Services → Service ID
    templateId: 'YOUR_TEMPLATE_ID',   // Email Templates → Template ID
    toEmail: 'your.email@example.com',  // Where survey results are sent
};
