import { useState, useRef } from "react";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Mail, Image as ImageIcon, Send, Clock, AlertCircle, CheckCircle2, History
} from "lucide-react";
import { toast } from "sonner";

const TIPOS_ACESSO = [
  "EMPRESA OU INICIATIVA INCENTIVADORA", 
  "FORNECEDOR INCLUSIVO", 
  "EMPREENDIMENTO DIVERSO"
];

export default function EmailMarketingAdm() {
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(false);
  
  // -- Estado do Filtro --
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "tipo_acesso" | "usuario" | "empresa">("todos");
  const [valoresFiltro, setValoresFiltro] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<any[]>([]);
  const [destinatariosCount, setDestinatariosCount] = useState<number | null>(null);

  // -- Estado do Email --
  const [assunto, setAssunto] = useState("");
  const [corpoHtml, setCorpoHtml] = useState("");
  const [agendarEnvio, setAgendarEnvio] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horaAgendamento, setHoraAgendamento] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Ações de Filtro --
  const buscarDestinatarios = async () => {
    if (tipoFiltro === "todos" || tipoFiltro === "tipo_acesso") {
      try {
        setCarregando(true);
        let query = supabase.from("empresas").select("id, tipo_acesso", { count: 'exact' }).neq("tipo_usuario", "adm");
        
        if (tipoFiltro === "tipo_acesso" && valoresFiltro.length > 0) {
          query = query.in("tipo_acesso", valoresFiltro);
        }

        const { count, error } = await query;
        if (error) throw error;
        setDestinatariosCount(count || 0); // Aproximação (não conta os multi-usuários por empresa)
        if (tipoFiltro === "todos" || valoresFiltro.length > 0) {
          setEtapa(2);
        } else {
          toast.error("Selecione ao menos um tipo de acesso.");
        }
      } catch (error) {
        console.error(error);
        toast.error("Erro ao estimar destinatários.");
      } finally {
        setCarregando(false);
      }
    } else {
      if (valoresFiltro.length === 0) {
        toast.error("Selecione ao menos um destinatário.");
        return;
      }
      setEtapa(2);
    }
  };

  const handleBusca = async (texto: string) => {
    setBusca(texto);
    if (texto.length < 3) {
      setResultadosBusca([]);
      return;
    }

    setCarregando(true);
    try {
      if (tipoFiltro === "usuario") {
        const { data } = await supabase
          .from("empresa_usuarios")
          .select("auth_user_id, nome, email")
          .or(`nome.ilike.%${texto}%,email.ilike.%${texto}%`)
          .limit(10);
        setResultadosBusca(data || []);
      } else if (tipoFiltro === "empresa") {
        const { data } = await supabase
          .from("empresas")
          .select("id, razao_social, cnpj")
          .neq("tipo_usuario", "adm")
          .or(`razao_social.ilike.%${texto}%,cnpj.ilike.%${texto}%`)
          .limit(10);
        setResultadosBusca(data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  const toggleValorFiltro = (valor: string) => {
    setValoresFiltro(prev => 
      prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]
    );
  };

  // -- Ações de Imagem --
  const handleUploadImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem.");
      return;
    }

    try {
      setCarregando(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `marketing/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("email-marketing")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("email-marketing")
        .getPublicUrl(filePath);

      const imgTag = `<br/><img src="${data.publicUrl}" alt="Imagem do Email" style="max-width: 100%; height: auto;" /><br/>`;
      setCorpoHtml(prev => prev + imgTag);
      toast.success("Imagem inserida com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao fazer upload da imagem.");
    } finally {
      setCarregando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // -- Envio --
  const confirmarEnvio = async () => {
    if (!assunto.trim() || !corpoHtml.trim()) {
      toast.error("Preencha o assunto e o corpo do e-mail.");
      return;
    }

    let agendadoPara = null;
    if (agendarEnvio) {
      if (!dataAgendamento || !horaAgendamento) {
        toast.error("Selecione a data e a hora do agendamento.");
        return;
      }
      agendadoPara = new Date(`${dataAgendamento}T${horaAgendamento}:00`).toISOString();
    }

    try {
      setCarregando(true);
      
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch("/api/email-marketing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          assunto,
          corpoHtml,
          filtro: {
            tipo: tipoFiltro,
            valores: valoresFiltro
          },
          agendadoPara
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.erro || "Erro ao processar envio.");
      }

      toast.success(result.mensagem);
      
      // Reseta o form
      setEtapa(1);
      setAssunto("");
      setCorpoHtml("");
      setValoresFiltro([]);
      setTipoFiltro("todos");
      setAgendarEnvio(false);
      setDataAgendamento("");
      setHoraAgendamento("");
      setDestinatariosCount(null);

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro desconhecido.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <LayoutAdm>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-8 w-8 text-[#7030A0]" />
            E-mail Marketing
          </h1>
          <p className="text-gray-600 mt-1">
            Crie e envie comunicados para os usuários e empresas da plataforma.
          </p>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center justify-between mb-8">
          {[
            { num: 1, label: "Destinatários" },
            { num: 2, label: "Conteúdo" },
            { num: 3, label: "Confirmação" }
          ].map((step, idx) => (
            <div key={step.num} className="flex flex-col items-center flex-1 relative">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold z-10 
                ${etapa >= step.num ? "bg-[#7030A0] text-white" : "bg-gray-200 text-gray-500"}`}
              >
                {etapa > step.num ? <CheckCircle2 className="w-6 h-6" /> : step.num}
              </div>
              <span className={`text-sm mt-2 font-medium ${etapa >= step.num ? "text-[#7030A0]" : "text-gray-500"}`}>
                {step.label}
              </span>
              {idx < 2 && (
                <div className={`absolute top-5 left-1/2 w-full h-1 -z-0 
                  ${etapa > step.num ? "bg-[#7030A0]" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ETAPA 1: DESTINATÁRIOS */}
        {etapa === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Público-alvo</CardTitle>
              <CardDescription>Defina quem irá receber este e-mail.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Selecionar por:</Label>
                <Select value={tipoFiltro} onValueChange={(val: any) => {
                  setTipoFiltro(val);
                  setValoresFiltro([]);
                  setBusca("");
                  setResultadosBusca([]);
                }}>
                  <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as empresas cadastradas</SelectItem>
                    <SelectItem value="tipo_acesso">Tipo de Acesso (Empresas)</SelectItem>
                    <SelectItem value="usuario">Usuários Específicos</SelectItem>
                    <SelectItem value="empresa">Empresas Específicas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoFiltro === "tipo_acesso" && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                  <Label>Selecione os perfis que receberão:</Label>
                  {TIPOS_ACESSO.map(tipo => (
                    <div key={tipo} className="flex items-center space-x-2">
                      <Checkbox 
                        id={tipo} 
                        checked={valoresFiltro.includes(tipo)}
                        onCheckedChange={() => toggleValorFiltro(tipo)}
                      />
                      <label htmlFor={tipo} className="text-sm font-medium leading-none cursor-pointer">
                        {tipo}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {(tipoFiltro === "usuario" || tipoFiltro === "empresa") && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                  <div className="space-y-2">
                    <Label>Buscar {tipoFiltro === 'usuario' ? 'Usuário (Nome/E-mail)' : 'Empresa (Razão Social/CNPJ)'}</Label>
                    <Input 
                      placeholder="Digite para buscar..." 
                      value={busca}
                      onChange={(e) => handleBusca(e.target.value)}
                    />
                  </div>
                  
                  {resultadosBusca.length > 0 && (
                    <div className="border rounded-md bg-white overflow-hidden">
                      {resultadosBusca.map(item => {
                        const id = item.auth_user_id || item.id;
                        const label = tipoFiltro === 'usuario' 
                          ? `${item.nome} (${item.email})` 
                          : `${item.razao_social} (${item.cnpj || 'Sem CNPJ'})`;
                        const checked = valoresFiltro.includes(id);
                        
                        return (
                          <div 
                            key={id} 
                            className="flex items-center space-x-3 p-3 hover:bg-gray-50 border-b last:border-0 cursor-pointer"
                            onClick={() => toggleValorFiltro(id)}
                          >
                            <Checkbox checked={checked} readOnly />
                            <span className="text-sm">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {valoresFiltro.length > 0 && (
                    <div className="pt-4 border-t">
                      <Label className="text-purple-700">{valoresFiltro.length} item(s) selecionado(s)</Label>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={buscarDestinatarios} disabled={carregando} className="bg-[#7030A0] hover:bg-[#5b2782]">
                  Continuar <Send className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ETAPA 2: CONTEÚDO DO E-MAIL */}
        {etapa === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor */}
            <Card className="flex flex-col h-[600px]">
              <CardHeader>
                <CardTitle>Editar E-mail</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input 
                    value={assunto} 
                    onChange={e => setAssunto(e.target.value)} 
                    placeholder="Ex: Novidades na plataforma!"
                  />
                </div>
                
                <div className="flex-1 space-y-2 flex flex-col">
                  <div className="flex justify-between items-center">
                    <Label>Corpo HTML</Label>
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleUploadImagem}
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={carregando}
                      >
                        <ImageIcon className="w-4 h-4 mr-1" /> Inserir Imagem
                      </Button>
                    </div>
                  </div>
                  <Textarea 
                    value={corpoHtml}
                    onChange={e => setCorpoHtml(e.target.value)}
                    className="flex-1 font-mono text-sm resize-none"
                    placeholder="<p>Olá,</p><br/><p>Digite seu HTML aqui...</p>"
                  />
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setEtapa(1)}>Voltar</Button>
                  <Button onClick={() => setEtapa(3)} className="bg-[#7030A0] hover:bg-[#5b2782]">
                    Pré-visualizar <Send className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="flex flex-col h-[600px] overflow-hidden">
              <CardHeader className="bg-gray-50 border-b">
                <CardTitle className="text-sm font-normal text-gray-500">Pré-visualização</CardTitle>
                <div className="font-semibold text-lg text-gray-900 truncate">
                  Assunto: {assunto || "..."}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 bg-white overflow-y-auto">
                <div className="p-6">
                  <div 
                    className="prose prose-sm max-w-none" 
                    dangerouslySetInnerHTML={{ __html: corpoHtml || "<p class='text-gray-400 italic'>O corpo do e-mail aparecerá aqui...</p>" }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ETAPA 3: CONFIRMAÇÃO */}
        {etapa === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Revisar e Enviar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4" /> Destinatários
                  </h3>
                  <p className="text-sm text-gray-600">
                    Filtro aplicado: <strong className="uppercase">{tipoFiltro.replace('_', ' ')}</strong>
                  </p>
                  {destinatariosCount !== null && tipoFiltro !== 'usuario' && tipoFiltro !== 'empresa' && (
                    <p className="text-sm text-purple-700 font-medium mt-1">
                      Aproximadamente {destinatariosCount} empresas afetadas.
                    </p>
                  )}
                  {(tipoFiltro === 'usuario' || tipoFiltro === 'empresa') && (
                    <p className="text-sm text-purple-700 font-medium mt-1">
                      {valoresFiltro.length} selecionados manualmente.
                    </p>
                  )}
                </div>

                <div className="p-4 border rounded-lg bg-gray-50">
                   <h3 className="font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" /> Resumo
                  </h3>
                  <p className="text-sm text-gray-600 truncate"><strong>Assunto:</strong> {assunto}</p>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox 
                    id="agendar" 
                    checked={agendarEnvio}
                    onCheckedChange={(c) => setAgendarEnvio(c as boolean)}
                  />
                  <label htmlFor="agendar" className="text-sm font-medium leading-none cursor-pointer">
                    Agendar envio para uma data futura
                  </label>
                </div>

                {agendarEnvio && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input type="date" value={dataAgendamento} onChange={e => setDataAgendamento(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora</Label>
                      <Input type="time" value={horaAgendamento} onChange={e => setHoraAgendamento(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setEtapa(2)} disabled={carregando}>Voltar</Button>
                <Button 
                  onClick={confirmarEnvio} 
                  disabled={carregando}
                  className={agendarEnvio ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}
                >
                  {carregando ? (
                    "Processando..."
                  ) : agendarEnvio ? (
                    <><Clock className="mr-2 w-4 h-4" /> Agendar Campanha</>
                  ) : (
                    <><Send className="mr-2 w-4 h-4" /> Enviar Agora</>
                  )}
                </Button>
              </div>

            </CardContent>
          </Card>
        )}
      </div>
    </LayoutAdm>
  );
}

// Ícone usado no resumo
function Users(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
