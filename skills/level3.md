# LEVEL 3 - ANALISE TECNICA DA BRANCH LEVEL2

## Objetivo

Este documento define o que falta para a branch `level2` evoluir para um `level3` com base profissional para o Playground.
O foco nao e mudar a visao do produto. O Playground continua sendo uma unica pagina que concentra autenticacao, saldo, projetos e motores de IA.
O que muda no `level3` e a disciplina interna da engenharia.

---

## Leitura Atual Da Level2

A `level2` ja corrigiu um problema importante: `server.js` deixou de carregar quase toda a regra critica do sistema.
Agora existe uma separacao inicial entre:

- bootstrap HTTP
- rotas
- controllers
- providers de IA
- helpers de preprocessamento

Arquivos-chave:

- `server.js`
- `controllers/generateController.js`
- `controllers/editController.js`
- `controllers/videoController.js`
- `controllers/faceswapController.js`
- `services/ai/engineFactory.js`
- `services/ai/providers/stabilityProvider.js`
- `services/ai/providers/openaiProvider.js`
- `services/ai/providers/replicateProvider.js`
- `utils/aiHelper.js`

Conclusao: a `level2` saiu de monolito unico e virou um monolito modular.
Isso e um passo correto, mas ainda nao e uma arquitetura de engines pronta para operacao profissional.

---

## O Que A Level2 Resolveu

### 1. Limpou o bootstrap do servidor

`server.js` agora ficou focado em:

- carregar env
- registrar middlewares
- registrar rotas
- servir assets
- iniciar o app

Isso reduz acoplamento e facilita leitura.

### 2. Extraiu generate e edit do arquivo principal

Isso foi um ganho concreto.
Os fluxos de `text-to-image` e `image-edit` sairam do arquivo central e foram isolados em controllers especificos.

### 3. Introduziu uma camada de providers

A pasta `services/ai/providers/` foi a melhor adicao da `level2`.
Ela encapsula a comunicacao com:

- Stability
- OpenAI
- Replicate

Isso prepara o sistema para:

- troca de provider
- testes mais controlados
- isolamento de payloads externos

### 4. Extraiu o preprocessamento visual

`utils/aiHelper.js` concentrou:

- normalizacao de imagem
- normalizacao de mascara
- color seeding

Essa extracao foi correta porque esse pipeline faz parte da qualidade do motor.

---

## O Que A Level2 Ainda Nao Resolveu

### 1. Os controllers ainda concentram regra demais

Hoje os controllers ainda fazem ao mesmo tempo:

- validacao de entrada
- leitura de credito
- chamada ao provider
- persistencia de asset
- gravacao de projeto
- debitacao de saldo

Isso significa que a responsabilidade so mudou de arquivo.
Ela nao mudou de camada.

Sintoma:

- `generateController.js` ainda carrega todo o fluxo da operacao
- `editController.js` ainda e praticamente um motor inteiro dentro do controller

No `level3`, controller deve virar adaptador HTTP.
Regra de negocio deve ir para `services/engines/`.

### 2. EngineFactory ainda e factory de provider

O nome sugere uma arquitetura de engine, mas hoje ela apenas devolve clients de provider.

Desenho atual:

- controller -> provider

Desenho desejado no `level3`:

- controller -> engine -> provider

Exemplo esperado:

- `text2img.engine.js`
- `image-edit.engine.js`
- `video.engine.js`
- `faceswap.engine.js`

### 3. Creditos continuam sem consistencia transacional

Hoje a logica ainda segue este padrao:

1. ler saldo
2. processar
3. debitar depois

Esse fluxo e vulneravel a:

- corrida concorrente
- dupla cobranca
- inconsistencias em falha parcial

No `level3`, o minimo aceitavel e:

- debito atomico
- service dedicado de creditos
- ledger de movimentacoes

Melhor forma:

- `credits.service.js`
- `credit_ledger` no banco

### 4. Video ainda tem side effects em GET

`GET /api/video/status/:id` ainda:

- consulta provider
- grava arquivo
- debita saldo
- cria projeto

Isso e incorreto para operacao profissional.
Se o polling repetir o mesmo estado final, pode ocorrer:

- duplicacao de projeto
- cobranca repetida
- gravacao repetida do mesmo output

No `level3`, o modulo de video precisa de lifecycle de job.

### 5. Editor ainda nao fecha o ciclo de asset

Hoje o editor retorna base64 e grava `storage-pending-url`.
Isso significa que o modulo mais nobre do produto ainda nao produz um asset final persistido de forma confiavel.

No `level3`, o editor precisa:

