import { useEffect, useRef, useState } from 'react';
import { Simulation } from './models/Simulation.js';
import { SimulationSettings } from './models/SimulationSettings.js';

const BALANCE_PRESETS = {
  balanced: {
    label: 'Сбалансированный',
    description: 'Средний вариант: государство имеет антикризисные механики, но революционные лагеря сохраняют шанс на победу.',
    leaderInfluenceBonus: 0.14,
    revolutionLeaderLoyalty: 0.85,
    maxLeaderInfluenceChance: 0.78,
    stateInfluenceMultiplier: 1.03,
    selfTransitionChance: 0.65,
    suppressionConversionChance: 0.28,
    targetedSuppressionChance: 0.40,
    initialLeaderSupportPercent: 0.022,
    initialLeaderSupportRadius: 65,
    stateVictoryHoldSteps: 700,
    stateCrisisShareThreshold: 0.45,
    stateHighCrisisShareThreshold: 0.60,
    stateStabilizationChance: 0.006,
    stateCrisisStabilizationChance: 0.018,
    smallCellCleanupMaxSupporters: 2,
    smallCellCleanupConversionChance: 0.50
  },
  state: {
    label: 'Усиленное государство',
    description: 'Государство чаще возвращает граждан и сильнее реагирует на рост крупных революционных лагерей.',
    leaderInfluenceBonus: 0.12,
    revolutionLeaderLoyalty: 0.84,
    maxLeaderInfluenceChance: 0.74,
    stateInfluenceMultiplier: 1.07,
    selfTransitionChance: 0.62,
    suppressionConversionChance: 0.34,
    targetedSuppressionChance: 0.48,
    initialLeaderSupportPercent: 0.018,
    initialLeaderSupportRadius: 60,
    stateVictoryHoldSteps: 550,
    stateCrisisShareThreshold: 0.42,
    stateHighCrisisShareThreshold: 0.56,
    stateStabilizationChance: 0.009,
    stateCrisisStabilizationChance: 0.026,
    smallCellCleanupMaxSupporters: 3,
    smallCellCleanupConversionChance: 0.62
  },
  revolution: {
    label: 'Усиленная революция',
    description: 'Лидеры получают больше стартовой поддержки, а подавление государства становится менее точным.',
    leaderInfluenceBonus: 0.16,
    revolutionLeaderLoyalty: 0.86,
    maxLeaderInfluenceChance: 0.82,
    stateInfluenceMultiplier: 1.00,
    selfTransitionChance: 0.70,
    suppressionConversionChance: 0.22,
    targetedSuppressionChance: 0.32,
    initialLeaderSupportPercent: 0.028,
    initialLeaderSupportRadius: 75,
    stateVictoryHoldSteps: 850,
    stateCrisisShareThreshold: 0.48,
    stateHighCrisisShareThreshold: 0.63,
    stateStabilizationChance: 0.004,
    stateCrisisStabilizationChance: 0.013,
    smallCellCleanupMaxSupporters: 1,
    smallCellCleanupConversionChance: 0.38
  }
};

function createDefaultForm(presetKey = 'balanced') {
  const preset = BALANCE_PRESETS[presetKey] ?? BALANCE_PRESETS.balanced;

  return {
    peopleCount: 120,
    campsCount: 3,
    revolutionVictoryPercent: 70,
    balancePreset: presetKey,
    speedMultiplier: 1,
    leaderSpawnInterval: 180,
    revolutionLeaderLoyalty: Math.round(preset.revolutionLeaderLoyalty * 100),
    stateInfluenceMultiplier: preset.stateInfluenceMultiplier,
    suppressionConversionChance: Math.round(preset.suppressionConversionChance * 100),
    targetedSuppressionChance: Math.round(preset.targetedSuppressionChance * 100),
    initialLeaderSupportPercent: roundToOne(preset.initialLeaderSupportPercent * 100),
    initialLeaderSupportRadius: preset.initialLeaderSupportRadius,
    stateVictoryHoldSteps: preset.stateVictoryHoldSteps,
    batchTestsCount: 20,
    batchMaxSteps: 100000
  };
}

