import os
import sys
import csv
import json
import urllib.request
from datetime import datetime

# Expanded mapping of Indian cities/hubs to approximate lat/lng coordinates
CITY_COORDINATES = {
    'mumbai': {'lat': 19.0760, 'lng': 72.8777},
    'delhi': {'lat': 28.6139, 'lng': 77.2090},
    'bengaluru': {'lat': 12.9716, 'lng': 77.5946},
    'chennai': {'lat': 13.0827, 'lng': 80.2707},
    'kolkata': {'lat': 22.5726, 'lng': 88.3639},
    'hyderabad': {'lat': 17.3850, 'lng': 78.4867},
    'jaipur': {'lat': 26.9124, 'lng': 75.7873},
    'ahmedabad': {'lat': 23.0225, 'lng': 72.5714},
    'pune': {'lat': 18.5204, 'lng': 73.8567},
    'kochi': {'lat': 9.9312, 'lng': 76.2673},
    'nashik': {'lat': 19.9975, 'lng': 73.7898},
    'sangli': {'lat': 16.8524, 'lng': 74.5815},
    'nagpur': {'lat': 21.1458, 'lng': 79.0882},
    'surat': {'lat': 21.1702, 'lng': 72.8311},
    'anand': {'lat': 22.5645, 'lng': 72.9289},
    'ludhiana': {'lat': 30.9010, 'lng': 75.8573},
    'karnal': {'lat': 29.6857, 'lng': 76.9905},
    'alwar': {'lat': 27.5530, 'lng': 76.6089},
    'guntur': {'lat': 16.3067, 'lng': 80.4365},
    'vijayawada': {'lat': 16.5062, 'lng': 80.6480},
    'indore': {'lat': 22.7196, 'lng': 75.8577},
    'muzaffarpur': {'lat': 26.1209, 'lng': 85.3647},
    'shimla': {'lat': 31.1048, 'lng': 77.1734},
    'agra': {'lat': 27.1767, 'lng': 78.0081},
    'ratnagiri': {'lat': 16.9902, 'lng': 73.3120}
}

def find_header_index(headers, keywords):
    for idx, h in enumerate(headers):
        cleaned = h.lower().strip()
        if any(k in cleaned for k in keywords):
            return idx
    return -1

def parse_csv_content(csv_data, default_source="Crowdsourced"):
    lines = csv_data.strip().splitlines()
    if not lines:
        return []
        
    reader = csv.reader(lines)
    records = list(reader)
    if len(records) < 2:
        return []
        
    headers = records[0]
    
    # Dynamically map columns
    idx_timestamp = find_header_index(headers, ['timestamp'])
    idx_name = find_header_index(headers, ['warehouse name', 'facility name', 'name'])
    idx_owner = find_header_index(headers, ['owner name', 'contact name', 'owner'])
    idx_email = find_header_index(headers, ['email', 'contact email'])
    idx_phone = find_header_index(headers, ['phone', 'contact phone'])
    idx_city = find_header_index(headers, ['city', 'location city'])
    idx_state = find_header_index(headers, ['state', 'region'])
    idx_type = find_header_index(headers, ['storage type', 'temperature type', 'type'])
    idx_total_cap = find_header_index(headers, ['total capacity', 'total pallets'])
    idx_vacant_cap = find_header_index(headers, ['vacant capacity', 'current vacant', 'vacant'])
    idx_price = find_header_index(headers, ['price', 'cost', 'rate'])
    idx_amenities = find_header_index(headers, ['amenities', 'certifications', 'features'])
    idx_source = find_header_index(headers, ['source'])
    
    parsed_warehouses = []
    
    for row in records[1:]:
        # Skip empty or malformed lines
        if len(row) < len(headers) or not row[idx_name]:
            continue
            
        city = row[idx_city].strip() if idx_city != -1 else ''
        state = row[idx_state].strip() if idx_state != -1 else ''
        
        # Geocode coordinates based on city lookup
        city_key = city.lower().strip()
        coords = CITY_COORDINATES.get(city_key, {'lat': 20.5937, 'lng': 78.9629}) # Default to center of India
        
        # Parse numeric fields cleanly
        def clean_int(val):
            cleaned = ''.join(c for c in val if c.isdigit())
            return int(cleaned) if cleaned else 0
            
        def clean_float(val):
            cleaned = ''.join(c for c in val if c.isdigit() or c == '.')
            try:
                return float(cleaned) if cleaned else 0.0
            except ValueError:
                return 0.0
                
        total_cap = clean_int(row[idx_total_cap]) if idx_total_cap != -1 else 0
        vacant_cap = clean_int(row[idx_vacant_cap]) if idx_vacant_cap != -1 else 0
        price = clean_float(row[idx_price]) if idx_price != -1 else 0.0
        
        # Parse temperature categories
        raw_type = row[idx_type].lower() if idx_type != -1 else ''
        storage_type = 'Ambient'
        temp_range = '15°C to 25°C'
        
        if 'freeze' in raw_type or '-18' in raw_type or 'deep' in raw_type:
            storage_type = 'Deep Freeze'
            temp_range = '-18°C to -25°C'
        elif 'chill' in raw_type or '0 to 4' in raw_type or 'chilled' in raw_type:
            storage_type = 'Chilled'
            temp_range = '0°C to 4°C'
            
        # Parse amenities list
        raw_amenities = row[idx_amenities] if idx_amenities != -1 else ''
        # Strip potential surrounding quotes and split
        raw_amenities = raw_amenities.strip('"').strip("'")
        amenities = [a.strip() for a in raw_amenities.split(',') if a.strip()]
        
        timestamp = row[idx_timestamp].strip() if idx_timestamp != -1 else datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        source_val = row[idx_source].strip() if (idx_source != -1 and idx_source < len(row)) else default_source

        warehouse = {
            'name': row[idx_name].strip(),
            'owner_name': row[idx_owner].strip() if idx_owner != -1 else 'N/A',
            'email': row[idx_email].strip() if idx_email != -1 else 'N/A',
            'phone': row[idx_phone].strip() if idx_phone != -1 else 'N/A',
            'location': {
                'city': city,
                'state': state,
                'formatted': f"{city}, {state}" if city and state else (city or state or 'Unknown')
            },
            'coordinates': coords,
            'total_capacity': total_cap,
            'vacant_capacity': vacant_cap,
            'temperature_type': storage_type,
            'temperature_range': temp_range,
            'price_per_pallet_day': price,
            'amenities': amenities,
            'last_updated': timestamp,
            'source': source_val
        }
        parsed_warehouses.append(warehouse)
        
    return parsed_warehouses

