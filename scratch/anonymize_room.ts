import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const roomId = '1abfbaa9-a3c6-41b8-a743-bd6a15654f0b';

  const updateData = {
    name: 'ルームC',
    display_name: 'マンションC 805',
    address: '〇〇県〇〇市〇〇 1丁目1-1 〇〇マンション805号室',
    google_map_url: 'https://maps.app.goo.gl/example_map',
    address_nearby: '〇〇県〇〇市〇〇 1丁目1-1',
    google_map_url_nearby: 'https://maps.app.goo.gl/example_map',
    sms_note_new_customer: '近所に〇〇店（パチンコ屋）がございます。\nこちらからお電話ください。\n\n080-0000-0000\n\n⚠️こちら当店のキャンセルポリシーになります。\nご新規のお客様にお送りさせていただいておりますのでご一読くださいませ。\n\n当日のキャンセル、並びに予約時間無断で10分過ぎた場合キャンセルとみなし、100％のキャンセル料金が発生いたします。',
    sms_note_member: '⚠️地上1階の〇〇店とスギ薬局の間からお入りください。\n※スタート時間丁度にインターホンをお願い致します。',
    template_member: '近所の方への配慮として、インターホンや玄関で声を出すのはお控え頂きたく、ご協力をお願いします。\n\n〇〇ルームのご案内です。\n\n〒000-0000\n〇〇県〇〇市〇〇 1丁目1-1 〇〇マンション805号室\n\n⚠️地上1階の〇〇店とスギ薬局の間からお入りください。\n\nhttps://maps.app.goo.gl/example_map\n\n※スタート時間丁度にインターホンをお願い致します。',
    template_new_customer: '近所の方への配慮として、インターホンや玄関で声を出すのはお控え頂きたく、ご協力をお願いします。\n\n〇〇ルームのご案内です。\n\n〒000-0000\n〇〇県〇〇市〇〇 1丁目1-1\nこちらに〇〇店がございます。\nこちらからお電話ください。\n\nhttps://maps.app.goo.gl/example_map\n\n080-0000-0000\n\n⚠️こちら当店のキャンセルポリシーになります。\nご新規のお客様にお送りさせていただいておりますのでご一読くださいませ。\n\n当日のキャンセル、並びに予約時間無断で10分過ぎた場合キャンセルとみなし、100％のキャンセル料金が発生いたします。'
  };

  const { data, error } = await supabase
    .from('rooms')
    .update(updateData)
    .eq('id', roomId)
    .select();

  if (error) {
    console.error('Error updating room:', error);
    return;
  }

  console.log('Room updated successfully:', data);
}

main();
