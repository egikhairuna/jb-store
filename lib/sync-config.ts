/**
 * Centralized Sync Configuration
 * Consumes environment variables with sensible production defaults
 */

export const syncConfig = {
  // Intervals in milliseconds
  productSyncInterval: Number(process.env.PRODUCT_SYNC_INTERVAL) || 900000, // 15 minutes
  orderSyncInterval: Number(process.env.ORDER_SYNC_INTERVAL) || 120000,     // 2 minutes

  // WooCommerce API pagination limits
  wcProductPerPage: Number(process.env.WC_PRODUCT_PER_PAGE) || 50,
  wcOrderPerPage: Number(process.env.WC_ORDER_PER_PAGE) || 50,
  orderHotWindowMonths: Number(process.env.ORDER_HOT_WINDOW_MONTHS) || 3,

  // Retry settings
  maxRetries: 3,
  initialRetryDelay: 1000, // 1 second
};
