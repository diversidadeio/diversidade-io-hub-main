import { useState } from "react";
import { Edit2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FormularioSocio, { type SocioData } from "@/components/FormularioSocio";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { registrarLog } from "@/lib/registrarLog";
import {
  filtrarIdade,
  filtrarPercentual,
  formatarParticipacaoMonetaria,
} from "@/lib/camposNumericosSocio";
import { toast } from "sonner";

const campos = [
  ["nome", "Nome"],
  ["cpf", "CPF"],
  ["email", "E-mail"],
  ["cep", "CEP"],
  ["data_nascimento", "Data de Nasc."],
  ["nacionalidade", "Nacionalidade"],
  ["raca", "Raça"],
  ["participacao_percentual", "Participação %"],
  ["participacao_valor", "Participação R$"],
  ["etariedade", "Idade"],
  ["sexo", "Sexo"],
  ["deficiencia", "Deficiência"],
  ["fonte_imagem", "Fonte da Imagem"],
] as const;

const correspondencia = {
  fonteImagem: "fonte_imagem",
  participacaoValor: "participacao_valor",
  participacaoPercentual: "participacao_percentual",
  dataNascimento: "data_nascimento",
  cepEndereco: "cep_endereco",
  deficienciaAuditivaGrau: "deficiencia_auditiva_grau",
  deficienciaFisicaGrau: "deficiencia_fisica_grau",
  deficienciaIntelectualGrau: "deficiencia_intelectual_grau",
  deficienciaPsicossocialGrau: "deficiencia_psicossocial_grau",
  deficienciaVisualGrau: "deficiencia_visual_grau",
} as const;
const campoBanco = (campo: string) =>
  correspondencia[campo as keyof typeof correspondencia] || campo;
const tiposDeficiencia: Record<string, string> = {
  deficienciaAuditivaGrau: "Deficiência auditiva",
  deficienciaFisicaGrau: "Deficiência física",
  deficienciaIntelectualGrau: "Deficiência intelectual",
  deficienciaPsicossocialGrau: "Deficiência psicossocial",
  deficienciaVisualGrau: "Deficiência visual",
};

export default function QuadroSocietarioAdm({
  empresa,
  socios,
  onChange,
  emailAdmin,
}: {
  empresa: any;
  socios: any[];
  onChange: (socios: any[]) => void;
  emailAdmin?: string;
}) {
  const [edicao, setEdicao] = useState<{
    id?: string;
    foco: string;
    valores: Record<string, string>;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState("");
  const [socioExcluir, setSocioExcluir] = useState<{ id: string; nome?: string } | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const excluir = async () => {
    if (!socioExcluir || excluindo) return;
    setExcluindo(true);
    try {
      const { error } = await supabase
        .from("socios")
        .delete()
        .eq("id", socioExcluir.id)
        .eq("empresa_id", empresa.id)
        .select("id")
        .single();
      if (error) throw error;
      onChange(socios.filter(socio => socio.id !== socioExcluir.id));
      void registrarLog({
        tipo_evento: "adm_excluiu_socio",
        empresa_id: empresa.id,
        nome_empresa: empresa.razao_social,
        email: emailAdmin,
        detalhes: `Excluiu participante do quadro societário (ID: ${socioExcluir.id}).`,
      });
      setSocioExcluir(null);
      toast.success("Sócio excluído com sucesso!");
    } catch (erro: any) {
      toast.error("Erro ao excluir sócio: " + erro.message);
    } finally {
      setExcluindo(false);
    }
  };

  const abrir = (socio?: any, foco = "nome") => {
    setFoto(null);
    setFotoUrl(socio?.foto_url || "");
    const chaves = [
      ...campos.map(([campo]) => campo),
      ...Object.values(correspondencia),
    ];
    const valores = Object.fromEntries(
      chaves.map(campo => [campo, String(socio?.[campo] ?? "")])
    );
    valores.sexoOutro = valores.sexo.startsWith("Outro: ")
      ? valores.sexo.slice(7)
      : "";
    if (valores.sexoOutro) valores.sexo = "Outro";
    setEdicao({ id: socio?.id, foco, valores });
  };

  const alterar = (campo: string, valor: string) =>
    setEdicao(anterior => {
      if (!anterior) return anterior;
      if (campo === "participacao_valor")
        valor = formatarParticipacaoMonetaria(valor, anterior.valores[campo]);
      if (campo === "participacao_percentual")
        valor = filtrarPercentual(valor, anterior.valores[campo]);
      if (campo === "etariedade")
        valor = filtrarIdade(valor, anterior.valores[campo]);
      if (campo === "cpf")
        valor = valor
          .replace(/\D/g, "")
          .slice(0, 11)
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      if (campo === "cep")
        valor = valor
          .replace(/\D/g, "")
          .slice(0, 8)
          .replace(/(\d{5})(\d)/, "$1-$2");
      if (campo === "data_nascimento")
        valor = valor
          .replace(/\D/g, "")
          .slice(0, 8)
          .replace(/(\d{2})(\d)/, "$1/$2")
          .replace(/(\d{2})(\d)/, "$1/$2");
      const valores = { ...anterior.valores, [campo]: valor };
      if (campo === "data_nascimento" && valor.length === 10) {
        const [dia, mes, ano] = valor.split("/").map(Number);
        const hoje = new Date();
        const idade =
          hoje.getFullYear() -
          ano -
          (hoje.getMonth() < mes - 1 ||
          (hoje.getMonth() === mes - 1 && hoje.getDate() < dia)
            ? 1
            : 0);
        if (idade >= 0) valores.etariedade = String(idade);
      }
      return { ...anterior, valores };
    });

  const formulario = Object.fromEntries([
    ...[
      "nome",
      "cpf",
      "cep",
      "email",
      "nacionalidade",
      "etariedade",
      "raca",
      "sexo",
      "sexoOutro",
      "genero",
    ].map(campo => [campo, edicao?.valores[campo] || ""]),
    ...Object.entries(correspondencia).map(([campo, banco]) => [
      campo,
      edicao?.valores[banco] || "",
    ]),
    ["foto", foto],
    [
      "deficiencia",
      (edicao?.valores.deficiencia || "").split(", ").filter(Boolean),
    ],
    ["cepValido", !!edicao?.valores.cep_endereco],
  ]) as unknown as SocioData;

  const alterarFormulario = (_: number, campo: keyof SocioData, valor: any) => {
    if (campo === "foto") {
      setFoto(valor);
      return;
    }
    alterar(
      campoBanco(campo),
      campo === "deficiencia" ? valor.join(", ") : String(valor)
    );
  };

  const alterarCep = async (_: number, valor: string) => {
    const digitos = valor.replace(/\D/g, "").slice(0, 8);
    alterar("cep", digitos);
    alterar("cep_endereco", "");
    if (digitos.length !== 8) return;
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const endereco = await resposta.json();
      setEdicao(anterior => {
        if (!anterior || anterior.valores.cep.replace(/\D/g, "") !== digitos)
          return anterior;
        return {
          ...anterior,
          valores: {
            ...anterior.valores,
            cep_endereco: endereco.erro
              ? ""
              : `${endereco.logradouro}, ${endereco.bairro}, ${endereco.localidade} - ${endereco.uf}`,
          },
        };
      });
    } catch {
      /* O CEP pode ser salvo mesmo quando o serviço está indisponível. */
    }
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!edicao || salvando) return;
    const valores = Object.fromEntries(
      Object.entries(edicao.valores).map(([campo, valor]) => [
        campo,
        valor.trim(),
      ])
    );
    if (
      campos.slice(0, 9).some(([campo]) => !valores[campo]) ||
      valores.nacionalidade === "Outro" ||
      (valores.sexo === "Outro" && !valores.sexoOutro)
    ) {
      toast.error(
        "Preencha os dados do participante, incluindo os campos de outra nacionalidade ou sexo quando selecionados."
      );
      return;
    }
    const percentual = Number(
      valores.participacao_percentual.replace(",", ".")
    );
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      toast.error("A participação deve estar entre 0 e 100%.");
      return;
    }
    if (
      valores.cpf.replace(/\D/g, "").length !== 11 ||
      valores.cep.replace(/\D/g, "").length !== 8
    ) {
      toast.error("Informe CPF e CEP completos.");
      return;
    }
    const [dia, mes, ano] = valores.data_nascimento.split("/").map(Number);
    const nascimento = new Date(ano, mes - 1, dia);
    if (
      !/^\d{2}\/\d{2}\/\d{4}$/.test(valores.data_nascimento) ||
      nascimento.getFullYear() !== ano ||
      nascimento.getMonth() !== mes - 1 ||
      nascimento.getDate() !== dia ||
      nascimento > new Date()
    ) {
      toast.error(
        "Informe uma data de nascimento válida no formato DD/MM/AAAA."
      );
      return;
    }
    setSalvando(true);
    try {
      let url = fotoUrl;
      if (foto) {
        if (!foto.type.startsWith("image/"))
          throw new Error("Selecione um arquivo de imagem.");
        const caminho = `empresas/${empresa.id}/socios/${crypto.randomUUID()}.${foto.name.split(".").pop()}`;
        const { error } = await supabase.storage
          .from("documentos")
          .upload(caminho, foto);
        if (error) throw error;
        url = supabase.storage.from("documentos").getPublicUrl(caminho)
          .data.publicUrl;
        setFotoUrl(url);
        setFoto(null);
      }
      const { sexoOutro, ...persistidos } = valores;
      for (const [campo, banco] of Object.entries(correspondencia)) {
        if (
          tiposDeficiencia[campo] &&
          !formulario.deficiencia.includes(tiposDeficiencia[campo])
        )
          persistidos[banco] = "";
      }
      const dados = {
        ...persistidos,
        sexo: valores.sexo === "Outro" ? `Outro: ${sexoOutro}` : valores.sexo,
        foto_url: url || null,
      };
      const consulta = edicao.id
        ? supabase
            .from("socios")
            .update(dados)
            .eq("id", edicao.id)
            .eq("empresa_id", empresa.id)
        : supabase.from("socios").insert({ ...dados, empresa_id: empresa.id });
      const { data, error } = await consulta.select("*").single();
      if (error) throw error;
      onChange(
        edicao.id
          ? socios.map(socio => (socio.id === edicao.id ? data : socio))
          : [...socios, data]
      );
      void registrarLog({
        tipo_evento: edicao.id ? "adm_editou_socio" : "adm_adicionou_socio",
        empresa_id: empresa.id,
        nome_empresa: empresa.razao_social,
        email: emailAdmin,
        detalhes: `${edicao.id ? "Editou" : "Adicionou"} participante do quadro societário (ID: ${data.id}).`,
      });
      toast.success(
        edicao.id
          ? "Participante atualizado com sucesso!"
          : "Participante adicionado com sucesso!"
      );
      setEdicao(null);
    } catch (erro: any) {
      toast.error("Erro ao salvar participante: " + erro.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          onClick={() => abrir()}
          className="text-[#7030A0] border-purple-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar participante
        </Button>
      </div>
      {socios.length === 0 ? (
        <p className="text-gray-500 italic text-sm mb-4">
          Nenhum sócio cadastrado.
        </p>
      ) : (
        <div className="space-y-4">
          {socios.map(socio => (
            <div
              key={socio.id}
              className="bg-gray-50 border border-gray-100 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              <div className="flex flex-wrap items-center gap-3 md:col-span-3 lg:col-span-4">
                {socio.foto_url && (
                  <img
                    src={socio.foto_url}
                    alt={`Foto de ${socio.nome || "participante"}`}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => abrir(socio)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar participante e foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 sm:ml-auto"
                  onClick={() => setSocioExcluir({ id: socio.id, nome: socio.nome })}
                  aria-label={`Excluir sócio ${socio.nome || "participante"}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir sócio
                </Button>
              </div>
              {campos.map(([campo, label]) => (
                <div key={campo} className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={() => abrir(socio, campo)}
                      title={`Editar ${label}`}
                      aria-label={`Editar ${label} de ${socio.nome || "participante"}`}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-transparent hover:border-blue-200 bg-gray-50"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-900 break-words">
                    {socio[campo] ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={!!socioExcluir}
        onOpenChange={aberto => {
          if (!aberto && !excluindo) setSocioExcluir(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir sócio</DialogTitle>
            <DialogDescription>
              Deseja excluir {socioExcluir?.nome || "este sócio"} do quadro societário?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={excluindo} onClick={() => setSocioExcluir(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={excluindo} onClick={excluir}>
              {excluindo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {excluindo ? "Excluindo..." : "Excluir sócio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!edicao}
        onOpenChange={aberto => {
          if (!aberto && !salvando) setEdicao(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#7030A0]">
              <Edit2 className="w-5 h-5" />
              {edicao?.id ? "Editar participante" : "Adicionar participante"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do participante do quadro societário e salve as
              alterações.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar}>
            <fieldset disabled={salvando} className="py-4 min-w-0">
              <FormularioSocio
                socio={formulario}
                idx={0}
                updateSocio={alterarFormulario}
                handleCepSocioChange={alterarCep}
                fotoUrl={fotoUrl}
              />
            </fieldset>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={() => setEdicao(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-[#7030A0] hover:bg-[#5b2782]"
              >
                {salvando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