def main():
    print('--- Starting Cold Storage Static Index Compiler ---')
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Load Crowdsourced Data (Google Sheet or local mock fallback)
    crowd_csv_data = ''
    sheet_url = os.environ.get('GOOGLE_SHEET_CSV_URL')
    
    if sheet_url:
        print(f"Fetching remote crowdsourced CSV data from: {sheet_url}")
        try:
            req = urllib.request.Request(
                sheet_url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req) as response:
                crowd_csv_data = response.read().decode('utf-8')
            print('Successfully fetched remote crowdsourced CSV.')
        except Exception as e:
            print(f"Error fetching remote CSV: {e}. Falling back to local mock data.")
            
    if not crowd_csv_data:
        local_mock_path = os.path.join(script_dir, '..', 'data', 'mock_responses.csv')
        print(f"Reading local crowdsourced mock CSV from: {local_mock_path}")
        if os.path.exists(local_mock_path):
            with open(local_mock_path, 'r', encoding='utf-8') as f:
                crowd_csv_data = f.read()
            print('Successfully read local crowdsourced CSV.')
        else:
            print('Warning: No local mock_responses.csv found.')
            
    crowd_warehouses = parse_csv_content(crowd_csv_data, default_source="Crowdsourced")
    print(f"Parsed {len(crowd_warehouses)} crowdsourced warehouse nodes.")

    # 2. Load Government Registered Data
    gov_warehouses = []
    local_gov_path = os.path.join(script_dir, '..', 'data', 'gov_cold_storages.csv')
    print(f"Reading local government CSV from: {local_gov_path}")
    
    if os.path.exists(local_gov_path):
        with open(local_gov_path, 'r', encoding='utf-8') as f:
            gov_csv_data = f.read()
        gov_warehouses = parse_csv_content(gov_csv_data, default_source="Government Verified")
        print(f"Parsed {len(gov_warehouses)} government verified nodes.")
    else:
        print('Warning: No gov_cold_storages.csv found.')

    # 3. Merge Datasets
    # Avoid duplicate facilities by matching on Name + City
    combined = []
    seen = set()
    
    # We prioritize government listings in case of duplicates
    for wh in gov_warehouses + crowd_warehouses:
        key = (wh['name'].lower().strip(), wh['location']['city'].lower().strip())
        if key not in seen:
            seen.add(key)
            # Assign clean IDs sequentially
            wh['id'] = f"wh-{len(combined) + 1}"
            combined.append(wh)
        else:
            print(f"Duplicate node skipped: {wh['name']} ({wh['location']['city']})")

    # Ensure target directory exists
    out_dir = os.path.join(script_dir, '..', 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'warehouses.json')
    
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
        
    print(f"Success! Compiled total {len(combined)} active nodes into static search index: {out_path}")

if __name__ == '__main__':
    main()
