"""NASA POWER climate data client with an in-memory request cache."""

from dataclasses import dataclass
from datetime import date, timedelta
import json
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
_cache: dict[tuple[float, float, str, str], "ClimateData"] = {}
_cache_lock = Lock()


@dataclass(frozen=True)
class ClimateData:
    latitude: float
    longitude: float
    ambient_temp_c: float
    wind_speed_ms: float
    humidity_pct: float
    ghi_kwh_m2_day: float
    rain_last_7days_mm: float
    source: str = "NASA POWER"


def _value(series: dict, key: str, default: float = 0.0) -> float:
    value = series.get(key, default)
    return default if value is None or value == -999 else float(value)


def _valid_keys(series: dict) -> set[str]:
    return {key for key, value in series.items() if value is not None and value != -999}


def _fetch_payload(params: dict[str, str]) -> dict:
    request = Request(f"{NASA_POWER_URL}?{urlencode(params)}", headers={"User-Agent": "thermal-shelter-api/1.0"})
    try:
        with urlopen(request, timeout=10) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"NASA POWER climate lookup failed: {exc}") from exc


def get_climate(lat: float, lon: float, start: date | None = None, end: date | None = None) -> ClimateData:
    """Fetch representative daily climate data for a point and cache it."""
    # POWER daily observations can lag the current day. Request a recent
    # lookback window and use the latest complete day with real values rather
    # than converting NASA's -999 missing-data sentinel into fake zeroes.
    requested_start = start
    end = end or (date.today() - timedelta(days=1))
    start = start or end - timedelta(days=30)
    if start > end:
        raise ValueError("start date must not be after end date")
    key = (round(lat, 4), round(lon, 4), start.isoformat(), end.isoformat())
    with _cache_lock:
        cached = _cache.get(key)
    if cached:
        return cached

    params = {"parameters": "T2M,WS10M,RH2M,ALLSKY_SFC_SW_DWN,PRECTOTCORR", "community": "RE", "longitude": str(lon), "latitude": str(lat), "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"), "format": "JSON"}
    payload = _fetch_payload(params)

    parameters = payload.get("properties", {}).get("parameter", {})
    t2m = parameters.get("T2M", {})
    ws = parameters.get("WS10M", {})
    rh = parameters.get("RH2M", {})
    ghi = parameters.get("ALLSKY_SFC_SW_DWN", {})
    rain_series = parameters.get("PRECTOTCORR", {})
    common_days = _valid_keys(t2m) & _valid_keys(ws) & _valid_keys(rh) & _valid_keys(ghi)

    # If the recent window is entirely unavailable, expand to a historical
    # year. This keeps the endpoint useful during NASA's publication lag.
    if not common_days and not requested_start:
        start = end - timedelta(days=365)
        params["start"] = start.strftime("%Y%m%d")
        payload = _fetch_payload(params)
        parameters = payload.get("properties", {}).get("parameter", {})
        t2m = parameters.get("T2M", {})
        ws = parameters.get("WS10M", {})
        rh = parameters.get("RH2M", {})
        ghi = parameters.get("ALLSKY_SFC_SW_DWN", {})
        rain_series = parameters.get("PRECTOTCORR", {})
        common_days = _valid_keys(t2m) & _valid_keys(ws) & _valid_keys(rh) & _valid_keys(ghi)

    if not common_days:
        raise RuntimeError("NASA POWER returned no published climate values for this location and date range.")

    day = max(common_days)
    valid_rain_days = sorted(_valid_keys(rain_series), reverse=True)[:7]
    rain = sum(_value(rain_series, rain_day) for rain_day in valid_rain_days)
    result = ClimateData(lat, lon, _value(t2m, day), _value(ws, day), _value(rh, day), _value(ghi, day), rain)
    with _cache_lock:
        _cache[key] = result
    return result
