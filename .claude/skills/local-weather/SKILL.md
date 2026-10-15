---
name: local-weather
description: Get the current local weather (temperature in °C, conditions, wind, humidity, observation time). Use when the user asks for the weather, temperature, or conditions in their city. Defaults to Ottawa, Ontario, Canada.
---

# Local weather

Report the current weather for a location. If the user names a city (or passes one as an argument), use it; otherwise default to **Ottawa, Ontario, Canada**.

## Steps

1. **Pick the source**
   - Canadian city: use Environment Canada via WebFetch. Ottawa:
     `https://weather.gc.ca/en/location/index.html?coords=45.421,-75.697`
     For other Canadian cities, find the coordinates and use the same URL pattern with `?coords=<lat>,<lon>`.
   - Elsewhere: WebFetch `https://wttr.in/<City>?format=j1`, or fall back to WebSearch.
2. **Fetch** the page and ask for: temperature, conditions, wind, humidity, and the observation time and station.
3. **Report briefly**, in this form:

   > **<City>**, observed <time + timezone>
   > - Temperature: X°C
   > - Conditions: ...
   > - Wind: ... · Humidity: ...%
   >
   > Source: <link>

## Rules

- Always include the observation time. Official observations update roughly hourly, so a repeat value is normal. Say it is unchanged rather than re-reporting it as new.
- Do not trust web search snippets for the temperature when they disagree or have no timestamp. Prefer the official page.
- Use °C and km/h unless the user asks otherwise.
- If the fetch fails, say so and give the source link instead of guessing.
