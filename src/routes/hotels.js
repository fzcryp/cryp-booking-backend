import express from "express";
import axios from "axios";
import db from "../config/db.js";

const router = express.Router();

// Amadeus Crendentials (Should be in .env in production)
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
        console.log('Fetching new Access Token...');
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

// Search Endpoint - Returns ALL hotels (Merged Data)
// Mounted at /api/hotels in index.js, so this handles GET /api/hotels
router.get('/', async (req, res) => {
    let { city, checkIn, checkOut, adults, page = 1, limit = 100, sort, stars, amenities } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required' });

    try {
        const token = await getAccessToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // ... Step 0 (Resolve City) ...
        if (city.length !== 3) {
             const geoResponse = await axios.get('https://test.api.amadeus.com/v1/reference-data/locations', {
                headers,
                params: { keyword: city, subType: 'CITY', 'page[limit]': 1 }
            });
            if (geoResponse.data.data && geoResponse.data.data.length > 0) {
                city = geoResponse.data.data[0].iataCode;
            } else {
                return res.json({ data: [] });
            }
        }
        city = city.toUpperCase();

        // Step 1: Get ALL hotels in city (Reference Data)
        // CACHING IMPLEMENTATION
        const CACHE_DURATION = 1000 * 60 * 60; // 1 Hour
        
        // Construct API Params for filtering at source
        const apiParams = { cityCode: city };
        
        // Handle Stars -> ratings
        if (stars) {
             const requestedStars = stars.split(',').filter(s => !isNaN(parseInt(s)));
             if (requestedStars.length > 0) {
                 apiParams.ratings = requestedStars.join(',');
             }
        }

        // Handle Amenities (Amadeus expects codes, but we might be passing names. 
        // We will pass them through. If API needs specific codes, we might need a mapping. 
        // For now assuming API matches loose or we rely on common names)
        if (amenities) {
             // Amadeus mostly uses specific codes like "SWIMMING_POOL", "SPA". 
             // Our frontend sends "SWIMMING POOL". We need to ensure format matches API expectation if possible.
             // Replacing spaces with underscores usually helps.
             apiParams.amenities = amenities.toUpperCase().split(',').map(a => a.trim().replace(/\s+/g, '_')).join(',');
        }

        // Unique Cache Key per filter combination
        const paramKey = JSON.stringify(apiParams);
        const cacheKey = `hotels_list_${city}_${paramKey}`;
        
        // Simple global cache (Note: Reset on server restart)
        if (!global.hotelListCache) global.hotelListCache = {};

        let allHotels = [];
        const cached = global.hotelListCache[cacheKey];

        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            console.log(`1. Using CACHED hotel list for ${city} (Params: ${paramKey})`);
            allHotels = cached.data;
        } else {
            console.log(`1. Fetching FRESH hotel list for ${city} from Amadeus (Params: ${JSON.stringify(apiParams)})...`);
            try {
                const listResponse = await axios.get(`https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city`, {
                    headers,
                    params: apiParams
                });
                allHotels = listResponse.data.data || [];
            } catch (err) {
                console.error("Error fetching hotel list (might be invalid filter):", err.response?.data || err.message);
                // If filter fails (e.g., invalid amenity code), return empty or fallback? 
                // Return empty is safer.
                allHotels = [];
            }
            
            // Save to Cache
            if (allHotels.length > 0) {
                global.hotelListCache[cacheKey] = {
                    data: allHotels,
                    timestamp: Date.now()
                };
            }
        }

        // --- FILTERING (Pre-Pricing) ---
        // API filtering is used now.
        // Manual filtering removed to avoid double filtering and because API data might lack fields.

        if (allHotels.length === 0) {
            return res.json({ data: [], meta: { total: 0 } });
        }
        console.log(`   Found ${allHotels.length} hotels after filtering. Fetching page ${page} (Limit: ${limit}).`);

        // Step 2: Pagination & Pricing
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;

        const hotelsToPrice = allHotels.slice(startIndex, endIndex); 
        
        // Chunking for Price API (Amadeus limits to ~50-100 per call usually, staying safe with 20)
        const chunkedIds = [];
        for (let i = 0; i < hotelsToPrice.length; i += 20) {
           chunkedIds.push(hotelsToPrice.slice(i, i + 20).map(h => h.hotelId));
        }

        const guestCount = parseInt(adults) || 1;
        console.log(`2. Pricing ${hotelsToPrice.length} hotels (Dates: ${checkIn||'-'} to ${checkOut||'-'})...`);
        
        const priceParams = { 
            roomQuantity: 1,
            adults: guestCount
        };
        if (checkIn) priceParams.checkInDate = checkIn;
        if (checkOut) priceParams.checkOutDate = checkOut;

        const pricePromises = chunkedIds.map(ids => 
            axios.get(`https://test.api.amadeus.com/v3/shopping/hotel-offers`, {
                headers,
                params: { 
                    hotelIds: ids.join(','), 
                    ...priceParams 
                }
            }).catch(err => ({ data: { data: [] } })) 
        );

        const priceResults = await Promise.all(pricePromises);
        
        // Create a Map of Priced Offers
        const offerMap = new Map();
        priceResults.forEach(res => {
            const offers = res.data?.data || [];
            offers.forEach(offer => {
                offerMap.set(offer.hotel.hotelId, offer);
            });
        });

        // Step 3: Merge Data
        let mergedData = hotelsToPrice.map(refHotel => {
            const offerData = offerMap.get(refHotel.hotelId);
            if (offerData) {
                return offerData; 
            } else {
                return {
                    hotel: {
                        name: refHotel.name,
                        cityCode: refHotel.cityCode,
                        hotelId: refHotel.hotelId,
                        latitude: refHotel.geoCode?.latitude,
                        longitude: refHotel.geoCode?.longitude,
                        address: refHotel.address,
                        rating: refHotel.rating // Ensure rating is passed through for UI if not in offer
                    },
                    offers: [] 
                };
            }
        });

        // --- SORTING (Post-Pricing) ---
        if (sort) {
            if (sort === 'price_asc') {
                mergedData.sort((a, b) => {
                    const priceA = a.offers?.[0]?.price?.total ? parseFloat(a.offers[0].price.total) : Infinity;
                    const priceB = b.offers?.[0]?.price?.total ? parseFloat(b.offers[0].price.total) : Infinity;
                    return priceA - priceB;
                });
            } else if (sort === 'price_desc') {
                mergedData.sort((a, b) => {
                    // Treat no-price (Infinity) as last? Or first? Usually no-price items should be at bottom.
                    // If descending, we want high prices first. No price = 0 for sort?
                    const priceA = a.offers?.[0]?.price?.total ? parseFloat(a.offers[0].price.total) : -1;
                    const priceB = b.offers?.[0]?.price?.total ? parseFloat(b.offers[0].price.total) : -1;
                    return priceB - priceA;
                });
            }
            // 'relevant' is default (no sort change)
        }

        // Return Data + Meta for Pagination
        res.json({ 
            data: mergedData,
            meta: {
                total: allHotels.length,
                page: pageNum,
                limit: limitNum
            }
        });

    } catch (error) {
        console.error('Search API Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch hotels' });
    }
});

export default router;
