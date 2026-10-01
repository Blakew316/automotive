// Diagram colors come from the app's tokens so diagrams follow light/dark mode; circuit colors
// follow common wiring-diagram conventions.

export const WIRE = {
  power: 'rgb(var(--bad))',
  ground: 'rgb(var(--ink-2))',
  signal: 'var(--series-1)',
  network: 'var(--series-3)',
  hv: 'var(--series-2)',
  hot: 'var(--series-2)',
  cool: 'var(--series-1)',
  fluid: 'var(--series-1)',
  fluid2: 'var(--series-3)',
  mech: 'rgb(var(--ink-3))',
};

export const LEGENDS = {
  power: { color: WIRE.power, label: 'Battery / switched power' },
  ground: { color: WIRE.ground, label: 'Ground' },
  signal: { color: WIRE.signal, label: 'Sensor / control signal' },
  network: { color: WIRE.network, label: 'Data network' },
  hv: { color: WIRE.hv, label: 'High voltage (orange cable)' },
  hot: { color: WIRE.hot, label: 'Hot coolant' },
  cool: { color: WIRE.cool, label: 'Cooled coolant' },
  fluid: { color: WIRE.fluid, label: 'Circuit A' },
  fluid2: { color: WIRE.fluid2, label: 'Circuit B' },
  mech: { color: WIRE.mech, label: 'Mechanical drive' },
};

export const CAVEAT =
  'Representative schematic generated from this vehicle’s configuration. Connector numbers, wire colors, fuse numbers and component locations are build-specific — confirm in factory service information before testing.';
