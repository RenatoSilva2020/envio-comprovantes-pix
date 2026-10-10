import React, { useState } from 'react';
import { PixReceipt, AppSettings, ReceiptStatus } from '../types';
import { formatBRL, formatCPF, cleanCPF } from '../services/storage';
import {
  Search,
  Filter,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  RefreshCw,
  X,
  FileSpreadsheet,
  Check,
  Calendar,
  Lock,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import { generateSingleReceiptPdf } from '../services/pdfService';

interface AdminPanelProps {
  receipts: PixReceipt[];
  onUpdateStatus: (id: string, status: ReceiptStatus, observacoes?: string) => Promise<void>;
  onDeleteReceipt?: (id: string) => void;
  onViewReceipt: (receipt: PixReceipt) => void;
  onOpenReportModal: (filteredReceipts: PixReceipt[], currentFilters: any) => void;
  onSyncAllWithSheets: () => void | Promise<void>;
  settings: AppSettings;
  isSyncing: boolean;
  onLogout?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  receipts,
  onUpdateStatus,
  onViewReceipt,
  onOpenReportModal,
  onSyncAllWithSheets,
  settings,
  isSyncing,
  onLogout,
}) => {
  // Filtros avançados exigidos pelo usuário
  const [filterCpf, setFilterCpf] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFiltersMobile, setShowFiltersMobile] = useState<boolean>(false);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal customizado para rejeição com justificativa (sem window.prompt)
  const [rejectModalState, setRejectModalState] = useState<{
    isOpen: boolean;
    receiptId: string;
    receiptRef: string;
    reason: string;
    error?: string;
  }>({
    isOpen: false,
    receiptId: '',
    receiptRef: '',
    reason: '',
  });

  // Aplicação dos filtros
  const filteredReceipts = receipts.filter((r) => {
    // 1. Filtro por CPF do cliente
    if (filterCpf.trim()) {
      const cleanTarget = cleanCPF(filterCpf);
      const cleanRecordCpf = cleanCPF(r.cpf);
      if (!cleanRecordCpf.includes(cleanTarget)) {
        return false;
      }
    }

    // 2. Filtro por Período de tempo específico
    if (filterStartDate) {
      const recordDate = new Date(r.data);
      const startDate = new Date(filterStartDate);
      startDate.setHours(0, 0, 0, 0);
      if (recordDate < startDate) return false;
    }

    if (filterEndDate) {
      const recordDate = new Date(r.data);
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      if (recordDate > endDate) return false;
    }

    // 3. Filtro por Status
    if (filterStatus !== 'TODOS' && r.status !== filterStatus) {
      return false;
    }

    // 4. Busca textual livre (ID, Servidor, Referência)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = r.id.toLowerCase().includes(q);
      const matchServidor = (r.nomeServidor || '').toLowerCase().includes(q);
      const matchRef = r.referencia.toLowerCase().includes(q);
      if (!matchId && !matchServidor && !matchRef) return false;
    }

    return true;
  });

  // Métricas de totais
  const totalVolume = filteredReceipts.reduce((acc, curr) => acc + curr.valorPagamento, 0);
  const totalConfirmado = filteredReceipts
    .filter((r) => r.status === 'CONFIRMADO')
    .reduce((acc, curr) => acc + curr.valorPagamento, 0);
  const countPendentes = filteredReceipts.filter((r) => r.status === 'PENDENTE').length;
  const countConfirmados = filteredReceipts.filter((r) => r.status === 'CONFIRMADO').length;
  const countRejeitados = filteredReceipts.filter((r) => r.status === 'REJEITADO').length;

  const handleQuickStatus = async (
    id: string,
    status: ReceiptStatus,
    observacoes?: string
  ) => {
    await onUpdateStatus(id, status, observacoes);
    setActionSuccess(`Transação ${id} atualizada para ${status}.`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleOpenRejectModal = (receipt: PixReceipt) => {
    setRejectModalState({
      isOpen: true,
      receiptId: receipt.id,
      receiptRef: receipt.referencia,
      reason: receipt.observacoes || 'Comprovante divergente ou não identificado no extrato.',
    });
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalState.reason.trim()) {
      setRejectModalState((prev) => ({
        ...prev,
        error: 'Por favor, informe a justificativa da recusa.',
      }));
      return;
    }
    await handleQuickStatus(
      rejectModalState.receiptId,
      'REJEITADO',
      rejectModalState.reason.trim()
    );
    setRejectModalState({ isOpen: false, receiptId: '', receiptRef: '', reason: '' });
  };

  const clearFilters = () => {
    setFilterCpf('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterStatus('TODOS');
    setSearchQuery('');
  };

  const activeFiltersCount =
    (filterCpf ? 1 : 0) +
    (filterStartDate ? 1 : 0) +
    (filterEndDate ? 1 : 0) +
    (filterStatus !== 'TODOS' ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Data Pagamento',
      'CPF Cliente',
      'Nome Servidor',
      'Referencia',
      'Valor (R$)',
      'Status',
      'Link Drive',
      'Data Registro',
      'Observacoes',
    ];

    const rows = filteredReceipts.map((r) => [
      `"${r.id}"`,
      `"${new Date(r.data).toLocaleString('pt-BR')}"`,
      `"${formatCPF(r.cpf)}"`,
      `"${r.nomeServidor || ''}"`,
      `"${r.referencia}"`,
      r.valorPagamento.toFixed(2),
      `"${r.status}"`,
      `"${r.comprovantePix.driveUrl || ''}"`,
      `"${new Date(r.criadoEm).toLocaleString('pt-BR')}"`,
      `"${r.observacoes || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `relatorio_pixsync_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-800">
              Painel de Controle
            </span>
            <span className="text-[11px] text-slate-500">·</span>
            <span className="text-xs text-slate-600 font-medium">
              Administração Geral
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 mt-1">
            Gestão e Conferência de Pagamentos Pix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Filtre, confira e aprove as transações com sincronização na planilha Google.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
          <button
            type="button"
            onClick={() =>
              onOpenReportModal(filteredReceipts, {
                cpf: filterCpf,
                startDate: filterStartDate,
                endDate: filterEndDate,
                status: filterStatus,
              })
            }
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Relatório / PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={onSyncAllWithSheets}
            disabled={isSyncing}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            title="Sincronizar com o Google Apps Script"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
            <span className="sm:hidden">{isSyncing ? 'Sincronizando' : 'Sincronizar'}</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Sair do modo administrador"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* KPI Cards - Responsive Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Transações
          </span>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {filteredReceipts.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            Volume: {formatBRL(totalVolume)}
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
            Confirmados
          </span>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatBRL(totalConfirmado)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {countConfirmados} aprovados
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] sm:text-xs font-semibold text-amber-700 uppercase tracking-wider block">
            Pendentes
          </span>
          <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {countPendentes}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Em conferência
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] sm:text-xs font-semibold text-rose-700 uppercase tracking-wider block">
            Rejeitados
          </span>
          <p className="text-xl sm:text-2xl font-bold text-rose-700 mt-1 tabular-nums">
            {countRejeitados}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Inconsistências
          </p>
        </div>
      </div>

      {/* FILTROS AVANÇADOS - ACORDEÃO NO CELULAR, COMPLETO NO DESKTOP */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
            className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer sm:pointer-events-none"
          >
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filtros de Busca e Período</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                {activeFiltersCount}
              </span>
            )}
            <span className="sm:hidden text-slate-400 ml-1">
              {showFiltersMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Limpar Filtros
            </button>
          )}
        </div>

        {/* Filter inputs: always visible on sm+, togglable on mobile */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs ${showFiltersMobile ? 'block' : 'hidden sm:grid'}`}>
          {/* Filtro por CPF do cliente */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              CPF do Cliente
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={filterCpf}
              onChange={(e) => setFilterCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>

          {/* Filtro por Período: Data Inicial */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Filtro por Período: Data Final */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Filtro por Status */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Status da Transação
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PENDENTE">Pendentes (Em Análise)</option>
              <option value="CONFIRMADO">Confirmados (Aprovados)</option>
              <option value="REJEITADO">Rejeitados (Divergentes)</option>
            </select>
          </div>
        </div>

        {/* Busca por texto */}
        <div className={`relative ${showFiltersMobile ? 'block' : 'hidden sm:block'}`}>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ID, nome do titular ou referência..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* LISTAGEM DE TRANSAÇÕES */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Transações Encontradas
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              ({filteredReceipts.length})
            </span>
          </div>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            {receipts.length === 0 ? (
              <>
                <p className="text-slate-800 font-bold text-sm sm:text-base">
                  Sistema 100% limpo e espelhado com a planilha Google
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Nenhum comprovante cadastrado no momento. Os dados foram limpos e estão fiéis à sua planilha e pasta do Google Drive, prontos para receber novos pagamentos reais.
                </p>
                <button
                  type="button"
                  onClick={onSyncAllWithSheets}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verificar / Sincronizar com Planilha</span>
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-800 font-semibold text-sm">
                  Nenhum comprovante localizado com os filtros aplicados.
                </p>
                <p className="text-xs text-slate-400">
                  Tente redefinir o período ou limpar os filtros de busca.
                </p>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                  >
                    Limpar Todos os Filtros
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Visualização em Cards para Celular */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredReceipts.map((r) => (
                <div key={r.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 block">
                        {r.id}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(r.data).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

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

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 font-bold text-[10px] uppercase">VALOR:</span>
                      <span className="font-black text-sm text-emerald-700 tabular-nums">{formatBRL(r.valorPagamento)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 font-bold text-[10px] uppercase">CLIENTE:</span>
                      <span className="font-mono font-medium text-slate-700">{formatCPF(r.cpf)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 font-bold text-[10px] uppercase">TITULAR:</span>
                      <span className="font-medium text-slate-800 truncate max-w-[180px]">{r.nomeServidor || '-'}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 font-bold text-[10px] uppercase">REF:</span>
                      <span className="text-slate-700 truncate max-w-[180px]">{r.referencia}</span>
                    </div>
                  </div>

                  {/* Ações Rápidas no Celular */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => generateSingleReceiptPdf(r, settings)}
                      className="min-h-[40px] py-1.5 px-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                      title="Baixar Recibo em PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" /> PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => onViewReceipt(r)}
                      className="flex-1 min-h-[40px] py-1.5 px-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Detalhes
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickStatus(r.id, 'CONFIRMADO', 'Confirmado via extrato')}
                      className={`flex-1 min-h-[40px] py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
                        r.status === 'CONFIRMADO' ? 'bg-emerald-800 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" /> Aprovar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenRejectModal(r)}
                      className="min-h-[40px] py-1.5 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center justify-center cursor-pointer"
                      title="Rejeitar Pagamento"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Visualização em Tabela para Tablet e Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">ID / DATA</th>
                    <th className="py-3 px-3.5">CPF CLIENTE</th>
                    <th className="py-3 px-3.5">SERVIDOR</th>
                    <th className="py-3 px-3.5">REFERÊNCIA</th>
                    <th className="py-3 px-3.5 text-right">VALOR</th>
                    <th className="py-3 px-3.5 text-center">STATUS</th>
                    <th className="py-3 px-3.5 text-center">CONFERÊNCIA RÁPIDA</th>
                    <th className="py-3 px-3.5 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID & DATA */}
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-bold text-slate-800 block">
                          {r.id}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(r.data).toLocaleDateString('pt-BR')}
                        </span>
                      </td>

                      {/* CPF */}
                      <td className="py-3 px-3.5 font-mono font-medium text-slate-700">
                        {formatCPF(r.cpf)}
                      </td>

                      {/* SERVIDOR */}
                      <td className="py-3 px-3.5 text-slate-800 font-medium">
                        {r.nomeServidor || '-'}
                      </td>

                      {/* REFERÊNCIA */}
                      <td className="py-3 px-3.5 text-slate-700 max-w-[180px] truncate" title={r.referencia}>
                        {r.referencia}
                      </td>

                      {/* VALOR */}
                      <td className="py-3 px-3.5 text-right font-bold text-emerald-700 tabular-nums">
                        {formatBRL(r.valorPagamento)}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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

                      {/* CONFERENCIA RAPIDA */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(r.id, 'CONFIRMADO', 'Confirmado via extrato')}
                            className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              r.status === 'CONFIRMADO'
                                ? 'bg-emerald-700 text-white'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                            title="Confirmar Pagamento"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(r)}
                            className="p-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Rejeitar com Justificativa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* AÇÕES */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => generateSingleReceiptPdf(r, settings)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            title="Baixar Recibo em PDF"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" /> PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewReceipt(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Ver detalhes e comprovante"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL DE REJEIÇÃO COM JUSTIFICATIVA (Substitui window.prompt com segurança) */}
      {rejectModalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Rejeitar Transação Pix
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalState({ isOpen: false, receiptId: '', receiptRef: '', reason: '' })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>
                <strong>ID:</strong> <span className="font-mono text-slate-800">{rejectModalState.receiptId}</span>
              </p>
              <p>
                <strong>Referência:</strong> {rejectModalState.receiptRef}
              </p>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              {rejectModalState.error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs font-medium">
                  {rejectModalState.error}
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Justificativa da Recusa *
                </label>
                <textarea
                  value={rejectModalState.reason}
                  onChange={(e) =>
                    setRejectModalState((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  required
                  rows={3}
                  placeholder="Informe o motivo para que o cliente possa verificar e reenviar..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRejectModalState({ isOpen: false, receiptId: '', receiptRef: '', reason: '' })}
                  className="min-h-[40px] px-3.5 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Confirmar Rejeição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
