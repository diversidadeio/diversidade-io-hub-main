import { Link } from "wouter";
import logoImage from "@/assets/logo.png";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Logo Diversidade.io" className="h-10 w-auto object-contain" />
            <span className="font-bold text-lg" style={{color: '#7030A0'}}>Diversidade.io</span>
          </div>

          <Button asChild variant="ghost" className="text-gray-700 hover:text-purple-700">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center" style={{color: '#7030A0'}}>
            Política de Privacidade
          </h1>
          
          <div className="prose prose-purple max-w-none text-gray-700 space-y-6">
            <p className="font-medium text-gray-500">Versão 1.0 — maio de 2026</p>
            <p className="font-medium text-gray-500">Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais — LGPD</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>1. GLOSSÁRIO</h2>
            <p>Para fins desta Política de Privacidade, consideram-se:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>ANPD:</strong> Autoridade Nacional de Proteção de Dados, órgão responsável por zelar, implementar e fiscalizar o cumprimento da LGPD no Brasil.</li>
              <li><strong>Controlador:</strong> pessoa natural ou jurídica a quem competem as decisões referentes ao tratamento de dados pessoais. Conforme o contexto de uso da plataforma, a Diversidade.io poderá atuar como controladora ou operadora, especialmente quando prestar serviços a empresas contratantes.</li>
              <li><strong>Contratante ou Cliente:</strong> pessoa jurídica, empresa, universidade, órgão público ou entidade que contrata a Diversidade.io para utilização da plataforma em processos de heteroidentificação, diversidade, inclusão, auditoria ou análise de impacto social.</li>
              <li><strong>Dado pessoal:</strong> informação relacionada a pessoa natural identificada ou identificável.</li>
              <li><strong>Dado pessoal sensível:</strong> dado pessoal sobre origem racial ou étnica, convicção religiosa, opinião política, filiação sindical, dado referente à saúde ou à vida sexual, dado genético ou biométrico, quando vinculado a uma pessoa natural.</li>
              <li><strong>Dado biométrico:</strong> dado relacionado a características físicas, fisiológicas ou comportamentais de uma pessoa natural, incluindo imagem facial utilizada para análise automatizada ou assistida.</li>
              <li><strong>Dado pseudonimizado:</strong> dado tratado de forma que não possa ser atribuído diretamente a um titular sem o uso de informação adicional mantida separadamente. Dados pseudonimizados continuam sendo dados pessoais segundo a LGPD.</li>
              <li><strong>DPO ou Encarregado de Proteção de Dados:</strong> pessoa indicada para atuar como canal de comunicação entre a Diversidade.io, os titulares dos dados, os contratantes e a ANPD.</li>
              <li><strong>LGPD:</strong> Lei nº 13.709/2018, Lei Geral de Proteção de Dados Pessoais.</li>
              <li><strong>Operador:</strong> pessoa natural ou jurídica que realiza o tratamento de dados pessoais em nome do controlador.</li>
              <li><strong>Titular:</strong> pessoa natural a quem se referem os dados pessoais tratados.</li>
              <li><strong>Tratamento de dados pessoais:</strong> toda operação realizada com dados pessoais, como coleta, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, armazenamento, eliminação, avaliação, controle, modificação, comunicação, transferência, difusão ou extração.</li>
              <li><strong>Heteroidentificação racial automatizada ou assistida:</strong> procedimento tecnológico utilizado para apoiar processos de avaliação racial, diversidade, inclusão ou políticas afirmativas, podendo envolver análise de imagem facial, dados declaratórios e informações complementares fornecidas pelo titular ou pelo contratante.</li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>2. OBJETIVO E ABRANGÊNCIA</h2>
            <h3 className="text-xl font-semibold mt-6 mb-2">2.1. Objetivo</h3>
            <p>
              Esta Política de Privacidade tem como objetivo informar, de forma clara e transparente, como a Diversidade.io coleta, utiliza, armazena, compartilha, protege e elimina dados pessoais no âmbito de sua plataforma tecnológica voltada à diversidade, inclusão, heteroidentificação racial automatizada ou assistida, auditoria e mensuração de impacto social.
            </p>
            <p>
              A Diversidade.io compromete-se a observar os princípios da LGPD, incluindo finalidade, adequação, necessidade, transparência, segurança, prevenção, não discriminação, responsabilização e prestação de contas.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-2">2.2. Abrangência</h3>
            <p>Esta Política aplica-se a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>usuários da plataforma Diversidade.io;</li>
              <li>candidatos, colaboradores, participantes ou pessoas indicadas por contratantes para processos de heteroidentificação, diversidade ou inclusão;</li>
              <li>representantes, administradores e colaboradores de empresas contratantes;</li>
              <li>pessoas que entram em contato com a Diversidade.io por canais oficiais;</li>
              <li>qualquer titular de dados pessoais tratado no contexto dos serviços oferecidos pela Diversidade.io.</li>
            </ul>
            <p>
              A plataforma Diversidade.io não possui como finalidade navegação indoor, localização em ambientes fechados, mapas internos, rotas, sensores de posicionamento ou funcionalidades similares. Assim, esta Política não contempla coleta de dados de localização para navegação indoor.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>3. IDENTIFICAÇÃO DO CONTROLADOR E CANAL DE PRIVACIDADE</h2>
            <p>O responsável pela plataforma é:</p>
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 my-4">
              <p><strong>Diversidade.io</strong></p>
              <p>Razão social: Insight Soluções Inteligentes Ltda</p>
              <p>CNPJ: 20.112.949/0001-90</p>
              <p>Endereço comercial: Rua José Janarelli 75</p>
              <p>E-mail para privacidade: <a href="mailto:adm@diversidade.io" className="text-purple-600 hover:underline">adm@diversidade.io</a></p>
              <p className="mt-2 text-sm text-gray-600">Empresa de tecnologia e impacto social com sede em São Paulo, Brasil.</p>
            </div>
            
            <p><strong>Canal oficial de privacidade / DPO:</strong> George Miguel Pereira Arruda da Costa</p>
            <p><strong>E-mail:</strong> <a href="mailto:adm@diversidade.io" className="text-purple-600 hover:underline">adm@diversidade.io</a></p>
            <p className="mt-4">
              Em alguns contextos, especialmente quando a Diversidade.io presta serviços a empresas, universidades, órgãos públicos ou outras organizações, o contratante poderá atuar como controlador dos dados pessoais, cabendo à Diversidade.io atuar como operadora, conforme as instruções documentadas do contratante e os contratos aplicáveis.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>4. PAPÉIS E RESPONSABILIDADES</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-2">4.1. Responsabilidades da Diversidade.io</h3>
            <p>A Diversidade.io compromete-se a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>tratar dados pessoais apenas para finalidades legítimas, específicas, explícitas e informadas;</li>
              <li>adotar medidas técnicas e organizacionais de segurança;</li>
              <li>limitar a coleta ao mínimo necessário para a prestação dos serviços;</li>
              <li>manter controles de acesso e mecanismos de proteção adequados;</li>
              <li>orientar seus colaboradores e prestadores sobre boas práticas de privacidade;</li>
              <li>apoiar, quando aplicável, o atendimento de solicitações de titulares;</li>
              <li>registrar, avaliar e tratar incidentes de segurança envolvendo dados pessoais;</li>
              <li>revisar periodicamente esta Política de Privacidade.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-2">4.2. Responsabilidades do contratante</h3>
            <p>Quando a plataforma for utilizada por uma organização contratante, esta será responsável por:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>informar os titulares sobre a utilização da plataforma;</li>
              <li>assegurar a existência de base legal adequada para o tratamento de dados pessoais e dados pessoais sensíveis;</li>
              <li>obter consentimentos, autorizações ou declarações necessárias, quando aplicável;</li>
              <li>garantir que o uso da plataforma esteja vinculado a finalidade legítima;</li>
              <li>evitar o envio de dados excessivos, desnecessários ou incompatíveis com a finalidade contratada;</li>
              <li>responder por decisões finais tomadas em processos seletivos, cotas, políticas afirmativas, diversidade, inclusão ou auditoria, quando tais decisões forem de sua competência.</li>
            </ul>
            <p>
              A Diversidade.io não deve ser utilizada para práticas discriminatórias, abusivas, ilegais ou incompatíveis com a LGPD e demais normas aplicáveis.
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>5. DADOS PESSOAIS COLETADOS</h2>
            <p>A Diversidade.io poderá coletar e tratar diferentes categorias de dados pessoais, conforme a funcionalidade utilizada e a relação do titular com a plataforma.</p>
            
            <h3 className="text-xl font-semibold mt-6 mb-2">5.1. Dados cadastrais e de identificação</h3>
            <p>Podem ser coletados:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>nome completo; e-mail; telefone; CPF ou CNPJ, quando necessário;</li>
              <li>empresa ou organização vinculada; cargo ou função;</li>
              <li>dados de login, autenticação e perfil de acesso.</li>
            </ul>
            <p><strong>Finalidades principais:</strong> identificação, autenticação, comunicação, gestão de conta, faturamento, suporte e execução contratual.</p>
            <p><strong>Base legal provável:</strong> execução de contrato, procedimentos preliminares relacionados a contrato, cumprimento de obrigação legal ou legítimo interesse, conforme o caso.</p>

            <h3 className="text-xl font-semibold mt-6 mb-2">5.2. Dados sensíveis relacionados à diversidade e heteroidentificação</h3>
            <p>Mediante aceite, consentimento ou outra base legal aplicável, a Diversidade.io poderá tratar dados pessoais sensíveis, tais como:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>imagem facial;</li>
              <li>dados biométricos extraídos ou analisados a partir da imagem facial;</li>
              <li>autodeclaração racial ou étnica;</li>
              <li>resultado de análise de heteroidentificação automatizada ou assistida;</li>
              <li>histórico de análises realizadas na plataforma;</li>
              <li>informações relacionadas a diversidade, inclusão ou políticas afirmativas, quando fornecidas pelo titular ou pelo contratante.</li>
            </ul>
            <p><strong>Finalidades principais:</strong> apoiar processos de heteroidentificação racial, auditoria, políticas afirmativas, diversidade, inclusão, validação de informações, geração de histórico de uso e relatórios compatíveis com a finalidade contratada.</p>
            <p><strong>Bases legais possíveis:</strong> consentimento específico e destacado do titular; cumprimento de obrigação legal ou regulatória; exercício regular de direitos; execução de políticas públicas, quando aplicável; ou outras hipóteses previstas na LGPD para tratamento de dados sensíveis.</p>
            <p>O tratamento de dados sensíveis será realizado com cuidado reforçado, observando minimização, segurança, controle de acesso e limitação de finalidade.</p>

            <h3 className="text-xl font-semibold mt-6 mb-2">5.3. Dados de colaboradores e representantes de empresas contratantes</h3>
            <p>Podem ser tratados: nome; e-mail corporativo; cargo; empresa; permissões de acesso; registros de uso administrativo da plataforma.</p>
            <p><strong>Finalidades principais:</strong> gestão de usuários corporativos, controle de acesso, suporte, auditoria, comunicação e execução do contrato com o contratante.</p>

            <h3 className="text-xl font-semibold mt-6 mb-2">5.4. Dados técnicos e registros de uso</h3>
            <p>A Diversidade.io poderá coletar dados técnicos necessários ao funcionamento, segurança e melhoria da plataforma, tais como: endereço IP; data e hora de acesso; logs de autenticação; tipo de navegador ou dispositivo; eventos de erro; registros de atividade dentro da plataforma; informações de segurança e prevenção a fraude.</p>
            <p>A Diversidade.io não coleta dados de localização para navegação indoor, rotas internas, mapas de ambientes fechados ou sensores de posicionamento.</p>

            <h3 className="text-xl font-semibold mt-6 mb-2">5.5. Dados de suporte e comunicação</h3>
            <p>Quando o titular ou contratante entra em contato com a Diversidade.io, poderão ser tratados: nome; e-mail; conteúdo da mensagem; anexos enviados voluntariamente; histórico de atendimento; informações necessárias para solução da solicitação.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>6. FINALIDADES DO TRATAMENTO</h2>
            <p>Os dados pessoais poderão ser tratados para as seguintes finalidades:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>criação e gestão de contas; autenticação de usuários; prestação dos serviços contratados;</li>
              <li>apoio a processos de heteroidentificação racial automatizada ou assistida;</li>
              <li>auditoria e rastreabilidade de análises;</li>
              <li>geração de relatórios para contratantes, preferencialmente de forma agregada ou anonimizada;</li>
              <li>cálculo de indicadores de diversidade e impacto social;</li>
              <li>prevenção a fraudes, usos indevidos e acessos não autorizados;</li>
              <li>atendimento a solicitações de titulares; suporte técnico e operacional;</li>
              <li>cumprimento de obrigações legais, regulatórias ou contratuais;</li>
              <li>defesa de direitos da Diversidade.io, dos contratantes ou de terceiros;</li>
              <li>melhoria da plataforma, segurança e desempenho.</li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>7. BASES LEGAIS</h2>
            <div className="overflow-x-auto my-6">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Categoria de dado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Finalidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Base legal possível</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Nome, e-mail e dados cadastrais</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Identificação, acesso e comunicação</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Execução de contrato ou procedimentos preliminares</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">CPF/CNPJ</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Validação cadastral, faturamento e obrigações legais</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Execução de contrato e cumprimento de obrigação legal</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Imagem facial e dados biométricos</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Heteroidentificação racial automatizada ou assistida</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Consentimento específico; cumprimento de obrigação legal; exercício regular de direitos; ou outra hipótese do art. 11 da LGPD aplicável ao caso</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Autodeclaração racial ou étnica</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Processos de diversidade, inclusão e políticas afirmativas</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Consentimento específico; cumprimento de obrigação legal; políticas públicas; exercício regular de direitos; ou outra hipótese legal aplicável</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Histórico de análises</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Auditoria, rastreabilidade e segurança</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Execução de contrato, legítimo interesse, cumprimento legal ou exercício regular de direitos</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Logs e dados técnicos</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Segurança, prevenção a fraude e melhoria da plataforma</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Legítimo interesse, execução de contrato ou cumprimento legal</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900">Dados de suporte</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Atendimento e solução de solicitações</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Execução de contrato, legítimo interesse ou consentimento, conforme o caso</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>Quando o tratamento se basear em consentimento, o titular poderá revogá-lo a qualquer momento, observados os efeitos da revogação e as hipóteses legais de retenção.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>8. DADOS PESSOAIS SENSÍVEIS</h2>
            <p>A Diversidade.io reconhece que dados biométricos, imagens faciais utilizadas para análise, informações raciais ou étnicas e dados relacionados a diversidade podem ser considerados dados pessoais sensíveis pela LGPD.</p>
            <p>Por isso, a Diversidade.io adota cuidados adicionais, incluindo:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>coleta limitada ao necessário; uso vinculado à finalidade informada; restrição de acesso;</li>
              <li>registros de auditoria; segurança em trânsito e em repouso, quando aplicável;</li>
              <li>avaliação de riscos; retenção pelo prazo necessário;</li>
              <li>eliminação ou anonimização quando cabível;</li>
              <li>medidas para evitar uso discriminatório, abusivo ou incompatível com a finalidade contratada.</li>
            </ul>
            <p>A Diversidade.io não recomenda que contratantes utilizem os resultados da plataforma como único critério para decisões que produzam efeitos relevantes sobre titulares sem revisão humana, contextualização e observância das normas aplicáveis.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>9. DECISÕES AUTOMATIZADAS, IA E REVISÃO HUMANA</h2>
            <p>A Diversidade.io poderá utilizar tecnologias de inteligência artificial, incluindo soluções de terceiros, para apoiar análises de heteroidentificação racial, validação de informações e geração de indicadores.</p>
            <p>Quando houver tratamento automatizado de dados pessoais que possa afetar interesses do titular, a Diversidade.io e/ou o contratante, conforme o papel de cada parte, deverão observar os direitos previstos na LGPD, incluindo o direito de solicitar informações sobre critérios e procedimentos utilizados e, quando aplicável, revisão de decisões automatizadas.</p>
            <p>A análise automatizada deve ser compreendida como ferramenta de apoio. A decisão final em processos seletivos, políticas afirmativas, validações ou procedimentos institucionais caberá ao contratante, salvo disposição contratual diversa.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>10. COMPARTILHAMENTO DE DADOS</h2>
            <p>A Diversidade.io poderá compartilhar dados pessoais apenas quando necessário e compatível com as finalidades desta Política, incluindo:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>com empresas contratantes, quando os dados forem tratados no contexto dos serviços contratados;</li>
              <li>com provedores de nuvem, infraestrutura, segurança, autenticação e armazenamento;</li>
              <li>com fornecedores de tecnologia, incluindo ferramentas de inteligência artificial, quando necessários à prestação do serviço;</li>
              <li>com prestadores de suporte, auditoria, jurídico, contábil ou segurança da informação;</li>
              <li>com autoridades públicas, administrativas ou judiciais, quando houver obrigação legal, ordem válida ou necessidade de defesa de direitos;</li>
              <li>com terceiros autorizados pelo titular ou pelo contratante, conforme o caso.</li>
            </ul>
            <p>A Diversidade.io não vende dados pessoais.</p>
            <p>Relatórios para contratantes devem ser, sempre que possível, agregados, anonimizados ou pseudonimizados, observando que dados pseudonimizados continuam sendo dados pessoais segundo a LGPD.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>11. TRANSFERÊNCIAS INTERNACIONAIS</h2>
            <p>Os dados pessoais poderão ser armazenados ou processados fora do Brasil por provedores de nuvem, infraestrutura, inteligência artificial, segurança ou suporte técnico.</p>
            <p>Nesses casos, a Diversidade.io adotará medidas compatíveis com a LGPD, tais como cláusulas contratuais, controles de segurança, avaliação de fornecedores e mecanismos adequados para proteção dos dados pessoais.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>12. SEGURANÇA DA INFORMAÇÃO</h2>
            <p>A Diversidade.io adota medidas técnicas e organizacionais para proteger dados pessoais contra acessos não autorizados, perda, destruição, alteração, comunicação indevida ou qualquer forma de tratamento inadequado.</p>
            <p>Entre as medidas adotadas, poderão estar: criptografia em trânsito e em repouso; controle de acesso por perfil; autenticação e gestão de credenciais; segregação de ambientes; logs e trilhas de auditoria; políticas de minimização de dados; monitoramento de vulnerabilidades; revisão periódica de permissões; treinamento e orientação interna.</p>
            <p>Embora a Diversidade.io adote medidas razoáveis de segurança, nenhum sistema é totalmente imune a riscos. Em caso de incidente relevante envolvendo dados pessoais, serão adotadas medidas de resposta, contenção, investigação e comunicação, quando aplicável.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>13. INCIDENTES DE SEGURANÇA</h2>
            <p>Em caso de incidente relevante envolvendo dados pessoais, poderão ser adotadas medidas como: bloqueio preventivo; investigação interna; avaliação de riscos aos titulares; comunicação aos afetados, quando aplicável; comunicação à ANPD, quando aplicável; medidas corretivas; revisão de controles internos; registro do incidente e das providências adotadas.</p>
            <p>A comunicação de incidentes observará a LGPD, regulamentações da ANPD e demais normas aplicáveis.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>14. DIREITOS DOS TITULARES</h2>
            <p>Nos termos da LGPD, o titular poderá solicitar:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>confirmação da existência de tratamento; acesso aos dados pessoais;</li>
              <li>correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
              <li>portabilidade dos dados, quando aplicável;</li>
              <li>informação sobre compartilhamento de dados;</li>
              <li>informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;</li>
              <li>revogação do consentimento;</li>
              <li>eliminação de dados tratados com base no consentimento, observadas as hipóteses legais de retenção;</li>
              <li>oposição a tratamento realizado com fundamento em bases legais aplicáveis, quando houver descumprimento da LGPD;</li>
              <li>revisão de decisões tomadas unicamente com base em tratamento automatizado de dados pessoais, quando aplicável.</li>
            </ul>
            <p>As solicitações deverão ser encaminhadas ao canal oficial de privacidade: <a href="mailto:adm@diversidade.io" className="text-purple-600 hover:underline">adm@diversidade.io</a></p>
            <p>As solicitações serão respondidas em prazo razoável, observado o disposto na LGPD e regulamentações aplicáveis.</p>
            <p>Quando a Diversidade.io atuar como operadora em nome de um contratante, poderá encaminhar a solicitação ao respectivo controlador ou apoiá-lo no atendimento, conforme o contrato e a legislação aplicável.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>15. RETENÇÃO E ELIMINAÇÃO DE DADOS</h2>
            <p>Os dados pessoais serão mantidos apenas pelo tempo necessário para cumprir as finalidades descritas nesta Política, obrigações legais, regulatórias ou contratuais, ou para exercício regular de direitos.</p>
            <p>Após o término da finalidade ou do prazo aplicável, os dados poderão ser: eliminados de forma segura; anonimizados; bloqueados; mantidos pelo prazo necessário para cumprimento de obrigação legal, auditoria, prevenção a fraude, defesa de direitos ou cumprimento contratual.</p>
            <p>O usuário poderá solicitar encerramento da conta e exclusão dos dados associados através do canal oficial de privacidade.</p>
            <p>A exclusão poderá não ser imediata quando houver obrigação legal, necessidade de preservação de evidências, cumprimento contratual, auditoria, prevenção a fraude ou exercício regular de direitos.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>16. CRIANÇAS E ADOLESCENTES</h2>
            <p>A plataforma Diversidade.io não é destinada a crianças.</p>
            <p>Caso haja tratamento de dados de adolescentes ou menores de idade no contexto de processos conduzidos por contratantes, o contratante deverá assegurar a existência de base legal adequada, o fornecimento de informações claras e, quando necessário, a autorização dos pais ou responsáveis legais.</p>
            <p>Caso sejam identificados dados coletados inadvertidamente de menores sem autorização necessária, a Diversidade.io poderá removê-los ou solicitar validação adicional.</p>
            <p>O tratamento de dados de crianças e adolescentes deverá observar o princípio do melhor interesse, a LGPD e a legislação aplicável.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>17. COOKIES, TECNOLOGIAS E REGISTROS TÉCNICOS</h2>
            <p>A Diversidade.io poderá utilizar cookies, tokens, logs, ferramentas de autenticação, analytics, segurança e tecnologias equivalentes para: manter sessões autenticadas; proteger contas contra acessos indevidos; registrar erros e falhas; medir desempenho da plataforma; melhorar a experiência do usuário; prevenir fraudes e abusos.</p>
            <p>Essas tecnologias serão utilizadas de forma limitada ao necessário, respeitando as configurações disponíveis e a legislação aplicável.</p>
            <p>A Diversidade.io não utiliza cookies ou tecnologias equivalentes para navegação indoor, rotas em ambientes fechados, mapas internos ou rastreamento físico de deslocamento.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>18. MARKETING E COMUNICAÇÕES</h2>
            <p>A Diversidade.io poderá enviar comunicações operacionais relacionadas à conta, segurança, uso da plataforma, suporte ou contrato.</p>
            <p>Comunicações de marketing, novidades ou conteúdos promocionais serão enviadas apenas quando houver base legal adequada, como consentimento ou legítimo interesse, conforme o caso.</p>
            <p>O titular poderá solicitar o descadastramento de comunicações promocionais, sem prejuízo do recebimento de comunicações essenciais ao funcionamento da plataforma ou cumprimento contratual.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>19. RELATÓRIOS, INDICADORES E DADOS AGREGADOS</h2>
            <p>A Diversidade.io poderá gerar relatórios, estatísticas e indicadores para contratantes, incluindo dados sobre diversidade, inclusão, auditoria e impacto social.</p>
            <p>Sempre que possível, esses relatórios serão apresentados de forma agregada, anonimizada ou pseudonimizada.</p>
            <p>A Diversidade.io deverá evitar a divulgação de informações que permitam identificação indevida de titulares, especialmente quando envolver dados pessoais sensíveis.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>20. LIMITAÇÕES DE USO E NÃO DISCRIMINAÇÃO</h2>
            <p>A plataforma Diversidade.io deve ser utilizada apenas para finalidades legítimas, informadas e compatíveis com a legislação aplicável.</p>
            <p>É vedado utilizar a plataforma para: discriminação ilegal; perseguição, exclusão ou tratamento abusivo de titulares; tomada de decisões incompatíveis com direitos fundamentais; criação de perfis discriminatórios; uso de dados sensíveis sem base legal adequada; coleta excessiva ou desnecessária de dados pessoais; finalidades diferentes daquelas informadas ao titular.</p>
            <p>A Diversidade.io poderá suspender, restringir ou encerrar o acesso de contratantes ou usuários que utilizem a plataforma de forma incompatível com esta Política, com a LGPD ou com os contratos aplicáveis.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>21. ATUALIZAÇÕES DESTA POLÍTICA</h2>
            <p>Esta Política poderá ser atualizada periodicamente para refletir alterações legais, regulatórias, contratuais, operacionais ou tecnológicas.</p>
            <p>A data da última atualização será sempre indicada no início do documento.</p>
            <p>Mudanças relevantes poderão ser comunicadas aos usuários e contratantes por meios apropriados, como e-mail, aviso na plataforma ou outro canal oficial.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>22. RESUMO EM LINGUAGEM SIMPLES</h2>
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-100 mb-10">
              <ul className="list-disc pl-6 space-y-3">
                <li>A Diversidade.io é uma plataforma de tecnologia voltada à diversidade, inclusão, heteroidentificação racial automatizada ou assistida e mensuração de impacto social.</li>
                <li>Para funcionar, a plataforma pode tratar dados como nome, e-mail, CPF/CNPJ, dados de acesso, imagem facial, autodeclaração racial ou étnica e histórico de análises.</li>
                <li>Alguns desses dados são sensíveis pela LGPD e, por isso, recebem proteção reforçada.</li>
                <li>A Diversidade.io não coleta dados de navegação indoor, localização para rotas internas, mapas de ambientes fechados ou sensores de posicionamento.</li>
                <li>Você pode solicitar acesso, correção, exclusão, informações sobre uso dos seus dados, revogação de consentimento e outros direitos previstos na LGPD pelo e-mail: <a href="mailto:adm@diversidade.io" className="text-purple-600 hover:underline">adm@diversidade.io</a></li>
                <li>Caso ocorra incidente relevante com dados pessoais, a Diversidade.io adotará medidas de contenção, investigação, comunicação e correção, conforme a LGPD e as normas da ANPD.</li>
                <li>Ao utilizar a plataforma Diversidade.io, você declara estar ciente desta Política de Privacidade. Caso não concorde, recomendamos que não utilize a plataforma e entre em contato para esclarecimentos.</li>
              </ul>
            </div>
            
          </div>
        </div>
      </main>

      {/* Footer minimalista */}
      <footer className="bg-gray-900 text-gray-300 py-8 text-center border-t border-gray-800">
        <div className="container mx-auto px-4">
          <p>&copy; 2026 Diversidade.io. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
