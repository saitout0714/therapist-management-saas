
import { syncTherapistToEstama } from "./lib/sync/estama-therapist";
import { syncTherapistToEstheRanking } from "./lib/sync/esthe-ranking-therapist";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const shopId = "dc3caa06-fcc2-4bdc-b063-7969296efd34"; // âV“¡÷—æŽq shop
  const therapistId = "efa75b28-06da-4238-8d1c-d2c07e12b8aa"; // âV“¡÷—æŽq

  const { data: shop } = await supabase.from("shops").select("*").eq("id", shopId).single();
  const { data: therapist } = await supabase.from("therapists").select("*").eq("id", therapistId).single();
  const { data: photos } = await supabase.from("therapist_photos").select("*").eq("therapist_id", therapistId).order("display_order");
  
  therapist.photo_urls = photos?.map(p => p.photo_url) || [];

  console.log("Testing Estama Sync for:", therapist.name);
  console.log("Photo URLs:", therapist.photo_urls);
  try {
    const res = await syncTherapistToEstama("https://estama.jp/", shop.estama_login_id!, shop.estama_password!, therapist, therapist.estama_therapist_id);
    console.log("Estama Result:", res);
  } catch(e) { console.error(e); }

  console.log("Testing ER Sync...");
  try {
    const res2 = await syncTherapistToEstheRanking("https://www.esthe-ranking.jp/", shop.esthe_ranking_login_id!, shop.esthe_ranking_password!, therapist, therapist.esthe_ranking_therapist_id);
    console.log("ER Result:", res2);
  } catch(e) { console.error(e); }
}
run();

