import { AppSettings } from '../types';

export function generateGasCode(settings: AppSettings): string {
  const spreadsheetId = settings.spreadsheetId || 'COLE_AQUI_O_ID_DA_PLANILHA';
  const defaultSheetName = settings.sheetName || 'Comprovantes_Pix';
  const folderId = settings.driveFolderId || '';
  const folderName = settings.driveFolderName || 'Comprovantes_Pix_Uploads';
  const secretToken = settings.apiSecretToken || 'pix-sync-sec-2026';

  return `/**
 * ============================================================================
 * PIXSYNC - SISTEMA DE GESTÃO DE COMPROVANTES PIX E GOOGLE SHEETS
 * Versão: 2.5.0 (Com Suporte a ID de Pasta do Google Drive)
 * ============================================================================
 * 
 * ESTRUTURA DO BANCO DE DADOS:
 * - ID da Planilha configurada: "${spreadsheetId}"
 * - Nome da Aba (Guia): "${defaultSheetName}"
 * - ID da Pasta do Drive: "${folderId || '(Não informado - usará busca por nome)'}"
 * - Nome da Pasta do Drive: "${folderName}"
 * - Token de Autenticação: "${secretToken}"
 * 
 * COLUNAS DA PLANILHA (A1:J1):
 * [ID, DATA_PAGAMENTO, CPF, NOME_SERVIDOR, REFERENCIA, VALOR_PAGAMENTO, STATUS, LINK_COMPROVANTE, DATA_REGISTRO, OBSERVACOES]
 */

const CONFIG = {
  SPREADSHEET_ID: "${spreadsheetId}",
  SHEET_NAME: "${defaultSheetName}",
  DRIVE_FOLDER_ID: "${folderId}",
  DRIVE_FOLDER_NAME: "${folderName}",
  SECURITY_TOKEN: "${secretToken}",
  COLUMNS: [
    "ID",
    "DATA_PAGAMENTO",
    "CPF",
    "NOME_SERVIDOR",
    "REFERENCIA",
    "VALOR_PAGAMENTO",
    "STATUS",
    "LINK_COMPROVANTE",
    "DATA_REGISTRO",
    "OBSERVACOES"
  ]
};

/**
 * Ponto de entrada GET: Teste de conexão, Health-check e Consultas
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'ping';

    // Validação de token de segurança se fornecido
    if (CONFIG.SECURITY_TOKEN && params.token && params.token !== CONFIG.SECURITY_TOKEN) {
      return createJsonResponse({ status: 'error', message: 'Token de segurança inválido' }, 401);
    }

    const ss = getSpreadsheet(params.spreadsheetId || CONFIG.SPREADSHEET_ID);
    const sheet = getOrCreateSheet(ss, params.sheetName || CONFIG.SHEET_NAME);

    // 1. Ação: Ping / Teste de Conexão
    if (action === 'ping') {
      return createJsonResponse({
        status: 'ok',
        message: 'Google Apps Script operando normalmente!',
        sheetTitle: ss.getName(),
        sheetName: sheet.getName(),
        totalRows: Math.max(0, sheet.getLastRow() - 1),
        timestamp: new Date().toISOString()
      });
    }

    // 2. Ação: Consultar comprovantes por CPF (Privacidade do Cliente)
    if (action === 'getByCpf') {
      const cpf = cleanCPF(params.cpf || '');
      if (!cpf) {
        return createJsonResponse({ status: 'error', message: 'CPF é obrigatório' });
      }
      const records = findRecordsByCpf(sheet, cpf);
      return createJsonResponse({ status: 'ok', count: records.length, data: records });
    }

    // 3. Ação: Listar todos (Painel Administrativo)
    if (action === 'getAll') {
      const records = getAllRecords(sheet);
      return createJsonResponse({ status: 'ok', count: records.length, data: records });
    }

    return createJsonResponse({ status: 'ok', message: 'Endpoint PixSync ativo' });
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() }, 500);
  }
}

/**
 * Ponto de entrada POST: Gravação de Comprovante Pix, Upload Drive e Status
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = (e && e.parameter) || {};
    }

    // Validação de Token de Segurança
    if (CONFIG.SECURITY_TOKEN && payload.token && payload.token !== CONFIG.SECURITY_TOKEN) {
      return createJsonResponse({ success: false, message: 'Token de segurança incorreto' }, 401);
    }

    const targetSpreadsheetId = payload.spreadsheetId || CONFIG.SPREADSHEET_ID;
    const targetSheetName = payload.sheetName || CONFIG.SHEET_NAME;
    const ss = getSpreadsheet(targetSpreadsheetId);
    const sheet = getOrCreateSheet(ss, targetSheetName);

    const action = payload.action || 'submitReceipt';

    // 1. Envio de Novo Comprovante
    if (action === 'submitReceipt') {
      const receipt = payload.receipt;
      if (!receipt) {
        return createJsonResponse({ success: false, message: 'Dados do comprovante ausentes' });
      }

      // Salva arquivo no Google Drive se vier em Base64
      let driveUrl = '';
      if (receipt.fileBase64 && receipt.fileName) {
        try {
          driveUrl = saveAttachmentToDrive(
            receipt.fileBase64,
            receipt.fileName,
            receipt.fileType,
            receipt.id,
            receipt.cpf,
            payload.driveFolderId || CONFIG.DRIVE_FOLDER_ID,
            payload.driveFolderName || CONFIG.DRIVE_FOLDER_NAME,
            receipt.nomeServidor,
            receipt.data
          );
        } catch (uploadErr) {
          Logger.log('Erro ao salvar no Drive: ' + uploadErr);
          driveUrl = 'Erro no upload: ' + uploadErr.toString();
        }
      }

      // Tratamento ultra seguro do valor monetário (evita multiplicações indevidas na planilha)
      var valorFinal = 0;
      if (typeof receipt.valorPagamento === 'number') {
        valorFinal = Math.round(receipt.valorPagamento * 100) / 100;
      } else if (typeof receipt.valorPagamento === 'string') {
        var strV = String(receipt.valorPagamento).trim().replace(/^R\$\s*/i, '');
        if (strV.indexOf(',') > -1 && strV.indexOf('.') > -1) {
          strV = strV.replace(/\./g, '').replace(',', '.');
        } else if (strV.indexOf(',') > -1) {
          strV = strV.replace(',', '.');
        }
        valorFinal = parseFloat(strV) || 0;
      }

      // Formatação dos dados para a linha do Sheets
      const novaLinha = [
        receipt.id,                                   // ID (Coluna A)
        receipt.data || new Date().toISOString(),     // DATA_PAGAMENTO (Coluna B)
        formatCPF(receipt.cpf || ''),                 // CPF (Coluna C)
        receipt.nomeServidor || '',                   // NOME_SERVIDOR (Coluna D)
        receipt.referencia || '',                     // REFERENCIA (Coluna E)
        valorFinal,                                   // VALOR_PAGAMENTO (Coluna F)
        receipt.status || 'PENDENTE',                 // STATUS (Coluna G)
        driveUrl || receipt.driveUrl || '',           // LINK_COMPROVANTE (Coluna H)
        new Date().toISOString(),                     // DATA_REGISTRO (Coluna I)
        receipt.observacoes || ''                     // OBSERVACOES (Coluna J)
      ];

      sheet.appendRow(novaLinha);

      // Aplica formatação de moeda brasileira na coluna de valor (Coluna F / 6)
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 6).setNumberFormat('R$ #,##0.00');

      return createJsonResponse({
        success: true,
        message: 'Comprovante Pix registrado com sucesso na planilha!',
        id: receipt.id,
        driveUrl: driveUrl,
        rowNumber: lastRow
      });
    }

    // 2. Atualização de Status pelo Administrador
    if (action === 'updateStatus') {
      const receiptId = payload.id;
      const newStatus = payload.status;
      const observacoes = payload.observacoes || '';

      const updated = updateRecordStatus(sheet, receiptId, newStatus, observacoes);
      if (updated) {
        return createJsonResponse({
          success: true,
          message: 'Status do comprovante atualizado para ' + newStatus
        });
      } else {
        return createJsonResponse({
          success: false,
          message: 'Comprovante com ID ' + receiptId + ' não encontrado na planilha'
        });
      }
    }

    // 3. Sincronização em Lote de Comprovantes
    if (action === 'batchSubmit') {
      const receiptsList = payload.receipts || [];
      const results = [];
      for (let i = 0; i < receiptsList.length; i++) {
        const item = receiptsList[i];
        try {
          let driveUrl = '';
          if (item.fileBase64 && item.fileName) {
            driveUrl = saveAttachmentToDrive(
              item.fileBase64,
              item.fileName,
              item.fileType,
              item.id,
              item.cpf,
              payload.driveFolderId || CONFIG.DRIVE_FOLDER_ID,
              payload.driveFolderName || CONFIG.DRIVE_FOLDER_NAME,
              item.nomeServidor,
              item.data
            );
          }
          var valFin = 0;
          if (typeof item.valorPagamento === 'number') {
            valFin = Math.round(item.valorPagamento * 100) / 100;
          } else if (typeof item.valorPagamento === 'string') {
            var sV = String(item.valorPagamento).trim().replace(/^R\$\s*/i, '');
            if (sV.indexOf(',') > -1 && sV.indexOf('.') > -1) {
              sV = sV.replace(/\./g, '').replace(',', '.');
            } else if (sV.indexOf(',') > -1) {
              sV = sV.replace(',', '.');
            }
            valFin = parseFloat(sV) || 0;
          }

          sheet.appendRow([
            item.id,
            item.data || new Date().toISOString(),
            formatCPF(item.cpf || ''),
            item.nomeServidor || '',
            item.referencia || '',
            valFin,
            item.status || 'PENDENTE',
            driveUrl || item.driveUrl || '',
            new Date().toISOString(),
            item.observacoes || ''
          ]);

          const lr = sheet.getLastRow();
          sheet.getRange(lr, 6).setNumberFormat('R$ #,##0.00');

          results.push({ id: item.id, success: true, driveUrl: driveUrl });
        } catch (itemErr) {
          results.push({ id: item.id, success: false, error: itemErr.toString() });
        }
      }
      return createJsonResponse({
        success: true,
        message: receiptsList.length + ' comprovante(s) processado(s) na planilha!',
        results: results
      });
    }

    return createJsonResponse({ success: false, message: 'Ação não reconhecida: ' + action });
  } catch (error) {
    Logger.log('Erro no doPost: ' + error);
    return createJsonResponse({ success: false, message: error.toString() }, 500);
  }
}

/**
 * Obtém a pasta no Google Drive pelo ID informado ou pelo nome (criando se necessário)
 */
function getTargetFolder(folderId, folderName) {
  const targetId = folderId || CONFIG.DRIVE_FOLDER_ID;
  if (targetId && targetId.trim() && targetId !== 'COLE_AQUI_O_ID_DA_PASTA') {
    try {
      return DriveApp.getFolderById(targetId.trim());
    } catch (err) {
      Logger.log('Aviso: Não foi possível obter pasta pelo ID "' + targetId + '": ' + err);
    }
  }

  const targetName = folderName || CONFIG.DRIVE_FOLDER_NAME || 'Comprovantes_Pix_Uploads';
  const folders = DriveApp.getFoldersByName(targetName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(targetName);
}

/**
 * Salva anexo Base64 (JPG, PNG, PDF) no Google Drive com permissão de leitura
 * Formato do nome do arquivo: PIX-SERVIDOR_DATA_HORA.ext
 */
function saveAttachmentToDrive(base64Data, originalName, mimeType, receiptId, cpf, folderId, folderName, nomeServidor, paymentDate) {
  const folder = getTargetFolder(folderId, folderName);
  
  // Remove prefixo 'data:image/...;base64,' se existir
  let cleanBase64 = base64Data;
  if (base64Data.indexOf('base64,') > -1) {
    cleanBase64 = base64Data.split('base64,')[1];
  }

  const decoded = Utilities.base64Decode(cleanBase64);
  const ext = (originalName || '').split('.').pop() || 'dat';

  // Padrão de nome do arquivo solicitado: PIX-SERVIDOR_DATA_HORA.ext
  var fileName = '';
  if (originalName && originalName.indexOf('PIX-') === 0) {
    fileName = originalName;
  } else {
    var cleanServidor = (nomeServidor || '').trim().replace(/[/\\?%*:|"<>]/g, '').toUpperCase() || 'SERVIDOR';
    var d = paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(d.getTime())) {
      d = new Date();
    }
    var pad = function(n) { return (n < 10 ? '0' : '') + n; };
    var dia = pad(d.getDate());
    var mes = pad(d.getMonth() + 1);
    var ano = d.getFullYear();
    var hora = pad(d.getHours());
    var min = pad(d.getMinutes());
    var dataHoraStr = dia + '-' + mes + '-' + ano + '_' + hora + 'h' + min;
    fileName = 'PIX-' + cleanServidor + '_' + dataHoraStr + '.' + ext;
  }

  const blob = Utilities.newBlob(decoded, mimeType || 'application/octet-stream', fileName);
  const file = folder.createFile(blob);

  // Permite visualização por qualquer pessoa que possua o link direto
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Aviso ao definir permissão pública do Drive: ' + e);
  }

  return file.getUrl();
}

/**
 * Abre a planilha pelo ID ou usa a planilha ativa se o script estiver vinculado
 */
function getSpreadsheet(spreadsheetId) {
  if (spreadsheetId && spreadsheetId.trim() && spreadsheetId !== 'COLE_AQUI_O_ID_DA_PLANILHA') {
    return SpreadsheetApp.openById(spreadsheetId.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Obtém ou cria a aba com cabeçalho profissional e formatação moderna
 */
function getOrCreateSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    
    // Insere cabeçalhos
    const headers = CONFIG.COLUMNS;
    sheet.appendRow(headers);

    // Estilização do cabeçalho
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f766e'); // Teal 700 elegante
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    headerRange.setFontSize(10);
    sheet.setRowHeight(1, 35);
    sheet.setFrozenRows(1);

    // Ajusta larguras iniciais das colunas
    sheet.setColumnWidth(1, 160); // ID
    sheet.setColumnWidth(2, 140); // DATA
    sheet.setColumnWidth(3, 140); // CPF
    sheet.setColumnWidth(4, 180); // NOME_SERVIDOR
    sheet.setColumnWidth(5, 180); // REFERENCIA
    sheet.setColumnWidth(6, 120); // VALOR
    sheet.setColumnWidth(7, 120); // STATUS
    sheet.setColumnWidth(8, 220); // LINK
    sheet.setColumnWidth(9, 150); // REGISTRO
    sheet.setColumnWidth(10, 200); // OBS
  }
  return sheet;
}

/**
 * Busca comprovantes por CPF
 */
function findRecordsByCpf(sheet, cleanCpfTarget) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[2] && !row[3]) continue;
    const rowCpfClean = cleanCPF(String(row[2]));
    if (rowCpfClean === cleanCpfTarget) {
      results.push({
        id: row[0],
        data: row[1],
        cpf: row[2],
        nomeServidor: row[3],
        referencia: row[4],
        valorPagamento: row[5],
        status: row[6],
        linkComprovante: row[7],
        criadoEm: row[8],
        observacoes: row[9]
      });
    }
  }
  return results;
}

/**
 * Retorna todos os comprovantes para o painel de administração
 */
function getAllRecords(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Se a linha estiver vazia ou deletada, ignora
    if (!row[0] && !row[2] && !row[3]) continue;
    results.push({
      id: row[0],
      data: row[1],
      cpf: row[2],
      nomeServidor: row[3],
      referencia: row[4],
      valorPagamento: row[5],
      status: row[6],
      linkComprovante: row[7],
      criadoEm: row[8],
      observacoes: row[9]
    });
  }
  return results;
}

/**
 * Atualiza status e observação de um registro específico pelo ID
 */
function updateRecordStatus(sheet, receiptId, newStatus, observacoes) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(receiptId).trim()) {
      const rowIdx = i + 1;
      sheet.getRange(rowIdx, 7).setValue(newStatus); // Coluna G: STATUS
      if (observacoes !== undefined && observacoes !== null) {
        sheet.getRange(rowIdx, 10).setValue(observacoes); // Coluna J: OBSERVACOES
      }
      return true;
    }
  }
  return false;
}

/**
 * Auxiliar: Limpa CPF
 */
function cleanCPF(val) {
  return String(val || '').replace(/\\D/g, '');
}

/**
 * Auxiliar: Formata CPF 000.000.000-00
 */
function formatCPF(val) {
  const digits = cleanCPF(val).slice(0, 11);
  if (digits.length !== 11) return val;
  return digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6, 9) + '-' + digits.slice(9, 11);
}

/**
 * Cria resposta JSON com cabeçalhos CORS
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
`;
}

