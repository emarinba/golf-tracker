/**
 * =====================================================================
 * DASHBOARD.JS - Vista principal con lista de partidas
 * ===================================================================== */

const DashboardView = {
  
  games: [],
  allGames: [], // Guardar todas las partidas sin filtrar
  courses: [],
  filters: {
    courseId: '',
    dateFrom: '',
    dateTo: ''
  },
  
  /**
   * Inicializar dashboard
   */
  async initialize() {
    console.log('📊 Inicializando dashboard...');
    this.showLoadingState();
    try {
      await Promise.all([
        this.loadGames(),
        this.loadCourses()
      ]);
    } finally {
      this.hideLoadingState();
    }
  },

  /**
   * Mostrar estado de carga (skeletons)
   */
  showLoadingState() {
    const summaryContainer = document.getElementById('dashboard-summary');
    const gamesContainer = document.getElementById('games-list');
    if (summaryContainer) summaryContainer.innerHTML = Components.renderSummarySkeleton();
    if (gamesContainer) gamesContainer.innerHTML = Components.renderGameCardSkeletons(3);
  },

  /**
   * Ocultar estado de carga
   */
  hideLoadingState() {
    // Se reemplaza automáticamente cuando render() se ejecuta
  },
  
  /**
   * Cargar partidas desde Supabase
   */
  async loadGames() {
    try {
      const { data, error } = await window.SupabaseAPI.games.getAll();
      
      if (error) {
        throw new Error(error);
      }
      
      this.allGames = data || [];
      this.games = [...this.allGames];
      this.applyFilters();
      
      console.log(`✅ ${this.allGames.length} partidas cargadas`);
      
    } catch (error) {
      console.error('❌ Error cargando partidas:', error);
      Utils.showToast('⚠️ Error al cargar partidas. Verifica tu conexión.', 'error');
      // Mostrar estado vacío en caso de error
      const container = document.getElementById('games-list');
      if (container) container.innerHTML = '<div class="empty-state"><p>Error al cargar partidas. Por favor intenta de nuevo.</p></div>';
    }
  },
  
  /**
   * Cargar campos para el filtro
   */
  async loadCourses() {
    try {
      const { data, error } = await window.SupabaseAPI.courses.getAll();
      
      if (error) throw new Error(error);
      
      this.courses = data || [];
      this.populateCourseFilter();
      
    } catch (error) {
      console.error('Error cargando campos:', error);
      Utils.showToast('⚠️ Error al cargar campos', 'warning');
    }
  },
  
  /**
   * Poblar select de campos en filtro
   */
  populateCourseFilter() {
    const select = document.getElementById('filter-course');
    if (!select) return;
    
    select.innerHTML = '<option value="">Todos los campos</option>' +
      this.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  },
  
  /**
   * Aplicar filtros
   */
  applyFilters() {
    // Obtener valores de filtros
    this.filters.courseId = document.getElementById('filter-course')?.value || '';
    this.filters.dateFrom = document.getElementById('filter-date-from')?.value || '';
    this.filters.dateTo = document.getElementById('filter-date-to')?.value || '';
    
    // Filtrar partidas
    this.games = this.allGames.filter(game => {
      // Filtro por campo
      if (this.filters.courseId && game.course_id !== this.filters.courseId) {
        return false;
      }
      
      // Filtro por fecha desde
      if (this.filters.dateFrom && game.game_date < this.filters.dateFrom) {
        return false;
      }
      
      // Filtro por fecha hasta
      if (this.filters.dateTo && game.game_date > this.filters.dateTo) {
        return false;
      }
      
      return true;
    });
    
    this.render();
  },

  /**
   * Calcular resumen rápido para el dashboard
   */
  getSummaryStats() {
    const sortedGames = [...this.games].sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

    const totalGames = sortedGames.length;
    const totalStrokes = sortedGames.reduce((sum, game) => {
      const strokes = game.holes?.reduce((acc, hole) => acc + (hole.strokes || 0), 0) || 0;
      return sum + strokes;
    }, 0);

    const averageScore = totalGames > 0 ? Math.round(totalStrokes / totalGames) : 0;

    const bestGame = sortedGames.reduce((best, game) => {
      const strokes = game.holes?.reduce((acc, hole) => acc + (hole.strokes || 0), 0) || 0;
      if (!best || strokes < best.strokes) {
        return { strokes, game };
      }
      return best;
    }, null);

    const latestGame = sortedGames[0] || null;

    return {
      totalGames,
      averageScore,
      bestGame,
      latestGame
    };
  },

  /**
   * Renderizar resumen del dashboard
   */
  renderSummary() {
    const container = document.getElementById('dashboard-summary');
    if (!container) return;

    const stats = this.getSummaryStats();

    if (stats.totalGames === 0) {
      container.innerHTML = `
        <div class="summary-card summary-card-empty">
          <h3>Resumen</h3>
          <p>Aún no hay partidas para mostrar. Registra tu primera ronda y aquí verás tu progreso.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="summary-card">
        <span class="summary-label">Partidas</span>
        <strong class="summary-value">${stats.totalGames}</strong>
        <small class="summary-meta">registradas</small>
      </div>
      <div class="summary-card">
        <span class="summary-label">Promedio</span>
        <strong class="summary-value">${stats.averageScore}</strong>
        <small class="summary-meta">golpes por ronda</small>
      </div>
      <div class="summary-card">
        <span class="summary-label">Mejor ronda</span>
        <strong class="summary-value">${stats.bestGame ? stats.bestGame.strokes : 0}</strong>
        <small class="summary-meta">${stats.bestGame ? (stats.bestGame.game.courses?.name || 'Sin campo') : 'Sin datos'}</small>
      </div>
      <div class="summary-card">
        <span class="summary-label">Última partida</span>
        <strong class="summary-value">${stats.latestGame ? Utils.formatDate(stats.latestGame.game_date) : '—'}</strong>
        <small class="summary-meta">${stats.latestGame ? (stats.latestGame.courses?.name || 'Sin campo') : 'Aún no hay datos'}</small>
      </div>
    `;
  },
  
  /**
   * Limpiar filtros
   */
  clearFilters() {
    document.getElementById('filter-course').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    
    this.filters = {
      courseId: '',
      dateFrom: '',
      dateTo: ''
    };
    
    this.games = [...this.allGames];
    this.render();
  },
  
  /**
   * Renderizar lista de partidas
   */
  render() {
    const container = document.getElementById('games-list');
    const emptyState = document.getElementById('empty-state');
    const noResultsState = document.getElementById('no-results-state');
    
    if (!container) return;

    this.renderSummary();
    
    // Si no hay partidas en absoluto
    if (this.allGames.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      if (noResultsState) noResultsState.classList.add('hidden');
      return;
    }
    
    // Si hay partidas pero los filtros no devuelven resultados
    if (this.games.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.add('hidden');
      if (noResultsState) noResultsState.classList.remove('hidden');
      return;
    }
    
    // Hay resultados
    if (emptyState) emptyState.classList.add('hidden');
    if (noResultsState) noResultsState.classList.add('hidden');
    
    container.innerHTML = this.games
      .map(game => Components.renderGameCard(game))
      .join('');
  },
  
  /**
   * Mostrar detalle de partida (modal)
   */
  async showGameDetail(gameId) {
    try {
      const game = this.games.find(g => g.id === gameId);
      
      if (!game) {
        Utils.showToast('Partida no encontrada', 'error');
        return;
      }
      
      const modal = document.getElementById('game-detail-modal');
      const titleEl = document.getElementById('detail-modal-title');
      const bodyEl = document.getElementById('detail-modal-body');
      
      if (titleEl) {
        titleEl.textContent = game.courses?.name || 'Detalle de Partida';
      }
      
      if (bodyEl) {
        bodyEl.innerHTML = Components.renderScorecard(game);
      }
      
      if (modal) {
        modal.classList.add('active');
      }
      
    } catch (error) {
      console.error('Error mostrando detalle:', error);
      Utils.showToast('Error al mostrar detalle', 'error');
    }
  },
  
  /**
   * Editar partida
   */
  editGame(gameId) {
    const game = this.games.find(g => g.id === gameId);
    
    if (!game) {
      Utils.showToast('Partida no encontrada', 'error');
      return;
    }
    
    // Pasar datos a GameView y cambiar a esa vista
    GameView.loadGameForEdit(game);
    GolfApp.navigate('game');
  },
  
  /**
   * Enviar partida al módulo de hándicap oficial
   */
  sendToHandicap(gameId) {
    const game = this.games.find(g => g.id === gameId);
    if (!game) {
      Utils.showToast('Partida no encontrada', 'error');
      return;
    }
    if (typeof HandicapView === 'undefined') {
      Utils.showToast('Módulo de hándicap no disponible', 'error');
      return;
    }

    const holesPlayed = (game.holes || []).filter(h => h.strokes > 0).length;
    HandicapView.promptAddFromGame({
      id:             game.id,
      game_date:      game.game_date,
      game_name:      game.game_name,
      course_name:    game.courses?.name || null,
      exact_index:    game.exact_index   || null,
      handicap_total: game.handicap_total,
      total_strokes:  game.total_strokes,
      holes_played:   holesPlayed <= 9 ? 9 : 18,
      courseObj:      game.courses       || null,
    });
  },

  /**
   */
  async deleteGame(gameId) {
    const confirmed = await Utils.confirm(
      '¿Seguro que quieres eliminar esta partida? Esta acción no se puede deshacer.'
    );
    
    if (!confirmed) return;
    
    try {
      const { error } = await window.SupabaseAPI.games.delete(gameId);
      
      if (error) {
        throw new Error(error);
      }
      
      Utils.showToast('Partida eliminada correctamente', 'success');
      
      // Recargar lista
      await this.loadGames();
      
    } catch (error) {
      console.error('Error eliminando partida:', error);
      Utils.showToast('Error al eliminar partida', 'error');
    }
  }
};

// Exportar
window.DashboardView = DashboardView;

console.log('✅ DashboardView cargado');
