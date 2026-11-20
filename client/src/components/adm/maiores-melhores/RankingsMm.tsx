import { CATEGORIAS, type PerfilParceiro, type Ranking, formatarMoeda } from "@/lib/maioresMelhores";

/** Como o recorte aparece no título do ranking. */
const COM_PERFIL: Record<PerfilParceiro, string> = {
  afro: "com empresas lideradas por pessoas negras",
  media: "com médias empresas inclusivas",
  grande: "com grandes empresas inclusivas",
};

export function RankingsMm({ rankings }: { rankings: Ranking[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {rankings.map((r) => (
        <article key={`${r.categoria}-${r.perfil ?? "geral"}-${r.metrica}`} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#7030A0]">{CATEGORIAS[r.categoria]}</p>
          <h3 className={`text-lg font-bold text-gray-900 ${r.perfil ? "" : "mb-3"}`}>
            {r.metrica === "parceiros" ? "Mais parceiros" : "Maior valor negociado"}
          </h3>
          {r.perfil && <p className="text-sm text-gray-600 mb-3">{COM_PERFIL[r.perfil]}</p>}
          {!r.linhas.length ? (
            <p className="text-sm text-gray-500">Aguardando negócios validados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2 pr-2 font-medium">Pos.</th>
                    <th className="py-2 pr-2 font-medium">Empresa</th>
                    <th className="py-2 font-medium text-right">{r.metrica === "parceiros" ? "Parceiros" : "Valor"}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.linhas.map((l) => (
                    <tr key={l.empresaId} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-2 font-semibold text-gray-900">{l.posicao}º</td>
                      <td className="py-2 pr-2 text-gray-800">{l.razaoSocial}</td>
                      <td className="py-2 text-right font-medium whitespace-nowrap">
                        {r.metrica === "parceiros" ? l.pontuacao : formatarMoeda(l.pontuacao)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
