async function run() {
  console.log("Fetching local api...");
  const start = Date.now();
  try {
    const res = await fetch("http://localhost:3000/api/public/kokororinse-asakusabashi");
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data keys:", Object.keys(data));
    console.log("Therapists count in API:", data.therapists ? data.therapists.length : 0);
  } catch (err) {
    console.error("Fetch error:", err);
  }
  console.log("Elapsed ms:", Date.now() - start);
}
run();
