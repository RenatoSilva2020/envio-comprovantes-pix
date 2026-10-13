import React, { useState, useRef } from 'react';
import { PixReceipt, AppSettings } from '../types';
import {
  formatCPF,
  cleanCPF,
  isValidCPF,
  formatBRL,
  generateReceiptId,
  parseBRL,
  getClientName,
  saveClientProfile,
  getDeviceLocalDateTime,
  formatPixFileName,
} from '../services/storage';
import {
  UploadCloud,
  FileCheck,
  PlusCircle,
  LogOut,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  Lock,
  User,
  Tag,
  MessageSquare,
  Sparkles,
  X,
  FileUp,
  Download,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { generateSingleReceiptPdf } from '../services/pdfService';

interface ClientPortalProps {
  receipts: PixReceipt[];
  onSubmitReceipt: (newReceipt: PixReceipt) => Promise<void>;
  onViewReceipt: (receipt: PixReceipt) => void;
  settings: AppSettings;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  receipts,
  onSubmitReceipt,
  onViewReceipt,
  settings,
}) => {
  // Estado de autenticação pelo CPF do cliente
  const [activeCpf, setActiveCpf] = useState<string>('');
  const [activeClientName, setActiveClientName] = useState<string>('');
  const [cpfInput, setCpfInput] = useState<string>('');
  const [cpfError, setCpfError] = useState<string>('');

  // Modal para primeiro cadastro de nome do cliente
  const [isNewClientModal, setIsNewClientModal] = useState<boolean>(false);
  const [pendingCpf, setPendingCpf] = useState<string>('');
  const [newClientNameInput, setNewClientNameInput] = useState<string>('');

  // Estado do formulário de novo envio
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formId, setFormId] = useState<string>(generateReceiptId());
  const [formData, setFormData] = useState<string>(() => getDeviceLocalDateTime());
  const [isDateManuallyChanged, setIsDateManuallyChanged] = useState<boolean>(false);
  const [formNomeServidor, setFormNomeServidor] = useState<string>('');
  const [selectedRefId, setSelectedRefId] = useState<string>('');
  const [formReferencia, setFormReferencia] = useState<string>('');
  const [formValor, setFormValor] = useState<string>('');
  const [formObservacaoCliente, setFormObservacaoCliente] = useState<string>('');
  const [formAttachment, setFormAttachment] = useState<{
    name: string;
    type: string;
    base64: string;
    size: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Estados dos Dados de Pagamento Pix (QR Code e Copia e Cola)
  const [copiedPix, setCopiedPix] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [showPixPaymentInForm, setShowPixPaymentInForm] = useState<boolean>(false);
  const [isInitialPixModalOpen, setIsInitialPixModalOpen] = useState<boolean>(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState<boolean>(false);

  const pixQrCodeUrl = settings.pixQrCodeUrl || 'https://i.ibb.co/N6zcpGFL/pix-eemp.png';
  const pixCopiaECola =
    settings.pixCopiaECola ||
    '00020101021126510014br.gov.bcb.pix0111393750566000214PGTOMARIOPORTO5204000053039865802BR5921EUNICE ABADIA MARTINS6010UBERLANDIA62070503***6304CCB3';
  const pixFavorecido = settings.pixFavorecido || 'EUNICE ABADIA MARTINS';
  const cartazInstrucoesUrl =
    settings.cartazInstrucoesUrl ||
    'https://i.ibb.co/4ZSbNDSz/Cartaz-Pagamento.png';

  const handleCopyPix = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pixCopiaECola);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = pixCopiaECola;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    } catch {
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  // Handler de login/consulta por CPF
  const handleCpfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanCPF(cpfInput);
    if (!clean) {
      setCpfError('Por favor, informe seu CPF.');
      return;
    }
    if (clean.length !== 11) {
      setCpfError('O CPF deve conter exatamente 11 dígitos.');
      return;
    }
    if (!isValidCPF(clean)) {
      setCpfError('CPF inválido. Por favor, verifique os 11 números digitados.');
      return;
    }

    setCpfError('');
    const existingName = getClientName(clean);

    if (existingName) {
      // Cliente já identificado pelo sistema anteriormente
      setActiveCpf(formatCPF(clean));
      setActiveClientName(existingName);
    } else {
      // Primeiro acesso: solicitar o Nome Completo do cliente
      setPendingCpf(formatCPF(clean));
      setNewClientNameInput('');
      setIsNewClientModal(true);
    }
  };

  // Salvar cadastro de novo cliente
  const [newClientError, setNewClientError] = useState<string>('');

  const handleSaveNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientNameInput.trim()) {
      setNewClientError('Por favor, informe seu Nome Completo.');
      return;
    }
    setNewClientError('');
    const clean = cleanCPF(pendingCpf);
    saveClientProfile(clean, newClientNameInput.trim());
    setActiveCpf(pendingCpf);
    setActiveClientName(newClientNameInput.trim());
    setIsNewClientModal(false);
  };

  // Filtragem estrita dos comprovantes vinculados ao CPF autenticado
  const userReceipts = receipts.filter(
    (r) => cleanCPF(r.cpf) === cleanCPF(activeCpf)
  );

  const filteredUserReceipts = userReceipts.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.id.toLowerCase().includes(term) ||
      r.referencia.toLowerCase().includes(term) ||
      (r.nomeServidor && r.nomeServidor.toLowerCase().includes(term))
    );
  });

  const totalPago = userReceipts
    .filter((r) => r.status === 'CONFIRMADO')
    .reduce((acc, curr) => acc + curr.valorPagamento, 0);

  const pendentesCount = userReceipts.filter((r) => r.status === 'PENDENTE').length;

  // Upload do comprovante (arquivo de imagem ou PDF)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFormError('O arquivo selecionado deve ter menos de 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        base64: reader.result as string,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleOpenForm = () => {
    setFormId(generateReceiptId());
    setFormData(getDeviceLocalDateTime());
    setIsDateManuallyChanged(false);

    // Preenche automaticamente o nome do titular
    setFormNomeServidor(activeClientName || '');

    // Inicializa a referência pré-definida com seu valor fixo
    // Inicializa a primeira referência pré-definida com seu valor fixo travado
    const preRefs = settings.referenciasPredefinidas || [];
    if (preRefs.length > 0) {
      setSelectedRefId(preRefs[0].id);
      setFormReferencia(preRefs[0].label);
      setFormValor(preRefs[0].valor.toFixed(2).replace('.', ','));
    } else {
      setSelectedRefId('custom');
      setFormReferencia('');
      setFormValor('');
    }

    setFormObservacaoCliente('');
    setFormAttachment(null);
    setSubmitSuccess(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleReferenceChange = (refId: string) => {
    setSelectedRefId(refId);
    if (refId === 'custom') {
      setFormReferencia('');
      setFormValor('');
    } else {
      const found = (settings.referenciasPredefinidas || []).find((r) => r.id === refId);
      if (found) {
        setFormReferencia(found.label);
        setFormValor(found.valor.toFixed(2).replace('.', ','));
      }
    }
  };

  const handleSubmitNewReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numericVal = parseBRL(formValor);
    if (numericVal <= 0) {
      setFormError('Por favor, informe um valor de pagamento válido (maior que zero).');
      return;
    }
    if (!formReferencia.trim()) {
      setFormError('Por favor, selecione ou informe a referência do pagamento.');
      return;
    }
    const titularName = (formNomeServidor || activeClientName || '').trim();
    if (!titularName) {
      setFormError('Nome do titular/servidor não identificado. Por favor, acesse novamente com seu CPF.');
      return;
    }
    if (!formAttachment) {
      setFormError('Por favor, selecione e anexe o comprovante Pix (imagem JPG/PNG ou PDF).');
      return;
    }

    setIsSubmitting(true);

    try {
      // Ao enviar o comprovante, se o cliente não alterou manualmente, o valor padrão é a data e hora atual do dispositivo no momento exato do envio
      const paymentDate = !isDateManuallyChanged || !formData
        ? getDeviceLocalDateTime()
        : formData;

      // Nome do arquivo formatado conforme solicitado: PIX-SERVIDOR_DATA_HORA.ext
      const standardizedFileName = formatPixFileName(
        titularName,
        paymentDate,
        formAttachment.name
      );

      const finalAttachment = {
        ...formAttachment,
        name: standardizedFileName,
      };

      const newReceipt: PixReceipt = {
        id: formId,
        data: paymentDate,
        cpf: activeCpf,
        nomeServidor: titularName,
        referencia: formReferencia.trim(),
        valorPagamento: numericVal,
        comprovantePix: finalAttachment,
        status: 'PENDENTE',
        observacaoCliente: formObservacaoCliente.trim() || undefined,
        observacoes: formObservacaoCliente.trim() || undefined,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        sincronizadoSheets: false,
      };

      await onSubmitReceipt(newReceipt);
      setSubmitSuccess(`Comprovante ${formId} enviado com sucesso e registrado!`);
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(`Erro ao registrar comprovante: ${err.message || 'Tente novamente'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // RENDERIZAÇÃO PRINCIPAL DO PORTAL DO CLIENTE
  // -------------------------------------------------------------
  return (
    <>
      {!activeCpf ? (
        <div className="max-w-md mx-auto py-8 sm:py-14 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 p-6 sm:p-8 text-white text-center">
            <div className="w-14 h-14 bg-white/10 rounded-xl mx-auto flex items-center justify-center mb-3">
              <Lock className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Envio de Comprovantes</h2>
            <p className="text-slate-300 text-xs mt-1">
              Envio seguro e consulta privativa de comprovantes de pagamento
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Privacidade Garantida:</strong> Digite seu CPF para acessar unicamente os comprovantes enviados por você.
              </div>
            </div>

            <form onSubmit={handleCpfSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Informe seu CPF
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cpfInput}
                    onChange={(e) => {
                      setCpfInput(formatCPF(e.target.value));
                      setCpfError('');
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full px-4 py-3.5 text-lg font-mono tracking-wider rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                    autoFocus
                  />
                </div>
                {cpfError && (
                  <p className="text-xs text-rose-600 mt-2 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {cpfError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                Acessar Meus Comprovantes
              </button>
            </form>

            {/* Linha Divisória */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2.5 text-slate-400 font-medium">Ainda não pagou?</span>
              </div>
            </div>

            {/* Botão de Destaque: Dados para Pagamento Pix Antes de Entrar */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setIsInitialPixModalOpen(true)}
                className="w-full min-h-[46px] py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs group"
              >
                <QrCode className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                <span>Dados para Pagamento PIX</span>
              </button>
              <p className="text-[11px] text-center text-slate-500">
                Toque para visualizar a chave Pix Copia e Cola e o QR Code oficial
              </p>
            </div>

            {/* Botão de Destaque: Instruções de Como Funciona o Sistema (Cartaz) */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsInstructionsModalOpen(true)}
                className="w-full min-h-[44px] py-2.5 px-4 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs group"
              >
                <HelpCircle className="w-4 h-4 text-sky-600 group-hover:scale-110 transition-transform shrink-0" />
                <span>Dúvidas? Veja o passo-a-passo</span>
              </button>
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <span>Passo a passo no cartaz explicativo</span>
                <span>•</span>
                <a
                  href={cartazInstrucoesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-700 hover:text-sky-900 font-semibold inline-flex items-center gap-1 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir imagem</span>
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    ) : (
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Top Welcome Card - Mobile Optimized Stack */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-700">
              Envio de Comprovantes
            </span>
            <span className="text-[11px] text-slate-500">·</span>
            <span className="text-[11px] text-emerald-800 font-semibold">
              Identificado
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Olá, <span className="text-emerald-700">{activeClientName || 'Cliente'}</span>
          </h2>
          <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1">
            <span>CPF:</span>
            <span className="font-mono font-bold text-slate-800">{activeCpf}</span>
            <span className="hidden sm:inline">· Exibindo apenas os comprovantes deste CPF.</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 sm:pt-0">
          <button
            type="button"
            onClick={handleOpenForm}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Enviar Novo Comprovante</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveCpf('');
              setActiveClientName('');
            }}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium text-xs rounded-xl transition-colors cursor-pointer"
            title="Sair ou trocar de CPF"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Trocar CPF</span>
          </button>
        </div>
      </div>

      {submitSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs sm:text-sm text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{submitSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSubmitSuccess(null)}
            className="text-emerald-700 text-xs font-semibold hover:underline shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Botão Clean: Dados para Pagamento Pix */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              Precisa pagar via Pix?
            </h4>
            <p className="text-[11px] text-slate-500">
              Consulte a chave Copia e Cola e o QR Code oficial antes de anexar seu comprovante
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsInstructionsModalOpen(true)}
            className="min-h-[40px] px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
            title="Ver cartaz com passo a passo do sistema"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
            <span>Dúvidas? Veja o passo-a-passo</span>
          </button>

          <button
            type="button"
            onClick={() => setIsInitialPixModalOpen(true)}
            className="min-h-[40px] px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs shrink-0"
          >
            <QrCode className="w-4 h-4 text-emerald-700" />
            <span>Dados para Pagamento PIX</span>
          </button>
        </div>
      </div>


      {/* KPI Cards for the client */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total de Comprovantes
          </span>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {userReceipts.length}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Envios deste CPF</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
            Total Confirmado
          </span>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatBRL(totalPago)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Aprovados pela administração</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
            Em Análise / Pendentes
          </span>
          <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {pendentesCount}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Aguardando conferência</p>
        </div>
      </div>

      {/* MODAL / FORMULÁRIO DE NOVO ENVIO - MOBILE FULL OPTIMIZED */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm sm:text-base">Enviar Novo Comprovante Pix</h3>
                <p className="text-xs text-slate-400">
                  Preencha os dados para registro na planilha
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewReceipt} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {/* Mensagem de Erro de Validação */}
              {formError && (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2 shadow-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{formError}</span>
                </div>
              )}

              {/* Botão Clean: Dados para Pagamento Pix */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-semibold text-emerald-950">
                    Ainda precisa realizar o pagamento?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInitialPixModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Dados para Pagamento PIX</span>
                </button>
              </div>

              {/* ID & DATA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      ID do Envio
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormId(generateReceiptId())}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium cursor-pointer"
                      title="Gerar novo código"
                    >
                      <RefreshCw className="w-3 h-3" /> Novo ID
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formId}
                    readOnly
                    className="w-full px-3 py-2 text-sm sm:text-base font-mono bg-slate-100 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Data do Pagamento *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(getDeviceLocalDateTime());
                        setIsDateManuallyChanged(false);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                      title="Atualizar para data e hora atual do seu aparelho"
                    >
                      <Clock className="w-3 h-3" /> Agora (Dispositivo)
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    value={formData}
                    onChange={(e) => {
                      setFormData(e.target.value);
                      setIsDateManuallyChanged(true);
                    }}
                    required
                    className="w-full px-3 py-2 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Padrão: data e hora atual do seu dispositivo no momento do envio.
                  </p>
                </div>
              </div>

              {/* CPF & TITULAR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    CPF do Cliente (Seu CPF)
                  </label>
                  <input
                    type="text"
                    value={activeCpf}
                    readOnly
                    className="w-full px-3 py-2 text-sm sm:text-base font-mono bg-slate-100 border border-slate-300 rounded-lg text-slate-700 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nome do Titular / Servidor
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={formNomeServidor || activeClientName}
                      readOnly
                      placeholder="Nome do titular"
                      className="w-full pl-9 pr-3 py-2 text-sm sm:text-base bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-medium cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* REFERÊNCIA & VALOR FIXO */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 uppercase">
                    Serviço &amp; Valor Fixo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Referência / Descrição *
                    </label>
                    <select
                      value={selectedRefId}
                      onChange={(e) => handleReferenceChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                      required
                    >
                      {(settings.referenciasPredefinidas || []).map((ref) => (
                        <option key={ref.id} value={ref.id}>
                          {ref.label}
                        </option>
                      ))}
                      <option value="custom">Outra Referência / Personalizado...</option>
                    </select>

                    {selectedRefId === 'custom' && (
                      <input
                        type="text"
                        value={formReferencia}
                        onChange={(e) => setFormReferencia(e.target.value)}
                        placeholder="Digite a referência..."
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden mt-2"
                        required
                      />
                    )}
                  </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">
                          Valor (R$) *
                        </label>
                        {selectedRefId !== 'custom' ? (
                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                            Valor Fixo Travado
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Valor Editável
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">R$</span>
                        <input
                          type="text"
                          value={formValor}
                          onChange={(e) => {
                            if (selectedRefId === 'custom') {
                              setFormValor(e.target.value);
                            }
                          }}
                          readOnly={selectedRefId !== 'custom'}
                          placeholder="0,00"
                          required
                          className={`w-full pl-9 pr-3 py-2 text-sm sm:text-base font-bold border rounded-lg focus:outline-hidden ${
                            selectedRefId !== 'custom'
                              ? 'bg-slate-100 border-slate-300 text-slate-800 cursor-not-allowed select-none'
                              : 'border-slate-300 focus:ring-2 focus:ring-emerald-500 bg-white'
                          }`}
                        />
                      </div>
                    </div>
                </div>
              </div>

              {/* OBSERVAÇÕES OPCIONAIS DO CLIENTE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Observações (Opcional)</span>
                </label>
                <textarea
                  value={formObservacaoCliente}
                  onChange={(e) => setFormObservacaoCliente(e.target.value)}
                  placeholder="Informações adicionais para ajudar o setor na conferência..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* COMPROVANTE_PIX (Upload de Imagem ou PDF) - SAFE BUTTON WITHOUT LABEL BUBBLING */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Comprovante Pix (Imagem ou PDF) *
                </label>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!formAttachment ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center bg-slate-50/60 hover:bg-emerald-50/30 transition-colors cursor-pointer select-none"
                  >
                    <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 mb-2" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs hover:bg-emerald-700 mb-1"
                    >
                      Selecionar Arquivo
                    </button>
                    <span className="text-[11px] text-slate-400">
                      Formatos aceitos: JPG, PNG, WEBP ou PDF (até 10MB)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {formAttachment.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {Math.round(formAttachment.size / 1024)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormAttachment(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 cursor-pointer shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              {/* Botoes de Acao */}
              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Registrando...
                    </>
                  ) : (
                    'Confirmar e Enviar Comprovante'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Histórico de Comprovantes Enviados por este CPF */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Meus Comprovantes Enviados</h3>
            <p className="text-xs text-slate-500">
              Histórico exclusivo deste CPF
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID ou Referência..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>
        </div>

        {filteredUserReceipts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-slate-800 font-semibold text-sm">
              Nenhum comprovante enviado por este CPF ainda.
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Clique no botão "Enviar Novo Comprovante" acima para registrar seu primeiro pagamento.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenForm}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Enviar Meu Primeiro Comprovante
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Visualização Otimizada para Celular (Cards) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredUserReceipts.map((r) => (
                <div key={r.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-800">
                      {r.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        r.status === 'CONFIRMADO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'REJEITADO'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status === 'CONFIRMADO' && <CheckCircle2 className="w-3 h-3" />}
                      {r.status === 'PENDENTE' && <Clock className="w-3 h-3" />}
                      {r.status === 'REJEITADO' && <AlertCircle className="w-3 h-3" />}
                      {r.status}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Referência:</span>
                      <p className="font-semibold text-xs text-slate-800 truncate">{r.referencia}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Valor:</span>
                      <p className="text-base font-black text-emerald-700 tabular-nums">{formatBRL(r.valorPagamento)}</p>
                    </div>
                  </div>

                  {/* Observação do Cliente (se houver) */}
                  {(r.observacaoCliente || r.observacoes) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">
                        Observação:
                      </span>
                      <p className="text-slate-800 whitespace-pre-line">{r.observacaoCliente || r.observacoes}</p>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(r.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewReceipt(r)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                        title="Ver detalhes do comprovante"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </button>
                    </div>
                  </div>

                  {r.status === 'REJEITADO' && r.observacoes && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-900">
                      <strong>Motivo da recusa:</strong> {r.observacoes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Visualização Tradicional para Tablet e Desktop (Tabela) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">ID DO ENVIO</th>
                    <th className="py-3 px-4">DATA DO PAGTO</th>
                    <th className="py-3 px-4">TITULAR / SERVIDOR</th>
                    <th className="py-3 px-4">REFERÊNCIA</th>
                    <th className="py-3 px-4">OBSERVAÇÃO</th>
                    <th className="py-3 px-4 text-right">VALOR</th>
                    <th className="py-3 px-4 text-center">STATUS</th>
                    <th className="py-3 px-4 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUserReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {r.id}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(r.data).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {r.nomeServidor || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">
                        {r.referencia}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={r.observacaoCliente || r.observacoes || ''}>
                        {r.observacaoCliente || r.observacoes || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700 text-right tabular-nums">
                        {formatBRL(r.valorPagamento)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            r.status === 'CONFIRMADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'REJEITADO'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status === 'CONFIRMADO' && <CheckCircle2 className="w-3 h-3" />}
                          {r.status === 'PENDENTE' && <Clock className="w-3 h-3" />}
                          {r.status === 'REJEITADO' && <AlertCircle className="w-3 h-3" />}
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onViewReceipt(r)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          title="Ver detalhes do comprovante"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
      )}

      {/* MODAL GLOBAL: DADOS PARA PAGAMENTO PIX */}
      {isInitialPixModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="bg-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">Dados para Pagamento Pix</h3>
                  <p className="text-xs text-emerald-200">Chave oficial e QR Code para transferência</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInitialPixModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {/* QR Code centralizado */}
              <div className="flex flex-col items-center text-center">
                <div
                  onClick={() => setIsQrModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:shadow-md hover:border-emerald-400 transition-all group relative"
                  title="Clique para ampliar o QR Code"
                >
                  <img
                    src={pixQrCodeUrl}
                    alt="QR Code Pix"
                    className="w-44 h-44 object-contain rounded-lg"
                  />
                  <div className="absolute inset-0 bg-emerald-950/20 group-hover:bg-emerald-950/30 rounded-2xl transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-white text-emerald-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                      Ampliar QR Code
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 mt-2 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Toque para ampliar o QR Code</span>
                </button>
              </div>

              {/* Favorecido Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Favorecido (Recebedor Pix)
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 block mt-0.5">
                    {pixFavorecido}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2.5 py-1 rounded-lg self-start sm:self-center">
                  Destinatário Conferido
                </span>
              </div>

              {/* Pix Copia e Cola */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  Pix Copia e Cola:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={pixCopiaECola}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full pl-3 pr-28 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-700 focus:outline-hidden select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className={`absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      copiedPix
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instruções */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
                <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>Como realizar o pagamento:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed">
                  <li>Abra o aplicativo do seu banco e acesse a área <strong>Pix</strong>.</li>
                  <li>Utilize a opção <strong>Pix Copia e Cola</strong> (ou aponte a câmera para o QR Code acima).</li>
                  <li>Confirme o nome da favorecida: <strong>{pixFavorecido}</strong>.</li>
                  <li>Conclua o pagamento, salve o comprovante gerado (imagem ou PDF) e em seguida entre com seu CPF para enviar!</li>
                </ol>
              </div>
            </div>

            {/* Footer com botão de ação rápida */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsInitialPixModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsInitialPixModalOpen(false);
                  if (activeCpf && !isFormOpen) {
                    setIsFormOpen(true);
                  }
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Já paguei, quero enviar o comprovante</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GLOBAL: ZOOM DO QR CODE */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative border border-slate-200">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h4 className="font-bold text-slate-900 text-base">QR Code para Pagamento Pix</h4>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center">
              <img
                src={pixQrCodeUrl}
                alt="QR Code Pix em alta definição"
                className="w-64 h-64 object-contain rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 block">Favorecido:</span>
              <p className="font-bold text-slate-800 text-sm">{pixFavorecido}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyPix}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedPix ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedPix ? 'Código Pix Copiado!' : 'Copiar Chave Copia e Cola'}</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL GLOBAL PARA PRIMEIRO ACESSO: CADASTRO DO NOME COMPLETO */}
      {isNewClientModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto text-emerald-700 mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Primeiro Acesso Detectado
              </h3>
              <p className="text-xs text-slate-500">
                Informe seu <strong>Nome Completo</strong> para vincular aos seus envios:
              </p>
            </div>

            <form onSubmit={handleSaveNewClient} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  CPF Informado
                </label>
                <input
                  type="text"
                  value={pendingCpf}
                  readOnly
                  className="w-full px-3 py-2.5 font-mono bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Seu Nome Completo *
                </label>
                <input
                  type="text"
                  value={newClientNameInput}
                  onChange={(e) => {
                    setNewClientNameInput(e.target.value);
                    if (newClientError) setNewClientError('');
                  }}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                {newClientError && (
                  <span className="text-xs text-rose-600 font-semibold mt-1 block">
                    {newClientError}
                  </span>
                )}
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Nos próximos envios, você será identificado automaticamente!
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewClientModal(false)}
                  className="w-1/3 min-h-[44px] py-2.5 px-3 text-slate-600 hover:bg-slate-100 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="w-2/3 min-h-[44px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Salvar e Acessar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GLOBAL: CARTAZ DE INSTRUÇÕES DE COMO FUNCIONA O SISTEMA */}
      {isInstructionsModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[94vh]">
            {/* Header */}
            <div className="bg-sky-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-sky-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">Como Funciona o Sistema</h3>
                  <p className="text-xs text-sky-200">Instruções para pagamento Pix e envio de comprovante</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInstructionsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Imagem do Cartaz */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100/90 flex flex-col items-center justify-center">
              <div className="relative group max-w-full">
                <img
                  src={cartazInstrucoesUrl}
                  alt="Cartaz de Instruções de Pagamento"
                  className="max-h-[66vh] w-auto max-w-full object-contain rounded-xl shadow-md border border-slate-200 bg-white"
                  loading="lazy"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-3 text-center">
                Você pode clicar no botão abaixo para abrir ou salvar a imagem em tamanho original.
              </p>
            </div>

            {/* Rodapé com Ações */}
            <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <a
                href={cartazInstrucoesUrl}
                target="_blank"
                rel="noreferrer"
                className="min-h-[40px] px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-xs rounded-xl inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-sky-600" />
                <span>Abrir Imagem em Tela Cheia / Nova Aba</span>
              </a>

              <button
                type="button"
                onClick={() => setIsInstructionsModalOpen(false)}
                className="min-h-[40px] px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
