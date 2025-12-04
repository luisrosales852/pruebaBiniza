const fs = require('fs');
const https = require('https');
const http = require('http');

// Leer el archivo de prueba
const requestData = JSON.parse(fs.readFileSync('./test-request.json', 'utf8'));

// Configuración para emulador local
const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/firebasefunctions-82fc0/us-central1/generateQuestionsFromChunks', // Cambia 'firebasefunctions-82fc0' por tu project ID
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

console.log('🚀 Enviando petición a Firebase Emulator...\n');
console.log('📊 Parámetros:');
console.log(`   - Nivel educativo: ${requestData.educational_level}`);
console.log(`   - Preguntas totales: ${requestData.number_of_questions}`);
console.log(`   - Chunks: ${requestData.chunks.length}`);
console.log(`   - Distribución esperada: ${Math.floor(requestData.number_of_questions / requestData.chunks.length)} preguntas por chunk\n`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✅ Respuesta recibida:\n');
    const response = JSON.parse(data);

    if (response.success) {
      console.log('✨ SUCCESS!\n');
      console.log('📈 Metadata:');
      console.log(JSON.stringify(response.metadata, null, 2));
      console.log(`\n📝 Preguntas generadas: ${response.data.questions.length}`);
      console.log('\n🔍 Primeras 2 preguntas:');
      response.data.questions.slice(0, 2).forEach((q, i) => {
        console.log(`\n${i + 1}. ${q.question}`);
        console.log(`   Chunk: ${q.chunk_id} (${q.chunk_type})`);
        console.log(`   Opciones: ${q.options.length}`);
      });

      // Guardar respuesta completa
      fs.writeFileSync('./test-response.json', JSON.stringify(response, null, 2));
      console.log('\n💾 Respuesta completa guardada en: test-response.json');
    } else {
      console.log('❌ ERROR:');
      console.log(JSON.stringify(response, null, 2));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error en la petición:', error.message);
  console.log('\n💡 Asegúrate de que los emuladores estén corriendo:');
  console.log('   npm run serve');
});

req.write(JSON.stringify(requestData));
req.end();
