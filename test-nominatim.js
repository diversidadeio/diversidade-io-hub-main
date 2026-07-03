(async () => {
  const headers = { 'User-Agent': 'DiversidadeApp/1.0 (tecnologia@diversidade.io)' };
  
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=Rua+Coriolano,+Vila+Romana,+SP,+Brasil', { headers });
    const data = await res.json();
    console.log("Nominatim Address:", JSON.stringify(data, null, 2));
  } catch(e) { console.error(e) }

  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=Vila+Romana,+SP,+Brasil', { headers });
    const data = await res.json();
    console.log("Nominatim Bairro, SP:", JSON.stringify(data, null, 2));
  } catch(e) { console.error(e) }

  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=S%C3%A3o+Paulo,+SP,+Brasil', { headers });
    const data = await res.json();
    console.log("Nominatim Cidade, SP:", JSON.stringify(data, null, 2));
  } catch(e) { console.error(e) }
  
})();
