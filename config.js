/*
  AERUNE COMMERCE CORE — V2
  Start in demo mode. The demo works within ONE browser on ONE device.

  To make the website, POS and Control Booth share live changes across devices:
  1) Run supabase/schema.sql in a Supabase project.
  2) Paste that project's URL and public anon key below.
  3) Set demoMode to false.

  Never put a Supabase service_role key here, in GitHub, or in a browser.
*/
window.COMMERCE_CONFIG = {
  demoMode: true,
  supabaseUrl: 'PASTE_YOUR_SUPABASE_PROJECT_URL_HERE',
  supabaseAnonKey: 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE',
  defaultStorefront: 'aerune'
};
