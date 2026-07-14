import { useEffect, useState } from "react";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, ShieldAlert, KeyRound, Copy, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdministradoresAdm() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // States para o modal de criação
  const [modalAberto, setModalAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);

  // States para mostrar a senha gerada
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    carregarAdmins();
  }, []);

  async function carregarAdmins() {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, email, nome_responsavel, created_at')
        .eq('tipo_usuario', 'adm')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (err) {
      console.error("Erro ao carregar administradores:", err);
      toast.error("Erro ao carregar lista de administradores.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleExcluirAdmin(id: string, nome: string) {
    if (!window.confirm(`Tem certeza que deseja excluir o administrador ${nome || 'sem nome'}? Essa ação não pode ser desfeita.`)) {
      return;
    }

    try {
      // Chama a função RPC no backend para excluir de forma segura e contornar o RLS
      const { error } = await supabase.rpc('excluir_administrador', { p_empresa_id: id });
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast.success("Administrador excluído com sucesso.");
      carregarAdmins();
    } catch (err: any) {
      console.error("Erro ao excluir administrador:", err);
      toast.error(err.message || "Erro ao excluir administrador.");
    }
  }

  const hashPassword = async (password: string) => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const gerarSenhaAleatoria = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  async function handleCriarAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !nome) {
      toast.error("Preencha todos os campos.");
      return;
    }

    setCriando(true);
    try {
      // 1. Gerar senha aleatória e seu hash (para armazenar na tabela empresas)
      const senhaPlana = gerarSenhaAleatoria();
      const senhaHasheada = await hashPassword(senhaPlana);

      // 2. Chama a função RPC que cria tudo de forma segura no backend:
      //    - auth.users (já confirmado, sem precisar clicar em e-mail)
      //    - empresas
      //    - empresa_usuarios
      const { error } = await supabase.rpc('criar_administrador', {
        p_email: email,
        p_senha: senhaPlana,
        p_nome: nome,
        p_senha_hash: senhaHasheada
      });

      if (error) {
        if (
          error.message.includes('duplicate key') ||
          error.message.includes('already exists') ||
          error.message.includes('unique')
        ) {
          throw new Error("Este e-mail já está cadastrado.");
        }
        throw new Error(error.message);
      }

      setSenhaGerada(senhaPlana);
      toast.success("Administrador criado com sucesso!");
      carregarAdmins();
      
    } catch (err: any) {
      console.error("Erro ao criar admin:", err);
      toast.error(err.message || "Erro ao criar administrador.");
    } finally {
      setCriando(false);
    }
  }

  const copiarSenha = () => {
    if (senhaGerada) {
      navigator.clipboard.writeText(senhaGerada);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success("Senha copiada para a área de transferência!");
    }
  };

  const fecharEResetar = () => {
    setModalAberto(false);
    setTimeout(() => {
      setEmail("");
      setNome("");
      setSenhaGerada(null);
    }, 200);
  };

  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Administradores</h1>
            <p className="text-gray-600 mt-1">Gerencie quem tem acesso total ao painel.</p>
          </div>
          
          <Dialog open={modalAberto} onOpenChange={(open) => {
            if (!open && senhaGerada) {
              fecharEResetar();
            } else {
              setModalAberto(open);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#7030A0] hover:bg-[#5a2680] text-white">
                <Plus className="w-4 h-4 mr-2" />
                Novo Administrador
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Administrador</DialogTitle>
                <DialogDescription>
                  Um novo acesso ADM será gerado. O sistema criará uma senha provisória que deverá ser alterada no primeiro login.
                </DialogDescription>
              </DialogHeader>

              {senhaGerada ? (
                <div className="space-y-6 py-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Atenção! Copie a senha agora.</p>
                      <p>Esta senha não será mostrada novamente. Envie-a com segurança para o novo administrador.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input value={email} readOnly className="bg-gray-50" />
                  </div>

                  <div className="space-y-2">
                    <Label>Senha Temporária</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input value={senhaGerada} readOnly className="pr-10 font-mono text-lg tracking-wider" />
                        <KeyRound className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                      </div>
                      <Button type="button" variant="outline" onClick={copiarSenha} className="w-12 px-0">
                        {copiado ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>

                  <Button className="w-full" onClick={fecharEResetar}>
                    Concluir
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCriarAdmin} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input 
                      id="nome" 
                      placeholder="Ex: João Silva" 
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail Corporativo</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="Ex: joao@diversidade.io" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-[#7030A0] hover:bg-[#5a2680]" disabled={criando}>
                    {criando ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando Acesso...
                      </>
                    ) : (
                      "Gerar Acesso"
                    )}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {carregando ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" />
            </div>
          ) : admins.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum administrador encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Nome</th>
                    <th className="px-6 py-4 font-semibold">E-mail</th>
                    <th className="px-6 py-4 font-semibold">Data de Criação</th>
                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((adm) => (
                    <tr key={adm.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{adm.nome_responsavel || "-"}</td>
                      <td className="px-6 py-4 text-gray-600">{adm.email}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {adm.created_at ? new Date(adm.created_at).toLocaleDateString('pt-BR') : "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleExcluirAdmin(adm.id, adm.nome_responsavel)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </LayoutAdm>
  );
}
