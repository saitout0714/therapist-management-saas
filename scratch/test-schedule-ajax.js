async function test() {
  const url = 'https://carezza.esthe-hp.com/ajax/getdayscheduleitemlist/dayNum/1/nowPage/1/';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body length:', text.length);
    console.log('Body snippet:', text.slice(0, 2000));
  } catch (err) {
    console.error(err);
  }
}

test();
