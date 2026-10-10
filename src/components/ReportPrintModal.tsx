import React, { useState } from 'react';
import { PixReceipt, AppSettings } from '../types';
import { formatBRL, formatCPF } from '../services/storage';
import { Printer, Download, X, FileText, CheckCircle2 } from 'lucide-react';
import { generateReportPdf, triggerPrintWindow } from '../services/pdfService';

interface ReportPrintModalProps {
  receipts: PixReceipt[];
  settings: AppSettings;
  filters: {
    cpf: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  onClose: () => void;
}

export const ReportPrintModal: React.FC<ReportPrintModalProps> = ({
  receipts,
  settings,
  filters,
  onClose,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  const totalValor = receipts.reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);
  const totalConfirmado = receipts
    .filter((r) => r.status === 'CONFIRMADO')
    .reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateReportPdf(receipts, settings, filters);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3500);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Erro ao chamar window.print():', e);
    }
    // Dispara a geração/download do PDF para garantir que o usuário obtenha o documento
    // mesmo em ambientes de preview, iframe ou dispositivos móveis onde window.print é bloqueado
    handleDownloadPdf();
  };

  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Data Pagamento',
      'CPF Cliente',
      'Nome Servidor',
      'Referencia',
      'Valor (R$)',
      'Status',
      'Data Registro',
      'Observacoes',
    ];

    const rows = receipts.map((r) => [
      `"${r.id}"`,
      `"${new Date(r.data).toLocaleString('pt-BR')}"`,
      `"${formatCPF(r.cpf)}"`,
      `"${r.nomeServidor || ''}"`,
      `"${r.referencia}"`,
      r.valorPagamento.toFixed(2),
      `"${r.status}"`,
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
      `relatorio_comprovantes_pix_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col print:border-none print:shadow-none print:max-w-full print:max-h-none">
        {/* Actions bar (hidden in print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-6 sm:py-4 bg-slate-100 border-b border-slate-200 gap-2 shrink-0 print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Relatório Gerencial de Transações Pix</h3>
              <p className="text-xs text-slate-500">
                Pronto para salvar em PDF ou imprimir
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg sm:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" /> Exportar CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer disabled:opacity-60"
            >
              {pdfSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" /> PDF Baixado!
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" /> Baixar PDF
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[38px] flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" /> Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg hidden sm:block ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper View */}
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 text-slate-800 bg-white overflow-y-auto flex-1">
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row justify-between sm:items-start gap-2">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-700 font-bold block">
                {settings.institutionName || 'Sistema PixSync'}
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                Relatório de Comprovantes de Pagamento Pix
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Planilha: {settings.spreadsheetId.slice(0, 16)}... · Aba: {settings.sheetName}
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500">
              <p>Gerado em: <strong>{new Date().toLocaleString('pt-BR')}</strong></p>
              <p>Total de Registros: <strong>{receipts.length}</strong></p>
            </div>
          </div>

          {/* Active Filter Summary */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-slate-400 block font-medium">FILTRO CPF:</span>
              <span className="font-semibold text-slate-800">
                {filters.cpf ? formatCPF(filters.cpf) : 'Todos os CPFs'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">PERÍODO INICIAL:</span>
              <span className="font-semibold text-slate-800">
                {filters.startDate ? new Date(filters.startDate).toLocaleDateString('pt-BR') : 'Sem limite'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">PERÍODO FINAL:</span>
              <span className="font-semibold text-slate-800">
                {filters.endDate ? new Date(filters.endDate).toLocaleDateString('pt-BR') : 'Sem limite'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">STATUS FILTRADO:</span>
              <span className="font-semibold text-slate-800">
                {filters.status || 'Todos'}
              </span>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-500 uppercase">Total de Transações</span>
              <p className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">{receipts.length}</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 bg-emerald-50/50">
              <span className="text-[11px] font-medium text-emerald-800 uppercase">Total Confirmado</span>
              <p className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">{formatBRL(totalConfirmado)}</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-500 uppercase">Volume Bruto Listado</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{formatBRL(totalValor)}</p>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[500px]">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">CPF</th>
                  <th className="py-2.5 px-3">Servidor</th>
                  <th className="py-2.5 px-3">Referência</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      Nenhum comprovante localizado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{r.id}</td>
                      <td className="py-2 px-3 font-sans text-slate-600">
                        {new Date(r.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{formatCPF(r.cpf)}</td>
                      <td className="py-2 px-3 font-sans text-slate-800 truncate max-w-[120px]">
                        {r.nomeServidor || '-'}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-700 truncate max-w-[140px]">
                        {r.referencia}
                      </td>
                      <td className="py-2 px-3 font-bold text-right text-emerald-700 tabular-nums">
                        {formatBRL(r.valorPagamento)}
                      </td>
                      <td className="py-2 px-3 font-sans text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'CONFIRMADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'REJEITADO'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Audit signature notes */}
          <div className="pt-6 border-t border-slate-200 text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between gap-2">
            <span>PixSync • Auditoria e Controle de Comprovantes Pix com Google Sheets</span>
            <span>Relatório gerado automaticamente para conferência financeira</span>
          </div>
        </div>
      </div>
    </div>
  );
};
