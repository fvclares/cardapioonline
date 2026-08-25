// Test Supabase Connection & Run Schema
import { supabase, testConnection } from './supabase-config.js';

async function main() {
  console.log('🔌 Testando conexão com Supabase...\n');
  
  const result = await testConnection();
  
  if (!result.success) {
    console.error('❌ Falha na conexão. Verifique URL e Key.');
    process.exit(1);
  }
  
  console.log('\n✅ Conexão OK! Schema pode ser aplicado.');
  console.log('\n⚠️  Para aplicar o schema, execute o SQL no Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/lgeeaolymwtauasppkla/sql');
  console.log('\n   Cole o conteúdo de supabase-schema.sql e clique em RUN.');
}

main();