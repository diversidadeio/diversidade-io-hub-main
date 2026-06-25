import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Key, ExternalLink, Building2, User, CreditCard, Users, FileText, CheckCircle2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapaImpactados from "@/components/MapaImpactados";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function DetalhesCadastroAdm() {
  const [, params] = useRoute("/adm/cadastros/:id");
  const id = params?.id;

  const [carregando, setCarregando] = useState(true);
  const [empresa, setEmpresa] = useState<any>(null);
  const [socios, setSocios] = useState<any[]>([]);
  const [ceps, setCeps] = useState<any[]>([]);
  const [erro, setErro] = useState("");

  const [gerandoSenha, setGerandoSenha] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [dialogoSalaAberta, setDialogoSalaAberta] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      try {
        const { data: emp, error: errEmp } = await supabase.from('empresas').select('*').eq('id', id).single();
        if (errEmp || !emp) throw new Error("Cadastro não encontrado.");
        setEmpresa(emp);

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
    } catch (err: any) {
      alert("Erro ao gerar senha: " + err.message);
    } finally {
      setGerandoSenha(false);
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

  const renderField = (label: string, value: any, isLink = false) => (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      {isLink && value ? (
        <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
          Ver anexo <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <p className="text-gray-900 text-sm">{value || <span className="text-gray-400 italic">Não informado</span>}</p>
      )}
    </div>
  );

  return (
    <LayoutAdm>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/adm/cadastros">
              <a className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Voltar para lista
              </a>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{empresa.razao_social || 'Cadastro Sem Razão Social'}</h1>
            <p className="text-gray-600 mt-1">CNPJ: {empresa.cnpj || 'Não informado'}</p>
          </div>
          
          <Button 
            onClick={handleGerarSenha} 
            disabled={gerandoSenha}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-md rounded-xl h-11 px-6"
          >
            {gerandoSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Gerar Senha Temporária
          </Button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
          
          {/* Sessão 1: Informações de Acesso e Responsável */}
          {renderSectionTitle(User, "Informações do Responsável")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {renderField("Nome do Responsável", empresa.nome_responsavel)}
            {renderField("E-mail (Login)", empresa.email)}
            {renderField("Telefone Principal", empresa.telefone_principal)}
            {renderField("Telefone Opcional", empresa.telefone_opcional)}
            {renderField("Foto do Responsável", empresa.foto_responsavel_url, true)}
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
            {renderField("Logo da Empresa", empresa.logo_empresa_url, true)}
            {renderField("Cartão CNPJ", empresa.cartao_cnpj_url, true)}
            {renderField("Ficha da Junta Comercial", empresa.ficha_junta_url, true)}
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
                  {renderField("Gênero", socio.genero)}
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
    </LayoutAdm>
  );
}
