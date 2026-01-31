// REMOVED: Backed up to removed_backup/backend/scripts/testGenerate.cjs — original contents archived.
  const apiKey = process.env.GEMINI_API_KEY || '';
  const svc = new LLMService(apiKey);
  try {
    const transcript = process.argv[2] || 'Discuss next steps and assign action items: Alice to write specs, Bob to review.';
    const tasks = await svc.generateTasks(transcript);
    console.log('Generated tasks:', JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error('Error generating tasks:', err);
    process.exitCode = 1;
  }
})();
