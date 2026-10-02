// A stand-in for api.nhtsa.gov in browser tests: recalls, owner complaints and the model list in
// NHTSA's own response format. The reports are made up for testing; they are not real complaints.
const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const COMPLAINTS = {
  'FORD|F-150': [
    [2018, 'ENGINE', 'THE CONTACT OWNS A 2018 FORD F-150. WHILE DRIVING, THE ENGINE MISFIRED AND THE CHECK ENGINE LIGHT ILLUMINATED. THE DEALER FOUND A FAILED IGNITION COIL ON CYLINDER 2 AND REPLACED IT. THE FAILURE MILEAGE WAS 82,000.'],
    [2018, 'ENGINE,ELECTRICAL SYSTEM', 'ROUGH IDLE AND MISFIRE WHEN COLD. CODES P0302 AND P0305 WERE STORED. THE IGNITION COIL AND SPARK PLUGS WERE REPLACED. THE FAILURE MILEAGE WAS 91,500.'],
    [2017, 'ENGINE', 'THE VEHICLE STUMBLED ON ACCELERATION AND THE CHECK ENGINE LIGHT FLASHED. THE MECHANIC DIAGNOSED A FAILED IGNITION COIL. THE FAILURE MILEAGE WAS 88,000.'],
    [2019, 'ENGINE', 'ENGINE RATTLE ON COLD START LASTING A FEW SECONDS. THE DEALER REPLACED THE CAM PHASER AND TIMING CHAIN. THE FAILURE MILEAGE WAS 70,000.'],
    [2018, 'ENGINE', 'COLD START RATTLE FROM THE ENGINE. DIAGNOSED AS CAM PHASER FAILURE. THE FAILURE MILEAGE WAS 65,000.'],
    [2018, 'POWER TRAIN', 'THE TRANSMISSION SHIFTED HARSH FROM SECOND TO THIRD GEAR AND THE VEHICLE LURCHED FORWARD. THE FAILURE MILEAGE WAS 40,000.', { crash: true }],
    [2019, 'POWER TRAIN', 'HARSH DOWNSHIFT WHEN SLOWING DOWN. THE TRANSMISSION WAS REPROGRAMMED BY THE DEALER. THE FAILURE MILEAGE WAS 30,000.'],
    [2017, 'POWER TRAIN', 'THE TRANSMISSION SLIPPED AND SHIFTED HARSH WHILE DRIVING ON THE HIGHWAY.'],
    [2018, 'SERVICE BRAKES', 'THE BRAKE PEDAL WENT TO THE FLOOR WHILE STOPPING. THE MASTER CYLINDER WAS REPLACED. THE FAILURE MILEAGE WAS 52,000.'],
    [2019, 'SERVICE BRAKES', 'BRAKE PEDAL SANK TO THE FLOOR AND THE VEHICLE WAS DIFFICULT TO STOP. THE MASTER CYLINDER WAS REPLACED.'],
    [2018, 'ELECTRICAL SYSTEM', 'THE BATTERY DRAINED OVERNIGHT SEVERAL TIMES. THE DEALER COULD NOT DUPLICATE THE FAILURE.'],
    [2017, 'STRUCTURE', 'THE TAILGATE OPENED WHILE DRIVING.'],
  ],
};
const RECALLS = {
  'FORD|F-150|2018': [
    ['18V000101', '15/02/2018', 'SERVICE BRAKES, HYDRAULIC:FOUNDATION COMPONENTS:MASTER CYLINDER', 'BRAKE FLUID MAY LEAK FROM THE MASTER CYLINDER INTO THE BRAKE BOOSTER, REDUCING BRAKING PERFORMANCE.', 'INCREASED STOPPING DISTANCE, INCREASING THE RISK OF A CRASH.', 'DEALERS WILL REPLACE THE MASTER CYLINDER, FREE OF CHARGE.'],
    ['18V000202', '01/06/2018', 'ENGINE AND ENGINE COOLING:ENGINE:GASOLINE', 'AN IGNITION COIL MAY FAIL, CAUSING A MISFIRE AND REDUCED ENGINE POWER.', 'A MISFIRE CAN CAUSE A LOSS OF POWER, INCREASING THE RISK OF A CRASH.', 'DEALERS WILL REPLACE THE IGNITION COILS, FREE OF CHARGE.'],
    ['18V000303', '20/09/2018', 'SEAT BELTS:FRONT', 'THE FRONT SEAT BELT ANCHOR MAY NOT BE PROPERLY SECURED.', 'AN UNSECURED SEAT BELT INCREASES THE RISK OF INJURY IN A CRASH.', 'DEALERS WILL INSPECT AND REPAIR THE ANCHOR.'],
  ],
};

/**
 * Route api.nhtsa.gov for a browser context. `calls` collects every URL asked for; `fail` (a
 * function of the URL) makes a request fail like a network error.
 */
export async function routeNhtsa(ctx, { calls = [], fail = () => false } = {}) {
  await ctx.route('https://api.nhtsa.gov/**', (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname + url.search);
    if (fail(url)) return route.abort('failed');
    const make = (url.searchParams.get('make') || '').toUpperCase();
    const model = (url.searchParams.get('model') || '').toUpperCase();
    const year = Number(url.searchParams.get('modelYear'));
    if (url.pathname === '/products/vehicle/models') return route.fulfill(json({ count: 1, message: 'ok', results: [{ modelYear: String(year), make, model: make === 'FORD' ? 'F-150' : url.searchParams.get('model') || 'CIVIC' }] }));
    if (url.pathname === '/recalls/recallsByVehicle') {
      const list = RECALLS[`${make}|${model}|${year}`] || [];
      return route.fulfill(json({ Count: list.length, Message: 'Results returned successfully', results: list.map(([NHTSACampaignNumber, ReportReceivedDate, Component, Summary, Consequence, Remedy]) => ({ Manufacturer: 'Test Motor Co.', NHTSACampaignNumber, ReportReceivedDate, Component, Summary, Consequence, Remedy, Notes: '', ModelYear: String(year), Make: make, Model: model, parkIt: false, parkOutSide: false, overTheAirUpdate: false })) }));
    }
    if (url.pathname === '/complaints/complaintsByVehicle') {
      const list = (COMPLAINTS[`${make}|${model}`] || []).filter(([y]) => y === year);
      return route.fulfill(json({ count: list.length, message: 'Results returned successfully', results: list.map(([, components, summary, extra = {}], i) => ({ odiNumber: year * 1000 + i, manufacturer: 'Test Motor Co.', crash: Boolean(extra.crash), fire: false, numberOfInjuries: 0, numberOfDeaths: 0, dateOfIncident: `0${(i % 9) + 1}/10/${year + 1}`, dateComplaintFiled: `0${(i % 9) + 1}/12/${year + 1}`, vin: '1FTEW1EP1JK', components, summary, products: [] })) }));
    }
    return route.fulfill(json({ count: 0, results: [] }));
  });
}
