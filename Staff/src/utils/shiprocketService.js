import AsyncStorage from '@react-native-async-storage/async-storage';

const EMAIL = 'sph176176@gmail.com';
const PASSWORD = 'K*yeMJ7b$@Oj@Pt7BVbLmUhK@AFMCXDm';
const BASE_URL = 'https://apiv2.shiprocket.in';

let cachedToken = null;
let tokenExpiry = null;

async function getToken() {
  const now = Date.now();
  
  if (!cachedToken || !tokenExpiry || now >= parseInt(tokenExpiry)) {
    try {
      const storedToken = await AsyncStorage.getItem('shiprocket_token');
      const storedExpiry = await AsyncStorage.getItem('shiprocket_token_expiry');
      if (storedToken && storedExpiry && now < parseInt(storedExpiry)) {
        cachedToken = storedToken;
        tokenExpiry = storedExpiry;
      }
    } catch (e) {
      console.warn('AsyncStorage load failed', e);
    }
  }

  if (cachedToken && tokenExpiry && now < parseInt(tokenExpiry)) {
    return cachedToken;
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/external/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Shiprocket authentication failed: ${res.statusText} - ${errorText}`);
    }

    const data = await res.json();
    if (data.token) {
      cachedToken = data.token;
      tokenExpiry = (now + 9 * 24 * 60 * 60 * 1000).toString();
      try {
        await AsyncStorage.setItem('shiprocket_token', cachedToken);
        await AsyncStorage.setItem('shiprocket_token_expiry', tokenExpiry);
      } catch (e) {
        console.warn('AsyncStorage save failed', e);
      }
      return cachedToken;
    } else {
      throw new Error('Token not found in response');
    }
  } catch (error) {
    console.error('Shiprocket Auth Error:', error);
    throw error;
  }
}

export async function createAdhocOrder(orderData) {
  const token = await getToken();
  try {
    const res = await fetch(`${BASE_URL}/v1/external/orders/create/adhoc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Order creation failed: ${res.status} - ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Shiprocket Create Order Error:', error);
    throw error;
  }
}

export async function getServiceability(pickupPostcode, deliveryPostcode, weight, cod) {
  const token = await getToken();
  try {
    const codParam = cod ? '1' : '0';
    const url = `${BASE_URL}/v1/external/courier/serviceability/?pickup_postcode=${pickupPostcode}&delivery_postcode=${deliveryPostcode}&weight=${weight}&cod=${codParam}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Serviceability check failed: ${res.status} - ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Shiprocket Serviceability Check Error:', error);
    throw error;
  }
}

export async function assignAWB(shipmentId, courierId) {
  const token = await getToken();
  try {
    const res = await fetch(`${BASE_URL}/v1/external/courier/assign/awb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: shipmentId,
        courier_id: courierId
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AWB assignment failed: ${res.status} - ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Shiprocket AWB Assignment Error:', error);
    throw error;
  }
}

export async function schedulePickup(shipmentId) {
  const token = await getToken();
  try {
    const res = await fetch(`${BASE_URL}/v1/external/courier/generate/pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: [parseInt(shipmentId)]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pickup scheduling failed: ${res.status} - ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Shiprocket Pickup Scheduling Error:', error);
    throw error;
  }
}

export async function generateLabel(shipmentId) {
  const token = await getToken();
  try {
    const res = await fetch(`${BASE_URL}/v1/external/courier/generate/label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: [parseInt(shipmentId)]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Label generation failed: ${res.status} - ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Shiprocket Label Generation Error:', error);
    throw error;
  }
}

export async function generateManifest(shipmentId) {
  const token = await getToken();
  try {
    const res = await fetch(`${BASE_URL}/v1/external/manifests/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: [parseInt(shipmentId)]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Manifest generation failed: ${res.status} - ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Shiprocket Manifest Generation Error:', error);
    throw error;
  }
}

export async function printManifest(shipmentId) {
  const token = await getToken();
  try {
    const res = await fetch(`${BASE_URL}/v1/external/manifests/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: [parseInt(shipmentId)]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Manifest printing failed: ${res.status} - ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Shiprocket Manifest Printing Error:', error);
    throw error;
  }
}

export async function trackShipment(awbCode) {
  const token = await getToken();
  try {
    const res = await fetch(`${BASE_URL}/v1/external/courier/track/awb/${awbCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Tracking request failed: ${res.status} - ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Shiprocket Tracking Error:', error);
    throw error;
  }
}
