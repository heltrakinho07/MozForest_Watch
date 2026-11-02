# Arquitectura técnica

## Componentes

Frontend React + Vite, MapLibre GL JS para mapas 2D, CesiumJS em carregamento dinâmico para globo 3D e Recharts para estatísticas temporais. Backend FastAPI com EE Python SDK e autenticação server-side.

## Processo de dados

1. `GET /api/districts` consulta metadados de atributos administrativos, sem descarregar toda a geometria nacional.
2. O backend normaliza grafias dos nove distritos. Sem correspondência única, bloqueia o distrito.
3. `/api/series` obtém área do referencial 2000 e perdas anuais via reducer agrupado.
4. `/api/tiles` emite URL de mosaicos temporário do Earth Engine; a aplicação não guarda nem expõe credenciais de serviço.
5. MapLibre e Cesium consomem os mosaicos de forma efémera. O CSV contém apenas estatísticas verificadas.

## Segurança e operações

Para produção: gestão de identidades e autorizações, limitação de pedidos, cache persistente, jobs assíncronos, observabilidade, protecção da API e segregação de contas. O GEE está sujeito a quotas e condições de uso. Frontend não pode guardar segredos do Google Cloud.

## Cesium

O modo 3D usa um globo elipsoidal e base cartográfica OSM; relevo físico real depende de provedor de terreno configurado e licenças apropriadas. A biblioteca é carregada apenas quando o utilizador abre a vista 3D.
