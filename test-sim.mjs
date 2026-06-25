import { Simulation } from './src/models/Simulation.js';
import { SimulationSettings } from './src/models/SimulationSettings.js';

const runs = Number(process.argv[2] || 20);
const maxSteps = Number(process.argv[3] || 100000);
let results = {};
let steps = [];
for (let r = 0; r < runs; r++) {
  const sim = new Simulation(new SimulationSettings());
  for (let i = 0; i < maxSteps && !sim.finished; i++) sim.step();
  const winner = sim.finished ? sim.camps[sim.winnerCampId].name : 'not finished';
  results[winner] = (results[winner] || 0) + 1;
  steps.push(sim.stepNumber);
}
console.log(results);
console.log('avg steps', Math.round(steps.reduce((a,b)=>a+b,0)/steps.length), 'min', Math.min(...steps), 'max', Math.max(...steps));
