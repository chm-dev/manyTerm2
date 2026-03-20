import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Suppress Monaco Editor web-worker fallback warnings – these are informational only;
// main-thread fallback still provides full editor functionality.
const _origWarn = console.warn.bind(console);
let _monacoWarnSuppressNext = false;
console.warn = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : (args[0] === undefined ? '' : null);
  if (msg !== null) {
    if (
      msg.includes('Could not create web worker') ||
      msg.includes('MonacoEnvironment.getWorkerUrl') ||
      msg.includes('MonacoEnvironment.getWorker')
    ) {
      _monacoWarnSuppressNext = true;
      return;
    }
    // Suppress the blank separator line Monaco emits between its worker warnings
    if (_monacoWarnSuppressNext && msg.trim() === '') {
      _monacoWarnSuppressNext = false;
      return;
    }
  }
  _monacoWarnSuppressNext = false;
  _origWarn(...args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
