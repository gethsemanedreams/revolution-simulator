export class Person {
  constructor(id, x, y, vx, vy, campId, loyalty, radius) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.campId = campId;
    this.radius = radius;
    this.isLeader = false;
    this.leaderInvulnerableUntilStep = 0;

    this.setLoyalty(loyalty);
  }

  isInvulnerableAtStep(stepNumber) {
    return this.isLeader && stepNumber < this.leaderInvulnerableUntilStep;
  }

  setLoyalty(loyalty) {
    this.loyalty = loyalty;

    const politicalTraits = getPoliticalTraitsByLoyalty(loyalty);
    this.switchChance = politicalTraits.switchChance;
    this.influenceChance = politicalTraits.influenceChance;
    this.loyaltyGroup = politicalTraits.loyaltyGroup;
  }

  move(width, height) {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x - this.radius <= 0 || this.x + this.radius >= width) {
      this.vx *= -1;
      this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
    }

    if (this.y - this.radius <= 0 || this.y + this.radius >= height) {
      this.vy *= -1;
      this.y = Math.max(this.radius, Math.min(height - this.radius, this.y));
    }
  }

  distanceTo(otherPerson) {
    const dx = this.x - otherPerson.x;
    const dy = this.y - otherPerson.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  collidesWith(otherPerson) {
    return this.distanceTo(otherPerson) <= this.radius + otherPerson.radius;
  }

  distanceToPoint(x, y) {
    const dx = this.x - x;
    const dy = this.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  changeCamp(newCampId) {
    this.campId = newCampId;
    this.isLeader = false;
    this.leaderInvulnerableUntilStep = 0;
  }

  becomeLeader(newCampId, leaderLoyalty, currentStep = 0, invulnerabilitySteps = 0) {
    this.campId = newCampId;
    this.isLeader = true;
    this.setLoyalty(leaderLoyalty);
    this.leaderInvulnerableUntilStep = currentStep + invulnerabilitySteps;
  }
}

function getPoliticalTraitsByLoyalty(loyalty) {
  if (loyalty < 0.35) {
    return {
      loyaltyGroup: '15-35%',
      switchChance: 0.65,
      influenceChance: 0.2
    };
  }

  if (loyalty < 0.55) {
    return {
      loyaltyGroup: '35-55%',
      switchChance: 0.45,
      influenceChance: 0.35
    };
  }

  if (loyalty < 0.75) {
    return {
      loyaltyGroup: '55-75%',
      switchChance: 0.25,
      influenceChance: 0.5
    };
  }

  return {
    loyaltyGroup: '75-95%',
    switchChance: 0.1,
    influenceChance: 0.6
  };
}
