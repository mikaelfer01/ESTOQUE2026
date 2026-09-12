# Contagem de Estoque

App simples para contagem física de estoque por posição. Backend 100% na Vercel: páginas estáticas + funções serverless (`/api`) + banco Postgres (Vercel Postgres).

## Estrutura do projeto

```
├── index.html          → app de contagem (uso do dia a dia)
├── admin.html          → carrega a lista de produtos (SKU + descrição) no banco
├── resultados.html      → visualiza os lançamentos, com filtros por data/sessão/produto
├── data/
│   └── produtos.json   → sua lista de produtos (SKU + descrição)
├── manifest.json         → deixa o site instalável como app (PWA) no celular
├── sw.js                 → service worker (cache do "app shell", nunca das chamadas /api)
├── icons/                → ícones do app instalado (192px, 512px, maskable)
├── lib/
│   └── db.js            → conexão com o Postgres e criação das tabelas
└── api/
    ├── products.js       → GET lista produtos / POST substitui a lista
    ├── sessions.js        → GET sessões abertas / POST inicia uma nova
    ├── sessions/[id]/finish.js → POST finaliza uma sessão
    ├── counts.js          → POST lança uma quantidade contada
    └── results.js         → GET resultados com filtros (data, sessão, status, busca)
```

## Como os dados ficam organizados

- **`produtos`**: `sku`, `descricao` — lista mestre de produtos.
- **`sessoes`**: uma contagem (rodada) que pode estar `aberta` ou `finalizada`, com data de início/fim. Várias pessoas podem entrar na mesma sessão aberta ao mesmo tempo.
- **`contagens`**: cada lançamento — sessão + SKU + quantidade acumulada (repetir o lançamento do mesmo produto na mesma sessão soma automaticamente, feito com `ON CONFLICT` no banco).

## Passo a passo — configurar o banco (Vercel Postgres)

1. No painel do seu projeto na Vercel, vá em **Storage > Create Database > Postgres** (ou "Neon", que é o Postgres gerenciado da Vercel).
2. Depois de criado, clique em **Connect Project** e selecione este projeto — isso injeta automaticamente as variáveis de ambiente (`POSTGRES_URL` etc.) usadas por `lib/db.js` via `@vercel/postgres`.
3. Não é preciso criar tabelas manualmente: cada função em `/api` chama `ensureSchema()`, que cria as tabelas (`produtos`, `sessoes`, `contagens`) automaticamente se ainda não existirem.
4. Faça um novo deploy (ou redeploy) depois de conectar o banco, para a função serverless já subir com as variáveis de ambiente disponíveis.

## Passo a passo — configurar este projeto

1. Substitua `data/produtos.json` pela sua lista de produtos, no formato:
   ```json
   [
     { "sku": "123456", "descricao": "PARAFUSO SEXTAVADO 1/4" },
     { "sku": "789012", "descricao": "ARRUELA LISA 8MM" }
   ]
   ```
2. Depois do deploy, acesse `.../admin.html` e clique em **Carregar produtos** para gravar essa lista no banco.

## Publicar na Vercel

1. Suba todos os arquivos deste projeto para um repositório no GitHub (ex.: `git push`).
2. Em [vercel.com](https://vercel.com), clique em **Add New > Project** e importe esse repositório.
3. Deixe **Framework Preset** como "Other" — as páginas HTML são servidas como estáticas e tudo em `/api` vira função serverless automaticamente.
4. Depois do primeiro deploy, configure o banco (passo acima) e faça um redeploy.
5. Em alguns segundos a Vercel mostra a URL pública, algo como `https://NOME-DO-PROJETO.vercel.app`.
6. Qualquer novo `git push` na branch conectada gera um novo deploy automaticamente.

## Uso do dia a dia

1. Abra a URL da Vercel no celular ou computador de quem vai contar (`index.html`).
2. Escolha **"Iniciar nova contagem"** ou entre numa contagem já aberta por outro colega.
3. Busque o produto por SKU ou descrição, digite o kg contado e clique em **Lançar quantidade**. Pode repetir para o mesmo produto em posições diferentes — o sistema soma automaticamente.
4. Ao terminar, clique em **Finalizar contagem**.
5. Acesse **`.../resultados.html`** a qualquer momento para ver todos os lançamentos, filtrando por data de início da contagem, sessão específica, status (aberta/finalizada) ou por SKU/descrição do produto. Dá para exportar a visão filtrada em CSV.

## Instalar como app no celular (PWA)

O site é um PWA (Progressive Web App) instalável — não é um `.apk`, mas se comporta como um app: ícone na tela inicial, abre em tela cheia sem barra de endereço, e sempre carrega a versão mais nova publicada na Vercel (sem precisar reinstalar nada a cada atualização).

**Android (Chrome):**
1. Abra a URL da Vercel no Chrome.
2. Toque no menu (⋮) > **"Adicionar à tela inicial"** (ou vai aparecer um banner "Instalar app" automaticamente).
3. Confirme — o ícone "Estoque WMS" aparece na tela inicial e abre como app.

**iPhone (Safari):**
1. Abra a URL no Safari.
2. Toque no ícone de compartilhar (□↑) > **"Adicionar à Tela de Início"**.

Como as chamadas para `/api/*` nunca são cacheadas pelo service worker (só o HTML/CSS/JS do app), os dados de produtos, sessões e contagens são sempre buscados ao vivo — o "modo offline" cobre só a interface, não os dados.

## Observações

- Múltiplas pessoas podem contar ao mesmo tempo na mesma contagem sem sobrescrever uma a outra (o acúmulo de quantidade é feito de forma atômica no banco com `ON CONFLICT`).
- Se `admin.html`, `index.html` ou `resultados.html` derem erro de rede/dados, confira se o banco Postgres está conectado ao projeto na Vercel (Storage > seu banco > Projects) e se o deploy mais recente já tem as variáveis de ambiente.
