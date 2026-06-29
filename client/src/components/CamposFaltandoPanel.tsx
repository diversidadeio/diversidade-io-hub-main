import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, ChevronUp, ChevronDown, X } from "lucide-react";

export interface CampoFaltando {
  /** id do elemento HTML no formulário — usado para scrollIntoView */
  id: string;
  /** Rótulo legível exibido no painel (ex: "Nome do Responsável") */
  label: string;
  /** Seção do formulário para agrupar visualmente */
  secao: string;
}

interface CamposFaltandoPanelProps {
  /** Lista de campos que ainda estão sem preenchimento */
  campos: CampoFaltando[];
}

/**
 * Agrupa os campos por seção, mantendo a ordem de inserção.
 */
function agruparPorSecao(campos: CampoFaltando[]): Map<string, CampoFaltando[]> {
  const mapa = new Map<string, CampoFaltando[]>();
  campos.forEach((campo) => {
    if (!mapa.has(campo.secao)) mapa.set(campo.secao, []);
    mapa.get(campo.secao)!.push(campo);
  });
  return mapa;
}

/**
 * Rola suavemente até o elemento alvo e aplica um destaque visual temporário.
 */
function irParaCampo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  // Destaque laranja pulsante por 2 segundos
  el.classList.add("campo-destaque-ativo");
  setTimeout(() => {
    el.classList.remove("campo-destaque-ativo");
  }, 2200);
}

/**
 * Painel flutuante de campos não preenchidos.
 *
 * - Desktop: painel fixo no canto inferior direito (280px de largura)
 * - Mobile: barra recolhível ancorada na parte inferior da tela (largura total)
 */
