import { afterEach, describe, expect, it, vi } from "vitest";
import { type DependenciasInscricaoMm, tratarInscricaoMm } from "../api/_maioresMelhoresInscricao";

const TOKEN = "ab".repeat(32);
const FOTO_A = "fotos/5f6771cb-d3ed-431e-a648-32a48eab3a73.jpg";
const FOTO_B = "fotos/11111111-1111-1111-1111-111111111111.png";
const dados = { categoria: "afro", porte: "MEI", razao_social: "Afro Ltda", socios: [{ nome: "Ana", declaracao: "preta_parda" }] };

function resposta() {
  const r: any = { statusCode: 200, corpo: undefined, cabecalhos: {} as Record<string, string> };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (c: unknown) => { r.corpo = c; return r; };
  r.setHeader = (k: string, v: string) => { r.cabecalhos[k] = v; };
  return r as { statusCode: number; corpo: any; cabecalhos: Record<string, string>; status: any; json: any; setHeader: any };
}

function dependencias(parcial: Partial<DependenciasInscricaoMm> = {}) {
  return {
    atualizar: vi.fn().mockResolvedValue({ ok: true, fotos_removidas: [] }),
    removerFotos: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  } satisfies DependenciasInscricaoMm;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/maiores-melhores-inscricao", () => {
  it("só aceita POST e nunca fica em cache", async () => {
    const r = resposta();
    await tratarInscricaoMm({ method: "GET" }, r, dependencias());
    expect(r.statusCode).toBe(405);
    expect(r.cabecalhos["Cache-Control"]).toBe("private, no-store");
  });

  it("recusa pedido mal formado sem tocar no banco", async () => {
    const deps = dependencias();
    const grande = { ...dados, descricao: "x".repeat(61_000) };
    for (const corpo of [{}, { token: "curto", dados }, { token: TOKEN }, { token: TOKEN, dados: "texto" }, { token: TOKEN, dados: [dados] }, { token: TOKEN, dados: grande }]) {
      const r = resposta();
      await tratarInscricaoMm({ method: "POST", body: corpo }, r, deps);
      expect(r.statusCode, JSON.stringify(corpo).slice(0, 60)).toBe(400);
    }
    expect(deps.atualizar).not.toHaveBeenCalled();
  });

  it("grava a edição e responde ok (corpo como objeto ou como texto)", async () => {
    const deps = dependencias();
    for (const body of [{ token: TOKEN, dados }, JSON.stringify({ token: TOKEN, dados })]) {
      const r = resposta();
      await tratarInscricaoMm({ method: "POST", body }, r, deps);
      expect(r.statusCode).toBe(200);
      expect(r.corpo).toEqual({ ok: true });
    }
    expect(deps.atualizar).toHaveBeenCalledWith(TOKEN, dados);
    expect(deps.removerFotos).not.toHaveBeenCalled();
  });

  it("apaga do armazenamento as fotos que saíram da inscrição", async () => {
    const deps = dependencias({ atualizar: vi.fn().mockResolvedValue({ ok: true, fotos_removidas: [FOTO_A, FOTO_B] }) });
    const r = resposta();
    await tratarInscricaoMm({ method: "POST", body: { token: TOKEN, dados } }, r, deps);
    expect(r.statusCode).toBe(200);
    expect(deps.removerFotos).toHaveBeenCalledWith([FOTO_A, FOTO_B]);
  });

  it("só apaga caminhos no formato que o sistema gera (defesa em profundidade)", async () => {
    const deps = dependencias({
      atualizar: vi.fn().mockResolvedValue({ ok: true, fotos_removidas: [FOTO_A, "../../outro-bucket/x.jpg", "fotos/x.jpg", "usuarios/abc/foto.png"] }),
    });
    await tratarInscricaoMm({ method: "POST", body: { token: TOKEN, dados } }, resposta(), deps);
    expect(deps.removerFotos).toHaveBeenCalledWith([FOTO_A]);
  });

  it("falha ao apagar a foto antiga não desfaz a edição já gravada", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = dependencias({
      atualizar: vi.fn().mockResolvedValue({ ok: true, fotos_removidas: [FOTO_A] }),
      removerFotos: vi.fn().mockRejectedValue(new Error("storage fora")),
    });
    const r = resposta();
    await tratarInscricaoMm({ method: "POST", body: { token: TOKEN, dados } }, r, deps);
    expect(r.statusCode).toBe(200);
    expect(erro).toHaveBeenCalled();
  });

  it("regra do banco (P0001) volta como 400 com a mensagem para a pessoa", async () => {
    const deps = dependencias({ atualizar: vi.fn().mockRejectedValue({ code: "P0001", message: "Não é possível mudar a categoria depois de registrar negócios." }) });
    const r = resposta();
    await tratarInscricaoMm({ method: "POST", body: { token: TOKEN, dados } }, r, deps);
    expect(r.statusCode).toBe(400);
    expect(r.corpo).toEqual({ erro: "Não é possível mudar a categoria depois de registrar negócios." });
    expect(deps.removerFotos).not.toHaveBeenCalled();
  });

  it("sessão inválida (28000) → 401", async () => {
    const deps = dependencias({ atualizar: vi.fn().mockRejectedValue({ code: "28000", message: "Sua sessão expirou." }) });
    const r = resposta();
    await tratarInscricaoMm({ method: "POST", body: { token: TOKEN, dados } }, r, deps);
    expect(r.statusCode).toBe(401);
  });

  it("outros erros → 500 genérico, sem vazar detalhes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = dependencias({ atualizar: vi.fn().mockRejectedValue({ code: "23505", message: "duplicate key value violates unique constraint mm_empresas_cnpj" }) });
    const r = resposta();
    await tratarInscricaoMm({ method: "POST", body: { token: TOKEN, dados } }, r, deps);
    expect(r.statusCode).toBe(500);
    expect(JSON.stringify(r.corpo)).not.toMatch(/duplicate|mm_empresas/);
  });

  it("sem service_role configurada responde 500", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = resposta();
    await tratarInscricaoMm({ method: "POST", body: { token: TOKEN, dados } }, r);
    expect(r.statusCode).toBe(500);
  });
});
