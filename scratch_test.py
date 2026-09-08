import requests

locations = [
    {'name': 'Leh Defaults', 'body': {'latitude': 34.16, 'longitude': 77.58, 'ambient_temp_c': -6, 'wind_speed_ms': 3.2, 'wind_direction_deg': 180, 'ghi_kwh_m2_day': 4.5, 'warm_humidity_pct': 45, 'rain_last_7days_mm': 0}},
    {'name': 'Kargil', 'body': {'latitude': 34.55, 'longitude': 76.13, 'ambient_temp_c': -10, 'wind_speed_ms': 2.5, 'wind_direction_deg': 120, 'ghi_kwh_m2_day': 4.0, 'warm_humidity_pct': 50, 'rain_last_7days_mm': 0}},
    {'name': 'Nyoma', 'body': {'latitude': 33.20, 'longitude': 78.67, 'ambient_temp_c': -18, 'wind_speed_ms': 6.0, 'wind_direction_deg': 240, 'ghi_kwh_m2_day': 5.5, 'warm_humidity_pct': 25, 'rain_last_7days_mm': 0}},
    {'name': 'Diskit Nubra', 'body': {'latitude': 34.57, 'longitude': 77.56, 'ambient_temp_c': 5, 'wind_speed_ms': 1.8, 'wind_direction_deg': 150, 'ghi_kwh_m2_day': 5.2, 'warm_humidity_pct': 30, 'rain_last_7days_mm': 0}},
    {'name': 'Drass Cold', 'body': {'latitude': 34.43, 'longitude': 75.75, 'ambient_temp_c': -25, 'wind_speed_ms': 8.0, 'wind_direction_deg': 270, 'ghi_kwh_m2_day': 3.5, 'warm_humidity_pct': 60, 'rain_last_7days_mm': 5}},
    {'name': 'Warm Climate', 'body': {'latitude': 32.5, 'longitude': 75.0, 'ambient_temp_c': 25, 'wind_speed_ms': 1.0, 'wind_direction_deg': 90, 'ghi_kwh_m2_day': 6.0, 'warm_humidity_pct': 70, 'rain_last_7days_mm': 20}},
]

for loc in locations:
    res = requests.post('http://127.0.0.1:8000/predict/design', json=loc['body'])
    data = res.json()
    print(f"{loc['name']}: class={data.get('material_class')} => {data.get('shelter_material_and_design')}")
