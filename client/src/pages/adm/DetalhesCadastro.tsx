import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Key, ExternalLink, Building2, User, CreditCard, Users, FileText, CheckCircle2, MapPin, Clock, XCircle, AlertTriangle, ChevronUp, ChevronDown, ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapaImpactados from "@/components/MapaImpactados";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { registrarLog } from "@/lib/registrarLog";
import { Edit2 } from "lucide-react";
import ModalUsuariosEmpresa from "@/components/adm/ModalUsuariosEmpresa";

// ─── Lógica de completude (espelho do Cadastros.tsx) ────────────────────────

const CAMPOS_OBRIGATORIOS_EMPRESA = [
  { campo: "razao_social",       label: "Razão Social",        secao: "Dados da Empresa" },
  { campo: "cnpj",               label: "CNPJ",                secao: "Dados da Empresa" },
  { campo: "nome_responsavel",   label: "Nome do Responsável", secao: "Responsável" },
  { campo: "telefone_principal", label: "Telefone Principal",  secao: "Responsável" },
  { campo: "area_empresa",       label: "Área de Atuação",     secao: "Dados da Empresa" },
  { campo: "sobre_empresa",      label: "Sobre a Empresa",     secao: "Dados da Empresa" },
];

const CAMPOS_OBRIGATORIOS_SOCIO = [
  { campo: "nome",                    label: "Nome" },
  { campo: "cpf",                     label: "CPF" },
  { campo: "email",                   label: "E-mail" },
  { campo: "cep",                     label: "CEP" },
  { campo: "data_nascimento",         label: "Data de Nascimento" },
  { campo: "nacionalidade",           label: "Nacionalidade" },
  { campo: "raca",                    label: "Raça/Cor" },
  { campo: "participacao_percentual", label: "Participação %" },
  { campo: "participacao_valor",      label: "Valor da Participação" },
];

interface ItemFaltando {
  label: string;
  secao: string;
}

function calcularCamposFaltando(emp: any, listaSocios: any[]): ItemFaltando[] {
  const faltando: ItemFaltando[] = [];

  for (const { campo, label, secao } of CAMPOS_OBRIGATORIOS_EMPRESA) {
    if (!emp[campo] || String(emp[campo]).trim() === "") {
      faltando.push({ label, secao });
    }
  }

  if (emp.acesso_tipo !== "EMPRESA OU INICIATIVA INCENTIVADORA") {
    if (listaSocios.length === 0) {
      faltando.push({ label: "Pelo menos 1 sócio cadastrado", secao: "Quadro Societário" });
    } else {
      listaSocios.forEach((socio, idx) => {
        const secao = `Sócio ${idx + 1}${socio.nome ? ` — ${socio.nome}` : ""}`;
        for (const { campo, label } of CAMPOS_OBRIGATORIOS_SOCIO) {
          if (socio[campo] == null || String(socio[campo]).trim() === "") {
            faltando.push({ label, secao });
          }
        }
      });
    }
  }

  return faltando;
}

// ─── Painel flutuante de campos faltando (somente leitura, para admin) ───────

