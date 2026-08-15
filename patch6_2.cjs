const fs = require('fs');

const filePath = 'client/src/pages/usuario/Pesquisas.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const interfaceFiltrosState = `interface FiltrosState {
  portes: string[];
  completude: CompletudeFiltro;
  ordenacao: OrdenacaoFiltro;
  etariedade_60: boolean;
  racas: string[];
  sexos: string[];
}`;

const filtrosPadrao = `const FILTROS_PADRAO: FiltrosState = {
  portes: [],
  completude: "todos",
  ordenacao: "recentes",
  etariedade_60: false,
  racas: [],
  sexos: [],
};`;

const optionsArrays = `
const RACAS_DISPONIVEIS = ["Pardo", "Preto", "Branco", "Amarelo", "Indígena", "Outro"];
const SEXOS_DISPONIVEIS = ["Masculino", "Feminino", "Outro", "Prefiro não declarar"];
`;

// Replace FiltrosState
content = content.replace(/interface FiltrosState \{[^}]+\}/, interfaceFiltrosState);
// Replace FILTROS_PADRAO
content = content.replace(/const FILTROS_PADRAO: FiltrosState = \{[^}]+\};/, filtrosPadrao);

// Insert the arrays after PORTES_DISPONIVEIS
content = content.replace(/const PORTES_DISPONIVEIS = \[.*?\];/, `const PORTES_DISPONIVEIS = ["MEI", "ME", "MICRO", "EPP", "Média Empresa", "Grande Empresa"];${optionsArrays}`);

// Update `select` query for socios and also use supabaseAnon!
content = content.replace(/const \{ data: sociosData \} = await supabase\n          \.from\("socios"\)\n          \.select\("empresa_id, nome, cpf, email, cep, data_nascimento, nacionalidade, raca, participacao_percentual, participacao_valor"\);/, `const { data: sociosData } = await supabaseAnon
          .from("socios")
          .select("empresa_id, nome, cpf, email, cep, data_nascimento, nacionalidade, raca, sexo, etariedade, participacao_percentual, participacao_valor");`);

// Add isIncentivadora state
content = content.replace(/const \[cadastros, setCadastros\] = useState<any\[\]>\(\[\]\);/, `const [cadastros, setCadastros] = useState<any[]>([]);
  const [isIncentivadora, setIsIncentivadora] = useState(false);

  useEffect(() => {
    async function checkIncentivadora() {
        if (!usuario) return;
        const { data } = await supabase.from('empresas').select('acesso_tipo').eq('id', (usuario as any).empresaId).single();
        if (data?.acesso_tipo && data.acesso_tipo.toUpperCase().includes('EMPRESA OU INICIATIVA INCENTIVADORA')) {
            setIsIncentivadora(true);
        }
    }
    checkIncentivadora();
  }, [usuario]);`);


// Update cadastrosFiltrados
const matchStr = `const listaSocios = socios[emp.id] || [];
      const completude = calcularCompletude(emp, listaSocios);
      const matchCompletude =
        filtrosAtivos.completude === "todos" ||
        (filtrosAtivos.completude === "completo" && completude === 100) ||
        (filtrosAtivos.completude === "incompleto" && completude < 100);

      const matchEtariedade =
        !filtrosAtivos.etariedade_60 ||
        listaSocios.some((s: any) => {
          const e = parseInt(s.etariedade);
          return !isNaN(e) && e >= 60;
        });

      const matchRaca =
        filtrosAtivos.racas.length === 0 ||
        listaSocios.some((s: any) => filtrosAtivos.racas.includes(s.raca));

      const matchSexo =
        filtrosAtivos.sexos.length === 0 ||
        listaSocios.some((s: any) => s.sexo && filtrosAtivos.sexos.some((fs: string) => s.sexo.startsWith(fs)));

      return matchBusca && matchPorte && matchCompletude && matchEtariedade && matchRaca && matchSexo;`;

content = content.replace(/const listaSocios = socios\[emp\.id\] \|\| \[\];[\s\S]*?return matchBusca && matchPorte && matchCompletude;/, matchStr);


// Update qtdFiltrosAtivos
const qtdStr = `let count = 0;
    if (filtrosAtivos.portes.length > 0) count++;
    if (filtrosAtivos.completude !== "todos") count++;
    if (filtrosAtivos.ordenacao !== "recentes") count++;
    if (filtrosAtivos.etariedade_60) count++;
    if (filtrosAtivos.racas.length > 0) count++;
    if (filtrosAtivos.sexos.length > 0) count++;
    return count;`;

content = content.replace(/let count = 0;[\s\S]*?return count;/, qtdStr);


// Update removerFiltro
const removerStr = `setFiltrosAtivos((prev) => {
      const next: any = { ...prev };
      if (chave === "portes" || chave === "racas" || chave === "sexos") next[chave] = [];
      else if (chave === "etariedade_60") next[chave] = false;
      else if (chave === "ordenacao") next[chave] = "recentes";
      else if (chave === "completude") next[chave] = "todos";
      return next as FiltrosState;
    });`;

content = content.replace(/setFiltrosAtivos\(\(prev\) => \(\{[\s\S]*?\}\)\);/, removerStr);


// Update tagsFiltros
const tagsStr = `if (filtrosAtivos.ordenacao !== "recentes") {
    const labels: Record<string, string> = { antigos: "Mais antigos", nome_az: "Nome A→Z", nome_za: "Nome Z→A" };
    tagsFiltros.push({ label: \`Ordem: \${labels[filtrosAtivos.ordenacao]}\`, chave: "ordenacao" });
  }
  if (filtrosAtivos.etariedade_60) tagsFiltros.push({ label: "Sócios 60+", chave: "etariedade_60" });
  if (filtrosAtivos.racas.length > 0) tagsFiltros.push({ label: \`Raça: \${filtrosAtivos.racas.join(", ")}\`, chave: "racas" });
  if (filtrosAtivos.sexos.length > 0) tagsFiltros.push({ label: \`Sexo: \${filtrosAtivos.sexos.join(", ")}\`, chave: "sexos" });`;

content = content.replace(/if \(filtrosAtivos\.ordenacao !== "recentes"\) \{[\s\S]*?chave: "ordenacao" \}\);\n  \}/, tagsStr);

// UI For Filters
const uiFiltersStr = `
            {/* Filtro: Sócios 60+ */}
            {isIncentivadora && (
              <>
                <Separator className="dark:border-gray-700" />
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Perfil dos Sócios</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filtro-etariedade"
                      checked={filtrosTemp.etariedade_60}
                      onCheckedChange={(checked) =>
                        setFiltrosTemp((prev) => ({ ...prev, etariedade_60: !!checked }))
                      }
                    />
                    <Label htmlFor="filtro-etariedade" className="text-gray-700 dark:text-gray-300 font-normal">
                      Ter alguém 60+ (Etariedade)
                    </Label>
                  </div>

                  <h5 className="font-medium text-sm text-gray-800 dark:text-gray-200 mt-4 mb-2">Raça</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {RACAS_DISPONIVEIS.map((raca) => (
                      <div key={raca} className="flex items-center space-x-2">
                        <Checkbox
                          id={\`filtro-raca-\${raca}\`}
                          checked={filtrosTemp.racas.includes(raca)}
                          onCheckedChange={(checked) => {
                            setFiltrosTemp((prev) => ({
                              ...prev,
                              racas: checked
                                ? [...prev.racas, raca]
                                : prev.racas.filter((r) => r !== raca),
                            }));
                          }}
                        />
                        <Label htmlFor={\`filtro-raca-\${raca}\`} className="text-gray-700 dark:text-gray-300 font-normal truncate">
                          {raca}
                        </Label>
                      </div>
                    ))}
                  </div>

                  <h5 className="font-medium text-sm text-gray-800 dark:text-gray-200 mt-4 mb-2">Sexo</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {SEXOS_DISPONIVEIS.map((sexo) => (
                      <div key={sexo} className="flex items-center space-x-2">
                        <Checkbox
                          id={\`filtro-sexo-\${sexo}\`}
                          checked={filtrosTemp.sexos.includes(sexo)}
                          onCheckedChange={(checked) => {
                            setFiltrosTemp((prev) => ({
                              ...prev,
                              sexos: checked
                                ? [...prev.sexos, sexo]
                                : prev.sexos.filter((s) => s !== sexo),
                            }));
                          }}
                        />
                        <Label htmlFor={\`filtro-sexo-\${sexo}\`} className="text-gray-700 dark:text-gray-300 font-normal truncate">
                          {sexo}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
`;

content = content.replace('<DialogFooter className="flex flex-row justify-between gap-2 pt-2">', uiFiltersStr + '\n          <DialogFooter className="flex flex-row justify-between gap-2 pt-2">');

fs.writeFileSync(filePath, content);
console.log('Done!');
