import { AppSettings, PixReceipt } from '../types';

const SETTINGS_KEY = 'pixsync_settings_v1';
const DEFAULT_STATE_KEY = 'pixsync_default_state_v1';
const RECEIPTS_KEY = 'pixsync_receipts_v1';
const CLIENTS_KEY = 'pixsync_clients_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  gasWebAppUrl: '',
  apiSecretToken: 'pix-sync-sec-2026',
  sheetName: 'Comprovantes_Pix',
  driveFolderId: '',
  driveFolderName: 'Comprovantes_Pix_Uploads',
  institutionName: 'Prefeitura Municipal / Secretaria de Finanças',
  autoSyncWithGas: true,
  adminPassword: 'eemp2026',
  pixQrCodeUrl: 'https://i.ibb.co/N6zcpGFL/pix-eemp.png',
  pixCopiaECola: '00020101021126510014br.gov.bcb.pix0111393750566000214PGTOMARIOPORTO5204000053039865802BR5921EUNICE ABADIA MARTINS6010UBERLANDIA62070503***6304CCB3',
  pixFavorecido: 'EUNICE ABADIA MARTINS',
  cartazInstrucoesUrl: 'https://i.ibb.co/4ZSbNDSz/Cartaz-Pagamento.png',
  referenciasPredefinidas: [
    { id: 'ref-1', label: 'Mensalidade Outubro/2026', valor: 350.0 },
    { id: 'ref-2', label: 'Matrícula 2026/2 - Taxa de Inscrição', valor: 120.0 },
    { id: 'ref-3', label: 'Segunda Via de Documento / Certidão', valor: 45.0 },
    { id: 'ref-4', label: 'Taxa de Expedição de Diploma', valor: 85.0 },
    { id: 'ref-5', label: 'Inscrição em Concurso / Processo Seletivo', valor: 150.0 },
    { id: 'ref-6', label: 'Taxa Administrativa Geral', valor: 60.0 },
  ],
};

// Limpa qualquer formatação de CPF
export function cleanCPF(cpf: string): string {
  return (cpf || '').replace(/\D/g, '');
}

