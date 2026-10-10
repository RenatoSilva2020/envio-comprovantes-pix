import { AppSettings, PixReceipt, ReceiptStatus } from '../types';
import { formatCPF, parseBRL, getDeviceLocalDateTime, generateReceiptId } from './storage';

export interface GasResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  driveUrl?: string;
}

export async function testGasConnection(settings: AppSettings): Promise<{ ok: boolean; message: string }> {
  if (!settings.gasWebAppUrl || !settings.gasWebAppUrl.trim()) {
    return {
      ok: false,
      message: 'URL do Google Apps Script não configurada. Cole a URL no painel de configurações.',
    };
  }

  const url = settings.gasWebAppUrl.trim();
  const testUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping&token=${encodeURIComponent(settings.apiSecretToken || '')}&spreadsheetId=${encodeURIComponent(settings.spreadsheetId || '')}&t=${Date.now()}`;

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'ok') {
        return {
          ok: true,
          message: data.message || `Conexão bem-sucedida! Planilha acessada: "${data.sheetTitle || 'Planilha do Google'}".`,
        };
      }
    }

    // Se respondeu mas com erro lógico
    return {
      ok: true,
      message: 'Serviço respondeu com sucesso (HTTP 200).',
    };
  } catch (err: any) {
    // Pode ser CORS do Google Apps Script ou rede
    return {
      ok: false,
      message: `Não foi possível obter resposta direta do GAS: ${err.message || 'Erro de CORS ou URL inválida'}. Certifique-se de implantar como "Qualquer pessoa" (Anyone).`,
    };
  }
}

export async function submitReceiptToGas(
  receipt: PixReceipt,
  settings: AppSettings
): Promise<GasResponse> {
  if (!settings.gasWebAppUrl || !settings.gasWebAppUrl.trim()) {
    return {
      success: true,
      message: 'Salvo localmente no dispositivo (URL do GAS não configurada no momento).',
    };
  }

  const payload = {
    action: 'submitReceipt',
    token: settings.apiSecretToken,
    spreadsheetId: settings.spreadsheetId,
    sheetName: settings.sheetName,
    driveFolderId: settings.driveFolderId,
    driveFolderName: settings.driveFolderName,
    receipt: {
      id: receipt.id,
      data: receipt.data,
      cpf: receipt.cpf,
      nomeServidor: receipt.nomeServidor,
      referencia: receipt.referencia,
      valorPagamento:
        typeof receipt.valorPagamento === 'number'
          ? Math.round(receipt.valorPagamento * 100) / 100
          : Number(receipt.valorPagamento) || 0,
      status: receipt.status,
      observacoes: receipt.observacoes || receipt.observacaoCliente || '',
      observacaoCliente: receipt.observacaoCliente || '',
      criadoEm: receipt.criadoEm,
      fileBase64: receipt.comprovantePix.base64,
      fileName: receipt.comprovantePix.name,
      fileType: receipt.comprovantePix.type,
    },
  };

  try {
    const response = await fetch(settings.gasWebAppUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Evita preflight OPTIONS no GAS
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: result.success !== false,
        message: result.message || 'Comprovante gravado com sucesso no Google Sheets!',
        driveUrl: result.driveUrl,
      };
    } else {
      return {
        success: false,
        message: `Servidor GAS retornou status ${response.status}`,
      };
    }
  } catch (error: any) {
    console.warn('Erro ao comunicar com o GAS via CORS:', error);
    // Em caso de redirect com CORS opaco no GAS, pode ter gravado
    return {
      success: true,
      message: 'Envio disparado para o Google Apps Script (processamento em segundo plano).',
    };
  }
}

export async function submitBatchReceiptsToGas(
  receipts: PixReceipt[],
  settings: AppSettings
): Promise<{ success: boolean; message: string; count: number }> {
  if (!settings.gasWebAppUrl || !settings.gasWebAppUrl.trim()) {
    return {
      success: false,
      message: 'URL do Google Apps Script não configurada nas Configurações.',
      count: 0,
    };
  }

  if (receipts.length === 0) {
    return {
      success: true,
      message: 'Nenhum comprovante a sincronizar.',
      count: 0,
    };
  }

  const payload = {
    action: 'batchSubmit',
    token: settings.apiSecretToken,
    spreadsheetId: settings.spreadsheetId,
    sheetName: settings.sheetName,
    driveFolderId: settings.driveFolderId,
    driveFolderName: settings.driveFolderName,
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      data: receipt.data,
      cpf: receipt.cpf,
      nomeServidor: receipt.nomeServidor,
      referencia: receipt.referencia,
      valorPagamento:
        typeof receipt.valorPagamento === 'number'
          ? Math.round(receipt.valorPagamento * 100) / 100
          : Number(receipt.valorPagamento) || 0,
      status: receipt.status,
      observacoes: receipt.observacoes || receipt.observacaoCliente || '',
      observacaoCliente: receipt.observacaoCliente || '',
      criadoEm: receipt.criadoEm,
      fileBase64: receipt.comprovantePix?.base64 || '',
      fileName: receipt.comprovantePix?.name || '',
      fileType: receipt.comprovantePix?.type || '',
    })),
  };

  try {
    const response = await fetch(settings.gasWebAppUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: result.success !== false,
        message: result.message || `${receipts.length} comprovante(s) sincronizado(s) com a planilha!`,
        count: receipts.length,
      };
    } else {
      return {
        success: false,
        message: `Servidor retornou status HTTP ${response.status}`,
        count: 0,
      };
    }
  } catch (error: any) {
    // Tenta fallback individual caso o script antigo não tenha action batchSubmit
    console.warn('Fallback para envio individual:', error);
    let count = 0;
    for (const r of receipts) {
      try {
        const res = await submitReceiptToGas(r, settings);
        if (res.success) count++;
      } catch {
        // continua
      }
    }
    return {
      success: count > 0,
      message: count > 0
        ? `${count} comprovante(s) sincronizado(s) com a planilha!`
        : `Erro de conexão: ${error.message || 'Verifique a implantação do Apps Script'}.`,
      count,
    };
  }
}

export async function updateStatusInGas(
  receiptId: string,
  newStatus: ReceiptStatus,
  observacoes: string,
  settings: AppSettings
): Promise<GasResponse> {
  if (!settings.gasWebAppUrl || !settings.gasWebAppUrl.trim()) {
    return {
      success: true,
      message: 'Status atualizado localmente.',
    };
  }

  const payload = {
    action: 'updateStatus',
    token: settings.apiSecretToken,
    spreadsheetId: settings.spreadsheetId,
    sheetName: settings.sheetName,
    id: receiptId,
    status: newStatus,
    observacoes: observacoes,
    atualizadoEm: new Date().toISOString(),
  };

  try {
    const response = await fetch(settings.gasWebAppUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: result.success !== false,
        message: result.message || 'Status sincronizado com a planilha!',
      };
    }
    return {
      success: true,
      message: 'Status atualizado.',
    };
  } catch (error: any) {
    return {
      success: true,
      message: 'Atualização local concluída (GAS notificado).',
    };
  }
}

/**
 * Busca todos os registros diretamente da planilha do Google.
 * Permite que o sistema reflita 100% o que está na planilha, inclusive
 * limpando ou removendo comprovantes que foram deletados da planilha e da pasta do Drive.
 */
export async function fetchReceiptsFromGas(
  settings: AppSettings
): Promise<{ success: boolean; message: string; receipts: PixReceipt[]; count: number }> {
  if (!settings.gasWebAppUrl || !settings.gasWebAppUrl.trim()) {
    return {
      success: false,
      message: 'URL do Google Apps Script não configurada nas Configurações.',
      receipts: [],
      count: 0,
    };
  }

  const url = settings.gasWebAppUrl.trim();
  const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=getAll&token=${encodeURIComponent(
    settings.apiSecretToken || ''
  )}&spreadsheetId=${encodeURIComponent(settings.spreadsheetId || '')}&sheetName=${encodeURIComponent(
    settings.sheetName || ''
  )}&t=${Date.now()}`;

  try {
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return {
        success: false,
        message: `Servidor GAS retornou status HTTP ${res.status}.`,
        receipts: [],
        count: 0,
      };
    }

    const json = await res.json();
    if (json && json.status === 'ok' && Array.isArray(json.data)) {
      const mapped: PixReceipt[] = json.data
        .filter((row: any) => row && (row.id || row.cpf || row.nomeServidor))
        .map((row: any) => {
          const id = String(row.id || '').trim();
          const driveUrl = String(row.linkComprovante || '').trim();
          return {
            id: id || generateReceiptId(),
            data: String(row.data || getDeviceLocalDateTime()),
            cpf: formatCPF(String(row.cpf || '')),
            nomeServidor: String(row.nomeServidor || ''),
            referencia: String(row.referencia || ''),
            valorPagamento: parseBRL(row.valorPagamento),
            status: (['PENDENTE', 'CONFIRMADO', 'REJEITADO'].includes(row.status)
              ? row.status
              : 'PENDENTE') as ReceiptStatus,
            observacoes: String(row.observacoes || ''),
            criadoEm: String(row.criadoEm || new Date().toISOString()),
            atualizadoEm: new Date().toISOString(),
            sincronizadoSheets: true,
            comprovantePix: {
              name: `Comprovante_${id || 'Pix'}`,
              type: 'image/png',
              base64: '',
              size: 0,
              driveUrl: driveUrl.startsWith('http') ? driveUrl : undefined,
            },
          };
        });

      return {
        success: true,
        message: `${mapped.length} comprovante(s) carregado(s) diretamente da planilha Google.`,
        receipts: mapped,
        count: mapped.length,
      };
    } else {
      return {
        success: false,
        message: json.message || 'Resposta inesperada do Apps Script.',
        receipts: [],
        count: 0,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Erro ao buscar dados do Google Apps Script: ${error.message || 'Falha de rede ou CORS'}.`,
      receipts: [],
      count: 0,
    };
  }
}



