import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Upload, CheckCircle2, User, Building2, Wallet, Users, FileText, LogOut, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import logoImage from "@/assets/logo.png";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

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
  genero: string;
  orientacao: string;
  deficiencia: string;
}

interface ImpactadaData {
  cep: string;
  cepEndereco: string;
  cepValido: boolean;
}

/**
 * Página "Meu Cadastro" — exibe e permite editar o formulário já preenchido pelo usuário logado.
 * Rota protegida: redireciona para /login se não houver sessão ativa.
 */
export default function MeuCadastro() {
  const { usuario, isLogado, isCarregando: authCarregando, logout } = useAuth();
  const [, navigate] = useLocation();

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
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
  const [acessoTipo, setAcessoTipo] = useState("");
  const [logoEmpresaFile, setLogoEmpresaFile] = useState<File | null>(null);
  const [logoEmpresaUrl, setLogoEmpresaUrl] = useState<string | null>(null);
  const [cartaoCnpjFile, setCartaoCnpjFile] = useState<File | null>(null);
  const [cartaoCnpjUrl, setCartaoCnpjUrl] = useState<string | null>(null);
  const [fichaJuntaFile, setFichaJuntaFile] = useState<File | null>(null);
  const [fichaJuntaUrl, setFichaJuntaUrl] = useState<string | null>(null);
  const [areaEmpresa, setAreaEmpresa] = useState("");
  const [areaGeografica, setAreaGeografica] = useState("");
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
    "PCDs": { socios: false, gestores: false, colaboradores: false },
  });

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
        setAcessoTipo(empresa.acesso_tipo ?? "");
        setAreaEmpresa(empresa.area_empresa ?? "");
        setAreaGeografica(empresa.area_geografica ?? "");
        setSobreEmpresa(empresa.sobre_empresa ?? "");
        setEmiteNotaFiscal(empresa.emite_nota_fiscal ?? "");
        setTemContaPJ(empresa.tem_conta_pj ?? "");
        setFormasPagamento(empresa.formas_pagamento ?? []);
        setFormasRecebimento(empresa.formas_recebimento ?? []);
        setESocio(empresa.e_socio ?? "");
        setTemNegrosSocios(empresa.tem_negros_socios ?? "");
        setAutorizaCompartilhamento(empresa.autoriza_compartilhamento ?? "");
        if (empresa.diversidade_global) setDiversidadeGlobal(empresa.diversidade_global);

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
            sexo: s.sexo ?? "",
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
          const colaboradores = ceps.filter((c: any) => c.tipo === "COLABORADOR");

          if (gestores.length > 0) {
            setNumeroImpactadasGestores(gestores.length);
            setGestoresData(
              gestores.map((g: any) => ({
                cep: g.cep ?? "",
                cepEndereco: g.endereco_validado ?? "",
                cepValido: true,
              }))
            );
          }
          if (colaboradores.length > 0) {
            setNumeroImpactadasColaboradores(colaboradores.length);
            setColaboradoresData(
              colaboradores.map((c: any) => ({
                cep: c.cep ?? "",
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
      return { valido: true, endereco: `${data.logradouro}, ${data.bairro} - ${data.uf}` };
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

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length > 10) return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    if (v.length > 6) return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    if (v.length > 2) return v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
    return v;
  };

  const updateSocio = (index: number, field: keyof SocioData, value: any) => {
    const newData = [...sociosData];
    newData[index] = { ...newData[index], [field]: value };
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
              cpf: "", cep: "", email: "", dataNascimento: "", nacionalidade: "", etariedade: "", raca: "",
              sexo: "", genero: "", orientacao: "", deficiencia: "",
            });
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

  const handleNumeroGestoresChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroImpactadasGestores(num);
    if (typeof num === "number" && num > 0) {
      setGestoresData((prev) => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) newData.push({ cep: "", cepEndereco: "", cepValido: false });
        } else newData.length = num;
        return newData;
      });
    } else setGestoresData([]);
  };

  const handleNumeroColaboradoresChange = (val: string) => {
    const num = val ? parseInt(val, 10) : "";
    setNumeroImpactadasColaboradores(num);
    if (typeof num === "number" && num > 0) {
      setColaboradoresData((prev) => {
        const newData = [...prev];
        if (newData.length < num) {
          for (let i = newData.length; i < num; i++) newData.push({ cep: "", cepEndereco: "", cepValido: false });
        } else newData.length = num;
        return newData;
      });
    } else setColaboradoresData([]);
  };

  const handleCepSocioChange = async (index: number, val: string) => {
    const formatted = formatCep(val);
    setSociosData((prev) => {
      const newData = [...prev];
      newData[index] = { ...newData[index], cep: formatted, cepValido: false, cepEndereco: "" };
      return newData;
    });
    if (formatted.length === 9) {
      const data = await fetchCepData(formatted);
      setSociosData((prev) => {
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
      setGestoresData((prev) => {
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
      setColaboradoresData((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], cepValido: data.valido, cepEndereco: data.endereco };
        return updated;
      });
    }
  };

  const handlePagamentoToggle = (forma: string) =>
    setFormasPagamento((prev) => prev.includes(forma) ? prev.filter((f) => f !== forma) : [...prev, forma]);

  const handleRecebimentoToggle = (forma: string) =>
    setFormasRecebimento((prev) => prev.includes(forma) ? prev.filter((f) => f !== forma) : [...prev, forma]);

  const handleDiversidadeToggle = (categoria: string, grupo: "socios" | "gestores" | "colaboradores") => {
    setDiversidadeGlobal((prev) => ({
      ...prev,
      [categoria]: { ...prev[categoria as keyof typeof prev], [grupo]: !prev[categoria as keyof typeof prev][grupo] },
    }));
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
    const todosCepsGestoresValidos = gestoresData.every((g) => !g.cep || g.cepValido);
    const todosCepsColaboradoresValidos = colaboradoresData.every((c) => !c.cep || c.cepValido);

    if (!todosCepsSociosValidos || !todosCepsGestoresValidos || !todosCepsColaboradoresValidos) {
      setSenhaErro("Existem CEPs inválidos preenchidos. Por favor, verifique os campos com alerta vermelho.");
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
          acesso_tipo: acessoTipo,
          area_empresa: areaEmpresa,
          area_geografica: areaGeografica,
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
            sexo: s.sexo,
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
      gestoresData.forEach((g) => {
        if (g.cep) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "GESTOR", cep: g.cep, endereco_validado: g.cepEndereco });
      });
      colaboradoresData.forEach((c) => {
        if (c.cep) cepsToInsert.push({ empresa_id: usuario!.empresaId, tipo: "COLABORADOR", cep: c.cep, endereco_validado: c.cepEndereco });
      });
      if (cepsToInsert.length > 0) {
        const { error: erroCeps } = await supabase.from("ceps_impactados").insert(cepsToInsert);
        if (erroCeps) throw erroCeps;
      }

      setSalvoComSucesso(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      setSenhaErro("Ocorreu um erro ao salvar as alterações: " + err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
          <p className="text-red-600 font-semibold mb-4">{erroGlobal}</p>
          <Button onClick={() => window.location.reload()} style={{ backgroundColor: "#7030A0" }} className="text-white">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={logoImage} alt="Logo Diversidade.io" className="h-10 w-auto object-contain" />
            <span className="font-bold text-xl hidden sm:block" style={{ color: "#7030A0" }}>
              Diversidade.io
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              Olá, <strong>{usuario?.nomeResponsavel?.split(" ")[0]}</strong>
            </span>
            <Button
              variant="outline"
              onClick={handleSairLogout}
              className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Cabeçalho do formulário */}
          <div className="bg-gradient-to-r from-[#0F3A7D] to-[#7030A0] p-8 md:p-12 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{color: '#FFFFFF'}}>Meu Cadastro</h1>
            <p className="text-lg opacity-90">
              Seus dados estão preenchidos abaixo. Edite o que precisar e salve as alterações.
            </p>
          </div>

          {/* Banner de sucesso */}
          {salvoComSucesso && (
            <div className="m-8 p-4 bg-green-50 border-l-4 border-green-500 text-green-800 rounded shadow-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Alterações salvas com sucesso!</p>
                <p className="text-sm">Seus dados foram atualizados.</p>
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
                      {fotoResponsavelFile || fotoResponsavelUrl ? "Alterar foto do responsável" : "Clique para enviar a foto"}
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
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-blue-600 shadow-md">
                        <img src={URL.createObjectURL(logoEmpresaFile)} alt="Preview Logo" className="w-full h-full object-cover" />
                      </div>
                    ) : logoEmpresaUrl ? (
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-blue-600 shadow-md">
                        <img src={logoEmpresaUrl} alt="Logo Atual" className="w-full h-full object-cover" />
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
                  <Label className="text-gray-700 font-medium">O seu acesso é como:</Label>
                  <Select value={acessoTipo} onValueChange={setAcessoTipo}>
                    <SelectTrigger className="h-12 bg-gray-50 focus:bg-white">
                      <SelectValue placeholder="Selecione o acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPRESA OU INICIATIVA INCENTIVADORA">EMPRESA OU INICIATIVA INCENTIVADORA</SelectItem>
                      <SelectItem value="FORNECEDOR INCLUSIVO">FORNECEDOR INCLUSIVO</SelectItem>
                      <SelectItem value="EMPREENDIMENTO DIVERSO">EMPREENDIMENTO DIVERSO</SelectItem>
                      <SelectItem value="OUTRO">OUTRO - CITE AQUI</SelectItem>
                    </SelectContent>
                  </Select>
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
                      onChange={(e) => { if (e.target.files && e.target.files[0]) setFichaJuntaFile(e.target.files[0]); }} />
                    <label htmlFor="fichaJunta" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                      <div className={`w-10 h-10 rounded-full ${fichaJuntaFile || fichaJuntaUrl ? "bg-[#7030A0]" : "bg-purple-100"} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <FileText className={`w-5 h-5 ${fichaJuntaFile || fichaJuntaUrl ? "text-white" : "text-[#7030A0]"}`} />
                      </div>
                      <p className="text-gray-700 font-medium text-sm">
                        {fichaJuntaFile ? <span className="text-[#7030A0]">{fichaJuntaFile.name}</span> : 
                         fichaJuntaUrl ? <a href={fichaJuntaUrl} target="_blank" rel="noreferrer" className="text-[#7030A0] hover:underline" onClick={(e) => e.stopPropagation()}>Ver arquivo salvo (clique para abrir) ou escolha outro</a> : 
                         "Clique para enviar Ficha Simples"}
                      </p>
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
                  <h3 className="text-xl font-semibold text-gray-900">Detalhamento dos Sócios</h3>
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
                                  <p className="text-gray-700 font-medium text-sm mt-2">{socio.foto || socio.fotoUrl ? "Alterar foto do sócio" : "Clique para enviar a foto"}</p>
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
                                <Input type="date" value={socio.dataNascimento} onChange={(e) => updateSocio(idx, "dataNascimento", e.target.value)} />
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
                              <h4 className="font-semibold text-gray-900 mb-4">Autodeclaração</h4>
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Nacionalidade</Label>
                                  <Input value={socio.nacionalidade} onChange={(e) => updateSocio(idx, "nacionalidade", e.target.value)} placeholder="Ex: Brasileira" />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Etariedade</Label>
                                  <Input value={socio.etariedade} onChange={(e) => updateSocio(idx, "etariedade", e.target.value)} placeholder="Sua faixa etária/idade" />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Raça</Label>
                                  <Input value={socio.raca} onChange={(e) => updateSocio(idx, "raca", e.target.value)} placeholder="Ex: Parda, Preta, Branca..." />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Sexo</Label>
                                  <Input value={socio.sexo} onChange={(e) => updateSocio(idx, "sexo", e.target.value)} placeholder="Ex: Feminino, Masculino" />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Gênero</Label>
                                  <Input value={socio.genero} onChange={(e) => updateSocio(idx, "genero", e.target.value)} placeholder="Ex: Cisgênero, Transgênero..." />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 font-medium">Orientação</Label>
                                  <Input value={socio.orientacao} onChange={(e) => updateSocio(idx, "orientacao", e.target.value)} placeholder="Ex: Heterossexual, LGBTQIAP+" />
                                </div>
                                <div className="space-y-2 md:col-span-2 mt-2">
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
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
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
                    <h4 className="font-semibold text-gray-800">Impactadas pelo salário do Gestore(a)s</h4>
                    <Label htmlFor="impactadasGestores" className="text-gray-700 font-medium">Número de pessoas impactadas:</Label>
                    <Input id="impactadasGestores" type="number" min="1" value={numeroImpactadasGestores}
                      onChange={(e) => handleNumeroGestoresChange(e.target.value)} placeholder="Ex: 5" className="h-12 bg-white md:w-1/3" />
                  </div>
                  {typeof numeroImpactadasGestores === "number" && numeroImpactadasGestores > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {gestoresData.map((gestor, idx) => (
                        <div key={`gestores-${idx}`} className="space-y-2">
                          <Label htmlFor={`cep-gestores-${idx}`} className="text-gray-700 font-medium">Cep da pessoa {idx + 1}</Label>
                          <Input id={`cep-gestores-${idx}`} value={gestor.cep} onChange={(e) => handleCepGestorChange(idx, e.target.value)} placeholder="00000-000" className="h-12 bg-white" maxLength={9} />
                          {gestor.cepEndereco && (
                            <p className={`text-xs mt-1 ${gestor.cepValido ? "text-gray-500" : "text-red-500 font-semibold"}`}>{gestor.cepEndereco}</p>
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
                    <Input id="impactadasColab" type="number" min="1" value={numeroImpactadasColaboradores}
                      onChange={(e) => handleNumeroColaboradoresChange(e.target.value)} placeholder="Ex: 5" className="h-12 bg-white md:w-1/3" />
                  </div>
                  {typeof numeroImpactadasColaboradores === "number" && numeroImpactadasColaboradores > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {colaboradoresData.map((colaborador, idx) => (
                        <div key={`colab-${idx}`} className="space-y-2">
                          <Label htmlFor={`cep-colab-${idx}`} className="text-gray-700 font-medium">Cep da pessoa {idx + 1}</Label>
                          <Input id={`cep-colab-${idx}`} value={colaborador.cep} onChange={(e) => handleCepColaboradorChange(idx, e.target.value)} placeholder="00000-000" className="h-12 bg-white" maxLength={9} />
                          {colaborador.cepEndereco && (
                            <p className={`text-xs mt-1 ${colaborador.cepValido ? "text-gray-500" : "text-red-500 font-semibold"}`}>{colaborador.cepEndereco}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Diversidade Global */}
              <div className="space-y-6 pt-6">
                <div className="space-y-2 border-b pb-2">
                  <h3 className="text-xl font-semibold text-gray-900">Recortes da Diversidade Global</h3>
                  <p className="text-gray-600 text-sm">Marque as opções que correspondem a mais de 50% em cada grupo da empresa.</p>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-4 font-semibold text-gray-700">Categoria</th>
                        <th className="p-4 font-semibold text-gray-700 text-center">Sócio(a)s<br /><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                        <th className="p-4 font-semibold text-gray-700 text-center">Gestore(a)s<br /><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                        <th className="p-4 font-semibold text-gray-700 text-center">Colaboradore(a)s<br /><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {["Pessoas Negras", "Mulheres", "60 anos +", "PCDs"].map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 font-medium text-gray-800">{row}</td>
                          <td className="p-4 text-center">
                            <Checkbox id={`socio-geral-${idx}`} checked={diversidadeGlobal[row as keyof typeof diversidadeGlobal].socios} onCheckedChange={() => handleDiversidadeToggle(row, "socios")} className="w-5 h-5 rounded data-[state=checked]:bg-[#7030A0] data-[state=checked]:border-[#7030A0]" />
                          </td>
                          <td className="p-4 text-center">
                            <Checkbox id={`gestor-geral-${idx}`} checked={diversidadeGlobal[row as keyof typeof diversidadeGlobal].gestores} onCheckedChange={() => handleDiversidadeToggle(row, "gestores")} className="w-5 h-5 rounded data-[state=checked]:bg-[#7030A0] data-[state=checked]:border-[#7030A0]" />
                          </td>
                          <td className="p-4 text-center">
                            <Checkbox id={`colab-geral-${idx}`} checked={diversidadeGlobal[row as keyof typeof diversidadeGlobal].colaboradores} onCheckedChange={() => handleDiversidadeToggle(row, "colaboradores")} className="w-5 h-5 rounded data-[state=checked]:bg-[#7030A0] data-[state=checked]:border-[#7030A0]" />
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
                <RadioGroup value={autorizaCompartilhamento} onValueChange={setAutorizaCompartilhamento} className="flex gap-6">
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

            {/* Botão Salvar */}
            <div className="pt-8 flex flex-col sm:flex-row gap-6 items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Seus dados estão protegidos. O preenchimento completo ajuda na busca por novos negócios.
              </p>
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
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
