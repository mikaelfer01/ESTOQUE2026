# Contagem de Estoque

App simples para contagem física de estoque por posição, com backend numa planilha do Google Sheets (via Apps Script). Feito para ser hospedado na Vercel.

## Estrutura do projeto

```
estoque-contagem/
├── index.html          → app de contagem (uso do dia a dia)
├── admin.html          → carrega a lista de produtos (SKU + descrição) na planilha
├── config.js           → cole aqui a URL do seu Apps Script (um lugar só)
├── data/
│   └── produtos.json   → sua lista de produtos (SKU + descrição)
└── apps-script/
    └── Code.gs          → backend a ser colado no Google Apps Script
```

## Como a planilha fica organizada

- **Aba `Inventario`**: coluna A = SKU, coluna B = Descrição, coluna C em diante = uma coluna por contagem (cabeçalho = data/hora de início daquela contagem).
- **Aba `Sessoes`** (controle, pode ficar oculta): guarda quais contagens estão abertas ou finalizadas, permitindo que várias pessoas contem ao mesmo tempo participando da mesma sessão aberta.

## Passo a passo — configurar o backend (Google Apps Script)

1. Crie uma planilha nova no Google Sheets.
2. Crie duas abas chamadas exatamente `Inventario` e `Sessoes` (a segunda pode ficar vazia, o script cria o cabeçalho sozinho).
3. Na planilha, vá em **Extensões > Apps Script**.
4. Apague o conteúdo padrão do arquivo `Code.gs` e cole o conteúdo de `apps-script/Code.gs` deste projeto.
5. Clique em **Implantar > Nova implantação**.
   - Tipo: **Aplicativo da Web**
   - Executar como: **Eu (sua conta)**
   - Quem pode acessar: **Qualquer pessoa**
6. Clique em **Implantar** e autorize as permissões pedidas (é normal aparecer um aviso de "app não verificado" — clique em Avançado > Acessar mesmo assim, já que é seu próprio script).
7. Copie a URL gerada (termina em `/exec`).
8. **Importante — autorize o script manualmente uma vez**: no editor, escolha a função `getProducts` no menu suspenso ao lado do botão Executar (▶) e clique em Executar. Isso completa a autorização OAuth do script. Sem esse passo, a URL pode devolver uma página HTML de login em vez de JSON.

Sempre que editar o `Code.gs`, repita: **Implantar > Gerenciar implantações > editar (lápis) > Nova versão > Implantar**. Isso atualiza o código sem trocar a URL.

## Passo a passo — configurar este projeto

1. Abra `config.js` e cole a URL do seu Web App (do passo 7 acima) na constante `WEB_APP_URL`.
2. Substitua `data/produtos.json` pela sua lista de produtos, no formato:
   ```json
   [
     { "sku": "123456", "descricao": "PARAFUSO SEXTAVADO 1/4" },
     { "sku": "789012", "descricao": "ARRUELA LISA 8MM" }
   ]
   ```

## Publicar na Vercel

1. Suba todos os arquivos deste projeto para um repositório no GitHub (ex.: `git push`).
2. Em [vercel.com](https://vercel.com), clique em **Add New > Project** e importe esse repositório.
3. Não é preciso configurar nada — é um site estático, então deixe **Framework Preset** como "Other" e clique em **Deploy**.
4. Em alguns segundos a Vercel mostra a URL pública, algo como:
   `https://NOME-DO-PROJETO.vercel.app`
5. Acesse essa URL — isso abre `index.html` automaticamente, já servido via `https://`, sem os bloqueios de CORS que acontecem ao abrir arquivos localmente (`file://`).
6. Para carregar (ou recarregar) a lista de produtos, acesse `.../admin.html` (ou `.../admin`, com `cleanUrls`).
7. Qualquer novo `git push` na branch conectada gera um novo deploy automaticamente.

## Uso do dia a dia

1. Abra a URL do GitHub Pages no celular ou computador de quem vai contar.
2. Escolha **"Iniciar nova contagem"** ou entre numa contagem já aberta por outro colega.
3. Busque o produto por SKU ou descrição, digite o kg contado e clique em **Lançar quantidade**. Pode repetir para o mesmo produto em posições diferentes — o sistema soma automaticamente.
4. Ao terminar, clique em **Finalizar contagem**. A coluna daquela contagem fica registrada na planilha como o relatório consolidado por produto.

## Observações

- Múltiplas pessoas podem contar ao mesmo tempo na mesma contagem sem sobrescrever uma a outra (o backend usa lock ao gravar).
- Se `admin.html` ou `index.html` derem erro de rede, confira se a URL em `config.js` está correta e se o script foi autorizado manualmente (passo 8 acima).
