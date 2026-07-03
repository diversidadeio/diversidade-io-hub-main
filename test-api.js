(async () => {
  try {
    const res = await fetch('https://brasilapi.com.br/api/cep/v2/05047001');
    const data = await res.json();
    console.log("BrasilAPI:", JSON.stringify(data, null, 2));
  } catch(e) { console.error(e) }

  try {
    const res2 = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=05047001&countrycodes=br&email=tecnologia@diversidade.io');
    const data2 = await res2.json();
    console.log("Nominatim CEP:", JSON.stringify(data2, null, 2));
  } catch(e) { console.error(e) }
  
  try {
    const res3 = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=Rua+Coriolano,+Vila+Romana,+S%C3%A3o+Paulo,+SP,+Brasil&email=tecnologia@diversidade.io');
    const data3 = await res3.json();
    console.log("Nominatim Address:", JSON.stringify(data3, null, 2));
  } catch(e) { console.error(e) }
})();
