import { Link } from "wouter";
import logoImage from "@/assets/logo.png";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermosUso() {
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
            Termos e Condições de Uso
          </h1>
          
          <div className="prose prose-purple max-w-none text-gray-700 space-y-6">
            <p className="font-medium text-gray-500">PLATAFORMA DIVERSIDADE.IO</p>
            <p className="font-medium text-gray-500">Versão provisória 1.0 — Última atualização: julho de 2026</p>

            <p>Estes Termos e Condições de Uso, doravante denominados “Termos”, regulam o acesso e a utilização do site, sistemas, aplicações, painéis administrativos, APIs e demais serviços tecnológicos disponibilizados pela Diversidade.io.</p>
            <p>Ao acessar, cadastrar-se ou utilizar a plataforma, o usuário declara que leu, compreendeu e concordou com estes Termos e com a Política de Privacidade da Diversidade.io.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>1. IDENTIFICAÇÃO DA DIVERSIDADE.IO</h2>
            <p>A plataforma é disponibilizada pela:</p>
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 my-4">
              <p><strong>Nome empresarial:</strong> INSIGHT SOLUCOES INTELIGENTES LTDA.</p>
              <p><strong>Nome fantasia:</strong> Diversidade.io</p>
              <p><strong>CNPJ:</strong> 20.112.949/0001-90</p>
              <p><strong>Endereço:</strong> Rua José Jannarelli n° 75 SALA 213 ANDAR 2, CEP 05.615-000, VILA PROGREDIOR, SAO PAULO, SP</p>
              <p><strong>Cidade:</strong> São Paulo/SP</p>
              <p><strong>E-mail de atendimento:</strong> <a href="mailto:suporte@diversidade.io" className="text-purple-600 hover:underline">suporte@diversidade.io</a></p>
              <p><strong>Canal de privacidade e proteção de dados:</strong> <a href="mailto:adm@diversidade.io" className="text-purple-600 hover:underline">adm@diversidade.io</a></p>
            </div>
            <p>Para fins destes Termos, a empresa será denominada simplesmente “Diversidade.io”.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>2. DEFINIÇÕES</h2>
            <p>Para facilitar a compreensão destes Termos, serão utilizadas as seguintes definições:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Contratante ou Cliente:</strong> pessoa jurídica, empresa, universidade, órgão público, entidade ou instituição que contrata os serviços da Diversidade.io.</li>
              <li><strong>Usuário corporativo:</strong> pessoa natural autorizada pelo Contratante a acessar o painel administrativo ou utilizar funcionalidades da plataforma.</li>
              <li><strong>Participante ou Titular:</strong> candidato, colaborador, estudante, beneficiário ou outra pessoa natural cujos dados sejam inseridos ou tratados por meio da plataforma.</li>
              <li><strong>Plataforma:</strong> conjunto de sistemas, sites, painéis, aplicações, APIs e ferramentas tecnológicas oferecidas pela Diversidade.io.</li>
              <li><strong>Análise:</strong> processamento realizado pela plataforma para apoiar procedimentos de heteroidentificação, diversidade, inclusão, auditoria ou mensuração de impacto social.</li>
              <li><strong>Resultado:</strong> informação, classificação, pontuação, indicação ou relatório gerado pela plataforma a partir dos dados fornecidos.</li>
              <li><strong>Dados pessoais sensíveis:</strong> informações relacionadas, entre outros aspectos, à origem racial ou étnica e dados biométricos vinculados a uma pessoa natural.</li>
              <li><strong>Inteligência artificial ou IA:</strong> tecnologias computacionais utilizadas para analisar informações, imagens e outros dados, gerando resultados de apoio ao usuário.</li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>3. FINALIDADE DA PLATAFORMA</h2>
            <p>A Diversidade.io oferece uma plataforma tecnológica voltada à:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>promoção da diversidade e da inclusão;</li>
              <li>realização ou apoio a procedimentos de heteroidentificação racial;</li>
              <li>análise automatizada ou assistida de imagens faciais;</li>
              <li>auditoria de processos relacionados a políticas afirmativas;</li>
              <li>organização e acompanhamento de procedimentos de diversidade;</li>
              <li>geração de indicadores, relatórios e informações de impacto social;</li>
              <li>apoio a empresas, universidades, órgãos públicos e outras instituições em suas iniciativas de diversidade e inclusão.</li>
            </ul>
            <p>A plataforma poderá utilizar recursos de inteligência artificial e serviços tecnológicos próprios ou fornecidos por terceiros para processar as informações inseridas.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>4. ACEITAÇÃO DOS TERMOS</h2>
            <p>O acesso e a utilização da plataforma atribuem à pessoa a condição de Usuário e representam a aceitação destes Termos.</p>
            <p>O aceite poderá ocorrer mediante:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>criação de conta;</li>
              <li>marcação de caixa de seleção;</li>
              <li>clique em botão de concordância;</li>
              <li>assinatura de contrato;</li>
              <li>envio de dados para análise;</li>
              <li>utilização efetiva da plataforma;</li>
              <li>outro meio capaz de demonstrar a manifestação de vontade do usuário.</li>
            </ul>
            <p>Caso o usuário não concorde com qualquer disposição destes Termos, deverá interromper o acesso e não utilizar a plataforma.</p>
            <p>A aceitação destes Termos não substitui consentimentos específicos ou outras autorizações que possam ser necessárias para o tratamento de dados pessoais sensíveis.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>5. CAPACIDADE E REPRESENTAÇÃO</h2>
            <p>Ao utilizar a plataforma, o usuário declara que:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>possui capacidade legal para aceitar estes Termos;</li>
              <li>tem pelo menos 18 anos de idade, salvo quando o uso por menor estiver devidamente autorizado e for legalmente permitido;</li>
              <li>possui autorização para representar o Contratante, quando atuar em nome de uma pessoa jurídica;</li>
              <li>forneceu informações verdadeiras, completas e atualizadas;</li>
              <li>utilizará a plataforma somente para finalidades legítimas.</li>
            </ul>
            <p>Quando o acesso for realizado por representante, empregado, prestador ou colaborador de uma organização, essa pessoa declara possuir autorização suficiente para utilizar a plataforma em nome do Contratante.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>6. CADASTRO E CONTA DE ACESSO</h2>
            <p>Algumas funcionalidades dependem da criação de uma conta.</p>
            <p>O usuário compromete-se a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>fornecer informações verdadeiras e atualizadas;</li>
              <li>manter seus dados cadastrais corretos;</li>
              <li>proteger sua senha e suas credenciais;</li>
              <li>não compartilhar acessos individuais com terceiros não autorizados;</li>
              <li>comunicar imediatamente qualquer suspeita de acesso indevido;</li>
              <li>responder pelas atividades realizadas por meio de sua conta, salvo quando comprovada falha de segurança imputável à Diversidade.io.</li>
            </ul>
            <p>As contas são pessoais ou vinculadas a usuários corporativos identificados, não podendo ser transferidas sem autorização.</p>
            <p>A Diversidade.io poderá solicitar informações ou documentos adicionais para validar a identidade do usuário, sua representação ou a legitimidade do acesso.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>7. FUNCIONAMENTO DAS ANÁLISES</h2>
            <p>A plataforma poderá processar dados como: imagens faciais; autodeclaração racial ou étnica; informações cadastrais; respostas a formulários; documentos enviados pelo usuário ou Contratante; informações relacionadas ao processo conduzido pelo Contratante.</p>
            <p>Os resultados produzidos pela plataforma possuem natureza auxiliar e devem ser interpretados no contexto específico de cada procedimento.</p>
            <p>A Diversidade.io não garante que análises automatizadas sejam completamente livres de erros, inconsistências, falsos positivos, falsos negativos, vieses ou limitações técnicas.</p>
            <p>Fatores como qualidade da imagem, iluminação, enquadramento, resolução, características técnicas do equipamento e informações incorretas podem afetar o resultado.</p>
            <p>Sempre que a análise puder produzir efeitos relevantes sobre uma pessoa, recomenda-se que o Contratante adote:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Revisão humana apropriada;</li>
              <li>Avaliação contextual;</li>
              <li>Procedimento de contestação;</li>
              <li>Registro da decisão;</li>
              <li>Comunicação clara ao participante;</li>
              <li>Medidas para evitar decisões discriminatórias ou injustas.</li>
            </ul>
            <p>O resultado da plataforma não deverá ser utilizado isoladamente como fundamento automático e definitivo para excluir, reprovar, contratar, demitir, conceder ou negar direitos a uma pessoa.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>8. RESPONSABILIDADES DO CONTRATANTE</h2>
            <p>O Contratante é responsável pela forma como utiliza a plataforma e pelas decisões tomadas a partir dos resultados apresentados.</p>
            <p>São responsabilidades do Contratante:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>definir uma finalidade legítima para o uso da plataforma;</li>
              <li>assegurar a existência de base legal adequada para o tratamento dos dados;</li>
              <li>informar os participantes sobre o procedimento realizado;</li>
              <li>fornecer avisos de privacidade claros;</li>
              <li>obter consentimentos ou autorizações quando necessários;</li>
              <li>verificar a qualidade e a origem dos dados enviados;</li>
              <li>encaminhar apenas dados necessários para a finalidade informada;</li>
              <li>não inserir dados obtidos de forma ilícita;</li>
              <li>estabelecer procedimentos de revisão humana;</li>
              <li>permitir contestação ou recurso quando exigido pela legislação, regulamento, edital ou política aplicável;</li>
              <li>impedir práticas discriminatórias, abusivas ou ilegais;</li>
              <li>proteger os resultados e restringir o acesso às pessoas autorizadas;</li>
              <li>atender aos direitos dos titulares quando atuar como controlador dos dados;</li>
              <li>informar a diversidade.io caso um titular requisitar a remoção de seus dados;</li>
              <li>cumprir as normas relacionadas a processos seletivos, concursos, políticas afirmativas e proteção de dados.</li>
            </ul>
            <p>O Contratante é exclusivamente responsável pelas decisões administrativas, acadêmicas, trabalhistas, seletivas ou institucionais tomadas por sua organização.</p>
            <p>A contratação da plataforma não transfere à Diversidade.io a responsabilidade por definir os critérios legais, normativos ou institucionais utilizados pelo Contratante.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>9. RESPONSABILIDADES DO PARTICIPANTE</h2>
            <p>Quando uma pessoa utilizar a plataforma como candidato, colaborador, estudante, participante ou titular dos dados, deverá:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>fornecer informações verdadeiras;</li>
              <li>utilizar imagens atuais e compatíveis com as orientações fornecidas;</li>
              <li>não se passar por outra pessoa;</li>
              <li>não utilizar imagens, documentos ou informações de terceiros sem autorização;</li>
              <li>respeitar as instruções do procedimento;</li>
              <li>não tentar manipular ou fraudar a análise;</li>
              <li>comunicar eventuais erros ou dificuldades pelos canais disponibilizados.</li>
            </ul>
            <p>O participante poderá solicitar informações sobre o tratamento de seus dados, observada a responsabilidade da Diversidade.io e do respectivo Contratante em cada operação.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>10. DADOS PESSOAIS E DADOS SENSÍVEIS</h2>
            <p>A utilização da plataforma poderá envolver o tratamento de dados pessoais sensíveis, incluindo imagem facial, dados biométricos e informações relacionadas à origem racial ou étnica.</p>
            <p>O tratamento desses dados será realizado conforme a Política de Privacidade da Diversidade.io, os contratos celebrados com os clientes e a legislação aplicável.</p>
            <p>Dependendo da operação realizada:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>a Diversidade.io poderá atuar como controladora dos dados cadastrais de seus próprios usuários;</li>
              <li>o Contratante poderá atuar como controlador dos dados dos candidatos ou participantes;</li>
              <li>a Diversidade.io poderá atuar como operadora ao processar dados seguindo instruções do Contratante.</li>
            </ul>
            <p>Quando o consentimento for utilizado como base legal, ele deverá ser específico, destacado, informado e passível de revogação.</p>
            <p>A simples aceitação destes Termos não deverá ser interpretada como autorização genérica e irrestrita para qualquer tratamento de dados pessoais sensíveis.</p>
            <p>Informações sobre coleta, finalidade, compartilhamento, armazenamento, direitos e eliminação dos dados encontram-se na Política de Privacidade da Diversidade.io.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>11. INTELIGÊNCIA ARTIFICIAL E DECISÕES AUTOMATIZADAS</h2>
            <p>A Diversidade.io poderá utilizar inteligência artificial, modelos estatísticos, reconhecimento de padrões e serviços tecnológicos de terceiros para realizar análises e gerar resultados.</p>
            <p>O usuário reconhece que tecnologias de inteligência artificial possuem limitações e que seus resultados podem variar.</p>
            <p>A Diversidade.io adotará medidas razoáveis para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>avaliar o funcionamento das tecnologias utilizadas;</li>
              <li>reduzir riscos de uso discriminatório;</li>
              <li>proteger os dados processados;</li>
              <li>manter controles de segurança;</li>
              <li>permitir rastreabilidade, quando tecnicamente possível;</li>
              <li>fornecer informações compatíveis com a legislação e com a proteção de seus segredos comercial e industrial.</li>
            </ul>
            <p>O titular poderá solicitar informações sobre os critérios e procedimentos utilizados em decisões automatizadas que afetem seus interesses, nos limites da legislação aplicável.</p>
            <p>Quando houver solicitação de revisão ou contestação, a Diversidade.io poderá encaminhá-la ao Contratante responsável pela decisão ou prestar o suporte necessário, conforme o papel de cada parte.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>12. USOS PROIBIDOS</h2>
            <p>É proibido utilizar a plataforma para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>praticar atos ilícitos; realizar discriminação ilegal; perseguir, constranger ou prejudicar pessoas; criar perfis discriminatórios;</li>
              <li>tomar decisões abusivas ou incompatíveis com direitos fundamentais;</li>
              <li>tratar dados pessoais sem base legal adequada; coletar dados excessivos ou desnecessários;</li>
              <li>enviar imagens ou dados de terceiros sem autorização ou justificativa legal;</li>
              <li>fraudar processos de heteroidentificação; manipular imagens ou informações;</li>
              <li>tentar identificar vulnerabilidades sem autorização; acessar contas ou informações de terceiros;</li>
              <li>disseminar vírus, malware ou códigos maliciosos;</li>
              <li>realizar engenharia reversa, descompilação ou tentativa de extração do código-fonte;</li>
              <li>copiar, comercializar ou sublicenciar a tecnologia;</li>
              <li>realizar testes automatizados que prejudiquem o funcionamento da plataforma;</li>
              <li>utilizar os resultados como único fundamento para decisões de alto impacto sem salvaguardas adequadas;</li>
              <li>violar direitos autorais, marcas, patentes ou outros direitos de propriedade intelectual;</li>
              <li>utilizar a plataforma para finalidade diferente daquela contratada ou informada.</li>
            </ul>
            <p>A Diversidade.io poderá suspender ou bloquear o acesso quando identificar indícios razoáveis de uso proibido, fraude, risco de segurança ou violação destes Termos.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>13. SERVIÇOS E FORNECEDORES TERCEIRIZADOS</h2>
            <p>A plataforma poderá depender de serviços fornecidos por terceiros, incluindo: infraestrutura de nuvem; armazenamento; autenticação; processamento de imagens; inteligência artificial; segurança da informação; envio de mensagens e notificações; monitoramento técnico; suporte e atendimento.</p>
            <p>Entre esses fornecedores poderão estar serviços como o AWS Rekognition ou tecnologias equivalentes.</p>
            <p>A utilização de serviços de terceiros não significa que esses terceiros possam usar livremente os dados processados. O acesso deverá observar contratos, medidas de segurança e as finalidades determinadas para a prestação do serviço.</p>
            <p>Algumas funcionalidades poderão ficar indisponíveis em razão de falhas, atualizações ou alterações realizadas por fornecedores externos.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>14. DISPONIBILIDADE DA PLATAFORMA</h2>
            <p>A Diversidade.io buscará manter a plataforma disponível de forma contínua, mas não garante funcionamento ininterrupto ou livre de falhas.</p>
            <p>O acesso poderá ser temporariamente interrompido em razão de: manutenção preventiva ou corretiva; atualização de sistemas; falhas de internet ou infraestrutura; incidentes de segurança; problemas em serviços de terceiros; caso fortuito ou força maior; determinações legais ou administrativas; necessidade de proteção da plataforma ou dos titulares.</p>
            <p>Sempre que razoavelmente possível, manutenções programadas que afetem de forma relevante o serviço serão comunicadas aos clientes.</p>
            <p>A Diversidade.io poderá modificar, substituir ou descontinuar funcionalidades, observados os contratos comerciais vigentes e os direitos legalmente aplicáveis.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>15. PLANOS, CONTRATAÇÃO E PAGAMENTOS</h2>
            <p>As condições comerciais, valores, limites de uso, prazo, forma de pagamento e funcionalidades contratadas serão estabelecidos em proposta comercial, ordem de serviço, contrato específico ou documento equivalente.</p>
            <p>Em caso de divergência entre estes Termos e um contrato específico assinado entre a Diversidade.io e o Contratante, prevalecerá o contrato específico em relação às condições comerciais e particulares da contratação.</p>
            <p>O atraso no pagamento poderá resultar em: cobrança de encargos previstos no contrato; limitação de funcionalidades; suspensão do acesso; encerramento da contratação, observadas as condições comerciais aplicáveis.</p>
            <p>A suspensão por inadimplência não elimina obrigações vencidas nem autoriza a retenção indevida de dados pessoais.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>16. PROPRIEDADE INTELECTUAL</h2>
            <p>Todos os direitos relacionados à plataforma pertencem à Diversidade.io ou foram devidamente licenciados.</p>
            <p>São protegidos, entre outros: marca Diversidade.io; logotipos; identidade visual; códigos-fonte; códigos executáveis; modelos, métodos e algoritmos; bancos de dados; telas e interfaces; textos; relatórios padronizados; documentos técnicos; materiais gráficos; fluxos, processos e funcionalidades.</p>
            <p>A contratação concede ao usuário apenas uma licença limitada, temporária, revogável, não exclusiva e intransferível para utilizar a plataforma durante o período contratado.</p>
            <p>A contratação não transfere ao usuário qualquer direito de propriedade sobre a tecnologia.</p>
            <p>É proibido copiar, reproduzir, adaptar, distribuir, vender, licenciar, desmontar, realizar engenharia reversa ou criar produto derivado da plataforma sem autorização expressa.</p>
            <p>Os dados e materiais legítimos enviados pelo Contratante continuam pertencendo aos respectivos titulares ou responsáveis, não sendo transferida à Diversidade.io a propriedade desse conteúdo.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>17. CONFIDENCIALIDADE</h2>
            <p>As partes deverão proteger informações confidenciais acessadas em razão da utilização da plataforma.</p>
            <p>São consideradas confidenciais informações como: dados pessoais; resultados individuais; credenciais; documentos internos; informações comerciais; processos seletivos; relatórios não públicos; códigos, métodos e especificações técnicas; informações identificadas como confidenciais.</p>
            <p>As informações confidenciais deverão ser utilizadas somente para a finalidade contratada e compartilhadas apenas com pessoas que precisem conhecê-las.</p>
            <p>Não serão consideradas confidenciais informações que: já sejam públicas sem violação destes Termos; tenham sido legitimamente obtidas de terceiro; tenham divulgação exigida por lei, ordem judicial ou autoridade competente; tenham divulgação expressamente autorizada.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>18. SEGURANÇA DA INFORMAÇÃO</h2>
            <p>A Diversidade.io adotará medidas técnicas e organizacionais razoáveis para proteger a plataforma e os dados tratados.</p>
            <p>Essas medidas poderão incluir: controle de acesso; autenticação; criptografia; segregação de ambientes; registros de atividades; monitoramento; cópias de segurança; gestão de vulnerabilidades; limitação de privilégios; políticas internas de segurança.</p>
            <p>O usuário também é responsável por manter seguros seus equipamentos, contas, senhas e redes.</p>
            <p>Caso identifique possível falha, acesso indevido ou incidente de segurança, o usuário deverá comunicar imediatamente a Diversidade.io pelo e-mail <a href="mailto:adm@diversidade.io" className="text-purple-600 hover:underline">adm@diversidade.io</a>.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>19. SUSPENSÃO E ENCERRAMENTO DA CONTA</h2>
            <p>A Diversidade.io poderá suspender ou encerrar uma conta em casos como: violação destes Termos; uso ilícito ou discriminatório; tentativa de fraude; risco à segurança da plataforma; compartilhamento indevido de credenciais; inadimplência; determinação legal ou de autoridade competente; descumprimento do contrato celebrado com o cliente.</p>
            <p>Quando possível e adequado, o usuário será informado sobre a suspensão e poderá apresentar esclarecimentos.</p>
            <p>O usuário poderá solicitar o encerramento de sua conta pelo canal oficial de atendimento ou de privacidade.</p>
            <p>O encerramento da conta não implicará necessariamente a exclusão imediata de todos os dados, que poderão ser mantidos quando necessário para cumprimento de obrigação legal, auditoria, prevenção a fraude, exercício regular de direitos ou outras hipóteses previstas na Política de Privacidade.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>20. LIMITAÇÃO DE RESPONSABILIDADE</h2>
            <p>Nos limites permitidos pela legislação, a Diversidade.io não será responsável por prejuízos decorrentes de:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>uso inadequado da plataforma;</li>
              <li>informações falsas, incompletas ou incorretas enviadas pelo usuário;</li>
              <li>decisões tomadas exclusivamente pelo Contratante;</li>
              <li>ausência de revisão humana; uso discriminatório ou ilegal dos resultados;</li>
              <li>qualidade inadequada das imagens; descumprimento de normas pelo Contratante;</li>
              <li>compartilhamento de senha ou credenciais; falhas de conexão ou equipamentos do usuário;</li>
              <li>indisponibilidade causada por terceiros; caso fortuito ou força maior;</li>
              <li>softwares maliciosos presentes no dispositivo do usuário;</li>
              <li>integrações, sistemas ou serviços que não estejam sob controle direto da Diversidade.io.</li>
            </ul>
            <p>A Diversidade.io não garante resultado específico em processos seletivos, políticas afirmativas, auditorias, contratações ou procedimentos institucionais.</p>
            <p>Nenhuma disposição destes Termos exclui responsabilidades que não possam ser afastadas pela legislação aplicável, incluindo responsabilidade decorrente de dolo, fraude, violação intencional, falha de segurança imputável à Diversidade.io ou descumprimento de obrigação legal.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>21. INDENIZAÇÃO E RESPONSABILIDADE DO CONTRATANTE</h2>
            <p>O Contratante responderá pelos danos causados à Diversidade.io, aos titulares ou a terceiros quando decorrentes de: envio ilícito de dados; ausência de base legal; uso discriminatório da plataforma; descumprimento dos deveres de informação; decisões tomadas sem salvaguardas adequadas; violação destes Termos; uso não autorizado da tecnologia; conduta de seus usuários corporativos.</p>
            <p>A eventual responsabilidade será apurada conforme a participação de cada parte, as obrigações assumidas e a legislação aplicável.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>22. POLÍTICA DE PRIVACIDADE</h2>
            <p>O tratamento de dados pessoais realizado no contexto da plataforma será regulado pela Política de Privacidade da Diversidade.io.</p>
            <p>A Política de Privacidade informa, entre outros pontos: quais dados são coletados; as finalidades do tratamento; as bases legais aplicáveis; como ocorre o compartilhamento; os prazos de retenção; os direitos dos titulares; as medidas de segurança; o canal para solicitações de privacidade.</p>
            <p>Estes Termos e a Política de Privacidade são documentos complementares.</p>
            <p>Em caso de dúvida sobre dados pessoais, o usuário poderá entrar em contato pelo e-mail <a href="mailto:adm@diversidade.io" className="text-purple-600 hover:underline">adm@diversidade.io</a>.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>23. CRIANÇAS E ADOLESCENTES</h2>
            <p>A plataforma não é destinada diretamente a crianças, dados de menores de idade serão deletados e desconsiderados de maneira sumária uma vez que forem detectados, a exceção sendo os dados de jovem emancipado que seja usuário da plataforma na condição de sócio de uma pessoa jurídica, e no caso de tratamento por universidades de prévia autorização coletada pela contratante.</p>
            <p>Quando houver tratamento de dados de crianças ou adolescentes em procedimento conduzido por um Contratante, deverão ser observados:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>o melhor interesse da criança ou do adolescente;</li>
              <li>a legislação aplicável;</li>
              <li>a necessidade de autorização de responsável legal, quando exigida;</li>
              <li>a prestação de informações claras e acessíveis;</li>
              <li>a limitação da coleta ao mínimo necessário;</li>
              <li>a implementação de medidas reforçadas de segurança.</li>
            </ul>
            <p>O Contratante deverá informar previamente à Diversidade.io quando o procedimento envolver menores de idade.</p>
            <p>Caso sejam identificados dados coletados inadvertidamente de menores sem autorização necessária, a Diversidade.io poderá removê-los, bloquear o tratamento ou solicitar validação adicional.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>24. ALTERAÇÕES DOS TERMOS</h2>
            <p>Estes Termos poderão ser atualizados para refletir: alterações legais ou regulatórias; novas funcionalidades; mudanças tecnológicas; aprimoramentos de segurança; alterações nos serviços; recomendações de autoridades competentes.</p>
            <p>A versão vigente e a data da última atualização serão disponibilizadas na plataforma ou no site da Diversidade.io.</p>
            <p>Alterações relevantes poderão ser comunicadas por e-mail, aviso na plataforma ou outro canal apropriado.</p>
            <p>Quando exigido, será solicitado novo aceite do usuário.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>25. COMUNICAÇÕES</h2>
            <p>As comunicações relacionadas à plataforma poderão ser realizadas por: e-mail cadastrado; avisos no painel; notificações do sistema; canais corporativos informados pelo Contratante; página oficial da Diversidade.io.</p>
            <p>O usuário é responsável por manter seus dados de contato atualizados.</p>
            <p>Para comunicações formais, dúvidas ou solicitações, deverá ser utilizado o e-mail: <a href="mailto:adm@diversidade.io" className="text-purple-600 hover:underline">adm@diversidade.io</a></p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>26. TOLERÂNCIA E INDEPENDÊNCIA DAS CLÁUSULAS</h2>
            <p>A eventual tolerância de uma parte quanto ao descumprimento de obrigação não representará renúncia de direito nem alteração destes Termos.</p>
            <p>Caso uma disposição seja considerada inválida, ilegal ou inexequível, as demais continuarão válidas.</p>
            <p>A disposição afetada deverá ser interpretada ou substituída de forma que preserve, na maior medida possível, sua finalidade original e a legislação aplicável.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>27. LEGISLAÇÃO E FORO</h2>
            <p>Estes Termos serão interpretados de acordo com as leis da República Federativa do Brasil, especialmente a Lei Geral de Proteção de Dados Pessoais, o Marco Civil da Internet, o Código Civil e, quando aplicável, o Código de Defesa do Consumidor.</p>
            <p>Fica eleito o foro da Comarca de São Paulo, Estado de São Paulo, para solucionar controvérsias relacionadas a estes Termos, salvo quando a legislação estabelecer foro obrigatório diferente ou assegurar ao usuário o direito de propor a demanda em seu próprio domicílio.</p>
            <p>Antes de iniciar medida judicial, as partes buscarão, sempre que possível, solucionar a questão de forma amigável pelos canais oficiais da Diversidade.io.</p>

            <h2 className="text-2xl font-bold mt-10 mb-4" style={{color: '#502273'}}>28. ACEITE FINAL</h2>
            <p>Ao criar uma conta, acessar, contratar ou utilizar a plataforma Diversidade.io, o usuário declara:</p>
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-100 mb-10">
              <ul className="list-disc pl-6 space-y-3">
                <li>ter lido estes Termos;</li>
                <li>compreender suas disposições;</li>
                <li>concordar com as regras apresentadas;</li>
                <li>possuir autorização para utilizar a plataforma;</li>
                <li>comprometer-se a respeitar a legislação aplicável;</li>
                <li>estar ciente de que os resultados de inteligência artificial possuem natureza auxiliar;</li>
                <li>estar ciente da necessidade de revisão e avaliação adequada das análises;</li>
                <li>ter acesso à Política de Privacidade da Diversidade.io.</li>
              </ul>
              <p className="mt-4">Caso não concorde com estes Termos, o usuário deverá deixar de utilizar a plataforma e entrar em contato para esclarecimentos.</p>
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
