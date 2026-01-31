// REMOVED: Backed up to removed_backup/backend/scripts/hf_infer.cjs — original contents archived.

  console.log('Using API key from', process.env.HF_API_KEY ? 'HF_API_KEY' : process.env.HUGGINGFACE_API_KEY ? 'HUGGINGFACE_API_KEY' : 'GEMINI_API_KEY');
  const hf = new HfInference({ apiKey: key });

  try {
    // Use a small text-generation model for a quick test. Change model as desired.
    const model = 'gpt2';
    console.log('Calling HF model:', model);
    const output = await hf.textGeneration({ model, inputs: 'Hello from Hugging Face — generate one sentence:' });
    console.log('HF response:', output);
  } catch (err) {
    console.error('HF inference error:', err);
    process.exit(1);
  }
})();
