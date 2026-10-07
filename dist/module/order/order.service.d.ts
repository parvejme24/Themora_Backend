import { CreateOrderInput, UpdateOrderStatusInput, Order, PaginatedOrders, OrderStats, OrderQuery } from "./order.type";
export declare class OrderService {
    getAllOrders(query: OrderQuery): Promise<PaginatedOrders>;
    getOrderById(id: string): Promise<Order | null>;
    createOrder(data: CreateOrderInput): Promise<Order>;
    updateOrderStatus(id: string, data: UpdateOrderStatusInput): Promise<Order | null>;
    getOrderStats(): Promise<OrderStats>;
    claimGuestOrders(userId: string, email: string): Promise<void>;
    getUserOrders(userId: string, email: string, query: Omit<OrderQuery, 'userId'>): Promise<PaginatedOrders>;
    getTopSellingTemplates(limit?: number): Promise<({
        template: {
            id: string;
            title: string;
            price: number;
            imageUrl: string | null;
            shortDescription: string;
            categoryName: string | undefined;
        };
        totalOrders: number;
        totalRevenue: number;
    } | null)[]>;
}
export declare const orderService: OrderService;
//# sourceMappingURL=order.service.d.ts.map