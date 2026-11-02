# MozForest Watch

**Observatório geoespacial de perda de cobertura arbórea — Zambézia, Moçambique.**

![status](https://img.shields.io/badge/release-research%20preview-9bd88a)
![stack](https://img.shields.io/badge/stack-React%20%7C%20FastAPI%20%7C%20Earth%20Engine-167a5a)

Uma aplicação WebGIS com mapa 2D (MapLibre GL), globo 3D (CesiumJS), análise de perda anual da cobertura arbórea, indicadores por distrito, composições Sentinel-2 e exportação CSV. **Não apresenta estatísticas simuladas.**

> **Estado:** código implementado, mas as estatísticas científicas e o acesso aos limites distritais só funcionam após configuração de um Google Cloud Project registado no Earth Engine. Deve-se verificar o alinhamento e a cobertura dos limites GAUL com a delimitação oficial nacional. Não é ainda um serviço operacional de alerta ou um produto validado por entidades moçambicanas.

## Funcionalidades

- Interface React moderna, responsiva, com navegação por secções.
- Mapa 2D com MapLibre, modo imagem de satélite e modo cartográfico.
- Visualização 3D opcional com CesiumJS **sobre globo elipsoidal**. O relevo 3D real requer configurar um provedor de terreno, além desta versão.
- Comparação lado a lado de dois anos em 2D.
- Camadas Earth Engine: perda anual, perda acumulada até ao ano, cobertura de copas 2000 e RGB Sentinel-2.
- Estatísticas anuais em hectares e gráfico de 2001 a 2025.
- Limiares ajustáveis de cobertura de copas em 2000 (10–80%).
- 9 distritos-alvo: Gilé, Mocuba, Ile, Gurué, Alto Molócuè, Maganja da Costa, Pebane, Mocubela, Mulevala.
- Validação de geometrias distritais sem substituir nomes ausentes por outros polígonos.
- Download de séries CSV, API REST documentada em `/docs`.
- Docker Compose, testes Python e CI GitHub Actions.

## Arquitectura

```text
Browser
  React + Vite
  ├─ MapLibre GL (2D + tiles GEE)
  ├─ CesiumJS (3D elipsoidal)
  └─ Recharts (séries anuais)
          │ HTTPS
          ▼
  Python + FastAPI
  ├─ validação de distritos
  ├─ estatísticas de perda florestal
  ├─ mapas e exportações
  └─ Earth Engine Python API
          │
          ▼
  Google Earth Engine
  ├─ Hansen v1.13 (2000–2025)
  ├─ Sentinel-2 SR Harmonized
  └─ FAO GAUL 2025 level 2
```

## Executar localmente

Requer **Python 3.11+**, **Node.js 22+**, um **projecto Google Cloud registado e autorizado no Earth Engine** e acesso à Google Earth Engine API.

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
earthengine authenticate
uvicorn app.main:app --reload --port 8000
```

No Windows, se `cp` não estiver disponível: `Copy-Item .env.example .env`.

Editar `backend/.env`:

```ini
GEE_PROJECT=id-real-do-seu-google-cloud-project
GEE_BOUNDARY_ASSET=FAO/GAUL/2025/level2
CORS_ORIGINS=http://localhost:5173
```

Para servidores utilizar **Application Default Credentials ou conta de serviço** com as permissões adequadas. Não enviar credenciais para o GitHub. Configuração `GEE_PROJECT` *não basta* sem autenticação.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Abrir <http://localhost:5173>. A API fica em <http://localhost:8000/docs>.

### 3. Docker

Coloque o ficheiro `backend/.env` com projecto e autenticação disponíveis no container e execute `docker compose up --build`. O frontend está em http://localhost:8080 e a API em http://localhost:8000. **Nota:** o Docker Compose não cria credenciais Earth Engine nem faz deploy automaticamente. Em produção, forneça credenciais via o ambiente seguro da cloud e configure o endereço público da API como `VITE_API_URL` na compilação do frontend.

### 4. Testes

```bash
cd backend
pytest -q
```

Os testes unitários não precisam do GEE. A integração end-to-end com dados reais requer projecto e credenciais de serviço.

## Principais endpoints

| Endpoint | Finalidade |
|---|---|
| `GET /api/health` | Configuração do backend |
| `GET /api/districts` | Validar distritos e devolver correspondências |
| `GET /api/series/{district}?threshold=30` | Série anual e métricas |
| `GET /api/tiles/{district}?year=2025&mode=loss_year&threshold=30` | URL temporário GEE raster |
| `GET /api/boundary/{district}` | GeoJSON do distrito |
| `GET /api/export/{district}.csv?threshold=30` | Exportar série histórica |

## Metodologia

**Perda de cobertura arbórea não significa necessariamente desflorestação permanente, ilegalidade nem emissão de carbono.** A camada Hansen `lossyear` representa perturbação de cobertura de árvores. O filtro `treecover2000 >= threshold` define a população de referência; `datamask == 1` remove áreas fora da máscara terrestre. As áreas são calculadas com `ee.Image.pixelArea()` em hectares e uma resolução de análise de 30 m.

Valores são específicos à versão do Hansen e ao limiar escolhido. O índice "percentagem de perda" tem como denominador a área inicial estimada de píxeis acima do limiar, não a área total do distrito. A interpretação requer validação independente. Ver [metodologia detalhada](docs/METHODOLOGY.md).

## Questões geográficas

FAO GAUL 2025 pode omitir distritos recentes, adoptar nomes diferentes ou reflectir delimitações diferentes das nacionais. O sistema **bloqueia** distritos não encontrados ou ambíguos. A variável `GEE_BOUNDARY_ASSET` permite substituir a fonte por um asset verificado, **desde que mantenha os campos** `ISO3_CODE`, `GAUL1_NAME`, `GAUL2_NAME` e `GAUL2_CODE`. Não atribuir automaticamente o polígono de um distrito antigo a um distrito novo.

## Fontes

- [Hansen Global Forest Change v1.13](https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2025_v1_13)
- [FAO GAUL 2025 nível 2](https://developers.google.com/earth-engine/datasets/catalog/FAO_GAUL_2025_level2)
- [Sentinel-2 SR Harmonized](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED)
- [Documentação Earth Engine](https://developers.google.com/earth-engine)

## Produção

A aplicação de demonstração não inclui autenticação, protecção contra abuso, quotas por utilizador ou tarefas assíncronas em fila. Não deve ser disponibilizada como serviço público de elevado tráfego sem estas medidas. Consulte [arquitectura](docs/ARCHITECTURE.md) e [roteiro de produção](docs/ROADMAP.md).

**Licenciamento:** ainda não foi escolhida uma licença para o código do projecto. Os conjuntos de dados, bibliotecas e serviços de terceiros mantêm os respectivos termos e licenças.
