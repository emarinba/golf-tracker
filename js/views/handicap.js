/**
 * =====================================================================
 * HANDICAP.JS - Módulo de Hándicap Oficial WHS/RFEG
 * Integración incremental — no modifica lógica existente
 * =====================================================================
 */

const HandicapView = {

  rounds: [],        // Todas las rondas cargadas (máx 20)
  best8Ids: new Set(), // IDs de las 8 mejores rondas (en memoria)
  handicapIndex: 0,  // Índice calculado

  // ===================================================================
  // 1. INICIALIZACIÓN
  // ===================================================================

  async initialize() {
    console.log('🏆 Inicializando módulo de Hándicap...');
    await this.loadRounds();
  },

  // ===================================================================
  // 2. CARGA Y CÁLCULO
  // ===================================================================

  async loadRounds() {
    try {
      const { data, error } = await window.SupabaseAPI.handicap.getAll();

      if (error) throw new Error(error);

      // Ordenar por fecha descendente y tomar las últimas 20
      this.rounds = (data || [])
        .sort((a, b) => new Date(b.round_date) - new Date(a.round_date))
        .slice(0, 20);

      this.calculateHandicap();
      this.render();

      console.log(`✅ ${this.rounds.length} rondas de hándicap cargadas`);

    } catch (error) {
      console.error('❌ Error cargando rondas:', error);
      Utils.showToast('Error al cargar rondas de hándicap', 'error');
    }
  },

  /**
   * Calcular hándicap WHS:
   * 1. Ordenar por SD_FINAL ascendente (menor = mejor)
   * 2. Seleccionar las 8 mejores según tabla WHS
   * 3. Media × 0.96
   */
  calculateHandicap() {
    this.best8Ids = new Set();
    this.handicapIndex = 0;

    const n = this.rounds.length;
    if (n === 0) return;

    // Tabla WHS oficial: cuántas rondas usar según total disponible
    // https://www.usga.org/content/usga/home-page/handicapping/roh/Content/rules/5-2-Calculation-of-a-Handicap-Index.htm
    const wshTable = {
      3:  { count: 1, adjustment: -2.0 },
      4:  { count: 1, adjustment: -1.0 },
      5:  { count: 1, adjustment:  0.0 },
      6:  { count: 2, adjustment: -1.0 },
      7:  { count: 2, adjustment:  0.0 },
      8:  { count: 2, adjustment:  0.0 },
      9:  { count: 3, adjustment:  0.0 },
      10: { count: 3, adjustment:  0.0 },
      11: { count: 4, adjustment:  0.0 },
      12: { count: 4, adjustment:  0.0 },
      13: { count: 5, adjustment:  0.0 },
      14: { count: 5, adjustment:  0.0 },
      15: { count: 6, adjustment:  0.0 },
      16: { count: 6, adjustment:  0.0 },
      17: { count: 7, adjustment:  0.0 },
      18: { count: 7, adjustment:  0.0 },
      19: { count: 8, adjustment:  0.0 },
      20: { count: 8, adjustment:  0.0 },
    };

    if (n < 3) {
      // Menos de 3 rondas: no se puede calcular
      this.handicapIndex = null;
      return;
    }

    const rule = wshTable[Math.min(n, 20)];

    // Ordenar por SD_FINAL ascendente (menor = mejor)
    const sorted = [...this.rounds].sort((a, b) => a.sd_final - b.sd_final);
    const bestRounds = sorted.slice(0, rule.count);

    // Marcar las mejores
    bestRounds.forEach(r => this.best8Ids.add(r.id));

    // Calcular media de las mejores
    const sum = bestRounds.reduce((acc, r) => acc + parseFloat(r.sd_final), 0);
    const avg = sum / rule.count;

    // RFEG: media directa + ajuste de tabla, redondeado a 1 decimal
    // (la RFEG NO aplica el factor 0.96 del sistema USGA/GHIN)
    const raw = avg + rule.adjustment;
    this.handicapIndex = Math.round(raw * 10) / 10;
  },

  // ===================================================================
  // 3. RENDERIZADO
  // ===================================================================

  render() {
    this.renderSummary();
    this.renderTable();
  },

  renderSummary() {
    const indexEl = document.getElementById('hcp-index-value');
    const totalEl = document.getElementById('hcp-total-rounds');
    const bestEl  = document.getElementById('hcp-best8-avg');
    const subEl   = document.getElementById('hcp-index-sub');

    const n = this.rounds.length;
    const rule = this._getWHSRule(n);

    if (indexEl) {
      if (this.handicapIndex === null || n < 3) {
        indexEl.textContent = '--';
      } else {
        indexEl.textContent = this.handicapIndex.toFixed(1);
      }
    }

    if (totalEl) totalEl.textContent = n;

    if (bestEl) {
      if (this.best8Ids.size > 0) {
        const best = this.rounds.filter(r => this.best8Ids.has(r.id));
        const avg = best.reduce((a, r) => a + parseFloat(r.sd_final), 0) / best.length;
        bestEl.textContent = avg.toFixed(1);
      } else {
        bestEl.textContent = '--';
      }
    }

    if (subEl) {
      if (n < 3) {
        subEl.textContent = `Necesitas ${3 - n} ronda${3 - n !== 1 ? 's' : ''} más`;
      } else if (rule) {
        subEl.textContent = `Media de ${rule.count} mejor${rule.count !== 1 ? 'es' : ''} de ${n} rondas`;
      }
    }
  },

  renderTable() {
    const container = document.getElementById('handicap-rounds-body');
    const emptyEl   = document.getElementById('handicap-empty');
    const tableEl   = document.getElementById('handicap-table-wrapper');

    if (!container) return;

    if (this.rounds.length === 0) {
      if (emptyEl)  emptyEl.classList.remove('hidden');
      if (tableEl)  tableEl.classList.add('hidden');
      return;
    }

    if (emptyEl)  emptyEl.classList.add('hidden');
    if (tableEl)  tableEl.classList.remove('hidden');

    container.innerHTML = this.rounds.map((round, index) => {
      const isBest = this.best8Ids.has(round.id);
      return this._renderRow(round, index + 1, isBest);
    }).join('');
  },

  _renderRow(round, rowNum, isBest) {
    const crSlopePar = `${round.course_rating}/${round.slope_rating}/${round.par_value}`;
    const adjClass   = round.total_adjustment < 0 ? 'col-adjustment-neg' : 'col-adjustment-zero';
    const rowClass   = isBest ? 'is-best-8' : '';
    const badge      = isBest ? '<span class="badge-best8">✓</span>' : '';
    const rowNumEl   = `<span class="row-number">${rowNum}</span>`;
    const dateStr    = Utils.formatDateShort(round.round_date);

    // Solo mostrar eliminar si fue enviada desde la app (source = 'tracker')
    // Las importadas por JSON (source = 'import' o null legacy) son inamovibles
    const canDelete = round.source === 'tracker';
    const deleteBtn = canDelete
      ? `<button class="row-action-btn" onclick="HandicapView.deleteRound('${round.id}')" title="Eliminar">🗑️</button>`
      : `<span style="font-size:10px;color:var(--text-tertiary)" title="Importada — no eliminable">🔒</span>`;

    return `
      <tr class="${rowClass}" data-id="${round.id}">
        <td>${rowNumEl}</td>
        <td>${Utils.sanitizeHTML(dateStr)}</td>
        <td>
          ${Utils.sanitizeHTML(round.tournament_name)}${badge}
        </td>
        <td>${round.holes}</td>
        <td>${crSlopePar}</td>
        <td>${parseFloat(round.exact_index).toFixed(1)}</td>
        <td>${round.playing_hcp}</td>
        <td class="${round.asc_adjustment < 0 ? 'col-adjustment-neg' : 'col-adjustment-zero'}">${round.asc_adjustment}</td>
        <td>${round.gross_adjusted}</td>
        <td>${round.stableford_net}</td>
        <td class="col-score-diff">${parseFloat(round.score_diff).toFixed(1)}</td>
        <td class="${adjClass}">${round.total_adjustment}</td>
        <td class="col-sd-final">${parseFloat(round.sd_final).toFixed(1)}</td>
        <td>
          <div class="row-actions" style="opacity:1">
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  },

  // ===================================================================
  // 4. IMPORTACIÓN JSON
  // ===================================================================

  openImportModal() {
    // Limpiar estado anterior
    document.getElementById('import-json-text').value = '';
    const preview = document.getElementById('import-preview');
    if (preview) preview.classList.add('hidden');

    GolfApp.openModal('handicap-import-modal');
  },

  /**
   * Manejar subida de fichero JSON
   */
  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('import-json-text').value = e.target.result;
      this.parseImportPreview();
    };
    reader.readAsText(file);

    // Limpiar input para permitir re-selección
    event.target.value = '';
  },

  /**
   * Parsear JSON e mostrar preview
   */
  parseImportPreview() {
    const text = document.getElementById('import-json-text').value.trim();
    const errorEl   = document.getElementById('import-error');
    const previewEl = document.getElementById('import-preview');

    if (errorEl)   errorEl.classList.add('hidden');
    if (previewEl) previewEl.classList.add('hidden');

    if (!text) return;

    try {
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        throw new Error('El JSON debe ser un array de rondas [ {...}, {...} ]');
      }

      if (parsed.length === 0) {
        throw new Error('El array está vacío');
      }

      // Validar y normalizar cada entrada
      const normalized = parsed.map((item, i) => this._validateAndNormalize(item, i));

      // Mostrar preview
      this._renderImportPreview(normalized);
      previewEl.classList.remove('hidden');

      // Guardar en estado temporal
      this._pendingImport = normalized;

    } catch (err) {
      if (errorEl) {
        errorEl.textContent = `Error: ${err.message}`;
        errorEl.classList.remove('hidden');
      }
      this._pendingImport = null;
    }
  },

  /**
   * Validar y normalizar un registro del JSON
   */
  _validateAndNormalize(item, index) {
    const required = ['date', 'tournament', 'holes', 'course_rating',
                      'slope_rating', 'par', 'exact_index', 'playing_hcp',
                      'gross_adjusted', 'stableford_net', 'score_diff', 'sd_final'];

    for (const field of required) {
      if (item[field] === undefined || item[field] === null || item[field] === '') {
        throw new Error(`Fila ${index + 1}: campo "${field}" requerido`);
      }
    }

    // Parsear fecha dd/mm/yyyy → yyyy-mm-dd
    const dateStr = String(item.date).trim();
    let isoDate;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [d, m, y] = dateStr.split('/');
      isoDate = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      isoDate = dateStr;
    } else {
      throw new Error(`Fila ${index + 1}: fecha "${dateStr}" inválida. Usa dd/mm/yyyy`);
    }

    const holes = parseInt(item.holes);
    if (![9, 18].includes(holes)) {
      throw new Error(`Fila ${index + 1}: "holes" debe ser 9 o 18`);
    }

    return {
      round_date:        isoDate,
      tournament_name:   String(item.tournament).trim(),
      holes:             holes,
      course_rating:     parseFloat(item.course_rating),
      slope_rating:      parseInt(item.slope_rating),
      par_value:         parseInt(item.par),
      exact_index:       parseFloat(item.exact_index),
      playing_hcp:       parseInt(item.playing_hcp),
      asc_adjustment:    parseInt(item.asc_adjustment  ?? 0),
      gross_adjusted:    parseInt(item.gross_adjusted),
      stableford_net:    parseInt(item.stableford_net),
      score_diff:        parseFloat(item.score_diff),
      total_adjustment:  parseInt(item.total_adjustment ?? 0),
      sd_final:          parseFloat(item.sd_final),
    };
  },

  _renderImportPreview(data) {
    const countEl = document.getElementById('import-preview-count');
    const bodyEl  = document.getElementById('import-preview-body');

    if (countEl) countEl.textContent = `${data.length} rondas`;

    if (bodyEl) {
      bodyEl.innerHTML = data.map(r => `
        <tr>
          <td>${Utils.formatDateShort(r.round_date)}</td>
          <td>${Utils.sanitizeHTML(r.tournament_name)}</td>
          <td>${r.holes}</td>
          <td>${r.course_rating}/${r.slope_rating}/${r.par_value}</td>
          <td>${r.sd_final.toFixed(1)}</td>
        </tr>
      `).join('');
    }
  },

  /**
   * Confirmar y guardar importación en Supabase
   */
  async confirmImport() {
    if (!this._pendingImport || this._pendingImport.length === 0) {
      Utils.showToast('No hay datos válidos para importar', 'warning');
      return;
    }

    const btn = document.getElementById('import-confirm-btn');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }

    try {
      const { error } = await window.SupabaseAPI.handicap.bulkInsert(this._pendingImport);

      if (error) throw new Error(error);

      Utils.showToast(`${this._pendingImport.length} rondas importadas correctamente`, 'success');
      this._pendingImport = null;

      GolfApp.closeModal('handicap-import-modal');
      await this.loadRounds();

    } catch (err) {
      console.error('Error importando rondas:', err);
      Utils.showToast('Error al importar: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    }
  },

  // ===================================================================
  // 5. BORRADO
  // ===================================================================

  async deleteRound(roundId) {
    const confirmed = await Utils.confirm(
      '¿Eliminar esta ronda? Se recalculará el hándicap.'
    );
    if (!confirmed) return;

    try {
      const { error } = await window.SupabaseAPI.handicap.delete(roundId);
      if (error) throw new Error(error);

      Utils.showToast('Ronda eliminada. Hándicap recalculado.', 'success');
      await this.loadRounds();

    } catch (err) {
      console.error('Error eliminando ronda:', err);
      Utils.showToast('Error al eliminar la ronda', 'error');
    }
  },

  // ===================================================================
  // 7. AÑADIR DESDE PARTIDA DEL TRACKER
  // ===================================================================

  /**
   * Llamado desde GameView tras guardar una partida.
   * Muestra un modal ligero para completar los datos WHS que faltan
   * (CR, Slope, ASC) y crea el registro en handicap_rounds.
   */
  promptAddFromGame(gameData) {
    // gameData = { id, game_date, game_name, course, exact_index,
    //              total_strokes, score_hcp, holes, courseObj }
    this._pendingGame = gameData;

    // Rellenar datos ya conocidos en el mini-formulario
    const nameEl   = document.getElementById('hcp-game-name');
    const dateEl   = document.getElementById('hcp-game-date-display');
    const holesEl  = document.getElementById('hcp-game-holes');
    const crEl     = document.getElementById('hcp-game-cr');
    const slopeEl  = document.getElementById('hcp-game-slope');
    const parEl    = document.getElementById('hcp-game-par');
    const indexEl  = document.getElementById('hcp-game-index');
    const hcpEl    = document.getElementById('hcp-game-hcp');
    const grossEl  = document.getElementById('hcp-game-gross');

    if (nameEl)  nameEl.textContent  = gameData.game_name || gameData.course_name || 'Partida sin nombre';
    if (dateEl)  dateEl.textContent  = Utils.formatDate(gameData.game_date);
    if (holesEl) holesEl.textContent = gameData.holes_played + ' hoyos';
    if (indexEl) indexEl.value = gameData.exact_index || '';
    if (hcpEl)   hcpEl.value   = gameData.handicap_total || '';
    if (grossEl) grossEl.value = gameData.total_strokes || '';

    // Pre-rellenar CR/Slope del campo si están guardados
    if (gameData.courseObj) {
      const co = gameData.courseObj;
      const is9 = gameData.holes_played === 9;
      if (crEl)    crEl.value    = (is9 ? co.cr_9    : co.cr_18)    || '';
      if (slopeEl) slopeEl.value = (is9 ? co.slope_9 : co.slope_18) || '';
      if (parEl)   parEl.value   = (is9 ? co.par_9   : co.par_18)   || '';
    } else {
      if (crEl)    crEl.value    = '';
      if (slopeEl) slopeEl.value = '';
      if (parEl)   parEl.value   = '';
    }

    // Limpiar campos calculados
    ['hcp-game-score-diff','hcp-game-asc','hcp-game-adjustment','hcp-game-sd-final'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    GolfApp.openModal('handicap-from-game-modal');
  },

  /**
   * Calcular Score Diff en tiempo real cuando cambian CR/Slope/Gross en el modal
   */
  recalcFromGameModal() {
    const cr    = parseFloat(document.getElementById('hcp-game-cr').value);
    const slope = parseFloat(document.getElementById('hcp-game-slope').value);
    const gross = parseFloat(document.getElementById('hcp-game-gross').value);
    const asc   = parseInt(document.getElementById('hcp-game-asc').value) || 0;

    if (!cr || !slope || !gross) {
      document.getElementById('hcp-game-score-diff').value = '';
      document.getElementById('hcp-game-sd-final').value   = '';
      return;
    }

    const scoreDiff = Math.round((113 / slope) * (gross - cr) * 10) / 10;
    const sdFinal   = Math.round((scoreDiff + asc) * 10) / 10;

    document.getElementById('hcp-game-score-diff').value = scoreDiff.toFixed(1);
    document.getElementById('hcp-game-sd-final').value   = sdFinal.toFixed(1);
    document.getElementById('hcp-game-adjustment').value = asc;
  },

  /**
   * Confirmar y guardar el registro de hándicap desde partida
   */
  async confirmAddFromGame() {
    const cr       = parseFloat(document.getElementById('hcp-game-cr').value);
    const slope    = parseInt(document.getElementById('hcp-game-slope').value);
    const par      = parseInt(document.getElementById('hcp-game-par').value);
    const index    = parseFloat(document.getElementById('hcp-game-index').value);
    const hcp      = parseInt(document.getElementById('hcp-game-hcp').value);
    const gross    = parseInt(document.getElementById('hcp-game-gross').value);
    const stabl    = parseInt(document.getElementById('hcp-game-stabl').value) || 0;
    const asc      = parseInt(document.getElementById('hcp-game-asc').value) || 0;
    const sdFinal  = parseFloat(document.getElementById('hcp-game-sd-final').value);
    const holesStr = document.getElementById('hcp-game-holes-select').value;

    if (!cr || !slope || !par || !index || !gross || isNaN(sdFinal)) {
      Utils.showToast('Completa CR, Slope, Par, Índice y Gross para continuar', 'warning');
      return;
    }

    const scoreDiff = Math.round((113 / slope) * (gross - cr) * 10) / 10;
    const g = this._pendingGame;

    const round = {
      game_id:         g.id || null,
      round_date:      g.game_date,
      tournament_name: g.game_name || g.course_name || 'Partida tracker',
      holes:           parseInt(holesStr),
      course_rating:   cr,
      slope_rating:    slope,
      par_value:       par,
      exact_index:     index,
      playing_hcp:     hcp,
      asc_adjustment:  asc,
      gross_adjusted:  gross,
      stableford_net:  stabl,
      score_diff:      scoreDiff,
      total_adjustment: asc,
      sd_final:        sdFinal,
    };

    const btn = document.getElementById('hcp-from-game-confirm-btn');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }

    try {
      const { error } = await window.SupabaseAPI.handicap.insertSingle(round);
      if (error) throw new Error(error);

      Utils.showToast('Añadido al hándicap. Recalculando...', 'success');
      GolfApp.closeModal('handicap-from-game-modal');
      this._pendingGame = null;
      await this.loadRounds();

    } catch (err) {
      console.error('Error añadiendo al hándicap:', err);
      Utils.showToast('Error al añadir: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    }
  },

  // ===================================================================
  // 8. HELPER PRIVADO
  // ===================================================================

  _getWHSRule(n) {
    // Tabla WHS — ajustes son negativos para pocas rondas (igual que calculateHandicap)
    const table = {
      3:{count:1,adjustment:-2.0}, 4:{count:1,adjustment:-1.0},
      5:{count:1,adjustment:0},    6:{count:2,adjustment:-1.0},
      7:{count:2,adjustment:0},    8:{count:2,adjustment:0},
      9:{count:3,adjustment:0},   10:{count:3,adjustment:0},
      11:{count:4,adjustment:0},  12:{count:4,adjustment:0},
      13:{count:5,adjustment:0},  14:{count:5,adjustment:0},
      15:{count:6,adjustment:0},  16:{count:6,adjustment:0},
      17:{count:7,adjustment:0},  18:{count:7,adjustment:0},
      19:{count:8,adjustment:0},  20:{count:8,adjustment:0},
    };
    return table[Math.min(n, 20)] || null;
  }
};

// Exportar al ámbito global
window.HandicapView = HandicapView;

console.log('✅ HandicapView cargado');