- persistir o arquivo final
- registrar URL real
- salvar projeto consistente

### 6. Frontend continua centralizado demais

O frontend ainda depende de:

- `index.html` grande
- `scripts/main.js` unico

Como o produto sera uma unica pagina, isso nao precisa mudar no nivel da experiencia.
Mas precisa mudar internamente.

No `level3`, o ideal e:

- um HTML principal
- JS modular por area do Playground
- um client unico de API

### 7. Static serving continua amplo demais

`express.static(__dirname)` ainda expoe a raiz do projeto como superficie publica.
Para um ambiente profissional, a exposicao deve ser limitada a uma pasta publica controlada.

---

## Definicao De Level3

`Level3` nao e apenas "mais organizado".
`Level3` significa que o projeto passa a ter:

- separacao clara entre HTTP, regra de negocio e provider externo
- controle confiavel de credito
- persistencia consistente dos resultados
- lifecycle formal para jobs assincronos
- base segura para escalar os motores sem regredir o Playground

---

## Arquitetura Alvo Do Level3

### Backend

Estrutura recomendada:

```text
src/
  routes/
  controllers/
  services/
    ai/
      providers/
    engines/
    billing/
    projects/
    storage/
    jobs/
  repositories/
  middlewares/
  utils/
```

Responsabilidades:

- `routes/`: mapeamento HTTP
- `controllers/`: adaptacao HTTP
- `services/ai/providers/`: comunicacao com OpenAI, Stability, Replicate
- `services/engines/`: logica profissional dos motores
- `services/billing/`: reserva, captura, estorno e validacao de creditos
- `services/projects/`: criacao e consulta de projetos
- `services/storage/`: persistencia de assets
- `services/jobs/`: ciclo de vida de video e outras tarefas assincronas
- `repositories/`: SQL isolado

### Frontend

Estrutura recomendada:

```text
public/
  index.html
  assets/
    styles/
    js/
      app.js
      services/
        api.js
        session.js
        state.js
      modules/
        navigation.js
        auth.js
        projects.js
        text2img.js
        image-editor.js
        video.js
        faceswap.js
```

O Playground continua sendo uma unica pagina.
O ganho esta em reduzir acoplamento interno.

---

## Prioridades Reais Do Level3

### Prioridade 1 - Criar camada de engines

Criar:

- `services/engines/text2img.engine.js`
- `services/engines/image-edit.engine.js`
- `services/engines/video.engine.js`
- `services/engines/faceswap.engine.js`

Objetivo:

- tirar regra critica dos controllers
- centralizar comportamento profissional por motor

### Prioridade 2 - Criar service de creditos

Criar:

- `services/billing/credits.service.js`

Esse service deve cuidar de:

- validar saldo
- reservar credito
- capturar credito
- estornar quando necessario

### Prioridade 3 - Persistir asset final do editor

O `image-edit` precisa produzir:

- arquivo salvo
- URL final estavel
- projeto consistente no banco

Sem isso, o principal motor do Playground continua incompleto.

### Prioridade 4 - Corrigir lifecycle do video

Criar estrutura de job com estado.
Mesmo que o processamento continue simples no inicio, o sistema precisa ter:

- `queued`
- `processing`
- `finished`
- `failed`

### Prioridade 5 - Modularizar o frontend sem quebrar a pagina unica

Separar `scripts/main.js` por modulos e criar uma camada de API client.

---

## Riscos Tecnicos Se A Level2 Parar Aqui

- crescimento de complexidade nos controllers
- bugs de cobranca sob concorrencia
- duplicacao de projetos no video
- baixa rastreabilidade operacional
- dificuldade de evoluir prompts e pipelines sem quebrar fluxo HTTP
- risco de regressao crescente no frontend centralizado

---

## Criterios De Saida Do Level3

O projeto pode ser considerado `level3` quando cumprir estes criterios:

1. Controllers nao concentram mais o pipeline completo dos motores.
2. Existe uma camada `engines/` de negocio.
3. Creditos sao tratados por service dedicado com operacao atomica.
4. Video nao produz side effects irrestritos via endpoint GET.
5. O editor persiste asset final e URL real.
6. Frontend continua pagina unica, mas com JS modular.
7. O servidor serve apenas superficie publica controlada.

---

## Conclusao

A `level2` foi uma refatoracao valida.
Ela melhorou a estrutura e preparou o terreno.

Mas o `level3` comeca quando o projeto deixa de apenas "organizar arquivos" e passa a organizar responsabilidades criticas:

- motor
- credito
- asset
- job
- projeto

Essa e a diferenca entre um MVP modular e uma base profissional para o Playground.
