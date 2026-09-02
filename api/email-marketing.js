import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    // 1. Busca histórico de campanhas
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ erro: "Não autorizado" });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ erro: "Token inválido" });
      }

      // Verifica se é admin
      const { data: adminData } = await supabaseAdmin
        .from('empresa_usuarios')
        .select('empresas(tipo_usuario)')
        .eq('auth_user_id', user.id)
        .single();

      if (!adminData || adminData.empresas?.tipo_usuario !== 'adm') {
        return res.status(403).json({ erro: "Acesso negado." });
      }

      const { data: campanhas, error: dbError } = await supabaseAdmin
        .from("campanhas_email")
        .select("*")
        .order("criado_em", { ascending: false });

      if (dbError) throw dbError;

      return res.json({ campanhas });
    } catch (err) {
      console.error("Erro ao buscar campanhas:", err);
      return res.status(500).json({ erro: "Erro ao buscar histórico." });
    }
  }

  if (req.method === "POST") {
    // 2. Cria nova campanha (imediata ou agendada)
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ erro: "Não autorizado" });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ erro: "Token inválido" });
      }

      // Verifica se é admin
      const { data: adminData } = await supabaseAdmin
        .from('empresa_usuarios')
        .select('empresas(tipo_usuario)')
        .eq('auth_user_id', user.id)
        .single();

      if (!adminData || adminData.empresas?.tipo_usuario !== 'adm') {
        return res.status(403).json({ erro: "Acesso negado." });
      }

      const { assunto, corpoHtml, filtro, agendadoPara } = req.body;

      if (!assunto || !corpoHtml || !filtro) {
        return res.status(400).json({ erro: "Dados incompletos." });
      }

      const status = agendadoPara ? 'agendado' : 'rascunho'; // Se não agendado, salvamos como rascunho primeiro para enviar.

      // Cria a campanha no banco
      const { data: campanha, error: insertError } = await supabaseAdmin
        .from("campanhas_email")
        .insert({
          assunto,
          corpo_html: corpoHtml,
          filtro,
          agendado_para: agendadoPara || null,
          status: status,
          criado_por: user.id
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Se for agendado, apenas retorna. O cron cuidará do envio.
      if (agendadoPara) {
        return res.json({ sucesso: true, mensagem: "Campanha agendada com sucesso!", id: campanha.id });
      }

      // --- Envio Imediato ---
      
      // Busca destinatários com base no filtro
      let emailsDestino = [];
      let query = supabaseAdmin
        .from('empresas')
        .select('email, razao_social, empresa_usuarios(email, nome)')
        .neq('tipo_usuario', 'adm'); // Nunca enviar para admins

      if (filtro.tipo === 'tipo_acesso' && filtro.valores.length > 0) {
        query = query.in('tipo_acesso', filtro.valores);
      } else if (filtro.tipo === 'empresa' && filtro.valores.length > 0) {
        query = query.in('id', filtro.valores);
      }

      const { data: empresasData, error: qError } = await query;
      
      if (qError) throw qError;

      // Compila lista única de e-mails
      const emailSet = new Set();
      
      empresasData.forEach(emp => {
        if (emp.email) emailSet.add(emp.email);
        if (emp.empresa_usuarios && emp.empresa_usuarios.length > 0) {
          emp.empresa_usuarios.forEach(eu => {
            if (eu.email) emailSet.add(eu.email);
          });
        }
      });

      // Lógica para filtro por usuário (filtra os emails compilados, ou busca apenas eles)
      // Como o design simplificado acima pegou todos das empresas, vamos refinar se for usuário
      if (filtro.tipo === 'usuario' && filtro.valores.length > 0) {
        emailSet.clear(); // Limpa e busca especificamente
        const { data: usuariosData, error: uError } = await supabaseAdmin
          .from('empresa_usuarios')
          .select('email')
          .in('auth_user_id', filtro.valores);
          
        if (!uError && usuariosData) {
          usuariosData.forEach(u => {
            if (u.email) emailSet.add(u.email);
          });
        }
      }

      emailsDestino = Array.from(emailSet);

      if (emailsDestino.length === 0) {
        // Marca como erro/cancelada por falta de destino
        await supabaseAdmin.from("campanhas_email").update({ status: 'erro' }).eq('id', campanha.id);
        return res.status(400).json({ erro: "Nenhum destinatário encontrado para o filtro." });
      }

      // Atualiza status para enviando
      await supabaseAdmin.from("campanhas_email").update({ status: 'enviando' }).eq('id', campanha.id);

      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const SMTP_HOST = process.env.SMTP_HOST;
      const SMTP_PORT = process.env.SMTP_PORT;
      const SMTP_USER = process.env.SMTP_USER;
      const SMTP_PASS = process.env.SMTP_PASS;

      const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${corpoHtml}
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
            <p>Você está recebendo este e-mail pois está cadastrado na plataforma Diversidade.io</p>
          </div>
        </div>
      `;

      let sentCount = 0;
      let hasError = false;

      if (RESEND_API_KEY) {
        const resend = new Resend(RESEND_API_KEY);
        const BATCH_SIZE = 100;
        for (let i = 0; i < emailsDestino.length; i += BATCH_SIZE) {
          const batch = emailsDestino.slice(i, i + BATCH_SIZE);
          const emailRequests = batch.map(email => ({
            from: "Diversidade.io <nao-responder@diversidade.io>",
            to: [email],
            subject: assunto,
            html: htmlTemplate,
          }));

          const { data, error } = await resend.batch.send(emailRequests);
          if (error) {
            console.error(`Erro no lote ${i}:`, error);
            hasError = true;
          } else {
            sentCount += batch.length;
          }
        }
      } else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        const nodemailer = (await import("nodemailer")).default;
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT) || 587,
          secure: Number(SMTP_PORT) === 465,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
        });

        const BATCH_SIZE = 50;
        for (let i = 0; i < emailsDestino.length; i += BATCH_SIZE) {
          const batch = emailsDestino.slice(i, i + BATCH_SIZE);
          try {
            await transporter.sendMail({
              from: `"Diversidade.io" <${SMTP_USER}>`,
              bcc: batch,
              subject: assunto,
              html: htmlTemplate,
            });
            sentCount += batch.length;
          } catch (error) {
             console.error(`Erro no nodemailer lote ${i}:`, error);
             hasError = true;
          }
        }
      } else {
        console.warn("[Simulação de Envio E-mail Marketing]", { emailsDestino, assunto });
        await supabaseAdmin.from("campanhas_email").update({ 
          status: 'enviado', 
          total_envios: emailsDestino.length,
          enviado_em: new Date().toISOString()
        }).eq('id', campanha.id);
        return res.json({ sucesso: true, mensagem: `Simulação: ${emailsDestino.length} e-mails enviados.` });
      }

      await supabaseAdmin.from("campanhas_email").update({ 
        status: hasError && sentCount === 0 ? 'erro' : 'enviado',
        total_envios: sentCount,
        enviado_em: new Date().toISOString()
      }).eq('id', campanha.id);

      return res.json({ 
        sucesso: true, 
        mensagem: `${sentCount} e-mails enviados.`,
        totalEnviados: sentCount
      });

    } catch (err) {
      console.error("Erro no endpoint POST /api/email-marketing:", err);
      return res.status(500).json({ erro: "Erro interno do servidor." });
    }
  }

  return res.status(405).json({ erro: "Método não permitido." });
}
