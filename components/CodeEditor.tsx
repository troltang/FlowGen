
import React, { useState, useRef, useEffect } from 'react';
import { Variable, Library, StructDefinition } from '../types';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  libraries?: Library[]; // New prop for DLLs
  structs?: StructDefinition[]; // Struct definitions for autocomplete
  className?: string;
  isFullscreen?: boolean;
}

const CSHARP_KEYWORDS = [
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked',
  'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else',
  'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for',
  'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock',
  'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params',
  'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
  'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true',
  'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual',
  'void', 'volatile', 'while', 'var'
];

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
  value, 
  onChange, 
  variables, 
  libraries = [], 
  structs = [],
  className,
  isFullscreen = false
}) => {
  const [suggestion, setSuggestion] = useState<{ type: 'keyword' | 'variable' | 'library' | 'field', list: string[], left: number, top: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    checkSuggestions(val, e.target.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const val = e.currentTarget.value;
      onChange(val.substring(0, start) + '  ' + val.substring(end));
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    } else if (e.key === 'Enter' && suggestion) {
       e.preventDefault();
       applySuggestion(suggestion.list[0]);
    } else if (e.key === 'Escape') {
      setSuggestion(null);
    }
  };

  const checkSuggestions = (text: string, cursorIndex: number) => {
    const textBefore = text.slice(0, cursorIndex);
    const lastChar = textBefore.slice(-1);

    // 1. Variable trigger "{"
    if (lastChar === '{') {
      const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
      setSuggestion({
        type: 'variable',
        list: variables.map(v => v.name),
        left: coords.left,
        top: coords.top + 20
      });
      return;
    }

    // 2. Struct Member Trigger "."
    // Check if the word BEFORE the dot is a variable that is of a struct type
    if (lastChar === '.') {
      const match = textBefore.slice(0, -1).match(/([a-zA-Z0-9_]+)$/);
      if (match) {
        const varName = match[1];
        // Find if this variable exists and matches a struct
        const variable = variables.find(v => v.name === varName);
        if (variable) {
          const structDef = structs.find(s => s.name === variable.type);
          if (structDef && structDef.fields.length > 0) {
             const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
             setSuggestion({
               type: 'field',
               list: structDef.fields.map(f => f.name),
               left: coords.left,
               top: coords.top + 20
             });
             return;
          }
        }
      }
    }

    // 3. Keywords / Libraries
    const lastWordMatch = textBefore.match(/([a-zA-Z0-9_.]+)$/); // Include dot for namespaces
    if (lastWordMatch) {
      const word = lastWordMatch[1];
      
      // Check for Library Namespaces / Methods
      if (word.includes('.')) {
         const parts = word.split('.');
         const potentialNamespace = parts.slice(0, -1).join('.');
         const trigger = parts[parts.length - 1];
         
         const matchingLib = libraries.find(l => l.namespace === potentialNamespace || l.name.replace('.dll', '') === potentialNamespace);
         
         if (matchingLib) {
            const methods = matchingLib.methods
              .map(m => m.name)
              .filter(m => m.toLowerCase().startsWith(trigger.toLowerCase()));
            
            if (methods.length > 0) {
               const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
               setSuggestion({
                 type: 'library',
                 list: methods,
                 left: coords.left,
                 top: coords.top + 20
               });
               return;
            }
         }
      }

      // Check Libraries root names
      const libNames = libraries.map(l => l.namespace.split('.')[0]).filter(n => n.toLowerCase().startsWith(word.toLowerCase()));
      if (libNames.length > 0) {
         const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
         setSuggestion({
           type: 'library',
           list: libNames,
           left: coords.left,
           top: coords.top + 20
         });
         return;
      }

      // Check Keywords
      if (word.length >= 2 && !word.includes('.')) {
        const matches = CSHARP_KEYWORDS.filter(k => k.startsWith(word) && k !== word);
        if (matches.length > 0) {
          const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
          setSuggestion({
            type: 'keyword',
            list: matches.slice(0, 5),
            left: coords.left,
            top: coords.top + 20
          });
          return;
        }
      }
    }

    setSuggestion(null);
  };

  const applySuggestion = (item: string) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const text = value;
    const textBefore = text.slice(0, cursor);
    
    let newText = "";
    let newCursor = cursor;

    if (suggestion?.type === 'variable') {
      newText = textBefore + item + "}" + text.slice(cursor);
      newCursor = cursor + item.length + 1;
    } else if (suggestion?.type === 'field') {
      // Just append the field name
      newText = textBefore + item + text.slice(cursor);
      newCursor = cursor + item.length;
    } else {
       const lastWordMatch = textBefore.match(/([a-zA-Z0-9_.]+)$/);
       if (lastWordMatch) {
         const word = lastWordMatch[1];
         // If it's a library method property access (has dot), only replace after the dot
         if (word.includes('.')) {
            const lastDotIndex = word.lastIndexOf('.');
            const partialMethod = word.substring(lastDotIndex + 1);
            newText = textBefore.slice(0, -partialMethod.length) + item + (suggestion?.type === 'library' && !item.includes('(') ? '(' : '') + text.slice(cursor);
            newCursor = cursor - partialMethod.length + item.length + (suggestion?.type === 'library' ? 1 : 0);
         } else {
            newText = textBefore.slice(0, -word.length) + item + text.slice(cursor);
            newCursor = cursor - word.length + item.length;
         }
       }
    }

    onChange(newText);
    setSuggestion(null);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const highlightCode = (code: string) => {
    if (!code) return '';

    const escape = (str: string) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Gather library namespaces for highlighting
    const libNamespaces = libraries.map(l => l.namespace);
    
    const combinedRegex = new RegExp([
      `"(?:\\\\.|[^"\\\\])*"`, // Strings
      `//.*`,                   // Comments
      `\\b(?:${CSHARP_KEYWORDS.join('|')})\\b`, // Keywords
      `\\b\\d+\\b`,              // Numbers
      ...libNamespaces.map(ns => `\\b${ns.replace('.', '\\.')}\\b`) // Library Namespaces
    ].join('|'), 'g'); 

    const parts = code.split(new RegExp(`(${combinedRegex.source})`, 'g'));

    return parts.map(part => {
      if (!part) return '';

      if (part.startsWith('"')) return `<span class="text-orange-300">${escape(part)}</span>`;
      if (part.startsWith('//')) return `<span class="text-gray-500 italic">${escape(part)}</span>`;
      if (/^\d+$/.test(part)) return `<span class="text-emerald-300">${part}</span>`;
      if (CSHARP_KEYWORDS.includes(part)) return `<span class="text-blue-400 font-bold">${part}</span>`;
      if (libNamespaces.includes(part)) return `<span class="text-purple-400 font-bold">${part}</span>`; // Highlight DLL namespaces
      
      return escape(part);
    }).join('');
  };

  return (
    <div className={`relative ${className} bg-slate-900 rounded-lg overflow-hidden border border-slate-700 flex flex-col`}>
      <div className="relative flex-1 overflow-hidden">
        {/* Backdrop for highlighting - added overflow-auto to ensure it behaves similarly to textarea */}
        <div 
          ref={backdropRef}
          className={`absolute inset-0 pointer-events-none p-3 whitespace-pre-wrap font-mono ${isFullscreen ? 'text-base' : 'text-sm'} leading-6 break-words text-slate-200 overflow-auto scrollbar-hide pb-10`}
          dangerouslySetInnerHTML={{ __html: highlightCode(value) + '<br/>' }}
        />
        {/* Textarea for input - added padding-bottom to ensure last line visibility */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onBlur={() => setTimeout(() => setSuggestion(null), 200)}
          spellCheck={false}
          className={`relative w-full h-full p-3 bg-transparent text-transparent caret-white font-mono ${isFullscreen ? 'text-base' : 'text-sm'} leading-6 resize-none outline-none break-words overflow-auto pb-10`}
          style={{ color: 'transparent' }}
        />
      </div>
      
      {/* Suggestions Popup */}
      {suggestion && (
        <div 
          className="absolute z-50 bg-slate-800 border border-slate-600 rounded shadow-xl flex flex-col min-w-[150px] max-h-[200px] overflow-y-auto"
          style={{ left: Math.min(suggestion.left, 400), top: suggestion.top }}
        >
          <div className="px-2 py-1 text-[10px] bg-slate-700 text-slate-400 uppercase font-bold tracking-wider">
            {suggestion.type === 'variable' ? '变量' : suggestion.type === 'library' ? '外部库' : suggestion.type === 'field' ? '成员' : '关键字'}
          </div>
          {suggestion.list.map((item, idx) => (
             <button 
               key={idx}
               onMouseDown={(e) => { e.preventDefault(); applySuggestion(item); }}
               className="px-2 py-1.5 text-xs text-left text-slate-200 hover:bg-indigo-600 font-mono border-b border-slate-700/50 last:border-0 flex items-center gap-2"
             >
               {suggestion.type === 'variable' && <span className="text-amber-400">{`{}`}</span>}
               {suggestion.type === 'library' && <span className="text-purple-400">ƒ</span>}
               {suggestion.type === 'field' && <span className="text-cyan-400">.</span>}
               <span>{item}</span>
             </button>
          ))}
        </div>
      )}
      
      {/* Basic Error Checking Indicator */}
      {(value.split('{').length !== value.split('}').length || value.split('(').length !== value.split(')').length) && (
        <div className="absolute bottom-2 right-2 text-[10px] text-red-400 flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded border border-red-500/30 pointer-events-none">
           ⚠️ 括号不匹配
        </div>
      )}
    </div>
  );
};

// Helper for caret coordinates (Simplified)
const getCaretCoordinates = (element: HTMLTextAreaElement | null, position: number) => {
  if (!element) return { left: 0, top: 0 };
  const { scrollLeft, scrollTop } = element;
  const textLines = element.value.substr(0, position).split("\n");
  const currentLineIndex = textLines.length - 1;
  const currentLineText = textLines[currentLineIndex];
  
  // Rough estimation, improved by using a canvas measurement if needed, but this works for monospace
  const charWidth = 8.5; 
  const lineHeight = 24;

  return {
    left: currentLineText.length * charWidth + 10 - scrollLeft, 
    top: currentLineIndex * lineHeight + 10 - scrollTop 
  };
};
