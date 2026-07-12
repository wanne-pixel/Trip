import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { supabase } from '../config/supabase';

async function runMigration() {
  console.log('Starting migration to add start_date to old trips...');

  // 1. Fetch all trips
  const { data: trips, error: fetchError } = await supabase.from('trips').select('*');
  
  if (fetchError) {
    console.error('Error fetching trips:', fetchError);
    return;
  }

  if (!trips || trips.length === 0) {
    console.log('No trips found.');
    return;
  }

  let updatedCount = 0;

  for (const trip of trips) {
    // If it already has start_date, skip
    if (trip.metadata && trip.metadata.start_date) {
      continue;
    }

    console.log(`Processing trip: ${trip.title} (ID: ${trip.id})`);

    // 2. Fetch photos for this trip
    const { data: photos, error: photoError } = await supabase
      .from('photos')
      .select('taken_at')
      .eq('trip_id', trip.id);

    if (photoError) {
      console.error(`Error fetching photos for trip ${trip.id}:`, photoError);
      continue;
    }

    if (!photos || photos.length === 0) {
      console.log(`  No photos found for trip ${trip.id}. Skipping.`);
      continue;
    }

    // 3. Find earliest valid taken_at
    const validDates = photos
      .map(p => p.taken_at)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .map(t => new Date(t))
      .filter(d => !isNaN(d.getTime()));

    if (validDates.length === 0) {
      console.log(`  No valid EXIF taken_at found for trip ${trip.id}. Skipping.`);
      continue;
    }

    const minDate = new Date(Math.min(...validDates.map(d => d.getTime())));
    console.log(`  Found earliest date: ${minDate.toISOString()}`);

    // 4. Update trip metadata
    const newMetadata = {
      ...(trip.metadata || {}),
      start_date: minDate.toISOString(),
    };

    const { error: updateError } = await supabase
      .from('trips')
      .update({ metadata: newMetadata })
      .eq('id', trip.id);

    if (updateError) {
      console.error(`  Error updating trip ${trip.id}:`, updateError);
    } else {
      console.log(`  Successfully updated trip ${trip.id}.`);
      updatedCount++;
    }
  }

  console.log(`Migration finished! Updated ${updatedCount} trips.`);
}

runMigration().catch(err => {
  console.error('Migration failed with exception:', err);
});
