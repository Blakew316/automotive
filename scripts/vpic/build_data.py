#!/usr/bin/env python3
"""Build the site's offline vehicle data from the NHTSA vPIC database.

Input:  vpic.lite.db (SQLite build of NHTSA's public-domain vPIC database, as distributed in
        the ISC-licensed @cardog/corgi package: dist/db/vpic.lite.db.gz).
Output: public/data/
          vehicles/index.json        makes, with model names and year ranges (catalog home + search)
          vehicles/<make-slug>.json  per make: models -> VIN schemas -> VIN-code rows with attributes
          vin/wmi/<WMI>.json         per World Manufacturer Identifier: everything needed to decode
                                     a VIN of that manufacturer entirely in the browser

Usage:  python3 scripts/vpic/build_data.py path/to/vpic.lite.db public/data
"""
import collections
import json
import os
import re
import shutil
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
from vpiclib import parse_key  # noqa: E402

MAX_YEAR = 2027
CATALOG_TYPES = {2: 'Passenger Car', 3: 'Truck', 7: 'MPV', 10: 'Incomplete'}

# Element id -> short field name used in the JSON files.
FIELDS = {
    28: 'model', 34: 'series', 38: 'trim', 5: 'body', 14: 'doors', 15: 'drive',
    9: 'cyl', 13: 'dispL', 11: 'dispCC', 18: 'eng', 64: 'engCfg', 24: 'fuel', 66: 'fuel2',
    135: 'turbo', 71: 'hp', 21: 'kw', 37: 'trans', 126: 'elec', 2: 'batt', 59: 'kwh',
    134: 'kwhTo', 72: 'evdu', 127: 'charger', 42: 'brake', 25: 'gvwr', 190: 'gvwrTo',
    129: 'engInfo', 146: 'engMfr', 75: 'plantCountry', 31: 'plantCity', 77: 'plantState',
    76: 'plantCo',
}
PLANT_FIELDS = {'plantCountry', 'plantCity', 'plantState', 'plantCo'}


def slugify(s):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s or 'make'


def tidy(v):
    if v is None:
        return None
    s = str(v).strip()
    if not s or s in ('Not Applicable', '0', '0.0'):
        return None
    if re.fullmatch(r'\d+\.\d+', s):
        s = s.rstrip('0').rstrip('.') if '.' in s else s
    return s


def title(s):
    """Upper-case vPIC strings -> readable title case (keeps short acronyms)."""
    if s is None or re.search(r'[a-z]', s):
        return s
    keep = {'USA', 'UK', 'LLC', 'INC', 'GMBH', 'AG', 'SA', 'NA', 'CO', 'LTD', 'BMW', 'GMC', 'MINI', 'KTM', 'DS', 'MG', 'BYD', 'RAM', 'SRT', 'AMG'}
    words = re.split(r'(\s+|-|/)', s.lower())
    return ''.join(w.upper() if w.upper() in keep else (w[:1].upper() + w[1:]) for w in words)


