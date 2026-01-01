// Veil - Popup Script

const FONTS = {
  'cormorant': '"Cormorant Garamond", "Times New Roman", serif',
  'system': '-apple-system, "SF Pro Display", BlinkMacSystemFont, "Segoe UI", sans-serif',
  'futura': '"Jost", Futura, "Century Gothic", sans-serif',
  'cursive': '"Dancing Script", cursive'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  setupEventListeners();
  updatePreview();
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

async function loadSettings() {
  const data = await chrome.storage.sync.get([
    'enabled', 'mode', 'font',
    'showChannel', 'showDuration', 'showNoise', 'accentFromHash', 'hideChannelAvatars'
  ]);

  // Enabled toggle
  document.getElementById('enabled').checked = data.enabled !== false;

  // Mode
  const mode = data.mode || 'text';
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  toggleTextOptions(mode === 'text');

  // Font
  const font = data.font || 'cormorant';
  document.querySelectorAll('.font-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.font === font);
  });

  // Display toggles
  document.getElementById('showChannel').checked = data.showChannel !== false;
  document.getElementById('showDuration').checked = data.showDuration !== false;
  document.getElementById('showNoise').checked = data.showNoise !== false;
  document.getElementById('accentFromHash').checked = data.accentFromHash === true;
  document.getElementById('hideChannelAvatars').checked = data.hideChannelAvatars !== false;
}

async function saveSetting(key, value) {
  await chrome.storage.sync.set({ [key]: value });
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Main toggle
  document.getElementById('enabled').addEventListener('change', (e) => {
    saveSetting('enabled', e.target.checked);
  });

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.mode;
      saveSetting('mode', mode);
      toggleTextOptions(mode === 'text');
      updatePreview();
    });
  });

  // Font buttons
  document.querySelectorAll('.font-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      saveSetting('font', btn.dataset.font);
      updatePreview();
    });
  });

  // Display toggles
  const toggleIds = ['showChannel', 'showDuration', 'showNoise', 'accentFromHash', 'hideChannelAvatars'];
  toggleIds.forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      saveSetting(id, e.target.checked);
      updatePreview();
    });
  });
}

// ============================================
// UI HELPERS
// ============================================

function toggleTextOptions(show) {
  const textOptions = document.getElementById('text-options');
  if (show) {
    textOptions.classList.remove('hidden');
  } else {
    textOptions.classList.add('hidden');
  }
}

function updatePreview() {
  const preview = document.getElementById('preview');
  const title = preview.querySelector('.preview-title');
  const channel = preview.querySelector('.preview-channel');
  const duration = preview.querySelector('.preview-duration');
  const noise = preview.querySelector('.preview-noise');

  // Get current settings
  const activeFont = document.querySelector('.font-btn.active')?.dataset.font || 'cormorant';
  const showChannel = document.getElementById('showChannel').checked;
  const showDuration = document.getElementById('showDuration').checked;
  const showNoise = document.getElementById('showNoise').checked;
  const accentFromHash = document.getElementById('accentFromHash').checked;

  // Update preview
  title.style.fontFamily = FONTS[activeFont];
  channel.style.display = showChannel ? 'block' : 'none';
  duration.style.display = showDuration ? 'block' : 'none';
  noise.style.display = showNoise ? 'block' : 'none';

  // Preview accent color
  if (accentFromHash) {
    preview.style.borderLeft = '2px solid #fff';
    preview.style.paddingLeft = '14px'; // Compensate for border
  } else {
    preview.style.borderLeft = '1px solid #222';
    preview.style.paddingLeft = '16px';
  }
}
