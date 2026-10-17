// Supabase public browser configuration.
// This is safe to ship with the website when RLS policies are configured correctly.
window.SUPABASE_URL = 'https://zaknvxgavhwcyhrdions.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5o6X5A-BLo3y2d3SSbNnJA_ZlNHrFpi';
if (window.supabase && window.SUPABASE_URL && window.SUPABASE_PUBLISHABLE_KEY) {
  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );
}
