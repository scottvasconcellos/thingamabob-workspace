/*
 * Sync configuration.
 *
 * THIS FILE IS PUBLIC ON PURPOSE. It ships to the browser and lives in a public
 * repo, so treat `secret` as "unlisted", not as a password: it stops casual
 * drive-by writes and nothing more. Anyone with the site URL can read this.
 * => Never put anything private, financial, or medical in a thing-a-ma-bob.
 * To rotate the secret, redeploy the Apps Script with a new one and update it
 * here (and in every other app using the shared backend).
 *
 * Leave `endpoint` starting with "PASTE_" and the app runs happily local-only,
 * with no network calls at all.
 */
window.TMB_CONFIG = {
  // Which backend adapter to use: 'apps-script' or 'supabase'.
  kind: 'apps-script',

  // Namespace for this app's data in the shared backend. Must be unique per
  // app; every key this app saves lives under it.
  appId: 'thingamabob-workspace',

  // 'explicit' — the app calls TMB.get()/TMB.set() itself (this app).
  // 'mirror'   — transparently mirror whatever the app puts in localStorage.
  mode: 'explicit',

  // --- Apps Script backend ---------------------------------------------
  // Paste the Web app URL from Deploy → New deployment here. It ends in /exec.
  // Until you do, the app runs local-only and makes no network calls at all.
  // Setup instructions: ../../backend/README.md
  endpoint: 'PASTE_APPS_SCRIPT_EXEC_URL_HERE',

  // Already matches SHARED_SECRET in backend/Code.gs. Unlisted, not secret.
  secret: 'tmb-61zMv-xKvPfd4d7XLyw4k8s'

  // --- Supabase backend (only if kind is 'supabase') --------------------
  // endpoint: 'https://YOUR-PROJECT.supabase.co',
  // anonKey: 'YOUR_ANON_KEY'   // anon key only — never the service-role key
};