// Formata string para 000.000.000-00
export function formatCPF(value: string): string {
  const digits = cleanCPF(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// Validação de CPF (valida 11 dígitos numéricos e algoritmo oficial Módulo 11)
export function isValidCPF(cpf: string): boolean {
  const clean = cleanCPF(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

// Retorna a data e hora atual do dispositivo do cliente no formato local YYYY-MM-DDTHH:mm
export function getDeviceLocalDateTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Gera o nome padronizado do comprovante na pasta: PIX-SERVIDOR_DATA_HORA.ext
export function formatPixFileName(
  nomeServidor: string,
  dataHora: string,
  originalFileName: string
): string {
  const ext = originalFileName && originalFileName.includes('.')
    ? originalFileName.split('.').pop() || 'png'
    : 'png';

  const cleanServidor = (nomeServidor || 'SERVIDOR')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '')
    .toUpperCase();

  let dataHoraStr = '';
  try {
    const d = new Date(dataHora);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dia = pad(d.getDate());
      const mes = pad(d.getMonth() + 1);
      const ano = d.getFullYear();
      const hora = pad(d.getHours());
      const min = pad(d.getMinutes());
      dataHoraStr = `${dia}-${mes}-${ano}_${hora}h${min}`;
    }
  } catch (e) {
    // fallback
  }

  if (!dataHoraStr) {
    dataHoraStr = getDeviceLocalDateTime().replace('T', '_').replace(':', 'h');
  }

  return `PIX-${cleanServidor}_${dataHoraStr}.${ext}`;
}

// Formatação monetária BRL
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

// Parser ultra-robusto de valor monetário (aceita "350,00", "350.00", "1.250,50", "1,250.50", "350", "R$ 45,00", etc.)
export function parseBRL(value: string | number): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.round(value * 100) / 100;
  }
  if (!value || typeof value !== 'string') return 0;

  let str = value.trim().replace(/^R\$\s*/i, '').trim();
  if (!str) return 0;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Padrão brasileiro: 1.250,50 (pontos são milhares, vírgula é decimal)
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Padrão internacional: 1,250.50 (vírgulas são milhares, ponto é decimal)
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Apenas vírgula: "350,00" ou "1250,50" -> vírgula vira ponto decimal
    str = str.replace(',', '.');
  } else if (hasDot) {
    // Apenas ponto:
    const parts = str.split('.');
    if (parts.length === 2) {
      // Ex: "350.00", "45.00", "120.50" (gerado por toFixed(2))
      // Se a parte após o ponto tiver 3 dígitos ("1.000"), poderia ser milhar, senão é decimal
      if (parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3) {
        str = parts[0] + parts[1]; // 1000
      }
      // Caso contrário ("350.00", "45.0", "12.99"), mantém o ponto como decimal!
    } else if (parts.length > 2) {
      // Múltiplos pontos ("1.000.000") -> são milhares
      str = str.replace(/\./g, '');
    }
  }

  // Remove qualquer caracter estranho exceto dígitos e ponto decimal
  str = str.replace(/[^\d.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

// Gera ID de comprovante padronizado
export function generateReceiptId(): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timeSuffix = String(now.getSeconds()).padStart(2, '0');
  return `PIX-${yearMonth}-${randomStr}${timeSuffix}`;
}

export function getEffectiveDefaultSettings(): AppSettings {
  try {
    const rawDefault = localStorage.getItem(DEFAULT_STATE_KEY);
    if (rawDefault) {
      const parsedDefault = JSON.parse(rawDefault);
      return { ...DEFAULT_SETTINGS, ...parsedDefault };
    }
  } catch {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

export function getSettings(): AppSettings {
  const baseDefaults = getEffectiveDefaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return baseDefaults;
    const parsed = JSON.parse(raw);
    const merged = { ...baseDefaults, ...parsed };
    if (!merged.adminPassword || merged.adminPassword === 'admin') {
      merged.adminPassword = 'eemp2026';
    }
    if (!merged.pixQrCodeUrl) {
      merged.pixQrCodeUrl = DEFAULT_SETTINGS.pixQrCodeUrl;
    }
    if (!merged.pixCopiaECola) {
      merged.pixCopiaECola = DEFAULT_SETTINGS.pixCopiaECola;
    }
    if (!merged.pixFavorecido) {
      merged.pixFavorecido = DEFAULT_SETTINGS.pixFavorecido;
    }
    if (!merged.cartazInstrucoesUrl) {
      merged.cartazInstrucoesUrl = DEFAULT_SETTINGS.cartazInstrucoesUrl;
    }
    return merged;
  } catch {
    return baseDefaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Salva o estado atual do sistema como padrão permanente
export function saveCurrentStateAsDefault(settings: AppSettings): void {
  localStorage.setItem(DEFAULT_STATE_KEY, JSON.stringify(settings));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Restaura as configurações para o padrão do sistema
export function resetToDefaultSettings(): AppSettings {
  const target = getEffectiveDefaultSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(target));
  return target;
}

// Inicializa e sincroniza o estado atual como padrão definitivo do sistema
export function syncCurrentStateAsPermanentDefault(): void {
  try {
    if (typeof window !== 'undefined') {
      const currentRaw = localStorage.getItem(SETTINGS_KEY);
      if (currentRaw) {
        const parsed = JSON.parse(currentRaw);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        localStorage.setItem(DEFAULT_STATE_KEY, JSON.stringify(merged));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      } else {
        localStorage.setItem(DEFAULT_STATE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      }
    }
  } catch {
    // Ignora se localStorage não estiver acessível
  }
}

// Migração de limpeza para refletir dados excluídos na planilha e drive
const CLEAN_TEST_MIGRATION_KEY = 'pixsync_clean_test_v3';
export function runInitialCleanIfPending(): void {
  try {
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem(CLEAN_TEST_MIGRATION_KEY)) {
        // O usuário excluiu as linhas de teste da planilha e as fotos da pasta do Drive.
        // Zeramos o cache local para que o sistema fique 100% limpo e fiel ao Sheets/Drive.
        localStorage.setItem(RECEIPTS_KEY, JSON.stringify([]));
        localStorage.setItem(CLEAN_TEST_MIGRATION_KEY, 'true');
      }
    }
  } catch (e) {
    console.warn('Erro ao verificar limpeza inicial:', e);
  }
}
runInitialCleanIfPending();

// Executa sincronização do estado atual como padrão
syncCurrentStateAsPermanentDefault();

// Gerenciamento de clientes por CPF (Identificação por Nome Completo)
const DEFAULT_CLIENTS: Record<string, string> = {};

export function getClientName(cpf: string): string | null {
  const clean = cleanCPF(cpf);
  if (!clean) return null;
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    const clients = raw ? JSON.parse(raw) : DEFAULT_CLIENTS;
    return clients[clean] || null;
  } catch {
    return null;
  }
}

export function saveClientProfile(cpf: string, nome: string): void {
  const clean = cleanCPF(cpf);
  if (!clean || !nome.trim()) return;
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    const clients = raw ? JSON.parse(raw) : {};
    clients[clean] = nome.trim();
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.warn('Erro ao salvar cliente:', e);
  }
}

export function getReceipts(): PixReceipt[] {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed: PixReceipt[] = JSON.parse(raw);
    // Remove qualquer comprovante antigo que pertencia aos CPFs de teste/demonstração removidos
    const demoCpfs = ['12345678900', '98765432199', '55544433322', '11122233344'];
    let needsResave = false;
    const cleaned = parsed.filter((r) => !demoCpfs.includes(cleanCPF(r.cpf)));

    // Correção automática de segurança para valores anteriormente salvos com bug de multiplicação
    const settings = getSettings();
    const refs = settings.referenciasPredefinidas || [];
    cleaned.forEach((r) => {
      if (typeof r.valorPagamento === 'number') {
        const matched = refs.find((ref) => ref.label === r.referencia);
        if (matched && matched.valor > 0) {
          // Se o valor salvo estiver multiplicado por 100 ou 1000 da referência selecionada
          if (Math.abs(r.valorPagamento - matched.valor * 100) < 0.1) {
            r.valorPagamento = matched.valor;
            needsResave = true;
          } else if (Math.abs(r.valorPagamento - matched.valor * 1000) < 0.1) {
            r.valorPagamento = matched.valor;
            needsResave = true;
          }
        }
      }
    });

    if (needsResave) {
      localStorage.setItem(RECEIPTS_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch {
    return [];
  }
}

export function saveReceipt(receipt: PixReceipt): PixReceipt {
  const current = getReceipts();
  const updated = [receipt, ...current];
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(updated));
  return receipt;
}

export function updateReceipt(id: string, updates: Partial<PixReceipt>): PixReceipt | null {
  const current = getReceipts();
  const index = current.findIndex((r) => r.id === id);
  if (index === -1) return null;

  current[index] = {
    ...current[index],
    ...updates,
    atualizadoEm: new Date().toISOString(),
  };
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(current));
  return current[index];
}

export function deleteReceipt(id: string): void {
  const current = getReceipts();
  const updated = current.filter((r) => r.id !== id);
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(updated));
}

// Substitui toda a lista local para espelhar com precisão o Google Sheets
export function setAllReceipts(receipts: PixReceipt[]): void {
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
}

// Zera completamente todos os comprovantes locais
export function clearAllReceipts(): void {
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify([]));
}

export function getReceiptsByCPF(cpf: string): PixReceipt[] {
  const cleanTarget = cleanCPF(cpf);
  const all = getReceipts();
  return all.filter((r) => cleanCPF(r.cpf) === cleanTarget);
}

// Detecta se o sistema está rodando no ambiente do AI Studio
// No sistema postado (GitHub Pages), o painel de configurações e GAS fica oculto
export function isAiStudioEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isDevHost =
    host.includes('run.app') ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('webcontainer') ||
    host.includes('codesandbox');

  // Permite acesso de contingência caso o responsável adicione ?config=true na URL do GitHub Pages
  try {
    const search = window.location.search;
    if (search && (search.includes('config=true') || search.includes('dev=true'))) {
      return true;
    }
  } catch {
    // ignore
  }

  return isDevHost;
}


