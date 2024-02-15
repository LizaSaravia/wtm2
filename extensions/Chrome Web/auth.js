import { API_URL } from './consts.js';

/**
 * Generates a random token using the crypto API.
 * The generated token is a hexadecimal string with 256 bits of randomness.
 * 
 * @returns {string}
 */
export function getRandomToken () {
  // E.g. 8 * 32 = 256 bits token
  var randomPool = new Uint8Array(32);
  crypto.getRandomValues(randomPool);
  // Convert the random values to a hexadecimal string
  var hex = '';
  for (var i = 0; i < randomPool.length; ++i) {
    hex += randomPool[i].toString(16);
  }
  // E.g. db18458e2782b2b77e36769c569e263a53885a9944dd0a861e5064eac16f1a
  return hex;
}

/**
 * Asynchronous function to check if a user is signed in by retrieving information from local storage.
 * 
 * @param {object} chrome - The Chrome object.
 * @returns {Promise<object>} A Promise that resolves to an object containing user status and information.
 *                           The object structure: { userStatus: boolean, user_info: object }
 */
export function is_user_signed_in (chrome) {
  return new Promise(resolve => {
    chrome.storage.local.get(['userStatus', 'user_info', 'device_id'],
      function (response) {
        if (chrome.runtime.lastError) resolve({
          userStatus:
            false, user_info: {}
        })
        resolve(response.userStatus === undefined ?
          { userStatus: false, user_info: {} } : response
        )
      });
  });
}

/**
 * Asynchronous function to retrieve the device ID from local storage.
 * If the device ID is not found in the storage, a random token is generated.
 * 
 * @returns {Promise<string>}
 */
export async function getDeviceId () {
  // Retrieve data from local storage
  const data = await chrome.storage.local.get(['device_id'])
  // Return the device ID if found, otherwise generate a random token
  return data.device_id || getRandomToken()
}

/**
 * Asynchronous function to log in a user by sending a login request to the server.
 * 
 * @param {object} payload - An object containing user credentials (email and password).
 * @param {string} deviceId - The device ID associated with the user's device.
 * @returns {Promise<Response>} A Promise that resolves to the response from the login request.
 */
export async function loginUser (payload, deviceId) {
  try {
    // Create the request body by converting payload to JSON
    const body = JSON.stringify({
      email: payload.email,
      password: payload.password,
      userAgent: payload.userAgent,
      deviceId,
    })

    // Send a POST request to the login endpoint with the provided body
    return await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body
    })
  } catch (err) {
    return console.error(err);
  }
}

/**
 * Asynchronous function to refresh a user's authentication token by sending a request to the server.
 * 
 * @param {object} data - An object containing user information, including the refresh token.
 * @returns {Promise<Response>} A Promise that resolves to the response from the token refresh request.
 */
export async function refreshUser (data) {
  try {
    // Send a GET request to the refresh endpoint with the user's refresh token in the Authorization header
    return await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.user_info?.refreshToken}`
      }
    })
  } catch (err) {
    return console.error(err);
  }
}

export async function logoutUser () {
  chrome.storage.local.set({ userStatus: false, user_info: {} });
}

export const refreshTokenData = async (res) => {
  return await refreshUser(res)
    .then(async response => await response.json())
    .then(async (response) => {
      return await new Promise((resolve, reject) => {
        chrome.storage.local.set({ userStatus: true, user_info: { ...res.user_info, ...response } });
        resolve(response);
      });
    })
}