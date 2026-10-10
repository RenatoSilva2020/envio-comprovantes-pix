import React from 'react';
import { AppSettings } from '../types';
import { UserCheck, Shield, Settings, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentTab: 'client' | 'admin' | 'settings';
  onSelectTab: (tab: 'client' | 'admin' | 'settings') => void;
  settings: AppSettings;
  pendingCount: number;
  showSettingsTab?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  settings,
  pendingCount,
  showSettingsTab = true,
}) => {
  const isGasConfigured = Boolean(settings.gasWebAppUrl && settings.gasWebAppUrl.trim());

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Logo & Brand - Single line, no decorative badge pills */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
              P
            </div>
            <div className="leading-tight">
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 block">
                {currentTab === 'client' ? 'Envio de Comprovantes' : 'PixSync'}
              </span>
              {currentTab !== 'client' && (
                <span className="text-[10px] text-slate-500 hidden sm:block">
                  Gestão de Comprovantes Pix
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs - Touch targets >= 44px on mobile */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => onSelectTab('client')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer min-h-[44px] ${
                currentTab === 'client'
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Área do Cliente</span>
              <span className="sm:hidden">Cliente</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('admin')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer min-h-[44px] relative ${
                currentTab === 'admin'
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Painel Admin</span>
              <span className="sm:hidden">Admin</span>
              {pendingCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-amber-600 rounded-full tabular-nums">
                  {pendingCount}
                </span>
              )}
            </button>

            {showSettingsTab && (
              <button
                type="button"
                onClick={() => onSelectTab('settings')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer min-h-[44px] ${
                  currentTab === 'settings'
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Configurações &amp; GAS</span>
                <span className="md:hidden">Config</span>
              </button>
            )}
          </nav>

          {/* Connection Indicator on Desktop (visível apenas em ambiente com configurações ativas) */}
          {showSettingsTab && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{isGasConfigured ? 'Sheets Conectado' : 'Planilha Local'}</span>
              {isGasConfigured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
