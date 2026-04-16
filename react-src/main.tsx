import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Dark mode: read from localStorage (same key as the vanilla HTML pages use)
const savedTheme = localStorage.getItem('la-theme') || 'light'
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
