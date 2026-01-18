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
        console.log('Fetching new Access Token for Flights...');
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

// GET /api/flights
router.get('/', async (req, res) => {
    let { origin, destination, date, returnDate, adults } = req.query;
    
    if (!origin || !destination || !date) {
        return res.status(400).json({ error: 'Origin, Destination and Date are required' });
    }

    try {
        const token = await getAccessToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // Ensure Origin/Dest are IATA Codes (3 chars)
        // Note: For simplicity, assuming user enters IATA codes or we rely on frontend autocomplete in future.
        // If length > 3, we should resolve, but Amadeus text search is separate.
        // For now, uppercase them.
        const originCode = origin.toUpperCase();
        const destCode = destination.toUpperCase();

        const params = {
            originLocationCode: originCode,
            destinationLocationCode: destCode,
            departureDate: date,
            adults: adults || 1,
            max: 50 // Limit results
        };

        if (returnDate) {
            params.returnDate = returnDate;
        }

        console.log('Searching Flights:', params);

        const flightResponse = await axios.get('https://test.api.amadeus.com/v2/shopping/flight-offers', {
            headers,
            params: params
        });

        const rawData = flightResponse.data.data || [];
        const dictionaries = flightResponse.data.dictionaries || {};

        // Helper to resolve airline name
        const getAirlineName = (code) => {
            return dictionaries.carriers ? dictionaries.carriers[code] : code;
        };

        // Map Results
        const formattedFlights = rawData.map(offer => {
            const itinerary = offer.itineraries[0]; // Outbound
            const segment = itinerary.segments[0]; // First segment (for simplicity in list view)
            const airlineCode = segment.carrierCode;
            
            return {
                id: offer.id,
                airlineName: getAirlineName(airlineCode),
                airlineCode: airlineCode,
                departureCode: segment.departure.iataCode,
                arrivalCode: segment.arrival.iataCode,
                departureTime: segment.departure.at,
                arrivalTime: segment.arrival.at,
                duration: itinerary.duration.replace('PT', '').toLowerCase(), // e.g. 2h30m
                stops: itinerary.segments.length - 1,
                price: offer.price.total,
                currency: offer.price.currency
            };
        });

        res.json({
            data: formattedFlights,
            meta: { total: formattedFlights.length }
        });

    } catch (error) {
        console.error('Flight API Error Status:', error.response?.status);
        console.error('Flight API Error Data:', JSON.stringify(error.response?.data, null, 2));
        
        if (error.response?.status === 400 || error.response?.status === 404) {
             return res.json({ data: [] });
        }
        res.status(500).json({ error: 'Failed to fetch flights' });
    }
});

export default router;
