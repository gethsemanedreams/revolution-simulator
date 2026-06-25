export class SimulationSettings {
  constructor(options = {}) {
    this.width = options.width ?? 900;
    this.height = options.height ?? 560;
    this.peopleCount = options.peopleCount ?? 120;
    this.campsCount = options.campsCount ?? 3;
    this.radius = options.radius ?? 5;
    this.minSpeed = options.minSpeed ?? 0.4;
    this.maxSpeed = options.maxSpeed ?? 1.5;

    // Верность обычных граждан задается индивидуально и случайно.
    // От нее зависят шанс перехода и шанс переубедить другого агента.
    this.minLoyalty = options.minLoyalty ?? 0.15;
    this.maxLoyalty = options.maxLoyalty ?? 0.95;

    // У лидеров революции верность фиксированная, а не случайная.
    // Значение 0.8 дает лидеру устойчивость, но не делает его почти непобедимым.
    this.revolutionLeaderLoyalty = options.revolutionLeaderLoyalty ?? 0.85;

    // Бонус лидера добавляется к его влиянию, но итоговое влияние лидера ограничено.
    this.leaderInfluenceBonus = options.leaderInfluenceBonus ?? 0.14;
    this.maxLeaderInfluenceChance = options.maxLeaderInfluenceChance ?? 0.78;

    // Государство получает административный бонус при столкновениях.
    this.stateInfluenceMultiplier = options.stateInfluenceMultiplier ?? 1.03;

    // После появления лидер революции не может быть переубежден 300 шагов.
    // При скорости 1x это примерно 5 секунд визуальной симуляции.
    this.leaderInvulnerabilitySteps = options.leaderInvulnerabilitySteps ?? 300;

    // Параметры появления новых революционных лидеров.
    this.leaderSpawnInterval = options.leaderSpawnInterval ?? 180;
    this.selfTransitionChance = options.selfTransitionChance ?? 0.65;

    // Условия победы начинают проверяться только после появления всех лидеров.
    this.revolutionVictoryPercent = options.revolutionVictoryPercent ?? 70;

    // Формально цель государства - вернуть 100% обычных граждан.
    // Лидеры революции могут оставаться на поле, если у них нет сторонников.
    this.stateVictoryPercent = options.stateVictoryPercent ?? 100;

    // После появления всех лидеров государство не может победить мгновенно.
    // Это дает революционным лагерям время начать распространение.
    this.stateVictoryGraceSteps = options.stateVictoryGraceSteps ?? 1200;

    // Государство должно удерживать условие победы несколько шагов подряд.
    // Это не дает государству выигрывать от случайного короткого момента,
    // когда все обычные граждане временно оказались на его стороне.
    this.stateVictoryHoldSteps = options.stateVictoryHoldSteps ?? 700;

    // Подавление включается не в тот же шаг, когда появился последний лидер,
    // а после небольшой задержки.
    this.suppressionStartDelay = options.suppressionStartDelay ?? 300;

    // Подавление беспорядков: круг, который возвращает граждан в лагерь государства.
    this.suppressionEnabled = options.suppressionEnabled ?? true;
    this.adaptiveSuppressionEnabled = options.adaptiveSuppressionEnabled ?? true;
    this.suppressionDuration = options.suppressionDuration ?? 70;

    // Подавление теперь не гарантирует переход каждого попавшего гражданина.
    // Зона действует как один импульс: каждый обычный революционный гражданин
    // внутри зоны получает только одну проверку перехода в государство.
    this.suppressionConversionChance = options.suppressionConversionChance ?? 0.28;

    // Вероятность того, что государство разместит подавление около сторонника революции,
    // а не в случайной точке поля. Значение меньше 1 не дает подавлению быть слишком точным.
    this.targetedSuppressionChance = options.targetedSuppressionChance ?? 0.4;

    // Таблица адаптивного подавления зависит от общего количества лагерей.
    this.suppressionByCampsCount = {
      2: { radius: 70, interval: 760 },
      3: { radius: 75, interval: 820 },
      4: { radius: 80, interval: 860 },
      5: { radius: 85, interval: 900 }
    };

    // Эти значения используются только если adaptiveSuppressionEnabled = false.
    this.suppressionRadius = options.suppressionRadius ?? 75;
    this.suppressionInterval = options.suppressionInterval ?? 820;

    // При появлении лидера рядом с ним формируется первичная группа поддержки.
    // Это особенно важно при 4-5 лагерях, иначе новый лагерь рождается одним агентом
    // внутри большой государственной массы и часто гаснет до начала роста.
    this.initialLeaderSupportEnabled = options.initialLeaderSupportEnabled ?? true;
    this.initialLeaderSupportRadius = options.initialLeaderSupportRadius ?? 65;
    this.initialLeaderSupportPercent = options.initialLeaderSupportPercent ?? 0.022;
    this.initialLeaderSupportMin = options.initialLeaderSupportMin ?? 3;
    this.initialLeaderSupportMax = options.initialLeaderSupportMax ?? 14;
    this.initialLeaderSupportChance = options.initialLeaderSupportChance ?? 0.75;



    // Антикризисная реакция государства включается только тогда,
    // когда один из революционных лагерей становится близок к победе.
    // Это повышает шанс государства на камбэк, но не душит революцию с самого начала.
    this.stateCrisisResponseEnabled = options.stateCrisisResponseEnabled ?? true;
    this.stateCrisisShareThreshold = options.stateCrisisShareThreshold ?? 0.45;
    this.stateHighCrisisShareThreshold = options.stateHighCrisisShareThreshold ?? 0.6;

    // Пассивная стабилизация: часть обычных революционных граждан
    // периодически может вернуться в лагерь государства без столкновения.
    this.stateStabilizationEnabled = options.stateStabilizationEnabled ?? true;
    this.stateStabilizationInterval = options.stateStabilizationInterval ?? 260;
    this.stateStabilizationChance = options.stateStabilizationChance ?? 0.006;
    this.stateCrisisStabilizationChance = options.stateCrisisStabilizationChance ?? 0.018;

    // Зачистка малых очагов нужна, чтобы государство могло завершить победу,
    // а не гоняться бесконечно за 1-3 одиночными сторонниками у каждого лидера.
    this.smallCellCleanupEnabled = options.smallCellCleanupEnabled ?? true;
    this.smallCellCleanupInterval = options.smallCellCleanupInterval ?? 180;
    this.smallCellCleanupMaxSupporters = options.smallCellCleanupMaxSupporters ?? 2;
    this.smallCellCleanupConversionChance = options.smallCellCleanupConversionChance ?? 0.5;

    // Если революционный лагерь уже набрал заметную поддержку,
    // его влияние усиливается: это помогает модели не застревать в вечной фрагментации.
    this.revolutionMomentumEnabled = options.revolutionMomentumEnabled ?? true;
  }

  getEffectiveSuppressionRadius() {
    if (!this.adaptiveSuppressionEnabled) {
      return this.suppressionRadius;
    }

    return this.suppressionByCampsCount[this.campsCount]?.radius ?? this.suppressionRadius;
  }

  getEffectiveSuppressionInterval() {
    if (!this.adaptiveSuppressionEnabled) {
      return this.suppressionInterval;
    }

    return this.suppressionByCampsCount[this.campsCount]?.interval ?? this.suppressionInterval;
  }
}
