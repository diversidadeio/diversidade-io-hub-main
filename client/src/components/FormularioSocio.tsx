import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DrumDatePicker } from "@/components/ui/drum-date-picker";
import { Upload, Info } from "lucide-react";
export interface SocioData {
  foto: File | null;
  fonteImagem: string;
  nome: string;
  participacaoValor: string;
  participacaoPercentual: string;
  cpf: string;
  cep: string;
  cepEndereco?: string;
  cepValido?: boolean;
  email: string;
  dataNascimento: string;
  nacionalidade: string;
  etariedade: string;
  raca: string;
  sexo: string;
  sexoOutro: string;
  genero: string;
  deficiencia: string[];
  deficienciaAuditivaGrau: string;
  deficienciaFisicaGrau: string;
  deficienciaIntelectualGrau: string;
  deficienciaPsicossocialGrau: string;
  deficienciaVisualGrau: string;
}

export default function FormularioSocio({
  socio,
  idx,
  updateSocio,
  handleCepSocioChange,
  fotoUrl,
}: {
  socio: SocioData;
  idx: number;
  updateSocio: (index: number, field: keyof SocioData, value: any) => void;
  handleCepSocioChange: (index: number, value: string) => void;
  fotoUrl?: string;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!socio.foto) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(socio.foto);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [socio.foto]);
  const formatCpf = (value: string) =>
    value
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return (
    <div className="space-y-6 pt-4 pb-8">
      <div className="space-y-4">
        <Label className="text-gray-700 font-medium">Foto do Sócio</Label>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group bg-white">
          <input
            type="file"
            id={`foto-socio-${idx}`}
            className="hidden"
            accept="image/*"
            onChange={e => {
              if (e.target.files && e.target.files[0])
                updateSocio(idx, "foto", e.target.files[0]);
            }}
          />
          <label
            htmlFor={`foto-socio-${idx}`}
            className="cursor-pointer flex flex-col items-center justify-center space-y-2"
          >
            {preview || fotoUrl ? (
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#7030A0] shadow-md">
                <img
                  src={preview || fotoUrl}
                  alt={`Preview Foto ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-[#7030A0]" />
              </div>
            )}
            <p className="text-gray-700 font-medium text-sm mt-2">
              {socio.foto ? "Foto do Sócio" : "Clique para enviar a foto"}
            </p>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-gray-700 font-medium">Fonte da Imagem</Label>
        <RadioGroup
          value={socio.fonteImagem}
          onValueChange={v => updateSocio(idx, "fonteImagem", v)}
          className="flex flex-wrap gap-4 mt-1"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Empreendedor" id={`fonte-emp-${idx}`} />
            <Label htmlFor={`fonte-emp-${idx}`}>
              Fornecido pelo empreendedor
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Rede Social" id={`fonte-red-${idx}`} />
            <Label htmlFor={`fonte-red-${idx}`}>Retirado de rede social</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-700 font-medium">Nome do Sócio</Label>
          <Input
            value={socio.nome}
            onChange={e => updateSocio(idx, "nome", e.target.value)}
            placeholder="Nome completo"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 font-medium">CPF</Label>
          <Input
            value={socio.cpf}
            onChange={e => updateSocio(idx, "cpf", formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 font-medium">
            Valor da Participação
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
            <Input
              inputMode="numeric"
              className="pl-9"
              value={socio.participacaoValor}
              onChange={e =>
                updateSocio(idx, "participacaoValor", e.target.value)
              }
              placeholder="0,00"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 font-medium">
            Percentual da Empresa
          </Label>
          <div className="relative">
            <Input
              inputMode="decimal"
              className="pr-8"
              value={socio.participacaoPercentual}
              onChange={e =>
                updateSocio(idx, "participacaoPercentual", e.target.value)
              }
              placeholder="0"
            />
            <span className="absolute right-3 top-2.5 text-gray-500">%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 font-medium">E-mail</Label>
          <Input
            type="email"
            value={socio.email}
            onChange={e => updateSocio(idx, "email", e.target.value)}
            placeholder="email@socio.com"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 font-medium">
            Data de Nascimento
          </Label>
          <DrumDatePicker
            value={socio.dataNascimento}
            onChange={v => updateSocio(idx, "dataNascimento", v)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label
            htmlFor={`cep-socio-${idx}`}
            className="text-gray-700 font-medium"
          >
            CEP <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`cep-socio-${idx}`}
            value={socio.cep}
            onChange={e => handleCepSocioChange(idx, e.target.value)}
            placeholder="00000-000"
            maxLength={9}
          />
          {socio.cepEndereco && (
            <p
              className={`text-xs mt-1 ${socio.cepValido ? "text-gray-500" : "text-red-500 font-semibold"}`}
            >
              {socio.cepEndereco}
            </p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">Nacionalidade</Label>
            <Select
              value={
                socio.nacionalidade === ""
                  ? ""
                  : socio.nacionalidade === "Brasileiro"
                    ? "Brasileiro"
                    : "Outro"
              }
              onValueChange={v => {
                if (v === "Brasileiro") {
                  updateSocio(idx, "nacionalidade", "Brasileiro");
                } else {
                  updateSocio(idx, "nacionalidade", "Outro");
                }
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Brasileiro">Brasileiro</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            {socio.nacionalidade !== "" &&
              socio.nacionalidade !== "Brasileiro" && (
                <Input
                  value={
                    socio.nacionalidade === "Outro" ? "" : socio.nacionalidade
                  }
                  onChange={e => {
                    const val = e.target.value;
                    updateSocio(
                      idx,
                      "nacionalidade",
                      val === "" ? "Outro" : val
                    );
                  }}
                  placeholder="Informe a nacionalidade"
                  className="mt-2"
                />
              )}
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">Idade</Label>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              value={socio.etariedade}
              onChange={e => updateSocio(idx, "etariedade", e.target.value)}
              placeholder="Sua idade"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium flex items-center gap-1">
              Raça/Cor
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p>
                    Esse termo é utilizado para manter o alinhamento com as
                    classificações oficiais de órgãos governamentais (como IBGE
                    e JUCESP), garantindo a padronização dos dados.
                  </p>
                </TooltipContent>
              </Tooltip>
            </Label>
            <Select
              value={socio.raca}
              onValueChange={v => updateSocio(idx, "raca", v)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pardo">Pardo</SelectItem>
                <SelectItem value="Preto">Preto</SelectItem>
                <SelectItem value="Branco">Branco</SelectItem>
                <SelectItem value="Amarelo">Amarelo</SelectItem>
                <SelectItem value="Indígena">Indígena</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">Sexo</Label>
            <Select
              value={socio.sexo}
              onValueChange={v => updateSocio(idx, "sexo", v)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Feminino">Feminino</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
                <SelectItem value="Prefiro não declarar">
                  Prefiro não declarar
                </SelectItem>
              </SelectContent>
            </Select>
            {socio.sexo === "Outro" && (
              <Input
                className="mt-2"
                value={socio.sexoOutro}
                onChange={e => updateSocio(idx, "sexoOutro", e.target.value)}
                placeholder="Qual o outro?"
              />
            )}
          </div>
          <div className="space-y-4 md:col-span-2 mt-4">
            <Label className="text-gray-700 font-medium block border-b pb-2">
              Deficiência
            </Label>
            <p className="text-sm text-gray-500 mb-2">
              Sócio(s) possui alguma deficiência? (Pode selecionar mais de uma)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[
                "Sem deficiência",
                "Deficiência auditiva",
                "Deficiência física",
                "Deficiência intelectual",
                "Deficiência psicossocial",
                "Deficiência visual",
              ].map(def => (
                <div key={def} className="flex items-center space-x-2">
                  <Checkbox
                    id={`def-${idx}-${def.replace(/\s+/g, "-")}`}
                    checked={socio.deficiencia?.includes(def)}
                    onCheckedChange={checked => {
                      const current = socio.deficiencia || [];
                      let next;
                      if (checked) {
                        if (def === "Sem deficiência")
                          next = ["Sem deficiência"];
                        else
                          next = [
                            ...current.filter(d => d !== "Sem deficiência"),
                            def,
                          ];
                      } else {
                        next = current.filter(d => d !== def);
                      }
                      updateSocio(idx, "deficiencia", next);
                    }}
                  />
                  <label
                    htmlFor={`def-${idx}-${def.replace(/\s+/g, "-")}`}
                    className="text-sm cursor-pointer"
                  >
                    {def}
                  </label>
                </div>
              ))}
            </div>

            {socio.deficiencia?.includes("Deficiência auditiva") && (
              <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                <Label>Qual o grau da sua deficiência auditiva?</Label>
                <Select
                  value={socio.deficienciaAuditivaGrau}
                  onValueChange={v =>
                    updateSocio(idx, "deficienciaAuditivaGrau", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Perda unilateral">
                      Perda unilateral
                    </SelectItem>
                    <SelectItem value="Perda bilateral">
                      Perda bilateral
                    </SelectItem>
                    <SelectItem value="Parcial">Parcial</SelectItem>
                    <SelectItem value="Total de 41db (ou mais)">
                      Total de 41db (ou mais)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {socio.deficiencia?.includes("Deficiência física") && (
              <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                <Label>Qual o grau da sua deficiência física?</Label>
                <Select
                  value={socio.deficienciaFisicaGrau}
                  onValueChange={v =>
                    updateSocio(idx, "deficienciaFisicaGrau", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Paraparesia",
                      "Monoplegia",
                      "Monoparesia",
                      "Tetraplegia",
                      "Tetraparesia",
                      "Triplegia",
                      "Triparesia",
                      "Hemiplegia",
                      "Hemiparesia",
                      "Paralisia cerebral",
                      "Amputação ou ausência de membro",
                      "Ostomia",
                      "Nanismo",
                      "Membros com deformidade congênita",
                      "Membros com deformidade adquirida",
                    ].map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {socio.deficiencia?.includes("Deficiência intelectual") && (
              <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                <Label>Qual o grau da sua deficiência intelectual?</Label>
                <Select
                  value={socio.deficienciaIntelectualGrau}
                  onValueChange={v =>
                    updateSocio(idx, "deficienciaIntelectualGrau", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Comunicação",
                      "Cuidado pessoal",
                      "Habilidades sociais",
                      "Utilização de recursos da comunidade",
                      "Deficiência múltipla",
                    ].map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {socio.deficiencia?.includes("Deficiência psicossocial") && (
              <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                <Label>Qual o grau da sua deficiência psicossocial?</Label>
                <Select
                  value={socio.deficienciaPsicossocialGrau}
                  onValueChange={v =>
                    updateSocio(idx, "deficienciaPsicossocialGrau", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Mania",
                      "Esquizofrenia",
                      "Depressão",
                      "Síndrome do pânico",
                      "Transtorno obsessivo-compulsivo",
                      "Paranoia",
                      "Pessoa neurodiversa",
                    ].map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {socio.deficiencia?.includes("Deficiência visual") && (
              <div className="space-y-2 bg-purple-50 p-4 rounded-lg">
                <Label>Qual o grau da sua deficiência visual?</Label>
                <Select
                  value={socio.deficienciaVisualGrau}
                  onValueChange={v =>
                    updateSocio(idx, "deficienciaVisualGrau", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grau" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Cegueira: visão menor do que 5%",
                      "Baixa visão: visão entre 30% e 59%",
                      "Campo visual: Menor do que 60%",
                      "Cegueira monocular: visão de apenas um olho",
                      "Redução da visão",
                      "Daltonismo",
                      "Visão acima de 50%",
                    ].map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