def main(db_path, out_dir):
    c = sqlite3.connect(db_path)
    c.row_factory = sqlite3.Row

    elements = {r['Id']: r for r in c.execute('SELECT Id, Name, LookupTable FROM Element')}
    lookup = {}
    for table in {r['LookupTable'] for r in elements.values() if r['LookupTable']}:
        try:
            lookup[table] = {str(r[0]): r[1] for r in c.execute(f'SELECT Id, Name FROM "{table}"')}
        except sqlite3.Error:
            lookup[table] = {}

    def resolve(element_id, attr):
        table = elements[element_id]['LookupTable'] if element_id in elements else None
        if table and table in lookup:
            return lookup[table].get(str(attr), attr)
        return attr

    makes = {r['Id']: r['Name'] for r in c.execute('SELECT Id, Name FROM Make')}
    model_makes = collections.defaultdict(set)
    for r in c.execute('SELECT MakeId, ModelId FROM Make_Model'):
        model_makes[r['ModelId']].add(r['MakeId'])
    countries = {r['Id']: r['Name'] for r in c.execute('SELECT Id, Name FROM Country')}
    manufacturers = {r['Id']: r['Name'] for r in c.execute('SELECT Id, Name FROM Manufacturer')}
    vtypes = {r['Id']: r['Name'] for r in c.execute('SELECT Id, Name FROM VehicleType')}
    schema_names = {r['Id']: r['Name'] for r in c.execute('SELECT Id, Name FROM VinSchema')}

    wmis = {}
    for r in c.execute('SELECT Id, Wmi, ManufacturerId, MakeId, VehicleTypeId, CountryId FROM Wmi'):
        wmis[r['Id']] = dict(r)
    wmi_makes = collections.defaultdict(set)
    for r in c.execute('SELECT WmiId, MakeId FROM Wmi_Make'):
        wmi_makes[r['WmiId']].add(r['MakeId'])
    links = collections.defaultdict(list)  # schema -> [(wmiId, yf, yt)]
    wmi_links = collections.defaultdict(list)  # wmiId -> [(schema, yf, yt)]
    for r in c.execute('SELECT WmiId, VinSchemaId, YearFrom, YearTo FROM Wmi_VinSchema'):
        yt = r['YearTo'] if r['YearTo'] is not None else MAX_YEAR
        yt = min(yt, MAX_YEAR)
        yf = max(r['YearFrom'] or 1980, 1980)
        links[r['VinSchemaId']].append((r['WmiId'], yf, yt))
        wmi_links[r['WmiId']].append((r['VinSchemaId'], yf, yt))

    patterns = collections.defaultdict(list)  # schema -> [(key, field, value)]
    for r in c.execute('SELECT VinSchemaId, Keys, ElementId, AttributeId FROM Pattern'):
        field = FIELDS.get(r['ElementId'])
        if not field:
            continue
        val = tidy(resolve(r['ElementId'], r['AttributeId']))
        if val is None:
            continue
        if field == 'model':
            val = (int(r['AttributeId']), val)
        patterns[r['VinSchemaId']].append((r['Keys'], field, val))

    # A WMI can cover several makes (1C4 = Chrysler, Dodge, Jeep), so VIN shards carry the make
    # alongside each model: Make_Model, narrowed to the makes of the WMIs that use the schema.
    def model_make(model_id, schema_id):
        mm = model_makes.get(model_id, set())
        wm = set()
        for wid, _, _ in links.get(schema_id, []):
            wm |= wmi_makes.get(wid, set()) or {wmis[wid]['MakeId']}
        chosen = (mm & wm) or mm or wm
        names = sorted(makes[m] for m in chosen if m in makes)
        return title(names[0]) if names else None

    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(os.path.join(out_dir, 'vehicles'))
    os.makedirs(os.path.join(out_dir, 'vin', 'wmi'))

    # ---------------------------------------------------------------- VIN decode shards (all WMIs)
    # Shards are keyed by the first three VIN characters. Small manufacturers (third character '9')
    # use six-character WMIs: VIN positions 1-3 plus 12-14, so their shard holds several entries.
    field_names = list(FIELDS.values())
    field_index = {f: i for i, f in enumerate(field_names)}
    by_shard = collections.defaultdict(lambda: collections.defaultdict(list))
    for wid, w in wmis.items():
        code = (w['Wmi'] or '').upper()
        if not re.fullmatch(r'[A-HJ-NPR-Z0-9]{3}([A-HJ-NPR-Z0-9]{3})?', code):
            continue
        by_shard[code[:3]][code].append(wid)
    shard_count = 0
    for shard, codes in by_shard.items():
        values, vindex = [], {}

        def vid(v):
            token = json.dumps(v)
            if token not in vindex:
                vindex[token] = len(values)
                values.append(v)
            return vindex[token]

        entries = {}
        schema_ids = set()
        for code, wids in codes.items():
            out = []
            for wid in wids:
                w = wmis[wid]
                mk = sorted({makes.get(m) for m in wmi_makes.get(wid, {w['MakeId']}) if makes.get(m)})
                out.append({
                    'make': [title(m) for m in mk],
                    'mfr': title(manufacturers.get(w['ManufacturerId'])),
                    'country': title(countries.get(w['CountryId'])),
                    'type': vtypes.get(w['VehicleTypeId']),
                    's': sorted([[sid, yf, yt] for sid, yf, yt in wmi_links.get(wid, [])]),
                })
                schema_ids.update(sid for sid, _, _ in wmi_links.get(wid, []))
            entries[code] = out
        schemas = {}
        for sid in sorted(schema_ids):
            grouped = collections.OrderedDict()
            for key, field, val in patterns.get(sid, []):
                if isinstance(val, tuple):
                    val = [val[0], val[1], model_make(val[0], sid)]
                grouped.setdefault(key, []).extend([field_index[field], vid(val)])
            schemas[sid] = {'n': schema_names.get(sid), 'p': [[k, *fv] for k, fv in grouped.items()]}
        with open(os.path.join(out_dir, 'vin', 'wmi', f'{shard}.json'), 'w') as f:
            json.dump({'shard': shard, 'f': field_names, 'v': values, 'w': entries, 's': schemas}, f, separators=(',', ':'))
        shard_count += 1

    # ---------------------------------------------------------------- Catalog (cars, trucks, MPVs)
    catalog = collections.defaultdict(lambda: collections.defaultdict(lambda: {'id': None, 'types': set(), 'schemas': []}))
    make_wids = collections.defaultdict(set)
    for sid, rows in patterns.items():
        lk = [(wid, yf, yt) for wid, yf, yt in links.get(sid, []) if wmis.get(wid, {}).get('VehicleTypeId') in CATALOG_TYPES]
        if not lk:
            continue
        parsed = [(key, parse_key(key), field, val) for key, field, val in rows]
        model_keys = collections.defaultdict(list)
        for key, toks, field, val in parsed:
            if field == 'model':
                model_keys[val].append(toks)
        for (model_id, model_name), mtoks_list in model_keys.items():
            # Which make? Prefer the WMI's makes; fall back to Make_Model.
            candidate_makes = set()
            for wid, _, _ in lk:
                candidate_makes |= wmi_makes.get(wid, set()) or {wmis[wid]['MakeId']}
            mm = model_makes.get(model_id, set())
            chosen = (mm & candidate_makes) or mm or candidate_makes
            make_names = sorted({makes[m] for m in chosen if m in makes})
            if not make_names:
                continue
            make_name = make_names[0]

            def compatible(toks):
                vds, vis = toks
                for mv, mi in mtoks_list:
                    ok = True
                    for a, b in zip(vds, mv):
                        if a is not None and b is not None and not (a & b):
                            ok = False
                            break
                    if ok and vis and mi:
                        for a, b in zip(vis, mi):
                            if a is not None and b is not None and not (a & b):
                                ok = False
                                break
                    if ok:
                        return True
                return False

            by_key = collections.OrderedDict()
            for key, toks, field, val in parsed:
                if field == 'model':
                    if val[0] != model_id:
                        continue
                    val = val[1]
                elif not compatible(toks):
                    continue
                by_key.setdefault(key, {})[field] = val
            # Drop rows that only carry the model name when other rows exist.
            rows_out = [[k, v] for k, v in by_key.items()]  # encoded per make file below
            years = sorted({(yf, yt) for _, yf, yt in lk})
            entry = catalog[make_name][model_name]
            make_wids[make_name] |= {wid for wid, _, _ in lk}
            entry['id'] = model_id
            for wid, _, _ in lk:
                entry['types'].add(CATALOG_TYPES[wmis[wid]['VehicleTypeId']])
            entry['schemas'].append({
                'id': sid,
                'name': schema_names.get(sid),
                'y': [min(y[0] for y in years), max(y[1] for y in years)],
                'wmi': sorted({wmis[wid]['Wmi'] for wid, _, _ in lk}),
                'r': rows_out,
            })

    # Manufacturer-wide schemas (no Model element) — e.g. GM files one engine table for all of its
    # trucks/MPVs per year, keyed on VIN position 8. They are attached to each make that uses one of
    # the linked WMIs and shown in the catalog as shared (not model-specific) data.
    model_schemas = {sid for sid, rows in patterns.items() if any(f == 'model' for _, f, _ in rows)}
    shared_by_make = collections.defaultdict(list)
    for sid, rows in patterns.items():
        if sid in model_schemas or not rows:
            continue
        for make_name, wids in make_wids.items():
            lk = [(wid, yf, yt) for wid, yf, yt in links.get(sid, []) if wid in wids]
            if not lk:
                continue
            by_key = collections.OrderedDict()
            for key, field, val in rows:
                by_key.setdefault(key, {})[field] = val
            shared_by_make[make_name].append({
                'id': sid,
                'name': schema_names.get(sid),
                'y': [min(y for _, y, _ in lk), max(y for _, _, y in lk)],
                'wmi': sorted({wmis[wid]['Wmi'] for wid, _, _ in lk}),
                'r': [[k, v] for k, v in by_key.items()],
            })

    index = []
    used_slugs = set()
    for make_name in sorted(catalog, key=lambda s: s.lower()):
        models = catalog[make_name]
        slug = slugify(make_name)
        while slug in used_slugs:
            slug += '-x'
        used_slugs.add(slug)
        out_models = []
        for model_name in sorted(models, key=lambda s: s.lower()):
            m = models[model_name]
            m['schemas'].sort(key=lambda s: (s['y'][0], s['y'][1], s['id']))
            yr = [min(s['y'][0] for s in m['schemas']), max(s['y'][1] for s in m['schemas'])]
            years = sorted({y for s in m['schemas'] for y in range(s['y'][0], s['y'][1] + 1)})
            out_models.append({
                'name': model_name,
                'slug': slugify(model_name),
                'types': sorted(m['types']),
                'years': years,
                'schemas': m['schemas'],
            })
        values, vindex = [], {}

        def vid(v):
            token = json.dumps(v)
            if token not in vindex:
                vindex[token] = len(values)
                values.append(v)
            return vindex[token]

        shared = sorted(shared_by_make.get(make_name, []), key=lambda x: (x['y'][0], x['id']))
        for m in out_models + [{'schemas': shared}]:
            for sch in m['schemas']:
                enc = []
                for key, row in sch['r']:
                    flat = [key]
                    for fld, val in row.items():
                        flat.extend([field_index[fld], vid(val)])
                    enc.append(flat)
                sch['r'] = enc
        with open(os.path.join(out_dir, 'vehicles', f'{slug}.json'), 'w') as f:
            json.dump({'make': title(make_name), 'slug': slug, 'f': field_names, 'v': values, 'models': out_models, 'shared': shared}, f, separators=(',', ':'))
        all_years = sorted({y for m in out_models for y in m['years']})
        index.append({
            'name': title(make_name),
            'slug': slug,
            'types': sorted({t for m in out_models for t in m['types']}),
            'years': [all_years[0], all_years[-1]] if all_years else None,
            'models': [[m['name'], m['slug'], m['years'][0], m['years'][-1], [t[0] for t in m['types']]] for m in out_models],
        })

    with open(os.path.join(out_dir, 'vehicles', 'index.json'), 'w') as f:
        json.dump({'source': 'NHTSA vPIC (public domain)', 'maxYear': MAX_YEAR, 'makes': index}, f, separators=(',', ':'))

    print(f'WMI shards: {shard_count}')
    print(f'Makes: {len(index)}  Models: {sum(len(m["models"]) for m in index)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
