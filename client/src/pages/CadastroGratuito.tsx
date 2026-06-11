import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Upload, CheckCircle2, User, Building2, Wallet, Users, FileText, Loader2, Sparkles, Info } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import logoImage from "@/assets/logo.png";
import { DrumDatePicker } from "@/components/ui/drum-date-picker";
import { supabase } from "@/lib/supabase";
import { extrairSociosDoJucesp } from "@/lib/extrairJucesp";

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
  deficiencia: string;
}

interface ImpactadaData {
  cep: string;
  cepEndereco: string;
  cepValido: boolean;
}

export default function CadastroGratuito() {
  const [submitted, setSubmitted] = useState(false);
  const [senhaErro, setSenhaErro] = useState("");

  // 1. Info Acesso e Responsável
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefonePrincipal, setTelefonePrincipal] = useState("");
  const [telefoneOpcional, setTelefoneOpcional] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  // 2. Dados Empresa
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cnpjValido, setCnpjValido] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [cnpjErro, setCnpjErro] = useState("");
  const [acessoTipo, setAcessoTipo] = useState<string[]>([]);
  const [acessoTipoOutro, setAcessoTipoOutro] = useState("");

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
  const [numeroImpactadasGestores, setNumeroImpactadasGestores] = useState<number | "">("");
  const [gestoresData, setGestoresData] = useState<ImpactadaData[]>([]);
  const [numeroImpactadasColaboradores, setNumeroImpactadasColaboradores] = useState<number | "">("");
  const [colaboradoresData, setColaboradoresData] = useState<ImpactadaData[]>([]);
  
  const [eSocio, setESocio] = useState("");
  const [temNegrosSocios, setTemNegrosSocios] = useState("");
  const [autorizaCompartilhamento, setAutorizaCompartilhamento] = useState("");

  const [diversidadeGlobal, setDiversidadeGlobal] = useState({
    "Pessoas Negras": { socios: false, gestores: false, colaboradores: false },
    "Mulheres": { socios: false, gestores: false, colaboradores: false },
    "60 anos +": { socios: false, gestores: false, colaboradores: false },
    "PCDs": { socios: false, gestores: false, colaboradores: false }
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
              cpf: "", cep: "", email: "", dataNascimento: "", nacionalidade: "", etariedade: "", raca: "", sexo: "", sexoOutro: "", genero: "", orientacao: "", deficiencia: ""
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
    setSociosData(newData);
  };

  const handleNumeroGestoresChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroImpactadasGestores(num);
    if (typeof num === "number" && num > 0) {
      setGestoresData(prev => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) {
            newData.push({ cep: "", cepEndereco: "", cepValido: false });
          }
        } else if (newData.length > num) {
          newData.length = num;
        }
        return newData;
      });
    } else {
      setGestoresData([]);
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
            newData.push({ cep: "", cepEndereco: "", cepValido: false });
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

  const fetchCepData = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return { valido: false, endereco: "" };
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return { valido: false, endereco: "CEP inválido ou não encontrado." };
      return { valido: true, endereco: `${data.logradouro}, ${data.bairro} - ${data.uf}` };
    } catch (err) {
      return { valido: false, endereco: "Erro ao buscar CEP." };
    }
  };

  const handleCepSocioChange = async (index: number, val: string) => {
    const formatted = formatCep(val);
    
    setSociosData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], cep: formatted, cepValido: false, cepEndereco: "" };
      return newData;
    });

    if (formatted.length === 9) {
      const data = await fetchCepData(formatted);
      setSociosData(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], cepValido: data.valido, cepEndereco: data.endereco };
        return updated;
      });
    }
  };

  const handleCepGestorChange = async (index: number, val: string) => {
    const formatted = formatCep(val);
    const newData = [...gestoresData];
    newData[index] = { ...newData[index], cep: formatted, cepValido: false, cepEndereco: "" };
    setGestoresData(newData);
    
    if (formatted.length === 9) {
      const data = await fetchCepData(formatted);
      setGestoresData(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], cepValido: data.valido, cepEndereco: data.endereco };
        return updated;
      });
    }
  };

  const handleCepColaboradorChange = async (index: number, val: string) => {
    const formatted = formatCep(val);
    const newData = [...colaboradoresData];
    newData[index] = { ...newData[index], cep: formatted, cepValido: false, cepEndereco: "" };
    setColaboradoresData(newData);
    
    if (formatted.length === 9) {
      const data = await fetchCepData(formatted);
      setColaboradoresData(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], cepValido: data.valido, cepEndereco: data.endereco };
        return updated;
      });
    }
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
            cpf: "", cep: "", email: "", dataNascimento: "", nacionalidade: "", etariedade: "", raca: "", sexo: "", sexoOutro: "", genero: "", orientacao: "", deficiencia: ""
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

  const handleDiversidadeToggle = (categoria: string, grupo: 'socios' | 'gestores' | 'colaboradores') => {
    setDiversidadeGlobal(prev => ({
      ...prev,
      [categoria]: {
        ...prev[categoria as keyof typeof prev],
        [grupo]: !prev[categoria as keyof typeof prev][grupo]
      }
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaErro("");

    const todosCepsSociosValidos = sociosData.every(s => !s.cep || s.cepValido);
    const todosCepsGestoresValidos = gestoresData.every(g => !g.cep || g.cepValido);
    const todosCepsColaboradoresValidos = colaboradoresData.every(c => !c.cep || c.cepValido);

    if (!todosCepsSociosValidos || !todosCepsGestoresValidos || !todosCepsColaboradoresValidos) {
      setSenhaErro("Existem CEPs inválidos preenchidos no formulário. Por favor, verifique os campos com alerta vermelho antes de enviar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
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

    setBuscandoCnpj(true); // Reusing this state to show a general loading spinner later if needed

    try {
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
        senha_hash: senha,
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
        diversidade_global: diversidadeGlobal
      });

      if (empresaError) throw empresaError;

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
            deficiencia: s.deficiencia,
            fonte_imagem: s.fonteImagem
          };
        }));
        
        const { error: sociosError } = await supabase.from('socios').insert(sociosToInsert);
        if (sociosError) throw sociosError;
      }

      const cepsToInsert: any[] = [];
      gestoresData.forEach(g => {
        if(g.cep) cepsToInsert.push({ empresa_id: empresaId, tipo: 'GESTOR', cep: g.cep, endereco_validado: g.cepEndereco });
      });
      colaboradoresData.forEach(c => {
        if(c.cep) cepsToInsert.push({ empresa_id: empresaId, tipo: 'COLABORADOR', cep: c.cep, endereco_validado: c.cepEndereco });
      });
      
      if (cepsToInsert.length > 0) {
        const { error: cepsError } = await supabase.from('ceps_impactados').insert(cepsToInsert);
        if (cepsError) throw cepsError;
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Erro Supabase:", err);
      setSenhaErro("Ocorreu um erro ao salvar o formulário: " + err.message);
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
                    <p className="text-gray-700 font-medium text-sm mt-2">{fotoResponsavelFile ? "Alterar foto do responsável" : "Clique para enviar a foto"}</p>
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
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-blue-600 shadow-md">
                        <img src={URL.createObjectURL(logoEmpresaFile)} alt="Preview Logo" className="w-full h-full object-cover" />
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

                <div className="space-y-2">
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

            {/* 3. Informações Financeiras */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-2">
                <Wallet className="w-6 h-6 text-[#7030A0]" />
                <h2 className="text-2xl font-semibold text-gray-900">3. Financeiro e Operacional</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100">
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

                <div className="space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100">
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

                <div className="space-y-3">
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

                <div className="space-y-3">
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

              <div className="grid md:grid-cols-2 gap-6 bg-purple-50/50 p-6 rounded-xl border border-purple-100">
                <div className="space-y-3">
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
                <div className="space-y-3">
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
                          <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-2 border-dashed hover:border-[#7030A0] hover:bg-purple-50 transition-colors">
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
                                  <p className="text-gray-700 font-medium text-sm mt-2">{socio.foto ? "Alterar foto do sócio" : "Clique para enviar a foto"}</p>
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
                                  <Label className="text-gray-700 font-medium">Etariedade</Label>
                                  <Input value={socio.etariedade} onChange={(e) => updateSocio(idx, 'etariedade', e.target.value)} placeholder="Sua faixa etária/idade" />
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
                                      <SelectItem value="Mulher cis">Mulher cis</SelectItem>
                                      <SelectItem value="Mulher trans">Mulher trans</SelectItem>
                                      <SelectItem value="Agênero">Agênero</SelectItem>
                                      <SelectItem value="Gênero neutro">Gênero neutro</SelectItem>
                                      <SelectItem value="Não binário">Não binário</SelectItem>
                                      <SelectItem value="Prefiro não declarar">Prefiro não declarar</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>                                <div className="space-y-2 md:col-span-2 mt-2">
                                  <Label className="text-gray-700 font-medium mb-2 block">Possui algum tipo de deficiência?</Label>
                                  <RadioGroup value={socio.deficiencia} onValueChange={(v) => updateSocio(idx, 'deficiencia', v)} className="flex gap-6">
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
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
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
                    <h4 className="font-semibold text-gray-800">Impactadas pelo salário do Gestore(a)s</h4>
                    <Label htmlFor="impactadasGestores" className="text-gray-700 font-medium">Número de pessoas impactadas:</Label>
                    <Input 
                      id="impactadasGestores" 
                      type="number" 
                      min="1" 
                      value={numeroImpactadasGestores}
                      onChange={(e) => handleNumeroGestoresChange(e.target.value)}
                      placeholder="Ex: 5" 
                      className="h-12 bg-white md:w-1/3" 
                    />
                  </div>

                  {typeof numeroImpactadasGestores === "number" && numeroImpactadasGestores > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {gestoresData.map((gestor, idx) => (
                        <div key={`gestores-${idx}`} className="space-y-2">
                          <Label htmlFor={`cep-gestores-${idx}`} className="text-gray-700 font-medium">Cep da pessoa {idx + 1}</Label>
                          <Input id={`cep-gestores-${idx}`} value={gestor.cep} onChange={(e) => handleCepGestorChange(idx, e.target.value)} required placeholder="00000-000" className="h-12 bg-white" maxLength={9} />
                          {gestor.cepEndereco && (
                            <p className={`text-xs mt-1 ${gestor.cepValido ? 'text-gray-500' : 'text-red-500 font-semibold'}`}>
                              {gestor.cepEndereco}
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
                      min="1" 
                      value={numeroImpactadasColaboradores}
                      onChange={(e) => handleNumeroColaboradoresChange(e.target.value)}
                      placeholder="Ex: 5" 
                      className="h-12 bg-white md:w-1/3" 
                    />
                  </div>

                  {typeof numeroImpactadasColaboradores === "number" && numeroImpactadasColaboradores > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {colaboradoresData.map((colaborador, idx) => (
                        <div key={`colab-${idx}`} className="space-y-2">
                          <Label htmlFor={`cep-colab-${idx}`} className="text-gray-700 font-medium">Cep da pessoa {idx + 1}</Label>
                          <Input id={`cep-colab-${idx}`} value={colaborador.cep} onChange={(e) => handleCepColaboradorChange(idx, e.target.value)} required placeholder="00000-000" className="h-12 bg-white" maxLength={9} />
                          {colaborador.cepEndereco && (
                            <p className={`text-xs mt-1 ${colaborador.cepValido ? 'text-gray-500' : 'text-red-500 font-semibold'}`}>
                              {colaborador.cepEndereco}
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
                <div className="space-y-2 border-b pb-2">
                  <h3 className="text-xl font-semibold text-gray-900">Recortes da Diversidade Global</h3>
                  <p className="text-gray-600 text-sm">
                    Marque as opções que correspondem a mais de 50% em cada grupo da empresa.
                  </p>
                </div>
                
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-4 font-semibold text-gray-700">Categoria</th>
                        <th className="p-4 font-semibold text-gray-700 text-center">Sócio(a)s<br/><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                        <th className="p-4 font-semibold text-gray-700 text-center">Gestore(a)s<br/><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                        <th className="p-4 font-semibold text-gray-700 text-center">Colaboradore(a)s<br/><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {["Pessoas Negras", "Mulheres", "60 anos +", "PCDs"].map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 font-medium text-gray-800">{row}</td>
                          <td className="p-4 text-center">
                            <Checkbox id={`socio-geral-${idx}`} checked={diversidadeGlobal[row as keyof typeof diversidadeGlobal].socios} onCheckedChange={() => handleDiversidadeToggle(row, 'socios')} className="w-5 h-5 rounded data-[state=checked]:bg-[#7030A0] data-[state=checked]:border-[#7030A0]" />
                          </td>
                          <td className="p-4 text-center">
                            <Checkbox id={`gestor-geral-${idx}`} checked={diversidadeGlobal[row as keyof typeof diversidadeGlobal].gestores} onCheckedChange={() => handleDiversidadeToggle(row, 'gestores')} className="w-5 h-5 rounded data-[state=checked]:bg-[#7030A0] data-[state=checked]:border-[#7030A0]" />
                          </td>
                          <td className="p-4 text-center">
                            <Checkbox id={`colab-geral-${idx}`} checked={diversidadeGlobal[row as keyof typeof diversidadeGlobal].colaboradores} onCheckedChange={() => handleDiversidadeToggle(row, 'colaboradores')} className="w-5 h-5 rounded data-[state=checked]:bg-[#7030A0] data-[state=checked]:border-[#7030A0]" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Autorizações Finais */}
              <div className="space-y-4 pt-6 pb-6 bg-gradient-to-r from-purple-50 to-white p-6 rounded-xl border border-purple-100">
                <Label className="text-gray-900 font-semibold text-lg block mb-4">
                  Você autoriza que os seus dados e os dados da sua empresa sejam compartilhados com empresas interessadas em avaliar a possibilidade de seu negócio ser um parceiro comercial?
                </Label>
                <RadioGroup onValueChange={setAutorizaCompartilhamento} required className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Sim" id="aut-sim" />
                    <Label htmlFor="aut-sim" className="text-base font-medium">Sim, autorizo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Não" id="aut-nao" />
                    <Label htmlFor="aut-nao" className="text-base font-medium">Não autorizo</Label>
                  </div>
                </RadioGroup>
              </div>

            </section>

            <div className="pt-8 flex flex-col sm:flex-row gap-6 items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Seus dados estão protegidos e o preenchimento completo ajuda na busca por novos negócios.
              </p>
              <Button type="submit" className="w-full sm:w-auto h-14 px-12 text-lg font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all" style={{ backgroundColor: '#FF9500' }}>
                Enviar Cadastro Completo
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
