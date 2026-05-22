import React, { useState } from 'react';
import { MacroPreset, ChatMessage } from '../types';
import { FileSpreadsheet, Binary, Clipboard, Check, Terminal, Play, HelpCircle, Send, Sparkles, MessageCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MacroViewProps {
  presets: MacroPreset[];
}

export default function MacroView({ presets }: MacroViewProps) {
  const [selectedPreset, setSelectedPreset] = useState<MacroPreset>(presets[0]);
  const [copiedPresetId, setCopiedPresetId] = useState<string | null>(null);
  
  // AI Generator state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'model',
      content: "Hello! I am **Dremo Analyst Pro**, your AI Excel & VBA integration assistant. Describe any custom Automation, Report generator, stock recalculation, or alert prompt macro you want for your business and I will write a reliable, production-ready VBA code block for your Macro-Enabled Workbook (.xlsm)!"
    }
  ]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCopyCode = (id: string, codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedPresetId(id);
    setTimeout(() => setCopiedPresetId(null), 2000);
  };

  const handleAISendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMsgText = prompt;
    setPrompt('');
    setErrorMessage(null);
    setLoading(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userMsgText
    };

    setChatHistory(prev => [...prev, userMsg]);

    try {
      let response;
      try {
        response = await fetch('/api/gemini/generate-macro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: userMsgText,
            businessType: 'Modern Retail / Café POS',
            sheetStructure: 'Timestamp | Transaction ID | Subtotal | Tax | Discount | Total Revenue | Payment Method'
          })
        });
      } catch (networkErr) {
        throw new Error("API server is unreachable. Since this is running as a static site, the active AI generated backend is inactive. However, you can use the complete Local Presets Library on the left sidebar panel!");
      }

      if (response.status === 404) {
        throw new Error("Custom AI macro generation is inactive on static hosts (like GitHub Pages). To use AI generation, host on full-stack service (like Cloud Run) or use the rich VBA Preset library on the left sidebar!");
      }

      if (!response.ok) {
        let errorMsg = 'Server returned an error status.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const rawJson = await response.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'model',
        content: `### ${rawJson.title}\n\n${rawJson.explanation}`,
        vbaCode: rawJson.vbaCode
      };

      setChatHistory(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Could not generate VBA script macro. Verify Gemini API settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-hidden h-full flex flex-col lg:flex-row bg-slate-50">
      
      {/* Left Column: Preset VBA Library & Documentation */}
      <div className="w-full lg:w-1/2 flex flex-col p-6 overflow-y-auto border-r border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">VBA Macro Lab</h2>
          <p className="text-xs text-slate-500">Bridge your physical Cashier with real Excel Workbooks using macro automations.</p>
        </div>

        {/* Quick Tutorial Callout Banner */}
        <div className="mt-5 p-4.5 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl border border-slate-800 shadow-sm space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 opacity-15">
            <FileSpreadsheet className="size-36" />
          </div>
          
          <div className="flex items-center gap-2">
            <Binary className="size-5 text-indigo-400" />
            <h3 className="text-xs font-bold leading-none tracking-widest uppercase text-indigo-300">Quick Excel Setup Guide</h3>
          </div>

          <div className="text-[11px] text-slate-300 leading-relaxed space-y-2 max-w-lg relative z-10 font-sans">
            <p>Dremo is designed to export and process standard cash registers, which sync directly with MS Excel columns using macros. Follow these steps:</p>
            <ol className="list-decimal pl-4.5 space-y-1">
              <li>Save your Excel file as <span className="font-mono text-indigo-200 font-bold">Excel Macro-Enabled Workbook (.xlsm)</span>.</li>
              <li>Press <span className="font-mono bg-slate-800 text-slate-200 px-1 py-0.5 rounded border border-slate-700 font-bold text-[10px]">ALT + F11</span> to enter the Microsoft VBA Editor.</li>
              <li>Click <span className="font-semibold text-white">Insert &gt; Module</span>, and copy/paste any macro block from our laboratory sheets.</li>
              <li>Create custom triggers on your active sheet (Insert &gt; Shapes &gt; Add Button), right-click and choose <span className="font-semibold text-white">Assign Macro</span>.</li>
            </ol>
          </div>
        </div>

        {/* Preset Selector tabs */}
        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center bg-transparent">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Preset Automations Library</h3>
            <span className="text-[10px] text-slate-400 font-mono">Select a preset to view code and instructions</span>
          </div>

          {/* Selector Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                id={`preset-tab-${p.id}`}
                onClick={() => setSelectedPreset(p)}
                className={`py-2 px-3 border rounded-xl text-xs font-semibold text-left transition-all ${
                  selectedPreset.id === p.id
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-600 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>

          {/* Display active Preset */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[9px] font-mono font-extrabold uppercase rounded-full ${
                  selectedPreset.category === 'sales' ? 'bg-emerald-100 text-emerald-800' :
                  selectedPreset.category === 'inventory' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                }`}>{selectedPreset.category} macro</span>
                <span className="text-slate-300">|</span>
                <span className="text-[10px] text-slate-400 font-bold font-mono">Option Explicit Safe Code</span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-1">{selectedPreset.title}</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{selectedPreset.description}</p>
            </div>

            {/* VBA Code Area */}
            <div className="relative">
              <div className="absolute right-3 top-3 z-10">
                <button
                  id={`btn-copy-preset-${selectedPreset.id}`}
                  onClick={() => handleCopyCode(selectedPreset.id, selectedPreset.code)}
                  className="p-1 px-2 text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors border border-slate-700"
                >
                  {copiedPresetId === selectedPreset.id ? (
                    <>
                      <Check className="size-3 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Clipboard className="size-3" /> Copy VBA Block
                    </>
                  )}
                </button>
              </div>

              {/* VBA Code block */}
              <div className="w-full bg-slate-900 text-slate-100 p-4.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 shadow-inner border border-slate-850">
                <pre>{selectedPreset.code}</pre>
              </div>
            </div>

            {/* Preset instructions */}
            <div className="space-y-2 border-t border-slate-100 pt-4 text-xs font-sans">
              <span className="font-bold uppercase text-slate-400 tracking-wider block text-[10px]">VBA Module Placement</span>
              <ul className="space-y-1.5 text-slate-650 pl-4 list-disc">
                {selectedPreset.instructions.map((inst, idx) => (
                  <li key={idx} className="leading-relaxed">{inst}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: AI Generator & Chat Interface */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white border-l border-slate-200">
        
        {/* Assistant Header */}
        <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="size-8.5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold relative">
              <Terminal className="size-4.5" />
              <span className="absolute bottom-0 right-0 size-2.5 bg-emerald-500 rounded-full border border-white" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 leading-none">Dremo Analyst Pro</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1">AI Assistant • Online <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" /></p>
            </div>
          </div>
          <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
            <Sparkles className="size-3" /> Gemini 3.5 Active
          </span>
        </div>

        {/* Chat Threads Display */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.map((msg) => {
            const IsUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex ${IsUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4.5 text-xs text-slate-850 border ${
                  IsUser
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-indigo-50/40 border-indigo-100/50 text-slate-800 shadow-sm'
                }`}>
                  {/* Message body */}
                  <div className="prose prose-sm leading-relaxed max-w-none space-y-2">
                    {/* Render basic custom parsing of double bold markers */}
                    {msg.content.split('\n').map((line, i) => {
                      // Markdown headers detection
                      if (line.startsWith('### ')) {
                        return <h4 key={i} className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1 mt-2">{line.replace('### ', '')}</h4>;
                      }
                      if (line.startsWith('* ') || line.startsWith('- ')) {
                        return <li key={i} className="list-disc ml-4 pl-0.5">{line.substring(2)}</li>;
                      }
                      // Replace bold syntax double-stars with standard weights
                      const styledLine = line.split('**').map((tok, idx) => {
                        return idx % 2 === 1 ? <strong key={idx} className="font-bold text-slate-950">{tok}</strong> : tok;
                      });
                      return <p key={i} className="mt-1 leading-relaxed">{styledLine}</p>;
                    })}
                  </div>

                  {/* If VBA code payload was generated by AI, wrap it in a code display component */}
                  {msg.vbaCode && (
                    <div className="mt-4.5 space-y-2">
                      <div className="flex items-center justify-between font-mono text-[9px] font-semibold text-indigo-800 border-t border-indigo-100/40 pt-2 bg-transparent">
                        <span>Macro Script Outbox</span>
                        <button
                          onClick={() => handleCopyCode(msg.id, msg.vbaCode!)}
                          className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[8px] uppercase tracking-wider font-extrabold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                        >
                          {copiedPresetId === msg.id ? (
                            <>
                              <Check className="size-2 text-white" /> Copied Code Block
                            </>
                          ) : (
                            <>
                              <Clipboard className="size-2" /> Copy Generative Script
                            </>
                          )}
                        </button>
                      </div>
                      <div className="w-full bg-slate-900 text-slate-100 p-3.5 rounded-xl text-[10px] font-mono overflow-x-auto max-h-55 border border-slate-850 shadow-inner">
                        <pre>{msg.vbaCode}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Error notice banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2 max-w-sm">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-500" />
              <div>
                <span className="font-bold block">Macro Generation Unsuccessful</span>
                <p className="text-[10px] mt-0.5 leading-relaxed text-rose-600">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Typing Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-indigo-50/30 border border-indigo-100/30 rounded-2xl p-4 text-xs flex items-center gap-2">
                <RefreshCw className="size-4 text-indigo-500 animate-spin" />
                <span className="text-indigo-600 font-bold tracking-wider font-mono uppercase text-[9px]">Dremo Agent is compiling VBA rules...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input cluster panel */}
        <form onSubmit={handleAISendPrompt} className="p-4 border-t border-slate-150 bg-slate-50/50 flex gap-3">
          <input
            id="vba-assistant-prompt"
            type="text"
            required
            disabled={loading}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Highlight margins lower than 12% in yellow, email PDF reports..."
            className="flex-1 bg-white border border-slate-200 py-2.5 px-4 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 shadow-sm transition-all"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-md cursor-pointer flex items-center justify-center transition-transform hover:scale-102"
            title="Send request to AI compiler"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
