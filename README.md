# TRAINR — Digital Fitness Platform

TRAINR is a digital fitness platform designed to connect gym-goers with personal trainers. The platform aims to help users discover trainers, define fitness goals, manage training sessions, follow workout plans, and track their progress.

The application is being developed with **React Native, Expo, and TypeScript**, with a shared design system supporting light and dark themes.

## Project Status

**Current phase:** Foundation and initial app flow

- [x] Expo and TypeScript project setup
- [x] Expo Router navigation foundation
- [x] TRAINR design system and theme provider
- [x] Reusable UI component library
- [x] Inter and Barlow Condensed typography
- [x] Supabase connectivity verification
- [x] Welcome screen and user role selection
- [x] Component testing with Jest
- [ ] Supabase authentication and session management
- [ ] Gym-goer onboarding
- [ ] Personal trainer onboarding
- [ ] Trainer discovery and matching
- [ ] Booking and training session management
- [ ] Workout plans and progress tracking

## Technology Stack

| Technology | Purpose |
|---|---|
| React Native | Cross-platform mobile application |
| Expo SDK 57 | Development tooling and native capabilities |
| TypeScript | Type safety and maintainable application code |
| Expo Router | File-based application navigation |
| Supabase | Backend connectivity and planned authentication/data services |
| React Native Safe Area Context | Safe-area layout handling |
| Inter | Interface and body typography |
| Barlow Condensed | Display typography and headings |
| Jest | Automated testing |
| React Native Testing Library | Component testing |
| ESLint | Code quality and linting |
| Prettier | Consistent code formatting |
| Git and GitHub | Version control and source management |

## Current Features

### Welcome and Role Selection

The current home screen introduces TRAINR and lets users select their intended experience:

- **Gym-goer:** Discover trainers and work towards personal fitness goals.
- **Personal trainer:** Build a professional profile and connect with potential clients.

Role selection currently uses local component state. It displays the selected role and a corresponding confirmation message. Persistent role storage and navigation into separate onboarding journeys have not yet been implemented.

### Design System

TRAINR uses a shared theme system designed for consistent interfaces across the application.

**Brand colours**

| Token | Light mode | Dark mode |
|---|---|---|
| Brand black | `#0B0B0B` | `#000000` |
| Brand white | `#FFFFFF` | `#FFFFFF` |
| TRAINR red | `#D71920` | `#F0111A` |
| TRAINR dark red | `#B91C1C` | `#C90D15` |
| TRAINR light red | `#FDE8E9` | Theme-dependent surfaces |

**Typography**

- **Inter:** Interface text, body copy, labels and supporting information.
- **Barlow Condensed:** Display headings, prominent titles and metrics.

The theme system also provides reusable colour, spacing, radius, sizing, motion and shadow tokens.

### Reusable Components

The current component foundation includes:

- `AppText` — typography variants and consistent text styling
- `Button` — reusable action buttons
- `IconButton` — accessible icon actions
- `Input` — themed form inputs
- `Card` — reusable content containers
- `Avatar` — profile imagery and initials
- `Badge` — status and category indicators
- `Divider` — visual separation
- `Layout` — `Stack`, `Row` and `Spacer` primitives
- `Screen` — safe-area and screen layout handling
- `Feedback/States` — loading, empty and error states
- `Progress/ProgressBar` — linear progress indicator
- `Progress/ProgressRing` — circular progress indicator

## Project Structure

```text
trainr/
├── assets/
│   └── images/
├── src/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── explore.tsx
│   ├── components/
│   │   ├── AppText/
│   │   ├── Avatar/
│   │   ├── Badge/
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Divider/
│   │   ├── Feedback/
│   │   ├── IconButton/
│   │   ├── Input/
│   │   ├── Layout/
│   │   ├── Progress/
│   │   └── Screen/
│   ├── lib/
│   │   └── supabase.ts
│   └── theme/
│       ├── ThemeProvider.tsx
│       ├── colors.ts
│       ├── motion.ts
│       ├── radius.ts
│       ├── shadows.ts
│       ├── sizes.ts
│       ├── spacing.ts
│       └── typography.ts
├── .env.example
├── app.json
├── package.json
├── tsconfig.json
└── README.md
```

The structure above highlights the main application files and components. Additional configuration and test files are present in the repository.

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js compatible with the project's Expo SDK
- npm
- Git
- Expo Go or an iOS Simulator / Android Emulator
- A Supabase project for backend connectivity checks

### 1. Clone the repository

```bash
git clone https://github.com/jaa38/trainr.git
cd trainr
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file using the example:

```bash
cp .env.example .env
```

Set the following variables using your own Supabase project credentials:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Do not commit your actual environment file or private credentials. Variables prefixed with `EXPO_PUBLIC_` are bundled into the client application and must not contain service-role keys or other server-side secrets.

### 4. Start the development server

```bash
npx expo start
```

Use the terminal instructions to open the application in the iOS Simulator, Android Emulator or Expo Go, where supported by the installed SDK.

To start directly on iOS:

```bash
npm run ios
```

To start on Android:

```bash
npm run android
```

To run the web target:

```bash
npm run web
```

## Backend Connectivity

The Supabase client is configured in `src/lib/supabase.ts`. The current Explore screen provides a connectivity check that verifies the Supabase authentication endpoint is reachable.

This confirms backend connectivity; it does not mean that user registration, login, profile persistence or the complete authentication flow has been implemented.

## Testing and Code Quality

TRAINR currently has **125 passing tests across 14 Jest test suites**.

Run the test suite:

```bash
npm test -- --runInBand
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Run ESLint:

```bash
npx expo lint
```

Check formatting:

```bash
npm run format:check
```

Format project files:

```bash
npm run format
```

These checks were passing at the latest verified development checkpoint. Run them again after making changes to confirm the current state.

## Development Roadmap

### Phase 1 — Foundation

- Establish the Expo and TypeScript project
- Configure navigation and theme infrastructure
- Build reusable components and design tokens
- Configure Supabase connectivity
- Add automated component tests

### Phase 2 — Authentication and Navigation

- Implement sign-up and sign-in
- Add sign-out and session handling
- Persist user roles
- Establish public and authenticated navigation flows

### Phase 3 — User Onboarding

**Gym-goer experience**
- Fitness goal selection
- Training experience
- Training preferences
- Profile setup

**Personal trainer experience**
- Professional profile
- Areas of expertise
- Qualifications and experience
- Training services and availability

### Phase 4 — Core Fitness Marketplace

- Trainer discovery and profiles
- Search, filtering and matching
- Trainer reviews and ratings
- Session booking and scheduling

### Phase 5 — Training and Progress

- Workout plans
- Training session management
- Fitness progress tracking
- AI-powered fitness insights

The roadmap describes intended functionality, not features currently available in the application.

## Repository

GitHub: https://github.com/jaa38/trainr

## License

No open-source license has been specified yet. All rights are reserved unless a license is added to the repository.
