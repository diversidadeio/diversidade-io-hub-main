/**
 * Garante que cada funcao serverless em `api/` carrega sob o resolvedor ESM
 * do Node — o mesmo que a Vercel usa, porque o package.json declara
 * "type": "module" e o runtime transpila cada arquivo sem fazer bundle.
 *
 * Em ESM, `import x from "./_auth"` (relativo, sem extensao) lanca
 * ERR_MODULE_NOT_FOUND ao carregar o modulo. Na Vercel isso aparece como
 * FUNCTION_INVOCATION_FAILED / 500 antes de o handler rodar, e nao e pego
 * pelo `tsc --noEmit` nem pelo dev server (que usa server/api.ts, um router
 * Express paralelo).
 *
 * A importacao roda em um subprocesso `node` de proposito: dentro do vitest o
 * `import()` passa pelo Vite, que completa extensoes sozinho e esconderia
 * justamente o erro que este teste existe para pegar.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { transform } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raizProjeto = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dirApi = join(raizProjeto, "api");
// Dentro do projeto para que os bare specifiers (@supabase/supabase-js, openai,
// resend) resolvam pelo node_modules da raiz, como na Vercel.
const dirSaida = join(raizProjeto, ".tmp-esm-check");

async function arquivosDeApi() {
  const nomes = await readdir(dirApi);
  return nomes.filter((n) => [".ts", ".js"].includes(extname(n)));
}

/** Carrega o modulo no resolvedor nativo do Node, como a Vercel faz. */
function carregarComNode(arquivo: string) {
  const url = pathToFileURL(arquivo).href;
  const script = `const m = await import(${JSON.stringify(url)});
if (typeof m.default !== "function") { console.error("sem export default handler"); process.exit(3); }`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    cwd: raizProjeto,
  });
}

beforeAll(async () => {
  await rm(dirSaida, { recursive: true, force: true });
  await mkdir(dirSaida, { recursive: true });

  for (const nome of await arquivosDeApi()) {
    const fonte = await readFile(join(dirApi, nome), "utf8");
    const { code } = await transform(fonte, {
      loader: extname(nome) === ".ts" ? "ts" : "js",
      format: "esm",
      target: "node20",
    });
    await writeFile(join(dirSaida, basename(nome, extname(nome)) + ".js"), code);
  }
}, 60_000);

afterAll(async () => {
  await rm(dirSaida, { recursive: true, force: true });
});

describe("funcoes serverless em api/", () => {
  it("existem para testar", async () => {
    expect((await arquivosDeApi()).length).toBeGreaterThan(0);
  });

  it.each([
    "logs",
    "presence",
    "registrar-log",
    "busca-ia",
    "historico-buscas-ia",
    "verificar-cnpj",
    "verificar-email",
    "usuarios",
    "atualizar-cnaes",
    "enviar-email-aprovacao",
    "recuperar-senha",
  ])("api/%s carrega sob o resolvedor ESM e exporta um handler", (nome) => {
    const r = carregarComNode(join(dirSaida, nome + ".js"));
    expect(r.stderr || "", `api/${nome} nao carregou:\n${r.stderr}`).not.toMatch(
      /ERR_MODULE_NOT_FOUND|Cannot find module/,
    );
    expect(r.status, `api/${nome} falhou ao carregar:\n${r.stderr}`).toBe(0);
  }, 30_000);
});
