import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { wcConfig } from "./config";

// Initialize the WooCommerce client
// Note: In Next.js, use environment variables to secure these keys.
// The consumer key and secret should theoretically be kept server-side.
const api = new WooCommerceRestApi({
  url: wcConfig.url,
  consumerKey: wcConfig.consumerKey,
  consumerSecret: wcConfig.consumerSecret,
  version: "wc/v3",
});

export default api;
