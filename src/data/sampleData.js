export const customers = [
  { id: 'C001', name: 'James Wilson', email: 'james.wilson@email.com', phone: '(555) 234-5678', address: '142 Oak Street, Austin, TX 78701', vehicles: ['V001', 'V002'], totalSpent: 4280.50, visits: 8 },
  { id: 'C002', name: 'Maria Garcia', email: 'maria.garcia@email.com', phone: '(555) 345-6789', address: '89 Elm Avenue, Austin, TX 78702', vehicles: ['V003'], totalSpent: 1650.00, visits: 3 },
  { id: 'C003', name: 'Robert Chen', email: 'robert.chen@email.com', phone: '(555) 456-7890', address: '2201 Pine Road, Austin, TX 78703', vehicles: ['V004'], totalSpent: 3120.75, visits: 6 },
  { id: 'C004', name: 'Sarah Thompson', email: 'sarah.t@email.com', phone: '(555) 567-8901', address: '567 Maple Dr, Austin, TX 78704', vehicles: ['V005', 'V006'], totalSpent: 5890.25, visits: 12 },
  { id: 'C005', name: 'David Kim', email: 'david.kim@email.com', phone: '(555) 678-9012', address: '1100 Cedar Blvd, Austin, TX 78705', vehicles: ['V007'], totalSpent: 920.00, visits: 2 },
];