function PainelCamposFaltandoAdm({ empresa, socios }: { empresa: any; socios: any[] }) {
  const [aberto, setAberto] = useState(true);

  const itens = calcularCamposFaltando(empresa, socios);
  const tudoOk = itens.length === 0;

  const grupos = new Map<string, string[]>();
  itens.forEach(({ label, secao }) => {
    if (!grupos.has(secao)) grupos.set(secao, []);
    grupos.get(secao)!.push(label);
  });

  return (
    <div
      style={{
        position: "fixed",
        right: "16px",
        bottom: "24px",
        width: "290px",
        zIndex: 50,
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(112, 48, 160, 0.18)",
        border: tudoOk ? "2px solid #22c55e" : "2px solid #ef4444",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: tudoOk
            ? "linear-gradient(135deg, #16a34a, #22c55e)"
            : "linear-gradient(135deg, #ef4444, #dc2626)",
          color: "#fff",
          cursor: "pointer",
          border: "none",
          gap: "8px",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px" }}>
          {tudoOk ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {tudoOk
            ? "✅ Cadastro completo!"
            : `${itens.length} campo${itens.length > 1 ? "s" : ""} faltando`}
        </span>
        {aberto ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {aberto && (
        <div style={{ maxHeight: "420px", overflowY: "auto", padding: "8px 0" }}>
          {tudoOk ? (
            <p style={{ padding: "12px 14px", fontSize: "13px", color: "#16a34a", textAlign: "center" }}>
              Todos os campos obrigatórios estão preenchidos. 🎉
            </p>
          ) : (
            Array.from(grupos.entries()).map(([secao, campos]) => (
              <div key={secao}>
                <p
                  style={{
                    padding: "6px 14px 4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#ef4444",
                    borderTop: "1px solid #f0e8f8",
                    marginTop: "4px",
                  }}
                >
                  {secao}
                </p>
                {campos.map((campo, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "7px 14px 7px 22px",
                      fontSize: "13px",
                      color: "#374151",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ color: "#FF9500", fontSize: "10px" }}>●</span>
                    {campo}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Badge de Situação CNPJ ───────────────────────────────────────────────────

export type SituacaoCNPJ = "ATIVA" | "INAPTA" | "BAIXADA" | "SUSPENSA" | "NULA" | "NAO_ENCONTRADO" | "ERRO_CONSULTA" | "CNPJ_INVALIDO" | null | undefined;

const CONFIG_SITUACAO: Record<string, { label: string; cor: string; icone: React.ReactNode }> = {
  ATIVA:         { label: "Ativa",          cor: "bg-green-100 text-green-700 border-green-200",   icone: <ShieldCheck className="w-3 h-3" /> },
  INAPTA:        { label: "Inapta",         cor: "bg-orange-100 text-orange-700 border-orange-200", icone: <ShieldAlert className="w-3 h-3" /> },
  BAIXADA:       { label: "Baixada",        cor: "bg-red-100 text-red-700 border-red-200",          icone: <ShieldOff className="w-3 h-3" /> },
  SUSPENSA:      { label: "Suspensa",       cor: "bg-yellow-100 text-yellow-700 border-yellow-200", icone: <ShieldAlert className="w-3 h-3" /> },
  NULA:          { label: "Nula",           cor: "bg-gray-100 text-gray-500 border-gray-200",       icone: <ShieldQuestion className="w-3 h-3" /> },
  NAO_ENCONTRADO:{ label: "Não encontrado", cor: "bg-gray-100 text-gray-500 border-gray-200",       icone: <ShieldQuestion className="w-3 h-3" /> },
  ERRO_CONSULTA: { label: "Erro",           cor: "bg-gray-100 text-gray-500 border-gray-200",       icone: <ShieldQuestion className="w-3 h-3" /> },
  CNPJ_INVALIDO: { label: "CNPJ inválido",  cor: "bg-gray-100 text-gray-400 border-gray-200",       icone: <ShieldQuestion className="w-3 h-3" /> },
};

function BadgeSituacaoCNPJ({
  situacao,
  verificadoEm,
}: {
  situacao: SituacaoCNPJ;
  verificadoEm: string | null;
}) {
  if (!situacao) {
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <span className="inline-flex justify-center items-center gap-1.5 w-[115px] py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200 text-xs whitespace-nowrap">
          <ShieldQuestion className="w-3 h-3" />
          Não verificado
        </span>
      </div>
    );
  }
  const config = CONFIG_SITUACAO[situacao] || {
    label: situacao,
    cor: "bg-gray-100 text-gray-500 border-gray-200",
    icone: <ShieldQuestion className="w-3 h-3" />,
  };
  const dataFormatada = verificadoEm
    ? new Date(verificadoEm).toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span
        className={`inline-flex justify-center items-center gap-1.5 w-[115px] py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${config.cor}`}
        title={dataFormatada ? `Verificado em ${dataFormatada}` : undefined}
      >
        {config.icone}
        {config.label}
      </span>
      {dataFormatada && (
        <span className="text-[10px] text-gray-400">{dataFormatada}</span>
      )}
    </div>
  );
}


export default function DetalhesCadastroAdm() {
  const [, params] = useRoute("/adm/cadastros/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { usuario } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [deletando, setDeletando] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);
  const [socios, setSocios] = useState<any[]>([]);
  const [ceps, setCeps] = useState<any[]>([]);
  const [erro, setErro] = useState("");

  const [gerandoSenha, setGerandoSenha] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [dialogoSalaAberta, setDialogoSalaAberta] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [verificandoCnpj, setVerificandoCnpj] = useState(false);
  const [modalUsuariosAberto, setModalUsuariosAberto] = useState(false);

  const handleVerificarCNPJ = async () => {
    if (!empresa?.id || !empresa?.cnpj) return;
    setVerificandoCnpj(true);
    try {
      const resposta = await fetch('/api/verificar-cnpj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresa.id, cnpj: empresa.cnpj }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Erro ao verificar CNPJ");
      }
      setEmpresa((prev: any) => ({
        ...prev,
        situacao_cnpj: dados.situacao,
        situacao_cnpj_verificado_em: dados.verificado_em,
      }));
      toast.success("Situação do CNPJ verificada!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerificandoCnpj(false);
    }
  };

  const [dialogoManualAberto, setDialogoManualAberto] = useState(false);
  const [novaSituacaoManual, setNovaSituacaoManual] = useState<SituacaoCNPJ>("ATIVA");
  const [salvandoManual, setSalvandoManual] = useState(false);

  const handleAtualizarSituacaoManual = async () => {
    if (!empresa?.id) return;
    setSalvandoManual(true);
    try {
      const verificadoEm = new Date().toISOString();
      const { error } = await supabase
        .from('empresas')
        .update({
          situacao_cnpj: novaSituacaoManual,
          situacao_cnpj_verificado_em: verificadoEm,
        })
        .eq('id', empresa.id);

      if (error) throw error;

      setEmpresa((prev: any) => ({
        ...prev,
        situacao_cnpj: novaSituacaoManual,
        situacao_cnpj_verificado_em: verificadoEm,
      }));
      toast.success("Situação do CNPJ atualizada manualmente!");
      
      registrarLog({
        tipo_evento: 'adm_atualizou_cnpj_manual',
        empresa_id: empresa.id,
        nome_empresa: empresa.razao_social || empresa.nome_fantasia || empresa.email,
        email: usuario?.email || 'admin',
        detalhes: `Atualizou manualmente o CNPJ da empresa para: ${novaSituacaoManual}`,
      });

      setDialogoManualAberto(false);
    } catch (err: any) {
      toast.error('Erro ao atualizar: ' + err.message);
    } finally {
      setSalvandoManual(false);
    }
  };

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      try {
        const { data: emp, error: errEmp } = await supabase.from('empresas').select('*').eq('id', id).single();
        if (errEmp || !emp) throw new Error("Cadastro não encontrado.");
        setEmpresa(emp);

        // Registra log de admin visualizando empresa
        registrarLog({
          tipo_evento: 'adm_ver_empresa',
          empresa_id: id,
          nome_empresa: emp.razao_social || emp.nome_fantasia || emp.email,
          email: usuario?.email || 'admin',
          detalhes: `Visualizou o cadastro da empresa: ${emp.razao_social || emp.nome_fantasia || emp.email}`,
        });

        const { data: soc } = await supabase.from('socios').select('*').eq('empresa_id', id);
        setSocios(soc || []);

        const { data: cepList } = await supabase.from('ceps_impactados').select('*').eq('empresa_id', id);
        setCeps(cepList || []);
      } catch (err: any) {
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [id]);

  const handleGerarSenha = async () => {
    if (!id) return;
    setGerandoSenha(true);
    setSenhaGerada(null);
    try {
      const { data, error } = await supabase.rpc('gerar_senha_temporaria', { p_empresa_id: id });
      if (error) throw error;
      setSenhaGerada(data);
      setDialogoSalaAberta(true);

      // Registra log de geração de senha pelo admin
      registrarLog({
        tipo_evento: 'adm_gerar_senha',
        empresa_id: id,
        nome_empresa: empresa?.razao_social || empresa?.email,
        email: usuario?.email || 'admin',
        detalhes: `Gerou uma nova senha temporária para a empresa: ${empresa?.razao_social || empresa?.email}`,
      });
    } catch (err: any) {
      alert("Erro ao gerar senha: " + err.message);
    } finally {
      setGerandoSenha(false);
    }
  };

  const handleDeletar = async () => {
    if (!id || !empresa) return;
    const confirmacao = window.confirm("Tem certeza que deseja deletar a empresa e TODOS os usuários vinculados a ela? Esta ação é IRREVERSÍVEL.");
    if (!confirmacao) return;

    setDeletando(true);
    try {
      const { error } = await supabase.rpc('deletar_empresa_completo', { p_empresa_id: id });
      if (error) throw error;
      
      registrarLog({
        tipo_evento: 'adm_deletar_empresa',
        empresa_id: id,
        nome_empresa: empresa?.razao_social || empresa?.email,
        email: usuario?.email || 'admin',
        detalhes: `Deletou o cadastro da empresa: ${empresa?.razao_social || empresa?.email} e todos os usuários vinculados.`,
      });

      toast.success("Empresa e usuários deletados com sucesso!");
      setLocation('/adm/cadastros');
    } catch (err: any) {
      toast.error('Erro ao deletar: ' + err.message);
      setDeletando(false);
    }
  };

  const handleAprovar = async () => {
    if (!id || !empresa) return;
    setAprovando(true);
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ status_aprovacao: 'aprovado' })
        .eq('id', id);

      if (error) throw error;

      setEmpresa({ ...empresa, status_aprovacao: 'aprovado' });
      toast.success('Cadastro aprovado com sucesso! Um e-mail será enviado à empresa.');

      // Registra log de aprovação pelo admin
      registrarLog({
        tipo_evento: 'adm_aprovar_empresa',
        empresa_id: id,
        nome_empresa: empresa?.razao_social || empresa?.email,
        email: usuario?.email || 'admin',
        detalhes: `Aprovou o cadastro da empresa: ${empresa?.razao_social || empresa?.email}`,
      });

      // Disparar e-mail de aprovação via rota da Vercel (Resend)
      try {
        await fetch('/api/enviar-email-aprovacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: empresa.email, nome: empresa.nome })
        });
      } catch (e) {
        console.error("Erro ao chamar API de e-mail:", e);
        // E-mail é melhor esforço; não bloqueia a aprovação
      }
    } catch (err: any) {
      toast.error('Erro ao aprovar: ' + err.message);
    } finally {
      setAprovando(false);
    }
  };

  if (carregando) {
    return (
      <LayoutAdm>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" />
        </div>
      </LayoutAdm>
    );
  }

  if (erro || !empresa) {
    return (
      <LayoutAdm>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-red-700 text-center">
          {erro || "Erro desconhecido ao carregar o cadastro."}
        </div>
      </LayoutAdm>
    );
  }

  const renderSectionTitle = (icon: any, title: string) => {
    const Icon = icon;
    return (
      <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4 mt-8 first:mt-0">
        <Icon className="w-5 h-5 text-[#7030A0]" />
        {title}
      </h2>
    );
  };

  const renderField = (label: string, value: any, type: 'text' | 'link' | 'image' = 'text') => {
    const isPng = typeof value === 'string' && value.toLowerCase().includes('.png');
    const isFoto = label === "Foto do Responsável";
    const boxSize = isFoto ? "w-24 h-24" : "w-48 h-48";
    const objectFit = isFoto ? "object-cover" : "object-contain";
    
    return (
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        {type === 'link' && value ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
            Ver anexo <ExternalLink className="w-3 h-3" />
          </a>
        ) : type === 'image' && value ? (
          <Dialog>
            <DialogTrigger asChild>
              <div className={`block ${boxSize} border rounded-lg overflow-hidden hover:opacity-80 transition-opacity shadow-sm cursor-pointer bg-white`}>
                <img src={value} alt={label} className={`w-full h-full ${objectFit} ${isPng ? 'p-1' : ''}`} />
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl border-none shadow-none flex justify-center items-center overflow-hidden bg-transparent">
              <img src={value} alt={label} className={`max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl ${isPng ? 'bg-white p-4' : ''}`} />
            </DialogContent>
          </Dialog>
        ) : (
          <p className="text-gray-900 text-sm">{value || <span className="text-gray-400 italic">Não informado</span>}</p>
        )}
      </div>
    );
  };

  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/adm/cadastros">
              <a className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Voltar para lista
              </a>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{empresa.razao_social || 'Cadastro Sem Razão Social'}</h1>
              {/* Badge de status */}
              {empresa.status_aprovacao === 'pendente' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">
                  <Clock className="w-3 h-3" /> Pendente
                </span>
              )}
              {empresa.status_aprovacao === 'aprovado' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
                  <CheckCircle2 className="w-3 h-3" /> Aprovado
                </span>
              )}
              {empresa.status_aprovacao === 'rejeitado' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-200">
                  <XCircle className="w-3 h-3" /> Rejeitado
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">CNPJ: {empresa.cnpj || 'Não informado'}</p>
          </div>
          
          <div className="flex gap-3">
            {empresa.status_aprovacao === 'pendente' && (
              <Button
                onClick={handleAprovar}
                disabled={aprovando}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md rounded-xl h-11 px-6"
              >
                {aprovando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Aprovar Cadastro
              </Button>
            )}
            <Button 
              onClick={() => setModalUsuariosAberto(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-md rounded-xl h-11 px-6"
            >
              <Users className="w-4 h-4" />
              Gerenciar Usuários
            </Button>
            <Button 
              onClick={handleDeletar} 
              disabled={deletando}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-md rounded-xl h-11 px-6"
            >
              {deletando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Deletar Empresa
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
          
          {/* Sessão 1: Informações de Acesso e Responsável */}
          {renderSectionTitle(User, "Informações do Responsável")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {renderField("Nome do Responsável", empresa.nome_responsavel)}
            {renderField("E-mail (Login)", empresa.email)}
            {renderField("Telefone Principal", empresa.telefone_principal)}
            {renderField("Telefone Opcional", empresa.telefone_opcional)}
            {renderField("Foto do Responsável", empresa.foto_responsavel_url, 'image')}
          </div>

          {/* Sessão 2: Dados da Empresa */}
          {renderSectionTitle(Building2, "Dados da Empresa")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderField("Razão Social", empresa.razao_social)}
            {renderField("Nome Fantasia", empresa.nome_fantasia)}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">CNPJ</p>
              <div className="flex flex-col gap-1 items-start">
                <p className="text-gray-900 text-sm">
                  {empresa.cnpj || <span className="text-gray-400 italic">Não informado</span>}
                </p>
                {empresa.cnpj && (
                  <div className="flex items-start gap-2 mt-2">
                    <BadgeSituacaoCNPJ 
                      situacao={empresa.situacao_cnpj} 
                      verificadoEm={empresa.situacao_cnpj_verificado_em} 
                    />
                    <button
                      onClick={handleVerificarCNPJ}
                      disabled={verificandoCnpj}
                      className="mt-0.5 p-1.5 text-gray-500 hover:text-[#7030A0] hover:bg-purple-50 rounded-full transition-colors disabled:opacity-50 border border-transparent hover:border-purple-200 bg-gray-50"
                      title="Verificar/Atualizar situação na Receita Federal (BrasilAPI)"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${verificandoCnpj ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setDialogoManualAberto(true)}
                      className="mt-0.5 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-transparent hover:border-blue-200 bg-gray-50"
                      title="Alterar situação manualmente"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {renderField("Tipo de Acesso", empresa.acesso_tipo)}
            {renderField("Área de Atuação", empresa.area_empresa)}
            {renderField("Área Geográfica", empresa.area_geografica)}
            {renderField("Logo da Empresa", empresa.logo_empresa_url, 'image')}
            {renderField("Cartão CNPJ", empresa.cartao_cnpj_url, 'link')}
            {renderField("Ficha da Junta Comercial", empresa.ficha_junta_url, 'link')}
          </div>
          <div className="mt-4">
            {renderField("Sobre a Empresa", empresa.sobre_empresa)}
          </div>

          {/* Sessão 3: Financeiro */}
          {renderSectionTitle(CreditCard, "Informações Financeiras")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {renderField("Emite Nota Fiscal?", empresa.emite_nota_fiscal)}
            {renderField("Possui Conta PJ?", empresa.tem_conta_pj)}
            {renderField("Formas de Pagamento (Paga)", Array.isArray(empresa.formas_pagamento) ? empresa.formas_pagamento.join(", ") : empresa.formas_pagamento)}
            {renderField("Formas de Recebimento", Array.isArray(empresa.formas_recebimento) ? empresa.formas_recebimento.join(", ") : empresa.formas_recebimento)}
          </div>

          {/* Sessão 4: Sócios */}
          {renderSectionTitle(Users, "Quadro Societário")}
          {socios.length === 0 ? (
            <p className="text-gray-500 italic text-sm mb-4">Nenhum sócio cadastrado.</p>
          ) : (
            <div className="space-y-4">
              {socios.map((socio, idx) => (
                <div key={socio.id} className="bg-gray-50 border border-gray-100 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {renderField("Nome", socio.nome)}
                  {renderField("CPF", socio.cpf)}
                  {renderField("E-mail", socio.email)}
                  {renderField("CEP", socio.cep)}
                  {renderField("Data de Nasc.", socio.data_nascimento)}
                  {renderField("Nacionalidade", socio.nacionalidade)}
                  {renderField("Raça", socio.raca)}

                  {renderField("Participação %", socio.participacao_percentual)}
                  {renderField("Participação R$", socio.participacao_valor)}
                </div>
              ))}
            </div>
          )}

          {/* Sessão 5: Dados do Impacto Social */}
          <div className="flex items-center justify-between mt-12 mb-6 border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-purple-100 p-2 rounded-lg text-purple-700">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Dados do Impacto Social</h3>
            </div>
            <Button 
              variant="outline" 
              className="flex items-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 h-9"
              onClick={() => setMostrarMapa(!mostrarMapa)}
            >
              <MapPin className="w-4 h-4" />
              {mostrarMapa ? "Ocultar Mapa" : "Ver no Mapa"}
            </Button>
          </div>

          {/* Sub-seção: Localização Direta (Sócios, Gestores Diretos, Colaboradores Diretos) */}
          <div className="mb-8">
            <h4 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#7030A0] inline-block"></span>
              Localização dos Sócios, Gestores e Colaboradores
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sócios — CEP vem da tabela socios */}
              <div>
                <h5 className="font-semibold text-[#F97316] mb-2 border-b border-[#F97316]/20 pb-1 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#F97316]"></span>
                  Sócios
                </h5>
                <ul className="space-y-2 text-sm text-gray-600">
                  {socios.filter(s => s.cep).map(s => (
                    <li key={s.id}>• {s.cep} <br/><span className="text-xs text-gray-400">{s.cep_endereco}</span></li>
                  ))}
                  {socios.filter(s => s.cep).length === 0 && <span className="italic">Nenhum</span>}
                </ul>
              </div>
              {/* Gestores Diretos */}
              <div>
                <h5 className="font-semibold text-[#7030A0] mb-2 border-b border-[#7030A0]/20 pb-1 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#7030A0]"></span>
                  Gestores
                </h5>
                <ul className="space-y-2 text-sm text-gray-600">
                  {ceps.filter(c => c.tipo === 'GESTOR_DIRETO').map(c => (
                    <li key={c.id}>• {c.cep} <br/><span className="text-xs text-gray-400">{c.endereco_validado}</span></li>
                  ))}
                  {ceps.filter(c => c.tipo === 'GESTOR_DIRETO').length === 0 && <span className="italic">Nenhum</span>}
                </ul>
              </div>
              {/* Colaboradores Diretos */}
              <div>
                <h5 className="font-semibold text-[#0EA5E9] mb-2 border-b border-[#0EA5E9]/20 pb-1 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#0EA5E9]"></span>
                  Colaboradores
                </h5>
                <ul className="space-y-2 text-sm text-gray-600">
                  {ceps.filter(c => c.tipo === 'COLABORADOR_DIRETO').map(c => (
                    <li key={c.id}>• {c.cep} <br/><span className="text-xs text-gray-400">{c.endereco_validado}</span></li>
                  ))}
                  {ceps.filter(c => c.tipo === 'COLABORADOR_DIRETO').length === 0 && <span className="italic">Nenhum</span>}
                </ul>
              </div>
            </div>
          </div>

          {/* Sub-seção: Pessoas Impactadas */}
          <div>
            <h4 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
              Pessoas Impactadas Financeiramente
            </h4>
            {ceps.filter(c => ['GESTOR','SOCIO','COLABORADOR'].includes(c.tipo)).length === 0 ? (
              <p className="text-gray-500 italic text-sm mb-4">Nenhum CEP de pessoa impactada registrado.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h5 className="font-semibold text-[#9333EA] mb-2 border-b border-[#9333EA]/20 pb-1 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#9333EA]"></span>
                    Impactados pelo Gestor
                  </h5>
                  <ul className="space-y-2 text-sm text-gray-600">
                    {ceps.filter(c => c.tipo === 'GESTOR').map(c => (
                      <li key={c.id}>• {c.cep} <br/><span className="text-xs text-gray-400">{c.endereco_validado}</span></li>
                    ))}
                    {ceps.filter(c => c.tipo === 'GESTOR').length === 0 && <span className="italic">Nenhum</span>}
                  </ul>
                </div>
                <div>
                  <h5 className="font-semibold text-[#EAB308] mb-2 border-b border-[#EAB308]/20 pb-1 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#EAB308]"></span>
                    Impactados pelo Sócio
                  </h5>
                  <ul className="space-y-2 text-sm text-gray-600">
                    {ceps.filter(c => c.tipo === 'SOCIO').map(c => (
                      <li key={c.id}>• {c.cep} <br/><span className="text-xs text-gray-400">{c.endereco_validado}</span></li>
                    ))}
                    {ceps.filter(c => c.tipo === 'SOCIO').length === 0 && <span className="italic">Nenhum</span>}
                  </ul>
                </div>
                <div>
                  <h5 className="font-semibold text-[#22C55E] mb-2 border-b border-[#22C55E]/20 pb-1 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#22C55E]"></span>
                    Impactados pelo Colaborador
                  </h5>
                  <ul className="space-y-2 text-sm text-gray-600">
                    {ceps.filter(c => c.tipo === 'COLABORADOR').map(c => (
                      <li key={c.id}>• {c.cep} <br/><span className="text-xs text-gray-400">{c.endereco_validado}</span></li>
                    ))}
                    {ceps.filter(c => c.tipo === 'COLABORADOR').length === 0 && <span className="italic">Nenhum</span>}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Mapa unificado — CEPs diretos + sócios + impactados */}
          {mostrarMapa && (
            <MapaImpactados ceps={[
              // Sócios diretos (vêm da tabela socios, não de ceps_impactados)
              ...socios
                .filter(s => s.cep)
                .map(s => ({ id: `socio-${s.id}`, tipo: 'SOCIO_DIRETO', cep: s.cep, endereco_validado: s.cep_endereco, pais: 'BR' })),
              // Demais CEPs de ceps_impactados
              ...ceps,
            ]} />
          )}
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-purple-50 p-6 rounded-2xl border border-purple-100">
            {renderField("É Empreendedor(a)?", empresa.e_socio)}
            {renderField("Tem Sócios Negros?", empresa.tem_negros_socios)}
            {renderField("Autoriza Compartilhamento?", empresa.autoriza_compartilhamento)}
          </div>

        </div>
      </div>

      <Dialog open={dialogoSalaAberta} onOpenChange={setDialogoSalaAberta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Key className="w-5 h-5" /> Senha Temporária Gerada
            </DialogTitle>
            <DialogDescription>
              Copie a senha abaixo e envie para o usuário. 
              <br/><br/>
              <strong>IMPORTANTE:</strong> Esta senha não poderá ser visualizada novamente. Assim que o usuário fizer login, ele será obrigado a criar uma nova senha imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center my-4 flex items-center justify-center gap-3">
            <span className="text-3xl font-mono font-bold tracking-widest text-gray-900">{senhaGerada}</span>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(senhaGerada || "");
                alert("Senha copiada para a área de transferência!");
              }}
            >
              Copiar Senha
            </Button>
            <Button type="button" onClick={() => setDialogoSalaAberta(false)} style={{ backgroundColor: "#7030A0" }}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoManualAberto} onOpenChange={setDialogoManualAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Edit2 className="w-5 h-5" /> Alterar Situação Manualmente
            </DialogTitle>
            <DialogDescription>
              Atualize a situação do CNPJ caso a informação da BrasilAPI esteja desatualizada em relação à Receita Federal.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nova Situação:
            </label>
            <select
              value={novaSituacaoManual || ""}
              onChange={(e) => setNovaSituacaoManual(e.target.value as SituacaoCNPJ)}
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ATIVA">Ativa</option>
              <option value="INAPTA">Inapta</option>
              <option value="BAIXADA">Baixada</option>
              <option value="SUSPENSA">Suspensa</option>
              <option value="NULA">Nula</option>
            </select>
          </div>

          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogoManualAberto(false)}
              disabled={salvandoManual}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleAtualizarSituacaoManual} 
              disabled={salvandoManual}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              {salvandoManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de gerenciamento de usuários da empresa */}
      {empresa && (
        <ModalUsuariosEmpresa
          aberto={modalUsuariosAberto}
          onFechar={() => setModalUsuariosAberto(false)}
          empresa={{
            id: empresa.id,
            email: empresa.email,
            nome_responsavel: empresa.nome_responsavel,
            telefone_principal: empresa.telefone_principal,
          }}
          onDadosAlterados={() => {
            // Recarrega os dados da empresa ao fechar o modal após alteração
            supabase.from('empresas').select('*').eq('id', empresa.id).single().then(({ data }) => {
              if (data) setEmpresa(data);
            });
          }}
        />
      )}

      {/* Painel flutuante de campos faltando — visível apenas quando os dados já carregaram */}
      <PainelCamposFaltandoAdm empresa={empresa} socios={socios} />
    </LayoutAdm>
  );
}
