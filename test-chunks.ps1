# Script de prueba para Windows PowerShell

Write-Host "🚀 Probando generateQuestionsFromChunks..." -ForegroundColor Cyan
Write-Host ""

# Leer el archivo de prueba
$requestBody = Get-Content -Path "test-request.json" -Raw

# IMPORTANTE: Cambia 'firebasefunctions-82fc0' por tu project ID
$url = "http://localhost:5001/firebasefunctions-82fc0/us-central1/generateQuestionsFromChunks"

Write-Host "📊 Enviando petición a: $url" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $requestBody -ContentType "application/json"

    if ($response.success) {
        Write-Host "✅ SUCCESS!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📈 Metadata:" -ForegroundColor Cyan
        Write-Host "   Total preguntas: $($response.metadata.total_questions)"
        Write-Host "   Chunks procesados: $($response.metadata.total_chunks_processed)"
        Write-Host "   Distribución: $($response.metadata.questions_per_chunk -join ', ')"
        Write-Host ""
        Write-Host "🔍 Primeras 2 preguntas:" -ForegroundColor Cyan

        for ($i = 0; $i -lt [Math]::Min(2, $response.data.questions.Length); $i++) {
            $q = $response.data.questions[$i]
            Write-Host ""
            Write-Host "   $($i + 1). $($q.question)"
            Write-Host "      Chunk: $($q.chunk_id) ($($q.chunk_type))"
            Write-Host "      Opciones: $($q.options.Length)"
        }

        # Guardar respuesta completa
        $response | ConvertTo-Json -Depth 10 | Out-File -FilePath "test-response.json" -Encoding UTF8
        Write-Host ""
        Write-Host "💾 Respuesta completa guardada en: test-response.json" -ForegroundColor Green

    } else {
        Write-Host "❌ ERROR:" -ForegroundColor Red
        Write-Host $response.error
    }

} catch {
    Write-Host "❌ Error en la petición: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Asegúrate de que los emuladores estén corriendo:" -ForegroundColor Yellow
    Write-Host "   npm run serve"
}
