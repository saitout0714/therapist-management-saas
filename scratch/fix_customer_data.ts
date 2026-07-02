import { supabaseAdmin } from '../lib/supabaseAdmin'

async function fixCust() {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .update({ email: null })
    .eq('id', '825c9083-ce5a-4a49-923a-4aad95b879ff');
  
  if (error) {
    console.error("Failed to fix customer email:", error);
  } else {
    console.log("Successfully cleared incorrect email '備考：' for customer ヨシダ トモエ");
  }
}

fixCust();
