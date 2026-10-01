import EngineDiagram from './EngineDiagram';
import DrivetrainDiagram from './DrivetrainDiagram';
import { StartingChargingDiagram, NetworkDiagram, HighVoltageDiagram } from './ElectricalDiagrams';
import { EngineControlDiagram, CoolingDiagram, BrakeDiagram, DlcDiagram } from './SystemDiagrams';

/** Diagrams that apply to a vehicle profile, in the order a technician usually needs them. */
export function diagramsFor(p) {
  const hv = p.electrified && p.powertrain !== 'mhev';
  return [
    hv && { id: 'hv', label: 'High voltage', Component: HighVoltageDiagram },
    { id: 'engine', label: p.ice ? 'Engine layout' : 'Drive layout', Component: EngineDiagram },
    p.ice && { id: 'enginecontrol', label: 'Engine control', Component: EngineControlDiagram },
    { id: 'charging', label: p.ice && !hv ? 'Starting & charging' : '12 V supply', Component: StartingChargingDiagram },
    { id: 'drivetrain', label: 'Drivetrain', Component: DrivetrainDiagram },
    { id: 'cooling', label: p.ice ? 'Cooling' : 'Thermal', Component: CoolingDiagram },
    { id: 'brakes', label: 'Brakes', Component: BrakeDiagram },
    { id: 'network', label: 'Network', Component: NetworkDiagram },
    p.era.obd2 && { id: 'dlc', label: 'OBD-II connector', Component: DlcDiagram },
  ].filter(Boolean);
}
