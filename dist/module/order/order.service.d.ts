import { CreateOrderInput, UpdateOrderStatusInput, Order, PaginatedOrders, OrderStats, OrderQuery } from "./order.type";
export declare class OrderService {
    getAllOrders(query: OrderQuery): Promise<PaginatedOrders>;
    getOrderById(id: string): Promise<Order | null>;
    createOrder(data: CreateOrderInput): Promise<Order>;
    updateOrderStatus(id: string, data: UpdateOrderStatusInput): Promise<Order | null>;
    getOrderStats(): Promise<OrderStats>;
    claimGuestOrders(userId: string, email: string): Promise<void>;
    getUserOrders(userId: string, email: string, query: Omit<OrderQuery, 'userId'>): Promise<PaginatedOrders>;
}
//# sourceMappingURL=order.service.d.ts.map