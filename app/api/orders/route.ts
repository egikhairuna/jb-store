import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

/**
 * API for POS Orders
 * POST: Create a new order in the database
 * GET: Fetch orders for the current user (or all if ADMIN)
 */

export async function POST(req: Request) {
  try {
    // 🔒 Security check
    const user = await requireRole(["CASHIER", "ADMIN"]);
    
    // Parse request body
    const body = await req.json();
    const {
      posOrderId,
      wcOrderId,
      items,
      subtotal,
      discountAmount,
      discountType, // Added: expect discountType in body
      taxAmount,
      total,
      paymentMethod,
      syncStatus,
    } = body;

    // --- Phase 2C: Server-Side Discount Validation ---
    const numericSubtotal = parseFloat(subtotal);
    const numericDiscount = parseFloat(discountAmount || 0);
    
    // 1. Max Discount Cap Check
    if (user.role === "CASHIER") {
      const discountPercent = discountType === "percent" 
        ? numericDiscount 
        : (numericDiscount / numericSubtotal) * 100;
      
      if (discountPercent > 50) {
        return NextResponse.json(
          { success: false, error: "Cashiers cannot apply discounts greater than 50%" },
          { status: 403 }
        );
      }
    }

    // 2. Validate Discount Logic
    if (numericDiscount > numericSubtotal) {
      return NextResponse.json(
        { success: false, error: "Discount cannot exceed subtotal" },
        { status: 400 }
      );
    }

    // 1. Create the order record
    const order = await prisma.order.create({
      data: {
        posOrderId: posOrderId || `POS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        wcOrderId: wcOrderId ? String(wcOrderId) : null,
        cashierId: user.id,
        items: JSON.stringify(items),
        subtotal: numericSubtotal,
        discountAmount: numericDiscount,
        taxAmount: parseFloat(taxAmount || 0),
        total: parseFloat(total),
        paymentMethod: paymentMethod || "cash",
        syncStatus: syncStatus || "PENDING",
      },
    });

    // 2. Create Audit Log for transparency
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        orderId: order.id,
        action: "ORDER_CREATED",
        details: JSON.stringify({
          posOrderId: order.posOrderId,
          total: order.total,
          wcOrderId: order.wcOrderId,
          paymentMethod: order.paymentMethod,
          discountAmount: numericDiscount,
          discountType // helpful context
        }),
      },
    });

    // 3. Special Audit Entry for High Discounts
    if (numericDiscount > 0) {
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                orderId: order.id,
                action: "DISCOUNT_APPLIED",
                details: JSON.stringify({
                    amount: numericDiscount,
                    type: discountType,
                    reason: "Checkout discount application"
                })
            }
        });
    }

    console.log(`[API] Order ${order.posOrderId} saved to database`);

    return NextResponse.json({
      success: true,
      data: order
    });

  } catch (error: any) {
    console.error("[API] Order creation error:", error);
    
    // If it's a validation error from requireRole, it might throw a Response
    if (error instanceof Response) return error;

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal server error" 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 🔒 Security check
    const user = await requireRole(["CASHIER", "ADMIN"]);
    
    // Admins see everything, cashiers see their own sales
    const where = user.role === "ADMIN" ? {} : { cashierId: user.id };

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        cashier: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Parse serialized items back to JSON objects for the frontend
    const parsedOrders = orders.map((order) => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
    }));

    return NextResponse.json({
      success: true,
      data: parsedOrders
    });

  } catch (error: any) {
    console.error("[API] Order fetch error:", error);
    
    if (error instanceof Response) return error;

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal server error" 
      },
      { status: 500 }
    );
  }
}

// Ensure dynamic rendering
export const dynamic = 'force-dynamic';
