# 🏐 Rachador — Gestão Inteligente e Competitiva de Grupos Esportivos (SaaS)

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success?style=for-the-badge&logo=pwa&logoColor=white&color=22c55e)](https://developer.mozilla.org/pt-BR/docs/Web/Progressive_web_apps)
[![Firebase Backed](https://img.shields.io/badge/Firebase-Realtime-orange?style=for-the-badge&logo=firebase&logoColor=white&color=f5820d)](https://firebase.google.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Aesthetics-blue?style=for-the-badge&logo=tailwind-css&logoColor=white&color=06b6d4)](https://tailwindcss.com/)
[![License MIT](https://img.shields.io/badge/License-MIT-blueviolet?style=for-the-badge&color=8b5cf6)](file:///home/renato/Documentos/GitHub/Rachador/LICENSE)

O **Rachador** é uma plataforma SaaS premium e moderna desenvolvida para revolucionar a forma como grupos de esportes amadores (os famosos "rachas" ou "baba") organizam suas partidas. Projetado inicialmente com foco no vôlei, mas flexível para outras modalidades, o sistema elimina as "panelinhas" através de um algoritmo inteligente de balanceamento baseado no sistema competitivos de **Elo Rating**, fornece sincronização em tempo real e oferece controle financeiro rigoroso em uma interface PWA ultra-responsiva.

---

## ✨ Funcionalidades em Destaque

### 🌐 Arquitetura SaaS e Perfil Único
*   **Múltiplos Grupos:** Crie, gerencie ou participe de vários rachas com uma única conta.
*   **Perfis Globais Sincronizados:** Ao vincular um jogador pelo e-mail, o nome e a foto de perfil são sincronizados automaticamente a partir da conta global do usuário, atualizando dinamicamente todos os grupos aos quais ele pertence.
*   **Autenticação Avançada:** Login seguro via E-mail/Senha com recuperação ou login rápido com Google.

### ⚖️ Algoritmo de Sorteio Inteligente & Balanceamento
*   **Balanceamento por Nível ou Elo:** Sorteadores avançados que nivelam tecnicamente as equipes, distribuindo os jogadores com base em seu Nível (estrelas de 1 a 5) ou Elo individual (Pontos) para gerar partidas perfeitamente equilibradas.
*   **Estratégias de Draft Personalizadas:**
    *   *Fora Forte / Dentro Forte:* Define se o balanceamento rigoroso prioriza a quadra atual ou as substituições da lista de espera, suportado nos modos de Nível e Elo.
    *   *Sorteio Customizado:* Escolha o tamanho dos times (2x2, 4x4, 6x6) e estratégias de preenchimento.
*   **Gestão de Fila ("Time Fora"):** Controle de rotatividade que calcula as "rodadas fora" de cada jogador para que ninguém fique excessivamente tempo sem jogar, priorizando de forma justa quem está aguardando há mais tempo.

### ⏱️ Placar Integrado & Quadra Sincronizada em Tempo Real
*   **Sincronização Ativa:** A seleção dos times que estão na quadra e o placar em andamento são atualizados instantaneamente em todos os dispositivos conectados.
*   **Trava de Segurança (Lock):** Impede que usuários comuns alterem o placar ou mudem a quadra enquanto um administrador estiver conduzindo a partida oficialmente.
*   **Cronômetro & Sons Premium:** Cronômetro customizado para partidas por tempo. Toca um alerta sonoro realista de apito de juiz (`Apito.wav`) ao encerrar a partida.
*   **Projeção de Elo Dinâmica:** Exibe na tela, durante o jogo, a previsão de ganho ou perda de pontos de Elo para cada equipe com base no placar parcial.
*   **Suporte a Empates:** Suporta o salvamento de partidas terminadas em empate em jogos de cronômetro, processando e recalculando o Elo de forma justa para ambos os times.

### 🏆 FIFA-Style Ultimate Team Cards & Estatísticas
*   **Cartinhas Dinâmicas (FUT Style):** Cada atleta possui um card estilizado que destaca visualmente seu Nível (1-5 estrelas), Elo competitivo (Pontos), pontuações e histórico de desempenho recente.
*   **Histórico e Estatísticas Detalhadas:** Histórico completo de vitórias, derrotas, empates, sequências de vitórias (*streaks*) e gráficos de variação de Elo.
*   **Gerador de Imagens Integrado:** Exportação em altíssima qualidade (utilizando `html2canvas`) do card do jogador, do histórico recente ou da visualização combinada para compartilhamento direto no WhatsApp, Instagram e redes sociais.

### 💳 Painel Financeiro & Fluxo de Caixa Completo
*   **Gestão de Mensalistas:** Controle automatizado de mensalidades por data de vencimento configurável, exibindo status individuais de adimplência.
*   **Lançador de Diárias com Rateio Inteligente:**
    *   Gere cobranças rápidas para sessões avulsas.
    *   Permite escolher o valor fixo por jogador ou dividir/ratear o custo total entre todos os selecionados.
*   **Cobrança PIX Express:** Exibe de forma direta a chave PIX configurada pelo administrador com recurso de "Copiar e Colar" rápido para os jogadores inadimplentes.
*   **Bloqueio Automático por Inadimplência:** Configuração para impedir que jogadores com cobranças atrasadas acima do limite tolerado participem dos sorteios de times.
*   **Caixa do Time Transparente:** Livro-caixa completo com registros de depósitos, despesas e saldo total atualizado. O administrador pode optar por tornar o extrato público para todos os membros ou privado.

---

## 🛠️ Tecnologias Utilizadas

A arquitetura do Rachador foi desenhada focando em máxima velocidade, segurança e sem necessidade de intermediários pesados:

*   **Front-end SPA:** HTML5 estrutural e Vanilla JavaScript (ES6 Modules) com manipulação direta de DOM para performance excepcional.
*   **Estilização Premium:** Tailwind CSS integrado para um layout responsivo em formato Dark Mode, elegante, com transições suaves e design premium.
*   **Banco de Dados & Auth:** Firebase Suite (Firebase Auth, Cloud Firestore e Cloud Storage para fotos de perfil).
*   **Offline First / PWA:** Registrado com Service Worker (`sw.js`) e manifesto configurado para permitir a instalação como aplicativo nativo em dispositivos iOS e Android.
*   **Biblioteca de Utilitários:** Lucide Icons (iconografia vetorial moderna) e html2canvas (módulo de renderização de imagens de alta fidelidade).

---

## 📂 Estrutura do Projeto

Abaixo está o mapeamento dos principais módulos que sustentam a aplicação:

```text
/
├── index.html                  # Arquivo mestre da SPA (Single Page Application)
├── manifest.json               # Configurações de instalação PWA
├── sw.js                       # Service Worker (Controle de cache e PWA)
├── Icone.png                   # Logotipo principal do aplicativo
├── Apito.wav                   # Áudio premium de apito de encerramento
├── css/
│   └── styles.css              # Customizações de animações, glassmorphism e cores HSL
├── views/
│   ├── landing.html            # Landing page institucional com recursos da plataforma
│   ├── auth.html               # Login, Cadastro e Recuperação de Senha
│   ├── groups.html             # Painel de Seleção e Criação de Grupos (SaaS)
│   ├── nav.html                # Menu de navegação superior responsivo
│   ├── public.html             # Painel do Ranking Principal e Cartas de Jogadores
│   ├── sorteio.html            # Interface de sorteio, parâmetros de draft e lista de espera
│   ├── placar.html             # Placar dinâmico, cronômetro e projeção de ELO
│   ├── admin.html              # Cadastro de Atletas, edição de níveis e regras do racha
│   ├── pagamentos.html         # Painel Financeiro, cobranças diárias, PIX e caixa do time
│   └── modals.html             # Popups (Vitória, Termos, Detalhes de Jogador, Mover Atleta)
├── js/
│   ├── main.js                 # Ponto de partida, inicializador global e bindings da janela
│   ├── state.js                # Gerenciamento de estado reativo unificado (Source of Truth)
│   ├── firebase.js             # Configurações do Firebase SDK (v11) e listeners
│   ├── authService.js          # Métodos de registro, login, Google Auth e senhas
│   ├── viewLoader.js           # Mecanismo que injeta dinamicamente as views HTML no index
│   ├── ui/
│   │   ├── core.js             # Lógica de controle de abas, visibilidade e rotas
│   │   ├── components.js       # Geradores de componentes HTML reusáveis
│   │   ├── renderers.js        # Motores de renderização visual das abas e listas
│   │   ├── formatters.js       # Utilitários de texto, datas e conversão de moeda
│   │   └── modals.js           # Gerenciador de modais e ações dinâmicas
│   ├── controllers/
│   │   ├── adminController.js  # Cadastro de jogadores, e-mails, fotos e limpezas
│   │   ├── draftController.js  # Algoritmos de balanceamento, waiting-list e posições
│   │   ├── matchController.js  # Pontuações, controle de timer e processamento de Elo
│   │   └── paymentController.js# Controle de Pix, caixa, parcelamento e filtros de extrato
│   └── services/
│       └── rankingService.js   # Regras matemáticas para atualização de ELO Ratings
```

---

## 🚀 Como Rodar o Projeto Localmente

### Pré-requisitos
Como a aplicação utiliza os novos **ES6 Modules** (instruções `import`/`export`), o arquivo `index.html` não pode ser aberto diretamente clicando no arquivo. Ele precisa ser servido através de um servidor HTTP local.

### Passos para Execução:

1.  **Clonar o Repositório:**
    ```bash
    git clone https://github.com/leolimadesigner/time-certo-volei.git
    cd time-certo-volei
    ```

2.  **Iniciar um Servidor Local:**
    *   *Se você usa o VS Code:* Instale a extensão **Live Server** e clique em "Go Live" no canto inferior direito.
    *   *Se tem Node.js instalado:* Execute um dos comandos abaixo na raiz do projeto:
        ```bash
        npx serve .
        # ou
        npm install -g http-server
        http-server .
        ```
    *   *Se usa Python:*
        ```bash
        python3 -m http.server 8080
        ```

3.  **Acesse no Navegador:**
    Abra o navegador e digite o endereço fornecido pelo servidor (ex: `http://localhost:5000` ou `http://localhost:8080`).

---

## ⚙️ Configurando o seu próprio Banco de Dados (Firebase)

Caso deseje implantar o seu próprio ambiente do Rachador, siga estes passos para configurar a base de dados:

1.  Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto.
2.  Ative os seguintes recursos no seu painel do Firebase:
    *   **Authentication:** Habilite o provedor de login "E-mail/Senha" e opcionalmente o "Google".
    *   **Cloud Firestore Database:** Crie um banco de dados em modo de teste e selecione a região mais próxima.
    *   **Cloud Storage:** Ative o armazenamento para suportar os uploads de fotos dos atletas.
3.  Obtenha as credenciais do seu aplicativo web (nas configurações do projeto) e substitua a estrutura de configuração no arquivo [js/config.js](file:///home/renato/Documentos/GitHub/Rachador/js/config.js).
4.  **Regras do Firestore:** Aplique o arquivo de regras de segurança `firestore.rules` presente na raiz do projeto para garantir o controle de acesso por grupos (RBAC) e evitar vazamento de dados.

---

## 💡 Guia de Uso Rápido para Administradores

1.  **Criar Conta e Racha:** Faça o cadastro e clique em "Criar Novo Grupo". Dê um nome ao seu racha.
2.  **Cadastrar Jogadores:** Vá na aba **Admin**, cadastre os jogadores do seu grupo, defina o nível inicial (estrelas) e o e-mail de cada um.
3.  **Sorteio Perfeito:** Na aba **Sorteio**, marque os atletas presentes para a rodada do dia, escolha o número de jogadores por time, defina a estratégia de nivelamento e clique em **Sortear Equipes**.
4.  **Partida e Placar:** Na aba **Placar**, selecione os times gerados que irão entrar em quadra e dê início ao timer ou faça o controle manual dos pontos.
5.  **Histórico & Elo:** Assim que a partida terminar, salve o resultado oficial. O sistema irá recalcular o Elo Rating de todos os participantes instantaneamente, atualizar o ranking e adicionar a partida ao Histórico.
6.  **Gerenciar Finanças:** Na aba **Pagamentos**, adicione a chave PIX do grupo. Lance cobranças de diárias selecionando os atletas presentes, gerencie a adimplência e registre custos de manutenção ou créditos adicionais no Caixa do Time.

---

## 📄 Licença

Este projeto é distribuído sob os termos da **MIT License**. Veja o arquivo [LICENSE](file:///home/renato/Documentos/GitHub/Rachador/LICENSE) para maiores detalhes.

---
*Desenvolvido com carinho para elevar o nível competitivo, a transparência e a diversão nos rachas esportivos!*