# Workspace Rules

## Hallmark Enterprise Standard
For ALL UI development, redesigns, or component updates in this workspace (EugineBill), you MUST generate a **fresh design** by strictly following the local `hallmark` skill.

**Rules to strictly follow:**
1. **No Fake Jargon**: Never use fake terminal/hacker text (e.g., `EXEC_PAY`, `TX_LOGS`, `[sys.process]`). Use normal, professional, human-readable Indonesian text for all customer-facing labels (e.g., "Bayar Sekarang", "Riwayat Transaksi").
2. **Fresh Hallmark Colors (Oceanic Blue)**: Do NOT rely on the legacy EugineBill brand colors (Red `#ff2a4b`) OR any custom generated palettes. You MUST use the **Oceanic Blue** theme as specified in the local `design.md` artifact (e.g., `--color-primary: #002c60`, `--color-accent: #1b437c`). Maintain this specific theme for all customer-facing UI.
3. **Professional Aesthetic**: Focus on hairline borders, proper typography (sans-serif for display, mono for data), and structured layouts (Bento Grids, simple tables) without any cyberpunk gradients or heavy shadows.
4. **Dark Mode Disabled**: Dark mode is currently disabled in the customer portal. Ensure all styling assumes a light background (Surface Bright/Lowest).
