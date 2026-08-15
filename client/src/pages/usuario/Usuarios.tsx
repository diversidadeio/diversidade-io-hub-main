import { useEffect, useState } from "react";
import { LayoutUsuario } from "@/components/LayoutUsuario";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, UserPlus, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { registrarLog } from "@/lib/registrarLog";

export default function Usuarios() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isLider, setIsLider] = useState(false);

  // Modal Convite
  const [modalAberto, setModalAberto] = useState(false);
  const [conviteNome, setConviteNome] = useState("");
  const [conviteEmail, setConviteEmail] = useState("");
  const [convitePapel, setConvitePapel] = useState("usuario");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function carregarUsuarios() {
      if (!usuario) return;
      
      try {
        // Verifica se o usuário atual tem papel de 'admin' na empresa.
        // Apenas admins podem convidar e remover outros membros.
        const isAdmin = (usuario as any).papel === 'admin';
        setIsLider(isAdmin);

        const { data, error } = await supabase
          .from('empresa_usuarios')
          .select('*')
          .eq('empresa_id', (usuario as any).empresaId)
          .order('created_at', { ascending: true });

        if (error) {
          // Se der erro porque a tabela não existe ainda (migração pendente), ignora
          console.warn("Tabela empresa_usuarios pode não existir ainda", error);
        } else {
          setUsuarios(data || []);
        }
      } catch (err) {
        console.error("Erro ao carregar usuários:", err);
      } finally {
        setCarregando(false);
      }
    }
    carregarUsuarios();
  }, [usuario]);

  const handleConvidar = async () => {
    if (!conviteNome || !conviteEmail) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    setEnviando(true);
    
    try {
      // Chama o endpoint do servidor que cria o usuário no Auth e envia o e-mail
      const resposta = await fetch('/api/convidar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: (usuario as any)?.empresaId,
          nome: conviteNome,
          email: conviteEmail,
          papel: convitePapel,
          convidadoPorEmail: usuario?.email
        })
      });

      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Erro ao convidar.");
      
      toast.success("Convite enviado com sucesso! O usuário receberá um e-mail.");

      // Registra log do convite enviado
      registrarLog({
        tipo_evento: 'usuario_convidar',
        email: usuario?.email,
        empresa_id: (usuario as any)?.empresaId,
        detalhes: `Convidado: ${conviteEmail} (papel: ${convitePapel})`,
      });

      // Recarrega a lista de usuários
      const { data: lista } = await supabase
        .from('empresa_usuarios')
        .select('*')
        .eq('empresa_id', (usuario as any).empresaId)
        .order('created_at', { ascending: true });
      setUsuarios(lista || []);
      
      setModalAberto(false);
      setConviteNome("");
      setConviteEmail("");
      
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao convidar: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleRemover = async (id: string, email: string) => {
    if (!confirm(`Tem certeza que deseja remover ${email}?`)) return;
    
    try {
      const { error } = await supabase
        .from('empresa_usuarios')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setUsuarios(usuarios.filter(u => u.id !== id));
      toast.success("Usuário removido.");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <LayoutUsuario activePath="/meu-cadastro/usuarios">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Usuários</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gerencie quem tem acesso aos dados da sua empresa.
            </p>
          </div>
          
          {isLider && (
            <Button 
              onClick={() => setModalAberto(true)} 
              className="flex items-center gap-2 bg-[#7030A0] hover:bg-purple-800 text-white"
            >
              <UserPlus className="w-4 h-4" />
              Convidar Usuário
            </Button>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Usuário</th>
                  <th className="px-6 py-4 font-semibold">Papel</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {carregando ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center">
                      <div className="flex justify-center items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      Nenhum outro usuário cadastrado.
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => {
                    const isCurrentUser = u.email === usuario?.email;
                    return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-gray-200 dark:border-gray-600">
                            <AvatarImage src={u.foto_url || undefined} />
                            <AvatarFallback className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {getInitials(u.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {u.nome} {isCurrentUser && <span className="text-purple-600 text-sm font-normal">(Você)</span>}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {u.papel === 'admin' ? (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            Administrador
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            Usuário Comum
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.status === 'ativo' ? (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 flex items-center gap-1 w-max">
                            <Mail className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isCurrentUser ? (
                          <span className="text-gray-400 text-xs italic">Não removível</span>
                        ) : isLider ? (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleRemover(u.id, u.email)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700 dark:text-white">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              O usuário receberá um e-mail com instruções para definir sua senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="dark:text-gray-200">Nome completo</Label>
              <Input 
                id="nome" 
                value={conviteNome} 
                onChange={e => setConviteNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-gray-200">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                value={conviteEmail} 
                onChange={e => setConviteEmail(e.target.value)}
                placeholder="joao@exemplo.com"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="papel" className="dark:text-gray-200">Nível de Acesso</Label>
              <Select value={convitePapel} onValueChange={setConvitePapel}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <SelectItem value="usuario">Usuário Comum (não convida, não apaga)</SelectItem>
                  <SelectItem value="admin">Administrador (gestão total)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)} disabled={enviando} className="dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancelar
            </Button>
            <Button onClick={handleConvidar} disabled={enviando} style={{ backgroundColor: "#7030A0" }} className="text-white">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LayoutUsuario>
  );
}
