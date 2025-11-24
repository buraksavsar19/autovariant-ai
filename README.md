# Autovariant AI - Shopify App

AI-powered product variant creator for Shopify stores. Create product variants in seconds using natural language descriptions.

## Features

- 🤖 **AI-Powered Variant Creation** - Describe variants in natural language
- 🎨 **Smart Color Matching** - Automatically match product images to variants
- 📦 **Bulk Operations** - Create variants for multiple products at once
- 💾 **Template System** - Save and reuse variant templates
- ⚡ **Fast & Easy** - No coding required, just describe and create

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Shopify Partner account
- Shopify development store (for testing)

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create `.env` file):
   ```
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   SCOPES=write_products
   OPENAI_API_KEY=your_openai_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Install the app on your Shopify store
2. Navigate to the Variant Creator page
3. Select a product
4. Describe your variants in natural language (e.g., "S to 3XL, red green blue, $50")
5. Upload product images (optional)
6. Review and create variants

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** React, Vite
- **UI:** Shopify Polaris
- **AI:** OpenAI API
- **Database:** SQLite (development), PostgreSQL (production recommended)

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run deploy` - Deploy to Shopify

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Documentation

- [App Store Publishing Guide](./APP_STORE_GUIDE.md)
- [Detailed Publishing Guide](./APP_STORE_DETAYLI_REHBER.md)
- [Security Policy](./SECURITY.md)
- [Privacy Policy](./PRIVACY.md)
- [Terms of Service](./TERMS.md)

## Support

For support, email buraksavsar19@gmail.com

## License

UNLICENSED - All rights reserved

---

**Built with ❤️ for Shopify merchants**