function App() {
  const canvasRef = useRef(null);
  const simulationRef = useRef(null);
  const animationRef = useRef(null);
  const fpsFrameCounterRef = useRef(0);
  const fpsLastUpdateRef = useRef(performance.now());

  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [batchSummary, setBatchSummary] = useState(null);
  const [fps, setFps] = useState(0);
  const [form, setForm] = useState(() => createDefaultForm('balanced'));

  useEffect(() => {
    createNewSimulation();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const animate = () => {
      const simulation = simulationRef.current;

      if (!simulation) return;

      for (let i = 0; i < Number(form.speedMultiplier); i++) {
        simulation.step();
      }

      drawSimulation();
      updateFpsCounter();
      setStats(simulation.getStatistics());

      if (simulation.finished) {
        setIsRunning(false);
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, form.speedMultiplier]);

  function updateFpsCounter() {
    const now = performance.now();
    fpsFrameCounterRef.current += 1;
    const delta = now - fpsLastUpdateRef.current;

    if (delta >= 500) {
      setFps(Math.round((fpsFrameCounterRef.current * 1000) / delta));
      fpsFrameCounterRef.current = 0;
      fpsLastUpdateRef.current = now;
    }
  }

  function createSettingsFromForm() {
    const preset = BALANCE_PRESETS[form.balancePreset] ?? BALANCE_PRESETS.balanced;

    return new SimulationSettings({
      peopleCount: Number(form.peopleCount),
      campsCount: Number(form.campsCount),
      revolutionVictoryPercent: Number(form.revolutionVictoryPercent),
      ...preset,
      leaderSpawnInterval: Number(form.leaderSpawnInterval),
      revolutionLeaderLoyalty: Number(form.revolutionLeaderLoyalty) / 100,
      stateInfluenceMultiplier: Number(form.stateInfluenceMultiplier),
      suppressionConversionChance: Number(form.suppressionConversionChance) / 100,
      targetedSuppressionChance: Number(form.targetedSuppressionChance) / 100,
      initialLeaderSupportPercent: Number(form.initialLeaderSupportPercent) / 100,
      initialLeaderSupportRadius: Number(form.initialLeaderSupportRadius),
      stateVictoryHoldSteps: Number(form.stateVictoryHoldSteps)
    });
  }

  function createNewSimulation() {
    simulationRef.current = new Simulation(createSettingsFromForm());
    setStats(simulationRef.current.getStatistics());
    setHoverInfo(null);
    setFps(0);
    fpsFrameCounterRef.current = 0;
    fpsLastUpdateRef.current = performance.now();

    setTimeout(() => {
      drawSimulation();
    }, 0);
  }

  function drawSimulation() {
    const canvas = canvasRef.current;
    const simulation = simulationRef.current;

    if (!canvas || !simulation) return;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    drawSuppressionZone(ctx, simulation);

    for (const person of simulation.people) {
      const camp = simulation.camps[person.campId];

      ctx.beginPath();
      ctx.arc(person.x, person.y, person.radius, 0, Math.PI * 2);
      ctx.fillStyle = camp.color;
      ctx.fill();

      if (hoverInfo?.personId === person.id) {
        ctx.beginPath();
        ctx.arc(person.x, person.y, person.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (person.isLeader) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#111';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(person.x, person.y, person.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = camp.color;
        ctx.stroke();

        if (simulation.isPersonInvulnerable(person)) {
          ctx.beginPath();
          ctx.arc(person.x, person.y, person.radius + 8, 0, Math.PI * 2);
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  function drawSuppressionZone(ctx, simulation) {
    const zone = simulation.suppressionZone;
    if (!zone) return;

    const progress = zone.remainingSteps / zone.duration;

    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(65, 105, 225, ${0.08 + progress * 0.1})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#4169e1';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#1f2933';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Подавление', zone.x - 42, zone.y);
  }

  function handleCanvasMouseMove(event) {
    const canvas = canvasRef.current;
    const simulation = simulationRef.current;

    if (!canvas || !simulation) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const person = simulation.getPersonAtPoint(canvasX, canvasY);

    if (!person) {
      setHoverInfo(null);
      drawSimulation();
      return;
    }

    const details = simulation.getPersonDetails(person);
    setHoverInfo({
      ...details,
      personId: person.id,
      tooltipX: event.clientX - rect.left + 14,
      tooltipY: event.clientY - rect.top + 14
    });

    requestAnimationFrame(() => drawSimulation());
  }

  function handleCanvasMouseLeave() {
    setHoverInfo(null);
    requestAnimationFrame(() => drawSimulation());
  }

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === 'balancePreset') {
      setForm((previous) => ({
        ...previous,
        ...createPresetControlledFields(value),
        balancePreset: value
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  function createPresetControlledFields(presetKey) {
    const preset = BALANCE_PRESETS[presetKey] ?? BALANCE_PRESETS.balanced;

    return {
      revolutionLeaderLoyalty: Math.round(preset.revolutionLeaderLoyalty * 100),
      stateInfluenceMultiplier: preset.stateInfluenceMultiplier,
      suppressionConversionChance: Math.round(preset.suppressionConversionChance * 100),
      targetedSuppressionChance: Math.round(preset.targetedSuppressionChance * 100),
      initialLeaderSupportPercent: roundToOne(preset.initialLeaderSupportPercent * 100),
      initialLeaderSupportRadius: preset.initialLeaderSupportRadius,
      stateVictoryHoldSteps: preset.stateVictoryHoldSteps
    };
  }

  function startSimulation() {
    if (!simulationRef.current || simulationRef.current.finished) {
      createNewSimulation();
    }

    setIsRunning(true);
  }

  function pauseSimulation() {
    setIsRunning(false);
  }

  function resetSimulation() {
    setIsRunning(false);
    createNewSimulation();
  }

  async function runBatchTests() {
    setIsRunning(false);
    setBatchRunning(true);
    setBatchResults([]);
    setBatchSummary(null);

    const testsCount = Math.max(1, Number(form.batchTestsCount));
    const maxSteps = Math.max(1000, Number(form.batchMaxSteps));
    const results = [];

    for (let testNumber = 1; testNumber <= testsCount; testNumber++) {
      const simulation = new Simulation(createSettingsFromForm());
      let stepsDone = 0;

      setBatchProgress({ current: testNumber, total: testsCount, steps: 0 });

      while (!simulation.finished && stepsDone < maxSteps) {
        const chunkSize = 1500;
        const nextLimit = Math.min(stepsDone + chunkSize, maxSteps);

        while (!simulation.finished && stepsDone < nextLimit) {
          simulation.step();
          stepsDone += 1;
        }

        setBatchProgress({ current: testNumber, total: testsCount, steps: stepsDone });
        await delay(0);
      }

      const result = collectBatchResult(testNumber, simulation, maxSteps);
      results.push(result);
      setBatchResults([...results]);
      await delay(0);
    }

    setBatchSummary(createBatchSummary(results));
    setBatchProgress(null);
    setBatchRunning(false);
  }

  function collectBatchResult(testNumber, simulation, maxSteps) {
    const statistics = simulation.getStatistics();
    const winnerName = simulation.finished && statistics.winnerCamp
      ? statistics.winnerCamp.name
      : 'Не завершилась';

    return {
      testNumber,
      winnerName,
      steps: simulation.stepNumber,
      collisions: simulation.collisionsCount,
      transitions: simulation.transitionsCount,
      suppressions: simulation.suppressionCount,
      reason: simulation.finished ? simulation.finishReason : `Достигнут лимит ${maxSteps} шагов`,
      distribution: statistics.camps.map((camp) => `${camp.name}: ${camp.percent}%`).join(' | ')
    };
  }

  function createBatchSummary(results) {
    const wins = results.reduce((summary, result) => {
      summary[result.winnerName] = (summary[result.winnerName] || 0) + 1;
      return summary;
    }, {});

    const averageSteps = Math.round(
      results.reduce((sum, result) => sum + result.steps, 0) / results.length
    );

    const finishedCount = results.filter((result) => result.winnerName !== 'Не завершилась').length;

    return {
      testsCount: results.length,
      finishedCount,
      averageSteps,
      wins
    };
  }

  function getBatchRows() {
    return [
      ['№', 'Победитель', 'Шаги', 'Столкновения', 'Переходы', 'Подавления', 'Причина', 'Финальное распределение'],
      ...batchResults.map((result) => [
        result.testNumber,
        result.winnerName,
        result.steps,
        result.collisions,
        result.transitions,
        result.suppressions,
        result.reason,
        result.distribution
      ])
    ];
  }

  async function copyBatchResults() {
    if (batchResults.length === 0) return;
    const text = getBatchRows().map((row) => row.join('\t')).join('\n');
    await navigator.clipboard.writeText(text);
  }

  function downloadBatchCsv() {
    if (batchResults.length === 0) return;

    const rows = [
      ['Параметр', 'Значение'],
      ['Дата экспорта', new Date().toLocaleString('ru-RU')],
      ['Количество людей', form.peopleCount],
      ['Количество лагерей', form.campsCount],
      ['Баланс модели', BALANCE_PRESETS[form.balancePreset]?.label ?? form.balancePreset],
      ['Цель революционного лагеря, %', form.revolutionVictoryPercent],
      ['Интервал появления лидера, шагов', form.leaderSpawnInterval],
      ['Верность лидера, %', form.revolutionLeaderLoyalty],
      ['Бонус влияния государства', form.stateInfluenceMultiplier],
      ['Эффективность подавления, %', form.suppressionConversionChance],
      ['Точность подавления, %', form.targetedSuppressionChance],
      ['Первичная поддержка лидера, %', form.initialLeaderSupportPercent],
      ['Удержание победы государства, шагов', form.stateVictoryHoldSteps],
      [],
      ['Итоги серии'],
      ['Всего тестов', batchSummary?.testsCount ?? batchResults.length],
      ['Завершились победой', batchSummary?.finishedCount ?? ''],
      ['Среднее число шагов', batchSummary?.averageSteps ?? ''],
      ...Object.entries(batchSummary?.wins ?? {}).map(([winner, count]) => [winner, count]),
      [],
      ...getBatchRows()
    ];

    downloadTextFile(
      `revolution-results-${createTimestampForFileName()}.csv`,
      '\ufeff' + rowsToCsv(rows),
      'text/csv;charset=utf-8'
    );
  }

  function downloadBatchJson() {
    if (batchResults.length === 0) return;

    const payload = {
      exportedAt: new Date().toISOString(),
      settings: form,
      preset: BALANCE_PRESETS[form.balancePreset] ?? null,
      summary: batchSummary,
      results: batchResults
    };

    downloadTextFile(
      `revolution-results-${createTimestampForFileName()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
  }

  function downloadCurrentSimulationJson() {
    const simulation = simulationRef.current;
    if (!simulation || !stats) return;

    const payload = {
      exportedAt: new Date().toISOString(),
      settings: form,
      preset: BALANCE_PRESETS[form.balancePreset] ?? null,
      statistics: stats,
      finished: simulation.finished,
      winner: stats.winnerCamp?.name ?? null,
      finishReason: stats.finishReason ?? null
    };

    downloadTextFile(
      `revolution-current-${createTimestampForFileName()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
  }

  return (
    <main className="page">
      <section className="header">
        <div>
          <h1>Симуляция политических лагерей</h1>
          <p>
            Агенты перемещаются по полю, сталкиваются и могут менять лагерь под влиянием других агентов.
            Революционный лагерь побеждает при достижении заданного процента граждан. Государство побеждает, если возвращает
            всех обычных граждан и оставляет лидеров революции без сторонников.
          </p>
        </div>
      </section>

      <section className="layout">
        <aside className="panel">
          <h2>Параметры</h2>

          <label>
            Количество людей
            <input
              type="number"
              name="peopleCount"
              min="20"
              max="1000"
              value={form.peopleCount}
              onChange={handleChange}
              disabled={isRunning || batchRunning}
            />
          </label>

          <label>
            Количество лагерей
            <input
              type="number"
              name="campsCount"
              min="2"
              max="5"
              value={form.campsCount}
              onChange={handleChange}
              disabled={isRunning || batchRunning}
            />
          </label>

          <label>
            Цель революционного лагеря, %
            <input
              type="number"
              name="revolutionVictoryPercent"
              min="50"
              max="90"
              step="1"
              value={form.revolutionVictoryPercent}
              onChange={handleChange}
              disabled={isRunning || batchRunning}
            />
          </label>

          <label>
            Баланс модели
            <select
              name="balancePreset"
              value={form.balancePreset}
              onChange={handleChange}
              disabled={isRunning || batchRunning}
            >
              {Object.entries(BALANCE_PRESETS).map(([key, preset]) => (
                <option value={key} key={key}>{preset.label}</option>
              ))}
            </select>
          </label>

          <label>
            Скорость симуляции
            <input
              type="range"
              name="speedMultiplier"
              min="1"
              max="20"
              step="1"
              value={form.speedMultiplier}
              onChange={handleChange}
              disabled={batchRunning}
            />
            <span>{form.speedMultiplier}x</span>
          </label>

          <details className="advanced-details">
            <summary>Дополнительные параметры</summary>

            <label>
              Интервал появления лидера, шагов
              <input
                type="number"
                name="leaderSpawnInterval"
                min="60"
                max="1000"
                step="10"
                value={form.leaderSpawnInterval}
                onChange={handleChange}
                disabled={isRunning || batchRunning}
              />
            </label>

            <label>
              Фиксированная верность лидера, %
              <input
                type="number"
                name="revolutionLeaderLoyalty"
                min="60"
                max="98"
                step="1"
                value={form.revolutionLeaderLoyalty}
                onChange={handleChange}
                disabled={isRunning || batchRunning}
              />
            </label>

            <label>
              Бонус влияния государства
              <input
                type="number"
                name="stateInfluenceMultiplier"
                min="0.8"
                max="1.3"
                step="0.01"
                value={form.stateInfluenceMultiplier}
                onChange={handleChange}
                disabled={isRunning || batchRunning}
              />
            </label>

            <label>
              Эффективность подавления, %
              <input
                type="number"
                name="suppressionConversionChance"
                min="0"
                max="80"
                step="1"
                value={form.suppressionConversionChance}
                onChange={handleChange}
                disabled={isRunning || batchRunning}
              />
            </label>

            <label>
              Точность подавления, %
              <input
                type="number"
                name="targetedSuppressionChance"
                min="0"
                max="100"
                step="1"
                value={form.targetedSuppressionChance}
                onChange={handleChange}
                disabled={isRunning || batchRunning}
              />
            </label>

            <label>
              Первичная поддержка лидера, %
              <input
                type="number"
                name="initialLeaderSupportPercent"
                min="0"
                max="10"
                step="0.1"
                value={form.initialLeaderSupportPercent}
                onChange={handleChange}
                disabled={isRunning || batchRunning}
              />
            </label>

            <label>
              Радиус первичной поддержки
              <input
                type="number"
                name="initialLeaderSupportRadius"
                min="20"
                max="160"
                step="5"
                value={form.initialLeaderSupportRadius}
                onChange={handleChange}
                disabled={isRunning || batchRunning}
              />
            </label>

            <label>
              Удержание победы государства, шагов
              <input
                type="number"
                name="stateVictoryHoldSteps"
                min="0"
                max="3000"
                step="50"
                value={form.stateVictoryHoldSteps}
                onChange={handleChange}
                disabled={isRunning || batchRunning}
              />
            </label>
          </details>

          <div className="preset-box">
            <strong>{BALANCE_PRESETS[form.balancePreset].label}</strong>
            <span>{BALANCE_PRESETS[form.balancePreset].description}</span>
          </div>

          <details className="rules-details">
            <summary>Правила модели</summary>

            <div className="rules-box">
              <strong>Верность гражданина</strong>
              <span>15-35%: переход 65%, влияние 20%</span>
              <span>35-55%: переход 45%, влияние 35%</span>
              <span>55-75%: переход 25%, влияние 50%</span>
              <span>75-95%: переход 10%, влияние 60%</span>
              <span>У лидеров революции верность фиксированная и зависит от выбранного баланса.</span>
              <span>Неуязвимость лидера: 300 шагов, примерно 5 секунд при скорости 1x.</span>
            </div>

            <div className="rules-box">
              <strong>Условия победы</strong>
              <span>Революционный лагерь побеждает, если набрал заданный процент граждан.</span>
              <span>Государство побеждает, если все обычные граждане вернулись в государственный лагерь, а у лидеров революции не осталось сторонников.</span>
              <span>Цели начинают отслеживаться только после появления всех лидеров революции.</span>
            </div>
          </details>

          <div className="buttons">
            <button onClick={startSimulation} disabled={isRunning || batchRunning}>Старт</button>
            <button onClick={pauseSimulation} disabled={!isRunning || batchRunning}>Пауза</button>
            <button onClick={resetSimulation} disabled={batchRunning}>Сброс</button>
          </div>
        </aside>

        <section className="workspace">
          <div className="canvas-wrapper">
            <div className="fps-counter">FPS: {isRunning ? fps : 0}</div>

            <canvas
              ref={canvasRef}
              width="900"
              height="560"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
            />

            {hoverInfo && (
              <div
                className="person-tooltip"
                style={{ left: hoverInfo.tooltipX, top: hoverInfo.tooltipY }}
              >
                <strong>Гражданин #{hoverInfo.id}</strong>
                <span>{hoverInfo.isLeader ? 'Лидер революции' : 'Обычный гражданин'}</span>
                <span>Лагерь: {hoverInfo.campName}</span>
                <span>Верность: {hoverInfo.loyalty}% ({hoverInfo.loyaltyGroup})</span>
                <span>Шанс перехода: {hoverInfo.switchChance}%</span>
                <span>Шанс переубеждения: {hoverInfo.influenceChance}%</span>
                {hoverInfo.baseInfluenceChance !== hoverInfo.influenceChance && (
                  <span>Базовое влияние: {hoverInfo.baseInfluenceChance}%</span>
                )}
                {hoverInfo.isInvulnerable && (
                  <span>Неуязвим еще: {hoverInfo.invulnerabilityStepsLeft} шагов</span>
                )}
              </div>
            )}
          </div>

          {stats && (
            <div className="stats">
              <div className="stats-header">
                <h2>Статистика</h2>
                <button type="button" className="secondary-button" onClick={downloadCurrentSimulationJson}>
                  Сохранить текущую симуляцию JSON
                </button>
              </div>

              <div className="stats-grid">
                <span>FPS: {isRunning ? fps : 0}</span>
                <span>Шаг: {stats.stepNumber}</span>
                <span>Столкновения: {stats.collisionsCount}</span>
                <span>Переходы: {stats.transitionsCount}</span>
                <span>Подавления: {stats.suppressionCount}</span>
                <span>Цели: {stats.goalsActive ? 'отслеживаются' : 'ожидание всех лидеров'}</span>
                <span>Статус: {stats.finished ? 'завершена' : 'идет / ожидает запуска'}</span>
                <span>Средняя верность: {stats.averages.loyalty}%</span>
                <span>Средний шанс перехода: {stats.averages.switchChance}%</span>
                <span>Среднее влияние: {stats.averages.influenceChance}%</span>
                <span>Задержка победы государства: {stats.stateVictoryGraceSteps} шагов</span>
                <span>Удержание победы государства: {stats.stateVictoryHoldSteps} шагов</span>
                <span>Прогресс государства: {stats.stateVictoryProgress}% обычных граждан</span>
                <span>Максимальная революционная доля: {stats.maxRevolutionShare}%</span>
                <span>Антикризис государства: {stats.stateHighCrisis ? 'жесткий' : (stats.stateCrisis ? 'активен' : 'не активен')}</span>
                <span>Подавление: R{stats.effectiveSuppressionRadius}, {stats.effectiveSuppressionInterval} шагов, эффективность {stats.suppressionConversionChance}%</span>
                <span>Первичная поддержка лидера: {stats.initialLeaderSupportPercent}% в радиусе {stats.initialLeaderSupportRadius}px</span>
              </div>

              {stats.finished && stats.winnerCamp && (
                <p className="winner">
                  Победил лагерь: {stats.winnerCamp.name}. {stats.finishReason}
                </p>
              )}

              <div className="camp-list">
                {stats.camps.map((camp) => (
                  <div className="camp-row" key={camp.id}>
                    <span className="camp-color" style={{ backgroundColor: camp.color }} />
                    <span>{camp.name}</span>
                    <strong>{camp.supportersCount} чел. ({camp.percent}%)</strong>
                    <em>{camp.isActive ? (camp.id === 0 ? 'цель: обычные граждане' : `цель ${camp.goalPercent}%`) : 'не активен'}</em>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="stats batch-panel">
            <h2>Серия тестов</h2>
            <p className="section-note">
              Инструмент запускает несколько симуляций подряд с текущими параметрами и фиксирует победителя, число шагов и финальное распределение лагерей.
            </p>

            <div className="batch-controls">
              <label>
                Количество тестов
                <input
                  type="number"
                  name="batchTestsCount"
                  min="1"
                  max="200"
                  value={form.batchTestsCount}
                  onChange={handleChange}
                  disabled={isRunning || batchRunning}
                />
              </label>

              <label>
                Максимум шагов на тест
                <input
                  type="number"
                  name="batchMaxSteps"
                  min="1000"
                  step="1000"
                  value={form.batchMaxSteps}
                  onChange={handleChange}
                  disabled={isRunning || batchRunning}
                />
              </label>

              <button onClick={runBatchTests} disabled={isRunning || batchRunning}>
                {batchRunning ? 'Тесты выполняются...' : 'Запустить серию тестов'}
              </button>
            </div>

            {batchProgress && (
              <p className="batch-progress">
                Выполняется тест {batchProgress.current} из {batchProgress.total}, шагов в текущем тесте: {batchProgress.steps}
              </p>
            )}

            {batchSummary && (
              <div className="batch-summary">
                <strong>Итоги серии</strong>
                <span>Всего тестов: {batchSummary.testsCount}</span>
                <span>Завершились победой: {batchSummary.finishedCount}</span>
                <span>Среднее число шагов: {batchSummary.averageSteps}</span>
                {Object.entries(batchSummary.wins).map(([winner, count]) => (
                  <span key={winner}>{winner}: {count}</span>
                ))}
              </div>
            )}

            {batchResults.length > 0 && (
              <>
                <div className="batch-actions">
                  <button type="button" onClick={copyBatchResults} disabled={batchRunning}>
                    Скопировать результаты таблицей
                  </button>
                  <button type="button" onClick={downloadBatchCsv} disabled={batchRunning}>
                    Скачать CSV
                  </button>
                  <button type="button" onClick={downloadBatchJson} disabled={batchRunning}>
                    Скачать JSON
                  </button>
                </div>

                <div className="batch-table-wrapper">
                  <table className="batch-table">
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Победитель</th>
                        <th>Шаги</th>
                        <th>Переходы</th>
                        <th>Подавления</th>
                        <th>Финальное распределение</th>
                        <th>Причина завершения</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map((result) => (
                        <tr key={result.testNumber}>
                          <td>{result.testNumber}</td>
                          <td>{result.winnerName}</td>
                          <td>{result.steps}</td>
                          <td>{result.transitions}</td>
                          <td>{result.suppressions}</td>
                          <td>{result.distribution}</td>
                          <td>{result.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundToOne(value) {
  return Math.round(value * 10) / 10;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(';')).join('\n');
}

function csvEscape(value) {
  if (value === undefined || value === null) return '';

  const text = String(value);
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadTextFile(fileName, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function createTimestampForFileName() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export default App;
