// using Open-Meteo API - it's free and doesn't need a key!
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

const weatherDisplay = document.getElementById('weather-display');
const searchButton = document.getElementById('search-button');
const locationButton = document.getElementById('location-button');
const cityInput = document.getElementById('city-input');

// rate limiting
let lastSearch = 0;
const MIN_DELAY = 1000; // 1 second between searches

// convert 24hr time to 12hr format
const formatTime = (hour) => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h} ${ampm}`;
};

// make the date look nicer
const getReadableDay = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// get weather description from WMO code
const getWeatherDesc = (code) => {
  const descriptions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light showers',
    81: 'Showers',
    82: 'Heavy showers',
    85: 'Light snow showers',
    86: 'Snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with hail'
  };
  return descriptions[code] || 'Unknown';
};

// get UV index description and color
const getUVInfo = (uv) => {
  if (uv === null || uv === undefined) return { level: 'N/A', color: '#9399b2' };
  if (uv <= 2) return { level: 'Low', color: '#a6e3a1' };
  if (uv <= 5) return { level: 'Moderate', color: '#f9e2af' };
  if (uv <= 7) return { level: 'High', color: '#fab387' };
  if (uv <= 10) return { level: 'Very High', color: '#f38ba8' };
  return { level: 'Extreme', color: '#cba6f7' };
};

// geocode city name to coordinates
async function geocodeCity(cityName) {
  const res = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
  
  if (!res.ok) {
    throw new Error(`Could not find "${cityName}".`);
  }
  
  const data = await res.json();
  
  if (!data.results || data.results.length === 0) {
    throw new Error(`Could not find "${cityName}".`);
  }
  
  return {
    name: data.results[0].name,
    country: data.results[0].country,
    lat: data.results[0].latitude,
    lon: data.results[0].longitude
  };
}

// fetch weather from Open-Meteo API
async function fetchWeather(cityName) {
  // add loading state with skeleton
  weatherDisplay.classList.add('loading');
  weatherDisplay.innerHTML = `
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton-grid">
      <div class="skeleton skeleton-item"></div>
      <div class="skeleton skeleton-item"></div>
      <div class="skeleton skeleton-item"></div>
      <div class="skeleton skeleton-item"></div>
    </div>
  `;
  
  try {
    // first geocode the city
    const location = await geocodeCity(cityName);
    
    // then fetch weather data
    const params = new URLSearchParams({
      latitude: location.lat,
      longitude: location.lon,
      current: 'temperature_2m,apparent_temperature,weather_code,uv_index',
      hourly: 'temperature_2m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code',
      timezone: 'auto',
      forecast_days: 7
    });
    
    const res = await fetch(`${WEATHER_API}?${params}`);
    
    if (!res.ok) {
      throw new Error(`Could not fetch weather data.`);
    }
    
    const data = await res.json();
    renderWeatherUI(data, location);
  } catch (err) {
    weatherDisplay.innerHTML = `Error: ${err.message} 😢`;
  } finally {
    // remove loading state when done
    weatherDisplay.classList.remove('loading');
  }
}

// fetch weather by coordinates (for geolocation)
async function fetchWeatherByCoords(lat, lon) {
  weatherDisplay.classList.add('loading');
  weatherDisplay.innerHTML = `
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton-grid">
      <div class="skeleton skeleton-item"></div>
      <div class="skeleton skeleton-item"></div>
      <div class="skeleton skeleton-item"></div>
      <div class="skeleton skeleton-item"></div>
    </div>
  `;
  
  try {
    // reverse geocode to get city name
    const geoRes = await fetch(`${GEOCODING_API}?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`);
    let location = { name: 'Your Location', country: '', lat, lon };
    
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        location.name = geoData.results[0].name;
        location.country = geoData.results[0].country;
      }
    }
    
    // fetch weather data
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,apparent_temperature,weather_code,uv_index',
      hourly: 'temperature_2m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code',
      timezone: 'auto',
      forecast_days: 7
    });
    
    const res = await fetch(`${WEATHER_API}?${params}`);
    
    if (!res.ok) {
      throw new Error(`Could not fetch weather data.`);
    }
    
    const data = await res.json();
    renderWeatherUI(data, location);
  } catch (err) {
    weatherDisplay.innerHTML = `Error: ${err.message} 😢`;
  } finally {
    weatherDisplay.classList.remove('loading');
  }
}

// render the UI with tabs and everything
function renderWeatherUI(data, location) {
  const cityName = location.country ? `${location.name} (${location.country})` : location.name;
  
  // set up the basic structure
  weatherDisplay.innerHTML = `
    <h2>${cityName}</h2>
    <div class='tabs'>
      <div class='tab active' data-view='today'>Today</div>
      <div class='tab' data-view='tomorrow'>Tomorrow</div>
      <div class='tab' data-view='week'>7-Day</div>
    </div>
    <div id='weather-content'></div>
  `;

  const weatherContent = document.getElementById('weather-content');

  // function to show different views based on which tab is clicked
  const renderContent = (view) => {
    if (view === 'today') {
      // show current conditions + hourly
      const curr = data.current;
      
      const fragment = document.createDocumentFragment();
      
      // current conditions
      const nowP = document.createElement('p');
      nowP.textContent = `Now: ${Math.round(curr.temperature_2m)}°C (${getWeatherDesc(curr.weather_code)})`;
      fragment.appendChild(nowP);
      
      const feelsP = document.createElement('p');
      feelsP.textContent = `Feels like: ${Math.round(curr.apparent_temperature)}°C`;
      fragment.appendChild(feelsP);
      
      // UV index if available
      if (curr.uv_index !== null && curr.uv_index !== undefined) {
        const uvInfo = getUVInfo(curr.uv_index);
        const uvP = document.createElement('p');
        uvP.className = 'uv-index';
        uvP.innerHTML = `UV Index: <span class="uv-value" style="background: ${uvInfo.color}">${Math.round(curr.uv_index)} - ${uvInfo.level}</span>`;
        fragment.appendChild(uvP);
      }
      
      // hourly forecast grid - next 24 hours
      const grid = document.createElement('div');
      grid.className = 'forecast-scroll';
      
      const currentHour = new Date().getHours();
      for (let i = 0; i < 24; i++) {
        const hourIndex = currentHour + i;
        if (hourIndex < data.hourly.time.length) {
          const item = document.createElement('div');
          item.className = 'forecast-item';
          const hour = new Date(data.hourly.time[hourIndex]).getHours();
          item.innerHTML = `
            <span>${formatTime(hour)}</span>
            <span>${Math.round(data.hourly.temperature_2m[hourIndex])}°C</span>
            <span>${getWeatherDesc(data.hourly.weather_code[hourIndex])}</span>
          `;
          grid.appendChild(item);
        }
      }
      
      fragment.appendChild(grid);
      weatherContent.innerHTML = '';
      weatherContent.appendChild(fragment);

    } else if (view === 'tomorrow') {
      // tomorrow's hourly forecast
      const fragment = document.createDocumentFragment();
      
      const titleP = document.createElement('p');
      titleP.textContent = `${getReadableDay(data.daily.time[1])} Forecast`;
      fragment.appendChild(titleP);
      
      const grid = document.createElement('div');
      grid.className = 'forecast-scroll';
      
      // show tomorrow's hours (24-48 hours from now)
      for (let i = 24; i < 48 && i < data.hourly.time.length; i++) {
        const item = document.createElement('div');
        item.className = 'forecast-item';
        const hour = new Date(data.hourly.time[i]).getHours();
        item.innerHTML = `
          <span>${formatTime(hour)}</span>
          <span>${Math.round(data.hourly.temperature_2m[i])}°C</span>
          <span>${getWeatherDesc(data.hourly.weather_code[i])}</span>
        `;
        grid.appendChild(item);
      }
      
      fragment.appendChild(grid);
      weatherContent.innerHTML = '';
      weatherContent.appendChild(fragment);

    } else {
      // 7-day overview
      const fragment = document.createDocumentFragment();
      
      const grid = document.createElement('div');
      grid.className = 'forecast-scroll';
      
      data.daily.time.forEach((date, idx) => {
        const item = document.createElement('div');
        item.className = 'forecast-item';
        item.innerHTML = `
          <span class='day-name'>${getReadableDay(date)}</span>
          <span>${Math.round(data.daily.temperature_2m_max[idx])}° / ${Math.round(data.daily.temperature_2m_min[idx])}°C</span>
          <span>${getWeatherDesc(data.daily.weather_code[idx])}</span>
        `;
        grid.appendChild(item);
      });
      
      fragment.appendChild(grid);
      weatherContent.innerHTML = '';
      weatherContent.appendChild(fragment);
    }
  };

  // make tabs clickable and accessible
  weatherDisplay.querySelectorAll('.tab').forEach(tab => {
    // add keyboard support
    tab.setAttribute('role', 'button');
    tab.setAttribute('tabindex', '0');
    
    tab.addEventListener('click', e => {
      // remove active from all tabs
      weatherDisplay.querySelector('.tab.active').classList.remove('active');
      // add active to clicked tab
      e.target.classList.add('active');
      renderContent(e.target.dataset.view);
    });
    
    // allow keyboard navigation
    tab.addEventListener('keypress', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tab.click();
      }
    });
  });

  // default to showing today
  renderContent('today');
}

// handle the search with rate limiting
function handleSearch() {
  const city = cityInput.value.trim();
  
  if (!city) {
    weatherDisplay.innerHTML = "Please enter a city name first.";
    return;
  }
  
  // check rate limit
  const now = Date.now();
  if (now - lastSearch < MIN_DELAY) {
    return; // silently ignore rapid requests
  }
  lastSearch = now;
  
  // disable buttons during search
  searchButton.disabled = true;
  locationButton.disabled = true;
  
  fetchWeather(city).finally(() => {
    // re-enable buttons after search completes
    searchButton.disabled = false;
    locationButton.disabled = false;
  });
  
  cityInput.value = ''; // clear input
}

// geolocation support
function handleLocation() {
  if (!navigator.geolocation) {
    weatherDisplay.innerHTML = "Geolocation is not supported by your browser 😕";
    return;
  }
  
  // disable buttons
  searchButton.disabled = true;
  locationButton.disabled = true;
  
  weatherDisplay.innerHTML = "Getting your location...";
  
  navigator.geolocation.getCurrentPosition(
    // success
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      fetchWeatherByCoords(lat, lon).finally(() => {
        searchButton.disabled = false;
        locationButton.disabled = false;
      });
    },
    // error
    (error) => {
      let message = "Could not get your location 😢";
      if (error.code === error.PERMISSION_DENIED) {
        message = "Location permission denied. Please enable location access.";
      }
      weatherDisplay.innerHTML = message;
      searchButton.disabled = false;
      locationButton.disabled = false;
    }
  );
}

// button click
searchButton.addEventListener('click', handleSearch);

// location button click
locationButton.addEventListener('click', handleLocation);

// also let them press enter
cityInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    handleSearch();
  }
});

// check if there's a city in the URL (like /london or /new-york)
// so people can share direct links to cities
window.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  // remove leading slash and any trailing slash
  const cityFromUrl = path.replace(/^\/|\/$/g, '');
  
  // ignore if it's empty or is a file (like index.html)
  if (cityFromUrl && cityFromUrl.length > 0 && !cityFromUrl.includes('.')) {
    // replace dashes with spaces and decode special characters
    const cityName = decodeURIComponent(cityFromUrl.replace(/-/g, ' '));
    fetchWeather(cityName);
  }
});