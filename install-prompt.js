// PWA Install Prompt
let deferredPrompt;
let installPromptShown = false;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;

  // Don't show if user already dismissed it
  if (localStorage.getItem('pwa-install-dismissed') === 'true') {
    return;
  }

  // Show install banner after 5 seconds
  setTimeout(() => {
    showInstallPromotion();
  }, 5000);
});

function showInstallPromotion() {
  if (installPromptShown) return;
  installPromptShown = true;

  // Create install banner
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--maroon);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 90%;
      display: flex;
      align-items: center;
      gap: 1rem;
      animation: slideUp 0.3s ease-out;
    ">
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.25rem;">
          📱 Install Hokies Thrift App
        </div>
        <div style="font-size: 0.9rem; opacity: 0.9;">
          Get the app experience - install on your home screen!
        </div>
      </div>
      <button onclick="installPWA()" style="
        background: var(--orange);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      ">
        Install
      </button>
      <button onclick="dismissInstallPromotion()" style="
        background: transparent;
        color: white;
        border: 2px solid white;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      ">
        ✕
      </button>
    </div>
    <style>
      @keyframes slideUp {
        from {
          transform: translateX(-50%) translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
    </style>
  `;

  document.body.appendChild(banner);
}

function installPWA() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();

  if (!deferredPrompt) {
    // Show manual instructions if browser doesn't support prompt
    showManualInstallInstructions();
    return;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('✅ User accepted the PWA install');
    } else {
      console.log('❌ User dismissed the PWA install');
    }
    deferredPrompt = null;
  });
}

function dismissInstallPromotion() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
  localStorage.setItem('pwa-install-dismissed', 'true');
}

function showManualInstallInstructions() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  let instructions = '';

  if (isIOS) {
    instructions = `
      <div style="text-align: center;">
        <h3>📱 Install on iPhone</h3>
        <ol style="text-align: left; max-width: 300px; margin: 1rem auto;">
          <li>Tap the Share button <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/></svg></li>
          <li>Scroll down and tap "Add to Home Screen"</li>
          <li>Tap "Add"</li>
        </ol>
      </div>
    `;
  } else if (isAndroid) {
    instructions = `
      <div style="text-align: center;">
        <h3>📱 Install on Android</h3>
        <ol style="text-align: left; max-width: 300px; margin: 1rem auto;">
          <li>Tap the menu (⋮) in Chrome</li>
          <li>Select "Add to Home Screen" or "Install App"</li>
          <li>Tap "Install"</li>
        </ol>
      </div>
    `;
  } else {
    instructions = `
      <div style="text-align: center;">
        <h3>💻 Install on Desktop</h3>
        <p>Look for the install icon (➕) in your browser's address bar and click it!</p>
      </div>
    `;
  }

  const modal = document.createElement('div');
  modal.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    " onclick="this.remove()">
      <div style="
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 500px;
        color: var(--text-dark);
      " onclick="event.stopPropagation()">
        ${instructions}
        <button onclick="this.closest('div[style*=\"fixed\"]').remove()" style="
          margin-top: 1rem;
          background: var(--orange);
          color: white;
          border: none;
          padding: 0.75rem 2rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
        ">
          Got it!
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// Track when app is successfully installed
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed successfully!');
  localStorage.setItem('pwa-installed', 'true');

  // Remove install banner if still showing
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
});
