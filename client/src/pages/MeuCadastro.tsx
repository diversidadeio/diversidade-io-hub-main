import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Upload, CheckCircle2, User, Building2, Wallet, Users, FileText, LogOut, Loader2, Sparkles, Info } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import logoImage from "@/assets/logo.png";
import { DrumDatePicker } from "@/components/ui/drum-date-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { extrairSociosDoJucesp } from "@/lib/extrairJucesp";
import { Download, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { LayoutUsuario } from "@/components/LayoutUsuario";

interface SocioData {
  foto: File | null;
  fotoUrl?: string | null;
  fonteImagem: string;
  nome: string;
  participacaoValor: string;
  participacaoPercentual: string;
  cpf: string;
  cep: string;
  cepEndereco?: string;
  cepValido?: boolean;
  email: string;
  dataNascimento: string;
  nacionalidade: string;
  etariedade: string;
  raca: string;
  sexo: string;
  sexoOutro: string;
  genero: string;
  orientacao: string;
  deficiencia: string;
}

// Lista de países com código ISO e emoji de bandeira
const PAISES = [
  { codigo: "BR", nome: "🇧🇷 Brasil" },
  { codigo: "US", nome: "🇺🇸 Estados Unidos" },
  { codigo: "AR", nome: "🇦🇷 Argentina" },
  { codigo: "UY", nome: "🇺🇾 Uruguai" },
  { codigo: "PY", nome: "🇵🇾 Paraguai" },
  { codigo: "BO", nome: "🇧🇴 Bolívia" },
  { codigo: "PE", nome: "🇵🇪 Peru" },
  { codigo: "CO", nome: "🇨🇴 Colômbia" },
  { codigo: "VE", nome: "🇻🇪 Venezuela" },
  { codigo: "CL", nome: "🇨🇱 Chile" },
  { codigo: "EC", nome: "🇪🇨 Equador" },
  { codigo: "PT", nome: "🇵🇹 Portugal" },
  { codigo: "ES", nome: "🇪🇸 Espanha" },
  { codigo: "FR", nome: "🇫🇷 França" },
  { codigo: "DE", nome: "🇩🇪 Alemanha" },
  { codigo: "IT", nome: "🇮🇹 Itália" },
  { codigo: "GB", nome: "🇬🇧 Reino Unido" },
  { codigo: "CA", nome: "🇨🇦 Canadá" },
  { codigo: "MX", nome: "🇲🇽 México" },
  { codigo: "JP", nome: "🇯🇵 Japão" },
  { codigo: "CN", nome: "🇨🇳 China" },
  { codigo: "IN", nome: "🇮🇳 Índia" },
  { codigo: "AU", nome: "🇦🇺 Austrália" },
  { codigo: "ZA", nome: "🇿🇦 África do Sul" },
  { codigo: "AO", nome: "🇦🇴 Angola" },
  { codigo: "MZ", nome: "🇲🇿 Moçambique" },
];

interface ImpactadaData {
  pais: string;
  codigoPostal: string;
  cepEndereco: string;
  cepValido: boolean;
}

/**
 * Página "Meu Cadastro" — exibe e permite editar o formulário já preenchido pelo usuário logado.
 * Rota protegida: redireciona para /login se não houver sessão ativa.
 */
export default function MeuCadastro() {
  const { usuario, isLogado, isCarregando: authCarregando, logout } = useAuth();
  const isAdmin = usuario?.papel !== 'usuario';
  const [, navigate] = useLocation();

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);

  // Auto-dismiss do toast de sucesso após 3 segundos
  useEffect(() => {
    if (salvoComSucesso) {
      const timer = setTimeout(() => setSalvoComSucesso(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [salvoComSucesso]);



  const [erroGlobal, setErroGlobal] = useState("");
  const [senhaErro, setSenhaErro] = useState("");

  // 1. Info Acesso e Responsável
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefonePrincipal, setTelefonePrincipal] = useState("");
  const [telefoneOpcional, setTelefoneOpcional] = useState("");
  const [email, setEmail] = useState("");
  const [fotoResponsavelFile, setFotoResponsavelFile] = useState<File | null>(null);
  const [fotoResponsavelUrl, setFotoResponsavelUrl] = useState<string | null>(null);

  // 2. Dados Empresa
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cnpjValido] = useState(true);
  const [acessoTipo, setAcessoTipo] = useState<string[]>([]);
  const [acessoTipoOutro, setAcessoTipoOutro] = useState("");
  const [logoEmpresaFile, setLogoEmpresaFile] = useState<File | null>(null);
  const [logoEmpresaUrl, setLogoEmpresaUrl] = useState<string | null>(null);
  const [cartaoCnpjFile, setCartaoCnpjFile] = useState<File | null>(null);
  const [cartaoCnpjUrl, setCartaoCnpjUrl] = useState<string | null>(null);
  const [fichaJuntaFile, setFichaJuntaFile] = useState<File | null>(null);
  const [fichaJuntaUrl, setFichaJuntaUrl] = useState<string | null>(null);
  const [analisandoJucesp, setAnalisandoJucesp] = useState(false);
  const [jucespPreencheu, setJucespPreencheu] = useState(false);
  const [areaEmpresa, setAreaEmpresa] = useState("");
  const [areaGeografica, setAreaGeografica] = useState("");
  const [areaGeograficaOutro, setAreaGeograficaOutro] = useState("");
  const [sobreEmpresa, setSobreEmpresa] = useState("");

  // 3. Financeiro
  const [emiteNotaFiscal, setEmiteNotaFiscal] = useState("");
  const [temContaPJ, setTemContaPJ] = useState("");
  const [formasPagamento, setFormasPagamento] = useState<string[]>([]);
  const [formasRecebimento, setFormasRecebimento] = useState<string[]>([]);

  // 4. Sócios e Impacto
  const [numeroSocios, setNumeroSocios] = useState<number | "">("");
  const [sociosData, setSociosData] = useState<SocioData[]>([]);
  // Gestores e colaboradores diretos (CEP da pessoa em si)
  const [numGestoresDiretos, setNumGestoresDiretos] = useState<number | "">("");
  const [gestoresDiretosData, setGestoresDiretosData] = useState<ImpactadaData[]>([]);
  const [numColaboradoresDiretos, setNumColaboradoresDiretos] = useState<number | "">("");
  const [colaboradoresDiretosData, setColaboradoresDiretosData] = useState<ImpactadaData[]>([]);
  // Pessoas impactadas financeiramente (pelo salário)
  const [numeroImpactadasGestores, setNumeroImpactadasGestores] = useState<number | "">("");
  const [gestoresData, setGestoresData] = useState<ImpactadaData[]>([]);
  const [numeroImpactadasSocios, setNumeroImpactadasSocios] = useState<number | "">("");
  const [sociosImpactadosData, setSociosImpactadosData] = useState<ImpactadaData[]>([]);
  const [numeroImpactadasColaboradores, setNumeroImpactadasColaboradores] = useState<number | "">("");
  const [colaboradoresData, setColaboradoresData] = useState<ImpactadaData[]>([]);

  const [eSocio, setESocio] = useState("");
  const [temNegrosSocios, setTemNegrosSocios] = useState("");
  const [autorizaCompartilhamento, setAutorizaCompartilhamento] = useState("");

  const [diversidadeGlobal, setDiversidadeGlobal] = useState({
    "Total de Pessoas": { socios: "", gestores: "", colaboradores: "" },
    "Pessoas Negras (pretas e pardas)": { socios: "", gestores: "", colaboradores: "" },
    "Mulheres": { socios: "", gestores: "", colaboradores: "" },
    "Pessoas com Deficiência (PCD)": { socios: "", gestores: "", colaboradores: "" },
    "Pessoas 60+": { socios: "", gestores: "", colaboradores: "" },
    "Dependentes financeiros (não entram no Score RIS)": { socios: "", gestores: "", colaboradores: "" }
  });

  const handleCepsBlur = async () => {
    if (!usuario?.empresaId) return;

    // Se houver algum CEP em edição inválido, não salvamos ainda
    const todosCepsSociosImpactadosValidos = sociosImpactadosData.every((s) => !s.codigoPostal || s.cepValido);
    const todosCepsGestoresValidos = gestoresData.every((g) => !g.codigoPostal || g.cepValido);
    const todosCepsColaboradoresValidos = colaboradoresData.every((c) => !c.codigoPostal || c.cepValido);
    const todosCepsGestoresDiretosValidos = gestoresDiretosData.every((g) => !g.codigoPostal || g.cepValido);
    const todosCepsColaboradoresDiretosValidos = colaboradoresDiretosData.every((c) => !c.codigoPostal || c.cepValido);

    if (!todosCepsSociosImpactadosValidos || !todosCepsGestoresValidos || !todosCepsColaboradoresValidos || !todosCepsGestoresDiretosValidos || !todosCepsColaboradoresDiretosValidos) {
      return; 
    }

    try {
      await supabase.from("ceps_impactados").delete().eq("empresa_id", usuario!.empresaId);
      const cepsToInsert: any[] = [];
      
      gestoresDiretosData.forEach((g) => { if (g.codigoPostal && g.cepValido) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "GESTOR_DIRETO", cep: g.codigoPostal, endereco_validado: g.cepEndereco }); });
      colaboradoresDiretosData.forEach((c) => { if (c.codigoPostal && c.cepValido) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "COLABORADOR_DIRETO", cep: c.codigoPostal, endereco_validado: c.cepEndereco }); });
      gestoresData.forEach((g) => { if (g.codigoPostal && g.cepValido) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "GESTOR", cep: g.codigoPostal, endereco_validado: g.cepEndereco }); });
      sociosImpactadosData.forEach((s) => { if (s.codigoPostal && s.cepValido) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "SOCIO", cep: s.codigoPostal, endereco_validado: s.cepEndereco }); });
      colaboradoresData.forEach((c) => { if (c.codigoPostal && c.cepValido) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "COLABORADOR", cep: c.codigoPostal, endereco_validado: c.cepEndereco }); });
      
      if (cepsToInsert.length > 0) {
        const { error: erroCeps } = await supabase.from("ceps_impactados").insert(cepsToInsert);
        if (erroCeps) throw erroCeps;
        setSalvoComSucesso(true);
      }
    } catch (err) {
      console.error("Erro ao auto-salvar CEPs no blur:", err);
    }
  };

  // Redireciona se não estiver logado após carregar auth
  useEffect(() => {
    if (!authCarregando && !isLogado) {
      navigate("/login");
    }
  }, [authCarregando, isLogado, navigate]);

  // Carrega os dados da empresa ao montar a página
  useEffect(() => {
    if (!usuario) return;

    const carregarDados = async () => {
      setCarregandoDados(true);
      try {
        // Busca dados da empresa
        const { data: empresa, error: erroEmpresa } = await supabase
          .from("empresas")
          .select("*")
          .eq("id", usuario.empresaId)
          .single();

        if (erroEmpresa || !empresa) {
          setErroGlobal("Não foi possível carregar seus dados. Tente novamente.");
          return;
        }

        // Preenche os campos com os dados existentes
        setNomeResponsavel(empresa.nome_responsavel ?? "");
        setTelefonePrincipal(empresa.telefone_principal ?? "");
        setTelefoneOpcional(empresa.telefone_opcional ?? "");
        setEmail(empresa.email ?? "");
        setFotoResponsavelUrl(empresa.foto_responsavel_url ?? null);
        setLogoEmpresaUrl(empresa.logo_empresa_url ?? null);
        setCartaoCnpjUrl(empresa.cartao_cnpj_url ?? null);
        setFichaJuntaUrl(empresa.ficha_junta_url ?? null);

        setRazaoSocial(empresa.razao_social ?? "");
        setNomeFantasia(empresa.nome_fantasia ?? "");
        setCnpj(empresa.cnpj ?? "");
        const acessoDB = empresa.acesso_tipo ?? "";
        const tipos = acessoDB.split(',').map((s: string) => s.trim()).filter((s: string) => s !== "");
        const standardTypes = ["EMPRESA OU INICIATIVA INCENTIVADORA", "FORNECEDOR INCLUSIVO", "EMPREENDIMENTO DIVERSO"];
        
        const selectedTipos: string[] = [];
        let outroValue = "";

        tipos.forEach((t: string) => {
          if (standardTypes.includes(t)) {
            selectedTipos.push(t);
          } else if (t.startsWith("OUTRO: ")) {
            selectedTipos.push("OUTRO");
            outroValue = t.replace("OUTRO: ", "");
          } else {
            selectedTipos.push("OUTRO");
            outroValue = t;
          }
        });

        setAcessoTipo(Array.from(new Set(selectedTipos)));
        setAcessoTipoOutro(outroValue);

        setAreaEmpresa(empresa.area_empresa ?? "");

        const areaGeoDB = empresa.area_geografica ?? "";
        if (["Meu Bairro", "Minha região da minha cidade", "Minha cidade", "Minha cidade e o entorno", "Meu estado", "Os estados da minha região", "Todo o Brasil", ""].includes(areaGeoDB)) {
          setAreaGeografica(areaGeoDB);
          setAreaGeograficaOutro("");
        } else {
          setAreaGeografica("Outro");
          setAreaGeograficaOutro(areaGeoDB);
        }
        setSobreEmpresa(empresa.sobre_empresa ?? "");
        setEmiteNotaFiscal(empresa.emite_nota_fiscal ?? "");
        setTemContaPJ(empresa.tem_conta_pj ?? "");
        setFormasPagamento(empresa.formas_pagamento ?? []);
        setFormasRecebimento(empresa.formas_recebimento ?? []);
        setESocio(empresa.e_socio ?? "");
        setTemNegrosSocios(empresa.tem_negros_socios ?? "");
        setAutorizaCompartilhamento(empresa.autoriza_compartilhamento ?? "");
        if (empresa.diversidade_global) {
          const data = empresa.diversidade_global;
          // Se for o formato antigo (baseado em booleans), ignora para forçar o preenchimento do novo
          if (data["Pessoas Negras"] || typeof data["Mulheres"]?.socios === "boolean") {
            // Mantém o estado default (vazio)
          } else {
            setDiversidadeGlobal(data);
          }
        }

        // Busca sócios
        const { data: socios } = await supabase
          .from("socios")
          .select("*")
          .eq("empresa_id", usuario.empresaId);

        if (socios && socios.length > 0) {
          setNumeroSocios(socios.length);
          const sociosMapeados: SocioData[] = socios.map((s: any) => ({
            foto: null,
            fotoUrl: s.foto_url ?? null,
            fonteImagem: s.fonte_imagem ?? "",
            nome: s.nome ?? "",
            participacaoValor: s.participacao_valor ?? "",
            participacaoPercentual: s.participacao_percentual ?? "",
            cpf: s.cpf ?? "",
            cep: s.cep ?? "",
            cepEndereco: s.cep_endereco ?? "",
            cepValido: true,
            email: s.email ?? "",
            dataNascimento: s.data_nascimento ?? "",
            nacionalidade: s.nacionalidade ?? "",
            etariedade: s.etariedade ?? "",
            raca: s.raca ?? "",
            sexo: s.sexo?.startsWith("Outro: ") ? "Outro" : (s.sexo ?? ""),
            sexoOutro: s.sexo?.startsWith("Outro: ") ? s.sexo.replace("Outro: ", "") : "",
            genero: s.genero ?? "",
            orientacao: s.orientacao ?? "",
            deficiencia: s.deficiencia ?? "",
          }));
          setSociosData(sociosMapeados);
        }

        // Busca CEPs impactados
        const { data: ceps } = await supabase
          .from("ceps_impactados")
          .select("*")
          .eq("empresa_id", usuario.empresaId);

        if (ceps && ceps.length > 0) {
          const gestores = ceps.filter((c: any) => c.tipo === "GESTOR");
          const socios = ceps.filter((c: any) => c.tipo === "SOCIO");
          const colaboradores = ceps.filter((c: any) => c.tipo === "COLABORADOR");

          if (gestores.length > 0) {
            setNumeroImpactadasGestores(gestores.length);
            setGestoresData(
              gestores.map((g: any) => ({
                codigoPostal: g.codigo_postal ?? g.cep ?? "",
                pais: g.pais ?? "BR",
                cepEndereco: g.endereco_validado ?? "",
                cepValido: true,
              }))
            );
          }

          const gestoresDiretos = ceps.filter((c: any) => c.tipo === "GESTOR_DIRETO");
          const colaboradoresDiretos = ceps.filter((c: any) => c.tipo === "COLABORADOR_DIRETO");

          if (gestoresDiretos.length > 0) {
            setNumGestoresDiretos(gestoresDiretos.length);
            setGestoresDiretosData(
              gestoresDiretos.map((g: any) => ({
                codigoPostal: g.codigo_postal ?? g.cep ?? "",
                pais: g.pais ?? "BR",
                cepEndereco: g.endereco_validado ?? "",
                cepValido: true,
              }))
            );
          }
          if (colaboradoresDiretos.length > 0) {
            setNumColaboradoresDiretos(colaboradoresDiretos.length);
            setColaboradoresDiretosData(
              colaboradoresDiretos.map((c: any) => ({
                codigoPostal: c.codigo_postal ?? c.cep ?? "",
                pais: c.pais ?? "BR",
                cepEndereco: c.endereco_validado ?? "",
                cepValido: true,
              }))
            );
          }
          if (socios.length > 0) {
            setNumeroImpactadasSocios(socios.length);
            setSociosImpactadosData(
              socios.map((s: any) => ({
                codigoPostal: s.codigo_postal ?? s.cep ?? "",
                pais: s.pais ?? "BR",
                cepEndereco: s.endereco_validado ?? "",
                cepValido: true,
              }))
            );
          }
          if (colaboradores.length > 0) {
            setNumeroImpactadasColaboradores(colaboradores.length);
            setColaboradoresData(
              colaboradores.map((c: any) => ({
                codigoPostal: c.codigo_postal ?? c.cep ?? "",
                pais: c.pais ?? "BR",
                cepEndereco: c.endereco_validado ?? "",
                cepValido: true,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setErroGlobal("Erro inesperado ao carregar dados.");
      } finally {
        setCarregandoDados(false);
      }
    };

    carregarDados();
  }, [usuario]);

  // ── Funções utilitárias (as mesmas do CadastroGratuito) ──

  const formatCep = (value: string) =>
    value.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);

  const fetchCepData = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return { valido: false, endereco: "" };
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return { valido: false, endereco: "CEP inválido ou não encontrado." };
      const bairro = data.bairro ? `${data.bairro}, ` : "";
      const cidade = data.localidade ? `${data.localidade} - ` : "";
      const estado = data.uf ?? "";
      const enderecoFormatado = `${bairro}${cidade}${estado}`.trim().replace(/, $/, "").replace(/ - $/, "");
      return { valido: true, endereco: enderecoFormatado };
    } catch {
      return { valido: false, endereco: "Erro ao buscar CEP." };
    }
  };

  const formatCpf = (value: string) =>
    value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);

  const formatDateInput = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "$1/$2")
      .replace(/(\d{2})(\d)/, "$1/$2")
      .slice(0, 10);
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length > 10) return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    if (v.length > 6) return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    if (v.length > 2) return v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    return v;
  };

  /**
   * Ao anexar a Ficha da Junta Comercial, extrai automaticamente o quadro societário.
   */
  const handleFichaJuntaChange = async (arquivo: File) => {
    setFichaJuntaFile(arquivo);
    setJucespPreencheu(false);
    setAnalisandoJucesp(true);
    try {
      const sociosExtraidos = await extrairSociosDoJucesp(arquivo);
      if (sociosExtraidos.length > 0) {
        setSociosData(prev => {
          const novos = [...prev];
          sociosExtraidos.forEach((s, idx) => {
            if (idx < novos.length) {
              novos[idx] = {
                ...novos[idx],
                nome: novos[idx].nome || s.nome,
                participacaoValor: s.valorParticipacao,
                participacaoPercentual: s.percentualParticipacao,
                // Pré-preenche raça/cor se encontrada e o campo estiver vazio
                raca: novos[idx].raca || s.racaCor,
              };
            }
          });
          return novos;
        });
        setJucespPreencheu(true);
      }
    } finally {
      setAnalisandoJucesp(false);
    }
  };

  const updateSocio = (index: number, field: keyof SocioData, value: any) => {
    const newData = [...sociosData];
    newData[index] = { ...newData[index], [field]: value };
    
    if (field === 'dataNascimento' && typeof value === 'string' && value.length === 10) {
      const [d, m, a] = value.split('/').map(Number);
      if (d && m && a) {
        const dataNasc = new Date(a, m - 1, d);
        const hoje = new Date();
        let idade = hoje.getFullYear() - dataNasc.getFullYear();
        const mDiff = hoje.getMonth() - dataNasc.getMonth();
        if (mDiff < 0 || (mDiff === 0 && hoje.getDate() < dataNasc.getDate())) {
          idade--;
        }
        if (idade >= 0) {
          newData[index].etariedade = idade.toString();
        }
      }
    }
    
    setSociosData(newData);
  };

  const handleNumeroSociosChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroSocios(num);
    if (typeof num === "number" && num > 0) {
      setSociosData((prev) => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) {
            newData.push({
              foto: null, fonteImagem: "", nome: "", participacaoValor: "", participacaoPercentual: "",
              cpf: "", cep: "", email: "", dataNascimento: "", nacionalidade: "", etariedade: "", raca: "", sexo: "", sexoOutro: "", genero: "", orientacao: "", deficiencia: ""           });
          }
        } else {
          newData.length = num;
        }
        return newData;
      });
    } else {
      setSociosData([]);
    }
  };

  const handleCepSocioChange = async (index: number, val: string) => {
    const formatted = formatCep(val);
    setSociosData((prev) => {
      const newData = [...prev];
      newData[index] = { ...newData[index], cep: formatted, cepValido: false, cepEndereco: "" };
      return newData;
    });
    if (formatted.length === 9) {
      const data = await fetchPostalData("BR", formatted);
      setSociosData((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], cepValido: data.valido, cepEndereco: data.endereco };
        return updated;
      });
    }
  };

  const handleNumeroGestoresChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroImpactadasGestores(num);
    if (typeof num === "number" && num > 0) {
      setGestoresData((prev) => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) newData.push({ pais: "BR", codigoPostal: "", cepEndereco: "", cepValido: false });
        } else newData.length = num;
        return newData;
      });
    } else setGestoresData([]);
  };

  const handleNumeroGestoresDiretosChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumGestoresDiretos(num);
    if (typeof num === "number" && num > 0) {
      setGestoresDiretosData((prev) => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) newData.push({ pais: "BR", codigoPostal: "", cepEndereco: "", cepValido: false });
        } else newData.length = num;
        return newData;
      });
    } else setGestoresDiretosData([]);
  };

  const handleNumeroColaboradoresDiretosChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumColaboradoresDiretos(num);
    if (typeof num === "number" && num > 0) {
      setColaboradoresDiretosData((prev) => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) newData.push({ pais: "BR", codigoPostal: "", cepEndereco: "", cepValido: false });
        } else newData.length = num;
        return newData;
      });
    } else setColaboradoresDiretosData([]);
  };

  const handleNumeroSociosImpactadosChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroImpactadasSocios(num);
    if (typeof num === "number" && num > 0) {
      setSociosImpactadosData((prev) => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) newData.push({ pais: "BR", codigoPostal: "", cepEndereco: "", cepValido: false });
        } else newData.length = num;
        return newData;
      });
    } else setSociosImpactadosData([]);
  };

  const handleNumeroColaboradoresChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroImpactadasColaboradores(num);
    if (typeof num === "number" && num > 0) {
      setColaboradoresData((prev) => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) newData.push({ pais: "BR", codigoPostal: "", cepEndereco: "", cepValido: false });
        } else newData.length = num;
        return newData;
      });
    } else setColaboradoresData([]);
  };

  /**
   * Busca dados de endereço por código postal.
   * Usa ViaCEP para o Brasil e Zippopotam.us para os demais países.
   */
  const fetchPostalData = async (pais: string, codigo: string) => {
    const clean = codigo.replace(/\D/g, "");
    try {
      if (pais === "BR") {
        if (clean.length !== 8) return { valido: false, endereco: "" };
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const d = await res.json();
        if (d.erro) return { valido: false, endereco: "CEP inválido ou não encontrado." };
        const bairro = d.bairro ? `${d.bairro}, ` : "";
        const cidade = d.localidade ? `${d.localidade} - ` : "";
        const estado = d.uf ?? "";
        const enderecoFormatado = `${bairro}${cidade}${estado}`.trim().replace(/, $/, "").replace(/ - $/, "");
        return { valido: true, endereco: enderecoFormatado };
      } else {
        if (clean.length < 3) return { valido: false, endereco: "" };
        const res = await fetch(`https://api.zippopotam.us/${pais}/${clean}`);
        if (!res.ok) return { valido: false, endereco: "Código postal inválido ou não encontrado." };
        const d = await res.json();
        const place = d.places?.[0];
        if (!place) return { valido: false, endereco: "Localidade não encontrada." };
        return { valido: true, endereco: `${place["place name"]}, ${place["state"]} - ${d["country"]}` };
      }
    } catch {
      return { valido: false, endereco: "Erro ao buscar código postal." };
    }
  };

  const handleCodigoPostalChange = async (
    setter: React.Dispatch<React.SetStateAction<ImpactadaData[]>>,
    lista: ImpactadaData[],
    index: number,
    val: string
  ) => {
    const pais = lista[index]?.pais ?? "BR";
    const codigo = pais === "BR" ? formatCep(val) : val;
    setter(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], codigoPostal: codigo, cepValido: false, cepEndereco: "" };
      return updated;
    });
    const minLen = pais === "BR" ? 9 : 3;
    if (codigo.length >= minLen) {
      const data = await fetchPostalData(pais, codigo);
      setter(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], cepValido: data.valido, cepEndereco: data.endereco };
        return updated;
      });
      if (data.valido) {
        // Validation complete, waiting for onBlur to save
      }
    }
  };

  const handlePaisChange = (
    setter: React.Dispatch<React.SetStateAction<ImpactadaData[]>>,
    index: number,
    novoPais: string
  ) => {
    setter(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], pais: novoPais, codigoPostal: "", cepValido: false, cepEndereco: "" };
      return updated;
    });
  };


  const handlePagamentoToggle = (forma: string) =>
    setFormasPagamento((prev) => prev.includes(forma) ? prev.filter((f) => f !== forma) : [...prev, forma]);

  const handleRecebimentoToggle = (forma: string) =>
    setFormasRecebimento((prev) => prev.includes(forma) ? prev.filter((f) => f !== forma) : [...prev, forma]);

  const handleDiversidadeQtdChange = (categoria: string, grupo: 'socios' | 'gestores' | 'colaboradores', valor: string) => {
    if (valor !== "" && !/^\d+$/.test(valor)) return;
    
    setDiversidadeGlobal((prev) => ({
      ...prev,
      [categoria]: { ...prev[categoria as keyof typeof prev], [grupo]: valor },
    }));
  };

  // Salva automaticamente diversidade_global ao sair de um campo (onBlur)
  const handleDiversidadeBlur = async (novoEstado?: typeof diversidadeGlobal) => {
    const dadosParaSalvar = novoEstado ?? diversidadeGlobal;
    try {
      const { error } = await supabase
        .from("empresas")
        .update({ diversidade_global: dadosParaSalvar })
        .eq("id", usuario!.empresaId);
      if (!error) setSalvoComSucesso(true);
    } catch (err) {
      console.error("Erro ao salvar recortes:", err);
    }
  };

  const handleSairLogout = () => {
    logout();
    navigate("/");
  };

  // ── Salvar alterações ──
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaErro("");
    setSalvoComSucesso(false);

    const todosCepsSociosValidos = sociosData.every((s) => !s.cep || s.cepValido);
    const todosCepsSociosImpactadosValidos = sociosImpactadosData.every((s) => !s.codigoPostal || s.cepValido);
    const todosCepsGestoresValidos = gestoresData.every((g) => !g.codigoPostal || g.cepValido);
    const todosCepsColaboradoresValidos = colaboradoresData.every((c) => !c.codigoPostal || c.cepValido);
    const todosCepsGestoresDiretosValidos = gestoresDiretosData.every((g) => !g.codigoPostal || g.cepValido);
    const todosCepsColaboradoresDiretosValidos = colaboradoresDiretosData.every((c) => !c.codigoPostal || c.cepValido);

    if (!todosCepsSociosValidos || !todosCepsSociosImpactadosValidos || !todosCepsGestoresValidos || !todosCepsColaboradoresValidos || !todosCepsGestoresDiretosValidos || !todosCepsColaboradoresDiretosValidos) {
      setSenhaErro("Por favor, preencha corretamente todos os CEPs informados antes de continuar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!cnpjValido) {
      setSenhaErro("Por favor, certifique-se de que o CNPJ está correto.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSalvando(true);
    try {
      // Função auxiliar de upload
      const uploadFile = async (file: File, path: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documentos')
          .upload(filePath, file);

        if (uploadError) throw new Error(`Erro ao fazer upload de ${file.name}: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from('documentos')
          .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
      };

      // Uploads das imagens principais caso existam novas
      let newFotoResponsavelUrl = fotoResponsavelUrl;
      if (fotoResponsavelFile) newFotoResponsavelUrl = await uploadFile(fotoResponsavelFile, `empresas/${usuario!.empresaId}/responsavel`);

      let newLogoEmpresaUrl = logoEmpresaUrl;
      if (logoEmpresaFile) newLogoEmpresaUrl = await uploadFile(logoEmpresaFile, `empresas/${usuario!.empresaId}/logo`);

      let newCartaoCnpjUrl = cartaoCnpjUrl;
      if (cartaoCnpjFile) newCartaoCnpjUrl = await uploadFile(cartaoCnpjFile, `empresas/${usuario!.empresaId}/documentos`);

      let newFichaJuntaUrl = fichaJuntaUrl;
      if (fichaJuntaFile) newFichaJuntaUrl = await uploadFile(fichaJuntaFile, `empresas/${usuario!.empresaId}/documentos`);

      // Atualiza dados da empresa
      const { error: erroUpdate } = await supabase
        .from("empresas")
        .update({
          foto_responsavel_url: newFotoResponsavelUrl,
          logo_empresa_url: newLogoEmpresaUrl,
          cartao_cnpj_url: newCartaoCnpjUrl,
          ficha_junta_url: newFichaJuntaUrl,
          nome_responsavel: nomeResponsavel,
          telefone_principal: telefonePrincipal,
          telefone_opcional: telefoneOpcional,
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia,
          cnpj: cnpj,
          acesso_tipo: acessoTipo.includes("OUTRO") ? acessoTipo.filter(t => t !== "OUTRO").concat(`OUTRO: ${acessoTipoOutro}`).join(', ') : acessoTipo.join(', '),
          area_empresa: areaEmpresa,
          area_geografica: areaGeografica === "Outro" ? areaGeograficaOutro : areaGeografica,
          sobre_empresa: sobreEmpresa,
          emite_nota_fiscal: emiteNotaFiscal,
          tem_conta_pj: temContaPJ,
          formas_pagamento: formasPagamento,
          formas_recebimento: formasRecebimento,
          e_socio: eSocio,
          tem_negros_socios: temNegrosSocios,
          autoriza_compartilhamento: autorizaCompartilhamento,
          diversidade_global: diversidadeGlobal,
        })
        .eq("id", usuario!.empresaId);

      if (erroUpdate) throw erroUpdate;

      // Recria sócios (delete + insert para simplificar)
      await supabase.from("socios").delete().eq("empresa_id", usuario!.empresaId);
      if (sociosData.length > 0) {
        const sociosToInsert = await Promise.all(sociosData.map(async (s) => {
          let newFotoUrl = s.fotoUrl;
          if (s.foto) {
            newFotoUrl = await uploadFile(s.foto, `empresas/${usuario!.empresaId}/socios`);
          }

          return {
            empresa_id: usuario!.empresaId,
            foto_url: newFotoUrl,
            nome: s.nome,
            cpf: s.cpf,
            participacao_valor: s.participacaoValor,
            participacao_percentual: s.participacaoPercentual,
            email: s.email,
            data_nascimento: s.dataNascimento,
            cep: s.cep,
            cep_endereco: s.cepEndereco,
            nacionalidade: s.nacionalidade,
            etariedade: s.etariedade,
            raca: s.raca,
            sexo: s.sexo === "Outro" ? `Outro: ${s.sexoOutro}` : s.sexo,
            genero: s.genero,
            orientacao: s.orientacao,
            deficiencia: s.deficiencia,
            fonte_imagem: s.fonteImagem,
          };
        }));
        const { error: erroSocios } = await supabase.from("socios").insert(sociosToInsert);
        if (erroSocios) throw erroSocios;
      }

      // Recria CEPs (delete + insert)
      await supabase.from("ceps_impactados").delete().eq("empresa_id", usuario!.empresaId);
      const cepsToInsert: any[] = [];

      // CEPs dos gestores e colaboradores diretos (a própria pessoa)
      gestoresDiretosData.forEach((g) => {
        if (g.codigoPostal) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "GESTOR_DIRETO", cep: g.codigoPostal, endereco_validado: g.cepEndereco });
      });
      colaboradoresDiretosData.forEach((c) => {
        if (c.codigoPostal) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "COLABORADOR_DIRETO", cep: c.codigoPostal, endereco_validado: c.cepEndereco });
      });

      // CEPs de pessoas impactadas financeiramente
      gestoresData.forEach((g) => {
        if (g.codigoPostal) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "GESTOR", cep: g.codigoPostal, endereco_validado: g.cepEndereco });
      });
      sociosImpactadosData.forEach((s) => {
        if (s.codigoPostal) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "SOCIO", cep: s.codigoPostal, endereco_validado: s.cepEndereco });
      });
      colaboradoresData.forEach((c) => {
        if (c.codigoPostal) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "COLABORADOR", cep: c.codigoPostal, endereco_validado: c.cepEndereco });
      });
      if (cepsToInsert.length > 0) {
        const { error: erroCeps } = await supabase.from("ceps_impactados").insert(cepsToInsert);
        if (erroCeps) throw erroCeps;
      }

      setSalvoComSucesso(true);
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      setSenhaErro("Ocorreu um erro ao salvar as alterações: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExportarDados = () => {
    // Coleta todos os dados num objeto JSON e faz o download
    const dadosExportacao = {
      empresa: {
        nomeResponsavel, telefonePrincipal, telefoneOpcional, email,
        razaoSocial, nomeFantasia, cnpj, acessoTipo, acessoTipoOutro,
        areaEmpresa, areaGeografica, areaGeograficaOutro, sobreEmpresa,
        emiteNotaFiscal, temContaPJ, formasPagamento, formasRecebimento,
        eSocio, temNegrosSocios, autorizaCompartilhamento, diversidadeGlobal
      },
      socios: sociosData.map(s => ({ ...s, foto: undefined })),
      socios_impactados: sociosImpactadosData,
      gestores: gestoresData,
      colaboradores: colaboradoresData
    };
    
    const jsonString = JSON.stringify(dadosExportacao, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dados_diversidade_io_${cnpj.replace(/\D/g, '') || "export"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExcluirConta = async () => {
    const motivo = window.prompt("Tem certeza que deseja excluir sua conta? Por favor, nos diga brevemente o motivo (opcional):");
    
    if (motivo === null) {
      return; // Usuário cancelou o prompt
    }
    
    setSalvando(true);
    try {
      // Cria a solicitação de exclusão
      const { error } = await supabase.from("solicitacoes_exclusao").insert({
        empresa_id: usuario!.empresaId,
        email: email,
        razao_social: razaoSocial,
        motivo: motivo || null,
        status: 'pendente'
      });
      
      if (error) throw error;
      
      alert("Sua solicitação de exclusão foi enviada com sucesso. Nossa equipe processará seu pedido em até 15 dias, conforme a LGPD.");
    } catch (err: any) {
      console.error("Erro ao solicitar exclusão da conta:", err);
      setSenhaErro("Erro ao solicitar exclusão: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // ── Telas de carregamento / proteção ──

  if (authCarregando || carregandoDados) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: "#7030A0" }} />
        <p className="text-gray-600 font-medium">Carregando seus dados...</p>
      </div>
    );
  }

  if (!isLogado) return null;

  if (erroGlobal) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border-t-4 border-red-500 max-w-md w-full text-center">
          <p className="text-red-600 font-semibold mb-6">{erroGlobal}</p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => window.location.reload()} style={{ backgroundColor: "#7030A0" }} className="text-white w-full">
              Tentar novamente
            </Button>
            <Button onClick={handleSairLogout} variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400">
              Sair da conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LayoutUsuario activePath="/meu-cadastro">
      <div className="container mx-auto max-w-5xl py-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Cabeçalho do formulário */}
          <div className="bg-gradient-to-r from-[#0F3A7D] to-[#7030A0] p-8 md:p-12 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{color: '#FFFFFF'}}>Meu Cadastro</h1>
            <p className="text-lg opacity-90">
              Seus dados estão preenchidos abaixo. Edite o que precisar e salve as alterações.
            </p>
          </div>

          {/* Toast de sucesso fixo */}
          {salvoComSucesso && (
            <div
              className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-green-600 text-white px-5 py-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
              style={{ minWidth: '280px' }}
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Alterações salvas com sucesso!</p>
                <p className="text-xs text-green-100">Seus dados foram atualizados.</p>
              </div>
            </div>
          )}

          {/* Banner de erro */}
          {senhaErro && (
            <div className="m-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm">
              <p className="font-semibold">Erro:</p>
              <p>{senhaErro}</p>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="p-8 md:p-12 space-y-12">

            {/* 1. Informações de Acesso e Responsável */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <User className="w-6 h-6 text-[#7030A0]" />
                <h2 className="text-2xl font-semibold text-gray-900">1. Informações de Acesso e Responsável</h2>
              </div>

              <div className="space-y-4">
                <Label className="text-gray-700 font-medium">Foto do Responsável (Rosto e Colorida)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group bg-white">
                  <input type="file" id="fotoResp" className="hidden" accept="image/*"
                    onChange={(e) => { if (e.target.files && e.target.files[0]) setFotoResponsavelFile(e.target.files[0]); }} />
                  <label htmlFor="fotoResp" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    {fotoResponsavelFile ? (
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#7030A0] shadow-md">
                        <img src={URL.createObjectURL(fotoResponsavelFile)} alt="Preview Foto" className="w-full h-full object-cover" />
                      </div>
                    ) : fotoResponsavelUrl ? (
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#7030A0] shadow-md">
                        <img src={fotoResponsavelUrl} alt="Foto Atual" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-[#7030A0]" />
                      </div>
                    )}
                    <p className="text-gray-700 font-medium text-sm mt-2">
                      {fotoResponsavelFile || fotoResponsavelUrl ? "Foto do Sócio" : "Clique para enviar a foto"}
                    </p>
                  </label>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nomeResp" className="text-gray-700 font-medium">Nome Completo do Responsável</Label>
                  <Input id="nomeResp" required value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} placeholder="Digite seu nome completo" className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telPrin" className="text-gray-700 font-medium">Telefone Principal / WhatsApp</Label>
                  <Input id="telPrin" required value={telefonePrincipal} onChange={(e) => setTelefonePrincipal(formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telOpcional" className="text-gray-700 font-medium">Telefone Opcional</Label>
                  <Input id="telOpcional" value={telefoneOpcional} onChange={(e) => setTelefoneOpcional(formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-gray-700 font-medium">E-mail cadastrado</Label>
                  <Input type="email" value={email} disabled className="h-12 bg-gray-100 cursor-not-allowed text-gray-500" />
                  <p className="text-xs text-gray-400">O e-mail não pode ser alterado por esta tela.</p>
                </div>
              </div>
            </section>

            {/* 2. Dados da Empresa */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <Building2 className="w-6 h-6 text-[#7030A0]" />
                <h2 className="text-2xl font-semibold text-gray-900">2. Dados da Empresa</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="text-gray-700 font-medium">CNPJ da empresa</Label>
                  <Input id="cnpj" required value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} className="h-12 bg-gray-50 focus:bg-white" />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-gray-700 font-medium">Upload da Logo da Empresa (Opcional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group bg-white">
                  <input type="file" id="logoEmp" className="hidden" accept="image/*"
                    onChange={(e) => { if (e.target.files && e.target.files[0]) setLogoEmpresaFile(e.target.files[0]); }} />
                  <label htmlFor="logoEmp" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    {logoEmpresaFile ? (
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-blue-600 shadow-md bg-white flex items-center justify-center p-1">
                        <img src={URL.createObjectURL(logoEmpresaFile)} alt="Preview Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : logoEmpresaUrl ? (
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-blue-600 shadow-md bg-white flex items-center justify-center p-1">
                        <img src={logoEmpresaUrl} alt="Logo Atual" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-blue-600" />
                      </div>
                    )}
                    <p className="text-gray-700 font-medium text-sm mt-2">
                      {logoEmpresaFile || logoEmpresaUrl ? "Alterar logo da empresa" : "Clique para enviar a logo"}
                    </p>
                  </label>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="razaoSocial" className="text-gray-700 font-medium">Razão Social</Label>
                  <Input id="razaoSocial" required value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Razão social da empresa" className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nomeFantasia" className="text-gray-700 font-medium">Nome Fantasia</Label>
                  <Input id="nomeFantasia" required value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} placeholder="Nome fantasia" className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">O seu acesso é como: (Pode selecionar mais de um)</Label>
                  <div className="flex flex-col gap-3 mt-2">
                    {[
                      "EMPRESA OU INICIATIVA INCENTIVADORA",
                      "FORNECEDOR INCLUSIVO",
                      "EMPREENDIMENTO DIVERSO",
                      "OUTRO"
                    ].map((opcao) => (
                      <div key={opcao} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`acesso-${opcao}`} 
                          checked={acessoTipo.includes(opcao)}
                          onCheckedChange={(checked) => {
                            setAcessoTipo(prev => 
                              checked 
                                ? [...prev, opcao] 
                                : prev.filter(item => item !== opcao)
                            );
                          }}
                        />
                        <Label htmlFor={`acesso-${opcao}`} className="font-normal cursor-pointer">
                          {opcao === "OUTRO" ? "OUTRO - CITE AQUI" : opcao}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {acessoTipo.includes("OUTRO") && (
                    <Input 
                      required 
                      value={acessoTipoOutro} 
                      onChange={e=>setAcessoTipoOutro(e.target.value)} 
                      placeholder="Qual o seu tipo de acesso?" 
                      className="h-12 bg-gray-50 focus:bg-white mt-2" 
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Área da Empresa</Label>
                  <Select value={areaEmpresa} onValueChange={setAreaEmpresa}>
                    <SelectTrigger className="h-12 bg-gray-50 focus:bg-white">
                      <SelectValue placeholder="Selecione a área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Comércio">Comércio</SelectItem>
                      <SelectItem value="Governo">Governo</SelectItem>
                      <SelectItem value="Indústria">Indústria</SelectItem>
                      <SelectItem value="ONGs">ONGs</SelectItem>
                      <SelectItem value="Serviços">Serviços</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Área Geográfica de Busca</Label>
                  <Select value={areaGeografica} onValueChange={setAreaGeografica}>
                    <SelectTrigger className="h-12 bg-gray-50 focus:bg-white">
                      <SelectValue placeholder="Selecione a abrangência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Meu Bairro">Meu Bairro</SelectItem>
                      <SelectItem value="Minha região da minha cidade">Minha região da minha cidade</SelectItem>
                      <SelectItem value="Minha cidade">Minha cidade</SelectItem>
                      <SelectItem value="Minha cidade e o entorno">Minha cidade e o entorno</SelectItem>
                      <SelectItem value="Meu estado">Meu estado</SelectItem>
                      <SelectItem value="Os estados da minha região">Os estados da minha região</SelectItem>
                      <SelectItem value="Todo o Brasil">Todo o Brasil</SelectItem>
                      <SelectItem value="Outro">Outro - Detalhe</SelectItem>
                    </SelectContent>
                  </Select>
                  {areaGeografica === "Outro" && (
                    <Input 
                      required 
                      value={areaGeograficaOutro} 
                      onChange={e=>setAreaGeograficaOutro(e.target.value)} 
                      placeholder="Detalhe a área geográfica" 
                      className="h-12 bg-gray-50 focus:bg-white mt-2" 
                    />
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Suba o PDF do Cartão CNPJ</Label>
                  <div className={`border-2 border-dashed ${cartaoCnpjFile || cartaoCnpjUrl ? "border-[#7030A0] bg-purple-50" : "border-gray-300 bg-white"} rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group`}>
                    <input type="file" id="cartaoCnpj" className="hidden" accept=".pdf"
                      onChange={(e) => { if (e.target.files && e.target.files[0]) setCartaoCnpjFile(e.target.files[0]); }} />
                    <label htmlFor="cartaoCnpj" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                      <div className={`w-10 h-10 rounded-full ${cartaoCnpjFile || cartaoCnpjUrl ? "bg-[#7030A0]" : "bg-purple-100"} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <FileText className={`w-5 h-5 ${cartaoCnpjFile || cartaoCnpjUrl ? "text-white" : "text-[#7030A0]"}`} />
                      </div>
                      <p className="text-gray-700 font-medium text-sm">
                        {cartaoCnpjFile ? <span className="text-[#7030A0]">{cartaoCnpjFile.name}</span> : 
                         cartaoCnpjUrl ? <a href={cartaoCnpjUrl} target="_blank" rel="noreferrer" className="text-[#7030A0] hover:underline" onClick={(e) => e.stopPropagation()}>Ver arquivo salvo (clique para abrir) ou escolha outro</a> : 
                         "Clique para enviar Cartão CNPJ"}
                      </p>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Ficha Simples da Junta Comercial (PDF)</Label>
                  <div className={`border-2 border-dashed ${fichaJuntaFile || fichaJuntaUrl ? "border-[#7030A0] bg-purple-50" : "border-gray-300 bg-white"} rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group`}>
                    <input type="file" id="fichaJunta" className="hidden" accept=".pdf"
                      onChange={(e) => { if (e.target.files && e.target.files[0]) handleFichaJuntaChange(e.target.files[0]); }} />
                    <label htmlFor="fichaJunta" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                      <div className={`w-10 h-10 rounded-full ${fichaJuntaFile || fichaJuntaUrl ? "bg-[#7030A0]" : "bg-purple-100"} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <FileText className={`w-5 h-5 ${fichaJuntaFile || fichaJuntaUrl ? "text-white" : "text-[#7030A0]"}`} />
                      </div>
                      {analisandoJucesp ? (
                        <span className="text-sm text-[#7030A0] flex items-center gap-1 font-medium">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analisando documento...
                        </span>
                      ) : jucespPreencheu ? (
                        <span className="text-sm text-green-600 flex items-center gap-1 font-medium">
                          <Sparkles className="w-4 h-4" />
                          Valor e percentual de participação extraídos e preenchidos no Quadro Societário! Lembre-se de preencher o restante das informações.
                        </span>
                      ) : (
                        <p className="text-gray-700 font-medium text-sm">
                          {fichaJuntaFile ? <span className="text-[#7030A0]">{fichaJuntaFile.name}</span> : 
                           fichaJuntaUrl ? <a href={fichaJuntaUrl} target="_blank" rel="noreferrer" className="text-[#7030A0] hover:underline" onClick={(e) => e.stopPropagation()}>Ver arquivo salvo (clique para abrir) ou escolha outro</a> : 
                           "Clique para enviar Ficha Simples"}
                        </p>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="sobre" className="text-gray-700 font-medium">Sobre a Empresa</Label>
                <p className="text-xs text-gray-500 mb-2">Descreva em um parágrafo o que a sua empresa faz, o diferencial dela e onde atua.</p>
                <Textarea id="sobre" required value={sobreEmpresa} onChange={(e) => setSobreEmpresa(e.target.value)} placeholder="Escreva sobre sua empresa aqui..." className="min-h-[120px] bg-gray-50 focus:bg-white resize-y" />
              </div>
            </section>

            {/* 3. Financeiro e Operacional */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <Wallet className="w-6 h-6 text-[#7030A0]" />
                <h2 className="text-2xl font-semibold text-gray-900">3. Financeiro e Operacional</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <Label className="text-gray-800 font-semibold text-base">Formas de Pagamento utilizadas</Label>
                  <div className="space-y-2 mt-2">
                    {["Boleto", "Depósito", "PIX", "Transferência"].map((forma) => (
                      <div key={`pag-${forma}`} className="flex items-center gap-2">
                        <Checkbox id={`pag-${forma}`} checked={formasPagamento.includes(forma)} onCheckedChange={() => handlePagamentoToggle(forma)} />
                        <label htmlFor={`pag-${forma}`} className="text-sm font-medium text-gray-700 cursor-pointer">{forma}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <Label className="text-gray-800 font-semibold text-base">Formas de Recebimento utilizadas</Label>
                  <div className="space-y-2 mt-2">
                    {["Boleto", "Depósito", "PIX", "Transferência"].map((forma) => (
                      <div key={`rec-${forma}`} className="flex items-center gap-2">
                        <Checkbox id={`rec-${forma}`} checked={formasRecebimento.includes(forma)} onCheckedChange={() => handleRecebimentoToggle(forma)} />
                        <label htmlFor={`rec-${forma}`} className="text-sm font-medium text-gray-700 cursor-pointer">{forma}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-gray-800 font-semibold text-base">Sua empresa emite nota fiscal?</Label>
                  <RadioGroup value={emiteNotaFiscal} onValueChange={setEmiteNotaFiscal} className="flex gap-6 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Sim" id="nf-sim" />
                      <Label htmlFor="nf-sim">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Não" id="nf-nao" />
                      <Label htmlFor="nf-nao">Não</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label className="text-gray-800 font-semibold text-base">Sua empresa tem conta bancária como PJ?</Label>
                  <RadioGroup value={temContaPJ} onValueChange={setTemContaPJ} className="flex gap-6 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Sim" id="pj-sim" />
                      <Label htmlFor="pj-sim">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Não" id="pj-nao" />
                      <Label htmlFor="pj-nao">Não</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </section>

            {/* 4. Perfil, Sócios e Impacto */}
            <section className="space-y-8">
              <div className="flex items-center gap-3 border-b pb-2">
                <Users className="w-6 h-6 text-[#7030A0]" />
                <h2 className="text-2xl font-semibold text-gray-900">4. Perfil, Sócios e Impacto</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6 bg-purple-50/50 p-6 rounded-xl border border-purple-100">
                <div className="space-y-3">
                  <Label className="text-gray-800 font-semibold">Você é sócio da empresa?</Label>
                  <RadioGroup value={eSocio} onValueChange={setESocio} className="flex gap-6 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Sim" id="socio-sim" />
                      <Label htmlFor="socio-sim">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Não" id="socio-nao" />
                      <Label htmlFor="socio-nao">Não</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-3">
                  <Label className="text-gray-800 font-semibold">Existem pessoas negras entre os sócios?</Label>
                  <RadioGroup value={temNegrosSocios} onValueChange={setTemNegrosSocios} className="flex gap-6 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Sim" id="negro-sim" />
                      <Label htmlFor="negro-sim">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Não" id="negro-nao" />
                      <Label htmlFor="negro-nao">Não</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Sócios */}
              <div className="space-y-6">
                <div className="space-y-2 border-b pb-2">
                  <h3 className="text-xl font-semibold text-gray-900">Quadro Societário</h3>
                  <p className="text-gray-600 text-sm">Preencha individualmente o perfil de cada sócio da empresa.</p>
                </div>

                <div className="space-y-4">
                  <Label htmlFor="numeroSocios" className="text-gray-700 font-medium">Número de sócios:</Label>
                  <Input
                    id="numeroSocios"
                    type="number"
                    min="1"
                    value={numeroSocios}
                    onChange={(e) => handleNumeroSociosChange(e.target.value)}
                    placeholder="Quantos sócios a empresa possui?"
                    className="h-12 md:w-1/3 bg-gray-50 focus:bg-white"
                  />
                </div>

                {sociosData.length > 0 && (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                    {sociosData.map((socio, idx) => (
                      <Dialog key={idx}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-2 border-dashed hover:border-[#7030A0] hover:bg-purple-50 transition-colors">
                            <span className="font-semibold text-[#0F3A7D]">Sócio {idx + 1}</span>
                            <span className="text-xs text-gray-500">{socio.nome ? "Preenchido" : "Preencher informações"}</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-2xl font-bold text-[#7030A0]">Informações do Sócio {idx + 1}</DialogTitle>
                          </DialogHeader>

                          <div className="space-y-6 pt-4 pb-8">
                            <div className="space-y-4">
                              <Label className="text-gray-700 font-medium">Foto do Sócio</Label>
                              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group bg-white">
                                <input type="file" id={`foto-socio-${idx}`} className="hidden" accept="image/*"
                                  onChange={(e) => { if (e.target.files && e.target.files[0]) updateSocio(idx, "foto", e.target.files[0]); }} />
                                <label htmlFor={`foto-socio-${idx}`} className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                                  {socio.foto ? (
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#7030A0] shadow-md">
                                      <img src={URL.createObjectURL(socio.foto as File)} alt={`Preview Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                  ) : socio.fotoUrl ? (
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#7030A0] shadow-md">
                                      <img src={socio.fotoUrl} alt={`Foto Atual ${idx + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                      <Upload className="w-8 h-8 text-[#7030A0]" />
                                    </div>
                                  )}
                                  <p className="text-gray-700 font-medium text-sm mt-2">{socio.foto || socio.fotoUrl ? "Foto do Sócio" : "Clique para enviar a foto"}</p>
                                </label>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-gray-700 font-medium">Fonte da Imagem</Label>
                              <RadioGroup value={socio.fonteImagem} onValueChange={(v) => updateSocio(idx, "fonteImagem", v)} className="flex flex-wrap gap-4 mt-1">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Empreendedor" id={`fonte-emp-${idx}`} />
                                  <Label htmlFor={`fonte-emp-${idx}`}>Fornecido pelo empreendedor</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Rede Social" id={`fonte-red-${idx}`} />
                                  <Label htmlFor={`fonte-red-${idx}`}>Retirado de rede social</Label>
                                </div>
                              </RadioGroup>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">Nome do Sócio</Label>
                                <Input value={socio.nome} onChange={(e) => updateSocio(idx, "nome", e.target.value)} placeholder="Nome completo" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">CPF</Label>
                                <Input value={socio.cpf} onChange={(e) => updateSocio(idx, "cpf", formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">Valor da Participação</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                                  <Input className="pl-9" value={socio.participacaoValor} onChange={(e) => updateSocio(idx, "participacaoValor", e.target.value)} placeholder="0,00" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">Percentual da Empresa</Label>
                                <div className="relative">
                                  <Input className="pr-8" value={socio.participacaoPercentual} onChange={(e) => updateSocio(idx, "participacaoPercentual", e.target.value)} placeholder="0" />
                                  <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">E-mail</Label>
                                <Input type="email" value={socio.email} onChange={(e) => updateSocio(idx, "email", e.target.value)} placeholder="email@socio.com" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">Data de Nascimento</Label>
                                <DrumDatePicker
                                  value={socio.dataNascimento}
                                  onChange={(v) => updateSocio(idx, 'dataNascimento', v)}
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label className="text-gray-700 font-medium">CEP</Label>
                                <Input value={socio.cep} onChange={(e) => handleCepSocioChange(idx, e.target.value)} placeholder="00000-000" maxLength={9} />
                                {socio.cepEndereco && (
                                  <p className={`text-xs mt-1 ${socio.cepValido ? "text-gray-500" : "text-red-500 font-semibold"}`}>{socio.cepEndereco}</p>
                                )}
                              </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Nacionalidade</Label>
                                  <Input value={socio.nacionalidade} onChange={(e) => updateSocio(idx, "nacionalidade", e.target.value)} placeholder="Ex: Brasileira" />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Idade</Label>
                                  <Input value={socio.etariedade} onChange={(e) => updateSocio(idx, "etariedade", e.target.value)} placeholder="Sua idade" />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium flex items-center gap-1">
                                    Raça/Cor
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="w-4 h-4 text-gray-400 cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[300px]">
                                        <p>Esse termo é utilizado para manter o alinhamento com as classificações oficiais de órgãos governamentais (como IBGE e JUCESP), garantindo a padronização dos dados.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </Label>
                                  <Select value={socio.raca} onValueChange={(v) => updateSocio(idx, 'raca', v)}>
                                    <SelectTrigger className="bg-white">
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Pardo">Pardo</SelectItem>
                                      <SelectItem value="Preto">Preto</SelectItem>
                                      <SelectItem value="Branco">Branco</SelectItem>
                                      <SelectItem value="Amarelo">Amarelo</SelectItem>
                                      <SelectItem value="Indígena">Indígena</SelectItem>
                                      <SelectItem value="Outro">Outro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Sexo</Label>
                                  <Select value={socio.sexo} onValueChange={(v) => updateSocio(idx, 'sexo', v)}>
                                    <SelectTrigger className="bg-white">
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Masculino">Masculino</SelectItem>
                                      <SelectItem value="Feminino">Feminino</SelectItem>
                                      <SelectItem value="Outro">Outro</SelectItem>
                                      <SelectItem value="Prefiro não declarar">Prefiro não declarar</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {socio.sexo === "Outro" && (
                                    <Input 
                                      className="mt-2" 
                                      value={socio.sexoOutro} 
                                      onChange={(e) => updateSocio(idx, 'sexoOutro', e.target.value)} 
                                      placeholder="Qual o outro?" 
                                    />
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Gênero</Label>
                                  <Select value={socio.genero} onValueChange={(v) => updateSocio(idx, 'genero', v)}>
                                    <SelectTrigger className="bg-white">
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Homem cisgênero">Homem cisgênero</SelectItem>
                                      <SelectItem value="Homem trans">Homem trans</SelectItem>
                                      <SelectItem value="Mulher cisgênero">Mulher cisgênero</SelectItem>
                                      <SelectItem value="Mulher trans">Mulher trans</SelectItem>
                                      <SelectItem value="Agênero">Agênero</SelectItem>
                                      <SelectItem value="Gênero neutro">Gênero neutro</SelectItem>
                                      <SelectItem value="Não binário">Não binário</SelectItem>
                                      <SelectItem value="Prefiro não declarar">Prefiro não declarar</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>                                <div className="space-y-2 md:col-span-2 mt-2">
                                  <Label className="text-gray-700 font-medium mb-2 block">Possui algum tipo de deficiência?</Label>
                                  <RadioGroup value={socio.deficiencia} onValueChange={(v) => updateSocio(idx, "deficiencia", v)} className="flex gap-6">
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="Sim" id={`def-sim-${idx}`} />
                                      <Label htmlFor={`def-sim-${idx}`}>Sim</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="Não" id={`def-nao-${idx}`} />
                                      <Label htmlFor={`def-nao-${idx}`}>Não</Label>
                                    </div>
                                  </RadioGroup>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end pt-6 border-t border-gray-100 mt-6">
                              <DialogClose asChild>
                                <Button 
                                  className="bg-[#7030A0] hover:bg-[#5a2680] text-white"
                                  onClick={(e) => {
                                    handleFormSubmit({ preventDefault: () => {} } as React.FormEvent);
                                  }}
                                >
                                  Confirmar Informações
                                </Button>
                              </DialogClose>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
              </div>

              {/* Localização dos Gestores e Colaboradores */}
              <div className="space-y-6 pt-6">
                <div className="space-y-2 border-b pb-2">
                  <h3 className="text-xl font-semibold text-gray-900">Localização dos Gestores e Colaboradores</h3>
                  <p className="text-gray-600 text-sm">
                    Informe a quantidade de gestores e colaboradores da empresa e registre o CEP de onde cada um reside. O CEP dos sócios já é coletado no Quadro Societário acima.
                  </p>
                </div>

                {/* Gestores Diretos */}
                <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800">Gestores</h4>
                    <Label htmlFor="numGestoresDiretos" className="text-gray-700 font-medium">Quantidade de gestores:</Label>
                    <Input id="numGestoresDiretos" type="number" min="0" value={numGestoresDiretos}
                      onChange={(e) => handleNumeroGestoresDiretosChange(e.target.value)} placeholder="Ex: 3" className="h-12 bg-white md:w-1/3" />
                  </div>
                  {typeof numGestoresDiretos === "number" && numGestoresDiretos > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {gestoresDiretosData.map((gestor, idx) => (
                        <div key={`gestor-direto-${idx}`} className="border rounded-xl p-4 space-y-3 bg-white">
                          <p className="text-sm font-semibold text-gray-700">Gestor {idx + 1}</p>
                          <div className="space-y-1">
                            <Label className="text-gray-600 text-xs">País</Label>
                            <Select value={gestor.pais || "BR"} onValueChange={(v) => handlePaisChange(setGestoresDiretosData, idx, v)}>
                              <SelectTrigger className="h-10 bg-gray-50"><SelectValue /></SelectTrigger>
                              <SelectContent>{PAISES.map(p => <SelectItem key={p.codigo} value={p.codigo}>{p.nome}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`cp-gestor-direto-${idx}`} className="text-gray-600 text-xs">{gestor.pais === "BR" ? "CEP" : "Código Postal"}</Label>
                            <Input id={`cp-gestor-direto-${idx}`} value={gestor.codigoPostal} onChange={(e) => handleCodigoPostalChange(setGestoresDiretosData, gestoresDiretosData, idx, e.target.value)} onBlur={handleCepsBlur} placeholder={gestor.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
                          </div>
                          {gestor.cepEndereco && (
                            <p className={`text-xs flex items-center gap-1 ${gestor.cepValido ? 'text-green-600' : 'text-red-500 font-semibold'}`}>
                              {gestor.cepValido ? '✅' : '❌'} {gestor.cepEndereco}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Colaboradores Diretos */}
                <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800">Colaboradores</h4>
                    <Label htmlFor="numColaboradoresDiretos" className="text-gray-700 font-medium">Quantidade de colaboradores:</Label>
                    <Input id="numColaboradoresDiretos" type="number" min="0" value={numColaboradoresDiretos}
                      onChange={(e) => handleNumeroColaboradoresDiretosChange(e.target.value)} placeholder="Ex: 10" className="h-12 bg-white md:w-1/3" />
                  </div>
                  {typeof numColaboradoresDiretos === "number" && numColaboradoresDiretos > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {colaboradoresDiretosData.map((colaborador, idx) => (
                        <div key={`colab-direto-${idx}`} className="border rounded-xl p-4 space-y-3 bg-white">
                          <p className="text-sm font-semibold text-gray-700">Colaborador {idx + 1}</p>
                          <div className="space-y-1">
                            <Label className="text-gray-600 text-xs">País</Label>
                            <Select value={colaborador.pais || "BR"} onValueChange={(v) => handlePaisChange(setColaboradoresDiretosData, idx, v)}>
                              <SelectTrigger className="h-10 bg-gray-50"><SelectValue /></SelectTrigger>
                              <SelectContent>{PAISES.map(p => <SelectItem key={p.codigo} value={p.codigo}>{p.nome}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`cp-colab-direto-${idx}`} className="text-gray-600 text-xs">{colaborador.pais === "BR" ? "CEP" : "Código Postal"}</Label>
                            <Input id={`cp-colab-direto-${idx}`} value={colaborador.codigoPostal} onChange={(e) => handleCodigoPostalChange(setColaboradoresDiretosData, colaboradoresDiretosData, idx, e.target.value)} onBlur={handleCepsBlur} placeholder={colaborador.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
                          </div>
                          {colaborador.cepEndereco && (
                            <p className={`text-xs flex items-center gap-1 ${colaborador.cepValido ? 'text-green-600' : 'text-red-500 font-semibold'}`}>
                              {colaborador.cepValido ? '✅' : '❌'} {colaborador.cepEndereco}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pessoas Impactadas */}
              <div className="space-y-6 pt-6">
                <div className="space-y-2 border-b pb-2">
                  <h3 className="text-xl font-semibold text-gray-900">Pessoas Impactadas</h3>
                  <p className="text-gray-600 text-sm">
                    Informe o número de pessoas impactadas financeiramente pelo salário de cada grupo para listarmos os CEPs.
                  </p>
                </div>

                <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800">Impactadas pelo salário do Sócio(a)s</h4>
                    <Label htmlFor="impactadasSocios" className="text-gray-700 font-medium">Número de pessoas impactadas:</Label>
                    <Input id="impactadasSocios" type="number" min="0" value={numeroImpactadasSocios}
                      onChange={(e) => handleNumeroSociosImpactadosChange(e.target.value)} placeholder="Ex: 5" className="h-12 bg-white md:w-1/3" />
                  </div>
                  {typeof numeroImpactadasSocios === "number" && numeroImpactadasSocios > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {sociosImpactadosData.map((socio, idx) => (
                        <div key={`socios-impactados-${idx}`} className="border rounded-xl p-4 space-y-3 bg-white">
                          <p className="text-sm font-semibold text-gray-700">Pessoa {idx + 1}</p>
                          <div className="space-y-1">
                            <Label className="text-gray-600 text-xs">País</Label>
                            <Select value={socio.pais || "BR"} onValueChange={(v) => handlePaisChange(setSociosImpactadosData, idx, v)}>
                              <SelectTrigger className="h-10 bg-gray-50"><SelectValue /></SelectTrigger>
                              <SelectContent>{PAISES.map(p => <SelectItem key={p.codigo} value={p.codigo}>{p.nome}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`cp-socios-impactados-${idx}`} className="text-gray-600 text-xs">{socio.pais === "BR" ? "CEP" : "Código Postal"}</Label>
                            <Input id={`cp-socios-impactados-${idx}`} value={socio.codigoPostal} onChange={(e) => handleCodigoPostalChange(setSociosImpactadosData, sociosImpactadosData, idx, e.target.value)} onBlur={handleCepsBlur} placeholder={socio.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
                          </div>
                          {socio.cepEndereco && (
                            <p className={`text-xs flex items-center gap-1 ${socio.cepValido ? 'text-green-600' : 'text-red-500 font-semibold'}`}>
                              {socio.cepValido ? '✅' : '❌'} {socio.cepEndereco}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800">Impactadas pelo salário do Gestore(a)s</h4>
                    <Label htmlFor="impactadasGestores" className="text-gray-700 font-medium">Número de pessoas impactadas:</Label>
                    <Input id="impactadasGestores" type="number" min="0" value={numeroImpactadasGestores}
                      onChange={(e) => handleNumeroGestoresChange(e.target.value)} placeholder="Ex: 5" className="h-12 bg-white md:w-1/3" />
                  </div>
                  {typeof numeroImpactadasGestores === "number" && numeroImpactadasGestores > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {gestoresData.map((gestor, idx) => (
                        <div key={`gestores-${idx}`} className="border rounded-xl p-4 space-y-3 bg-white">
                          <p className="text-sm font-semibold text-gray-700">Pessoa {idx + 1}</p>
                          <div className="space-y-1">
                            <Label className="text-gray-600 text-xs">País</Label>
                            <Select value={gestor.pais || "BR"} onValueChange={(v) => handlePaisChange(setGestoresData, idx, v)}>
                              <SelectTrigger className="h-10 bg-gray-50"><SelectValue /></SelectTrigger>
                              <SelectContent>{PAISES.map(p => <SelectItem key={p.codigo} value={p.codigo}>{p.nome}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`cp-gestores-${idx}`} className="text-gray-600 text-xs">{gestor.pais === "BR" ? "CEP" : "Código Postal"}</Label>
                            <Input id={`cp-gestores-${idx}`} value={gestor.codigoPostal} onChange={(e) => handleCodigoPostalChange(setGestoresData, gestoresData, idx, e.target.value)} onBlur={handleCepsBlur} placeholder={gestor.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
                          </div>
                          {gestor.cepEndereco && (
                            <p className={`text-xs flex items-center gap-1 ${gestor.cepValido ? 'text-green-600' : 'text-red-500 font-semibold'}`}>
                              {gestor.cepValido ? '✅' : '❌'} {gestor.cepEndereco}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800">Impactadas pelo salário do Colaboradore(a)s</h4>
                    <Label htmlFor="impactadasColab" className="text-gray-700 font-medium">Número de pessoas impactadas:</Label>
                    <Input id="impactadasColab" type="number" min="0" value={numeroImpactadasColaboradores}
                      onChange={(e) => handleNumeroColaboradoresChange(e.target.value)} placeholder="Ex: 5" className="h-12 bg-white md:w-1/3" />
                  </div>
                  {typeof numeroImpactadasColaboradores === "number" && numeroImpactadasColaboradores > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {colaboradoresData.map((colaborador, idx) => (
                        <div key={`colab-${idx}`} className="border rounded-xl p-4 space-y-3 bg-white">
                          <p className="text-sm font-semibold text-gray-700">Pessoa {idx + 1}</p>
                          <div className="space-y-1">
                            <Label className="text-gray-600 text-xs">País</Label>
                            <Select value={colaborador.pais || "BR"} onValueChange={(v) => handlePaisChange(setColaboradoresData, idx, v)}>
                              <SelectTrigger className="h-10 bg-gray-50"><SelectValue /></SelectTrigger>
                              <SelectContent>{PAISES.map(p => <SelectItem key={p.codigo} value={p.codigo}>{p.nome}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`cp-colab-${idx}`} className="text-gray-600 text-xs">{colaborador.pais === "BR" ? "CEP" : "Código Postal"}</Label>
                            <Input id={`cp-colab-${idx}`} value={colaborador.codigoPostal} onChange={(e) => handleCodigoPostalChange(setColaboradoresData, colaboradoresData, idx, e.target.value)} onBlur={handleCepsBlur} placeholder={colaborador.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
                          </div>
                          {colaborador.cepEndereco && (
                            <p className={`text-xs flex items-center gap-1 ${colaborador.cepValido ? 'text-green-600' : 'text-red-500 font-semibold'}`}>
                              {colaborador.cepValido ? '✅' : '❌'} {colaborador.cepEndereco}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Diversidade Global */}
              <div className="space-y-6 pt-6">
                <div className="space-y-2 border-b pb-2 flex items-center gap-2">
                  <Users className="w-6 h-6 text-[#7030A0]" />
                  <h3 className="text-xl font-semibold text-gray-900">Recortes de Diversidade — RIS v1.0</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Informe o total de pessoas por cargo e a quantidade em cada recorte. Os percentuais são calculados automaticamente.
                </p>

                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        <th className="p-4 font-bold text-gray-700">Recorte</th>
                        <th colSpan={2} className="p-4 font-bold text-[#7030A0] text-center border-l border-gray-100">Sócios</th>
                        <th colSpan={2} className="p-4 font-bold text-[#7030A0] text-center border-l border-gray-100">Gestores</th>
                        <th colSpan={2} className="p-4 font-bold text-[#7030A0] text-center border-l border-gray-100">Colaboradores</th>
                      </tr>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                        <th className="p-2 font-semibold text-gray-700"></th>
                        <th className="p-2 font-semibold text-gray-700 text-center border-l border-gray-100">Qtd</th>
                        <th className="p-2 font-semibold text-gray-700 text-center">%</th>
                        <th className="p-2 font-semibold text-gray-700 text-center border-l border-gray-100">Qtd</th>
                        <th className="p-2 font-semibold text-gray-700 text-center">%</th>
                        <th className="p-2 font-semibold text-gray-700 text-center border-l border-gray-100">Qtd</th>
                        <th className="p-2 font-semibold text-gray-700 text-center">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(() => {
                        const recortes = [
                          { label: "Total de Pessoas", bg: "bg-blue-50/50", labelColor: "text-blue-700 font-semibold" },
                          { label: "Pessoas Negras (pretas e pardas)", bg: "bg-white", labelColor: "text-gray-700 font-semibold" },
                          { label: "Mulheres", bg: "bg-white", labelColor: "text-gray-700 font-semibold" },
                          { label: "Pessoas com Deficiência (PCD)", bg: "bg-white", labelColor: "text-gray-700 font-semibold" },
                          { label: "Pessoas 60+", bg: "bg-white", labelColor: "text-gray-700 font-semibold" },
                          { label: "Dependentes financeiros (não entram no Score RIS)", bg: "bg-purple-50/30", labelColor: "text-[#7030A0] font-semibold text-sm" }
                        ];

                        const calcPercent = (qtdStr: string, totalStr: string) => {
                          const qtd = parseInt(qtdStr);
                          const total = parseInt(totalStr);
                          if (isNaN(qtd) || isNaN(total) || total === 0) return "0.0%";
                          return ((qtd / total) * 100).toFixed(1) + "%";
                        };

                        return recortes.map((recorte, idx) => {
                          const isTotal = recorte.label === "Total de Pessoas";
                          const isDep = recorte.label === "Dependentes financeiros (não entram no Score RIS)";
                          
                          const key = recorte.label as keyof typeof diversidadeGlobal;
                          const totalSocios = diversidadeGlobal["Total de Pessoas"].socios;
                          const totalGestores = diversidadeGlobal["Total de Pessoas"].gestores;
                          const totalColab = diversidadeGlobal["Total de Pessoas"].colaboradores;

                          return (
                            <tr key={idx} className={`${recorte.bg} transition-colors`}>
                              <td className={`p-4 ${recorte.labelColor}`}>
                                {recorte.label.includes("(") && !isDep && !recorte.label.includes("Total") ? (
                                  <>
                                    {recorte.label.split(" (")[0]}
                                    <br/>
                                    <span className="text-xs text-gray-500 font-normal">({recorte.label.split(" (")[1]}</span>
                                  </>
                                ) : isDep ? (
                                  <>
                                    Dependentes financeiros
                                    <br/>
                                    <span className="text-xs font-normal opacity-70">(não entram no Score RIS)</span>
                                  </>
                                ) : (
                                  recorte.label
                                )}
                              </td>
                              
                              {/* Sócios */}
                              <td className="p-3 text-center border-l border-gray-100">
                                <Input 
                                  className="w-20 mx-auto text-center h-10" 
                                  value={diversidadeGlobal[key]?.socios || ""}
                                  onChange={(e) => handleDiversidadeQtdChange(key, 'socios', e.target.value)}
                                  onBlur={() => handleDiversidadeBlur()}
                                />
                              </td>
                              <td className="p-3 text-center font-bold text-[#7030A0]">
                                {isTotal ? <span className="text-blue-400 font-normal">—</span> : isDep ? <span className="text-purple-300 font-normal">—</span> : calcPercent(diversidadeGlobal[key]?.socios || "", totalSocios)}
                              </td>

                              {/* Gestores */}
                              <td className="p-3 text-center border-l border-gray-100">
                                <Input 
                                  className="w-20 mx-auto text-center h-10" 
                                  value={diversidadeGlobal[key]?.gestores || ""}
                                  onChange={(e) => handleDiversidadeQtdChange(key, 'gestores', e.target.value)}
                                  onBlur={() => handleDiversidadeBlur()}
                                />
                              </td>
                              <td className="p-3 text-center font-bold text-[#7030A0]">
                                {isTotal ? <span className="text-blue-400 font-normal">—</span> : isDep ? <span className="text-purple-300 font-normal">—</span> : calcPercent(diversidadeGlobal[key]?.gestores || "", totalGestores)}
                              </td>

                              {/* Colaboradores */}
                              <td className="p-3 text-center border-l border-gray-100">
                                <Input 
                                  className="w-20 mx-auto text-center h-10" 
                                  value={diversidadeGlobal[key]?.colaboradores || ""}
                                  onChange={(e) => handleDiversidadeQtdChange(key, 'colaboradores', e.target.value)}
                                  onBlur={() => handleDiversidadeBlur()}
                                />
                              </td>
                              <td className="p-3 text-center font-bold text-[#7030A0]">
                                {isTotal ? <span className="text-blue-400 font-normal">—</span> : isDep ? <span className="text-purple-300 font-normal">—</span> : calcPercent(diversidadeGlobal[key]?.colaboradores || "", totalColab)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Autorizações Finais */}
              <div className="space-y-6 pt-6 pb-6 bg-gradient-to-r from-purple-50 to-white p-6 rounded-xl border border-purple-100">
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-purple-900">1. Tratamento de Dados (Opt-in)</h3>
                  <p className="text-sm text-gray-700 leading-relaxed text-justify">
                    Como titular dos dados, você manifesta seu consentimento livre, expresso e inequívoco para a coleta e o tratamento de seus dados pessoais sensíveis (incluindo raça/etnia e dados biométricos), ciente de que eles serão utilizados para fins de identificação, confirmação de identidade e reconhecimento facial, com o objetivo de viabilizar a participação em ações e programas voltados para empreendedores do ecossistema de diversidade (pessoas negras, mulheres, entre outros), conforme nossa Política de Privacidade.
                  </p>
                  <div className="flex items-start gap-3 mt-4 bg-white p-4 rounded-lg border border-purple-100">
                    <Checkbox
                      id="opt-in"
                      checked={autorizaCompartilhamento === "Sim"}
                      onCheckedChange={(checked) => setAutorizaCompartilhamento(checked ? "Sim" : "Não")}
                      className="mt-1 w-5 h-5 rounded data-[state=checked]:bg-[#7030A0] data-[state=checked]:border-[#7030A0]"
                    />
                    <Label htmlFor="opt-in" className="text-sm font-medium text-gray-800 leading-snug cursor-pointer">
                      Estou de acordo e dou meu consentimento para o tratamento dos meus dados sensíveis.
                    </Label>
                  </div>
                </div>

                <div className="border-t border-purple-100 pt-6 space-y-3">
                  <h3 className="text-lg font-bold text-purple-900">2. Revogação (Opt-out)</h3>
                  <p className="text-sm text-gray-700 leading-relaxed text-justify">
                    Você pode revogar o seu consentimento a qualquer momento. Caso não deseje mais que seus dados sejam tratados para estas finalidades, clique no botão abaixo ou entre em contato com nosso Encarregado de Dados pelo e-mail: <a href="mailto:adm@diversidade.io" className="text-[#7030A0] font-semibold hover:underline">adm@diversidade.io</a>.
                  </p>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
                      onClick={() => {
                        setAutorizaCompartilhamento("Não");
                        alert("Seu consentimento foi revogado. A caixa de seleção acima foi desmarcada.");
                      }}
                    >
                      Revogar meu Consentimento
                    </Button>
                  )}
                </div>

                <div className="border-t border-purple-100 pt-6 space-y-3">
                  <h3 className="text-lg font-bold text-purple-900">3. Tenho dúvidas</h3>
                  <p className="text-sm text-gray-700">
                    Ficou com alguma dúvida sobre o uso dos seus dados?
                  </p>
                  <Button asChild variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 font-medium">
                    <a href="https://wa.me/5511966060828?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20uso%20dos%20meus%20dados." target="_blank" rel="noopener noreferrer">
                      Chamar no WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </section>

            <div className="pt-8 flex flex-col sm:flex-row gap-6 items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {isAdmin 
                  ? "Seus dados estão protegidos. O preenchimento completo ajuda na busca por novos negócios."
                  : "Apenas o administrador da empresa pode realizar alterações neste cadastro."
                }
              </p>
              {isAdmin && (
                <Button
                  type="submit"
                  disabled={salvando}
                  className="w-full sm:w-auto h-14 px-12 text-lg font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#7030A0" }}
                >
                  {salvando ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              )}
            </div>
          </form>

          {/* Seção Direitos do Titular (LGPD) - Fora do formulário para evitar submit acidental */}
          <div className="p-8 md:p-12 border-t border-gray-200 bg-gray-50">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Direitos do Titular (LGPD)</h3>
            <p className="text-sm text-gray-600 mb-6">
              Conforme a Lei Geral de Proteção de Dados (LGPD), você tem o direito de acessar seus dados em formato estruturado ou solicitar a eliminação definitiva deles.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportarDados}
                className="flex items-center gap-2 border-purple-200 text-[#7030A0] hover:bg-purple-50"
              >
                <Download className="w-4 h-4" />
                Baixar meus dados
              </Button>
              {isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExcluirConta}
                  className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir minha conta
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </LayoutUsuario>
  );
}
