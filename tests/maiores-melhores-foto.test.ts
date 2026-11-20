import { afterEach, describe, expect, it, vi } from "vitest";
import { type DependenciasFotoMm, tratarFotoMm } from "../api/_maioresMelhoresFoto";

const TOKEN = "ab".repeat(32);
const EMPRESA = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const CAMINHO = "fotos/5f6771cb-d3ed-431e-a648-32a48eab3a73.jpg";
const URL_ASSINADA = "https://exemplo.supabase.co/storage/v1/object/sign/maiores-melhores/x?token=t";

function resposta() {
  const r: any = { statusCode: 200, corpo: undefined, cabecalhos: {} as Record<string, string> };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (c: unknown) => { r.corpo = c; return r; };
  r.setHeader = (k: string, v: string) => { r.cabecalhos[k] = v; };
  return r as { statusCode: number; corpo: any; cabecalhos: Record<string, string>; status: any; json: any; setHeader: any };
}

function dependencias(parcial: Partial<DependenciasFotoMm> = {}) {
  const deps = {
    caminhoDaFoto: vi.fn().mockResolvedValue(CAMINHO),
    assinar: vi.fn().mockResolvedValue(URL_ASSINADA),
    ...parcial,
  } satisfies DependenciasFotoMm;
  return deps;
}

const pedido = (corpo: unknown, method = "POST") => ({ method, body: corpo });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/maiores-melhores-foto", () => {
  it("só aceita POST e nunca fica em cache", async () => {
    const r = resposta();
    await tratarFotoMm(pedido({}, "GET"), r, dependencias());
    expect(r.statusCode).toBe(405);
    expect(r.cabecalhos["Cache-Control"]).toBe("private, no-store");
  });

  it("recusa pedido mal formado sem consultar o banco", async () => {
    const deps = dependencias();
    const invalidos = [
      {},
      { token: "curto", empresa_id: EMPRESA, indice: 0 },
      { token: TOKEN, empresa_id: "não-é-uuid", indice: 0 },
      { token: TOKEN, empresa_id: EMPRESA, indice: -1 },
      { token: TOKEN, empresa_id: EMPRESA, indice: 100 },
      { token: TOKEN, empresa_id: EMPRESA, indice: "0" },
      { token: TOKEN, empresa_id: EMPRESA, indice: 1.5 },
      { token: TOKEN, empresa_id: EMPRESA },
    ];
    for (const corpo of invalidos) {
      const r = resposta();
      await tratarFotoMm(pedido(corpo), r, deps);
      expect(r.statusCode, JSON.stringify(corpo)).toBe(400);
    }
    expect(deps.caminhoDaFoto).not.toHaveBeenCalled();
  });

  it("devolve só o link temporário, nunca o caminho do arquivo", async () => {
    const deps = dependencias();
    const r = resposta();
    await tratarFotoMm(pedido({ token: TOKEN, empresa_id: EMPRESA, indice: 1 }), r, deps);
    expect(r.statusCode).toBe(200);
    expect(r.corpo).toEqual({ url: URL_ASSINADA });
    expect(JSON.stringify(r.corpo)).not.toContain(CAMINHO);
    expect(deps.caminhoDaFoto).toHaveBeenCalledWith(TOKEN, EMPRESA, 1);
    expect(deps.assinar).toHaveBeenCalledWith(CAMINHO);
  });

  it("aceita o corpo como texto JSON", async () => {
    const r = resposta();
    await tratarFotoMm(pedido(JSON.stringify({ token: TOKEN, empresa_id: EMPRESA, indice: 0 })), r, dependencias());
    expect(r.statusCode).toBe(200);
  });

  it("sócio sem foto → 404 e não assina nada", async () => {
    const deps = dependencias({ caminhoDaFoto: vi.fn().mockResolvedValue(null) });
    const r = resposta();
    await tratarFotoMm(pedido({ token: TOKEN, empresa_id: EMPRESA, indice: 2 }), r, deps);
    expect(r.statusCode).toBe(404);
    expect(deps.assinar).not.toHaveBeenCalled();
  });

  it("sessão inválida no banco (28000) → 401", async () => {
    const deps = dependencias({ caminhoDaFoto: vi.fn().mockRejectedValue({ code: "28000", message: "Sua sessão expirou." }) });
    const r = resposta();
    await tratarFotoMm(pedido({ token: TOKEN, empresa_id: EMPRESA, indice: 0 }), r, deps);
    expect(r.statusCode).toBe(401);
    expect(deps.assinar).not.toHaveBeenCalled();
  });

  it("falha do banco ou do armazenamento → 500 sem vazar detalhes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const parcial of [
      { caminhoDaFoto: vi.fn().mockRejectedValue(new Error("senha do banco: segredo")) },
      { assinar: vi.fn().mockRejectedValue(new Error("bucket interno xyz")) },
    ]) {
      const r = resposta();
      await tratarFotoMm(pedido({ token: TOKEN, empresa_id: EMPRESA, indice: 0 }), r, dependencias(parcial));
      expect(r.statusCode).toBe(500);
      expect(JSON.stringify(r.corpo)).not.toMatch(/segredo|xyz/);
    }
  });

  it("link não gerado pelo armazenamento → 404", async () => {
    const r = resposta();
    await tratarFotoMm(pedido({ token: TOKEN, empresa_id: EMPRESA, indice: 0 }), r, dependencias({ assinar: vi.fn().mockResolvedValue(null) }));
    expect(r.statusCode).toBe(404);
  });

  it("sem service_role configurada responde 500", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = resposta();
    await tratarFotoMm(pedido({ token: TOKEN, empresa_id: EMPRESA, indice: 0 }), r);
    expect(r.statusCode).toBe(500);
  });
});
