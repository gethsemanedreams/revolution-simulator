export class Camp {
  constructor(id, name, color, isActive = false) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.isActive = isActive;
    this.leaderId = null;
    this.supportersCount = 0;
  }

  activate(leaderId = null) {
    this.isActive = true;
    this.leaderId = leaderId;
  }

  setSupportersCount(count) {
    this.supportersCount = count;
  }
}
