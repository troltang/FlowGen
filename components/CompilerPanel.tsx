
import React from 'react';
import { ValidationIssue } from '../types';
import { AlertCircle, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface CompilerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  issues: ValidationIssue[];
  onNavigate: (flowId: string, nodeId?: string) => void;
}

export const CompilerPanel: React.FC<CompilerPanelProps> = ({ isOpen, onClose, issues, onNavigate }) => {
  const { t } = useTranslation();
  
  if (!isOpen) return null;

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  return (
    <div className="h-64 bg-slate-50 border-t border-slate-200 flex flex-col font-sans text-sm animate-in slide-in-from-bottom duration-300 shadow-inner">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">{t('compiler.title')}</span>
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.length} {t('compiler.error')}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-xs font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {warnings.length} {t('compiler.warning')}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-0">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-100" />
            <span>{t('compiler.success')}</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2 border-b border-slate-100 w-16">Type</th>
                <th className="px-4 py-2 border-b border-slate-100 w-32">Flow ID</th>
                <th className="px-4 py-2 border-b border-slate-100 w-32">Node ID</th>
                <th className="px-4 py-2 border-b border-slate-100">Message</th>
                <th className="px-4 py-2 border-b border-slate-100 w-32">Time</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {issues.map((issue) => (
                <tr 
                  key={issue.id} 
                  className={`border-b border-slate-50 hover:bg-slate-100 cursor-pointer transition-colors ${issue.type === 'error' ? 'hover:bg-red-50' : 'hover:bg-amber-50'}`}
                  onClick={() => onNavigate(issue.flowId, issue.nodeId)}
                >
                  <td className="px-4 py-2">
                    {issue.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-600">{issue.flowId}</td>
                  <td className="px-4 py-2 font-mono text-slate-600">{issue.nodeId || '-'}</td>
                  <td className={`px-4 py-2 font-medium ${issue.type === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                    {issue.message}
                  </td>
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(issue.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
