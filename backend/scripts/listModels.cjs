// REMOVED: Backed up to removed_backup/backend/scripts/listModels.cjs — original contents archived.
  const svc = new LLMService(process.env.GEMINI_API_KEY || '');
  const result = await svc.listModels();
  console.log('listModels result:', result);
})().catch(err => { console.error(err); process.exit(1); });

i