export function CamposFaltandoPanel({ campos }: CamposFaltandoPanelProps) {
  const [aberto, setAberto] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  /* Detecta mudança de tamanho de tela */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const atualizar = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      // Em mobile começa recolhido por padrão para não obstruir o conteúdo
      if (e.matches) setAberto(false);
    };
    atualizar(mq);
    mq.addEventListener("change", atualizar);
    return () => mq.removeEventListener("change", atualizar);
  }, []);

  const tudo_ok = campos.length === 0;
  const grupos = agruparPorSecao(campos);

  /* ── Desktop ─────────────────────────────────────────────── */
  if (!isMobile) {
    return (
      <>
        {/* Injeção de estilos de destaque — feita uma única vez via <style> */}
        <style>{`
          .campo-destaque-ativo {
            outline: 3px solid #FF9500 !important;
            outline-offset: 3px;
            border-radius: 8px;
            animation: piscar-campo 0.55s ease-in-out 4;
          }
          @keyframes piscar-campo {
            0%, 100% { outline-color: #FF9500; }
            50%       { outline-color: transparent; }
          }
        `}</style>

        <div
          style={{
            position: "fixed",
            right: "16px",
            bottom: "24px",
            width: "280px",
            zIndex: 50,
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(112, 48, 160, 0.18)",
            border: tudo_ok ? "2px solid #22c55e" : "2px solid #7030A0",
            overflow: "hidden",
            transition: "all 0.3s ease",
            background: "#ffffff",
          }}
        >
          {/* Cabeçalho clicável */}
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: tudo_ok
                ? "linear-gradient(135deg, #16a34a, #22c55e)"
                : "linear-gradient(135deg, #7030A0, #9b4dca)",
              color: "#fff",
              cursor: "pointer",
              border: "none",
              gap: "8px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px" }}>
              {tudo_ok ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertTriangle size={16} />
              )}
              {tudo_ok
                ? "✅ Tudo preenchido!"
                : `${campos.length} campo${campos.length > 1 ? "s" : ""} faltando`}
            </span>
            {aberto ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          {/* Corpo expansível */}
          {aberto && (
            <div style={{ maxHeight: "420px", overflowY: "auto", padding: "8px 0" }}>
              {tudo_ok ? (
                <p style={{ padding: "12px 14px", fontSize: "13px", color: "#16a34a", textAlign: "center" }}>
                  Todos os campos obrigatórios foram preenchidos. Você pode enviar o formulário! 🎉
                </p>
              ) : (
                Array.from(grupos.entries()).map(([secao, itens]) => (
                  <div key={secao}>
                    {/* Separador de seção */}
                    <p
                      style={{
                        padding: "6px 14px 4px",
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#7030A0",
                        borderTop: "1px solid #f0e8f8",
                        marginTop: "4px",
                      }}
                    >
                      {secao}
                    </p>
                    {itens.map((campo) => (
                      <button
                        key={campo.id}
                        type="button"
                        onClick={() => irParaCampo(campo.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "7px 14px 7px 22px",
                          fontSize: "13px",
                          color: "#374151",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background = "#f5edfc")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                        }
                      >
                        <span style={{ color: "#FF9500", fontSize: "10px" }}>●</span>
                        {campo.label}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── Mobile: barra recolhível na parte inferior ───────────── */
  return (
    <>
      <style>{`
        .campo-destaque-ativo {
          outline: 3px solid #FF9500 !important;
          outline-offset: 3px;
          border-radius: 8px;
          animation: piscar-campo 0.55s ease-in-out 4;
        }
        @keyframes piscar-campo {
          0%, 100% { outline-color: #FF9500; }
          50%       { outline-color: transparent; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          background: "#ffffff",
          borderTop: tudo_ok ? "3px solid #22c55e" : "3px solid #7030A0",
          boxShadow: "0 -4px 24px rgba(112,48,160,0.15)",
          transition: "all 0.3s ease",
        }}
      >
        {/* Tarja de cabeçalho — sempre visível */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: tudo_ok
              ? "linear-gradient(135deg, #16a34a, #22c55e)"
              : "linear-gradient(135deg, #7030A0, #9b4dca)",
            color: "#fff",
            cursor: "pointer",
            border: "none",
            gap: "8px",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px" }}>
            {tudo_ok ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            {tudo_ok
              ? "✅ Tudo preenchido!"
              : `${campos.length} campo${campos.length > 1 ? "s" : ""} faltando — toque para ver`}
          </span>
          {aberto ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {/* Corpo — expande para cima quando aberto */}
        {aberto && (
          <div style={{ maxHeight: "40vh", overflowY: "auto", padding: "8px 0" }}>
            {tudo_ok ? (
              <p style={{ padding: "12px 16px", fontSize: "13px", color: "#16a34a", textAlign: "center" }}>
                Todos os campos obrigatórios foram preenchidos. 🎉
              </p>
            ) : (
              Array.from(grupos.entries()).map(([secao, itens]) => (
                <div key={secao}>
                  <p
                    style={{
                      padding: "6px 16px 4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#7030A0",
                      borderTop: "1px solid #f0e8f8",
                      marginTop: "4px",
                    }}
                  >
                    {secao}
                  </p>
                  {itens.map((campo) => (
                    <button
                      key={campo.id}
                      type="button"
                      onClick={() => {
                        irParaCampo(campo.id);
                        // Fecha o painel após o clique em mobile para não obstruir o campo
                        setAberto(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 16px 9px 28px",
                        fontSize: "14px",
                        color: "#374151",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "background 0.15s",
                        borderBottom: "1px solid #f9f5fd",
                      }}
                    >
                      <span style={{ color: "#FF9500", fontSize: "10px", flexShrink: 0 }}>●</span>
                      {campo.label}
                    </button>
                  ))}
                </div>
              ))
            )}

            {/* Botão fechar */}
            <button
              type="button"
              onClick={() => setAberto(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                width: "100%",
                padding: "10px",
                fontSize: "12px",
                color: "#9ca3af",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                borderTop: "1px solid #f0e8f8",
              }}
            >
              <X size={12} /> Fechar
            </button>
          </div>
        )}
      </div>
    </>
  );
}
