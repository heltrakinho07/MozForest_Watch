# Metodologia de monitorização florestal

## População de referência

- `treecover2000`: percentagem de fecho de copas de árvores acima de 5 m, ano 2000.
- Limiar configurável: apenas pixels com `treecover2000 >= threshold`.
- `datamask == 1`: terra válida.
- Perda anual identificada pela banda `lossyear` (1 significa 2001; 25 significa 2025).
- Produto: Hansen Global Forest Change v1.13, pixel nominal ~30 m.

## Estatísticas

`sum(pixelArea / 10000 | baseline_mask && lossyear == year-2000)` em hectares.

A soma acumulada equivale à soma das perdas anuais filtradas desde 2001 até 2025. A percentagem calculada é o total de perda filtrada dividido pela área de pixels com copas >= limiar em 2000.

Na implementação usamos `ee.Reducer.sum().group(groupField=1)`, agregando todos os anos numa única operação de redução espacial. A área inicial é calculada em operação separada e utiliza a mesma área de estudo e escala.

## Limitações e validação

1. "Perda" não implica que a área seja uma floresta natural nem prova ilegalidade, causa antropogénica, emissões, degradação ou ausência de regeneração.
2. Pixels classificados têm erros de omissão e comissão; comparar com amostras de interpretação visual e dados nacionais.
3. O ano do evento pode diferir do calendário local de intervenção; verificar produtos de referência.
4. Os limites FAO GAUL podem não corresponder aos distritos administrativos actuais de Moçambique. Validar antes de análises institucionais.
5. Composição Sentinel-2 RGB é uma referência visual: pode ter variações sazonais e nuvens residuais; não é por si só evidência de perda Hansen.
6. O mapa 3D nesta versão tem globo elipsoidal, não levantamento do terreno.

## Plano de controlo de qualidade

- Verificar se cada distrito é uma entidade espacial única.
- Comparar resultados anuais com pelo menos duas referências independentes.
- Inspeccionar amostras de perda e não perda estratificadas por distrito.
- Relatar matriz de confusão, precisão, revocação e intervalos de confiança quando a amostragem permitir.
- Confrontar relatórios do FNDS, inventários nacionais e cartografia de conservação antes de relatar resultados oficiais.
