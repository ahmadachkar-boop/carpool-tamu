/**
 * Weather and traffic utilities
 * Integrates with weather APIs and traffic services
 */

import { logError, logWarning } from './errorLogger';

// Weather condition severity levels
export const WEATHER_SEVERITY = {
  SAFE: 'safe',
  CAUTION: 'caution',
  WARNING: 'warning',
  DANGER: 'danger'
};

/**
 * Get current weather for a location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Weather data
 */
export const getCurrentWeather = async (lat, lng) => {
  try {
    // Note: Replace with actual API key in production
    // Using free tier OpenWeatherMap API
    const apiKey = process.env.REACT_APP_OPENWEATHER_API_KEY || 'demo';

    if (apiKey === 'demo') {
      // Return mock data for development
      return {
        temp: 72,
        condition: 'Clear',
        description: 'Clear sky',
        humidity: 65,
        windSpeed: 5,
        icon: '01d',
        severity: WEATHER_SEVERITY.SAFE
      };
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=imperial`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      temp: Math.round(data.main.temp),
      condition: data.weather[0].main,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
      icon: data.weather[0].icon,
      severity: getWeatherSeverity(data.weather[0].main, data.weather[0].id)
    };
  } catch (error) {
    logError('Weather API', error, { lat, lng });
    return null;
  }
};

/**
 * Determine weather severity based on conditions
 * @param {string} main - Main weather condition
 * @param {number} id - Weather condition ID
 * @returns {string} Severity level
 */
export const getWeatherSeverity = (main, id) => {
  // Thunderstorm
  if (id >= 200 && id < 300) return WEATHER_SEVERITY.DANGER;

  // Snow
  if (id >= 600 && id < 700) {
    if (id >= 602) return WEATHER_SEVERITY.WARNING; // Heavy snow
    return WEATHER_SEVERITY.CAUTION;
  }

  // Rain
  if (id >= 500 && id < 600) {
    if (id >= 502) return WEATHER_SEVERITY.WARNING; // Heavy rain
    return WEATHER_SEVERITY.CAUTION;
  }

  // Fog/Mist
  if (id >= 700 && id < 800) return WEATHER_SEVERITY.CAUTION;

  return WEATHER_SEVERITY.SAFE;
};

/**
 * Get weather alert message
 * @param {Object} weather - Weather data
 * @returns {string|null} Alert message
 */
export const getWeatherAlert = (weather) => {
  if (!weather) return null;

  switch (weather.severity) {
    case WEATHER_SEVERITY.DANGER:
      return `⚠️ DANGEROUS CONDITIONS: ${weather.description}. Consider suspending operations.`;
    case WEATHER_SEVERITY.WARNING:
      return `⚠️ HAZARDOUS WEATHER: ${weather.description}. Drive with extreme caution.`;
    case WEATHER_SEVERITY.CAUTION:
      return `⚠️ ADVERSE CONDITIONS: ${weather.description}. Drive carefully.`;
    default:
      return null;
  }
};

/**
 * Get traffic conditions using Google Maps
 * @param {Object} origin - Origin coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @returns {Promise<Object>} Traffic data
 */
export const getTrafficConditions = async (origin, destination, directionsService) => {
  try {
    if (!window.google || !directionsService) {
      logWarning('Traffic API', 'Google Maps not available');
      return null;
    }

    const result = await new Promise((resolve, reject) => {
      directionsService.route(
        {
          origin: origin,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: 'bestguess'
          }
        },
        (result, status) => {
          if (status === 'OK') resolve(result);
          else reject(status);
        }
      );
    });

    const leg = result.routes[0].legs[0];
    const duration = leg.duration.value;
    const durationInTraffic = leg.duration_in_traffic ? leg.duration_in_traffic.value : duration;

    const trafficDelay = durationInTraffic - duration;
    const delayMinutes = Math.round(trafficDelay / 60);

    let trafficLevel = 'light';
    let severity = WEATHER_SEVERITY.SAFE;

    if (delayMinutes > 15) {
      trafficLevel = 'heavy';
      severity = WEATHER_SEVERITY.WARNING;
    } else if (delayMinutes > 5) {
      trafficLevel = 'moderate';
      severity = WEATHER_SEVERITY.CAUTION;
    }

    return {
      duration: Math.round(duration / 60),
      durationInTraffic: Math.round(durationInTraffic / 60),
      delay: delayMinutes,
      trafficLevel,
      severity,
      distance: leg.distance.text
    };
  } catch (error) {
    logError('Traffic API', error, { origin, destination });
    return null;
  }
};

/**
 * Get traffic alert message
 * @param {Object} traffic - Traffic data
 * @returns {string|null} Alert message
 */
export const getTrafficAlert = (traffic) => {
  if (!traffic) return null;

  if (traffic.trafficLevel === 'heavy') {
    return `🚦 HEAVY TRAFFIC: +${traffic.delay} min delay. Consider alternative routes.`;
  } else if (traffic.trafficLevel === 'moderate') {
    return `🚦 MODERATE TRAFFIC: +${traffic.delay} min delay expected.`;
  }

  return null;
};

/**
 * Get weather icon emoji
 * @param {string} condition - Weather condition
 * @returns {string} Emoji
 */
export const getWeatherEmoji = (condition) => {
  const emojiMap = {
    'Clear': '☀️',
    'Clouds': '☁️',
    'Rain': '🌧️',
    'Drizzle': '🌦️',
    'Thunderstorm': '⛈️',
    'Snow': '❄️',
    'Mist': '🌫️',
    'Fog': '🌫️'
  };
  return emojiMap[condition] || '🌡️';
};
