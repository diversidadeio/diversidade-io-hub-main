import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { LayoutUsuario } from "@/components/LayoutUsuario";
import { supabase, supabaseAnon } from "@/lib/supabase";
import { Loader2, ArrowLeft, ExternalLink, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { registrarLog } from "@/lib/registrarLog";

export default function EmpresaDetalhes() {
  const [, params] = useRoute("/empresas/:id");
  const id = params?.id;
  const { usuario } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [empresa, setEmpresa] = useState<any>(null);
  const [socios, setSocios] = useState<any[]>([]);
  const [erro, setErro] = useState("");
  const [isIncentivadora, setIsIncentivadora] = useState(false);

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      try {
        const { data: emp, error: errEmp } = await supabase.from('empresas').select('*').eq('id', id).single();
        if (errEmp || !emp) throw new Error("Cadastro não encontrado.");
        
        // Proteção: não permitir ver admin ou outras lógicas se necessário
        if (emp.tipo_usuario === 'adm') {
          throw new Error("Cadastro não encontrado.");
        }

        setEmpresa(emp);

        const { data: sociosData } = await supabaseAnon.from('socios').select('*').eq('empresa_id', id);
        if (sociosData) setSocios(sociosData);

        if (usuario?.empresaId) {
          const { data: userData } = await supabase.from('empresas').select('acesso_tipo').eq('id', (usuario as any).empresaId).single();
          if (userData?.acesso_tipo && userData.acesso_tipo.toUpperCase().includes('EMPRESA OU INICIATIVA INCENTIVADORA')) {
            setIsIncentivadora(true);
          }
        }

        // Registra log de visualização de empresa pelo usuário
        registrarLog({
          tipo_evento: 'usuario_ver_empresa',
          email: usuario?.email,
          empresa_id: (usuario as any)?.empresaId,
          nome_empresa: emp.razao_social || emp.nome_fantasia || emp.email,
          detalhes: `Empresa visualizada: ${emp.razao_social || emp.email} (ID: ${id})`,
        });
      } catch (err: any) {
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [id, usuario]);

  if (carregando) {
    return (
      <LayoutUsuario>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" />
        </div>
      </LayoutUsuario>
    );
  }

  if (erro || !empresa) {
    return (
      <LayoutUsuario>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-red-700 text-center">
          {erro || "Erro desconhecido ao carregar o cadastro."}
        </div>
      </LayoutUsuario>
    );
  }

  const renderSectionTitle = (icon: any, title: string) => {
    const Icon = icon;
    return (
      <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-3 mb-4 mt-8 first:mt-0">
        <Icon className="w-5 h-5 text-[#7030A0] dark:text-purple-400" />
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
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        {type === 'link' && value ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium">
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
          <p className="text-gray-900 dark:text-gray-200 text-sm">{value || <span className="text-gray-400 dark:text-gray-500 italic">Não informado</span>}</p>
        )}
      </div>
    );
  };

  let etariedadeTexto = "Não";
  let racas = "Não informado";
  let sexos = "Não informado";
  let nacionalidades = "Não informado";

  if (isIncentivadora && socios.length > 0) {
    const temMaior60 = socios.some((s: any) => {
      const idade = parseInt(s.etariedade);
      return !isNaN(idade) && idade >= 60;
    });
    etariedadeTexto = temMaior60 ? "Sim" : "Não";

    const racasList = Array.from(new Set(socios.map((s: any) => s.raca).filter(Boolean)));
    if (racasList.length > 0) racas = racasList.join(", ");

    const sexosList = Array.from(new Set(socios.map((s: any) => s.sexo).filter(Boolean)));
    if (sexosList.length > 0) sexos = sexosList.join(", ");

    const nacList = Array.from(new Set(socios.map((s: any) => s.nacionalidade).filter(Boolean)));
    if (nacList.length > 0) nacionalidades = nacList.join(", ");
  }

  return (
    <LayoutUsuario activePath="/meu-cadastro/pesquisas">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/meu-cadastro/pesquisas">
              <a className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Voltar para lista
              </a>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{empresa.razao_social || 'Cadastro Sem Razão Social'}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">CNPJ: {empresa.cnpj || 'Não informado'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          
          {/* Sessão 1: Informações de Acesso e Responsável */}
          {renderSectionTitle(User, "Informações do Responsável")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {renderField("Nome do Responsável", empresa.nome_responsavel)}
            {renderField("E-mail", empresa.email)}
            {renderField("Telefone Principal", empresa.telefone_principal)}
            {renderField("Telefone Opcional", empresa.telefone_opcional)}
            {renderField("Foto do Responsável", empresa.foto_responsavel_url, 'image')}
          </div>

          {/* Sessão 2: Dados da Empresa */}
          {renderSectionTitle(Building2, "Dados da Empresa")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderField("Razão Social", empresa.razao_social)}
            {renderField("Nome Fantasia", empresa.nome_fantasia)}
            {renderField("CNPJ", empresa.cnpj)}
            {renderField("Tipo de Acesso", empresa.acesso_tipo)}
            {renderField("Área de Atuação", empresa.area_empresa)}
            {renderField("Área Geográfica", empresa.area_geografica)}
            {renderField("Logo da Empresa", empresa.logo_empresa_url, 'image')}
            {renderField("Cartão CNPJ", empresa.cartao_cnpj_url, 'link')}
            {/* OMITIDO PROPOSITALMENTE: Ficha da Junta Comercial */}
          </div>
          <div className="mt-4">
            {renderField("Sobre a Empresa", empresa.sobre_empresa)}
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-purple-50 dark:bg-purple-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800/30">
            {renderField("É Empreendedor(a)?", empresa.e_socio)}
            {renderField("Tem Sócios Negros?", empresa.tem_negros_socios)}
            {renderField("Autoriza Compartilhamento?", empresa.autoriza_compartilhamento)}
            {isIncentivadora && (
              <>
                {renderField("Etariedade (60+)", etariedadeTexto)}
                {renderField("Raça", racas)}
                {renderField("Sexo", sexos)}
              </>
            )}
          </div>

        </div>
      </div>
    </LayoutUsuario>
  );
}
