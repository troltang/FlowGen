import React, { useEffect, useRef } from 'react';
import { ExecutionLog } from '../types';
import { Terminal, CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';

interface ConsoleProps {
  logs: ExecutionLog[];
  isRunning: boolean;
  onClear: () => void;
}

export const Console: React.FC<ConsoleProps> = ({ logs, isRunning, onClear }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="h-64 bg-slate-900 border-t border-slate-700 flex flex-col font-mono text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center text-slate-300 gap-2">
          <Terminal className="w-4 h-4" />
          <span className="font-semibold tracking-wide">运行控制台</span>
          {isRunning && (
            <span className="flex h-2 w-2 relative ml-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        <button 
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-white hover:bg-slate-700 px-2 py-1 rounded transition-colors"
        >
          清空日志
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic text-center mt-10">
            准备就绪。构建您的流程并点击运行。
          </div>
        ) : (
          logs.map((log, index) => {
            if (!log) return null; // Safe guard against undefined logs
            
            return (
              <div key={index} className="flex gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="text-slate-600 w-16 shrink-0 text-xs mt-0.5">
                  {log?.timestamp ? new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'}) : '--:--:--'}
                </span>
                <div className="mt-0.5 shrink-0">
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1">
                  <span className="text-slate-500 mr-2 text-xs uppercase tracking-wider">[{log.nodeLabel || 'System'}]:</span>
                  <span className={`
                    ${log.status === 'error' ? 'text-red-400' : 
                      log.status === 'success' ? 'text-green-300' : 
                      log.status === 'warning' ? 'text-amber-300' : 'text-slate-300'}
                  `}>
                    {log.message}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};