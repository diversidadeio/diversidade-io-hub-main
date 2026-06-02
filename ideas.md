# Design Philosophy - Diversidade.io Hub

## Abordagem Selecionada: **Modern Institutional Tech**

### Design Movement
**Modernismo Corporativo + Minimalismo Funcional** com influências de design systems de empresas de tecnologia B2B (Stripe, Figma, Notion). Foco em clareza, hierarquia e confiança através de precisão visual.

### Core Principles

1. **Hierarquia Cristalina**: Cada elemento comunica sua importância através de tamanho, peso, cor e espaçamento. Nada compete pela atenção.
2. **Espaço Respeitoso**: Whitespace generoso como ferramenta estratégica, não como vazio. Cada seção respira.
3. **Dados como Design**: A página é uma narrativa visual que guia o usuário de problema → solução → ação. Números e métricas são elementos visuais.
4. **Confiança através da Precisão**: Tipografia rigorosa, alinhamentos perfeitos, cores deliberadas. Transmite governança e rigor.

### Color Philosophy

**Paleta Principal:**
- **Azul Profundo** (#0F3A7D): Confiança, tecnologia, estabilidade. Cor primária para CTAs e destaques.
- **Branco/Off-white** (#FAFBFC): Fundo limpo, respirável. Cria espaço.
- **Cinza Neutro** (#4A5568 → #718096): Textos, hierarquia secundária. Legibilidade máxima.
- **Verde Esmeralda** (#059669): Impacto, crescimento, inclusão. Accent para estatísticas e resultados.
- **Laranja Quente** (#EA580C): Energia, ação, urgência. Usado em CTAs secundárias e destaques de plataformas.

**Intenção Emocional**: Profissionalismo + Otimismo. Não é frio, é confiante. Não é genérico, é intencional.

### Layout Paradigm

**Estrutura Assimétrica com Ritmo Visual:**
- Header fixo, minimalista (logo + menu + CTA)
- Hero com texto à esquerda, elemento visual abstrato à direita
- Seções alternadas: texto esquerda/visual direita, depois inverte
- Cards de plataformas em grid 2x2 + 1 destaque central (Rodadas Inclusivas)
- Fluxo de integração como linha visual com ícones e conexões
- Seção de públicos em 4 colunas com ícones e tipografia hierárquica
- Estatísticas em cards numéricos com fundo colorido e ícone
- Arquitetura de valor como fluxo vertical com setas e transições
- Footer em 3 colunas com logo, links e contato

### Signature Elements

1. **Linha Azul Vertical**: Elemento decorativo que aparece em seções-chave, conectando visualmente as plataformas. Representa a integração.
2. **Cards com Borda Esquerda Colorida**: Cada plataforma tem uma cor de borda única (azul, verde, laranja, roxo, teal). Identidade individual dentro do sistema.
3. **Setas e Conexões**: Usadas no fluxo de integração para mostrar movimento e progressão. Dinâmicas, não estáticas.

### Interaction Philosophy

- **Hover em CTAs**: Botões mudam cor com transição suave (200ms), scale(1.02) para feedback tátil.
- **Scroll Reveal**: Elementos entram suavemente conforme o usuário faz scroll (fade-in + slide-up).
- **Links Internos**: Menu de navegação com scroll suave para seções.
- **Feedback Visual**: Todos os botões têm estados claros (hover, active, disabled).

### Animation

- **Entrada de Seções**: Fade-in + slide-up 400ms, staggered para elementos internos (80ms entre eles)
- **Hover em Cards**: Elevação sutil com box-shadow, transição 200ms
- **Botões**: Scale 0.97 on active, transição 160ms ease-out
- **Scroll Animations**: Parallax suave em hero, fade-in em cards conforme entram na viewport
- **Transições de Página**: Suave, sem jarretões. Foco em conforto visual.

### Typography System

**Fontes:**
- **Display**: "Poppins" (700, 600) - Títulos principais, h1, h2. Moderna, confiante, sem serifa.
- **Body**: "Inter" (400, 500, 600) - Corpo, descrições, labels. Legível, neutra, profissional.
- **Monospace**: "Fira Code" - Para números/dados quando necessário (estatísticas).

**Hierarquia:**
- **H1 (Hero)**: Poppins 700, 48-56px, line-height 1.2, azul profundo
- **H2 (Seções)**: Poppins 600, 32-40px, line-height 1.3, azul profundo
- **H3 (Cards)**: Poppins 600, 20-24px, line-height 1.4, azul profundo
- **Body**: Inter 400, 16px, line-height 1.6, cinza escuro
- **Small**: Inter 400, 14px, line-height 1.5, cinza médio
- **CTA**: Inter 600, 14-16px, uppercase tracking +0.5px

### Accessibility & Contrast

- Todos os textos em azul profundo (#0F3A7D) sobre branco: ratio 8.5:1 ✓
- Botões azuis com texto branco: ratio 10:1 ✓
- Cinza de corpo sobre branco: ratio 4.5:1 ✓
- Ícones com tamanho mínimo 24px para toque
- Focus rings visíveis em todos os elementos interativos

---

## Decisões de Design

✅ **Escolhido**: Modernismo corporativo porque:
- Posiciona Diversidade.io como empresa de tecnologia séria, não consultoria genérica
- Paleta azul + verde transmite confiança + impacto
- Espaço generoso e tipografia clara facilitam leitura de conteúdo denso
- Elementos de conexão visual (linhas, setas) reforçam mensagem de integração
- Escalável para futuras plataformas sem perder coerência

❌ **Rejeitado**: Design playful/colorido porque não reforçaria posicionamento de supplytech
❌ **Rejeitado**: Minimalismo extremo porque perderia oportunidade de transmitir dados e impacto visualmente
