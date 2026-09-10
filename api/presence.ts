import { supabaseAdmin, exigirSessao, exigirAdm } from "./_auth";

export default async function handler(req: any, res: any) {
  const { action } = req.query;

  if (!supabaseAdmin) {
    return res.status(500).json({ erro: "Configuração do Supabase ausente" });
  }

  try {
    if (action === "ping") {
      if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

      // O e-mail vem do token, não do corpo: caso contrário qualquer pessoa
      // poderia marcar outro usuário como "online".
      const identidade = await exigirSessao(req, res);
      if (!identidade) return;

      const { error } = await supabaseAdmin
        .from('user_presence')
        .upsert({ email: identidade.email.toLowerCase(), last_seen: new Date().toISOString() });

      if (error) throw error;
      return res.json({ ok: true });
    }

    if (action === "online") {
      if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

      // Expõe e-mails e atividade de todos os usuários: somente administradores.
      if (!(await exigirAdm(req, res))) return;

      const { data: logs, error } = await supabaseAdmin
        .from("logs_acesso")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(6000);

      if (error) throw error;

      const emailsComEventosValidos = new Set();
      const mapUsuarios = new Map();

      for (const log of (logs || [])) {
        if (!log.email) continue;
        if (log.tipo_evento !== "login_falha") {
          emailsComEventosValidos.add(log.email.toLowerCase());
        }
      }

      for (const log of (logs || [])) {
        if (!log.email) continue;
        const key = log.email.toLowerCase();
        
        if (!emailsComEventosValidos.has(key)) continue;

        if (!mapUsuarios.has(key)) {
          mapUsuarios.set(key, {
            email: log.email,
            empresa: "---",
            ultimoEvento: log.tipo_evento,
            ultimaAtividade: log.criado_em,
            ultimoLogin: null
          });
        }
      }

      const usuarios = Array.from(mapUsuarios.values());

      if (usuarios.length > 0) {
        const emails = usuarios.map((u: any) => u.email);
        
        const { data: ultimosLogins } = await supabaseAdmin
          .from("logs_acesso")
          .select("email, criado_em")
          .eq("tipo_evento", "login_sucesso")
          .in("email", emails)
          .order("criado_em", { ascending: false });
          
        for (const login of (ultimosLogins || [])) {
          const u = mapUsuarios.get(login.email.toLowerCase());
          if (u && !u.ultimoLogin) {
             u.ultimoLogin = login.criado_em;
          }
        }

        const { data: perfis } = await supabaseAdmin
          .from("empresas")
          .select("email, razao_social, nome_responsavel, tipo_usuario")
          .in("email", emails);
          
        for (const p of (perfis || [])) {
          if (!p.email) continue;
          const u = mapUsuarios.get(p.email.toLowerCase());
          if (u) {
            if (p.tipo_usuario === "adm") {
              u.empresa = p.nome_responsavel || "Administrador";
              u.isAdm = true;
            } else {
              u.empresa = p.razao_social || p.nome_responsavel || "Empresa";
              u.isAdm = false;
            }
          }
        }

        const emailsSemPerfil = emails.filter((e) => {
          const u = mapUsuarios.get(e.toLowerCase());
          return u && u.empresa === "---";
        });

        if (emailsSemPerfil.length > 0) {
          const { data: convidados } = await supabaseAdmin
            .from("empresa_usuarios")
            .select("email, empresa_id")
            .in("email", emailsSemPerfil);

          if (convidados && convidados.length > 0) {
            const empresaIds = [...new Set(convidados.map(c => c.empresa_id))];
            const { data: empresasConvidados } = await supabaseAdmin
              .from("empresas")
              .select("id, razao_social, nome_fantasia")
              .in("id", empresaIds);

            const mapaEmpresas = new Map();
            for (const emp of (empresasConvidados || [])) {
              mapaEmpresas.set(emp.id, emp.razao_social || emp.nome_fantasia || "Empresa Vinculada");
            }

            for (const c of convidados) {
              if (!c.email) continue;
              const u = mapUsuarios.get(c.email.toLowerCase());
              if (u) {
                u.empresa = mapaEmpresas.get(c.empresa_id) || "Empresa";
                u.isAdm = false;
              }
            }
          }
        }

        const { data: presencas } = await supabaseAdmin
          .from('user_presence')
          .select('email, last_seen')
          .in('email', emails);

        for (const pr of (presencas || [])) {
          if (!pr.email) continue;
          const u = mapUsuarios.get(pr.email.toLowerCase());
          if (u && pr.last_seen) {
            const dataPresence = new Date(pr.last_seen).getTime();
            const dataAtividadeLog = new Date(u.ultimaAtividade).getTime();
            if (dataPresence > dataAtividadeLog) {
              u.ultimaAtividade = pr.last_seen;
              u.ultimoEvento = u.ultimoEvento !== "logout" ? u.ultimoEvento : "ping_presence";
            }
          }
        }
      }

      const usuariosAtivos = Array.from(mapUsuarios.values()).filter((u: any) => u.empresa !== "---");
      return res.json({ usuarios: usuariosAtivos });
    }

    return res.status(404).json({ erro: "Ação não encontrada" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ erro: err.message });
  }
}
