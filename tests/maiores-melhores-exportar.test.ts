import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
vi.mock("xlsx", async (original) => ({ ...(await original<typeof import("xlsx")>()), writeFile: vi.fn() }));

import { exportarEdicaoXlsx } from "../client/src/components/adm/maiores-melhores/exportarMm";
import type { MmEmpresa, MmEvento } from "../client/src/lib/maioresMelhores";

const evento: MmEvento = { id: "ev", ano: 2026, titulo: "2026", descricao: null, inicio_cadastro: "2026-11-19", fim_cadastro: "2026-12-03" };
const empresa: MmEmpresa = {
  id: "e1",
  evento_id: "ev",
  categoria: "afro",
  porte: "MEI",
  razao_social: "POMARTECH LTDA",
  cnpj: "41596417000146",
  responsavel: "Ana Souza",
  email: "ana@exemplo.com",
  municipio: "São Carlos",
  uf: "SP",
  socios: [
    { nome: "Ana Souza", declaracao: "preta_parda", foto_path: "fotos/a.jpg", foto_autorizada: true },
    { nome: "Beto Lima", declaracao: "preta_parda" },
  ],
  criado_em: "2026-11-20T17:17:45Z",
};

describe("exportarEdicaoXlsx", () => {
  it("inclui sócios com foto autorizada e link clicável", async () => {
    const escrita = vi.mocked(XLSX.writeFile);
    escrita.mockClear();
    await exportarEdicaoXlsx(evento, [empresa], [], [], new Map([["fotos/a.jpg", "https://x.test/a.jpg?token=1"]]));
    const livro = escrita.mock.calls[0][0] as XLSX.WorkBook;
    expect(livro.SheetNames).toEqual(["Empresas", "Sócios", "Negócios", "Participantes"]);

    const linhas = XLSX.utils.sheet_to_json<Record<string, string>>(livro.Sheets["Empresas"]);
    expect(linhas[0]["Sócio 1 - Nome"]).toBe("Ana Souza");
    expect(linhas[0]["Sócio 1 - Foto autorizada"]).toBe("Sim");
    expect(linhas[0]["Sócio 2 - Foto autorizada"]).toBe("");
    expect(linhas[0]["Sócio 2 - Foto (link)"]).toBe("");

    const socios = livro.Sheets["Sócios"];
    const cabecalhos = XLSX.utils.sheet_to_json<string[]>(socios, { header: 1 })[0];
    const coluna = cabecalhos.indexOf("Foto (link)");
    expect(socios[XLSX.utils.encode_cell({ r: 1, c: coluna })].l?.Target).toBe("https://x.test/a.jpg?token=1");
  });
});
