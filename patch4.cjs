const fs = require('fs');

const path = 'client/src/pages/usuario/EmpresaDetalhes.tsx';
let content = fs.readFileSync(path, 'utf8');

const stateStr = `
  const [carregando, setCarregando] = useState(true);
  const [empresa, setEmpresa] = useState<any>(null);
  const [socios, setSocios] = useState<any[]>([]);
  const [erro, setErro] = useState("");
  const [isIncentivadora, setIsIncentivadora] = useState(false);
`;

content = content.replace(/  const \[carregando, setCarregando\] = useState\(true\);\n  const \[empresa, setEmpresa\] = useState<any>\(null\);\n  const \[erro, setErro\] = useState\(""\);/, stateStr);


const queryStr = `
        setEmpresa(emp);

        const { data: sociosData } = await supabase.from('socios').select('*').eq('empresa_id', id);
        if (sociosData) setSocios(sociosData);

        if (usuario?.empresaId) {
          const { data: userData } = await supabase.from('empresas').select('acesso_tipo').eq('id', (usuario as any).empresaId).single();
          if (userData?.acesso_tipo && userData.acesso_tipo.toUpperCase().includes('EMPRESA OU INICIATIVA INCENTIVADORA')) {
            setIsIncentivadora(true);
          }
        }
`;

content = content.replace(/        setEmpresa\(emp\);/, queryStr);


const logicAndUiStr = `
  let etariedadeTexto = "Não";
  let racas = "Não informado";
  let sexos = "Não informado";
  let nacionalidades = "Não informado";

  if (isIncentivadora && socios.length > 0) {
    const temMaior60 = socios.some((s: any) => {
      const idade = parseInt(s.etariedade);
      return !isNaN(idade) && idade >= 60;
    });
    etariedadeTexto = temMaior60 ? "Sim" : "Não";

    const racasList = Array.from(new Set(socios.map(s => s.raca).filter(Boolean)));
    if (racasList.length > 0) racas = racasList.join(", ");

    const sexosList = Array.from(new Set(socios.map(s => s.sexo).filter(Boolean)));
    if (sexosList.length > 0) sexos = sexosList.join(", ");

    const nacList = Array.from(new Set(socios.map(s => s.nacionalidade).filter(Boolean)));
    if (nacList.length > 0) nacionalidades = nacList.join(", ");
  }

  return (
`;

content = content.replace(/  return \(/, logicAndUiStr);

const uiStr = `
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6 bg-purple-50 dark:bg-purple-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800/30">
            {renderField("É Empreendedor(a)?", empresa.e_socio)}
            {renderField("Tem Sócios Negros?", empresa.tem_negros_socios)}
            {renderField("Autoriza Compartilhamento?", empresa.autoriza_compartilhamento)}
            {isIncentivadora && (
              <>
                {renderField("Etariedade (60+)", etariedadeTexto)}
                {renderField("Raça", racas)}
                {renderField("Sexo", sexos)}
                {renderField("Nacionalidade", nacionalidades)}
              </>
            )}
          </div>
`;

content = content.replace(/          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-purple-50 dark:bg-purple-900\/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800\/30">[\s\S]*?<\/div>/, uiStr);

fs.writeFileSync(path, content);
console.log('Done!');
