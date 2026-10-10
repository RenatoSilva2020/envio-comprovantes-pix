export type ReceiptStatus = 'PENDENTE' | 'CONFIRMADO' | 'REJEITADO';

export interface PixAttachment {
  name: string;
  type: string; // 'image/png' | 'image/jpeg' | 'application/pdf' etc.
  base64: string;
  size: number;
  driveUrl?: string;
}

export interface ReferenceOption {
  id: string;
  label: string;
  valor: number;
}

export interface ClientProfile {
  cpf: string; // Limpo ou formatado
  nome: string;
  cadastradoEm: string;
}

export interface PixReceipt {
  id: string; // Ex: PIX-202610-A89B
  data: string; // Data do pagamento YYYY-MM-DD ou YYYY-MM-DDTHH:mm
  cpf: string; // CPF formatado 000.000.000-00
  nomeServidor: string; // Nome do servidor ou recebedor (preenchido com o nome do cliente)
  referencia: string; // Mês/ano, código ou descrição
  valorPagamento: number; // Valor numérico em R$
  comprovantePix: PixAttachment;
  status: ReceiptStatus;
  observacoes?: string;
  observacaoCliente?: string;
  criadoEm: string; // Data e hora do envio ISO
  atualizadoEm: string;
  sincronizadoSheets?: boolean;
}

export interface AppSettings {
  spreadsheetId: string;
  gasWebAppUrl: string;
  apiSecretToken: string;
  sheetName: string;
  driveFolderId: string;
  driveFolderName: string;
  institutionName: string;
  autoSyncWithGas: boolean;
  adminPassword: string;
  referenciasPredefinidas: ReferenceOption[];
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  pixFavorecido?: string;
  cartazInstrucoesUrl?: string;
}
