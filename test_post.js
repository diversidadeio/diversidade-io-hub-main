async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/registrar-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "teste@script.com",
        tipo_evento: "teste_via_post",
        empresa_id: "6d8d5bae-87f1-47e7-95d0-a9ebc6afb8c0",
        nome_empresa: "Teste"
      })
    });
    
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch(e) {
    console.error("Error fetching:", e);
  }
}
run();
