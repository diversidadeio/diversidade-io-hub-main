import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Users, Leaf, Network, Handshake, TrendingUp, CheckCircle, Target, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import logoImage from "@/assets/logo.png";
import rhinoImage from "@/assets/rhino.png";

/**
 * Diversidade.io Hub - Institutional Landing Page
 * 
 * Design Philosophy: Modern Institutional Tech
 * - Color Palette: Deep Blue (#0F3A7D), Emerald Green (#059669), Warm Orange (#EA580C)
 * - Typography: Poppins (titles), Inter (body)
 * - Layout: Asymmetric with generous whitespace, data-driven design
 * - Interaction: Smooth transitions, scroll reveals, hover effects
 */

export default function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Logo Diversidade.io" className="h-10 w-auto object-contain" />
            <span className="font-bold text-lg" style={{color: '#9D4EDD'}}>Diversidade.io</span>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection("ecosystem")} className="text-gray-700 hover:text-purple-700 transition-colors text-sm font-medium">
              Ecossistema
            </button>
            <button onClick={() => scrollToSection("platforms")} className="text-gray-700 hover:text-purple-700 transition-colors text-sm font-medium">
              Plataformas
            </button>
            <button onClick={() => scrollToSection("integration")} className="text-gray-700 hover:text-purple-700 transition-colors text-sm font-medium">
              Como se Conectam
            </button>
            <button onClick={() => scrollToSection("results")} className="text-gray-700 hover:text-purple-700 transition-colors text-sm font-medium">
              Resultados
            </button>
            <button onClick={() => scrollToSection("contact")} className="text-gray-700 hover:text-purple-700 transition-colors text-sm font-medium">
              Contato
            </button>
          </nav>

          <Button className="text-white" style={{backgroundColor: '#8B2D8B'}} onClick={() => scrollToSection("platforms")}>
            Conheça nossas plataformas
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-white via-blue-50 to-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-30 -z-10"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-100 rounded-full blur-3xl opacity-20 -z-10"></div>

        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight" style={{color: '#9D4EDD'}}>
                Diversidade.io: tecnologia para transformar diversidade em negócio, impacto e evidência
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Um ecossistema de plataformas que conecta empresas, empreendedores diversos, eventos, indicadores sociais e processos de validação com dados, curadoria e mensuração comprovável.
              </p>
              <p className="text-lg text-gray-500 italic">
                As soluções funcionam de forma independente, mas ganham mais força quando integradas em uma jornada completa de inclusão produtiva.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-2 pt-4">
                <Button asChild className="text-white h-10 px-4 text-sm" style={{backgroundColor: '#9D4EDD'}}>
                  <a href="https://www.impactosocial.com.br" target="_blank" rel="noopener noreferrer">
                    Conhecer Impacto Social <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="border-purple-600 text-purple-700 hover:bg-purple-50 h-10 px-4 text-sm" style={{borderColor: '#9D4EDD', color: '#9D4EDD'}}>
                  <a href="https://www.reconhecimentoracial.com.br" target="_blank" rel="noopener noreferrer">
                    Ver Reconhecimento Racial <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="border-orange-600 text-orange-700 hover:bg-orange-50 h-10 px-4 text-sm" style={{borderColor: '#FF9500', color: '#FF9500'}}>
                  <a href="https://www.eventosustentavel.com.br" target="_blank" rel="noopener noreferrer">
                    Explorar Evento Sustentável <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative h-96 md:h-full flex items-center justify-center">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310419663028736640/fj5hvLQNAskbvkdGiCiGce/hero-bg-abstract-i8GKuPACJQsHQUFouWXqeG.webp"
                alt="Hero Background"
                className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-2xl"
              />
              <img
                src={rhinoImage}
                alt="Rinoceronte Diversidade.io"
                className="relative z-10 w-4/5 md:w-3/4 h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section: O que a Diversidade.io resolve */}
      <section id="ecosystem" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{color: '#9D4EDD'}}>
              Da intenção à comprovação: a infraestrutura que faltava para a diversidade gerar resultado real
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Empresas querem ampliar a diversidade em suas cadeias de valor, validar informações com segurança, estruturar eventos inclusivos, realizar rodadas de negócios, medir impacto e comprovar resultados. O problema é que esses processos normalmente estão espalhados em planilhas, eventos isolados, autodeclarações frágeis, indicações informais e relatórios sem rastreabilidade.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed mt-4">
              A Diversidade.io organiza essa jornada em plataformas complementares, conectando tecnologia, curadoria, dados e evidência.
            </p>
          </div>

          {/* Pain Points Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 bg-gradient-to-br from-blue-50 to-white border-l-4 border-blue-700 rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-3">
                <Search className="w-6 h-6 text-blue-700" />
                Descoberta
              </h3>
              <p className="text-gray-700">
                Empresas têm dificuldade para encontrar fornecedores diversos qualificados por atividade, região, porte, capacidade real e aderência à demanda.
              </p>
            </div>

            <div className="p-8 bg-gradient-to-br from-green-50 to-white border-l-4 border-green-600 rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                Validação
              </h3>
              <p className="text-gray-700">
                Dados de diversidade, elegibilidade e recortes precisam ser consistentes, rastreáveis e comparáveis.
              </p>
            </div>

            <div className="p-8 bg-gradient-to-br from-orange-50 to-white border-l-4 border-orange-600 rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-3">
                <Zap className="w-6 h-6 text-orange-600" />
                Conversão
              </h3>
              <p className="text-gray-700">
                Eventos e encontros sem preparação viram networking disperso. Rodadas estruturadas aumentam a chance real de negócios.
              </p>
            </div>

            <div className="p-8 bg-gradient-to-br from-teal-50 to-white border-l-4 border-teal-600 rounded-lg hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-3">
                <Target className="w-6 h-6 text-teal-600" />
                Comprovação
              </h3>
              <p className="text-gray-700">
                Sem registro financeiro, social, territorial e ambiental, a empresa não consegue provar impacto nem defender investimento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Ecossistema de Plataformas */}
      <section id="platforms" className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{color: '#9D4EDD'}}>
              Cinco plataformas. Uma jornada integrada.
            </h2>
            <p className="text-lg text-gray-600">
              Cada solução atende a uma demanda específica. Juntas, elas formam uma arquitetura completa para programas corporativos de diversidade, inclusão produtiva, eventos sustentáveis, validação racial, compras responsáveis, rodadas de negócios e impacto mensurável.
            </p>
          </div>

          {/* Platform Cards Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Card 1: Impacto Social */}
            <div className="group bg-white border-l-4 border-blue-700 rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-blue-700" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900">Impacto Social</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Plataforma para registrar, medir e comprovar o impacto social de negócios, programas, ações afirmativas, compras inclusivas, capacitações, eventos e iniciativas com empreendimentos diversos.
              </p>
              <ul className="space-y-2 mb-8 text-sm text-gray-700">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>Mensuração de impacto econômico e social</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>Recortes por etnia, gênero, etariedade, PCDs</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>Impacto georreferenciado</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>Relatórios para governança, ESG e DE&I</li>
              </ul>
              <Button asChild className="w-full bg-blue-700 hover:bg-blue-800 text-white">
                <a href="https://www.impactosocial.com.br" target="_blank" rel="noopener noreferrer">
                  Acessar Impacto Social
                </a>
              </Button>
            </div>

            {/* Card 2: Reconhecimento Racial */}
            <div className="group bg-white border-l-4 border-green-600 rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900">Reconhecimento Racial</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Plataforma de apoio à validação racial e aos processos de heteroidentificação, com uso de inteligência artificial, machine learning, governança e registro estruturado de evidências.
              </p>
              <ul className="space-y-2 mb-8 text-sm text-gray-700">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>Apoio técnico a processos de heteroidentificação</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>Padronização de análise</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>Redução de subjetividade excessiva</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>Apoio à governança e auditoria</li>
              </ul>
              <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white">
                <a href="https://www.reconhecimentoracial.com.br" target="_blank" rel="noopener noreferrer">
                  Acessar Reconhecimento Racial
                </a>
              </Button>
            </div>

            {/* Card 3: Evento Sustentável */}
            <div className="group bg-white border-l-4 border-orange-600 rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Leaf className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900">Evento Sustentável</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Plataforma para gestão, curadoria e medição de ecoeficiência em eventos, feiras, ativações, encontros corporativos e experiências presenciais.
              </p>
              <ul className="space-y-2 mb-8 text-sm text-gray-700">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span>Gestão antes, durante e depois do evento</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span>Indicadores de resíduos, água, energia, mobilidade</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span>Relatórios executivos de sustentabilidade</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span>Apoio à governança ambiental e reputacional</li>
              </ul>
              <Button asChild className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                <a href="https://www.eventosustentavel.com.br" target="_blank" rel="noopener noreferrer">
                  Acessar Evento Sustentável
                </a>
              </Button>
            </div>

            {/* Card 4: Curadoria de Fornecedores */}
            <div className="group bg-white border-l-4 border-purple-600 rounded-xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Network className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900">Curadoria de Fornecedores Diversos</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Solução central da Diversidade.io para busca, curadoria, homologação, certificação e conexão de fornecedores diversos com grandes empresas, áreas de compras, programas de ESG e DE&I.
              </p>
              <ul className="space-y-2 mb-8 text-sm text-gray-700">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-600 rounded-full"></span>Base qualificada de empreendedores diversos</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-600 rounded-full"></span>Busca por atividade, região, CNAE, porte</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-600 rounded-full"></span>Curadoria técnica e comercial</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-600 rounded-full"></span>Conexão com grandes empresas e compradores</li>
              </ul>
              <Button asChild className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                <a href="https://www.diversidade.io" target="_blank" rel="noopener noreferrer">
                  Conhecer Diversidade.io
                </a>
              </Button>
            </div>
          </div>

          {/* Card 5: Rodadas Inclusivas - Featured */}
          <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white rounded-xl p-10 shadow-2xl">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Handshake className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold">Rodadas Inclusivas</h3>
                </div>
                <p className="text-blue-100 mb-6 text-lg">
                  Plataforma digital para organizar rodadas de negócios, apresentações comerciais, pitchs e encontros estruturados entre empreendedores diversos e compradores ou decisores de compra.
                </p>
                <ul className="space-y-3 mb-8 text-blue-50">
                  <li className="flex items-center gap-2"><span className="w-2 h-2 bg-white rounded-full"></span>Organização de rodadas de negócios 1x1</li>
                  <li className="flex items-center gap-2"><span className="w-2 h-2 bg-white rounded-full"></span>Matching entre empreendedores e empresas</li>
                  <li className="flex items-center gap-2"><span className="w-2 h-2 bg-white rounded-full"></span>Cronômetro em tempo real para controle</li>
                  <li className="flex items-center gap-2"><span className="w-2 h-2 bg-white rounded-full"></span>Dashboard de impacto pós-evento</li>
                  <li className="flex items-center gap-2"><span className="w-2 h-2 bg-white rounded-full"></span>Acompanhamento por status: negociação, pedido, nota fiscal</li>
                </ul>
                <Button asChild className="bg-white text-blue-700 hover:bg-gray-100">
                  <a href="https://www.rodadasinclusivas.com.br" target="_blank" rel="noopener noreferrer">
                    Acessar Rodadas Inclusivas <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
              <div className="hidden md:block">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310419663028736640/fj5hvLQNAskbvkdGiCiGce/platform-icons-abstract-MAU5rPVmdgARHwXNzDtvT2.webp"
                  alt="Rodadas Inclusivas"
                  className="w-full h-auto rounded-lg opacity-90"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Como as plataformas se complementam */}
      <section id="integration" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-6">
              A força está na integração
            </h2>
          </div>

          {/* Integration Flow Visualization */}
          <div className="mb-12">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310419663028736640/fj5hvLQNAskbvkdGiCiGce/integration-flow-visual-HHC3xpMxmjHo2yodUJPeRE.webp"
              alt="Integration Flow"
              className="w-full h-auto rounded-xl shadow-lg"
            />
          </div>

          {/* Integration Steps */}
          <div className="grid md:grid-cols-5 gap-6 mb-12">
            {[
              { step: 1, title: "Encontrar", desc: "A Diversidade.io identifica e organiza fornecedores diversos por atividade, território, porte e capacidade." },
              { step: 2, title: "Validar", desc: "Reconhecimento Racial apoia processos estruturados de validação, heteroidentificação e registro." },
              { step: 3, title: "Conectar", desc: "Rodadas Inclusivas organiza encontros comerciais com agenda, matching e controle de tempo." },
              { step: 4, title: "Medir", desc: "Impacto Social registra o valor econômico, pessoas impactadas e alcance territorial." },
              { step: 5, title: "Sustentar", desc: "Evento Sustentável mede práticas ambientais e sociais em eventos e ativações." },
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="w-16 h-16 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl shadow-lg" style={{backgroundColor: '#9D4EDD'}}>
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{color: '#9D4EDD'}}>{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Integration Closing Text */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-blue-700 p-8 rounded-lg">
            <p className="text-lg text-gray-700 leading-relaxed">
              <strong>Separadas,</strong> as plataformas resolvem problemas específicos. <strong>Integradas,</strong> elas criam uma jornada completa: encontrar fornecedores diversos, validar informações, conectar compradores, estruturar rodadas comerciais, medir impacto e comprovar resultados.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Para quem é */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-blue-900 text-center mb-4">
            Soluções para empresas, governos, instituições e organizadores
          </h2>
          <p className="text-lg text-gray-600 text-center mb-16 max-w-2xl mx-auto">
            que precisam transformar diversidade em execução
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Empresas Privadas */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{color: '#9D4EDD'}}>
                <TrendingUp className="w-6 h-6" style={{color: '#9D4EDD'}} />
                Empresas Privadas
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Compras inclusivas</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Programas ESG e DE&I</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Desenvolvimento de fornecedores diversos</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Relatórios de impacto social</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Eventos corporativos sustentáveis</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Rodadas de negócios com empreendedores diversos</span>
                </li>
              </ul>
            </div>

            {/* Órgãos Públicos */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{color: '#9D4EDD'}}>
                <Target className="w-6 h-6" style={{color: '#FF9500'}} />
                Órgãos Públicos e Instituições
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Validação de políticas afirmativas</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Monitoramento de impacto</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Programas de inclusão produtiva</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Chamadas públicas e editais</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Programas de desenvolvimento econômico</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Eventos de conexão econômica</span>
                </li>
              </ul>
            </div>

            {/* Organizadores de Eventos */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{color: '#9D4EDD'}}>
                <Zap className="w-6 h-6" style={{color: '#FF9500'}} />
                Organizadores de Eventos
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Eventos sustentáveis</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Rodadas de negócios</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Feiras de diversidade</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Ativações com relatório de impacto</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Controle de evidências antes, durante e depois</span>
                </li>
              </ul>
            </div>

            {/* Empreendedores Diversos */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{color: '#9D4EDD'}}>
                <Handshake className="w-6 h-6" style={{color: '#9D4EDD'}} />
                Empreendedores Diversos
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Acesso a oportunidades comerciais</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Participação em rodadas estruturadas</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Visibilidade qualificada</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Apresentação para compradores</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>Possibilidade de comprovação de impacto</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Resultados e Credibilidade */}
      <section id="results" className="py-20 bg-gradient-to-b from-white to-purple-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4" style={{color: '#9D4EDD'}}>
            Trajetória que reduz risco de adoção
          </h2>
          <p className="text-lg text-gray-600 text-center mb-16 max-w-2xl mx-auto">
            A Diversidade.io não atua apenas na intenção. Atua na operação: busca, curadoria, certificação, conexão, rodadas, mensuração e evidência.
          </p>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 text-center hover:shadow-xl transition-shadow" style={{borderColor: '#9D4EDD'}}>
              <div className="text-5xl font-bold mb-2" style={{color: '#9D4EDD'}}>209 mil</div>
              <p className="text-gray-700 font-medium">Empreendedores negros mapeados no Brasil</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 text-center hover:shadow-xl transition-shadow" style={{borderColor: '#FF9500'}}>
              <div className="text-5xl font-bold mb-2" style={{color: '#FF9500'}}>53</div>
              <p className="text-gray-700 font-medium">Negócios gerados pela plataforma</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 text-center hover:shadow-xl transition-shadow" style={{borderColor: '#FF9500'}}>
              <div className="text-5xl font-bold mb-2" style={{color: '#FF9500'}}>R$ 8,34M</div>
              <p className="text-gray-700 font-medium">Volume de negócios gerado</p>
            </div>
          </div>

          {/* Additional Credentials */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-purple-50 to-white p-8 rounded-xl" style={{border: '1px solid #E6D5FF'}}>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{color: '#9D4EDD'}}>
                <CheckCircle className="w-5 h-5" style={{color: '#FF9500'}} />
                Experiência Comprovada
              </h3>
              <p className="text-gray-700">
                Trabalho com grandes empresas e programas de inclusão produtiva em todo o Brasil, gerando resultados mensuráveis e impacto social real.
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-white p-8 rounded-xl" style={{border: '1px solid #FFE6CC'}}>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{color: '#9D4EDD'}}>
                <CheckCircle className="w-5 h-5" style={{color: '#FF9500'}} />
                Atuação Nacional
              </h3>
              <p className="text-gray-700">
                Presença em múltiplos estados e regiões, conectando empreendedores diversos com oportunidades em toda a cadeia de valor brasileira.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Arquitetura de Valor */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4" style={{color: '#9D4EDD'}}>
            Do dado ao impacto comprovado
          </h2>
          <p className="text-lg text-gray-600 text-center mb-16 max-w-3xl mx-auto">
            Quando uma empresa contrata apenas uma lista de fornecedores, um evento isolado ou um relatório pontual, a jornada quebra. A Diversidade.io conecta as etapas críticas: origem do dado, qualificação, validação, conexão comercial, geração de negócios e prova de impacto.
          </p>

          {/* Value Architecture Flow */}
          <div className="max-w-2xl mx-auto space-y-4">
            {[
              { title: "Base de fornecedores diversos", icon: "📊" },
              { title: "Curadoria e homologação", icon: "✓" },
              { title: "Reconhecimento e validação", icon: "🔍" },
              { title: "Rodadas e conexão comercial", icon: "🤝" },
              { title: "Negócios gerados", icon: "💼" },
              { title: "Mensuração de impacto social", icon: "📈" },
              { title: "Relatórios, governança e comprovação", icon: "📋" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-12 h-12 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold" style={{backgroundColor: '#9D4EDD'}}>
                  {item.icon}
                </div>
                <div className="flex-1 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <p className="font-semibold text-gray-900">{item.title}</p>
                </div>
                {idx < 6 && (
                  <div className="w-1 h-8 rounded-full -ml-2 -mr-2" style={{background: 'linear-gradient(to bottom, #9D4EDD, #FF9500)'}}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: CTA Final */}
      <section id="contact" className="py-20 text-white" style={{background: 'linear-gradient(to bottom right, #9D4EDD, #8B2D8B)'}}>
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-6">
            Escolha a plataforma ideal para sua demanda ou integre toda a jornada
          </h2>
          <p className="text-xl text-center mb-12 max-w-3xl mx-auto" style={{color: 'rgba(255,255,255,0.9)'}}>
            A Diversidade.io permite que sua organização comece por uma necessidade específica e evolua para uma estratégia integrada de inclusão produtiva com dados, governança e comprovação.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Button asChild className="bg-white hover:bg-gray-100 h-12 px-6" style={{color: '#9D4EDD'}}>
              <a href="https://www.impactosocial.com.br" target="_blank" rel="noopener noreferrer">
                Impacto Social
              </a>
            </Button>
            <Button asChild className="bg-white hover:bg-gray-100 h-12 px-6" style={{color: '#9D4EDD'}}>
              <a href="https://www.reconhecimentoracial.com.br" target="_blank" rel="noopener noreferrer">
                Reconhecimento Racial
              </a>
            </Button>
            <Button asChild className="bg-white hover:bg-gray-100 h-12 px-6" style={{color: '#9D4EDD'}}>
              <a href="https://www.eventosustentavel.com.br" target="_blank" rel="noopener noreferrer">
                Evento Sustentável
              </a>
            </Button>
            <Button asChild className="bg-white hover:bg-gray-100 h-12 px-6" style={{color: '#9D4EDD'}}>
              <a href="https://www.diversidade.io" target="_blank" rel="noopener noreferrer">
                Curadoria de Fornecedores
              </a>
            </Button>
            <Button asChild className="bg-white hover:bg-gray-100 h-12 px-6" style={{color: '#9D4EDD'}}>
              <a href="https://www.rodadasinclusivas.com.br" target="_blank" rel="noopener noreferrer">
                Rodadas Inclusivas
              </a>
            </Button>
          </div>

          {/* Contact Info */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 max-w-2xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-6">Falar com a Diversidade.io</h3>
            <div className="space-y-3">
              <p className="text-lg">
                <strong>Marcelo Arruda</strong>
              </p>
              <p style={{color: 'rgba(255,255,255,0.9)'}}>
                <a href="tel:+5511991999942" className="hover:text-white transition-colors">
                  +55 11 99199 9942
                </a>
              </p>
              <p style={{color: 'rgba(255,255,255,0.9)'}}>
                <a href="mailto:marcelo.arruda@diversidade.io" className="hover:text-white transition-colors">
                  marcelo.arruda@diversidade.io
                </a>
              </p>
              <p style={{color: 'rgba(255,255,255,0.9)'}}>São Paulo, Brasil • Atendimento nacional</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* Logo & Description */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">D</span>
                </div>
                <span className="font-bold text-lg text-white">Diversidade.io</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Tecnologia, curadoria e dados para transformar diversidade em negócio, impacto e evidência.
              </p>
            </div>

            {/* Platforms Links */}
            <div>
              <h4 className="font-bold text-white mb-4">Plataformas</h4>
              <ul className="space-y-2">
                <li>
                  <a href="https://www.impactosocial.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Impacto Social
                  </a>
                </li>
                <li>
                  <a href="https://www.reconhecimentoracial.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Reconhecimento Racial
                  </a>
                </li>
                <li>
                  <a href="https://www.eventosustentavel.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Evento Sustentável
                  </a>
                </li>
                <li>
                  <a href="https://www.diversidade.io" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Diversidade.io
                  </a>
                </li>
                <li>
                  <a href="https://www.rodadasinclusivas.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Rodadas Inclusivas
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-white mb-4">Contato</h4>
              <p className="text-gray-400 mb-2">Marcelo Arruda</p>
              <p className="text-gray-400 mb-4">
                <a href="tel:+5511991999942" className="hover:text-white transition-colors">
                  +55 11 99199 9942
                </a>
              </p>
              <p className="text-gray-400">
                <a href="mailto:marcelo.arruda@diversidade.io" className="hover:text-white transition-colors">
                  marcelo.arruda@diversidade.io
                </a>
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-gray-800 pt-8 text-center text-gray-500">
            <p>&copy; 2024 Diversidade.io. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Icon components for pain points
function Search({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
