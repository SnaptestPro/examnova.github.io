// ═══════════════════════════════════════════════════════════════
//  THEME MANAGER — 100 Live Theme Switcher
//  Savyasachi Coaching Test
// ═══════════════════════════════════════════════════════════════

// Theme manager global object
window.ThemeManager = {
  currentTheme: 'savvy-default',
  pickerOpen: false,

  // Apply a theme by setting CSS custom properties
  apply(themeId) {
    const theme = THEME_PALETTES.find(t => t.id === themeId);
    if (!theme) {
      console.warn('[Theme] Unknown theme:', themeId);
      return;
    }
    this.currentTheme = themeId;
    localStorage.setItem('savyasachi_theme', themeId);

    const root = document.documentElement;
    root.style.setProperty('--th-primary', theme.primary);
    root.style.setProperty('--th-secondary', theme.secondary);
    root.style.setProperty('--th-accent', theme.accent);
    root.style.setProperty('--th-bg', theme.bg);
    root.style.setProperty('--th-bg2', theme.bg2);
    root.style.setProperty('--th-card', theme.card);
    root.style.setProperty('--th-text', theme.text);
    root.style.setProperty('--th-muted', theme.muted);
    root.style.setProperty('--th-border', theme.border);
    root.style.setProperty('--th-success', theme.success);
    root.style.setProperty('--th-danger', theme.danger);
    root.style.setProperty('--th-warning', theme.warning);

    // Also set a body attribute for CSS selectors
    document.body.setAttribute('data-theme', themeId);

    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  },

  // Load saved theme on page load
  init() {
    const saved = localStorage.getItem('savyasachi_theme');
    if (saved && THEME_PALETTES.find(t => t.id === saved)) {
      this.apply(saved);
    } else {
      this.apply('savvy-default');
    }
  },

  // Show/hide theme picker modal
  togglePicker() {
    this.pickerOpen = !this.pickerOpen;
    const modal = document.getElementById('theme-picker-modal');
    if (modal) {
      modal.style.display = this.pickerOpen ? 'flex' : 'none';
      if (this.pickerOpen) this.renderPicker();
    }
  },

  // Hide theme picker
  hidePicker() {
    this.pickerOpen = false;
    const modal = document.getElementById('theme-picker-modal');
    if (modal) modal.style.display = 'none';
  },

  // Render theme picker content
  renderPicker() {
    const grid = document.getElementById('theme-picker-grid');
    if (!grid) return;

    let html = '';
    for (const [catName, ids] of Object.entries(THEME_CATEGORIES)) {
      html += `<div class="theme-cat"><div class="theme-cat-title">${catName}</div><div class="theme-cat-grid">`;
      for (const id of ids) {
        const t = THEME_PALETTES.find(p => p.id === id);
        if (!t) continue;
        const isActive = this.currentTheme === id;
        html += `
          <div class="theme-swatch${isActive ? ' active' : ''}" onclick="ThemeManager.apply('${id}');ThemeManager.renderPicker();" title="${t.name}">
            <div class="swatch-colors" style="background:linear-gradient(135deg,${t.primary},${t.secondary});">
              <span class="swatch-accent" style="background:${t.accent}"></span>
            </div>
            <div class="swatch-name">${t.name}</div>
          </div>`;
      }
      html += '</div></div>';
    }
    grid.innerHTML = html;
  }
};

// Auto-init on DOM ready
(function() {
  function boot() { if (typeof THEME_PALETTES !== 'undefined') ThemeManager.init(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
