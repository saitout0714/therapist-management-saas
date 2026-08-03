import { fetchStoreConfig, fetchTherapists, fetchBlogArticles, fetchNewsList, fetchCampaigns } from '../lib/storeApi';

async function test() {
  console.log('--- Testing fetchStoreConfig ---');
  const store = await fetchStoreConfig('specialgrade');
  console.log('Store:', store.name, store.address);

  console.log('--- Testing fetchTherapists ---');
  const therapists = await fetchTherapists(store.id);
  console.log('Therapists count:', therapists.length, therapists.map(t => t.name));

  console.log('--- Testing fetchBlogArticles ---');
  const blogs = await fetchBlogArticles(store.id);
  console.log('Blogs count:', blogs.length, blogs.map(b => b.title));

  console.log('--- Testing fetchNewsList ---');
  const news = await fetchNewsList(store.id);
  console.log('News count:', news.length, news.map(n => n.title));

  console.log('--- Testing fetchCampaigns ---');
  const campaigns = await fetchCampaigns(store.id);
  console.log('Campaigns count:', campaigns.length);
}

test().catch(console.error);
