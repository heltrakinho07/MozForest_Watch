# Roteiro de produção

## Implementado no código
- Dashboard React responsivo
- API Earth Engine em Python
- Hansen 2001–2025 com método documentado
- Distrito validado / distrito bloqueado
- MapLibre 2D e CesiumJS 3D elipsoidal
- Camadas anuais, cumulativas, cobertura 2000, Sentinel-2 RGB
- Comparação anual lado a lado
- CSV, documentação OpenAPI e testes unitários

## Dependente de ambiente / validação
- Projecto Google Cloud registado e autorizado no Earth Engine
- Autenticação backend e permissões de serviço
- Validação efectiva de nomes e geometrias dos 9 distritos
- Teste extremo-a-extremo com resultados numéricos verificados
- Revisão visual do build frontend via CI
- Configuração do hosting, API pública, CORS e HTTPS

## Próximos módulos
- Limites administrativos nacionais actualizados, áreas de conservação, intersecções espaciais
- Sentinel-2 NDVI/NBR, comparação anual com amostras de validação
- Detecção de mudanças recente: alertas verificados com data, qualidade e confirmação humana
- Séries por conjunto de distritos, ranking e exportação de relatórios
- Gestão de utilizadores, autenticação, cache e jobs
- Exportação GeoTIFF, GeoPackage, PDFs com referências de dados
- 3D com relevo real (provedor de terreno e licença) e perfis topográficos
- Monitorização de custos, quotas e desempenho
