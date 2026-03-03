"use server";

import api from "@/lib/woocommerce";
import { Product, Order, CartItem } from "@/lib/store";
import { requireRole } from "@/lib/session";

// WooCommerce Server Actions
// Consolidated into sync-service for heavy operations

export async function createWooCommerceOrder(orderData: any) {
    await requireRole(["ADMIN", "CASHIER"]); // 🔒
    
    // 1. Idempotency Check: Prevent duplicate orders
    const posOrderId = orderData.meta_data?.find((m: any) => m.key === 'pos_order_id')?.value;
    
    if (posOrderId) {
        try {
            console.log(`[Idempotency] Searching WooCommerce for existing order with POS ID: ${posOrderId}`);
            // Search specifically for this POS ID
            const searchResp = await api.get("orders", {
                search: posOrderId,
                status: 'any',
                per_page: 5
            });

            // Verify metadata because search is fuzzy
            const duplicate = searchResp.data.find((o: any) => 
                o.meta_data.some((m: any) => m.key === 'pos_order_id' && m.value === posOrderId)
            );

            if (duplicate) {
                console.log(`[Idempotency] POS ID ${posOrderId} found! WC Order #${duplicate.id}. Skipping creation.`);
                return duplicate;
            }
        } catch (err) {
            console.error("[Idempotency] Error searching for duplicates:", err);
            // We continue to avoid blocking the sale if the search fails
        }
    }

    try {
        const response = await api.post("orders", orderData);
        return response.data;
    } catch (error) {
        console.error("Error creating WooCommerce order:", error);
        throw error;
    }
}

export async function getWooCommerceOrders(
    page: number = 1, 
    per_page: number = 20, 
    status: string = 'completed',
    after?: string,
    before?: string
): Promise<Order[]> {
    await requireRole(["ADMIN", "CASHIER"]); // 🔒
    try {
        const response = await api.get("orders", {
            per_page,
            page,
            status,
            after,
            before
        });

        return response.data.map((order: any) => ({
            id: String(order.id),
            date: (order.date_created_gmt || order.date_created || new Date().toISOString()) + "Z",
            items: order.line_items.map((item: any) => ({
                id: String(item.product_id),
                name: item.name,
                price: item.price ? parseFloat(item.price) : 0, // Note: WC line items might not have unitary price easily accessible depending on version, but usually 'price' or 'subtotal' / quantity
                quantity: item.quantity,
                sku: item.sku || '',
                type: item.variation_id ? 'variable' : 'simple',
                stock: 0, // Not available in order line item
                variantId: item.variation_id ? String(item.variation_id) : undefined,
                variantName: item.meta_data?.find((m: any) => m.key === 'pa_color' || m.key === 'pa_size')?.value || order.line_items.length > 1 ? '' : '', // Simplification
            })),
            total: parseFloat(order.total),
            subtotal: parseFloat(order.total) - parseFloat(order.total_tax), // Approx
            tax: parseFloat(order.total_tax),
            discount: parseFloat(order.discount_total),
            paymentMethod: order.payment_method_title,
             // Check if it was created by POS
             isPosOrder: order.meta_data.some((m: any) => m.key === 'pos_order_id'),
             posOrderId: order.meta_data.find((m: any) => m.key === 'pos_order_id')?.value
        }));
    } catch (error) {
        console.error("Error fetching WooCommerce orders:", error);
        return [];
    }
}

export async function getWooCommerceCustomers(search: string = "") {
    await requireRole(["ADMIN", "CASHIER"]); // 🔒
    try {
        const response = await api.get("customers", {
            search,
            per_page: 20
        });
        
        return response.data.map((c: any) => ({
            id: c.id,
            name: `${c.first_name} ${c.last_name} (${c.email})`,
            email: c.email,
            firstName: c.first_name,
            lastName: c.last_name
        }));
    } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
    }
}

export async function getProductVariants(productId: string) {
    await requireRole(["ADMIN", "CASHIER"]); // 🔒
    try {
        const response = await api.get(`products/${productId}/variations`, {
            per_page: 100
        });
        return response.data.map((v: any) => ({
            id: String(v.id),
            name: v.attributes.map((a: any) => a.option).join(", ") || "Default",
            price: parseFloat(v.price) || 0,
            stock: v.manage_stock ? (v.stock_quantity || 0) : 999,
            sku: v.sku
        }));
    } catch (error) {
        console.error(`Error fetching variants for product ${productId}:`, error);
        return [];
    }
}

