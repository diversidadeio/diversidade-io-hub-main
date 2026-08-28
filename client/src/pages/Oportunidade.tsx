import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { registrarLog } from "@/lib/registrarLog";
import {
  Loader2, MapPin, Monitor, CalendarClock, FileText, Download,
  CheckCircle2, LogIn, Lock, Building2, AlertCircle,
  ArrowLeft, Sparkles, XCircle, Share2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import logoImage from "@/assets/logo.png";
import {
  infoPrazo, tituloOportunidade, montarLinkOportunidade,
  copiarParaAreaDeTransferencia, mensagemCompartilhamento,
} from "@/lib/oportunidade";
import { toast } from "sonner";

interface Oportunidade {
  id: string;
  titulo: string | null;
  cnaes: string[];
  cidade: string;
  modalidade: "online" | "presencial" | "ambos";
  descricao: string | null;
  documento_url: string | null;
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  prazo_final: string | null;
  criado_em: string;
  empresa: {
    razao_social: string | null;
    nome_fantasia: string | null;
    logo_empresa_url: string | null;
    area_empresa: string | null;
    sobre_empresa: string | null;
  };
  minha_participacao: { quer_participar: boolean; mensagem: string | null; criado_em: string } | null;
  total_visualizacoes: number;
  total_interessados: number;
}

const ROTULOS_MODALIDADE: Record<string, string> = {
  online: "🌐 Online",
  presencial: "📍 Presencial",
  ambos: "✅ Online e Presencial",
};

/** Cabeçalho enxuto — a página é aberta a partir de um link compartilhado. */
function Cabecalho() {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/">
          <a className="flex items-center gap-2 shrink-0">
            <img src={logoImage} alt="Diversidade.io" className="h-7 sm:h-8" />
          </a>
        </Link>
        <Link href="/meu-cadastro/pesquisas">
          <a className="text-sm font-medium text-[#7030A0] dark:text-purple-400 hover:underline">
            Minha conta
          </a>
        </Link>
      </div>
    </header>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Cabecalho />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
    </div>
  );
}

