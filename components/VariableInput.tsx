import React, { useState, useEffect, useRef } from 'react';
import { Variable, SystemKeyword } from '../types';
import { SYSTEM_KEYWORDS } from '../constants';
import { Database, Zap } from 'lucide-react';

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  placeholder?: string;
  className?: string;
  isTextArea?: boolean;
}

export const VariableInput: React.FC<VariableInputProps> = ({
  value,
  onChange,
  variables,
  placeholder,
  className,
  isTextArea = false
}) => {
  const [showVarSuggestions, setShowVarSuggestions] = useState(false);
  const [showSysSuggestions, setShowSysSuggestions] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [filterText, setFilterText] = useState('');
  
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowVarSuggestions(false);
        setShowSysSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorIndex(pos);

    // Extract text before cursor to check for triggers
    const textBeforeCursor = newValue.slice(0, pos);
    
    // Regex to find the last open trigger before cursor
    // 1. Variable trigger: '{' followed by valid variable characters at the end
    const varMatch = textBeforeCursor.match(/\{([a-zA-Z0-9_]*)$/);
    
    // 2. System trigger: '@' followed by valid characters at the end
    const sysMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (varMatch) {
      setFilterText(varMatch[1]);
      setShowVarSuggestions(true);
      setShowSysSuggestions(false);
    } else if (sysMatch) {
      setFilterText(sysMatch[1]);
      setShowSysSuggestions(true);
      setShowVarSuggestions(false);
    } else {
      setShowVarSuggestions(false);
      setShowSysSuggestions(false);
      setFilterText('');
    }
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCursorIndex(e.currentTarget.selectionStart || 0);
  };

  const insertText = (text: string, isVariable: boolean) => {
    const textBefore = value.slice(0, cursorIndex);
    const textAfter = value.slice(cursorIndex);
    
    let newTextBefore = textBefore;

    if (isVariable) {
      // Replace the last occurrence of '{filter' with '{text}'
      const match = textBefore.match(/\{([a-zA-Z0-9_]*)$/);
      if (match) {
        const matchLength = match[0].length;
        // Remove the partial trigger and text
        newTextBefore = textBefore.slice(0, -matchLength) + `{${text}}`;
      } else {
        newTextBefore = textBefore + `{${text}}`;
      }
    } else {
      // System keyword replacement
      const match = textBefore.match(/@([a-zA-Z0-9_]*)$/);
      if (match) {
        const matchLength = match[0].length;
        newTextBefore = textBefore.slice(0, -matchLength) + text;
      } else {
        newTextBefore = textBefore + text;
      }
    }
    
    const newValue = newTextBefore + textAfter;
    
    onChange(newValue);
    setShowVarSuggestions(false);
    setShowSysSuggestions(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = newTextBefore.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Filter items based on filterText
  const filteredVariables = variables.filter(v => 
    v.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredSysKeywords = SYSTEM_KEYWORDS.filter(k => 
    k.value.toLowerCase().includes('@' + filterText.toLowerCase()) || 
    k.label.includes(filterText) ||
    k.value.toLowerCase().includes(filterText.toLowerCase())
  );

  const InputComponent = isTextArea ? 'textarea' : 'input';

  return (
    <div className="relative w-full" ref={containerRef}>
      <InputComponent
        ref={inputRef as any}
        value={value}
        onChange={handleInputChange}
        onSelect={handleSelect}
        onClick={handleSelect}
        onKeyUp={handleSelect}
        placeholder={placeholder}
        className={className}
        spellCheck={false}
      />
      
      {/* Trigger Buttons */}
      <div className="absolute right-2 top-2 flex gap-1 bg-white/50 backdrop-blur rounded p-0.5 z-10">
        <button 
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); 
            setShowSysSuggestions(!showSysSuggestions);
            setShowVarSuggestions(false);
            setFilterText('');
          }}
          className="text-slate-400 hover:text-pink-500 transition-colors p-1"
          title="插入系统关键字 (@)"
        >
          <Zap className="w-3 h-3" />
        </button>
        <button 
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowVarSuggestions(!showVarSuggestions);
            setShowSysSuggestions(false);
            setFilterText('');
          }}
          className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
          title="插入变量 ({)"
        >
          <Database className="w-3 h-3" />
        </button>
      </div>

      {/* Variable Suggestions */}
      {showVarSuggestions && (
        <div className="absolute z-50 left-0 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 ring-1 ring-slate-900/5">
           <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
             选择变量 {filterText && <span className="font-normal text-slate-400">(筛选: {filterText})</span>}
           </div>
           {filteredVariables.length === 0 ? (
             <div className="p-3 text-xs text-slate-400 text-center">无匹配变量</div>
           ) : (
             filteredVariables.map((v) => (
               <button
                 key={v.id}
                 type="button"
                 onMouseDown={(e) => { e.preventDefault(); insertText(v.name, true); }}
                 className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center justify-between group transition-colors"
               >
                 <span className="font-mono text-indigo-700 font-medium flex items-center gap-2">
                   <span className="text-slate-300">{`{`}</span>
                   {v.name}
                   <span className="text-slate-300">{`}`}</span>
                 </span>
                 <span className="text-xs text-slate-400 group-hover:text-indigo-400 bg-slate-100 px-1.5 py-0.5 rounded">
                   {v.type}
                 </span>
               </button>
             ))
           )}
        </div>
      )}

      {/* System Keyword Suggestions */}
      {showSysSuggestions && (
        <div className="absolute z-50 left-0 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 ring-1 ring-slate-900/5">
           <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
             系统关键字 {filterText && <span className="font-normal text-slate-400">(筛选: {filterText})</span>}
           </div>
           {filteredSysKeywords.length === 0 ? (
             <div className="p-3 text-xs text-slate-400 text-center">无匹配关键字</div>
           ) : (
             filteredSysKeywords.map((k) => (
               <button
                 key={k.value}
                 type="button"
                 onMouseDown={(e) => { e.preventDefault(); insertText(k.value, false); }}
                 className="w-full text-left px-3 py-2 text-sm hover:bg-pink-50 flex items-center justify-between group transition-colors"
               >
                 <span className="font-mono text-pink-600 font-medium">
                   {k.value}
                 </span>
                 <span className="text-xs text-slate-400">{k.label}</span>
               </button>
             ))
           )}
        </div>
      )}
    </div>
  );
};