import React, { useState, useEffect } from 'react';
import { PixReceipt, AppSettings } from '../types';
import { submitReceiptToGas, testGasConnection, submitBatchReceiptsToGas, fetchReceiptsFromGas } from '../services/gasService';
import { updateReceipt, getReceipts, setAllReceipts, clearAllReceipts } from '../services/storage';
import {
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings,
  Database,
  ArrowRight,
  ShieldAlert,
  DownloadCloud,
  Trash2,
} from 'lucide-react';

interface SyncSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: PixReceipt[];
  settings: AppSettings;
  onReceiptsUpdated: (newReceipts: PixReceipt[]) => void;
  onNavigateToSettings: () => void;
  showSettingsTab?: boolean;
}

export const SyncSheetsModal: React.FC<SyncSheetsModalProps> = ({
  isOpen,
  onClose,
  receipts,
  settings,
  onReceiptsUpdated,
  onNavigateToSettings,
  showSettingsTab = false,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; text: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  if (!isOpen) return null;

  const hasUrl = Boolean(settings.gasWebAppUrl && settings.gasWebAppUrl.trim());
  const unsyncedCount = receipts.filter((r) => !r.sincronizadoSheets).length;
  const syncedCount = receipts.filter((r) => r.sincronizadoSheets).length;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setStatusMessage(null);
    try {
      const res = await testGasConnection(settings);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: `Falha ao testar conexão: ${err.message || 'Erro de rede ou CORS'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Puxa os dados da planilha Google para espelhar fielmente a realidade (inclusive limpezas de linhas)
  const handlePullFromGas = async () => {
    if (!hasUrl) {
      setStatusMessage({
        type: 'error',
        text: 'Configure primeiro a URL do Google Apps Script nas Configurações.',
      });
      return;
    }

    setIsSyncing(true);
    setStatusMessage(null);
    setSyncProgress({
      current: 0,
      total: 1,
      text: 'Buscando registros e verificando status na planilha Google...',
    });

    try {
      const res = await fetchReceiptsFromGas(settings);
      if (res.success) {
        setAllReceipts(res.receipts);
        onReceiptsUpdated(res.receipts);
        if (res.receipts.length === 0) {
          setStatusMessage({
            type: 'success',
            text: '🎉 Sincronização concluída! A planilha está limpa (0 registros encontrados), e a lista do sistema foi esvaziada para refletir fielmente o Google Sheets e a pasta do Drive.',
          });
        } else {
          setStatusMessage({
            type: 'success',
            text: `🎉 Sincronização concluída com sucesso! ${res.receipts.length} comprovante(s) carregado(s) da planilha e espelhados no sistema.`,
          });
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Falha ao buscar dados do Google Apps Script.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Erro ao buscar dados: ${err.message || 'Falha de comunicação'}`,
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Limpa imediatamente o armazenamento local de comprovantes (zerar testes)
  const handleClearLocalReceipts = () => {
    clearAllReceipts();
    onReceiptsUpdated([]);
    setConfirmClearOpen(false);
    setStatusMessage({
      type: 'success',
      text: '🧹 Todos os comprovantes locais de teste foram limpos com sucesso! O sistema agora está completamente limpo.',
    });
  };

  const handleSync = async (forceAll: boolean = false) => {
    if (!hasUrl) {
      setStatusMessage({
        type: 'error',
        text: 'Configure primeiro a URL do Google Apps Script nas Configurações.',
      });
      return;
    }

    const targetReceipts = forceAll
      ? receipts
      : receipts.filter((r) => !r.sincronizadoSheets);

    if (targetReceipts.length === 0) {
      setStatusMessage({
        type: 'info',
        text: 'Todos os comprovantes já se encontram sincronizados com a planilha. Se desejar reenviar, use a opção "Sincronizar Todos".',
      });
      return;
    }

    setIsSyncing(true);
    setStatusMessage(null);
    setSyncProgress({ current: 0, total: targetReceipts.length, text: 'Iniciando envio para o Google Sheets...' });

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < targetReceipts.length; i++) {
        const item = targetReceipts[i];
        setSyncProgress({
          current: i + 1,
          total: targetReceipts.length,
          text: `Enviando comprovante ${i + 1} de ${targetReceipts.length}: ${item.id} (${item.nomeServidor || item.cpf})...`,
        });

        const res = await submitReceiptToGas(item, settings);
        if (res.success) {
          updateReceipt(item.id, {
            sincronizadoSheets: true,
            ...(res.driveUrl
              ? {
                  comprovantePix: {
                    ...item.comprovantePix,
                    driveUrl: res.driveUrl,
                  },
                }
              : {}),
          });
          successCount++;
        } else {
          failCount++;
        }
      }

      const refreshed = getReceipts();
      onReceiptsUpdated(refreshed);

      if (successCount > 0 && failCount === 0) {
        setStatusMessage({
          type: 'success',
          text: `🎉 Sucesso! ${successCount} comprovante(s) sincronizado(s) com a planilha Google com sucesso!`,
        });
      } else if (successCount > 0 && failCount > 0) {
        setStatusMessage({
          type: 'info',
          text: `${successCount} sincronizados com sucesso, mas ${failCount} apresentaram falha. Verifique a conexão com o Google Apps Script.`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Não foi possível sincronizar os comprovantes. Verifique se o Google Apps Script está publicado como "Qualquer pessoa" (Anyone) e sem erros no Código.gs.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Erro durante a sincronização: ${err.message || 'Falha de comunicação'}`,
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <RefreshCw className={`w-5 h-5 text-emerald-300 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Sincronização Google Sheets</h3>
              <p className="text-xs text-emerald-200">Envio e atualização de dados no Google Apps Script</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {!hasUrl ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 text-amber-900 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm sm:text-base">Planilha Google / Apps Script Não Vinculado</h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    A URL da planilha ou Web App do Google Apps Script ainda não foi definida no código do sistema pelo desenvolvedor.
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed pt-1">
                    Como o perfil Admin não realiza personalizações do sistema, informe a URL da sua planilha ou do Google Apps Script no chat do <strong>AI Studio</strong> para que ela seja integrada diretamente ao código.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* URL & Connection Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    Conexão Google Sheets &amp; Drive
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    Integrado ao Sistema
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || isSyncing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão com a Planilha'}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`text-xs p-2.5 rounded-lg border flex items-start gap-2 ${
                      testResult.ok
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Counters */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total</span>
                  <span className="text-xl font-bold text-slate-900 tabular-nums">{receipts.length}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Pendentes</span>
                  <span className="text-xl font-bold text-amber-700 tabular-nums">{unsyncedCount}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Sincronizados</span>
                  <span className="text-xl font-bold text-emerald-700 tabular-nums">{syncedCount}</span>
                </div>
              </div>

              {/* Progress Bar when syncing */}
              {isSyncing && syncProgress && (
                <div className="space-y-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                  <div className="flex items-center justify-between text-xs text-emerald-900 font-semibold">
                    <span>{syncProgress.text}</span>
                    <span>
                      {syncProgress.current} / {syncProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 transition-all duration-300"
                      style={{
                        width: `${Math.round((syncProgress.current / (syncProgress.total || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`text-xs p-3.5 rounded-xl border flex items-start gap-2.5 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : statusMessage.type === 'error'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-blue-50 border-blue-300 text-blue-900'
                  }`}
                >
                  {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                  {statusMessage.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                  {statusMessage.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                  <span className="leading-relaxed">{statusMessage.text}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {/* Botão de Destaque: Puxar da Planilha Google (Espelha fielmente a planilha e Drive) */}
                <button
                  type="button"
                  onClick={handlePullFromGas}
                  disabled={isSyncing}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Busca todos os dados na planilha Google e atualiza a lista local, removendo registros que foram excluídos na planilha e no Drive"
                >
                  <DownloadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>Puxar da Planilha Google (Espelhar Dados Reais)</span>
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Use esta opção para que o sistema fique 100% idêntico à sua planilha, removendo comprovantes que foram deletados da planilha ou do Drive.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSync(false)}
                    disabled={isSyncing || unsyncedCount === 0}
                    className="w-full sm:w-1/2 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Enviar Pendentes ({unsyncedCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSync(true)}
                    disabled={isSyncing || receipts.length === 0}
                    className="w-full sm:w-1/2 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Reenvia todos os comprovantes para a planilha"
                  >
                    <span>Reenviar Todos ({receipts.length})</span>
                  </button>
                </div>

                {/* Opção para Zerar Testes Locais */}
                <div className="pt-2 border-t border-slate-200">
                  {!confirmClearOpen ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearOpen(true)}
                      disabled={isSyncing || receipts.length === 0}
                      className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Limpar Comprovantes Locais de Teste ({receipts.length})</span>
                    </button>
                  ) : (
                    <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-center space-y-2">
                      <p className="text-xs font-bold text-rose-950">
                        Confirmar limpeza dos {receipts.length} comprovantes locais?
                      </p>
                      <p className="text-[11px] text-rose-800">
                        Isso esvaziará o cache local para refletir a planilha e a pasta vazias.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleClearLocalReceipts}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                        >
                          Sim, Limpar Tudo
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearOpen(false)}
                          className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Troubleshooting hint */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Dica sobre a implantação do Apps Script:</p>
                <p>
                  No editor do Apps Script, a implantação deve ser feita como <strong>App da Web</strong>, com configuração de acesso: <strong>Quem pode acessar: Qualquer pessoa</strong> (Anyone) e <strong>Executar como: Eu</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between">
          {showSettingsTab ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToSettings();
              }}
              className="text-xs text-slate-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configurações &amp; Código GAS</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">Sincronização Google Sheets</span>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
