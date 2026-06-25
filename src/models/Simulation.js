import { Camp } from './Camp.js';
import { Person } from './Person.js';
import { SimulationSettings } from './SimulationSettings.js';

const STATE_CAMP_ID = 0;
const CAMP_COLORS = ['#4169e1', '#e53935', '#43a047', '#f9a825', '#8e24aa'];
const CAMP_NAMES = ['Государство', 'Революционный лагерь 1', 'Революционный лагерь 2', 'Революционный лагерь 3', 'Революционный лагерь 4'];

export class Simulation {
  constructor(settings = new SimulationSettings()) {
    this.settings = settings;
    this.people = [];
    this.camps = [];
    this.stepNumber = 0;
    this.collisionsCount = 0;
    this.transitionsCount = 0;
    this.suppressionCount = 0;
    this.finished = false;
    this.winnerCampId = null;
    this.finishReason = '';
    this.suppressionZone = null;
    this.goalsActivatedAtStep = null;
    this.stateVictoryCandidateStartedAtStep = null;

    this.createCamps();
    this.createPeople();
    this.updateCampStatistics();
  }

  createCamps() {
    this.camps = [];

    for (let i = 0; i < this.settings.campsCount; i++) {
      const isActive = i === STATE_CAMP_ID;
      this.camps.push(new Camp(i, CAMP_NAMES[i], CAMP_COLORS[i], isActive));
    }
  }

  createPeople() {
    this.people = [];

    for (let i = 0; i < this.settings.peopleCount; i++) {
      const x = randomBetween(this.settings.radius, this.settings.width - this.settings.radius);
      const y = randomBetween(this.settings.radius, this.settings.height - this.settings.radius);
      const speed = randomBetween(this.settings.minSpeed, this.settings.maxSpeed);
      const angle = randomBetween(0, Math.PI * 2);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const loyalty = randomBetween(this.settings.minLoyalty, this.settings.maxLoyalty);

      this.people.push(new Person(i, x, y, vx, vy, STATE_CAMP_ID, loyalty, this.settings.radius));
    }
  }

  step() {
    if (this.finished) return;

    this.stepNumber += 1;

    for (const person of this.people) {
      person.move(this.settings.width, this.settings.height);
    }

    this.trySpawnLeader();
    this.handleCollisions();
    this.updateCampStatistics();
    this.updateGoalActivationStatus();
    this.handleStateSuppression();
    this.updateCampStatistics();
    this.handleStateStabilization();
    this.handleSmallCellCleanup();
    this.updateCampStatistics();
    this.checkFinish();
  }

  trySpawnLeader() {
    if (this.stepNumber % this.settings.leaderSpawnInterval !== 0) return;

    const inactiveCamps = this.camps.filter((camp) => !camp.isActive);
    if (inactiveCamps.length === 0) return;
    if (Math.random() > this.settings.selfTransitionChance) return;

    // Новый революционный лидер появляется из государственного лагеря.
    // Так новые лагеря не отнимают стартовую массу у уже существующих революций.
    let possibleLeaders = this.people.filter((person) => !person.isLeader && person.campId === STATE_CAMP_ID);

    if (possibleLeaders.length === 0) {
      possibleLeaders = this.people.filter((person) => !person.isLeader);
    }
    if (possibleLeaders.length === 0) return;

    const newCamp = inactiveCamps[0];
    const newLeader = randomItem(possibleLeaders);

    newLeader.becomeLeader(
      newCamp.id,
      this.settings.revolutionLeaderLoyalty,
      this.stepNumber,
      this.settings.leaderInvulnerabilitySteps
    );
    newCamp.activate(newLeader.id);
    this.transitionsCount += 1;
    this.createInitialLeaderSupport(newLeader, newCamp.id);
  }


