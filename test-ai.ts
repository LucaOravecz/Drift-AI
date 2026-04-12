import { callClaude, callClaudeJSON } from './src/lib/services/ai.service';

async function testAI() {
  console.log('--- Testing callClaude ---');
  try {
    const response = await callClaude('You are a helpful assistant.', 'Say hello world in a unique way.', 100);
    console.log('Response:', response);
  } catch (err) {
    console.error('callClaude failed:', err);
  }

  console.log('\n--- Testing callClaudeJSON ---');
  try {
    const jsonResponse = await callClaudeJSON<{ greeting: string }>(
      'Return a JSON object with a greeting.',
      'Suggest a greeting for a financial client.',
      100
    );
    console.log('JSON Response:', jsonResponse);
  } catch (err) {
    console.error('callClaudeJSON failed:', err);
  }
}

// Note: This script requires ANTHROPIC_API_KEY to be set in shell or .env
testAI();
