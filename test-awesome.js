(async () => {
  try {
    const res = await fetch('https://cep.awesomeapi.com.br/json/05047001');
    const data = await res.json();
    console.log("AwesomeAPI:", JSON.stringify(data, null, 2));
  } catch(e) { console.error(e) }
})();
