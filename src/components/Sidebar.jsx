import React, { useState } from 'react';
import { Terminal, Send, Command, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Sidebar({ onSendMessage }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, sender: 'system', text: 'Online. Awaiting protocols, sir.' }
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: input }]);
    
    // Trigger action in parent
    onSendMessage(input);
    
    // Add system response
    setTimeout(() => {
       setMessages(prev => [...prev, { 
         id: Date.now() + 1, 
         sender: 'system', 
         text: `Acknowledged. Deploying assets for: "${input}"` 
       }]);
    }, 600);
    
    setInput('');
  };

  return (
    <aside className="w-80 h-full glass-panel flex flex-col border-r border-jarvis-border/30 z-20 relative">
      <div className="p-4 border-b border-jarvis-border/30 flex items-center gap-3">
        <Terminal className="text-jarvis-cyan w-5 h-5" />
        <span className="font-display font-semibold text-jarvis-cyan uppercase tracking-widest text-sm">COM RELAY</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs flex flex-col justify-end">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
             <motion.div 
               key={msg.id}
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               className={`flex gap-2 ${msg.sender === 'user' ? 'text-white' : 'text-jarvis-cyan/80'}`}
             >
               <span className="shrink-0">{msg.sender === 'user' ? '>' : 'SYS'}</span>
               <p className="whitespace-pre-wrap">{msg.text}</p>
             </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-4 border-t border-jarvis-border/30 bg-jarvis-dark/50">
        <form onSubmit={handleSubmit} className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command..."
            className="w-full bg-jarvis-surface/40 border border-jarvis-border/50 text-white font-mono text-sm rounded px-3 py-2 pl-8 focus:outline-none focus:border-jarvis-cyan focus:ring-1 focus:ring-jarvis-cyan transition-all"
          />
          <Command className="absolute left-2.5 top-2.5 w-4 h-4 text-jarvis-blue/50" />
          <button 
            type="submit"
            className="absolute right-1 top-1 bottom-1 px-2 text-jarvis-cyan hover:bg-jarvis-blue/20 rounded transition-colors active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
