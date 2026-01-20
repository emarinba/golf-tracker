/**
 * =====================================================================
 * GAME.JS - Vista de nueva partida / editar
 * ===================================================================== */

const GameView = {
  
  editingGameId: null,
  currentCourseId: null,
  holesData: [],
  
  /**
   * Inicializar vista
   */
  async initialize() {
    console.log('🎮 Inicializando vista de juego...');
    
    // Cargar campos para el combo
    await this.loadCourses();
    
    // Establecer fecha actual
    document.getElementById('game-date').value = Utils.getTodayDate();
    
    // Renderizar hoyos vacíos
    this.renderHoles();
  },
  
  /**
   * Cargar campos para el select
   */
  async loadCourses() {
    try {
      const { data, error } = await window.SupabaseAPI.courses.getAll();
      
      if (error) throw new Error(error);
      
      this.updateCourseSelect(data || []);
      
    } catch (error) {
      console.error('Error cargando campos:', error);
    }
  },
  
  /**
   * Actualizar el select de campos
   */
  updateCourseSelect(courses) {
    const select = document.getElementById('game-course-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecciona un campo</option>' + 
      courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  },
  
  /**
   * Cuando cambia el campo seleccionado → PRE-CARGAR configuración
   */
  async onCourseChange() {
    const select = document.getElementById('game-course-select');
    const courseId = select.value;
    
    if (!courseId) {
      // Sin campo → valores por defecto
      this.currentCourseId = null;
      this.renderHoles();
      return;
    }
    
    try {
      // Cargar configuración del campo
      const { data: course, error } = await window.SupabaseAPI.courses.getById(courseId);
      
      if (error || !course) {
        throw new Error('Error cargando campo');
      }
      
      this.currentCourseId = courseId;
      
      // PRE-CARGAR par y estrellas de cada hoyo
      const holes = course.course_holes || [];
      this.renderHoles(holes);
      
      Utils.showToast(`Campo "${course.name}" cargado`, 'success');
      
    } catch (error) {
      console.error('Error cargando configuración del campo:', error);
      Utils.showToast('Error al cargar configuración del campo', 'error');
    }
  },
  
  /**
   * Renderizar tarjetas de hoyos
   */
  renderHoles(courseHoles = []) {
    const container = document.getElementById('holes-container');
    if (!container) return;
    
    const defaultPars = [4, 4, 3, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5, 3, 4, 4, 5];
    
    container.innerHTML = Array.from({ length: 18 }, (_, i) => {
      const holeNumber = i + 1;
      const hole = courseHoles.find(h => h.hole_number === holeNumber);
      const par = hole?.par || defaultPars[i];
      const stars = hole?.stars || 0;
      const strokes = this.holesData[i]?.strokes || '';
      
      return Components.renderHoleCard(holeNumber, par, stars, strokes);
    }).join('');
    
    // Actualizar totales
    this.updateTotals();
  },
  
  /**
   * Actualizar puntuación de un hoyo cuando cambian los golpes
   */
  updateHoleScore(holeNumber) {
    const index = holeNumber - 1;
    
    // Obtener valores
    const strokesInput = document.getElementById(`strokes-${holeNumber}`);
    const strokes = parseInt(strokesInput.value) || 0;
    
    // Obtener par y estrellas del DOM
    const holeCard = strokesInput.closest('.hole-card');
    const parText = holeCard.querySelector('.hole-par strong').textContent;
    const starsText = holeCard.querySelector('.hole-stars strong').textContent;
    
    const par = parseInt(parText);
    const stars = parseInt(starsText);
    
    // Calcular puntos
    const { scr, hcp } = Utils.calculatePoints(par, stars, strokes);
    
    // Actualizar display
    document.getElementById(`scr-${holeNumber}`).textContent = scr;
    document.getElementById(`hcp-${holeNumber}`).textContent = hcp;
    
    // Guardar en array
    this.holesData[index] = {
      hole_number: holeNumber,
      par,
      stars,
      strokes,
      scr,
      hcp
    };
    
    // Actualizar totales
    this.updateTotals();
  },
  
  /**
   * Actualizar totales (9 primeros, 9 últimos, total 18)
   */
  updateTotals() {
    const front9 = this.holesData.slice(0, 9);
    const back9 = this.holesData.slice(9, 18);
    
    // Primeros 9
    const frontStrokes = front9.reduce((sum, h) => sum + (h?.strokes || 0), 0);
    const frontScr = front9.reduce((sum, h) => sum + (h?.scr || 0), 0);
    const frontHcp = front9.reduce((sum, h) => sum + (h?.hcp || 0), 0);
    
    document.getElementById('total-front-strokes').textContent = frontStrokes;
    document.getElementById('total-front-scr').textContent = frontScr;
    document.getElementById('total-front-hcp').textContent = frontHcp;
    
    // Últimos 9
    const backStrokes = back9.reduce((sum, h) => sum + (h?.strokes || 0), 0);
    const backScr = back9.reduce((sum, h) => sum + (h?.scr || 0), 0);
    const backHcp = back9.reduce((sum, h) => sum + (h?.hcp || 0), 0);
    
    document.getElementById('total-back-strokes').textContent = backStrokes;
    document.getElementById('total-back-scr').textContent = backScr;
    document.getElementById('total-back-hcp').textContent = backHcp;
    
    // Total 18
    const totalScr = frontScr + backScr;
    const totalHcp = frontHcp + backHcp;
    
    document.getElementById('total-strokes').textContent = frontStrokes + backStrokes;
    document.getElementById('total-scr').textContent = totalScr;
    document.getElementById('total-hcp').textContent = totalHcp;
    
    // Actualizar vista rápida (toggle button)
    const quickScr = document.getElementById('quick-total-scr');
    const quickHcp = document.getElementById('quick-total-hcp');
    if (quickScr) quickScr.textContent = totalScr;
    if (quickHcp) quickHcp.textContent = totalHcp;
  },
  
  /**
   * Toggle del resumen de totales
   */
  toggleTotals() {
    const totalsEl = document.getElementById('game-totals');
    const toggleBtn = document.querySelector('.game-totals-toggle');
    const summaryText = document.getElementById('totals-summary-text');
    
    if (totalsEl && toggleBtn) {
      const isCollapsed = totalsEl.classList.contains('collapsed');
      
      if (isCollapsed) {
        totalsEl.classList.remove('collapsed');
        toggleBtn.classList.add('expanded');
        if (summaryText) summaryText.textContent = 'Ocultar resumen';
      } else {
        totalsEl.classList.add('collapsed');
        toggleBtn.classList.remove('expanded');
        if (summaryText) summaryText.textContent = 'Ver resumen';
      }
    }
  },
  
  /**
   * Guardar partida (nueva o editada)
   */
  async saveGame() {
    try {
      // Validar fecha
      const gameDate = document.getElementById('game-date').value;
      if (!gameDate) {
        Utils.showToast('Por favor selecciona una fecha', 'warning');
        return;
      }
      
      // Validar que se hayan introducido golpes
      const totalStrokes = this.holesData.reduce((sum, h) => sum + (h?.strokes || 0), 0);
      if (totalStrokes === 0) {
        Utils.showToast('Por favor introduce los golpes de al menos un hoyo', 'warning');
        return;
      }
      
      // Recopilar todos los hoyos con datos
      const holes = [];
      for (let i = 1; i <= 18; i++) {
        const strokesInput = document.getElementById(`strokes-${i}`);
        const strokes = parseInt(strokesInput.value) || 0;
        
        const holeCard = strokesInput.closest('.hole-card');
        const par = parseInt(holeCard.querySelector('.hole-par strong').textContent);
        const stars = parseInt(holeCard.querySelector('.hole-stars strong').textContent);
        
        const scr = parseInt(document.getElementById(`scr-${i}`).textContent) || 0;
        const hcp = parseInt(document.getElementById(`hcp-${i}`).textContent) || 0;
        
        holes.push({
          hole: i,
          par,
          stars,
          strokes,
          score_sch: scr,
          score_hcp: hcp
        });
      }
      
      // Construir objeto de partida
      const gameData = {
        courseId: document.getElementById('game-course-select').value || null,
        gameDate: gameDate,
        gameName: document.getElementById('game-name').value.trim() || null,
        handicapTotal: parseInt(document.getElementById('game-handicap').value) || 0,
        holes
      };
      
      // Deshabilitar botón
      const btn = document.getElementById('save-game-btn');
      btn.disabled = true;
      btn.classList.add('loading');
      
      let result;
      
      if (this.editingGameId) {
        // Actualizar
        result = await window.SupabaseAPI.games.update(this.editingGameId, gameData);
        Utils.showToast('Partida actualizada correctamente', 'success');
      } else {
        // Crear
        result = await window.SupabaseAPI.games.create(gameData);
        Utils.showToast('Partida guardada correctamente', 'success');
      }
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Resetear y volver al dashboard
      this.reset();
      GolfApp.navigate('dashboard');
      
    } catch (error) {
      console.error('Error guardando partida:', error);
      Utils.showToast('Error al guardar partida', 'error');
      
      // Restaurar botón
      const btn = document.getElementById('save-game-btn');
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  },
  
  /**
   * Cargar partida para editar
   */
  loadGameForEdit(game) {
    console.log('✏️ Cargando partida para editar:', game.id);
    
    this.editingGameId = game.id;
    
    // Actualizar título
    const title = document.getElementById('game-view-title');
    if (title) title.textContent = 'Editar Partida';
    
    // Rellenar formulario
    document.getElementById('game-course-select').value = game.course_id || '';
    document.getElementById('game-date').value = game.game_date;
    document.getElementById('game-name').value = game.game_name || '';
    document.getElementById('game-handicap').value = game.handicap_total;
    
    // Cargar hoyos
    const holes = game.holes || [];
    this.holesData = holes.map((h, i) => ({
      hole_number: h.hole_number || i + 1,
      par: h.par,
      stars: h.stars,
      strokes: h.strokes,
      scr: h.score_sch,
      hcp: h.score_hcp
    }));
    
    // Renderizar hoyos con los datos
    this.renderHolesWithData(holes);
  },
  
  /**
   * Renderizar hoyos con datos de partida existente
   */
  renderHolesWithData(holes) {
    const container = document.getElementById('holes-container');
    if (!container) return;
    
    container.innerHTML = holes.map((h, i) => {
      const holeNumber = h.hole_number || i + 1;
      return Components.renderHoleCard(holeNumber, h.par, h.stars, h.strokes);
    }).join('');
    
    this.updateTotals();
  },
  
  /**
   * Resetear formulario
   */
  reset() {
    this.editingGameId = null;
    this.currentCourseId = null;
    this.holesData = [];
    
    const title = document.getElementById('game-view-title');
    if (title) title.textContent = 'Nueva Partida';
    
    document.getElementById('game-course-select').value = '';
    document.getElementById('game-date').value = Utils.getTodayDate();
    document.getElementById('game-name').value = '';
    document.getElementById('game-handicap').value = '20';
    
    this.renderHoles();
  }
};

// Exportar
window.GameView = GameView;

console.log('✅ GameView cargado');
