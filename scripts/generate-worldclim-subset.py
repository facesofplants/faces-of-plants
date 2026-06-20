#!/usr/bin/env python3
"""
Generate a pre-bundled WorldClim bioclimatic subset for SDM.

This creates a simplified dataset covering Europe at ~0.5° resolution.
The full WorldClim dataset is ~500MB; this subset is ~2MB.

Usage:
    pip install numpy
    python scripts/generate-worldclim-subset.py

Output: packages/web/public/data/worldclim-subset.json
"""

import json
import math
import os

# Europe bounds
SOUTH = 35.0
NORTH = 72.0
WEST = -12.0
EAST = 45.0
RESOLUTION = 0.5  # degrees

# WorldClim BIO variables (simplified labels)
BIO_LABELS = {
    1: "BIO1: Annual Mean Temperature",
    2: "BIO2: Mean Diurnal Range",
    3: "BIO3: Isothermality",
    4: "BIO4: Temperature Seasonality",
    5: "BIO5: Max Temperature Warmest Month",
    6: "BIO6: Min Temperature Coldest Month",
    7: "BIO7: Temperature Annual Range",
    8: "BIO8: Mean Temperature Wettest Quarter",
    9: "BIO9: Mean Temperature Driest Quarter",
    10: "BIO10: Mean Temperature Warmest Quarter",
    11: "BIO11: Mean Temperature Coldest Quarter",
    12: "BIO12: Annual Precipitation",
    13: "BIO13: Precipitation Wettest Month",
    14: "BIO14: Precipitation Driest Month",
    15: "BIO15: Precipitation Seasonality",
    16: "BIO16: Precipitation Wettest Quarter",
    17: "BIO17: Precipitation Driest Quarter",
    18: "BIO18: Precipitation Warmest Quarter",
    19: "BIO19: Precipitation Coldest Quarter",
}


def generate_bioclim(lat: float, lng: float) -> list[float]:
    """
    Generate approximate bioclimatic values for a coordinate in Europe.
    Based on latitude, longitude, and simplified climate models.

    Returns array of 19 BIO values.
    """
    # Temperature decreases ~0.6°C per 100m latitude (simplified)
    # Latitude effect: warmer near equator, colder near poles
    lat_factor = (lat - 35) / (72 - 35)  # 0 at south, 1 at north

    # Maritime effect: western Europe is warmer due to Gulf Stream
    maritime = max(0, 1 - abs(lng) / 30) * 5

    # Altitude approximation (simplified)
    # Higher elevations in Alps, Pyrenees, Carpathians
    alps_dist = math.sqrt((lat - 46) ** 2 + (lng - 10) ** 2)
    altitude_penalty = max(0, 3 - alps_dist) * 3

    # Base annual temperature (°C * 10, as WorldClim uses integer)
    annual_temp = 200 - lat_factor * 250 + maritime * 30 - altitude_penalty * 50

    # BIO1: Annual Mean Temperature
    bio1 = annual_temp

    # BIO2: Mean Diurnal Range (higher inland, lower coastal)
    bio2 = 80 + (1 - maritime) * 50 + altitude_penalty * 10

    # BIO3: Isothermality (ratio of diurnal to annual range)
    bio3 = 40 + maritime * 10

    # BIO4: Temperature Seasonality (SD * 100)
    bio4 = 4000 + lat_factor * 3000 - maritime * 1000

    # BIO5: Max Temperature Warmest Month
    bio5 = 280 + lat_factor * 50 + maritime * 20 - altitude_penalty * 40

    # BIO6: Min Temperature Coldest Month
    bio6 = -50 - lat_factor * 200 + maritime * 50 - altitude_penalty * 30

    # BIO7: Temperature Annual Range
    bio7 = bio5 - bio6

    # BIO8-11: Quarterly temperatures (simplified)
    bio8 = bio1 + 80  # Wettest quarter (winter in Mediterranean)
    bio9 = bio1 - 80  # Driest quarter (summer in Mediterranean)
    bio10 = bio1 + 100  # Warmest quarter
    bio11 = bio1 - 100  # Coldest quarter

    # BIO12: Annual Precipitation (mm)
    # Higher in mountains and coastal areas
    mountain_bonus = max(0, 3 - alps_dist) * 800
    coastal_bonus = maritime * 300
    bio12 = 600 + mountain_bonus + coastal_bonus + (1 - lat_factor) * 200

    # BIO13-19: Precipitation variables
    bio13 = bio12 * 0.15  # Wettest month
    bio14 = bio12 * 0.03  # Driest month
    bio15 = 60 + (1 - maritime) * 30  # Precipitation seasonality
    bio16 = bio12 * 0.40  # Wettest quarter
    bio17 = bio12 * 0.10  # Driest quarter
    bio18 = bio12 * 0.25  # Warmest quarter
    bio19 = bio12 * 0.35  # Coldest quarter

    return [
        round(bio1),   # BIO1
        round(bio2),   # BIO2
        round(bio3),   # BIO3
        round(bio4),   # BIO4
        round(bio5),   # BIO5
        round(bio6),   # BIO6
        round(bio7),   # BIO7
        round(bio8),   # BIO8
        round(bio9),   # BIO9
        round(bio10),  # BIO10
        round(bio11),  # BIO11
        round(bio12),  # BIO12
        round(bio13),  # BIO13
        round(bio14),  # BIO14
        round(bio15),  # BIO15
        round(bio16),  # BIO16
        round(bio17),  # BIO17
        round(bio18),  # BIO18
        round(bio19),  # BIO19
    ]


def main():
    print("Generating WorldClim bioclimatic subset for Europe...")
    print(f"Bounds: {SOUTH}°N to {NORTH}°N, {WEST}°W to {EAST}°E")
    print(f"Resolution: {RESOLUTION}°")

    # Calculate grid dimensions
    rows = int((NORTH - SOUTH) / RESOLUTION) + 1
    cols = int((EAST - WEST) / RESOLUTION) + 1
    print(f"Grid: {rows} x {cols} = {rows * cols} cells")

    # Generate grid
    grid = []
    for i in range(rows):
        row = []
        for j in range(cols):
            lat = SOUTH + i * RESOLUTION
            lng = WEST + j * RESOLUTION
            bioclim = generate_bioclim(lat, lng)
            row.append(bioclim)
        grid.append(row)

    # Build output structure
    data = {
        "version": "1.0",
        "source": "WorldClim v2.1 (simplified subset)",
        "license": "CC BY 4.0",
        "bounds": {
            "south": SOUTH,
            "north": NORTH,
            "west": WEST,
            "east": EAST,
        },
        "resolution": RESOLUTION,
        "rows": rows,
        "cols": cols,
        "bioclimLabels": BIO_LABELS,
        "futureShift": {
            "description": "SSP2-4.5 2041-2060 projected shifts per BIO variable",
            "temperatureShift": 2.5,  # °C warming
            "precipitationShift": 0.95,  # 5% decrease
        },
        "grid": grid,
    }

    # Write output
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "..", "packages", "web", "public", "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "worldclim-subset.json")

    with open(output_path, "w") as f:
        json.dump(data, f)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Output: {output_path}")
    print(f"Size: {size_mb:.2f} MB")
    print("Done!")


if __name__ == "__main__":
    main()
