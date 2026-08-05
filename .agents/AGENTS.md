# Workspace Rules

## Admin Dashboard UI Standard (/admin/*)
1. **Shadcn UI & Lucide Icons**: All `/admin/*` pages, components, modals, and summary cards must strictly follow standard Shadcn UI design patterns (`@/components/ui/card`, `@/components/ui/badge`, `@/components/ui/button`, etc.) and Lucide React icons.
2. **Clean SaaS Aesthetic**: Use clean hairline borders (`border-border`), subtle muted backgrounds (`bg-muted/30`, `bg-card`), crisp typography, and standard data tables. Do NOT use cyberpunk gradients, neon glow shadows, or non-standard dark/alien elements in the admin portal.
3. **Interactive & Functional**: Every summary card or filter pill must be 100% interactive and directly update the table filter when clicked.
4. **No Text Emoticons/Emojis**: NEVER use text emojis/emoticons in admin UI text (e.g. 📡, 📍, ⚡, 💰, 💳, 🏠, ⏰). ALWAYS use proper Lucide React icons (`<Wifi />`, `<MapPin />`, `<Zap />`, `<DollarSign />`, `<Calendar />`, `<Server />`, etc.).

## Hallmark Enterprise Standard (Customer Portal & Public Pages)
For ALL customer-facing UI development (customer portal, payment pages, public landing pages), follow the local `hallmark` skill with the **Oceanic Blue** theme.
1. **No Fake Jargon**: Never use fake terminal/hacker text. Use normal, professional Indonesian text.
2. **Fresh Hallmark Colors (Oceanic Blue)**: `--color-primary: #002c60`, `--color-accent: #1b437c`.
3. **Dark Mode Disabled**: Dark mode is disabled for the customer portal (light background).