export default function Oportunidade() {
  const [, params] = useRoute("/oportunidades/:id");
  const id = params?.id;
  const { isLogado, isCarregando, usuario } = useAuth();

  const [oportunidade, setOportunidade] = useState<Oportunidade | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<"nao_encontrada" | "sem_sessao" | "desativado" | "prazo_encerrado" | "generico" | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const linkAtual = id ? montarLinkOportunidade(id) : "";

  useEffect(() => {
    if (isCarregando) return;
    if (!isLogado) { setCarregando(false); return; }
    carregar();
  }, [id, isLogado, isCarregando]);

  async function carregar() {
    if (!id) { setErro("nao_encontrada"); setCarregando(false); return; }
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.rpc("obter_oportunidade", { p_id: id });

      if (error) {
        const msg = error.message || "";
        if (msg.includes("nao_autenticado")) setErro("sem_sessao");
        else if (msg.includes("nao_encontrada")) setErro("nao_encontrada");
        else if (msg.includes("link_desativado")) setErro("desativado");
        else if (msg.includes("prazo_encerrado")) setErro("prazo_encerrado");
        else { console.error("Erro ao carregar oportunidade:", error); setErro("generico"); }
        return;
      }

      if (!data) { setErro("nao_encontrada"); return; }

      setOportunidade(data as Oportunidade);
      setMensagem((data as Oportunidade).minha_participacao?.mensagem || "");

      // Registra o clique no link compartilhado (deduplicado no banco por 30 min)
      supabase.rpc("registrar_visualizacao_oportunidade", {
        p_id: id,
        p_user_agent: navigator.userAgent,
        p_origem: document.referrer || null,
      }).then(({ error: errView }) => {
        if (errView) console.error("Erro ao registrar visualização:", errView);
      });

      registrarLog({
        tipo_evento: "oportunidade_visualizada",
        email: usuario?.email,
        empresa_id: (usuario as any)?.empresaId,
        detalhes: `Oportunidade ${id}`,
      });
    } catch (err) {
      console.error("Erro ao carregar oportunidade:", err);
      setErro("generico");
    } finally {
      setCarregando(false);
    }
  }

  async function responder(participar: boolean) {
    if (!id || enviando) return;
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("responder_oportunidade", {
        p_id: id,
        p_participar: participar,
        p_mensagem: mensagem.trim() || null,
      });
      if (error) throw error;

      setOportunidade((prev) => prev ? {
        ...prev,
        minha_participacao: { quer_participar: participar, mensagem: mensagem.trim() || null, criado_em: new Date().toISOString() },
        total_interessados: prev.total_interessados + (participar ? (prev.minha_participacao?.quer_participar ? 0 : 1) : (prev.minha_participacao?.quer_participar ? -1 : 0)),
      } : prev);

      toast.success(participar ? "Interesse registrado! A empresa será avisada." : "Resposta registrada.");

      registrarLog({
        tipo_evento: participar ? "oportunidade_interesse" : "oportunidade_sem_interesse",
        email: usuario?.email,
        empresa_id: (usuario as any)?.empresaId,
        detalhes: `Oportunidade ${id}`,
      });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("prazo_encerrado")) {
        toast.error("O prazo desta oportunidade encerrou.");
        setErro("prazo_encerrado");
      } else if (msg.includes("link_desativado")) {
        toast.error("O link desta oportunidade foi desativado.");
        setErro("desativado");
      } else {
        toast.error("Não foi possível registrar sua resposta. " + msg);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function compartilhar() {
    if (!oportunidade) return;
    const texto = mensagemCompartilhamento(oportunidade, linkAtual);
    if (navigator.share) {
      try {
        await navigator.share({ title: tituloOportunidade(oportunidade), text: texto, url: linkAtual });
        return;
      } catch {
        // usuário cancelou — cai para a cópia
      }
    }
    const ok = await copiarParaAreaDeTransferencia(linkAtual);
    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success("Link copiado!");
    }
  }

  // ── Estados de carregamento / bloqueio ───────────────────────────────────
  if (isCarregando || (isLogado && carregando)) {
    return (
      <Moldura>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" />
        </div>
      </Moldura>
    );
  }

  if (!isLogado || erro === "sem_sessao") {
    const destino = `/login?redirect=${encodeURIComponent(`/oportunidades/${id ?? ""}`)}`;
    return (
      <Moldura>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-[#7030A0] dark:text-purple-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Conteúdo exclusivo para cadastrados
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm sm:text-base max-w-md mx-auto">
            {erro === "sem_sessao"
              ? "Sua sessão expirou. Entre novamente para ver os detalhes desta oportunidade."
              : "Entre na sua conta Diversidade.io para ver os detalhes desta oportunidade e manifestar interesse em participar."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
            <a
              href={destino}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#7030A0] text-white font-medium hover:bg-purple-800 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Entrar na minha conta
            </a>
            <Link href="/cadastro-gratuito">
              <a className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <Sparkles className="w-4 h-4" />
                Criar cadastro gratuito
              </a>
            </Link>
          </div>
        </div>
      </Moldura>
    );
  }

  if (erro || !oportunidade) {
    const textos: Record<string, { titulo: string; detalhe: string }> = {
      nao_encontrada: { titulo: "Oportunidade não encontrada", detalhe: "Este link pode ter expirado ou o endereço está incorreto." },
      desativado: { titulo: "Link desativado", detalhe: "A empresa responsável desativou o compartilhamento desta oportunidade." },
      prazo_encerrado: { titulo: "Prazo encerrado", detalhe: "O prazo para manifestar interesse nesta oportunidade já passou e o link foi encerrado automaticamente." },
      generico: { titulo: "Não foi possível carregar", detalhe: "Ocorreu um erro ao buscar os dados. Tente novamente em instantes." },
    };
    const t = textos[erro || "generico"];
    return (
      <Moldura>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 sm:p-10 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.titulo}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{t.detalhe}</p>
          <Link href="/meu-cadastro/pesquisas">
            <a className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-[#7030A0] dark:text-purple-400 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Voltar para a plataforma
            </a>
          </Link>
        </div>
      </Moldura>
    );
  }

  // ── Página da oportunidade ───────────────────────────────────────────────
  const prazo = infoPrazo(oportunidade.prazo_final);
  const encerrada = oportunidade.status === "concluido" || oportunidade.status === "cancelado";
  const respondida = oportunidade.minha_participacao;
  const nomeEmpresa = oportunidade.empresa?.nome_fantasia || oportunidade.empresa?.razao_social || "Empresa incentivadora";

  return (
    <Moldura>
      <div className="space-y-5">
        {/* Cartão principal */}
        <article className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Faixa superior */}
          <div className="bg-gradient-to-r from-[#7030A0] to-purple-500 px-5 sm:px-8 py-5 sm:py-6">
            <p className="text-purple-100 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Oportunidade para empreendedores
            </p>
            <h1 className="text-xl sm:text-3xl font-bold text-white leading-tight break-words">
              {tituloOportunidade(oportunidade)}
            </h1>
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            {/* Empresa solicitante */}
            <div className="flex items-center gap-3">
              {oportunidade.empresa?.logo_empresa_url ? (
                <img
                  src={oportunidade.empresa.logo_empresa_url}
                  alt={nomeEmpresa}
                  className="w-12 h-12 rounded-xl object-contain bg-white border border-gray-200 dark:border-gray-600 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6 text-[#7030A0] dark:text-purple-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Publicado por</p>
                <p className="font-semibold text-gray-900 dark:text-white truncate">{nomeEmpresa}</p>
              </div>
            </div>

            {/* Informações rápidas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5" /> Local
                </p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{oportunidade.cidade}</p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1.5 mb-1">
                  <Monitor className="w-3.5 h-3.5" /> Modalidade
                </p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{ROTULOS_MODALIDADE[oportunidade.modalidade]}</p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-4 py-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1.5 mb-1">
                  <CalendarClock className="w-3.5 h-3.5" /> Prazo
                </p>
                {prazo ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{prazo.data}</p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${prazo.cor}`}>
                      {prazo.texto}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">Sem prazo definido</p>
                )}
              </div>
            </div>

            {/* CNAEs */}
            {oportunidade.cnaes?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Atividades procuradas (CNAE)
                </p>
                <div className="flex flex-wrap gap-2">
                  {oportunidade.cnaes.map((cnae, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium border border-purple-100 dark:border-purple-800">
                      {cnae}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Descrição */}
            {oportunidade.descricao && (
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Descrição da oportunidade
                </p>
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-4 text-sm sm:text-base text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                  {oportunidade.descricao}
                </div>
              </div>
            )}

            {/* Documento */}
            {oportunidade.documento_url && (
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Documento anexado
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={oportunidade.documento_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Visualizar documento
                  </a>
                  <a
                    href={oportunidade.documento_url}
                    download
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Baixar
                  </a>
                </div>
              </div>
            )}

            {/* Data de publicação — os números de alcance ficam só no painel,
                não são exibidos para quem recebe o link. */}
            <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-4">
              Publicada em {new Date(oportunidade.criado_em).toLocaleDateString("pt-BR")}
            </div>
          </div>
        </article>

        {/* Cartão de participação */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 sm:p-8">
          {encerrada || prazo?.encerrado ? (
            <div className="text-center py-2">
              <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="font-semibold text-gray-700 dark:text-gray-200">
                {prazo?.encerrado ? "O prazo para manifestar interesse encerrou." : "Esta oportunidade já foi encerrada."}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Continue acompanhando a plataforma para novas oportunidades.
              </p>
            </div>
          ) : respondida?.quer_participar ? (
            <div className="text-center py-2">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-900 dark:text-white text-lg">Interesse registrado!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                A empresa responsável e a equipe Diversidade.io receberam sua manifestação de interesse e podem entrar em contato.
              </p>
              <Button
                variant="ghost"
                onClick={() => responder(false)}
                disabled={enviando}
                className="mt-4 text-gray-500 hover:text-red-600 dark:text-gray-400"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Retirar meu interesse
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quer participar desta oportunidade?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Conte um pouco da sua experiência com esse tipo de proposta. Ao confirmar, seus dados de
                cadastro e o que você escrever são enviados para a empresa responsável.
              </p>

              {respondida && !respondida.quer_participar && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                  <XCircle className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Você marcou que não tem interesse. Mudou de ideia? É só confirmar abaixo.
                  </p>
                </div>
              )}

              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={3}
                placeholder="Conte sua experiência com esse tipo de trabalho: o que você já fez, quanto tempo atua na área e por que se encaixa nesta proposta (opcional)"
                className="mt-4 resize-none dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <Button
                  onClick={() => responder(true)}
                  disabled={enviando}
                  className="flex-1 h-11 bg-[#7030A0] hover:bg-purple-800 text-white"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Quero participar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => responder(false)}
                  disabled={enviando}
                  className="flex-1 h-11 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                >
                  Não tenho interesse
                </Button>
              </div>
            </>
          )}

          <button
            onClick={compartilhar}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#7030A0] dark:hover:text-purple-400 transition-colors"
          >
            {copiado ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
            {copiado ? "Link copiado" : "Compartilhar esta oportunidade"}
          </button>
        </section>
      </div>
    </Moldura>
  );
}