  createInitialLeaderSupport(leader, campId) {
    if (!this.settings.initialLeaderSupportEnabled) return;

    const desiredSupportCount = clamp(
      Math.round(this.people.length * this.settings.initialLeaderSupportPercent),
      this.settings.initialLeaderSupportMin,
      this.settings.initialLeaderSupportMax
    );

    if (desiredSupportCount <= 0) return;

    const candidates = this.people
      .filter((person) => {
        if (person.id === leader.id) return false;
        if (person.isLeader) return false;
        if (person.campId !== STATE_CAMP_ID) return false;
        return person.distanceToPoint(leader.x, leader.y) <= this.settings.initialLeaderSupportRadius;
      })
      .sort((first, second) => (
        first.distanceToPoint(leader.x, leader.y) - second.distanceToPoint(leader.x, leader.y)
      ));

    // Если рядом мало людей, берем ближайших государственных граждан по всему полю.
    if (candidates.length < desiredSupportCount) {
      const additionalCandidates = this.people
        .filter((person) => {
          if (person.id === leader.id) return false;
          if (person.isLeader) return false;
          if (person.campId !== STATE_CAMP_ID) return false;
          return !candidates.includes(person);
        })
        .sort((first, second) => (
          first.distanceToPoint(leader.x, leader.y) - second.distanceToPoint(leader.x, leader.y)
        ));

      candidates.push(...additionalCandidates);
    }

    let convertedCount = 0;

    for (const person of candidates) {
      if (convertedCount >= desiredSupportCount) break;
      if (Math.random() > this.settings.initialLeaderSupportChance) continue;

      person.changeCamp(campId);
      this.transitionsCount += 1;
      convertedCount += 1;
    }
  }

