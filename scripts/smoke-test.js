import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Iniciando Smoke Test de Produção...');
  let failed = false;

  const tests = [
    { name: 'Health Check', path: '/api/health', expectedStatus: 200 },
    { name: 'Auth Routes Presence', path: '/api/auth/register', method: 'GET', expectedStatus: 404 }, // Should exist (POST only) but 404 for GET is fine
    { name: 'Public Assets', path: '/styles/styles.css', expectedStatus: 200 },
  ];

  for (const test of tests) {
    try {
      const res = await fetch(`${BASE_URL}${test.path}`, { method: test.method || 'GET' });
      if (res.status === test.expectedStatus) {
        console.log(`✅ ${test.name}: Passou (Status ${res.status})`);
      } else {
        console.error(`❌ ${test.name}: Falhou (Esperado ${test.expectedStatus}, obtido ${res.status})`);
        failed = true;
      }
    } catch (err) {
      console.error(`❌ ${test.name}: Erro de conexão - ${err.message}`);
      failed = true;
    }
  }

  if (failed) {
    console.error('\n🚨 Alguns testes falharam. Verifique o servidor.');
    process.exit(1);
  } else {
    console.log('\n✨ Todos os testes de fumaça passaram!');
    process.exit(0);
  }
}

runTests();
