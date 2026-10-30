'use strict';

const { col } = require('../config/mongo');
const { PIPELINE_MAS_VENDIDOS, PIPELINE_CRITICOS } = require('../queries/mql');

/** Consulta 04: productos más vendidos. */
const topProducts = () => col('pedidos').aggregate(PIPELINE_MAS_VENDIDOS).toArray();

/** Consulta 05: insumos críticos y los productos que los usan. */
const criticalSupplies = () => col('insumos').aggregate(PIPELINE_CRITICOS).toArray();

module.exports = { topProducts, criticalSupplies };
