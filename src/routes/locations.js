import express from "express";
import axios from "axios";

const router = express.Router();

const API_KEY = 'u6QwFyfUw3Q24zsdyCVIpD78Yecwlzy5';
const API_SECRET = 'OTEpwp38J0AVMXZ1';

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    const now = Date.now();
    if (accessToken && now < tokenExpiresAt) {
        return accessToken;
    }
    // ... (Same auth logic as other files) ...
    try {
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
        throw error;
    }
}

// GET /api/locations?keyword=PAR
router.get('/', async (req, res) => {
    const { keyword } = req.query;
    if (!keyword || keyword.length < 2) {
        return res.json({ data: [] });
    }

    try {
        const token = await getAccessToken();
        const response = await axios.get('https://test.api.amadeus.com/v1/reference-data/locations', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                keyword: keyword,
                subType: 'CITY,AIRPORT',
                'page[limit]': 10
            }
        });

        const locations = response.data.data || [];
        // Map to simple format
        const formatted = locations.map(loc => ({
            name: loc.name,
            iataCode: loc.iataCode,
            type: loc.subType, // CITY or AIRPORT
            detailedName: loc.detailedName,
            country: loc.address?.countryName
        }));

        res.json({ data: formatted });

    } catch (error) {
        console.error('Location API Error:', error.response?.data || error.message);
        res.json({ data: [] }); // Fail gracefully for suggestions
    }
});

export default router;
