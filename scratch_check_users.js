import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.log("Missing credentials.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const email = "tecnologia@diversidade.io";
  const { data: userData, error: userError } = await supabaseAdmin
    .from('empresa_usuarios')
    .select('auth_user_id')
    .eq('email', email)
    .limit(1)
    .single();

  if (userError) {
    console.error("User query error:", userError);
    return;
  }
  
  const authUserId = userData?.auth_user_id;
  console.log("User auth ID from DB:", authUserId);

  if (authUserId) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      { password: "TestPassword123!" }
    );
    if (updateError) {
      console.error("Update error:", updateError);
    } else {
      console.log("Password updated successfully!");
    }
  }
}

run();
