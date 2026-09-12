/**
 * SISTEMA DE CONTAGEM DE ESTOQUE - Apps Script backend
 *
 * COMO INSTALAR:
 * 1. Abra sua planilha do Google Sheets.
 * 2. Crie duas abas chamadas exatamente: "Inventario" e "Sessoes"
 *    - Inventario: coluna A = SKU, coluna B = Descrição (preencha com seus produtos a partir da linha 2)
 *    - Sessoes: pode ficar vazia, o script cria o cabeçalho sozinho
 * 3. Edite a constante SPREADSHEET_ID abaixo com o ID da SUA planilha
 *    (a parte da URL entre /d/ e /edit, ex: docs.google.com/spreadsheets/d/ESTE_PEDACO_AQUI/edit)
 * 4. Extensões > Apps Script (dentro da própria planilha), apague o conteúdo padrão e cole este arquivo inteiro.
 * 5. Clique em "Implantar" > "Nova implantação" > tipo "Aplicativo da Web".
 *    - Executar como: Eu (sua conta)
 *    - Quem pode acessar: Qualquer pessoa
 * 6. Autorize as permissões pedidas (clique em Avançado > Acessar mesmo assim, se aparecer aviso de app não verificado).
 * 7. IMPORTANTE: no menu de funções ao lado do botão Executar (▶), escolha "getProducts"
 *    e clique em Executar uma vez, para garantir que o script fica totalmente autorizado.
 * 8. Copie a URL gerada (termina em /exec) e cole em config.js (WEB_APP_URL).
 *
 * Usar SPREADSHEET_ID fixo (em vez de SpreadsheetApp.getActiveSpreadsheet()) evita o erro
 * "Cannot read properties of null" que acontece quando o projeto do Apps Script não está
 * vinculado à planilha (por exemplo, se foi criado via script.google.com em vez de
 * Extensões > Apps Script de dentro da planilha).
 */

const SPREADSHEET_ID = "1lH4LX04Amv43HLrTpF0Fsx7FEsOi9nVPwC2osbULx0w";
const SHEET_INVENTARIO = "Inventario";
const SHEET_SESSOES = "Sessoes";

function getSS() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === "getProducts") return respond(getProducts());
    if (action === "getOpenSessions") return respond(getOpenSessions());
    return respond({ error: "Ação inválida" }, true);
  } catch (err) {
    return respond({ error: err.message }, true);
  }
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  try {
    if (action === "startSession") return respond(startSession());
    if (action === "addCount") return respond(addCount(body.sessionId, body.sku, body.qtd));
    if (action === "finishSession") return respond(finishSession(body.sessionId));
    if (action === "loadProducts") return respond(loadProducts(body.products));
    return respond({ error: "Ação inválida" }, true);
  } catch (err) {
    return respond({ error: err.message }, true);
  }
}

function respond(obj, isError) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Grava em massa a lista de produtos (SKU + descrição) nas colunas A/B da aba Inventario,
 * a partir da linha 2. Sobrescreve o que já estiver nessas colunas (não mexe nas colunas
 * de contagem, C em diante). Espera um array de objetos {sku, descricao}.
 */
function loadProducts(products) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!products || !products.length) throw new Error("Lista de produtos vazia.");
    const sh = getInventarioSheet();

    // limpa o que já existir nas colunas A/B (mantém C+ intocado)
    const oldLast = sh.getLastRow();
    if (oldLast >= 2) {
      sh.getRange(2, 1, oldLast - 1, 2).clearContent();
    }

    const values = products.map(p => [String(p.sku), String(p.descricao)]);
    sh.getRange(2, 1, values.length, 2).setValues(values);

    return { ok: true, count: values.length };
  } finally {
    lock.releaseLock();
  }
}

function getInventarioSheet() {
  return getSS().getSheetByName(SHEET_INVENTARIO);
}

function getSessoesSheet() {
  const ss = getSS();
  let sh = ss.getSheetByName(SHEET_SESSOES);
  if (!sh) sh = ss.insertSheet(SHEET_SESSOES);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID Sessao", "Coluna Inventario", "Status", "Inicio", "Fim"]);
  }
  return sh;
}

function getProducts() {
  const sh = getInventarioSheet();
  const last = sh.getLastRow();
  if (last < 2) return { products: [] };
  const data = sh.getRange(2, 1, last - 1, 2).getValues();
  const products = data
    .filter(r => r[0] !== "")
    .map(r => ({ sku: String(r[0]), descricao: String(r[1]) }));
  return { products: products };
}

function getOpenSessions() {
  const sh = getSessoesSheet();
  const last = sh.getLastRow();
  if (last < 2) return { sessions: [] };
  const data = sh.getRange(2, 1, last - 1, 5).getValues();
  const sessions = data
    .filter(r => r[2] === "aberta")
    .map(r => ({ id: String(r[0]), column: r[1], label: r[3] }));
  return { sessions: sessions };
}

function startSession() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const invSheet = getInventarioSheet();
    const sessSheet = getSessoesSheet();

    const now = new Date();
    const label = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    const newCol = invSheet.getLastColumn() + 1;

    invSheet.getRange(1, newCol).setValue(label);

    const sessionId = Utilities.getUuid();
    sessSheet.appendRow([sessionId, newCol, "aberta", label, ""]);

    return { sessionId: sessionId, column: newCol, label: label };
  } finally {
    lock.releaseLock();
  }
}

function addCount(sessionId, sku, qtd) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessSheet = getSessoesSheet();
    const sessLast = sessSheet.getLastRow();
    const sessData = sessSheet.getRange(2, 1, sessLast - 1, 5).getValues();
    let targetCol = null;
    for (let i = 0; i < sessData.length; i++) {
      if (String(sessData[i][0]) === sessionId) {
        if (sessData[i][2] !== "aberta") throw new Error("Esta contagem já foi finalizada.");
        targetCol = sessData[i][1];
        break;
      }
    }
    if (!targetCol) throw new Error("Sessão não encontrada.");

    const invSheet = getInventarioSheet();
    const last = invSheet.getLastRow();
    const skus = invSheet.getRange(2, 1, last - 1, 1).getValues();
    let targetRow = null;
    for (let i = 0; i < skus.length; i++) {
      if (String(skus[i][0]) === String(sku)) {
        targetRow = i + 2;
        break;
      }
    }
    if (!targetRow) throw new Error("SKU não encontrado no inventário.");

    const cell = invSheet.getRange(targetRow, targetCol);
    const current = Number(cell.getValue()) || 0;
    const updated = current + Number(qtd);
    cell.setValue(updated);

    return { newTotal: updated };
  } finally {
    lock.releaseLock();
  }
}

function finishSession(sessionId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sessSheet = getSessoesSheet();
    const last = sessSheet.getLastRow();
    const data = sessSheet.getRange(2, 1, last - 1, 5).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === sessionId) {
        const now = new Date();
        const endLabel = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
        sessSheet.getRange(i + 2, 3).setValue("finalizada");
        sessSheet.getRange(i + 2, 5).setValue(endLabel);
        return { ok: true };
      }
    }
    throw new Error("Sessão não encontrada.");
  } finally {
    lock.releaseLock();
  }
}
