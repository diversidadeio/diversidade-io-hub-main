import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  Users,
  Key,
  Edit2,
  Loader2,
  CheckCircle2,
  X,
  Mail,
  Phone,
  User,
  Shield,
  ShieldCheck,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { registrarLog } from "@/lib/registrarLog";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface UsuarioEmpresa {
  /** ID do registro em empresa_usuarios (null se for o responsável principal sem entrada lá) */
  empresa_usuario_id: string | null;
  /** ID do usuário no Auth */
  auth_user_id: string;
  /** É o responsável principal da tabela empresas? */
  empresa_principal: boolean;
  nome: string;
  email: string;
  telefone: string | null;
  papel: "admin" | "usuario" | "responsavel";
  status: "ativo" | "pendente" | null;
}

interface FormEdicao {
  nome: string;
  email: string;
  telefone: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  aberto: boolean;
  onFechar: () => void;
  empresa: {
    id: string;
    email: string;
    nome_responsavel: string | null;
    telefone_principal: string | null;
  };
  onDadosAlterados?: () => void;
}

// ─── Componente principal ───────────────────────────────────────────────────────

export default function ModalUsuariosEmpresa({ aberto, onFechar, empresa, onDadosAlterados }: Props) {
  const { usuario } = useAuth();

  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Estado de senha temporária
  const [gerandoSenha, setGerandoSenha] = useState<string | null>(null); // auth_user_id sendo processado
  const [senhaGerada, setSenhaGerada] = useState<{ senha: string; nome: string } | null>(null);
  const [dialogSenhaAberto, setDialogSenhaAberto] = useState(false);

  // Estado de edição inline
  const [editandoId, setEditandoId] = useState<string | null>(null); // auth_user_id em edição
  const [formEdicao, setFormEdicao] = useState<FormEdicao>({ nome: "", email: "", telefone: "" });
  const [salvando, setSalvando] = useState(false);

  // ─── Carrega usuários ─────────────────────────────────────────────────────────

  const carregarUsuarios = async () => {
    if (!empresa?.id) return;
    setCarregando(true);
    try {
      // Busca usuários da tabela empresa_usuarios
      const { data: euList, error: euErr } = await supabase
        .from("empresa_usuarios")
        .select("id, auth_user_id, nome, email, telefone, papel, status")
        .eq("empresa_id", empresa.id)
        .order("created_at", { ascending: true });

      if (euErr) throw euErr;

      const lista: UsuarioEmpresa[] = [];
      const emailsJaAdicionados = new Set<string>();

      // Processa usuários de empresa_usuarios
      for (const eu of euList || []) {
        lista.push({
          empresa_usuario_id: eu.id,
          auth_user_id: eu.auth_user_id,
          empresa_principal: eu.email === empresa.email,
          nome: eu.nome || "",
          email: eu.email || "",
          telefone: eu.telefone || null,
          papel: eu.papel as "admin" | "usuario",
          status: eu.status as "ativo" | "pendente",
        });
        emailsJaAdicionados.add(eu.email);
      }

      // Sempre inclui o responsável principal se ainda não estiver na lista
      if (!emailsJaAdicionados.has(empresa.email)) {
        // O auth_user_id do responsável principal é o próprio id da empresa (padrão legado)
        lista.unshift({
          empresa_usuario_id: null,
          auth_user_id: empresa.id,
          empresa_principal: true,
          nome: empresa.nome_responsavel || "",
          email: empresa.email || "",
          telefone: empresa.telefone_principal || null,
          papel: "responsavel",
          status: null,
        });
      }

      setUsuarios(lista);
    } catch (err: any) {
      toast.error("Erro ao carregar usuários: " + err.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (aberto) {
      carregarUsuarios();
    }
  }, [aberto, empresa?.id]);

  // ─── Gerar senha temporária ───────────────────────────────────────────────────

  const handleGerarSenha = async (u: UsuarioEmpresa) => {
    setGerandoSenha(u.auth_user_id);
    try {
      const resp = await fetch("/api/adm/gerar-senha-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_user_id: u.auth_user_id, email_fallback: u.email }),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || "Erro ao gerar senha");

      setSenhaGerada({ senha: dados.senha, nome: u.nome || u.email });
      setDialogSenhaAberto(true);

      registrarLog({
        tipo_evento: "adm_gerar_senha",
        empresa_id: empresa.id,
        nome_empresa: empresa.nome_responsavel || empresa.email,
        email: usuario?.email || "admin",
        detalhes: `Gerou senha temporária para o usuário: ${u.email}`,
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGerandoSenha(null);
    }
  };

  // ─── Iniciar edição ───────────────────────────────────────────────────────────

  const iniciarEdicao = (u: UsuarioEmpresa) => {
    setEditandoId(u.auth_user_id);
    setFormEdicao({
      nome: u.nome || "",
      email: u.email || "",
      telefone: u.telefone || "",
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setFormEdicao({ nome: "", email: "", telefone: "" });
  };

  // ─── Salvar edição ────────────────────────────────────────────────────────────

  const handleSalvar = async (u: UsuarioEmpresa) => {
    setSalvando(true);
    try {
      // Só envia os campos que mudaram
      const payload: Record<string, any> = {
        auth_user_id: u.auth_user_id,
        empresa_usuario_id: u.empresa_usuario_id,
        empresa_id: empresa.id,
        empresa_principal: u.empresa_principal,
        email_atual: u.email, // usado como fallback no servidor se o auth_user_id não existir
      };

      if (formEdicao.nome !== u.nome) payload.nome = formEdicao.nome;
      if (formEdicao.email !== u.email) payload.email = formEdicao.email;
      if (formEdicao.telefone !== (u.telefone || "")) payload.telefone = formEdicao.telefone || null;

      // Se não há nada alterado, apenas fecha
      if (!payload.nome && !payload.email && payload.telefone === undefined) {
        cancelarEdicao();
        return;
      }

      const resp = await fetch("/api/adm/atualizar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.erro || "Erro ao atualizar");

      toast.success("Dados atualizados com sucesso!");

      registrarLog({
        tipo_evento: "adm_editar_usuario",
        empresa_id: empresa.id,
        nome_empresa: empresa.nome_responsavel || empresa.email,
        email: usuario?.email || "admin",
        detalhes: `Editou dados do usuário: ${u.email}`,
      });

      cancelarEdicao();
      await carregarUsuarios();
      onDadosAlterados?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSalvando(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const badgePapel = (papel: string) => {
    if (papel === "responsavel") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200">
          <ShieldCheck className="w-3 h-3" /> Responsável
        </span>
      );
    }
    if (papel === "admin") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">
          <Shield className="w-3 h-3" /> Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200">
        <User className="w-3 h-3" /> Usuário
      </span>
    );
  };

  const badgeStatus = (status: string | null) => {
    if (!status) return null;
    if (status === "ativo") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
          <CheckCircle2 className="w-3 h-3" /> Ativo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">
        Pendente
      </span>
    );
  };

  return (
    <>
      {/* ─── Modal principal ─────────────────────────────────────────────────── */}
      <Dialog open={aberto} onOpenChange={onFechar}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Users className="w-5 h-5 text-[#7030A0]" />
              Usuários da Empresa
            </DialogTitle>
            <DialogDescription>
              Gerencie os usuários vinculados a este cadastro. Você pode gerar
              senha temporária ou editar nome, e-mail e telefone de cada usuário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {carregando ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-[#7030A0]" />
              </div>
            ) : usuarios.length === 0 ? (
              <p className="text-center text-gray-500 italic py-8">
                Nenhum usuário encontrado para esta empresa.
              </p>
            ) : (
              usuarios.map((u) => {
                const estaEditando = editandoId === u.auth_user_id;
                const gerandoEste = gerandoSenha === u.auth_user_id;

                return (
                  <div
                    key={u.auth_user_id}
                    className="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden"
                  >
                    {/* ── Cabeçalho do card ── */}
                    <div className="flex items-start justify-between px-5 pt-4 pb-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm truncate">
                            {u.nome || <span className="text-gray-400 italic">Sem nome</span>}
                          </span>
                          {badgePapel(u.papel)}
                          {badgeStatus(u.status)}
                        </div>
                        <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 shrink-0" />
                            {u.email}
                          </span>
                          {u.telefone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 shrink-0" />
                              {u.telefone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botões de ação */}
                      {!estaEditando && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 h-8 px-3 text-xs"
                            onClick={() => handleGerarSenha(u)}
                            disabled={gerandoEste}
                          >
                            {gerandoEste ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Key className="w-3 h-3" />
                            )}
                            {gerandoEste ? "Gerando…" : "Gerar Senha"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 h-8 px-3 text-xs"
                            onClick={() => iniciarEdicao(u)}
                          >
                            <Edit2 className="w-3 h-3" />
                            Editar
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* ── Formulário de edição inline ── */}
                    {estaEditando && (
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Nome */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Nome
                            </label>
                            <input
                              type="text"
                              value={formEdicao.nome}
                              onChange={(e) =>
                                setFormEdicao((f) => ({ ...f, nome: e.target.value }))
                              }
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7030A0]/20 focus:border-[#7030A0]"
                              placeholder="Nome do usuário"
                            />
                          </div>
                          {/* Telefone */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Telefone
                            </label>
                            <input
                              type="text"
                              value={formEdicao.telefone}
                              onChange={(e) =>
                                setFormEdicao((f) => ({ ...f, telefone: e.target.value }))
                              }
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7030A0]/20 focus:border-[#7030A0]"
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>
                        {/* E-mail — linha inteira com aviso */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            E-mail{" "}
                            <span className="text-amber-600 font-normal">
                              (usado para login — altere com cuidado)
                            </span>
                          </label>
                          <input
                            type="email"
                            value={formEdicao.email}
                            onChange={(e) =>
                              setFormEdicao((f) => ({ ...f, email: e.target.value }))
                            }
                            className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            placeholder="email@empresa.com.br"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-4 text-xs"
                            onClick={cancelarEdicao}
                            disabled={salvando}
                          >
                            <X className="w-3 h-3 mr-1" /> Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-4 text-xs bg-[#7030A0] hover:bg-[#5a2080] text-white flex items-center gap-1.5"
                            onClick={() => handleSalvar(u)}
                            disabled={salvando}
                          >
                            {salvando ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            {salvando ? "Salvando…" : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onFechar} className="h-9">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog de senha gerada ──────────────────────────────────────────── */}
      <Dialog open={dialogSenhaAberto} onOpenChange={setDialogSenhaAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Key className="w-5 h-5" /> Senha Temporária Gerada
            </DialogTitle>
            <DialogDescription>
              Copie a senha abaixo e envie para{" "}
              <strong>{senhaGerada?.nome}</strong>.<br />
              <br />
              <strong>IMPORTANTE:</strong> Esta senha não poderá ser visualizada
              novamente. O usuário deverá criar uma nova senha assim que fizer
              login.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center my-2">
            <span className="text-3xl font-mono font-bold tracking-widest text-gray-900">
              {senhaGerada?.senha}
            </span>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                navigator.clipboard.writeText(senhaGerada?.senha || "");
                toast.success("Senha copiada!");
              }}
            >
              <Copy className="w-4 h-4" /> Copiar Senha
            </Button>
            <Button
              type="button"
              style={{ backgroundColor: "#7030A0" }}
              className="text-white flex items-center gap-2"
              onClick={() => setDialogSenhaAberto(false)}
            >
              <CheckCircle2 className="w-4 h-4" /> Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
