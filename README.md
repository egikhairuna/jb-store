# Modern POS System (Next.js + WooCommerce)

A professional, high-performance Point of Sale (POS) system built with **Next.js 16**, designed to integrate seamlessly with **WooCommerce**. This application provides a modern interface for managing physical store sales while keeping inventory and orders synchronized with your online WooCommerce store.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![React](https://img.shields.io/badge/React-19.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38b2ac)

## 🚀 Key Features

- **Dashboard & Analytics**: Real-time overview of daily/monthly revenue, recent orders, and sales trends using interactive charts.
- **Point of Sale (POS)**:
  - Fast and intuitive interface for cashiers.
  - Support for barcode scanning (using `react-barcode` / `jsbarcode`).
  - Product search and filtering.
  - Cart management with tax & discount calculations.
- **WooCommerce Integration**:
  - **Product Sync**: Fetches products, variations, prices, and stock levels from WooCommerce.
  - **Order Sync**: Pushes POS orders to WooCommerce and fetches online orders for unified reporting.
  - **Robust Syncing**: Implements a locking mechanism and batch processing to handle large catalogs reliably (`lib/sync-service.ts`).
- **Inventory Management**: View current stock levels, variations, and SKU details.
- **Reports**: Detailed breakdowns of sales performance.
- **Modern UI/UX**: Built with **Radix UI** and **Tailwind CSS 4** for a polished, accessible, and responsive experience.
- **Invoice Generation**: PDF invoice generation capability.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/), [Shadcn UI](https://ui.shadcn.com/) patterns
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Forms**: React Hook Form + Zod
- **WooCommerce**: `@woocommerce/woocommerce-rest-api`

## 🏁 Getting Started

### Prerequisites

- **Node.js**: Version 20 or higher recommended.
- **WooCommerce Store**: A WordPress site with WooCommerce installed and API keys generated.

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/pos-system.git
    cd pos-system
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

### Configuration

Create a `.env` file in the root directory. You can use the example below as a template:

```env
# WooCommerce API Credentials
WC_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WC_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WC_URL=https://your-woocommerce-store.com

# NextAuth / Authentication (If applicable)
NEXTAUTH_SECRET=your_super_secret_key
NEXTAUTH_URL=http://localhost:3000

# Other Configs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note**: Ensure you use `https` for your WooCommerce URL if your site has SSL (recommended).

### Running the Application

run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

```bash
.
├── app/                  # Next.js App Router pages and API routes
│   ├── api/              # Backend API routes (Auth, Sync, etc.)
│   ├── inventory/        # Inventory management page
│   ├── pos/              # Main POS interface
│   ├── reports/          # Sales reports page
│   ├── layout.tsx        # Root layout with navigation
│   └── page.tsx          # Dashboard / Home page
├── components/           # Reusable UI components
│   ├── ui/               # Radix/Shadcn UI primitives (Buttons, Cards, Inputs)
│   ├── dashboard/        # Dashboard-specific widgets
│   └── ...
├── lib/                  # Utilities and business logic
│   ├── store.ts          # Zustand global store (Cart, Products, etc.)
│   ├── sync-service.ts   # Core logic for syncing with WooCommerce
│   ├── sync-lock.ts      # Concurrency control for sync operations
│   └── woocommerce.ts    # WooCommerce API client instance
├── public/               # Static assets
└── ...
```

## 🔄 Synchronization Details

The application uses a dedicated **Sync Service** (`lib/sync-service.ts`) to maintain consistency between the local POS state and the WooCommerce backend.

- **Manual Sync**: Can be triggered from the settings or dashboard.
- **Batch Processing**: Fetches products in batches to avoid hitting API rate limits or memory issues.
- **Locking**: Uses `sync-lock.ts` to prevent multiple sync operations from running simultaneously and causing data corruption.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
