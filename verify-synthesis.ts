import { SynthesisService } from './src/lib/services/synthesis.service'
import prisma from './src/lib/db'

async function verifySynthesis() {
  console.log('--- STARTING SYNTHESIS VERIFICATION ---')
  
  // 1. Get a test client
  const client = await prisma.client.findFirst()
  if (!client) {
    console.error('No client found in DB to test.')
    return
  }
  
  console.log(`Testing with client: ${client.name} (${client.id})`)
  
  try {
    // 2. Fetch Comprehensive Profile
    const profile = await SynthesisService.getComprehensiveProfile(client.id)
    console.log('✓ Comprehensive Profile Fetched')
    
    // 3. Serialize for AI
    const aiPayload = SynthesisService.serializeForAI(profile)
    console.log('✓ AI Payload Serialized')
    
    const parsed = JSON.parse(aiPayload)
    
    // 4. Verify cross-referencing structure
    console.log('--- Payload Structure Check ---')
    console.log('Identity:', !!parsed.identity)
    console.log('Intelligence:', !!parsed.intelligence)
    console.log('Active Intelligence Keys:', Object.keys(parsed.activeIntelligence))
    console.log('Behavior & Timing:', !!parsed.behaviorAndTiming)
    console.log('History Notes (Length):', parsed.historyNotes.length)
    
    if (parsed.identity && parsed.intelligence && parsed.behaviorAndTiming) {
      console.log('✓ Synthesis structure is robust and includes multiple data points.')
    } else {
      console.error('✗ Missing critical synthesis blocks.')
    }
  } catch (error) {
    console.error('✗ Verification failed:', error)
  }
}

verifySynthesis()
