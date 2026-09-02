import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Este endpoint será chamado pelo Vercel Cron (ver vercel.json)
export default async function handler(req, res) {
  // Autenticação para cron job da Vercel (recomendado)
  const authHeader = req.headers.authorization;
  if (
    process.env.CRON_SECRET && 
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  try {
    const agora = new Date().toISOString();

    // 1. Busca campanhas agendadas cuja data já passou
    const { data: campanhas, error: dbError } = await supabaseAdmin
      .from("campanhas_email")
      .select("*")
      .eq("status", "agendado")
      .lte("agendado_para", agora);

    if (dbError) throw dbError;

    if (!campanhas || campanhas.length === 0) {
      return res.status(200).json({ mensagem: "Nenhuma campanha pendente." });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
    let resultados = [];

    // 2. Processa cada campanha agendada
    for (const campanha of campanhas) {
      // Atualiza para 'enviando'
      await supabaseAdmin.from("campanhas_email").update({ status: 'enviando' }).eq('id', campanha.id);

      const filtro = campanha.filtro;
      let emailsDestino = [];
      
      // -- Lógica de busca de emails (igual ao endpoint principal) --
      let query = supabaseAdmin
        .from('empresas')
        .select('email, razao_social, empresa_usuarios(email, nome)')
        .neq('tipo_usuario', 'adm');

      if (filtro.tipo === 'tipo_acesso' && filtro.valores.length > 0) {
        query = query.in('tipo_acesso', filtro.valores);
      } else if (filtro.tipo === 'empresa' && filtro.valores.length > 0) {
        query = query.in('id', filtro.valores);
      }

      const { data: empresasData, error: qError } = await query;
      
      if (!qError) {
        const emailSet = new Set();
        empresasData.forEach(emp => {
          if (emp.email) emailSet.add(emp.email);
          if (emp.empresa_usuarios && emp.empresa_usuarios.length > 0) {
            emp.empresa_usuarios.forEach(eu => {
              if (eu.email) emailSet.add(eu.email);
            });
          }
        });

        if (filtro.tipo === 'usuario' && filtro.valores.length > 0) {
          emailSet.clear(); 
          const { data: usuariosData } = await supabaseAdmin
            .from('empresa_usuarios')
            .select('email')
            .in('auth_user_id', filtro.valores);
            
          if (usuariosData) {
            usuariosData.forEach(u => {
              if (u.email) emailSet.add(u.email);
            });
          }
        }
        emailsDestino = Array.from(emailSet);
      }

      if (emailsDestino.length === 0) {
        await supabaseAdmin.from("campanhas_email").update({ status: 'erro' }).eq('id', campanha.id);
        resultados.push({ id: campanha.id, status: 'erro', motivo: 'Sem destinatários' });
        continue;
      }

      // -- Envio --
      if (!resend) {
        await supabaseAdmin.from("campanhas_email").update({ 
          status: 'enviado', 
          total_envios: emailsDestino.length,
          enviado_em: new Date().toISOString()
        }).eq('id', campanha.id);
        resultados.push({ id: campanha.id, status: 'simulado', total: emailsDestino.length });
        continue;
      }

      const BATCH_SIZE = 100;
      let sentCount = 0;
      let hasError = false;

      const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${campanha.corpo_html}
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
            <p>Você está recebendo este e-mail pois está cadastrado na plataforma Diversidade.io</p>
          </div>
        </div>
      `;

      for (let i = 0; i < emailsDestino.length; i += BATCH_SIZE) {
        const batch = emailsDestino.slice(i, i + BATCH_SIZE);
        const emailRequests = batch.map(email => ({
          from: "Diversidade.io <nao-responder@diversidade.io>",
          to: [email],
          subject: campanha.assunto,
          html: htmlTemplate,
        }));

        const { error } = await resend.batch.send(emailRequests);

        if (error) {
          hasError = true;
        } else {
          sentCount += batch.length;
        }
      }

      await supabaseAdmin.from("campanhas_email").update({ 
        status: hasError && sentCount === 0 ? 'erro' : 'enviado',
        total_envios: sentCount,
        enviado_em: new Date().toISOString()
      }).eq('id', campanha.id);

      resultados.push({ id: campanha.id, status: 'enviado', total: sentCount });
    }

    return res.status(200).json({ sucesso: true, processados: resultados });
  } catch (error) {
    console.error("Erro no processamento do cron:", error);
    return res.status(500).json({ erro: "Erro interno no processamento agendado." });
  }
}
