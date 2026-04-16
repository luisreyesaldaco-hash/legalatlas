import React, { useState } from 'react'
import ClaudeChatInput, { SendMessageData } from './components/ui/claude-style-chat-input'

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark')
  localStorage.setItem('la-theme', isDark ? 'dark' : 'light')
}

export default function App() {
  const [messages, setMessages] = useState<string[]>([])

  const handleSend = (data: SendMessageData) => {
    if (data.message.trim()) {
      setMessages(prev => [...prev, data.message])
    }
  }

  return (
    <div className="min-h-screen w-full bg-bg-0 flex flex-col items-center justify-center p-4 transition-colors duration-200">

      {/* Theme toggle — syncs with vanilla HTML pages via localStorage */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 h-9 w-9 rounded-full border border-bg-300 bg-bg-100 text-text-300 hover:text-text-100 hover:border-bg-300 transition-all shadow-[var(--shadow-input)] flex items-center justify-center text-base"
        aria-label="Cambiar tema"
      >
        ◑
      </button>

      {/* Header */}
      <div className="w-full max-w-2xl mb-10 text-center">
        <a href="/index.html" className="inline-block mb-6">
          <span className="font-serif text-2xl font-semibold tracking-widest text-text-100">
            LEGAL<span className="text-accent">ATLAS</span>
          </span>
        </a>
        <h1 className="text-3xl font-serif font-light text-text-200 mb-2 tracking-tight">
          ¿En qué te puedo ayudar?
        </h1>
        <p className="text-sm text-text-400">
          147,000+ artículos verificados · 7 países
        </p>
      </div>

      {/* Chat history preview */}
      {messages.length > 0 && (
        <div className="w-full max-w-2xl mb-6 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className="bg-bg-100 border border-bg-300 rounded-xl px-4 py-3 text-sm text-text-200 shadow-[var(--shadow-input)]">
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* Chat input */}
      <ClaudeChatInput onSendMessage={handleSend} />

    </div>
  )
}
