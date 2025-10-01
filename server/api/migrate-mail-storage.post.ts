/**
 * Migration endpoint to convert existing mail storage to unified format
 * This should be run once to migrate existing data
 */
import { mailStorage } from '../utils/mailStorage'

export default defineEventHandler(async (event) => {
  try {
    console.log('Starting mail storage migration...')
    
    // Run the migration
    await mailStorage.migrateExistingData()
    
    console.log('Mail storage migration completed successfully')
    
    return {
      ok: true,
      message: 'Mail storage migration completed successfully'
    }
  } catch (error) {
    console.error('Mail storage migration failed:', error)
    
    return {
      ok: false,
      error: String(error)
    }
  }
})
