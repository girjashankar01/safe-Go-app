import express from 'express';
import db from '../config/supabase.js';

const router = express.Router();

/**
 * GET /emergency-services
 * Accepts query params: country (e.g. IN), state (e.g. Karnataka), city (e.g. Bengaluru), lat, lng
 * Returns emergency services resolved by priority, falling back to national services.
 */
router.get('/emergency-services', async (req, res) => {
  const { country, state, city } = req.query;

  if (!country) {
    return res.status(400).json({ error: 'Country parameter is required' });
  }

  try {
    // 1. Fetch all active services for the country
    // Using service role key (db) so we bypass RLS and don't need user context
    const { data: services, error } = await db
      .from('emergency_services')
      .select('*')
      .eq('country_code', country)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) {
      console.error('[Directory] Error querying emergency_services:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!services || services.length === 0) {
      return res.json([]);
    }

    // 2. Perform resolution priority in-memory
    // Priority 1: Exact match (country + state + city)
    // Priority 2: State match (country + state, city is null)
    // Priority 3: National match (country, state is null, city is null)
    
    let resolvedServices = [];
    
    // Check for City match
    const cityMatches = services.filter(
      (s) => s.state?.toLowerCase() === state?.toLowerCase() && s.city?.toLowerCase() === city?.toLowerCase()
    );
    
    // Check for State match
    const stateMatches = services.filter(
      (s) => s.state?.toLowerCase() === state?.toLowerCase() && !s.city
    );
    
    // Check for National match
    const nationalMatches = services.filter(
      (s) => !s.state && !s.city
    );

    // Build the final list with highest priority first, eliminating exact duplicates by service_type or phone_number
    const addServices = (matches) => {
      matches.forEach(match => {
        // Only add if we don't already have this exact service type/number combination
        const exists = resolvedServices.some(
          (rs) => (rs.service_type === match.service_type && rs.phone_number === match.phone_number)
        );
        if (!exists) {
          resolvedServices.push(match);
        }
      });
    };

    if (city && state) {
      addServices(cityMatches);
    }
    
    if (state) {
      addServices(stateMatches);
    }

    // Mandatory fallback: ALWAYS include national numbers if no exact matches, 
    // or even if there are local matches, national numbers should be available.
    addServices(nationalMatches);

    // Sort the final result by the explicit priority field
    resolvedServices.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    res.json(resolvedServices);
  } catch (err) {
    console.error('[Directory] Exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
