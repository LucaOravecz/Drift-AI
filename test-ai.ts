import { callClaude, callClaudeJSON } from './src/lib/services/ai.service';

async function testAI() {
  const organizationId = process.env.ORGANIZATION_ID ?? 'org-demo';

  console.log('--- Testing callClaude ---');
  try {
    const response = await callClaude(
      'You are a helpful assistant.',
      'Say hello world in a unique way.',
      { feature: 'GENERAL', maxTokens: 100, organizationId },
    );
    console.log('Response:', response);
  } catch (err) {
    console.error('callClaude failed:', err);
  }

  console.log('\n--- Testing callClaudeJSON ---');
  try {
    const jsonResponse = await callClaudeJSON<{ greeting: string }>(
      'Return a JSON object with a greeting.',
      'Suggest a greeting for a financial client.',
      { feature: 'GENERAL', maxTokens: 100, organizationId, schema: {
        type: 'object',
        properties: { greeting: { type: 'string' } },
        required: ['greeting'],
      }},
    );
    console.log('JSON Response:', jsonResponse);
  } catch (err) {
    console.error('callClaudeJSON failed:', err);
  }
}

// Note: This script requires ANTHROPIC_API_KEY to be set in shell or .env
testAI();
