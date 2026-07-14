import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Upload, CheckCircle2, User, Building2, Wallet, Users, FileText, Loader2, Sparkles, Info } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { CamposFaltandoPanel, type CampoFaltando } from "@/components/CamposFaltandoPanel";
import logoImage from "@/assets/logo.png";
import { DrumDatePicker } from "@/components/ui/drum-date-picker";
import { supabase } from "@/lib/supabase";
import { extrairSociosDoJucesp } from "@/lib/extrairJucesp";
import { toast } from "sonner";

interface SocioData {
  foto: File | null;
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
  deficiencia: string[];
  deficienciaAuditivaGrau: string;
  deficienciaFisicaGrau: string;
  deficienciaIntelectualGrau: string;
  deficienciaPsicossocialGrau: string;
  deficienciaVisualGrau: string;
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

export default function CadastroGratuito() {
  const [submitted, setSubmitted] = useState(false);
  const [senhaErro, setSenhaErro] = useState("");
  // Controla quando o painel de campos faltando deve aparecer (apenas após 1ª tentativa de envio)
  const [tentouEnviar, setTentouEnviar] = useState(false);

  // 1. Info Acesso e Responsável
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefonePrincipal, setTelefonePrincipal] = useState("");
  const [telefoneOpcional, setTelefoneOpcional] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);

  // Auto-dismiss do toast de sucesso após 3 segundos
  useEffect(() => {
    if (salvoComSucesso) {
      const timer = setTimeout(() => setSalvoComSucesso(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [salvoComSucesso]);

  // 2. Dados Empresa
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cnpjValido, setCnpjValido] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [cnpjErro, setCnpjErro] = useState("");
  const [acessoTipo, setAcessoTipo] = useState<string[]>([]);
  const mostrarCompleto = acessoTipo.length === 0 || acessoTipo.includes("EMPREENDIMENTO DIVERSO");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tipo = params.get('tipo');
    if (tipo === 'empresa-incentivadora') {
      setAcessoTipo(['EMPRESA OU INICIATIVA INCENTIVADORA']);
    } else if (tipo === 'fornecedor-inclusivo') {
      setAcessoTipo(['FORNECEDOR INCLUSIVO']);
    } else if (tipo === 'empreendimento-diverso') {
      setAcessoTipo(['EMPREENDIMENTO DIVERSO']);
    }
  }, []);

  // 2.5 Arquivos
  const [fotoResponsavelFile, setFotoResponsavelFile] = useState<File | null>(null);
  const [logoEmpresaFile, setLogoEmpresaFile] = useState<File | null>(null);
  const [cartaoCnpjFile, setCartaoCnpjFile] = useState<File | null>(null);
  const [fichaJuntaFile, setFichaJuntaFile] = useState<File | null>(null);
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
  // Gestores e colaboradores diretos (CEP da própria pessoa)
  const [numGestoresDiretos, setNumGestoresDiretos] = useState<number | "">("");
  const [gestoresDiretosData, setGestoresDiretosData] = useState<ImpactadaData[]>([]);
  const [numColaboradoresDiretos, setNumColaboradoresDiretos] = useState<number | "">("");
  const [colaboradoresDiretosData, setColaboradoresDiretosData] = useState<ImpactadaData[]>([]);
  // Pessoas impactadas financeiramente
  const [numeroImpactadasGestores, setNumeroImpactadasGestores] = useState<number | "">("");
  const [gestoresData, setGestoresData] = useState<ImpactadaData[]>([]);
  const [numeroImpactadasSocios, setNumeroImpactadasSocios] = useState<number | "">("");
  const [sociosImpactadosData, setSociosImpactadosData] = useState<ImpactadaData[]>([]);
  const [numeroImpactadasColaboradores, setNumeroImpactadasColaboradores] = useState<number | "">("");
  const [colaboradoresData, setColaboradoresData] = useState<ImpactadaData[]>([]);
  
  const [eSocio, setESocio] = useState("");
  const [temNegrosSocios, setTemNegrosSocios] = useState("");
  const [autorizaCompartilhamento, setAutorizaCompartilhamento] = useState("Não");

  const [diversidadeGlobal, setDiversidadeGlobal] = useState({
    "Total de Pessoas": { socios: "", gestores: "", colaboradores: "" },
    "Pessoas Negras (pretas e pardas)": { socios: "", gestores: "", colaboradores: "" },
    "Mulheres": { socios: "", gestores: "", colaboradores: "" },
    "Pessoas com Deficiência (PCD)": { socios: "", gestores: "", colaboradores: "" },
    "Pessoas 60+": { socios: "", gestores: "", colaboradores: "" },
    "Dependentes financeiros (não entram no Score RIS)": { socios: "", gestores: "", colaboradores: "" }
  });

  const handleNumeroSociosChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroSocios(num);
    if (typeof num === "number" && num > 0) {
      setSociosData(prev => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) {
            newData.push({
              foto: null, fonteImagem: "", nome: "", participacaoValor: "", participacaoPercentual: "",
              cpf: "", cep: "", email: "", dataNascimento: "", nacionalidade: "", etariedade: "", raca: "", sexo: "", sexoOutro: "", genero: "", orientacao: "", deficiencia: [], deficienciaAuditivaGrau: "", deficienciaFisicaGrau: "", deficienciaIntelectualGrau: "", deficienciaPsicossocialGrau: "", deficienciaVisualGrau: ""
            });
          }
        } else if (newData.length > num) {
          newData.length = num;
        }
        return newData;
      });
    } else {
      setSociosData([]);
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

  const handleNumeroGestoresChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroImpactadasGestores(num);
    if (typeof num === "number" && num > 0) {
      setGestoresData(Array(num).fill({ pais: "BR", codigoPostal: "", cepValido: false, cepEndereco: "" }));
    } else {
      setGestoresData([]);
    }
  };

  const handleNumeroGestoresDiretosChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumGestoresDiretos(num);
    if (typeof num === "number" && num > 0) {
      setGestoresDiretosData(prev => {
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
      setColaboradoresDiretosData(prev => {
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
      setSociosImpactadosData(Array(num).fill({ pais: "BR", codigoPostal: "", cepValido: false, cepEndereco: "" }));
    } else {
      setSociosImpactadosData([]);
    }
  };

  const handleNumeroColaboradoresChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroImpactadasColaboradores(num);
    if (typeof num === "number" && num > 0) {
      setColaboradoresData(prev => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) {
            newData.push({ pais: "BR", codigoPostal: "", cepEndereco: "", cepValido: false });
          }
        } else if (newData.length > num) {
          newData.length = num;
        }
        return newData;
      });
    } else {
      setColaboradoresData([]);
    }
  };

  const formatCep = (value: string) => {
    return value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
  };

  /**
   * Ao anexar a Ficha da Junta Comercial, tenta extrair automaticamente
   * os dados do Quadro Societário via pdfjs-dist.
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
              // Preenche apenas valor e percentual, preserva o restante
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

  /**
   * Busca dados de endereço por código postal.
   * Usa ViaCEP para o Brasil e Zippopotam.us para os demais países (sem chave de API).
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

  /**
   * Handler genérico para alteração do código postal em qualquer lista de impactadas.
   */
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
    }
  };

  /**
   * Handler genérico para alteração do país em qualquer lista de impactadas.
   */
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

  const validatePassword = (pass: string) => {
    const minLength = pass.length >= 8;
    const hasNumber = /[0-9]/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    return minLength && hasNumber && hasUpper && hasSpecial;
  };

  const formatCnpj = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const formatCpf = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  };

  const formatDateInput = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .slice(0, 10);
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length > 10) {
      return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (v.length > 6) {
      return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (v.length > 2) {
      return v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else {
      return v;
    }
  };

  const buscarDadosCnpj = async (cnpjNumeros: string, cnpjFormatado: string) => {
    if (cnpjNumeros.length !== 14) return;
    setBuscandoCnpj(true);
    setCnpjErro("");
    try {
      // 1. Verifica se já existe cadastro no banco de dados com este CNPJ
      const { data: empresaExistente } = await supabase
        .from('empresas')
        .select('id')
        .eq('cnpj', cnpjFormatado)
        .maybeSingle();

      if (empresaExistente) {
        throw new Error("CNPJ_JA_CADASTRADO");
      }

      // 2. Busca os dados na Receita (BrasilAPI)
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNumeros}`);
      if (!response.ok) throw new Error("CNPJ não encontrado");
      const data = await response.json();
      
      setCnpjValido(true);
      if (data.razao_social) setRazaoSocial(data.razao_social);
      if (data.nome_fantasia) setNomeFantasia(data.nome_fantasia);
      
      if (data.qsa && Array.isArray(data.qsa)) {
        const sociosQsa = data.qsa;
        if (sociosQsa.length > 0) {
          setNumeroSocios(sociosQsa.length);
          const novosSocios = sociosQsa.map((s: any) => ({
            foto: null, fonteImagem: "", nome: s.nome_socio || "", participacaoValor: "", participacaoPercentual: "",
            cpf: "", cep: "", email: "", dataNascimento: "", nacionalidade: "", etariedade: "", raca: "", sexo: "", sexoOutro: "", genero: "", orientacao: "", deficiencia: [], deficienciaAuditivaGrau: "", deficienciaFisicaGrau: "", deficienciaIntelectualGrau: "", deficienciaPsicossocialGrau: "", deficienciaVisualGrau: ""
          }));
          setSociosData(novosSocios);
        }
      }
    } catch (error: any) {
      console.error(error);
      setCnpjValido(false);
      if (error.message === "CNPJ_JA_CADASTRADO") {
        setCnpjErro("Este CNPJ já está cadastrado no sistema. Por favor, faça login.");
      } else {
        setCnpjErro("CNPJ inválido ou não encontrado. Validar este campo é obrigatório.");
      }
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleCnpjChange = (val: string) => {
    const formatted = formatCnpj(val);
    setCnpj(formatted);
    setCnpjValido(false);
    const numeros = formatted.replace(/\D/g, '');
    if (numeros.length === 14) {
      buscarDadosCnpj(numeros, formatted);
    }
  };

  const handlePagamentoToggle = (forma: string) => {
    setFormasPagamento(prev => prev.includes(forma) ? prev.filter(f => f !== forma) : [...prev, forma]);
  };

  const handleRecebimentoToggle = (forma: string) => {
    setFormasRecebimento(prev => prev.includes(forma) ? prev.filter(f => f !== forma) : [...prev, forma]);
  };

  const handleDiversidadeQtdChange = (categoria: string, grupo: 'socios' | 'gestores' | 'colaboradores', valor: string) => {
    if (valor !== "" && !/^\d+$/.test(valor)) return;

    setDiversidadeGlobal(prev => ({
      ...prev,
      [categoria]: {
        ...prev[categoria as keyof typeof prev],
        [grupo]: valor
      }
    }));
  };

  /**
   * Calcula a lista de campos obrigatórios que ainda não foram preenchidos.
   * Retorna um array de { id, label, secao } pronto para o CamposFaltandoPanel.
   */
  const calcularCamposFaltando = (): CampoFaltando[] => {
    const faltando: CampoFaltando[] = [];

    // ── Seção 1: Acesso e Responsável ───────────────────────────────
    if (!fotoResponsavelFile)
      faltando.push({ id: "fotoResponsavel", label: "Foto do Responsável", secao: "1. Acesso e Responsável" });
    if (!nomeResponsavel)
      faltando.push({ id: "nomeResp", label: "Nome do Responsável", secao: "1. Acesso e Responsável" });
    if (!telefonePrincipal)
      faltando.push({ id: "telPrin", label: "Telefone Principal", secao: "1. Acesso e Responsável" });
    if (!email)
      faltando.push({ id: "email", label: "E-mail", secao: "1. Acesso e Responsável" });
    if (!senha)
      faltando.push({ id: "senha", label: "Senha", secao: "1. Acesso e Responsável" });
    if (!confirmarSenha)
      faltando.push({ id: "confSenha", label: "Confirmar Senha", secao: "1. Acesso e Responsável" });

    // ── Seção 2: Dados da Empresa ────────────────────────────────────
    if (!cnpjValido)
      faltando.push({ id: "cnpj", label: "CNPJ (válido)", secao: "2. Dados da Empresa" });
    if (!cartaoCnpjFile)
      faltando.push({ id: "cartaoCnpj", label: "Cartão CNPJ (PDF)", secao: "2. Dados da Empresa" });
    if (!fichaJuntaFile)
      faltando.push({ id: "fichaJunta", label: "Ficha da Junta Comercial", secao: "2. Dados da Empresa" });
    if (!razaoSocial)
      faltando.push({ id: "razaoSocial", label: "Razão Social", secao: "2. Dados da Empresa" });
    if (!nomeFantasia)
      faltando.push({ id: "nomeFantasia", label: "Nome Fantasia", secao: "2. Dados da Empresa" });
    if (acessoTipo.length === 0)
      faltando.push({ id: "acessoTipo", label: "Tipo de Acesso", secao: "2. Dados da Empresa" });
    if (!areaEmpresa)
      faltando.push({ id: "areaEmpresa", label: "Área da Empresa", secao: "2. Dados da Empresa" });
    if (!areaGeografica)
      faltando.push({ id: "areaGeografica", label: "Área Geográfica", secao: "2. Dados da Empresa" });
    if (!sobreEmpresa)
      faltando.push({ id: "sobre", label: "Sobre a Empresa", secao: "2. Dados da Empresa" });

    if (mostrarCompleto) {
      // ── Seção 3: Financeiro ──────────────────────────────────────────
      if (formasPagamento.length === 0)
        faltando.push({ id: "formasPagamento", label: "Formas de Pagamento", secao: "3. Financeiro" });
      if (formasRecebimento.length === 0)
        faltando.push({ id: "formasRecebimento", label: "Formas de Recebimento", secao: "3. Financeiro" });
      if (!emiteNotaFiscal)
        faltando.push({ id: "emiteNotaFiscal", label: "Emite Nota Fiscal?", secao: "3. Financeiro" });
      if (!temContaPJ)
        faltando.push({ id: "temContaPJ", label: "Tem Conta Bancária PJ?", secao: "3. Financeiro" });

      // ── Seção 4: Sócios e Impacto ────────────────────────────────────
      if (!eSocio)
        faltando.push({ id: "eSocio", label: "Você é sócio?", secao: "4. Sócios e Impacto" });
      if (!temNegrosSocios)
        faltando.push({ id: "temNegrosSocios", label: "Negros entre os sócios?", secao: "4. Sócios e Impacto" });
      if (!numeroSocios)
        faltando.push({ id: "numeroSocios", label: "Número de Sócios", secao: "4. Sócios e Impacto" });

      // Campos dinâmicos de cada sócio
      sociosData.forEach((socio, idx) => {
        const secaoSocio = `4. Sócio ${idx + 1}`;
        const idBase = `socio-card-${idx}`;
        if (!socio.nome)
          faltando.push({ id: idBase, label: `Sócio ${idx + 1}: Nome`, secao: secaoSocio });
        if (!socio.cpf)
          faltando.push({ id: idBase, label: `Sócio ${idx + 1}: CPF`, secao: secaoSocio });
        if (!socio.dataNascimento)
          faltando.push({ id: idBase, label: `Sócio ${idx + 1}: Data de Nascimento`, secao: secaoSocio });
        if (!socio.raca)
          faltando.push({ id: idBase, label: `Sócio ${idx + 1}: Raça/Cor`, secao: secaoSocio });
        if (!socio.sexo)
          faltando.push({ id: idBase, label: `Sócio ${idx + 1}: Sexo`, secao: secaoSocio });
        if (!socio.genero)
          faltando.push({ id: idBase, label: `Sócio ${idx + 1}: Gênero`, secao: secaoSocio });
        if (!socio.deficiencia || socio.deficiencia.length === 0)
          faltando.push({ id: idBase, label: `Sócio ${idx + 1}: Possui deficiência?`, secao: secaoSocio });
      });

      if (autorizaCompartilhamento !== "Sim")
        faltando.push({ id: "opt-in", label: "Consentimento de Dados (Opt-in)", secao: "4. Sócios e Impacto" });
    }

    return faltando;
  };

  // Atualiza a lista de campos faltando sempre que qualquer estado relevante mudar
  const camposFaltando = useMemo(
    () => calcularCamposFaltando(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      fotoResponsavelFile, nomeResponsavel, telefonePrincipal, email, senha, confirmarSenha,
      cnpjValido, cartaoCnpjFile, fichaJuntaFile, razaoSocial, nomeFantasia,
      acessoTipo, areaEmpresa, areaGeografica, sobreEmpresa,
      formasPagamento, formasRecebimento, emiteNotaFiscal, temContaPJ,
      eSocio, temNegrosSocios, numeroSocios, sociosData, autorizaCompartilhamento,
    ]
  );

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaErro("");
    // Marca que o usuário tentou enviar — ativa o painel de campos faltando
    setTentouEnviar(true);

    if (mostrarCompleto) {
      const todosCepsSociosValidos = sociosData.every(s => !s.cep || s.cepValido);
      const todosCepsGestoresValidos = gestoresData.every(g => !g.codigoPostal || g.cepValido);
      const todosCepsSociosImpactadosValidos = sociosImpactadosData.every(s => !s.codigoPostal || s.cepValido);
      const todosCepsColaboradoresValidos = colaboradoresData.every(c => !c.codigoPostal || c.cepValido);

      if (!todosCepsSociosValidos || !todosCepsGestoresValidos || !todosCepsSociosImpactadosValidos || !todosCepsColaboradoresValidos) {
        setSenhaErro("Por favor, preencha corretamente todos os CEPs informados antes de continuar.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    if (!cnpjValido) {
      setSenhaErro("Por favor, digite um CNPJ válido e aguarde a validação do sistema.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!validatePassword(senha)) {
      setSenhaErro("A senha deve ter no mínimo 8 caracteres, contendo 1 número, 1 letra maiúscula e 1 caractere especial.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (senha !== confirmarSenha) {
      setSenhaErro("As senhas não conferem.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (mostrarCompleto && autorizaCompartilhamento !== "Sim") {
      setSenhaErro("É obrigatório dar o consentimento para o tratamento dos dados sensíveis (Opt-in) para prosseguir com o cadastro.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setBuscandoCnpj(true); // Reusing this state to show a general loading spinner later if needed

    try {
      // 1. Criar o usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: senha
      });

      if (authError) {
        // Traduz erros conhecidos do Supabase Auth para português
        let mensagemErro = authError.message;
        if (mensagemErro.includes("you can only request this after")) {
          const segundos = mensagemErro.match(/(\d+) seconds?/);
          const tempo = segundos ? segundos[1] : "alguns";
          mensagemErro = `Por segurança, aguarde ${tempo} segundos antes de tentar novamente.`;
        } else if (mensagemErro.includes("User already registered")) {
          mensagemErro = "Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.";
        } else if (mensagemErro.includes("Invalid email")) {
          mensagemErro = "E-mail inválido. Por favor, verifique o endereço informado.";
        } else if (mensagemErro.includes("Password should be")) {
          mensagemErro = "A senha não atende aos requisitos mínimos de segurança.";
        }
        throw new Error(mensagemErro);
      }
      const authUserId = authData.user?.id;
      if (!authUserId) throw new Error("Não foi possível gerar a credencial de login. Tente novamente.");

      const empresaId = crypto.randomUUID();

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

      // Realizar uploads (se os arquivos existirem)
      let fotoResponsavelUrl = null;
      if (fotoResponsavelFile) fotoResponsavelUrl = await uploadFile(fotoResponsavelFile, `empresas/${empresaId}/responsavel`);

      let logoEmpresaUrl = null;
      if (logoEmpresaFile) logoEmpresaUrl = await uploadFile(logoEmpresaFile, `empresas/${empresaId}/logo`);

      let cartaoCnpjUrl = null;
      if (cartaoCnpjFile) cartaoCnpjUrl = await uploadFile(cartaoCnpjFile, `empresas/${empresaId}/documentos`);

      let fichaJuntaUrl = null;
      if (fichaJuntaFile) fichaJuntaUrl = await uploadFile(fichaJuntaFile, `empresas/${empresaId}/documentos`);

      const { error: empresaError } = await supabase.from('empresas').insert({
        id: empresaId,
        foto_responsavel_url: fotoResponsavelUrl,
        logo_empresa_url: logoEmpresaUrl,
        cartao_cnpj_url: cartaoCnpjUrl,
        ficha_junta_url: fichaJuntaUrl,
        nome_responsavel: nomeResponsavel,
        telefone_principal: telefonePrincipal,
        telefone_opcional: telefoneOpcional,
        email: email,
        senha_hash: senhaHasheada,
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        cnpj: cnpj,
        acesso_tipo: acessoTipo.join(', '),
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
        diversidade_global: diversidadeGlobal
      });

      if (empresaError) throw empresaError;

      // 3. Inserir o vínculo na empresa_usuarios
      const { error: vinculoError } = await supabase.from('empresa_usuarios').insert({
        auth_user_id: authUserId,
        empresa_id: empresaId,
        email: email,
        nome: nomeResponsavel,
        papel: 'admin',
        status: 'ativo'
      });
      
      if (vinculoError) throw vinculoError;

      if (sociosData.length > 0) {
        // Upload das fotos dos sócios
        const sociosToInsert = await Promise.all(sociosData.map(async (s) => {
          let fotoSocioUrl = null;
          if (s.foto) {
            fotoSocioUrl = await uploadFile(s.foto, `empresas/${empresaId}/socios`);
          }

          return {
            empresa_id: empresaId,
            foto_url: fotoSocioUrl,
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
            deficiencia: Array.isArray(s.deficiencia) ? s.deficiencia.join(', ') : s.deficiencia,
            deficiencia_auditiva_grau: s.deficienciaAuditivaGrau,
            deficiencia_fisica_grau: s.deficienciaFisicaGrau,
            deficiencia_intelectual_grau: s.deficienciaIntelectualGrau,
            deficiencia_psicossocial_grau: s.deficienciaPsicossocialGrau,
            deficiencia_visual_grau: s.deficienciaVisualGrau,
            fonte_imagem: s.fonteImagem
          };
        }));
        
        const { error: sociosError } = await supabase.from('socios').insert(sociosToInsert);
        if (sociosError) throw sociosError;
      }

      const cepsToInsert: any[] = [];
      // CEPs diretos de gestores e colaboradores
      gestoresDiretosData.forEach(g => {
        if(g.codigoPostal) cepsToInsert.push({ empresa_id: empresaId, tipo: 'GESTOR_DIRETO', cep: g.codigoPostal, endereco_validado: g.cepEndereco });
      });
      colaboradoresDiretosData.forEach(c => {
        if(c.codigoPostal) cepsToInsert.push({ empresa_id: empresaId, tipo: 'COLABORADOR_DIRETO', cep: c.codigoPostal, endereco_validado: c.cepEndereco });
      });
      // CEPs de pessoas impactadas financeiramente
      gestoresData.forEach(g => {
        if(g.codigoPostal) cepsToInsert.push({ empresa_id: empresaId, tipo: 'GESTOR', cep: g.codigoPostal, endereco_validado: g.cepEndereco });
      });
      sociosImpactadosData.forEach(s => {
        if(s.codigoPostal) cepsToInsert.push({ empresa_id: empresaId, tipo: 'SOCIO', cep: s.codigoPostal, endereco_validado: s.cepEndereco });
      });
      colaboradoresData.forEach(c => {
        if(c.codigoPostal) cepsToInsert.push({ empresa_id: empresaId, tipo: 'COLABORADOR', cep: c.codigoPostal, endereco_validado: c.cepEndereco });
      });
      
      if (cepsToInsert.length > 0) {
        const { error: cepsError } = await supabase.from('ceps_impactados').insert(cepsToInsert);
        if (cepsError) throw cepsError;
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Erro Supabase:", err);
      // Exibe a mensagem já traduzida (ou a original como fallback)
      setSenhaErro(err.message || "Ocorreu um erro inesperado ao salvar o formulário. Tente novamente.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBuscandoCnpj(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 border-t-4 border-[#7030A0]">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
          <h2 className="text-3xl font-bold text-gray-900">Cadastro Realizado!</h2>
          <p className="text-gray-600">
            Recebemos todos os dados da sua empresa e dos sócios com sucesso. Em breve, nossa equipe entrará em contato.
          </p>
          <Button asChild className="w-full" style={{ backgroundColor: '#7030A0' }}>
            <Link href="/">Voltar para a página inicial</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={logoImage} alt="Logo Diversidade.io" className="h-10 w-auto object-contain" />
            <span className="font-bold text-xl hidden sm:block" style={{ color: '#7030A0' }}>Diversidade.io</span>
          </Link>
          <Button variant="ghost" asChild className="text-gray-600 hover:text-purple-700">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-[#0F3A7D] to-[#7030A0] p-8 md:p-12 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{color: '#FFFFFF'}}>Cadastro Gratuito</h1>
            <p className="text-lg opacity-90">
              Preencha os dados abaixo de forma completa para criar o perfil da sua empresa na nossa rede.
            </p>
          </div>

          {senhaErro && (
            <div className="m-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm">
              <p className="font-semibold">Erro no preenchimento:</p>
              <p>{senhaErro}</p>
            </div>
          )}

          <form onSubmit={handleFormSubmit} noValidate className="p-8 md:p-12 space-y-12">
            
            {/* 1. Informações de Acesso e Responsável */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <User className="w-6 h-6 text-[#7030A0]" />
                <h2 className="text-2xl font-semibold text-gray-900">1. Informações de Acesso e Responsável</h2>
              </div>

              <div id="fotoResponsavel" className="space-y-4">
                <Label className="text-gray-700 font-medium">Foto do Responsável (Rosto e Colorida)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group bg-white">
                  <input type="file" id="fotoResp" className="hidden" accept="image/*" onChange={(e) => { if(e.target.files && e.target.files[0]) setFotoResponsavelFile(e.target.files[0]) }} />
                  <label htmlFor="fotoResp" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    {fotoResponsavelFile ? (
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#7030A0] shadow-md">
                        <img src={URL.createObjectURL(fotoResponsavelFile)} alt="Preview Foto" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-[#7030A0]" />
                      </div>
                    )}
                    <p className="text-gray-700 font-medium text-sm mt-2">{fotoResponsavelFile ? "Foto do Sócio" : "Clique para enviar a foto"}</p>
                  </label>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nomeResp" className="text-gray-700 font-medium">Nome Completo do Responsável</Label>
                  <Input id="nomeResp" required value={nomeResponsavel} onChange={e=>setNomeResponsavel(e.target.value)} placeholder="Digite seu nome completo" className="h-12 bg-gray-50 focus:bg-white" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="telPrin" className="text-gray-700 font-medium">Telefone Principal / WhatsApp</Label>
                  <Input id="telPrin" required value={telefonePrincipal} onChange={e=>setTelefonePrincipal(formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telOpcional" className="text-gray-700 font-medium">Telefone Opcional</Label>
                  <Input id="telOpcional" value={telefoneOpcional} onChange={e=>setTelefoneOpcional(formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium">Seu e-mail</Label>
                  <Input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha" className="text-gray-700 font-medium">Senha</Label>
                  <Input id="senha" type="password" required value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" className="h-12 bg-gray-50 focus:bg-white" />
                  <p className="text-xs text-gray-500">Mínimo 8 caracteres, 1 número, 1 maiúscula, 1 caractere especial.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confSenha" className="text-gray-700 font-medium">Confirmar Senha</Label>
                  <Input id="confSenha" type="password" required value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)} placeholder="Confirme a senha" className="h-12 bg-gray-50 focus:bg-white" />
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
                  <div className="relative">
                    <Input id="cnpj" required value={cnpj} onChange={e=>handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} className={`h-12 bg-gray-50 focus:bg-white ${buscandoCnpj ? 'opacity-70' : ''}`} disabled={buscandoCnpj} />
                    {buscandoCnpj && <span className="absolute right-3 top-3 text-xs text-purple-600 font-medium">Buscando...</span>}
                  </div>
                  {cnpjErro && <p className="text-xs text-red-500 font-semibold">{cnpjErro}</p>}
                  {cnpjValido && <p className="text-xs text-green-600 font-semibold">CNPJ validado com sucesso!</p>}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-gray-700 font-medium">Upload da Logo da Empresa (Opcional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group bg-white">
                  <input type="file" id="logoEmp" className="hidden" accept="image/*" onChange={(e) => { if(e.target.files && e.target.files[0]) setLogoEmpresaFile(e.target.files[0]) }} />
                  <label htmlFor="logoEmp" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    {logoEmpresaFile ? (
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-blue-600 shadow-md bg-white flex items-center justify-center p-1">
                        <img src={URL.createObjectURL(logoEmpresaFile)} alt="Preview Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-blue-600" />
                      </div>
                    )}
                    <p className="text-gray-700 font-medium text-sm mt-2">{logoEmpresaFile ? "Alterar logo da empresa" : "Clique para enviar a logo"}</p>
                  </label>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="razaoSocial" className="text-gray-700 font-medium">Razão Social</Label>
                  <Input id="razaoSocial" required value={razaoSocial} onChange={e=>setRazaoSocial(e.target.value)} placeholder="Razão social da empresa" className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nomeFantasia" className="text-gray-700 font-medium">Nome Fantasia</Label>
                  <Input id="nomeFantasia" required value={nomeFantasia} onChange={e=>setNomeFantasia(e.target.value)} placeholder="Nome fantasia" className="h-12 bg-gray-50 focus:bg-white" />
                </div>

                <div id="acessoTipo" className="space-y-2">
                  <Label className="text-gray-700 font-medium">O seu acesso é como: (Pode selecionar mais de um)</Label>
                  <div className="flex flex-col gap-3 mt-2">
                    {[
                      "EMPRESA OU INICIATIVA INCENTIVADORA",
                      "FORNECEDOR INCLUSIVO",
                      "EMPREENDIMENTO DIVERSO"
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
                          {opcao}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="areaEmpresa" className="space-y-2">
                  <Label className="text-gray-700 font-medium">Área da Empresa</Label>
                  <Select onValueChange={setAreaEmpresa} required>
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

                <div id="areaGeografica" className="space-y-2">
                  <Label className="text-gray-700 font-medium">Área Geográfica de Busca</Label>
                  <Select onValueChange={setAreaGeografica} required>
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
                  <div className={`border-2 border-dashed ${cartaoCnpjFile ? 'border-[#7030A0] bg-purple-50' : 'border-gray-300 bg-white'} rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group`}>
                    <input type="file" id="cartaoCnpj" className="hidden" accept=".pdf" onChange={(e) => { if(e.target.files && e.target.files[0]) setCartaoCnpjFile(e.target.files[0]) }} required />
                    <label htmlFor="cartaoCnpj" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                      <div className={`w-10 h-10 rounded-full ${cartaoCnpjFile ? 'bg-[#7030A0]' : 'bg-purple-100'} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <FileText className={`w-5 h-5 ${cartaoCnpjFile ? 'text-white' : 'text-[#7030A0]'}`} />
                      </div>
                      <p className="text-gray-700 font-medium text-sm">
                        {cartaoCnpjFile ? <span className="text-[#7030A0]">{cartaoCnpjFile.name}</span> : "Clique para enviar Cartão CNPJ"}
                      </p>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Ficha Simples da Junta Comercial (PDF)</Label>
                  <div className={`border-2 border-dashed ${fichaJuntaFile ? 'border-[#7030A0] bg-purple-50' : 'border-gray-300 bg-white'} rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group`}>
                    <input type="file" id="fichaJunta" className="hidden" accept=".pdf" onChange={(e) => { if(e.target.files && e.target.files[0]) handleFichaJuntaChange(e.target.files[0]) }} required />
                    <label htmlFor="fichaJunta" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                      <div className={`w-10 h-10 rounded-full ${fichaJuntaFile ? 'bg-[#7030A0]' : 'bg-purple-100'} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <FileText className={`w-5 h-5 ${fichaJuntaFile ? 'text-white' : 'text-[#7030A0]'}`} />
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
                        <span className="text-gray-700 font-medium text-sm">
                          {fichaJuntaFile ? fichaJuntaFile.name : "Clique para enviar Ficha Simples"}
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="sobre" className="text-gray-700 font-medium">Sobre a Empresa</Label>
                <p className="text-xs text-gray-500 mb-2">Descreva em um parágrafo o que a sua empresa faz, o diferencial dela e onde atua. Essa informação aparecerá para potenciais contratantes.</p>
                <Textarea id="sobre" required value={sobreEmpresa} onChange={e=>setSobreEmpresa(e.target.value)} placeholder="Escreva sobre sua empresa aqui..." className="min-h-[120px] bg-gray-50 focus:bg-white resize-y" />
              </div>
            </section>

            {mostrarCompleto && (
              <>
                {/* 3. Informações Financeiras */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b pb-2">
                    <Wallet className="w-6 h-6 text-[#7030A0]" />
                    <h2 className="text-2xl font-semibold text-gray-900">3. Financeiro e Operacional</h2>
                  </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div id="formasPagamento" className="space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <Label className="text-gray-800 font-semibold text-base">Formas de Pagamento utilizadas</Label>
                  <div className="space-y-2 mt-2">
                    {["Boleto", "Depósito", "PIX", "Transferência"].map(forma => (
                      <div key={`pag-${forma}`} className="flex items-center gap-2">
                        <Checkbox id={`pag-${forma}`} checked={formasPagamento.includes(forma)} onCheckedChange={() => handlePagamentoToggle(forma)} />
                        <label htmlFor={`pag-${forma}`} className="text-sm font-medium text-gray-700 cursor-pointer">{forma}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="formasRecebimento" className="space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <Label className="text-gray-800 font-semibold text-base">Formas de Recebimento utilizadas</Label>
                  <div className="space-y-2 mt-2">
                    {["Boleto", "Depósito", "PIX", "Transferência"].map(forma => (
                      <div key={`rec-${forma}`} className="flex items-center gap-2">
                        <Checkbox id={`rec-${forma}`} checked={formasRecebimento.includes(forma)} onCheckedChange={() => handleRecebimentoToggle(forma)} />
                        <label htmlFor={`rec-${forma}`} className="text-sm font-medium text-gray-700 cursor-pointer">{forma}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="emiteNotaFiscal" className="space-y-3">
                  <Label className="text-gray-800 font-semibold text-base">Sua empresa emite nota fiscal?</Label>
                  <RadioGroup onValueChange={setEmiteNotaFiscal} required className="flex gap-6 mt-2">
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

                <div id="temContaPJ" className="space-y-3">
                  <Label className="text-gray-800 font-semibold text-base">Sua empresa tem conta bancária como PJ?</Label>
                  <RadioGroup onValueChange={setTemContaPJ} required className="flex gap-6 mt-2">
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

            {/* 4. Sócios, Impacto e Autorizações */}
            <section className="space-y-8">
              <div className="flex items-center gap-3 border-b pb-2">
                <Users className="w-6 h-6 text-[#7030A0]" />
                <h2 className="text-2xl font-semibold text-gray-900">4. Perfil, Sócios e Impacto</h2>
              </div>

              {/* Aviso LGPD para terceiros */}
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded text-amber-900 mb-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div className="space-y-2">
                    <p className="font-semibold">Aviso Importante sobre Dados de Terceiros (LGPD)</p>
                    <p className="text-sm leading-relaxed">
                      Você está prestes a preencher informações pessoais e dados sensíveis (como raça/etnia e orientação sexual) dos sócios da empresa. Ao prosseguir, <strong>você declara ter coletado o consentimento prévio e expresso de cada titular</strong> para que a Diversidade.io realize o tratamento destes dados, conforme nossa Política de Privacidade.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 bg-purple-50/50 p-6 rounded-xl border border-purple-100">
                <div id="eSocio" className="space-y-3">
                  <Label className="text-gray-800 font-semibold">Você é sócio da empresa?</Label>
                  <RadioGroup onValueChange={setESocio} required className="flex gap-6 mt-2">
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
                <div id="temNegrosSocios" className="space-y-3">
                  <Label className="text-gray-800 font-semibold">Existem pessoas negras entre os sócios?</Label>
                  <RadioGroup onValueChange={setTemNegrosSocios} required className="flex gap-6 mt-2">
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

              {/* Detalhamento de Sócios (Modal) */}
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
                          {/* id="socio-card-{idx}" permite o scroll do painel de campos faltando */}
                          <Button id={`socio-card-${idx}`} variant="outline" className="h-16 flex flex-col items-center justify-center border-2 border-dashed hover:border-[#7030A0] hover:bg-purple-50 transition-colors">
                            <span className="font-semibold text-[#0F3A7D]">Sócio {idx + 1}</span>
                            <span className="text-xs text-gray-500">{socio.nome ? 'Preenchido' : 'Preencher informações'}</span>
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
                                <input type="file" id={`foto-socio-${idx}`} className="hidden" accept="image/*" onChange={(e) => { if(e.target.files && e.target.files[0]) updateSocio(idx, 'foto', e.target.files[0]) }} />
                                <label htmlFor={`foto-socio-${idx}`} className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                                  {socio.foto ? (
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#7030A0] shadow-md">
                                      <img src={URL.createObjectURL(socio.foto as File)} alt={`Preview Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                      <Upload className="w-8 h-8 text-[#7030A0]" />
                                    </div>
                                  )}
                                  <p className="text-gray-700 font-medium text-sm mt-2">{socio.foto ? "Foto do Sócio" : "Clique para enviar a foto"}</p>
                                </label>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-gray-700 font-medium">Fonte da Imagem</Label>
                              <RadioGroup value={socio.fonteImagem} onValueChange={(v) => updateSocio(idx, 'fonteImagem', v)} className="flex flex-wrap gap-4 mt-1">
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
                                <Input value={socio.nome} onChange={(e) => updateSocio(idx, 'nome', e.target.value)} placeholder="Nome completo" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">CPF</Label>
                                <Input value={socio.cpf} onChange={(e) => updateSocio(idx, 'cpf', formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">Valor da Participação</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                                  <Input className="pl-9" value={socio.participacaoValor} onChange={(e) => updateSocio(idx, 'participacaoValor', e.target.value)} placeholder="0,00" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">Percentual da Empresa</Label>
                                <div className="relative">
                                  <Input className="pr-8" value={socio.participacaoPercentual} onChange={(e) => updateSocio(idx, 'participacaoPercentual', e.target.value)} placeholder="0" />
                                  <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">E-mail</Label>
                                <Input type="email" value={socio.email} onChange={(e) => updateSocio(idx, 'email', e.target.value)} placeholder="email@socio.com" />
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
                                  <p className={`text-xs mt-1 ${socio.cepValido ? 'text-gray-500' : 'text-red-500 font-semibold'}`}>
                                    {socio.cepEndereco}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Nacionalidade</Label>
                                  <Input value={socio.nacionalidade} onChange={(e) => updateSocio(idx, 'nacionalidade', e.target.value)} placeholder="Ex: Brasileira" />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Idade</Label>
                                  <Input value={socio.etariedade} onChange={(e) => updateSocio(idx, 'etariedade', e.target.value)} placeholder="Sua idade" />
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
                                </div>                                <div className="space-y-4 md:col-span-2 mt-4">
                                  <Label className="text-gray-700 font-medium block border-b pb-2">Deficiência</Label>
                                  <p className="text-sm text-gray-500 mb-2">Sócio(s) possui alguma deficiência? (Pode selecionar mais de uma)</p>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    {["Sem deficiência", "Deficiência auditiva", "Deficiência física", "Deficiência intelectual", "Deficiência psicossocial", "Deficiência visual"].map(def => (
                                      <div key={def} className="flex items-center space-x-2">
                                        <Checkbox 
                                          id={`def-${idx}-${def.replace(/\s+/g, '-')}`} 
                                          checked={socio.deficiencia?.includes(def)} 
                                          onCheckedChange={(checked) => {
                                            const current = socio.deficiencia || [];
                                            let next;
                                            if (checked) {
                                              if (def === "Sem deficiência") next = ["Sem deficiência"];
                                              else next = [...current.filter(d => d !== "Sem deficiência"), def];
                                            } else {
                                              next = current.filter(d => d !== def);
                                            }
                                            updateSocio(idx, 'deficiencia', next);
                                          }} 
                                        />
                                        <label htmlFor={`def-${idx}-${def.replace(/\s+/g, '-')}`} className="text-sm cursor-pointer">{def}</label>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {socio.deficiencia?.includes("Deficiência auditiva") && (
                                    <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                                      <Label>Qual o grau da sua deficiência auditiva?</Label>
                                      <Select value={socio.deficienciaAuditivaGrau} onValueChange={(v) => updateSocio(idx, 'deficienciaAuditivaGrau', v)}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o grau" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Perda unilateral">Perda unilateral</SelectItem>
                                          <SelectItem value="Perda bilateral">Perda bilateral</SelectItem>
                                          <SelectItem value="Parcial">Parcial</SelectItem>
                                          <SelectItem value="Total de 41db (ou mais)">Total de 41db (ou mais)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {socio.deficiencia?.includes("Deficiência física") && (
                                    <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                                      <Label>Qual o grau da sua deficiência física?</Label>
                                      <Select value={socio.deficienciaFisicaGrau} onValueChange={(v) => updateSocio(idx, 'deficienciaFisicaGrau', v)}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o grau" /></SelectTrigger>
                                        <SelectContent>
                                          {["Paraparesia", "Monoplegia", "Monoparesia", "Tetraplegia", "Tetraparesia", "Triplegia", "Triparesia", "Hemiplegia", "Hemiparesia", "Paralisia cerebral", "Amputação ou ausência de membro", "Ostomia", "Nanismo", "Membros com deformidade congênita", "Membros com deformidade adquirida"].map(opt => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {socio.deficiencia?.includes("Deficiência intelectual") && (
                                    <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                                      <Label>Qual o grau da sua deficiência intelectual?</Label>
                                      <Select value={socio.deficienciaIntelectualGrau} onValueChange={(v) => updateSocio(idx, 'deficienciaIntelectualGrau', v)}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o grau" /></SelectTrigger>
                                        <SelectContent>
                                          {["Comunicação", "Cuidado pessoal", "Habilidades sociais", "Utilização de recursos da comunidade", "Deficiência múltipla"].map(opt => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {socio.deficiencia?.includes("Deficiência psicossocial") && (
                                    <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                                      <Label>Qual o grau da sua deficiência psicossocial?</Label>
                                      <Select value={socio.deficienciaPsicossocialGrau} onValueChange={(v) => updateSocio(idx, 'deficienciaPsicossocialGrau', v)}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o grau" /></SelectTrigger>
                                        <SelectContent>
                                          {["Mania", "Esquizofrenia", "Depressão", "Síndrome do pânico", "Transtorno obsessivo-compulsivo", "Paranoia", "Pessoa neurodiversa"].map(opt => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {socio.deficiencia?.includes("Deficiência visual") && (
                                    <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                                      <Label>Qual o grau da sua deficiência visual?</Label>
                                      <Select value={socio.deficienciaVisualGrau} onValueChange={(v) => updateSocio(idx, 'deficienciaVisualGrau', v)}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o grau" /></SelectTrigger>
                                        <SelectContent>
                                          {["Cegueira: visão menor do que 5%", "Baixa visão: visão entre 30% e 59%", "Campo visual: Menor do que 60%", "Cegueira monocular: visão de apenas um olho", "Redução da visão", "Daltonismo", "Visão acima de 50%"].map(opt => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end pt-6 border-t border-gray-100 mt-6">
                              <DialogClose asChild>
                                <Button 
                                  className="bg-[#7030A0] hover:bg-[#5a2680] text-white"
                                  onClick={() => setSalvoComSucesso(true)}
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
                            <Input id={`cp-gestor-direto-${idx}`} value={gestor.codigoPostal} onChange={(e) => handleCodigoPostalChange(setGestoresDiretosData, gestoresDiretosData, idx, e.target.value)} placeholder={gestor.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
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
                            <Input id={`cp-colab-direto-${idx}`} value={colaborador.codigoPostal} onChange={(e) => handleCodigoPostalChange(setColaboradoresDiretosData, colaboradoresDiretosData, idx, e.target.value)} placeholder={colaborador.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
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

              {/* Pessoas Impactadas (Gestores e Colab) */}
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
                    <Input 
                      id="impactadasSocios" 
                      type="number" 
                      min="0" 
                      value={numeroImpactadasSocios}
                      onChange={(e) => handleNumeroSociosImpactadosChange(e.target.value)}
                      placeholder="Ex: 5" 
                      className="h-12 bg-white md:w-1/3" 
                    />
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
                            <Input id={`cp-socios-impactados-${idx}`} value={socio.codigoPostal} onChange={(e) => handleCodigoPostalChange(setSociosImpactadosData, sociosImpactadosData, idx, e.target.value)} placeholder={socio.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
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
                    <Input 
                      id="impactadasGestores" 
                      type="number" 
                      min="0" 
                      value={numeroImpactadasGestores}
                      onChange={(e) => handleNumeroGestoresChange(e.target.value)}
                      placeholder="Ex: 5" 
                      className="h-12 bg-white md:w-1/3" 
                    />
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
                            <Input id={`cp-gestores-${idx}`} value={gestor.codigoPostal} onChange={(e) => handleCodigoPostalChange(setGestoresData, gestoresData, idx, e.target.value)} placeholder={gestor.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
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
                    <Input 
                      id="impactadasColab" 
                      type="number" 
                      min="0" 
                      value={numeroImpactadasColaboradores}
                      onChange={(e) => handleNumeroColaboradoresChange(e.target.value)}
                      placeholder="Ex: 5" 
                      className="h-12 bg-white md:w-1/3" 
                    />
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
                            <Input id={`cp-colab-${idx}`} value={colaborador.codigoPostal} onChange={(e) => handleCodigoPostalChange(setColaboradoresData, colaboradoresData, idx, e.target.value)} placeholder={colaborador.pais === "BR" ? "00000-000" : "Ex: 10001"} className="h-10 bg-gray-50" />
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

              {/* Recortes de Diversidade Tabela Geral */}
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
                          const totalSocios = diversidadeGlobal["Total de Pessoas"]?.socios || "";
                          const totalGestores = diversidadeGlobal["Total de Pessoas"]?.gestores || "";
                          const totalColab = diversidadeGlobal["Total de Pessoas"]?.colaboradores || "";

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
                </div>

                <div className="border-t border-purple-100 pt-6 space-y-3">
                  <h3 className="text-lg font-bold text-purple-900">3. Tenho dúvidas</h3>
                  <p className="text-sm text-gray-700">
                    Ficou com alguma dúvida sobre o uso dos seus dados?
                  </p>
                  <Button asChild variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 font-medium">
                    <a href="https://wa.me/5511989832953?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20uso%20dos%20meus%20dados." target="_blank" rel="noopener noreferrer">
                      Chamar no WhatsApp
                    </a>
                  </Button>
                </div>
              </div>

            </section>
            </>
            )}

            <div className="pt-8 flex flex-col sm:flex-row gap-6 items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Seus dados estão protegidos e o preenchimento completo ajuda na busca por novos negócios.
              </p>
              <Button
                type="submit"
                disabled={buscandoCnpj}
                className="w-full sm:w-auto h-14 px-12 text-lg font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0"
                style={{ backgroundColor: '#FF9500' }}
              >
                {buscandoCnpj
                  ? "Enviando..."
                  : mostrarCompleto
                  ? "Enviar Cadastro Completo"
                  : "Enviar Cadastro"}
              </Button>
            </div>
          </form>
        </div>
      </main>

      {/* Painel flutuante de campos não preenchidos — aparece após 1ª tentativa de envio */}
      {tentouEnviar && <CamposFaltandoPanel campos={camposFaltando} />}
      
      {/* Toast de sucesso fixo */}
      {salvoComSucesso && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-green-600 text-white px-5 py-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
          style={{ minWidth: '280px' }}
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Informações salvas com sucesso!</p>
            <p className="text-xs text-green-100">Seus dados foram atualizados.</p>
          </div>
        </div>
      )}
    </div>
  );
}
