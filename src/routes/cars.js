import express from "express";
import axios from "axios";

const router = express.Router();

// Amadeus Credentials (Should be in .env in production)
const API_KEY = 'u6QwFyfUw3Q24zsdyCVIpD78Yecwlzy5';
const API_SECRET = 'OTEpwp38J0AVMXZ1';

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    const now = Date.now();
    if (accessToken && now < tokenExpiresAt) {
        return accessToken;
    }

    try {
        console.log('Fetching new Access Token for Cars...');
        const response = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token', 
            new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': API_KEY,
                'client_secret': API_SECRET
            }), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        accessToken = response.data.access_token;
        tokenExpiresAt = now + (response.data.expires_in * 1000) - 60000;
        return accessToken;
    } catch (error) {
        console.error('Auth Error:', error.response?.data || error.message);
        throw error;
    }
}

// Search Endpoint for Cars
// GET /api/cars
router.get('/', async (req, res) => {
    let { pickUpLocation, pickUpDate, pickUpTime, dropOffLocation } = req.query;
    
    if (!pickUpLocation) return res.status(400).json({ error: 'Pick Up Location is required' });
    if (!pickUpDate) return res.status(400).json({ error: 'Pick Up Date is required' });

    try {
        const token = await getAccessToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // Step 0: Resolve City/Airport to IATA Code if needed
        let cityCode = pickUpLocation;
        if (pickUpLocation.length !== 3) {
             const geoResponse = await axios.get('https://test.api.amadeus.com/v1/reference-data/locations', {
                headers,
                params: { keyword: pickUpLocation, subType: 'CITY,AIRPORT', 'page[limit]': 1 }
            });
            if (geoResponse.data.data && geoResponse.data.data.length > 0) {
                cityCode = geoResponse.data.data[0].iataCode;
            } else {
                return res.json({ data: [] }); // City not found
            }
        }
        cityCode = cityCode.toUpperCase();
        console.log(`Searching cars in ${cityCode} for ${pickUpDate}...`);

        // Step 1: Search Car Offers
        // Note: Amadeus test environment might have limited coverage.
        // Using Standard Shopping API
        
        // Calculate Return Date (Default to +3 days if not provided) -> crucial for pricing
        const startDateObj = new Date(`${pickUpDate}T${pickUpTime || '10:00'}:00`);
        const returnDateObj = new Date(startDateObj);
        returnDateObj.setDate(startDateObj.getDate() + 3);
        
        const returnDateStr = returnDateObj.toISOString().split('T')[0];
        const returnTimeStr = pickUpTime || '10:00';

        const params = {
            startLocationCode: cityCode,
            startDateTime: `${pickUpDate}T${pickUpTime || '10:00'}:00`,
            returnDateTime: `${returnDateStr}T${returnTimeStr}:00`
        };

        console.log('Amadeus Car Params:', params);

        const carResponse = await axios.get('https://test.api.amadeus.com/v1/shopping/car-offers', { 
            headers,
            params: params
        });

        // Map and Filter Results
        const rawCars = carResponse.data.data || [];
        
        // Transform for Frontend
        // Amadeus Car response structure: { provider: {}, cars: [] } or list of offers
        const formattedCars = rawCars.map(offer => {
             return {
                 id: offer.id,
                 provider: offer.provider?.companyName || 'Unknown Provider',
                 name: offer.car?.vehicle?.make + ' ' + offer.car?.vehicle?.model,
                 type: offer.car?.vehicle?.category,
                 transmission: offer.car?.vehicle?.transmission,
                 image: offer.car?.vehicle?.imageURL, // Sometimes available
                 price: offer.price?.total,
                 currency: offer.price?.currency,
                 sipp: offer.car?.vehicle?.code // SIPP code (e.g. CDMR)
             };
        });

        res.json({
            data: formattedCars,
            meta: { total: formattedCars.length }
        });

    } catch (error) {
        // Amadeus often returns 400 or 500 if no offers found in Test env or invalid params
        console.error('Car API Error Status:', error.response?.status);
        console.error('Car API Error Data:', JSON.stringify(error.response?.data, null, 2));
        
        // Return empty list on known no-results errors to prevent frontend crash
        if (error.response?.status === 400 || error.response?.status === 404) {
             console.warn('Returning empty list due to 400/404 from Amadeus (likely no availability in Test Env).');
             return res.json({ data: [] });
        }
        res.status(500).json({ error: 'Failed to fetch car offers', details: error.message });
    }
});

export default router;
