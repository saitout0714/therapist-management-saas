import { createClient } from '@supabase/supabase-js';
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';
const supabase = createClient(dbUrl, serviceRoleKey);

async function run() {
  console.log('=== DUPLICATE CUSTOMERS ANALYSIS ===');
  const shopId = '92c51e51-339b-48ce-8535-0f45c859b195'; // こころリンス
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, shop_id')
    .eq('shop_id', shopId);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total customers in shop: ${customers.length}`);

  const sCustomers = customers.filter(c => c.name.startsWith('s'));
  const normalCustomers = customers.filter(c => !c.name.startsWith('s'));

  console.log(`s-prefixed customers: ${sCustomers.length}`);
  console.log(`normal customers: ${normalCustomers.length}`);

  const duplicates: Array<{ sCustomer: any, normalCustomer: any }> = [];

  for (const sCust of sCustomers) {
    const targetName = sCust.name.substring(1); // 's'を除去
    const match = normalCustomers.find(nc => nc.name === targetName);
    if (match) {
      duplicates.push({
        sCustomer: sCust,
        normalCustomer: match
      });
    }
  }

  console.log(`Found duplicate pairs: ${duplicates.length}`);
  console.log('Sample duplicate pairs:');
  console.log(duplicates.slice(0, 10).map(d => `${d.sCustomer.name} (ID: ${d.sCustomer.id}) -> ${d.normalCustomer.name} (ID: ${d.normalCustomer.id})`));
}
run();
