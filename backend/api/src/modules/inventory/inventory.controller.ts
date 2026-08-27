import type { RequestHandler } from 'express';
import { success } from '../../lib/response.js';
import type { InventoryService } from './inventory.service.js';
import type { AdjustmentInput } from './inventory.types.js';
export function inventoryController(service: InventoryService) {
  const stock: RequestHandler = (req, res, next) => {
    void service
      .listStock(req.tenant!.businessId, req.query)
      .then((data) => success(res, data))
      .catch(next);
  };
  const stockOne: RequestHandler = (req, res, next) => {
    void service
      .listStock(req.tenant!.businessId, {
        ...req.query,
        productId: String(req.params.productId),
        limit: 1,
      })
      .then((data) => success(res, data))
      .catch(next);
  };
  const movements: RequestHandler = (req, res, next) => {
    void service
      .listMovements(req.tenant!.businessId, req.query)
      .then((data) => success(res, data))
      .catch(next);
  };
  const adjustments: RequestHandler = (req, res, next) => {
    void service
      .listAdjustments(req.tenant!.businessId, req.query)
      .then((data) => success(res, data))
      .catch(next);
  };
  const adjustment: RequestHandler = (req, res, next) => {
    void service
      .findAdjustment(req.tenant!.businessId, String(req.params.id))
      .then((data) => success(res, data))
      .catch(next);
  };
  const createAdjustment: RequestHandler = (req, res, next) => {
    void service
      .createAdjustment(req.tenant!.businessId, req.auth!.id, req.body as AdjustmentInput)
      .then((data) => success(res, data, 201))
      .catch(next);
  };
  const lowStock: RequestHandler = (req, res, next) => {
    void service
      .listStock(req.tenant!.businessId, { ...req.query, lowStock: true })
      .then((data) => success(res, data))
      .catch(next);
  };
  const alerts: RequestHandler = (req, res, next) => {
    void service
      .listStock(req.tenant!.businessId, { ...req.query, alerts: true })
      .then((data) => success(res, data))
      .catch(next);
  };
  const warehouses: RequestHandler = (req, res, next) => {
    void service
      .listWarehouses(req.tenant!.businessId)
      .then((data) => success(res, data))
      .catch(next);
  };
  const serials: RequestHandler = (req, res, next) => {
    void service
      .listSerials(req.tenant!.businessId, req.query)
      .then((data) => success(res, data))
      .catch(next);
  };
  const serial: RequestHandler = (req, res, next) => {
    void service
      .findSerial(req.tenant!.businessId, String(req.params.id))
      .then((data) => success(res, data))
      .catch(next);
  };
  return {
    stock,
    stockOne,
    movements,
    adjustments,
    adjustment,
    createAdjustment,
    lowStock,
    alerts,
    warehouses,
    serials,
    serial,
  };
}
