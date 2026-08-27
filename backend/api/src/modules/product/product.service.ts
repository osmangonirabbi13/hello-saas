import { AppError } from '../../common/errors/app-error.js';
import type { ProductInput, ProductRepositoryContract } from './product.types.js';
export class ProductService {
  constructor(private readonly repository: ProductRepositoryContract) {}
  async create(businessId: string, userId: string, input: ProductInput) {
    const masters = await this.repository.masters(businessId, input);
    if (!masters.valid)
      throw new AppError(
        422,
        'INVALID_MASTER_RELATION',
        masters.reason ?? 'Invalid product master.',
      );
    if (await this.repository.duplicate(businessId, input.sku, input.barcode))
      throw new AppError(409, 'DUPLICATE_PRODUCT_IDENTIFIER', 'SKU or barcode already exists.');
    return this.repository.create(businessId, userId, input);
  }
  list(businessId: string, query: Record<string, unknown>) {
    return this.repository.list(businessId, query);
  }
  async lookupBarcode(businessId: string, barcode: string) {
    const item = await this.repository.findByBarcode(businessId, barcode.trim());
    if (!item) throw new AppError(404, 'BARCODE_NOT_FOUND', 'No product matches this barcode.');
    if (!item.isActive)
      throw new AppError(409, 'PRODUCT_INACTIVE', 'The scanned product is inactive.');
    return item;
  }
  async find(businessId: string, id: string) {
    const item = await this.repository.find(businessId, id);
    if (!item) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
    return item;
  }
  async update(businessId: string, id: string, input: Partial<ProductInput>) {
    const item = await this.repository.update(businessId, id, input);
    if (!item) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
    return item;
  }
  async deactivate(businessId: string, id: string) {
    if (!(await this.repository.deactivate(businessId, id)))
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
    return { deactivated: true };
  }
}
