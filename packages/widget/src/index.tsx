import { render } from 'preact';
import { App } from './App';
import { widgetStyles } from './styles/widget';

(function () {
  // Don't initialize twice
  if ((window as any).__voicesell_loaded) return;
  (window as any).__voicesell_loaded = true;

  // Get merchant ID from script tag
  const script = document.currentScript as HTMLScriptElement;
  const merchantId = script?.getAttribute('data-merchant') || 'demo';
  const apiUrl = script?.getAttribute('data-api') || 'http://localhost:3001';

  // Create isolated container
  const container = document.createElement('div');
  container.id = 'voicesell-root';
  container.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  document.body.appendChild(container);

  // Attach Shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: 'closed' });

  // Inject styles into shadow root
  const style = document.createElement('style');
  style.textContent = widgetStyles;
  shadow.appendChild(style);

  // Mount point for Preact
  const appRoot = document.createElement('div');
  shadow.appendChild(appRoot);

  render(<App merchantId={merchantId} apiUrl={apiUrl} />, appRoot);
})();
