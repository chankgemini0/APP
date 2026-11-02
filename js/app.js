/* --- CONTROL DE MENÚ LATERAL Y NAVEGACIÓN PRINCIPAL --- */
window.toggleSideDrawer = function(show) {
  const drawer = document.getElementById('side-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (!drawer || !overlay) return;

  if (show) {
    drawer.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');

    // Desplegar automáticamente la sección Admin si estamos en una pantalla de administración
    const adminSections = ['rutas-semana', 'admin-clientes', 'admin-gasolina', 'historial'];
    const activeAdmin = adminSections.some(sec => {
      const el = document.getElementById(`section-${sec}`);
      return el && !el.classList.contains('hidden');
    });
    if (activeAdmin) {
      const submenu = document.getElementById('admin-submenu');
      const chevron = document.getElementById('admin-chevron');
      if (submenu && submenu.classList.contains('hidden')) {
        submenu.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
      }
    }
  } else {
    drawer.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
};

window.toggleAdminSubmenu = function() {
  const submenu = document.getElementById('admin-submenu');
  const chevron = document.getElementById('admin-chevron');
  if (submenu) {
    submenu.classList.toggle('hidden');
    if (chevron) chevron.classList.toggle('rotate-180');
  }
};

window.drawerNavigate = function(tab) {
  toggleSideDrawer(false);
  switchTab(tab);
};

// Compatibilidad con llamadas previas
window.navFromAdminDropdown = function(tab) {
  switchTab(tab);
};

// Control global de cambio de pestaña
window.switchTab = function(tab) {
  // Normalizar nombres históricos a nombres estándar
  if (tab === 'choferes') tab = 'conductores';
  if (tab === 'vista-chofer') tab = 'vista-conductor';

  const secciones = ['logistica', 'rutas-semana', 'admin-clientes', 'historial', 'incidencias', 'vista-conductor', 'camiones', 'conductores', 'admin-gasolina'];
  secciones.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.classList.add('hidden');
  });

  // Mostrar sección actual
  const secActual = document.getElementById(`section-${tab}`);
  if (secActual) secActual.classList.remove('hidden');

  // Restablecer estilos de las pestañas principales de la barra superior
  const mainTabs = ['conductores', 'logistica', 'vista-conductor'];
  mainTabs.forEach(t => {
    const tabEl = document.getElementById(`tab-${t}`);
    if (tabEl) {
      if (t === 'logistica') {
        tabEl.className = "flex-1 min-w-[110px] sm:min-w-[140px] py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 text-slate-600 hover:text-blue-700 hover:bg-white/60 cursor-pointer";
      } else {
        tabEl.className = "flex-1 min-w-[110px] sm:min-w-[130px] py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 text-slate-600 hover:text-blue-700 hover:bg-white/60 cursor-pointer";
      }
    }
  });

  // Activar pestaña principal si corresponde
  const tabActivo = document.getElementById(`tab-${tab}`);
  if (tabActivo) {
    if (tab === 'logistica') {
      tabActivo.className = "flex-1 min-w-[130px] sm:min-w-[150px] py-3.5 sm:py-4 px-3 sm:px-4 rounded-xl text-sm sm:text-base font-extrabold transition-all duration-200 flex items-center justify-center gap-2 bg-blue-600 text-white shadow-lg scale-105 z-10 cursor-pointer";
    } else if (tab === 'conductores') {
      tabActivo.className = "flex-1 min-w-[110px] sm:min-w-[130px] py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 text-white shadow-md bg-indigo-600 cursor-pointer";
    } else if (tab === 'vista-conductor') {
      tabActivo.className = "flex-1 min-w-[110px] sm:min-w-[130px] py-3 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 text-white shadow-md bg-blue-600 cursor-pointer";
    }
  }

  if (tab === 'logistica') renderModuloLogistica();
  if (tab === 'rutas-semana') renderDiasSemana();
  if (tab === 'admin-clientes') renderClientes();
  if (tab === 'historial') {
    if (typeof renderHistorialConductoresGrid === 'function') renderHistorialConductoresGrid();
    else if (typeof renderHistorialChoferesGrid === 'function') renderHistorialChoferesGrid();
  }
  if (tab === 'incidencias') renderSeccionIncidencias();
  if (tab === 'vista-conductor') {
    if (typeof actualizarSelectPortalConductores === 'function') actualizarSelectPortalConductores();
    else if (typeof actualizarSelectPortalChoferes === 'function') actualizarSelectPortalChoferes();
  }
  if (tab === 'camiones') renderCamiones();
  if (tab === 'conductores') {
    if (typeof renderConductores === 'function') renderConductores();
    else if (typeof renderChoferes === 'function') renderChoferes();
  }
  if (tab === 'admin-gasolina') renderAdminCombustible();
};

// Inicialización general de la aplicación al cargar
actualizarKPIs();
renderModuloLogistica();
renderClientes();
renderDiasSemana();
renderCamiones();
if (typeof renderConductores === 'function') {
  renderConductores();
} else if (typeof renderChoferes === 'function') {
  renderChoferes();
}
renderAdminCombustible();

// Inicialización de Supabase y sincronización en tiempo real
if (typeof iniciarSupabaseApp === 'function') {
  iniciarSupabaseApp();
}
