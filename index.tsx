import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Suppress ResizeObserver Loop errors
const resizeObserverLoopErr = /ResizeObserver loop limit exceeded/;
const resizeObserverLoopErr2 = /ResizeObserver loop completed with undelivered notifications/;
const tailwindWarning = /cdn.tailwindcss.com/;

const originalError = console.error;
console.error = (...args) => {
    if (args.length > 0 && typeof args[0] === 'string') {
        if (resizeObserverLoopErr.test(args[0]) || resizeObserverLoopErr2.test(args[0])) {
            return;
        }
    }
    originalError(...args);
};

const originalWarn = console.warn;
console.warn = (...args) => {
    if (args.length > 0 && typeof args[0] === 'string') {
        if (tailwindWarning.test(args[0])) {
            return;
        }
    }
    originalWarn(...args);
};

window.addEventListener('error', (e) => {
    if (resizeObserverLoopErr.test(e.message) || resizeObserverLoopErr2.test(e.message)) {
        e.stopImmediatePropagation();
    }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);