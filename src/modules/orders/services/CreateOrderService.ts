import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';

import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExist = await this.customersRepository.findById(customer_id);
    if (!customerExist) {
      throw new AppError('Customer not found');
    }

    const productsListExist = await this.productsRepository.findAllById(
      products,
    );
    if (!productsListExist.length) {
      throw new AppError('Products not found');
    }

    const productsIds = productsListExist.map(p => p.id);

    const checkIdProductExit = products.filter(
      product => !productsIds.includes(product.id),
    );

    if (checkIdProductExit.length) {
      throw new AppError(`Product ${checkIdProductExit[0].id} not found`);
    }

    const checkQuantityProducts = products.filter(
      product =>
        productsListExist.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (checkQuantityProducts.length) {
      throw new AppError(
        `Product ${checkQuantityProducts[0].id} does not have enough quantity in stock`,
      );
    }

    const productsOrder = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsListExist.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExist,
      products: productsOrder,
    });

    const { order_products } = order;
    const orderProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productsListExist.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
