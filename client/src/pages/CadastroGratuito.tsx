import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import logoImage from "@/assets/logo.png";

export default function CadastroGratuito() {
  const [submitted, setSubmitted] = useState(false);
  const [acessoTipo, setAcessoTipo] = useState<string>("");
  const [atendimentoTipo, setAtendimentoTipo] = useState<string>("");
  const [numeroSocios, setNumeroSocios] = useState<number | "">("");
  const [numeroImpactadasSocios, setNumeroImpactadasSocios] = useState<number | "">("");
  const [numeroImpactadasGestores, setNumeroImpactadasGestores] = useState<number | "">("");
  const [numeroImpactadasColaboradores, setNumeroImpactadasColaboradores] = useState<number | "">("");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aqui seria a lógica de envio para o backend
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
          <h2 className="text-3xl font-bold text-gray-900">Cadastro Realizado!</h2>
          <p className="text-gray-600">
            Recebemos seus dados com sucesso. Em breve, nossa equipe entrará em contato.
          </p>
          <Button asChild className="w-full" style={{ backgroundColor: '#9D4EDD' }}>
            <Link href="/">Voltar para a página inicial</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header Minimal */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={logoImage} alt="Logo Diversidade.io" className="h-10 w-auto object-contain" />
            <span className="font-bold text-xl hidden sm:block" style={{ color: '#9D4EDD' }}>Diversidade.io</span>
          </Link>
          <Button variant="ghost" asChild className="text-gray-600 hover:text-purple-700">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Link>
          </Button>
        </div>
      </header>

      {/* Form Container */}
      <main className="container mx-auto px-4 pt-12">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-[#0F3A7D] to-[#9D4EDD] p-8 md:p-12 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Cadastro Gratuito</h1>
            <p className="text-lg opacity-90">
              Junte-se à nossa rede e transforme diversidade em resultado real para o seu negócio.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="p-8 md:p-12 space-y-10">
            
            {/* Informações Pessoais */}
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-gray-900 border-b pb-2">Informações de Contato</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-gray-700 font-medium">Seu Nome</Label>
                  <Input id="nome" required placeholder="Digite seu nome completo" className="h-12" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="telefone" className="text-gray-700 font-medium">Seu telefone</Label>
                  <Input id="telefone" required placeholder="(00) 00000-0000" className="h-12" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email" className="text-gray-700 font-medium">Seu e-mail</Label>
                  <Input id="email" type="email" required placeholder="seu@email.com" className="h-12" />
                </div>
              </div>
            </section>

            {/* Informações da Empresa */}
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold text-gray-900 border-b pb-2">Dados da Empresa</h2>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="text-gray-700 font-medium">Coloque o CNPJ da sua empresa</Label>
                  <Input id="cnpj" required placeholder="00.000.000/0000-00" className="h-12" />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">O seu acesso é como:</Label>
                  <Select onValueChange={setAcessoTipo} required>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecione o tipo de acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPRESA OU INICIATIVA INCENTIVADORA">EMPRESA OU INICIATIVA INCENTIVADORA</SelectItem>
                      <SelectItem value="FORNECEDOR INCLUSIVO">FORNECEDOR INCLUSIVO</SelectItem>
                      <SelectItem value="EMPREENDIMENTO DIVERSO">EMPREENDIMENTO DIVERSO</SelectItem>
                      <SelectItem value="OUTRO">OUTRO - CITE AQUI</SelectItem>
                    </SelectContent>
                  </Select>
                  {acessoTipo === "OUTRO" && (
                    <Input className="mt-2 h-12" placeholder="Por favor, especifique" required />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Sua empresa atualmente atende</Label>
                  <Select onValueChange={setAtendimentoTipo} required>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecione o alcance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Meu Bairro">Meu Bairro</SelectItem>
                      <SelectItem value="Minha região da minha cidade">Minha região da minha cidade</SelectItem>
                      <SelectItem value="Minha cidade">Minha cidade</SelectItem>
                      <SelectItem value="Minha cidade e o entorno">Minha cidade e o entorno</SelectItem>
                      <SelectItem value="Meu estado">Meu estado</SelectItem>
                      <SelectItem value="Os estados da minha região">Os estados da minha região</SelectItem>
                      <SelectItem value="Todo o Brasil">Todo o Brasil</SelectItem>
                      <SelectItem value="Outro">Outro - Detalhe</SelectItem>
                    </SelectContent>
                  </Select>
                  {atendimentoTipo === "Outro" && (
                    <Input className="mt-2 h-12" placeholder="Por favor, especifique" required />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cartaoCnpj" className="text-gray-700 font-medium">Suba o PDF do Cartão CNPJ da sua empresa</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer group">
                    <input type="file" id="cartaoCnpj" className="hidden" accept=".pdf" />
                    <label htmlFor="cartaoCnpj" className="cursor-pointer flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-gray-700 font-medium">Clique para selecionar ou arraste o arquivo aqui</p>
                        <p className="text-sm text-gray-500 mt-1">Apenas arquivos PDF (Máx 5MB)</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* Recortes de Diversidade */}
            <section className="space-y-6">
              <div className="space-y-2 border-b pb-2">
                <h2 className="text-2xl font-semibold text-gray-900">Recortes da Diversidade</h2>
                <p className="text-gray-600 text-sm">
                  Por favor informe abaixo sobre os recortes da diversidade da sua empresa (Marque onde aplicável)
                </p>
              </div>
              
              <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-4 font-semibold text-gray-700">Categoria</th>
                      <th className="p-4 font-semibold text-gray-700 text-center">Sócio(a)s<br/><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                      <th className="p-4 font-semibold text-gray-700 text-center">Gestore(a)s<br/><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                      <th className="p-4 font-semibold text-gray-700 text-center">Colaboradore(a)s<br/><span className="text-xs text-gray-500 font-normal">(Mais de 50%)</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {[
                      "Pessoas Negras",
                      "Mulheres",
                      "60 anos +",
                      "PCDs"
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-medium text-gray-800">{row}</td>
                        <td className="p-4 text-center">
                          <Checkbox id={`socio-${idx}`} className="w-5 h-5 rounded data-[state=checked]:bg-[#9D4EDD] data-[state=checked]:border-[#9D4EDD]" />
                        </td>
                        <td className="p-4 text-center">
                          <Checkbox id={`gestor-${idx}`} className="w-5 h-5 rounded data-[state=checked]:bg-[#9D4EDD] data-[state=checked]:border-[#9D4EDD]" />
                        </td>
                        <td className="p-4 text-center">
                          <Checkbox id={`colab-${idx}`} className="w-5 h-5 rounded data-[state=checked]:bg-[#9D4EDD] data-[state=checked]:border-[#9D4EDD]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Dados do Impacto Social */}
            <section className="space-y-6">
              <div className="space-y-2 border-b pb-2">
                <h2 className="text-2xl font-semibold text-gray-900">Dados do Impacto Social</h2>
                <p className="text-gray-600 text-sm">
                  Para ser preenchido pelos Fornecedores Inclusivos e empreendimentos diversos
                </p>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="numeroSocios" className="text-gray-700 font-medium">Número de sócios:</Label>
                  <Input 
                    id="numeroSocios" 
                    type="number" 
                    min="1" 
                    value={numeroSocios}
                    onChange={(e) => setNumeroSocios(e.target.value ? parseInt(e.target.value, 10) : "")}
                    placeholder="Ex: 2" 
                    className="h-12" 
                  />
                </div>

                {typeof numeroSocios === "number" && numeroSocios > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {Array.from({ length: Math.min(numeroSocios, 50) }).map((_, idx) => (
                      <div key={idx} className="space-y-2">
                        <Label htmlFor={`cep-socio-${idx}`} className="text-gray-700 font-medium">
                          Cep do sócio(a) {idx + 1}
                        </Label>
                        <Input 
                          id={`cep-socio-${idx}`} 
                          required 
                          placeholder="00000-000" 
                          className="h-12" 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Pessoas Impactadas */}
            <section className="space-y-10">
              <div className="space-y-2 border-b pb-2">
                <h2 className="text-2xl font-semibold text-gray-900">Pessoas Impactadas</h2>
                <p className="text-gray-600 text-sm">
                  Informe o número de pessoas impactadas financeiramente pelo salário de cada grupo para listarmos os CEPs.
                </p>
              </div>
              
              {/* Impactadas pelos Sócios */}
              <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-800">Impactadas pelo salário do Sócio(a)s</h3>
                  <Label htmlFor="numeroImpactadasSocios" className="text-gray-700 font-medium">Número de pessoas impactadas:</Label>
                  <Input 
                    id="numeroImpactadasSocios" 
                    type="number" 
                    min="1" 
                    value={numeroImpactadasSocios}
                    onChange={(e) => setNumeroImpactadasSocios(e.target.value ? parseInt(e.target.value, 10) : "")}
                    placeholder="Ex: 5" 
                    className="h-12 bg-white" 
                  />
                </div>

                {typeof numeroImpactadasSocios === "number" && numeroImpactadasSocios > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {Array.from({ length: Math.min(numeroImpactadasSocios, 100) }).map((_, idx) => (
                      <div key={`socios-${idx}`} className="space-y-2">
                        <Label htmlFor={`cep-impactada-socios-${idx}`} className="text-gray-700 font-medium">
                          Cep da pessoa {idx + 1}
                        </Label>
                        <Input 
                          id={`cep-impactada-socios-${idx}`} 
                          required 
                          placeholder="00000-000" 
                          className="h-12 bg-white" 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Impactadas pelos Gestores */}
              <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-800">Impactadas pelo salário do Gestore(a)s</h3>
                  <Label htmlFor="numeroImpactadasGestores" className="text-gray-700 font-medium">Número de pessoas impactadas:</Label>
                  <Input 
                    id="numeroImpactadasGestores" 
                    type="number" 
                    min="1" 
                    value={numeroImpactadasGestores}
                    onChange={(e) => setNumeroImpactadasGestores(e.target.value ? parseInt(e.target.value, 10) : "")}
                    placeholder="Ex: 5" 
                    className="h-12 bg-white" 
                  />
                </div>

                {typeof numeroImpactadasGestores === "number" && numeroImpactadasGestores > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {Array.from({ length: Math.min(numeroImpactadasGestores, 100) }).map((_, idx) => (
                      <div key={`gestores-${idx}`} className="space-y-2">
                        <Label htmlFor={`cep-impactada-gestores-${idx}`} className="text-gray-700 font-medium">
                          Cep da pessoa {idx + 1}
                        </Label>
                        <Input 
                          id={`cep-impactada-gestores-${idx}`} 
                          required 
                          placeholder="00000-000" 
                          className="h-12 bg-white" 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Impactadas pelos Colaboradores */}
              <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-800">Impactadas pelo salário do Colaboradore(a)s</h3>
                  <Label htmlFor="numeroImpactadasColaboradores" className="text-gray-700 font-medium">Número de pessoas impactadas:</Label>
                  <Input 
                    id="numeroImpactadasColaboradores" 
                    type="number" 
                    min="1" 
                    value={numeroImpactadasColaboradores}
                    onChange={(e) => setNumeroImpactadasColaboradores(e.target.value ? parseInt(e.target.value, 10) : "")}
                    placeholder="Ex: 5" 
                    className="h-12 bg-white" 
                  />
                </div>

                {typeof numeroImpactadasColaboradores === "number" && numeroImpactadasColaboradores > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {Array.from({ length: Math.min(numeroImpactadasColaboradores, 100) }).map((_, idx) => (
                      <div key={`colab-${idx}`} className="space-y-2">
                        <Label htmlFor={`cep-impactada-colab-${idx}`} className="text-gray-700 font-medium">
                          Cep da pessoa {idx + 1}
                        </Label>
                        <Input 
                          id={`cep-impactada-colab-${idx}`} 
                          required 
                          placeholder="00000-000" 
                          className="h-12 bg-white" 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="pt-8 flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Seus dados estão protegidos de acordo com a nossa política de privacidade.
              </p>
              <Button type="submit" className="w-full sm:w-auto h-14 px-10 text-lg font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all" style={{ backgroundColor: '#FF9500' }}>
                Enviar Cadastro
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
