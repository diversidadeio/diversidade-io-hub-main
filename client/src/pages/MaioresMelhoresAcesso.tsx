import { useEffect, useState } from "react";
import { MolduraMm } from "@/components/maiores-melhores/Moldura";
import { mm } from "@/components/maiores-melhores/estilo";
import { mmApi, salvarTokenParticipante } from "@/lib/maioresMelhoresApi";

/**
 * Página aberta pelo link do e-mail de acesso (token no fragmento #).
 * O link só é consumido quando a pessoa clica no botão: assim, programas de segurança de e-mail que
 * "abrem" os links para verificar não gastam o link antes dela.
 */
export default function MaioresMelhoresAcesso() {
  const [token, setToken] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    document.title = "Acessar minha inscrição | Maiores & Melhores";
    // Lê o token ao abrir e também quando só o fragmento muda (outro link do e-mail aberto na mesma aba).
    const ler = () => {
      const valor = window.location.hash.slice(1);
      setToken(valor);
      setOcupado(false);
      setMensagem(
        /^[0-9a-f]{64}$/.test(valor)
          ? ""
          : "Abra o link completo que você recebeu por e-mail. Se preferir, peça um novo link informando o CNPJ da empresa.",
      );
    };
    ler();
    window.addEventListener("hashchange", ler);
    return () => window.removeEventListener("hashchange", ler);
  }, []);

  async function entrar() {
    if (ocupado) return;
    setOcupado(true);
    setMensagem("");
    try {
      const r = await mmApi.acessoConfirmar(token);
      salvarTokenParticipante(r.token);
      // O link não deve ficar no histórico do navegador.
      history.replaceState(null, "", window.location.pathname);
      window.location.replace("/maiores-e-melhores");
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : "Não foi possível abrir a inscrição.");
      setOcupado(false);
    }
  }

  const valido = /^[0-9a-f]{64}$/.test(token);

  return (
    <MolduraMm>
      <section className={`${mm.painel} my-8 max-w-[680px]`}>
        <p className={`${mm.sobrancelha} text-[#5c2686]`}>Maiores &amp; Melhores</p>
        <h1 className={mm.titulo}>Acessar minha inscrição</h1>
        {mensagem && <p role="alert" className={`${mm.falha} mb-4`}>{mensagem}</p>}
        {valido && (
          <div className={mm.pilha}>
            <p className="m-0">
              Confirme para entrar na inscrição da sua empresa neste navegador. Daqui em diante você volta direto, sem precisar pedir
              outro link.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className={mm.botao} disabled={ocupado} onClick={() => void entrar()}>
                {ocupado ? "Entrando…" : "Entrar na minha inscrição"}
              </button>
              {mensagem && <a className={mm.botaoSecundario} href="/maiores-e-melhores">Pedir novo link</a>}
            </div>
          </div>
        )}
        {!valido && <a className={mm.botaoSecundario} href="/maiores-e-melhores">Pedir novo link</a>}
      </section>
    </MolduraMm>
  );
}