export function generateStandaloneIndexHtml(settings: AppSettings): string {
  const appTitle = 'PixSync - Envio de Comprovantes Pix';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appTitle}</title>
  <!-- Tailwind CSS CDN para renderização independente e rápida -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen">
  <!-- Top Navigation Bar -->
  <header class="bg-emerald-800 text-white shadow-md">
    <div class="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/30 flex items-center justify-center font-bold text-xl border border-emerald-400/40">
          ⚡
        </div>
        <div>
          <h1 class="text-xl font-bold leading-tight">PixSync</h1>
          <p class="text-xs text-emerald-200">Envio e Conferência de Comprovantes Pix</p>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs bg-emerald-900/60 px-3 py-1.5 rounded-full border border-emerald-700/50">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Google Sheets Integrado</span>
      </div>
    </div>
  </header>

  <!-- Container Principal -->
  <main class="max-w-4xl mx-auto px-4 py-8">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
      <h2 class="text-xl font-bold text-slate-900 mb-2">Envio de Comprovante Pix</h2>
      <p class="text-sm text-slate-500 mb-6">
        Informe seu CPF para consultar envios anteriores ou registrar um novo comprovante.
      </p>

      <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6 text-sm text-emerald-900">
        💡 <strong>Dica de Integração:</strong> Para usar no seu Google Apps Script diretamente, este arquivo pode ser incluído com <code>HtmlService.createHtmlOutputFromFile('index')</code> no seu projeto do Google Workspace.
      </div>
    </div>
  </main>
</body>
</html>`;
}

export function generateClaspConfig(settings: AppSettings): string {
  return JSON.stringify(
    {
      scriptId: 'COLE_AQUI_O_SCRIPT_ID_DO_GOOGLE_APPS_SCRIPT',
      rootDir: './gas',
    },
    null,
    2
  );
}

export function generateGithubWorkflow(): string {
  return `# .github/workflows/deploy-gas.yml
# Automação de Deploy para o Google Apps Script via Clasp
name: Deploy para Google Apps Script

on:
  push:
    branches:
      - main
    paths:
      - 'gas/**'
      - '.clasp.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repositório
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Instalar @google/clasp
        run: npm install -g @google/clasp

      - name: Criar arquivo de credenciais do Clasp
        run: |
          echo '\${{ secrets.CLASPRC_JSON }}' > ~/.clasprc.json

      - name: Enviar código para o Google Apps Script
        run: clasp push --force
`;
}