export async function updateWooCommerceOrderStatus(orderId: string, status: string) {
    await requireRole(["ADMIN"]); // 🔒 Admin only — cashiers cannot update order status
    try {
        const response = await api.put(`orders/${orderId}`, {
            status: status
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating order ${orderId} status to ${status}:`, error);
        throw error;
    }
}

export interface StockValidationResult {
    valid: boolean;
    errors: {
        id: string;
        name: string;
        requested: number;
        available: number;
        reason: string;
    }[];
}

/**
 * Validates stock availability for cart items by fetching real-time data from WooCommerce.
 * This is the critical section that prevents overselling.
 * 
 * @param items - Cart items to validate
 * @returns Validation result with any stock errors
 * @throws Network/API errors to trigger offline mode handling
 */
export async function validateStock(items: CartItem[]): Promise<StockValidationResult> {
    await requireRole(["ADMIN", "CASHIER"]); // 🔒
    const errors: StockValidationResult['errors'] = [];

    try {
        // 1. Group items by product ID and variation ID
        const productIds = Array.from(new Set(items.map(item => item.id)));
        
        // 2. Fetch all parent products in bulk
        const productsResponse = await api.get("products", {
            include: productIds.join(','),
            per_page: 100
        });
        
        const productsMap = new Map(productsResponse.data.map((p: any) => [String(p.id), p]));

        // 3. For variations, we need to fetch their specific data
        // Group variation IDs by their parent product ID
        const variationsByParent = new Map<string, string[]>();
        items.forEach(item => {
            if (item.variantId) {
                const existing = variationsByParent.get(item.id) || [];
                variationsByParent.set(item.id, [...existing, item.variantId]);
            }
        });

        // Fetch variations for each parent in bulk
        const variationsMap = new Map<string, any>(); // key: parentId-variantId
        
        await Promise.all(Array.from(variationsByParent.entries()).map(async ([parentId, variantIds]) => {
            try {
                const varResponse = await api.get(`products/${parentId}/variations`, {
                    include: variantIds.join(','),
                    per_page: 100
                });
                varResponse.data.forEach((v: any) => {
                    variationsMap.set(`${parentId}-${v.id}`, v);
                });
            } catch (err) {
                console.error(`Failed to fetch variations for product ${parentId}:`, err);
                // Errors handled later during item loop
            }
        }));

        // 4. Validate each item against fetched data
        for (const item of items) {
            const parent = productsMap.get(item.id) as any;
            
            if (!parent) {
                errors.push({
                    id: item.variantId || item.id,
                    name: item.name,
                    requested: item.quantity,
                    available: 0,
                    reason: 'Product not found in WooCommerce'
                });
                continue;
            }

            // Determine if we use parent stock or variation stock
            const target = (item.variantId 
                ? variationsMap.get(`${item.id}-${item.variantId}`)
                : parent) as any;

            if (!target) {
                errors.push({
                    id: item.variantId || item.id,
                    name: item.name,
                    requested: item.quantity,
                    available: 0,
                    reason: item.variantId ? 'Variation not found' : 'Product data missing'
                });
                continue;
            }

            const manageStock = target.manage_stock;
            const stockQuantity = target.stock_quantity ?? 0;
            const stockStatus = target.stock_status; // 'instock', 'outofstock', 'onbackorder'
            const productStatus = parent.status; // status is always on the parent
            const name = item.variantName 
                ? `${item.name} (${item.variantName})` 
                : (target.name || item.name);

            // Check if product is published
            if (productStatus !== 'publish') {
                errors.push({
                    id: item.variantId || item.id,
                    name: name,
                    requested: item.quantity,
                    available: 0,
                    reason: `Product is ${productStatus}`
                });
                continue;
            }

            // If stock management is enabled, check quantity
            if (manageStock) {
                if (stockQuantity < item.quantity) {
                    errors.push({
                        id: item.variantId || item.id,
                        name: name,
                        requested: item.quantity,
                        available: stockQuantity,
                        reason: 'Insufficient stock'
                    });
                }
            } else {
                // If stock management is disabled on the target, check stock_status
                if (stockStatus === 'outofstock') {
                    errors.push({
                        id: item.variantId || item.id,
                        name: name,
                        requested: item.quantity,
                        available: 0,
                        reason: 'Out of stock'
                    });
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };

    } catch (error: any) {
        console.error("Critical error in validateStock:", error);
        throw error; // Rethrow to trigger offline fallback in UI
    }
}