export const vehicles = [
  { id: 'V001', customerId: 'C001', vin: '1HGCM82633A004352', year: 2020, make: 'Honda', model: 'Accord', trim: 'EX-L', engine: '1.5L Turbo I4', transmission: 'CVT', color: 'Crystal Black Pearl', mileage: 42350, plate: 'ABC-1234' },
  { id: 'V002', customerId: 'C001', vin: '5YJSA1E26MF123456', year: 2021, make: 'Tesla', model: 'Model S', trim: 'Long Range', engine: 'Electric Dual Motor', transmission: 'Single-Speed', color: 'Pearl White', mileage: 28100, plate: 'EV-5678' },
  { id: 'V003', customerId: 'C002', vin: '1FTFW1ET5EKE12345', year: 2022, make: 'Ford', model: 'F-150', trim: 'XLT', engine: '2.7L EcoBoost V6', transmission: '10-Speed Auto', color: 'Iconic Silver', mileage: 18500, plate: 'TRK-9012' },
  { id: 'V004', customerId: 'C003', vin: 'WBA5A7C55ED123456', year: 2019, make: 'BMW', model: '530i', trim: 'M Sport', engine: '2.0L Turbo I4', transmission: '8-Speed Auto', color: 'Alpine White', mileage: 55200, plate: 'BMW-3456' },
  { id: 'V005', customerId: 'C004', vin: '1G1YY22G965109876', year: 2023, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', engine: '6.2L V8', transmission: '8-Speed DCT', color: 'Torch Red', mileage: 8900, plate: 'VET-7890' },
  { id: 'V006', customerId: 'C004', vin: 'JTDKN3DU5A0123456', year: 2021, make: 'Toyota', model: 'Camry', trim: 'SE', engine: '2.5L I4', transmission: '8-Speed Auto', color: 'Midnight Black', mileage: 35600, plate: 'CAM-1234' },
  { id: 'V007', customerId: 'C005', vin: '3VW447AU1MM123456', year: 2022, make: 'Volkswagen', model: 'Jetta', trim: 'SEL', engine: '1.5L Turbo I4', transmission: '8-Speed Auto', color: 'Silk Blue', mileage: 22100, plate: 'VW-5678' },
];

export const estimates = [
  { id: 'EST-001', customerId: 'C001', vehicleId: 'V001', status: 'approved', date: '2026-04-01', items: [
    { description: 'Brake Pad Replacement (Front)', partsCost: 85.00, laborCost: 120.00, qty: 1 },
    { description: 'Brake Rotor Resurface (Front)', partsCost: 0, laborCost: 80.00, qty: 2 },
    { description: 'Brake Fluid Flush', partsCost: 15.00, laborCost: 45.00, qty: 1 },
  ], notes: 'Customer reported squealing noise when braking.' },
  { id: 'EST-002', customerId: 'C002', vehicleId: 'V003', status: 'pending', date: '2026-04-03', items: [
    { description: 'Oil Change - Full Synthetic', partsCost: 45.00, laborCost: 35.00, qty: 1 },
    { description: 'Cabin Air Filter', partsCost: 22.00, laborCost: 15.00, qty: 1 },
    { description: 'Engine Air Filter', partsCost: 18.00, laborCost: 10.00, qty: 1 },
    { description: 'Tire Rotation', partsCost: 0, laborCost: 25.00, qty: 1 },
  ], notes: 'Routine maintenance - 20K mile service.' },
  { id: 'EST-003', customerId: 'C003', vehicleId: 'V004', status: 'in_progress', date: '2026-04-04', items: [
    { description: 'Alternator Replacement', partsCost: 320.00, laborCost: 180.00, qty: 1 },
    { description: 'Serpentine Belt', partsCost: 35.00, laborCost: 0, qty: 1 },
    { description: 'Battery Test & Clean Terminals', partsCost: 5.00, laborCost: 25.00, qty: 1 },
  ], notes: 'Vehicle not starting - diagnosed as alternator failure.' },
  { id: 'EST-004', customerId: 'C004', vehicleId: 'V005', status: 'draft', date: '2026-04-05', items: [
    { description: 'Ceramic Coating Application', partsCost: 150.00, laborCost: 400.00, qty: 1 },
    { description: 'Paint Correction - Stage 2', partsCost: 80.00, laborCost: 350.00, qty: 1 },
    { description: 'Interior Detail', partsCost: 25.00, laborCost: 150.00, qty: 1 },
  ], notes: 'Full detail and ceramic coating package.' },
  { id: 'EST-005', customerId: 'C004', vehicleId: 'V006', status: 'completed', date: '2026-03-28', items: [
    { description: 'Transmission Fluid Change', partsCost: 65.00, laborCost: 95.00, qty: 1 },
    { description: 'Coolant Flush', partsCost: 30.00, laborCost: 60.00, qty: 1 },
  ], notes: 'Scheduled maintenance at 35K miles.' },
];

export const invoices = [
  { id: 'INV-001', estimateId: 'EST-005', customerId: 'C004', vehicleId: 'V006', status: 'paid', issueDate: '2026-03-28', dueDate: '2026-04-11', paidDate: '2026-03-30', paymentMethod: 'Credit Card', subtotal: 250.00, tax: 20.63, total: 270.63 },
  { id: 'INV-002', estimateId: 'EST-001', customerId: 'C001', vehicleId: 'V001', status: 'sent', issueDate: '2026-04-01', dueDate: '2026-04-15', paidDate: null, paymentMethod: null, subtotal: 425.00, tax: 35.06, total: 460.06 },
  { id: 'INV-003', estimateId: null, customerId: 'C005', vehicleId: 'V007', status: 'overdue', issueDate: '2026-03-15', dueDate: '2026-03-29', paidDate: null, paymentMethod: null, subtotal: 920.00, tax: 75.90, total: 995.90 },
  { id: 'INV-004', estimateId: null, customerId: 'C003', vehicleId: 'V004', status: 'draft', issueDate: '2026-04-06', dueDate: '2026-04-20', paidDate: null, paymentMethod: null, subtotal: 565.00, tax: 46.61, total: 611.61 },
];

export const partsCategories = [
  { id: 'brakes', name: 'Brakes', icon: 'disc' },
  { id: 'engine', name: 'Engine', icon: 'cog' },
  { id: 'suspension', name: 'Suspension', icon: 'spring' },
  { id: 'electrical', name: 'Electrical', icon: 'zap' },
  { id: 'exhaust', name: 'Exhaust', icon: 'wind' },
  { id: 'cooling', name: 'Cooling', icon: 'thermometer' },
  { id: 'transmission', name: 'Transmission', icon: 'settings' },
  { id: 'body', name: 'Body & Exterior', icon: 'car' },
  { id: 'interior', name: 'Interior', icon: 'armchair' },
  { id: 'filters', name: 'Filters', icon: 'filter' },
];

export const partsCatalog = [
  { id: 'P001', name: 'Front Brake Pad Set', category: 'brakes', partNumber: 'BP-HND-2020-F', price: 85.00, brand: 'Akebono', fits: ['Honda Accord 2018-2023'], inStock: 12 },
  { id: 'P002', name: 'Front Brake Rotor', category: 'brakes', partNumber: 'BR-HND-2020-F', price: 65.00, brand: 'Brembo', fits: ['Honda Accord 2018-2023'], inStock: 8 },
  { id: 'P003', name: 'Rear Brake Pad Set', category: 'brakes', partNumber: 'BP-HND-2020-R', price: 72.00, brand: 'Akebono', fits: ['Honda Accord 2018-2023'], inStock: 15 },
  { id: 'P004', name: 'Alternator Assembly', category: 'electrical', partNumber: 'ALT-BMW-530-19', price: 320.00, brand: 'Bosch', fits: ['BMW 530i 2017-2021'], inStock: 3 },
  { id: 'P005', name: 'Serpentine Belt', category: 'engine', partNumber: 'SB-BMW-530-19', price: 35.00, brand: 'Gates', fits: ['BMW 530i 2017-2021', 'BMW 540i 2017-2021'], inStock: 20 },
  { id: 'P006', name: 'Cabin Air Filter', category: 'filters', partNumber: 'CAF-FRD-F150-22', price: 22.00, brand: 'Mann-Filter', fits: ['Ford F-150 2021-2024'], inStock: 30 },
  { id: 'P007', name: 'Engine Air Filter', category: 'filters', partNumber: 'EAF-FRD-F150-22', price: 18.00, brand: 'K&N', fits: ['Ford F-150 2021-2024'], inStock: 25 },
  { id: 'P008', name: 'Synthetic Motor Oil 5W-30 (5qt)', category: 'engine', partNumber: 'OIL-SYN-5W30', price: 45.00, brand: 'Mobil 1', fits: ['Universal'], inStock: 50 },
  { id: 'P009', name: 'Transmission Fluid (1qt)', category: 'transmission', partNumber: 'TF-ATF-WS', price: 12.00, brand: 'Toyota Genuine', fits: ['Toyota Camry 2018-2024'], inStock: 40 },
  { id: 'P010', name: 'Coolant 50/50 Premix (1gal)', category: 'cooling', partNumber: 'CLT-UNI-5050', price: 15.00, brand: 'Zerex', fits: ['Universal'], inStock: 35 },
  { id: 'P011', name: 'Spark Plug Set (4pc)', category: 'engine', partNumber: 'SP-VW-JET-22', price: 48.00, brand: 'NGK', fits: ['Volkswagen Jetta 2019-2024'], inStock: 18 },
  { id: 'P012', name: 'Ignition Coil', category: 'electrical', partNumber: 'IC-VW-JET-22', price: 55.00, brand: 'Bosch', fits: ['Volkswagen Jetta 2019-2024'], inStock: 10 },
  { id: 'P013', name: 'Front Strut Assembly', category: 'suspension', partNumber: 'FS-CHV-COR-23', price: 195.00, brand: 'Bilstein', fits: ['Chevrolet Corvette 2020-2024'], inStock: 4 },
  { id: 'P014', name: 'Control Arm (Lower Front)', category: 'suspension', partNumber: 'CA-BMW-530-19', price: 145.00, brand: 'Lemforder', fits: ['BMW 530i 2017-2021'], inStock: 6 },
  { id: 'P015', name: 'Headlight Assembly (Driver)', category: 'body', partNumber: 'HL-TSL-MS-21-L', price: 890.00, brand: 'OEM Tesla', fits: ['Tesla Model S 2020-2023'], inStock: 2 },
];

export const wiringDiagrams = [
  { id: 'WD001', title: 'Engine Control Module Wiring', vehicle: 'Honda Accord 2018-2023', category: 'Engine', pages: 12, format: 'PDF', size: '4.2 MB' },
  { id: 'WD002', title: 'ABS / Brake System Wiring', vehicle: 'Honda Accord 2018-2023', category: 'Brakes', pages: 8, format: 'PDF', size: '2.8 MB' },
  { id: 'WD003', title: 'HVAC System Wiring', vehicle: 'Honda Accord 2018-2023', category: 'Climate', pages: 6, format: 'PDF', size: '1.9 MB' },
  { id: 'WD004', title: 'Infotainment & Audio Wiring', vehicle: 'Honda Accord 2018-2023', category: 'Electrical', pages: 10, format: 'PDF', size: '3.5 MB' },
  { id: 'WD005', title: 'High-Voltage Battery System', vehicle: 'Tesla Model S 2020-2023', category: 'Electrical', pages: 24, format: 'PDF', size: '8.1 MB' },
  { id: 'WD006', title: 'Drive Unit & Inverter Wiring', vehicle: 'Tesla Model S 2020-2023', category: 'Drivetrain', pages: 16, format: 'PDF', size: '5.6 MB' },
  { id: 'WD007', title: 'Charging System Wiring', vehicle: 'Tesla Model S 2020-2023', category: 'Electrical', pages: 8, format: 'PDF', size: '2.4 MB' },
  { id: 'WD008', title: 'EcoBoost Engine Wiring', vehicle: 'Ford F-150 2021-2024', category: 'Engine', pages: 14, format: 'PDF', size: '4.8 MB' },
  { id: 'WD009', title: 'Trailer Tow Wiring', vehicle: 'Ford F-150 2021-2024', category: 'Electrical', pages: 6, format: 'PDF', size: '1.7 MB' },
  { id: 'WD010', title: 'Transfer Case / 4WD Wiring', vehicle: 'Ford F-150 2021-2024', category: 'Drivetrain', pages: 10, format: 'PDF', size: '3.2 MB' },
  { id: 'WD011', title: 'N63 Engine Wiring', vehicle: 'BMW 530i 2017-2021', category: 'Engine', pages: 18, format: 'PDF', size: '6.2 MB' },
  { id: 'WD012', title: 'iDrive / CAN Bus Wiring', vehicle: 'BMW 530i 2017-2021', category: 'Electrical', pages: 22, format: 'PDF', size: '7.4 MB' },
];

export const serviceManuals = [
  { id: 'SM001', title: 'Complete Service Manual', vehicle: 'Honda Accord 2018-2023', category: 'General', pages: 1450, format: 'PDF', size: '125 MB' },
  { id: 'SM002', title: 'Body Repair Manual', vehicle: 'Honda Accord 2018-2023', category: 'Body', pages: 320, format: 'PDF', size: '48 MB' },
  { id: 'SM003', title: 'Owners Workshop Manual', vehicle: 'Ford F-150 2021-2024', category: 'General', pages: 890, format: 'PDF', size: '95 MB' },
  { id: 'SM004', title: 'Electrical Troubleshooting Manual', vehicle: 'BMW 530i 2017-2021', category: 'Electrical', pages: 540, format: 'PDF', size: '72 MB' },
  { id: 'SM005', title: 'Collision Repair Procedures', vehicle: 'Tesla Model S 2020-2023', category: 'Body', pages: 280, format: 'PDF', size: '52 MB' },
  { id: 'SM006', title: 'High-Voltage Safety & Service', vehicle: 'Tesla Model S 2020-2023', category: 'Electrical', pages: 180, format: 'PDF', size: '34 MB' },
  { id: 'SM007', title: 'Transmission Overhaul Guide', vehicle: 'Toyota Camry 2018-2024', category: 'Transmission', pages: 210, format: 'PDF', size: '38 MB' },
  { id: 'SM008', title: 'TSB Collection 2024', vehicle: 'Volkswagen Jetta 2019-2024', category: 'General', pages: 150, format: 'PDF', size: '22 MB' },
];

export const vinDatabase = {
  '1HGCM82633A004352': { year: 2020, make: 'Honda', model: 'Accord', trim: 'EX-L', engine: '1.5L Turbo I4 (192hp)', transmission: 'CVT Automatic', drivetrain: 'FWD', bodyStyle: 'Sedan', fuelType: 'Gasoline', manufacturingPlant: 'Marysville, OH', country: 'United States' },
  '5YJSA1E26MF123456': { year: 2021, make: 'Tesla', model: 'Model S', trim: 'Long Range', engine: 'Dual Motor Electric (670hp)', transmission: 'Single-Speed Fixed Gear', drivetrain: 'AWD', bodyStyle: 'Sedan', fuelType: 'Electric', manufacturingPlant: 'Fremont, CA', country: 'United States' },
  '1FTFW1ET5EKE12345': { year: 2022, make: 'Ford', model: 'F-150', trim: 'XLT', engine: '2.7L EcoBoost V6 (325hp)', transmission: '10-Speed Automatic', drivetrain: '4WD', bodyStyle: 'Crew Cab Pickup', fuelType: 'Gasoline', manufacturingPlant: 'Dearborn, MI', country: 'United States' },
  'WBA5A7C55ED123456': { year: 2019, make: 'BMW', model: '530i', trim: 'M Sport', engine: '2.0L TwinPower Turbo I4 (248hp)', transmission: '8-Speed Automatic', drivetrain: 'RWD', bodyStyle: 'Sedan', fuelType: 'Gasoline', manufacturingPlant: 'Dingolfing', country: 'Germany' },
  '1G1YY22G965109876': { year: 2023, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray 3LT', engine: '6.2L LT2 V8 (490hp)', transmission: '8-Speed Dual Clutch', drivetrain: 'RWD', bodyStyle: 'Coupe', fuelType: 'Gasoline', manufacturingPlant: 'Bowling Green, KY', country: 'United States' },
  'JTDKN3DU5A0123456': { year: 2021, make: 'Toyota', model: 'Camry', trim: 'SE', engine: '2.5L Dynamic Force I4 (203hp)', transmission: '8-Speed Automatic', drivetrain: 'FWD', bodyStyle: 'Sedan', fuelType: 'Gasoline', manufacturingPlant: 'Georgetown, KY', country: 'United States' },
  '3VW447AU1MM123456': { year: 2022, make: 'Volkswagen', model: 'Jetta', trim: 'SEL', engine: '1.5L TSI Turbo I4 (158hp)', transmission: '8-Speed Automatic', drivetrain: 'FWD', bodyStyle: 'Sedan', fuelType: 'Gasoline', manufacturingPlant: 'Puebla', country: 'Mexico' },
};

export const recentActivity = [
  { id: 1, type: 'estimate', action: 'Estimate created', detail: 'EST-004 for 2023 Corvette Stingray', time: '10 minutes ago', icon: 'file-text' },
  { id: 2, type: 'invoice', action: 'Invoice paid', detail: 'INV-001 - $270.63 via Credit Card', time: '2 hours ago', icon: 'credit-card' },
  { id: 3, type: 'vehicle', action: 'VIN decoded', detail: '2022 Ford F-150 XLT added', time: '3 hours ago', icon: 'car' },
  { id: 4, type: 'estimate', action: 'Estimate approved', detail: 'EST-001 - Brake service for Honda Accord', time: '5 hours ago', icon: 'check-circle' },
  { id: 5, type: 'customer', action: 'New customer added', detail: 'David Kim - (555) 678-9012', time: 'Yesterday', icon: 'user-plus' },
  { id: 6, type: 'parts', action: 'Parts ordered', detail: '3x Alternator Assembly for BMW 530i', time: 'Yesterday', icon: 'package' },
  { id: 7, type: 'invoice', action: 'Invoice sent', detail: 'INV-002 to James Wilson', time: '2 days ago', icon: 'send' },
];
