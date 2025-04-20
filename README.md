# QSO Map

A modern web application built with Next.js for visualizing and managing QSO (amateur radio contact) data on an interactive map.

## Features

- Interactive map visualization
- Modern UI components using Radix UI
- Responsive design with Tailwind CSS
- TypeScript for type safety
- Next.js 15 for optimal performance

## Prerequisites

- Node.js (Latest LTS version recommended)
- pnpm (Package manager)

## Getting Started

# You can now run this as a  container on dockerhub: dkingshott/qso-map:latest

1. Clone the repository:
```bash
git clone [your-repository-url]
cd qso-map
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Building for Production

To create a production build:

```bash
npm build
```

To start the production server:

```bash
npm start
```

## Project Structure

- `/app` - Next.js app directory containing pages and API routes
- `/components` - Reusable UI components
- `/hooks` - Custom React hooks
- `/lib` - Utility functions and shared code
- `/public` - Static assets
- `/styles` - Global styles and Tailwind configuration

## Technologies Used

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS
- Radix UI Components
- React Simple Maps
- Various other UI utilities and components

## Development

- `npm dev` - Start development server
- `npm build` - Create production build
- `npm start` - Start production server
- `npm lint` - Run linting

## License

do whatever you want with it, I needed it so I built it with vercel and cursor - if you can use it, feel free to do so, feel free to modify it, or bundle it with you own software, I don't care.
