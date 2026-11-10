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
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 text-slate-800 bg-white overflow-y-auto flex-1 font-sans">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between sm:items-start gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wider uppercase mb-1">
                Relatório Oficial de Pagamentos
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                {settings.institutionName || 'Escola Estadual Mário Porto (EEMP)'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Painel Gerencial de Prestação de Contas · Planilha Google: <strong>{settings.sheetName || 'Comprovantes_Pix'}</strong>
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <p>Emissão: <strong className="text-slate-800">{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></p>
              <p>Lançamentos: <strong className="text-emerald-700">{receipts.length} comprovantes</strong></p>
            </div>
          </div>

          {/* Active Filter Summary */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold tracking-wider uppercase">Filtro CPF</span>
              <span className="font-semibold text-slate-800">
                {filters.cpf ? formatCPF(filters.cpf) : 'Todos os CPFs'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold tracking-wider uppercase">Período Inicial</span>
              <span className="font-semibold text-slate-800">
                {filters.startDate ? new Date(filters.startDate).toLocaleDateString('pt-BR') : 'Sem limite'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold tracking-wider uppercase">Período Final</span>
              <span className="font-semibold text-slate-800">
                {filters.endDate ? new Date(filters.endDate).toLocaleDateString('pt-BR') : 'Sem limite'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-bold tracking-wider uppercase">Status</span>
              <span className="font-semibold text-slate-800">
                {filters.status || 'Todos'}
              </span>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Volume Total</span>
              <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{formatBRL(totalValor)}</p>
              <span className="text-[10px] text-slate-400">{receipts.length} transações</span>
            </div>
            <div className="border border-emerald-200 rounded-xl p-3.5 bg-emerald-50/70">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Confirmados</span>
              <p className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">{formatBRL(totalConfirmado)}</p>
              <span className="text-[10px] text-emerald-600 font-medium">Validado no extrato</span>
            </div>
            <div className="border border-amber-200 rounded-xl p-3.5 bg-amber-50/70">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pendentes</span>
              <p className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
                {formatBRL(receipts.filter((r) => r.status === 'PENDENTE').reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0))}
              </p>
              <span className="text-[10px] text-amber-600 font-medium">Aguardando conferência</span>
            </div>
          </div>

          {/* Table agrupada por CPF com subtotais e linhas de grade clean */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left min-w-[500px] border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-[11px] tracking-wider uppercase border-r border-slate-800">ID Comprovante</th>
                  <th className="py-2.5 px-3 font-semibold text-[11px] tracking-wider uppercase border-r border-slate-800">Data / Hora</th>
                  <th className="py-2.5 px-3 font-semibold text-[11px] tracking-wider uppercase border-r border-slate-800">CPF Cliente</th>
                  <th className="py-2.5 px-3 font-semibold text-[11px] tracking-wider uppercase border-r border-slate-800">Titular</th>
                  <th className="py-2.5 px-3 font-semibold text-[11px] tracking-wider uppercase border-r border-slate-800">Referência</th>
                  <th className="py-2.5 px-3 font-semibold text-[11px] tracking-wider uppercase border-r border-slate-800 text-right">Valor</th>
                  <th className="py-2.5 px-3 font-semibold text-[11px] tracking-wider uppercase text-center">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      Nenhum comprovante localizado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const grouped = new Map<string, { formattedCpf: string; nome: string; items: PixReceipt[] }>();
                    receipts.forEach((r) => {
                      const key = (r.cpf || '').replace(/\D/g, '') || 'SEM_CPF';
                      if (!grouped.has(key)) {
                        grouped.set(key, {
                          formattedCpf: formatCPF(r.cpf),
                          nome: r.nomeServidor || 'Não informado',
                          items: [],
                        });
                      }
                      const g = grouped.get(key)!;
                      if ((!g.nome || g.nome === 'Não informado') && r.nomeServidor) {
                        g.nome = r.nomeServidor;
                      }
                      g.items.push(r);
                    });

                    return Array.from(grouped.values()).map((grp) => {
                      const subtotal = grp.items.reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);
                      const subtotalConfirmado = grp.items
                        .filter((i) => i.status === 'CONFIRMADO')
                        .reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);

                      return (
                        <React.Fragment key={grp.formattedCpf}>
                          {/* Cabeçalho do Grupo por CPF */}
                          <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-b border-slate-300">
                            <td colSpan={7} className="py-2 px-3 text-xs tracking-tight">
                              <span className="text-slate-500 uppercase text-[10px] tracking-wider mr-1.5 font-semibold">Titular:</span>
                              <span className="text-slate-900 font-bold">{grp.nome.toUpperCase()}</span>
                              <span className="mx-2 text-slate-300">|</span>
                              <span className="text-slate-500 uppercase text-[10px] tracking-wider mr-1.5 font-semibold">CPF:</span>
                              <span className="font-mono text-emerald-800 font-bold">{grp.formattedCpf}</span>
                              <span className="ml-2 text-slate-500 text-[11px] font-normal">
                                ({grp.items.length} {grp.items.length === 1 ? 'comprovante' : 'comprovantes'})
                              </span>
                            </td>
                          </tr>

                          {/* Itens do Cliente com fundo branco puro e linhas de grade clean */}
                          {grp.items.map((r) => (
                            <tr key={r.id} className="bg-white hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-800 text-[11px] border-r border-slate-200">{r.id}</td>
                              <td className="py-2 px-3 text-slate-600 text-[11px] border-r border-slate-200">
                                {new Date(r.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className="py-2 px-3 text-slate-700 font-mono text-[11px] border-r border-slate-200">{formatCPF(r.cpf)}</td>
                              <td className="py-2 px-3 font-medium text-slate-800 truncate max-w-[120px] border-r border-slate-200">
                                {r.nomeServidor || '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-700 truncate max-w-[140px] border-r border-slate-200">
                                {r.referencia}
                              </td>
                              <td className="py-2 px-3 font-bold text-right text-emerald-700 tabular-nums border-r border-slate-200">
                                {formatBRL(r.valorPagamento)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    r.status === 'CONFIRMADO'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : r.status === 'REJEITADO'
                                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}

                          {/* Subtotal do CPF */}
                          <tr className="bg-slate-50/80 font-bold text-slate-900 border-b border-slate-300">
                            <td colSpan={5} className="py-2 px-3 text-right text-xs text-slate-700 border-r border-slate-200">
                              Subtotal {grp.formattedCpf} ({grp.items.length} {grp.items.length === 1 ? 'item' : 'itens'}
                              {subtotalConfirmado > 0 ? ` · Conf: ${formatBRL(subtotalConfirmado)}` : ''}):
                            </td>
                            <td className="py-2 px-3 font-black text-right text-emerald-700 tabular-nums text-xs border-r border-slate-200">
                              {formatBRL(subtotal)}
                            </td>
                            <td className="bg-slate-50/80"></td>
                          </tr>
                        </React.Fragment>
                      );
                    });
                  })()
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
