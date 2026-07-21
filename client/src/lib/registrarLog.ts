/**
 * registrarLog.ts
 *
 * Função utilitária para registrar eventos de auditoria na plataforma.
 * Chama o endpoint /api/registrar-log do servidor, que captura IP e user-agent
 * e insere o registro na tabela logs_acesso via RPC segura.
 *
 * Nunca lança exceção — logs nunca devem bloquear a interface do usuário.
 */

export interface DadosLog {
  /** Tipo do evento (ex: 'login_sucesso', 'adm_aprovar_empresa') */
  tipo_evento: string;
  /** E-mail do usuário que executou a ação */
  email?: string;
  /** ID da empresa alvo (quando o evento se refere a uma empresa) */
  empresa_id?: string;
  /** Nome da empresa alvo para facilitar exibição sem JOIN */
  nome_empresa?: string;
  /** E-mail do admin executor (para eventos adm_*) */
  executor_adm_email?: string;
  /** Informações extras em texto livre (ex: termo buscado, e-mail convidado) */
  detalhes?: string;
}

export async function registrarLog(dados: DadosLog): Promise<void> {
  try {
    await fetch('/api/registrar-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
  } catch {
    // Silencia erros — o log nunca deve impedir o fluxo principal
  }
}