  handleCollisions() {
    const cellSize = this.settings.radius * 4;
    const grid = new Map();

    for (const person of this.people) {
      const cellX = Math.floor(person.x / cellSize);
      const cellY = Math.floor(person.y / cellSize);
      const key = `${cellX}:${cellY}`;

      if (!grid.has(key)) {
        grid.set(key, []);
      }

      grid.get(key).push(person);
    }

    for (const first of this.people) {
      const cellX = Math.floor(first.x / cellSize);
      const cellY = Math.floor(first.y / cellSize);

      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          const key = `${cellX + offsetX}:${cellY + offsetY}`;
          const candidates = grid.get(key);

          if (!candidates) continue;

          for (const second of candidates) {
            if (second.id <= first.id) continue;
            this.handleCollisionPair(first, second);
          }
        }
      }
    }
  }

  handleCollisionPair(first, second) {
    if (!first.collidesWith(second)) return;

    this.collisionsCount += 1;
    this.separatePeople(first, second);

    if (first.campId === second.campId) return;

    this.tryConvert(first, second);
    this.tryConvert(second, first);
  }

  separatePeople(first, second) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const overlap = first.radius + second.radius - distance;

    if (overlap <= 0) return;

    const shiftX = (dx / distance) * (overlap / 2);
    const shiftY = (dy / distance) * (overlap / 2);

    first.x -= shiftX;
    first.y -= shiftY;
    second.x += shiftX;
    second.y += shiftY;

    first.vx *= -1;
    first.vy *= -1;
    second.vx *= -1;
    second.vy *= -1;
  }

  tryConvert(target, influencer) {
    if (target.campId === influencer.campId) return;

    const targetCamp = this.camps[target.campId];

    // Новый лидер революции временно неуязвим после появления.
    if (this.isPersonInvulnerable(target)) return;

    // Лидер не меняет лагерь, пока у него есть хотя бы один сторонник кроме него самого.
    if (target.isLeader && targetCamp.supportersCount > 1) return;

    const influenceChance = this.getEffectiveInfluenceChance(influencer);
    const switchChance = target.switchChance;

    let chance = (switchChance + influenceChance) / 2;

    // Государство получает административный бонус при переубеждении.
    if (influencer.campId === STATE_CAMP_ID) {
      chance *= this.settings.stateInfluenceMultiplier;
    }

    chance = clamp(chance, 0, 0.95);

    if (Math.random() <= chance) {
      target.changeCamp(influencer.campId);
      this.transitionsCount += 1;
    }
  }

  getEffectiveInfluenceChance(influencer) {
    let influenceChance = influencer.influenceChance;

    if (influencer.isLeader) {
      influenceChance = clamp(
        influenceChance + this.settings.leaderInfluenceBonus,
        0,
        this.settings.maxLeaderInfluenceChance
      );
    }

    if (this.settings.revolutionMomentumEnabled && influencer.campId !== STATE_CAMP_ID) {
      influenceChance += this.getRevolutionMomentumBonus(influencer.campId);
    }

    return clamp(influenceChance, 0, 0.85);
  }

  getRevolutionMomentumBonus(campId) {
    const camp = this.camps[campId];
    if (!camp) return 0;

    const share = camp.supportersCount / this.people.length;

    if (share >= 0.6) return 0.22;
    if (share >= 0.45) return 0.16;
    if (share >= 0.3) return 0.1;
    if (share >= 0.15) return 0.05;

    return 0;
  }

  handleStateSuppression() {
    if (!this.settings.suppressionEnabled) return;
    if (!this.areAllRevolutionLeadersActive()) return;
    if (this.goalsActivatedAtStep === null) return;
    if (this.stepNumber - this.goalsActivatedAtStep < this.settings.suppressionStartDelay) return;

    const interval = this.getEffectiveSuppressionInterval();

    if (!this.suppressionZone && this.stepNumber % interval === 0) {
      this.createSuppressionZone();
    }

    if (!this.suppressionZone) return;

    this.applySuppressionZone();

    this.suppressionZone.remainingSteps -= 1;
    if (this.suppressionZone.remainingSteps <= 0) {
      this.suppressionZone = null;
    }
  }

  createSuppressionZone() {
    const radius = this.getEffectiveSuppressionRadius();
    const target = this.findSuppressionTarget();

    const shouldTargetOpposition = Math.random() <= this.getEffectiveTargetedSuppressionChance();
    const centerX = shouldTargetOpposition && target
      ? target.x + randomBetween(-radius / 2, radius / 2)
      : randomBetween(radius, this.settings.width - radius);
    const centerY = shouldTargetOpposition && target
      ? target.y + randomBetween(-radius / 2, radius / 2)
      : randomBetween(radius, this.settings.height - radius);

    this.suppressionZone = {
      x: clamp(centerX, radius, this.settings.width - radius),
      y: clamp(centerY, radius, this.settings.height - radius),
      radius,
      remainingSteps: this.settings.suppressionDuration,
      duration: this.settings.suppressionDuration,
      hasAppliedPulse: false,
      affectedCount: 0
    };

    this.suppressionCount += 1;
  }

  findSuppressionTarget() {
    const oppositionCitizens = this.people.filter((person) => person.campId !== STATE_CAMP_ID && !person.isLeader);
    if (oppositionCitizens.length > 0) {
      return randomItem(oppositionCitizens);
    }

    const oppositionLeaders = this.people.filter((person) => person.campId !== STATE_CAMP_ID && person.isLeader);
    if (oppositionLeaders.length > 0) {
      return randomItem(oppositionLeaders);
    }

    return null;
  }

  applySuppressionZone() {
    if (this.suppressionZone.hasAppliedPulse) return;

    for (const person of this.people) {
      if (person.campId === STATE_CAMP_ID) continue;

      // Подавление не действует напрямую на лидеров революции.
      if (person.isLeader) continue;

      const isInsideZone = person.distanceToPoint(this.suppressionZone.x, this.suppressionZone.y) <= this.suppressionZone.radius;
      if (!isInsideZone) continue;

      this.suppressionZone.affectedCount += 1;

      // Попадание в зону подавления теперь не гарантирует переход.
      // Это снижает перекос в пользу государства и оставляет место случайности.
      if (Math.random() <= this.getEffectiveSuppressionConversionChance()) {
        person.changeCamp(STATE_CAMP_ID);
        this.transitionsCount += 1;
      }
    }

    this.suppressionZone.hasAppliedPulse = true;
  }


  getMaxRevolutionShare() {
    if (this.people.length === 0) return 0;

    return this.camps
      .slice(1)
      .reduce((maxShare, camp) => Math.max(maxShare, camp.supportersCount / this.people.length), 0);
  }

  isStateInCrisis() {
    if (!this.settings.stateCrisisResponseEnabled) return false;
    return this.getMaxRevolutionShare() >= this.settings.stateCrisisShareThreshold;
  }

  isStateInHighCrisis() {
    if (!this.settings.stateCrisisResponseEnabled) return false;
    return this.getMaxRevolutionShare() >= this.settings.stateHighCrisisShareThreshold;
  }

  getEffectiveSuppressionRadius() {
    let radius = this.settings.getEffectiveSuppressionRadius();

    if (this.isStateInHighCrisis()) {
      radius += 28;
    } else if (this.isStateInCrisis()) {
      radius += 16;
    }

    return radius;
  }

  getEffectiveSuppressionInterval() {
    let interval = this.settings.getEffectiveSuppressionInterval();

    if (this.isStateInHighCrisis()) {
      interval = Math.round(interval * 0.62);
    } else if (this.isStateInCrisis()) {
      interval = Math.round(interval * 0.78);
    }

    return Math.max(180, interval);
  }

  getEffectiveSuppressionConversionChance() {
    let chance = this.settings.suppressionConversionChance;

    if (this.isStateInHighCrisis()) {
      chance += 0.15;
    } else if (this.isStateInCrisis()) {
      chance += 0.08;
    }

    return clamp(chance, 0, 0.75);
  }

  getEffectiveTargetedSuppressionChance() {
    let chance = this.settings.targetedSuppressionChance;

    if (this.isStateInHighCrisis()) {
      chance += 0.2;
    } else if (this.isStateInCrisis()) {
      chance += 0.1;
    }

    return clamp(chance, 0, 0.9);
  }

  handleStateStabilization() {
    if (!this.settings.stateStabilizationEnabled) return;
    if (!this.areAllRevolutionLeadersActive()) return;
    if (this.goalsActivatedAtStep === null) return;
    if (this.stepNumber - this.goalsActivatedAtStep < this.settings.suppressionStartDelay) return;
    if (this.stepNumber % this.settings.stateStabilizationInterval !== 0) return;

    const chance = this.isStateInCrisis()
      ? this.settings.stateCrisisStabilizationChance
      : this.settings.stateStabilizationChance;

    for (const person of this.people) {
      if (person.isLeader) continue;
      if (person.campId === STATE_CAMP_ID) continue;

      // Чем ниже верность текущему лагерю, тем выше шанс вернуться к государству.
      const loyaltyFactor = 1.15 - person.loyalty;
      const finalChance = clamp(chance * loyaltyFactor, 0, 0.12);

      if (Math.random() <= finalChance) {
        person.changeCamp(STATE_CAMP_ID);
        this.transitionsCount += 1;
      }
    }
  }

  handleSmallCellCleanup() {
    if (!this.settings.smallCellCleanupEnabled) return;
    if (!this.areAllRevolutionLeadersActive()) return;
    if (this.goalsActivatedAtStep === null) return;
    if (this.stepNumber - this.goalsActivatedAtStep < this.settings.stateVictoryGraceSteps) return;
    if (this.stepNumber % this.settings.smallCellCleanupInterval !== 0) return;

    for (const camp of this.camps.slice(1)) {
      const ordinarySupporters = this.people.filter((person) => (
        !person.isLeader && person.campId === camp.id
      ));

      if (ordinarySupporters.length === 0) continue;
      if (ordinarySupporters.length > this.settings.smallCellCleanupMaxSupporters) continue;

      for (const person of ordinarySupporters) {
        const chance = this.isStateInCrisis()
          ? this.settings.smallCellCleanupConversionChance + 0.15
          : this.settings.smallCellCleanupConversionChance;

        if (Math.random() <= clamp(chance, 0, 0.9)) {
          person.changeCamp(STATE_CAMP_ID);
          this.transitionsCount += 1;
        }
      }
    }
  }


  updateCampStatistics() {
    for (const camp of this.camps) {
      const count = this.people.filter((person) => person.campId === camp.id).length;
      camp.setSupportersCount(count);
    }
  }

  areAllRevolutionLeadersActive() {
    return this.camps.slice(1).every((camp) => camp.isActive && camp.leaderId !== null);
  }

  updateGoalActivationStatus() {
    if (this.goalsActivatedAtStep !== null) return;
    if (this.areAllRevolutionLeadersActive()) {
      this.goalsActivatedAtStep = this.stepNumber;
    }
  }

  canStateWinNow() {
    return this.goalsActivatedAtStep !== null
      && this.stepNumber - this.goalsActivatedAtStep >= this.settings.stateVictoryGraceSteps;
  }

  checkFinish() {
    if (!this.areAllRevolutionLeadersActive()) return;

    const revolutionWinner = this.camps
      .slice(1)
      .find((camp) => (camp.supportersCount / this.people.length) * 100 >= this.settings.revolutionVictoryPercent);

    if (revolutionWinner) {
      this.finishWithWinner(
        revolutionWinner.id,
        `Революционный лагерь достиг ${this.settings.revolutionVictoryPercent}% граждан.`
      );
      return;
    }

    if (this.canStateWinNow() && this.hasStateWon()) {
      if (this.stateVictoryCandidateStartedAtStep === null) {
        this.stateVictoryCandidateStartedAtStep = this.stepNumber;
      }

      if (this.stepNumber - this.stateVictoryCandidateStartedAtStep >= this.settings.stateVictoryHoldSteps) {
        this.finishWithWinner(
          STATE_CAMP_ID,
          `Государство удержало контроль над обычными гражданами ${this.settings.stateVictoryHoldSteps} шагов подряд.`
        );
      }

      return;
    }

    this.stateVictoryCandidateStartedAtStep = null;
  }

  hasStateWon() {
    const allOrdinaryCitizensInState = this.people.every((person) => person.isLeader || person.campId === STATE_CAMP_ID);
    const allRevolutionLeadersHaveNoSupporters = this.camps.slice(1).every((camp) => camp.supportersCount <= 1);

    return allOrdinaryCitizensInState && allRevolutionLeadersHaveNoSupporters;
  }

  finishWithWinner(campId, reason) {
    this.finished = true;
    this.winnerCampId = campId;
    this.finishReason = reason;
  }

  isPersonInvulnerable(person) {
    return person.isInvulnerableAtStep(this.stepNumber);
  }

  getPersonAtPoint(x, y) {
    for (let i = this.people.length - 1; i >= 0; i--) {
      const person = this.people[i];
      const hitRadius = person.radius + 7;
      if (person.distanceToPoint(x, y) <= hitRadius) {
        return person;
      }
    }

    return null;
  }

  getPersonDetails(person) {
    if (!person) return null;

    const camp = this.camps[person.campId];
    const effectiveInfluenceChance = this.getEffectiveInfluenceChance(person);
    const invulnerabilityStepsLeft = person.isLeader
      ? Math.max(0, person.leaderInvulnerableUntilStep - this.stepNumber)
      : 0;

    return {
      id: person.id,
      campId: person.campId,
      campName: camp?.name ?? 'Неизвестный лагерь',
      campColor: camp?.color ?? '#000000',
      isLeader: person.isLeader,
      isInvulnerable: this.isPersonInvulnerable(person),
      invulnerabilityStepsLeft,
      loyalty: Math.round(person.loyalty * 100),
      loyaltyGroup: person.loyaltyGroup,
      switchChance: Math.round(person.switchChance * 100),
      baseInfluenceChance: Math.round(person.influenceChance * 100),
      influenceChance: Math.round(effectiveInfluenceChance * 100)
    };
  }

  getStatistics() {
    const goalsActive = this.areAllRevolutionLeadersActive();
    const averageLoyalty = this.people.reduce((sum, person) => sum + person.loyalty, 0) / this.people.length;
    const averageSwitchChance = this.people.reduce((sum, person) => sum + person.switchChance, 0) / this.people.length;
    const averageInfluenceChance = this.people.reduce((sum, person) => sum + person.influenceChance, 0) / this.people.length;
    const ordinaryCitizensCount = this.people.filter((person) => !person.isLeader).length;
    const ordinaryStateCitizensCount = this.people.filter((person) => !person.isLeader && person.campId === STATE_CAMP_ID).length;

    return {
      stepNumber: this.stepNumber,
      collisionsCount: this.collisionsCount,
      transitionsCount: this.transitionsCount,
      suppressionCount: this.suppressionCount,
      finished: this.finished,
      goalsActive,
      goalsActivatedAtStep: this.goalsActivatedAtStep,
      stateVictoryGraceSteps: this.settings.stateVictoryGraceSteps,
      stateVictoryHoldSteps: this.settings.stateVictoryHoldSteps,
      stateVictoryCandidateStartedAtStep: this.stateVictoryCandidateStartedAtStep,
      leaderInvulnerabilitySteps: this.settings.leaderInvulnerabilitySteps,
      suppressionStartDelay: this.settings.suppressionStartDelay,
      finishReason: this.finishReason,
      winnerCamp: this.winnerCampId !== null ? this.camps[this.winnerCampId] : null,
      suppressionZone: this.suppressionZone,
      effectiveSuppressionRadius: this.getEffectiveSuppressionRadius(),
      effectiveSuppressionInterval: this.getEffectiveSuppressionInterval(),
      suppressionConversionChance: Math.round(this.getEffectiveSuppressionConversionChance() * 100),
      targetedSuppressionChance: Math.round(this.getEffectiveTargetedSuppressionChance() * 100),
      stateCrisis: this.isStateInCrisis(),
      stateHighCrisis: this.isStateInHighCrisis(),
      maxRevolutionShare: Math.round(this.getMaxRevolutionShare() * 100),
      stateStabilizationChance: Math.round(this.settings.stateStabilizationChance * 1000) / 10,
      stateCrisisStabilizationChance: Math.round(this.settings.stateCrisisStabilizationChance * 1000) / 10,
      smallCellCleanupMaxSupporters: this.settings.smallCellCleanupMaxSupporters,
      initialLeaderSupportRadius: this.settings.initialLeaderSupportRadius,
      initialLeaderSupportPercent: Math.round(this.settings.initialLeaderSupportPercent * 1000) / 10,
      stateVictoryProgress: ordinaryCitizensCount > 0
        ? Math.round((ordinaryStateCitizensCount / ordinaryCitizensCount) * 100)
        : 100,
      averages: {
        loyalty: Math.round(averageLoyalty * 100),
        switchChance: Math.round(averageSwitchChance * 100),
        influenceChance: Math.round(averageInfluenceChance * 100)
      },
      camps: this.camps.map((camp) => ({
        id: camp.id,
        name: camp.name,
        color: camp.color,
        isActive: camp.isActive,
        leaderId: camp.leaderId,
        supportersCount: camp.supportersCount,
        percent: Math.round((camp.supportersCount / this.people.length) * 100),
        goalPercent: camp.id === STATE_CAMP_ID
          ? this.settings.stateVictoryPercent
          : this.settings.revolutionVictoryPercent
      }))
    };
  }
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
